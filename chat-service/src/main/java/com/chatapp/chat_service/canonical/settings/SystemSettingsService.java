package com.chatapp.chat_service.canonical.settings;

import com.chatapp.chat_service.canonical.appauth.AppAuthorizationService;
import com.chatapp.chat_service.canonical.appauth.AppPermission;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalRoomAuditEvent;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.*;
import org.springframework.stereotype.Service;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class SystemSettingsService {
    private static final org.slf4j.Logger LOG = org.slf4j.LoggerFactory.getLogger(SystemSettingsService.class);
    private final SystemSettingsRepository repository;
    private final AppAuthorizationService authorization;
    private final SystemSettingsAuditRecovery recovery;
    public SystemSettingsService(SystemSettingsRepository repository, AppAuthorizationService authorization,
                                 SystemSettingsAuditRecovery recovery) {
        this.repository = repository; this.authorization = authorization; this.recovery = recovery;
    }
    public List<SettingView> list(UUID actor) {
        authorization.require(actor, AppPermission.SYSTEM_OPERATE);
        return Arrays.stream(SystemSetting.values()).map(this::view).toList();
    }
    public CommunityDefaults communityDefaults() {
        return new CommunityDefaults(view(SystemSetting.COMMUNITY_CREATION_ENABLED).value().booleanValue(),
                view(SystemSetting.COMMUNITY_DEFAULT_MAX_MEMBERS).value().intValue());
    }
    public Result update(UUID actor, String key, Update request) {
        authorization.require(actor, AppPermission.SYSTEM_OPERATE);
        var definition = SystemSetting.fromKey(key);
        if (request == null || request.commandId() == null || request.expectedRevision() == null
                || SystemSettingsRepository.PRISTINE_REVISION.equals(request.commandId())
                || request.reason() == null || request.reason().isBlank() || request.reason().length() > 500) {
            throw new BadRequestException("system setting command, revision and reason are required");
        }
        String value = definition.validate(request.value()), reason = request.reason().strip();
        String fingerprint = fingerprint(key, request.expectedRevision(), value, reason);
        var replay = replay(key, request.commandId(), actor, fingerprint);
        if (replay != null) return result(definition, replay);
        var before = state(definition);
        if (!before.revision().equals(request.expectedRevision())) throw new ConflictException("system setting changed; reload before saving");
        Instant at = Instant.now();
        var next = new SystemSettingsRepository.State(key, value, request.commandId(), actor, at);
        var audit = new CanonicalRoomAuditEvent(actor, DateTimeFormatter.ofPattern("yyyy-MM").withZone(ZoneOffset.UTC).format(at),
                Uuids.timeBased(), "SYSTEM_SETTING_UPDATED", "SYSTEM_SETTING", key, null, null, "SUCCESS", reason,
                auditState(before), auditState(next), request.commandId(), null, null, at);
        var command = new SystemSettingsRepository.Command(request.commandId(), actor, fingerprint, next, audit);
        if (!repository.save(command, before.revision())) {
            replay = replay(key, request.commandId(), actor, fingerprint);
            if (replay != null) return result(definition, replay);
            throw new ConflictException("system setting changed; reload before saving");
        }
        return result(definition, command);
    }
    private SystemSettingsRepository.Command replay(String key, UUID id, UUID actor, String fingerprint) {
        var command = repository.findCommand(key, id);
        if (command != null && (!actor.equals(command.actorId()) || !fingerprint.equals(command.fingerprint()))) {
            throw new ConflictException("system setting commandId was already used for another request");
        }
        return command;
    }
    private Result result(SystemSetting definition, SystemSettingsRepository.Command command) {
        boolean pending = false;
        try { recovery.export(command); }
        catch (RuntimeException failure) {
            pending = true;
            LOG.warn("System setting committed; audit export retained pending work ({})", failure.getClass().getSimpleName());
        }
        var current = repository.find(definition.key());
        if (current == null) throw new IllegalStateException("committed system setting authority is missing");
        return new Result(command.commandId(), view(definition, current), pending);
    }
    private Map<String, String> auditState(SystemSettingsRepository.State state) {
        return Map.of("value", state.value(), "revision", state.revision().toString());
    }
    private String fingerprint(String key, UUID expected, String value, String reason) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest((key + "\n" + expected + "\n" + value + "\n" + reason).getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException missing) { throw new IllegalStateException("SHA-256 unavailable", missing); }
    }
    private SystemSettingsRepository.State state(SystemSetting definition) {
        var stored = repository.find(definition.key());
        return stored == null ? new SystemSettingsRepository.State(definition.key(), definition.defaultValue().toString(),
                SystemSettingsRepository.PRISTINE_REVISION, null, null) : stored;
    }
    private SettingView view(SystemSetting definition) {
        return view(definition, state(definition));
    }
    private SettingView view(SystemSetting definition, SystemSettingsRepository.State state) {
        return new SettingView(definition.key(), definition.type(), definition.readStored(state.value()), definition.defaultValue(),
                definition.min(), definition.max(), state.revision(), state.updatedBy(), state.updatedAt());
    }
    public record SettingView(String key, String type, JsonNode value, JsonNode defaultValue, Integer min, Integer max,
                              UUID revision, UUID updatedBy, Instant updatedAt) { }
    public record CommunityDefaults(boolean creationEnabled, int defaultMaxMembers) { }
    public record Update(@NotNull UUID commandId, @NotNull UUID expectedRevision, @NotNull JsonNode value,
                         @NotBlank @Size(max=500) String reason) { }
    public record Result(UUID commandId, SettingView setting, boolean auditPending) { }
}

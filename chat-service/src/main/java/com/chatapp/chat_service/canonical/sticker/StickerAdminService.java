package com.chatapp.chat_service.canonical.sticker;

import com.chatapp.chat_service.canonical.appauth.AppAuthorizationService;
import com.chatapp.chat_service.canonical.appauth.AppPermission;
import com.chatapp.chat_service.canonical.media.MediaAssetRepository;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalRoomAuditEvent;
import com.chatapp.chat_service.common.exception.*;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.constraints.*;
import org.springframework.stereotype.Service;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.HexFormat;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import static com.chatapp.chat_service.canonical.sticker.StickerRepository.*;

@Service
public class StickerAdminService {
    private static final org.slf4j.Logger LOG = org.slf4j.LoggerFactory.getLogger(StickerAdminService.class);
    private final StickerRepository repository;
    private final MediaAssetRepository assets;
    private final AppAuthorizationService authorization;
    private final StickerAuditRecovery recovery;
    private final ObjectMapper mapper;
    public StickerAdminService(StickerRepository repository, MediaAssetRepository assets,
                               AppAuthorizationService authorization, StickerAuditRecovery recovery, ObjectMapper mapper) {
        this.repository = repository; this.assets = assets; this.authorization = authorization;
        this.recovery = recovery; this.mapper = mapper;
    }

    public Result createPack(UUID actor, CreatePack request) {
        authorization.require(actor, AppPermission.SYSTEM_OPERATE);
        validate(request.commandId(), request.name(), request.reason());
        if (request.stickerPackId() == null) throw new BadRequestException("stickerPackId is required");
        String hash = fingerprint("CREATE_PACK", request);
        var replay = replay(request.stickerPackId(), request.commandId(), actor, hash);
        if (replay != null) return result(replay);
        if (repository.findPack(request.stickerPackId()) != null) throw new ConflictException("sticker pack already exists");
        retain(actor, request.coverAssetId(), true);
        Pack pack = new Pack(request.stickerPackId(), request.name().strip(), description(request.description()),
                request.coverAssetId(), request.isOfficial(), false, UUID.randomUUID(), Instant.now());
        Command command = command(actor, request.commandId(), hash, pack, null, "STICKER_PACK_CREATED", request.reason(), Map.of());
        return complete(command, repository.createPack(command));
    }

    public Result updatePack(UUID actor, UUID packId, UpdatePack request) {
        authorization.require(actor, AppPermission.SYSTEM_OPERATE);
        validate(request.commandId(), request.name(), request.reason());
        String hash = fingerprint("UPDATE_PACK", request);
        var replay = replay(packId, request.commandId(), actor, hash);
        if (replay != null) return result(replay);
        Pack old = pack(packId, request.expectedRevision());
        if (request.isActive() && !old.isActive() && !request.artworkReviewed())
            throw new BadRequestException("review the artwork before publishing this pack");
        boolean changedCover = !Objects.equals(old.coverAssetId(), request.coverAssetId());
        if (request.isActive() || changedCover) retain(actor, request.coverAssetId(), changedCover);
        Pack next = new Pack(packId, request.name().strip(), description(request.description()), request.coverAssetId(),
                request.isOfficial(), request.isActive(), UUID.randomUUID(), Instant.now());
        Command command = command(actor, request.commandId(), hash, next, null, "STICKER_PACK_UPDATED", request.reason(), state(old, null));
        return complete(command, repository.changePack(command, old.revision()));
    }

    public Result createSticker(UUID actor, UUID packId, CreateSticker request) {
        authorization.require(actor, AppPermission.SYSTEM_OPERATE);
        validate(request.commandId(), request.name(), request.reason());
        validateOrder(request.sortOrder());
        if (request.stickerId() == null || request.assetId() == null) throw new BadRequestException("stickerId and assetId are required");
        String hash = fingerprint("CREATE_STICKER", request);
        var replay = replay(packId, request.commandId(), actor, hash);
        if (replay != null) return result(replay);
        Pack old = pack(packId, request.expectedRevision());
        if (repository.findSticker(packId, request.stickerId()) != null) throw new ConflictException("sticker already exists");
        if (request.isActive() && !request.artworkReviewed()) throw new BadRequestException("review the artwork before publishing this sticker");
        retain(actor, request.assetId(), true);
        Sticker sticker = new Sticker(request.stickerId(), packId, request.name().strip(), request.assetId(),
                request.sortOrder(), request.isActive(), UUID.randomUUID());
        Command command = command(actor, request.commandId(), hash, advance(old), sticker, "STICKER_CREATED", request.reason(), state(old, null));
        return complete(command, repository.changeSticker(command, old.revision(), null));
    }

    public Result updateSticker(UUID actor, UUID packId, UUID stickerId, UpdateSticker request) {
        authorization.require(actor, AppPermission.SYSTEM_OPERATE);
        validate(request.commandId(), request.name(), request.reason());
        validateOrder(request.sortOrder());
        String hash = fingerprint("UPDATE_STICKER:" + stickerId, request);
        var replay = replay(packId, request.commandId(), actor, hash);
        if (replay != null) return result(replay);
        Pack old = pack(packId, request.expectedRevision());
        Sticker previous = repository.findSticker(packId, stickerId);
        if (previous == null) throw new NotFoundException("sticker not found");
        if (request.isActive() && !previous.isActive() && !request.artworkReviewed())
            throw new BadRequestException("review the artwork before publishing this sticker");
        if (request.isActive()) retain(actor, previous.assetId(), false);
        Sticker next = new Sticker(stickerId, packId, request.name().strip(), previous.assetId(),
                request.sortOrder(), request.isActive(), UUID.randomUUID());
        Command command = command(actor, request.commandId(), hash, advance(old), next, "STICKER_UPDATED", request.reason(), state(old, previous));
        return complete(command, repository.changeSticker(command, old.revision(), previous));
    }

    private Pack pack(UUID id, UUID expected) {
        if (id == null || expected == null) throw new BadRequestException("pack ID and expectedRevision are required");
        Pack pack = repository.findPack(id);
        if (pack == null) throw new NotFoundException("sticker pack not found");
        if (!expected.equals(pack.revision())) throw new ConflictException("sticker pack changed; reload before saving");
        return pack;
    }
    private Pack advance(Pack old) {
        return new Pack(old.stickerPackId(), old.name(), old.description(), old.coverAssetId(), old.isOfficial(), old.isActive(), UUID.randomUUID(), Instant.now());
    }
    private Command replay(UUID packId, UUID commandId, UUID actor, String hash) {
        Command stored = repository.findCommand(packId, commandId);
        if (stored != null && (!actor.equals(stored.actorId()) || !hash.equals(stored.fingerprint())))
            throw new ConflictException("commandId was already used for another request");
        return stored;
    }
    private Result complete(Command command, boolean applied) {
        if (!applied) {
            Command stored = replay(command.pack().stickerPackId(), command.commandId(), command.actorId(), command.fingerprint());
            if (stored != null) return result(stored);
            throw new ConflictException("sticker pack changed; reload before saving");
        }
        return result(command);
    }
    private Result result(Command command) {
        boolean auditPending = false;
        try { recovery.export(command); }
        catch (RuntimeException exception) {
            auditPending = true;
            LOG.warn("Sticker command {} committed; audit export will retry", command.commandId());
        }
        return new Result(command.commandId(), command.pack(), command.sticker(), auditPending);
    }
    private Command command(UUID actor, UUID id, String hash, Pack pack, Sticker sticker, String action, String reason, Map<String,String> before) {
        Instant at = pack.updatedAt();
        var event = new CanonicalRoomAuditEvent(actor, DateTimeFormatter.ofPattern("yyyy-MM").withZone(ZoneOffset.UTC).format(at),
                Uuids.timeBased(), action, "STICKER_CATALOG", pack.stickerPackId().toString(), null, null,
                "SUCCESS", reason.strip(), before, state(pack, sticker), id, null, null, at);
        return new Command(id, actor, hash, pack, sticker, event);
    }
    private Map<String,String> state(Pack pack, Sticker sticker) {
        var state = new java.util.LinkedHashMap<String,String>();
        state.put("packName", pack.name()); state.put("packActive", Boolean.toString(pack.isActive()));
        state.put("packDescription", pack.description()); state.put("isOfficial", Boolean.toString(pack.isOfficial()));
        state.put("packRevision", pack.revision().toString());
        if (pack.coverAssetId() != null) state.put("coverAssetId", pack.coverAssetId().toString());
        if (sticker != null) {
            state.put("stickerId", sticker.stickerId().toString()); state.put("name", sticker.name());
            state.put("assetId", sticker.assetId().toString()); state.put("sortOrder", Integer.toString(sticker.sortOrder()));
            state.put("isActive", Boolean.toString(sticker.isActive()));
        }
        return Map.copyOf(state);
    }
    private void retain(UUID actor, UUID id, boolean mustOwn) {
        if (id == null) return;
        var asset = assets.findById(id);
        if (asset == null || !"READY".equals(asset.uploadStatus()) || asset.deletedAt() != null
                || asset.mimeType() == null || !Set.of("image/png", "image/webp", "image/jpeg", "image/gif").contains(asset.mimeType())
                || asset.width() == null || asset.height() == null || asset.width() < 1 || asset.height() < 1
                || asset.width() > 1024 || asset.height() > 1024 || asset.byteSize() < 1 || asset.byteSize() > 2L * 1024 * 1024
                || "INFECTED".equals(asset.malwareScanStatus()) || "REJECTED".equals(asset.moderationStatus()))
            throw new BadRequestException("sticker requires an available raster image up to 2 MB and 1024 pixels");
        if (mustOwn && !actor.equals(asset.ownerId())) throw new ForbiddenException("use an image uploaded by your account");
        try {
            URI url = URI.create(asset.publicUrl());
            if (!"https".equals(url.getScheme()) || url.getHost() == null || url.getUserInfo() != null) throw new IllegalArgumentException();
        } catch (IllegalArgumentException | NullPointerException ex) { throw new BadRequestException("invalid sticker asset URL"); }
        if (!assets.retainForHistory(id)) throw new ConflictException("image is being deleted or is no longer available");
    }
    private void validate(UUID commandId, String name, String reason) {
        if (commandId == null || name == null || name.isBlank() || name.length() > 80
                || reason == null || reason.isBlank() || reason.length() > 500) throw new BadRequestException("commandId, name and audit reason are required");
    }
    private void validateOrder(int order) { if (order < 0 || order > 999) throw new BadRequestException("sortOrder must be between 0 and 999"); }
    private String description(String value) {
        if (value != null && value.length() > 500) throw new BadRequestException("description exceeds 500 characters");
        return value == null ? "" : value.strip();
    }
    private String fingerprint(String action, Object value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest((action + ":" + mapper.writeValueAsString(value)).getBytes(StandardCharsets.UTF_8)));
        } catch (JsonProcessingException | java.security.NoSuchAlgorithmException ex) { throw new IllegalStateException("Cannot fingerprint sticker request", ex); }
    }

    public record Result(UUID commandId, Pack pack, Sticker sticker, boolean auditPending) { }
    public record CreatePack(@NotNull UUID commandId, @NotNull UUID stickerPackId, @NotBlank @Size(max=80) String name,
                             @Size(max=500) String description, UUID coverAssetId, boolean isOfficial, @NotBlank @Size(max=500) String reason) { }
    public record UpdatePack(@NotNull UUID commandId, @NotNull UUID expectedRevision, @NotBlank @Size(max=80) String name,
                             @Size(max=500) String description, UUID coverAssetId, boolean isOfficial, boolean isActive,
                             boolean artworkReviewed, @NotBlank @Size(max=500) String reason) { }
    public record CreateSticker(@NotNull UUID commandId, @NotNull UUID expectedRevision, @NotNull UUID stickerId,
                                @NotBlank @Size(max=80) String name, @NotNull UUID assetId, @Min(0) @Max(999) int sortOrder,
                                boolean isActive, boolean artworkReviewed, @NotBlank @Size(max=500) String reason) { }
    public record UpdateSticker(@NotNull UUID commandId, @NotNull UUID expectedRevision, @NotBlank @Size(max=80) String name,
                                @Min(0) @Max(999) int sortOrder, boolean isActive, boolean artworkReviewed, @NotBlank @Size(max=500) String reason) { }
}

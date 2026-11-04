package com.chatapp.chat_service.canonical.call;

import com.chatapp.chat_service.canonical.model.ConversationPermission;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.canonical.service.ConversationAuthorizationService;
import com.chatapp.chat_service.canonical.social.FriendshipRepository;
import com.chatapp.chat_service.canonical.user.UserRepository;
import com.chatapp.chat_service.common.exception.ConflictException;
import com.chatapp.chat_service.common.exception.BadRequestException;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import com.datastax.oss.driver.api.core.uuid.Uuids;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/** Authorizes and fences durable signaling lifecycle transitions. */
@Service
public class CallLifecycleService {
    private final CallRepository calls;
    private final ConversationAuthorizationService authorization;
    private final CanonicalCqlStore store;
    private final FriendshipRepository friendships;
    private final UserRepository users;
    private final Clock clock;

    @Autowired
    public CallLifecycleService(CallRepository calls, ConversationAuthorizationService authorization,
                                CanonicalCqlStore store, FriendshipRepository friendships, UserRepository users) {
        this(calls, authorization, store, friendships, users, Clock.systemUTC());
    }
    CallLifecycleService(CallRepository calls, ConversationAuthorizationService authorization,
                         CanonicalCqlStore store, FriendshipRepository friendships, UserRepository users, Clock clock) {
        this.calls = calls; this.authorization = authorization; this.store = store;
        this.friendships = friendships; this.users = users; this.clock = clock;
    }

    public CallState start(UUID actor, UUID room, UUID callId, UUID peer, CallState.Type type) {
        Instant now = now();
        CallState candidate = CallState.ringing(room, callId, Uuids.startOf(now.toEpochMilli()), actor, peer, type, now, UUID.randomUUID());
        requireActivePeer(room, actor, peer);
        authorization.requirePermission(room, actor, ConversationPermission.CALL_START);
        calls.initialize(room);
        for (int attempt = 0; attempt < 4; attempt++) {
            CallState existing = calls.find(room, callId);
            if (existing != null) {
                if (!existing.sameIdentity(candidate)) throw new ConflictException("callId belongs to another call identity");
                return get(actor, room, callId);
            }
            CallRepository.Slot slot = requireSlot(room);
            if (slot.activeCallId() != null) {
                CallState active = requireCall(room, slot.activeCallId());
                CallState expired = active.expire(now(), UUID.randomUUID());
                if (expired == active) throw new ConflictException("conversation already has an active call");
                calls.change(slot, active, expired);
                continue;
            }
            // Rebuild timestamps before each new CAS, but never change a committed identity.
            Instant started = now();
            candidate = CallState.ringing(room, callId, Uuids.startOf(started.toEpochMilli()), actor, peer, type, started, UUID.randomUUID());
            if (calls.claim(slot, candidate)) return candidate;
        }
        throw contention();
    }

    public CallState get(UUID actor, UUID room, UUID callId) {
        for (int attempt = 0; attempt < 4; attempt++) {
            CallState call = requireCall(room, callId);
            authorization.requireDirectPeer(room, actor, call.peerOf(actor));
            CallState expired = call.expire(now(), UUID.randomUUID());
            if (expired == call) return call;
            if (calls.change(requireSlot(room), call, expired)) return expired;
        }
        throw contention();
    }

    /** Point lookup only; absence never initializes a slot or means media connected. */
    public CallState active(UUID actor, UUID room) {
        authorization.requireMember(room, actor);
        var conversation = store.findConversation(room);
        if (conversation == null || Boolean.TRUE.equals(conversation.isDeleted())) throw new NotFoundException("active conversation is required");
        if (!"DM".equals(conversation.conversationType())) throw new BadRequestException("calls are supported only for direct conversations");
        for (int attempt = 0; attempt < 4; attempt++) {
            var slot = calls.slot(room);
            if (slot == null || slot.activeCallId() == null) return null;
            var call = calls.find(room, slot.activeCallId());
            if (call == null) throw new IllegalStateException("active call authority is missing");
            requireActivePeer(room, actor, call.peerOf(actor));
            // These are separate reads; do not mistake a replaced slot for this call.
            if (!slot.equals(calls.slot(room))) continue;
            if (call.terminal()) throw new IllegalStateException("terminal call still owns its slot");
            var expired = call.expire(now(), UUID.randomUUID());
            if (expired == call) return call;
            calls.change(slot, call, expired);
        }
        throw contention();
    }

    public CallState change(UUID actor, UUID room, UUID callId, CallState.Action action) {
        for (int attempt = 0; attempt < 4; attempt++) {
            CallState call = requireCall(room, callId);
            UUID peer = call.peerOf(actor);
            authorization.requireDirectPeer(room, actor, peer);
            if ((action == CallState.Action.ACCEPT || action == CallState.Action.HEARTBEAT) && !call.terminal()) {
                requireActivePeer(room, actor, peer);
            }
            CallState next = call.apply(actor, action, now(), UUID.randomUUID());
            if (next == call) return call;
            if (calls.change(requireSlot(room), call, next)) return next;
        }
        throw contention();
    }

    public CallState authorizeSignal(UUID actor, UUID room, UUID callId, UUID target) {
        CallState call = get(actor, room, callId);
        if (!call.peerOf(actor).equals(target)) throw new ForbiddenException("call target must match its participant");
        requireActivePeer(room, actor, target);
        if (call.status() != CallState.Status.ACCEPTED) throw new ConflictException("call is not accepting media signals");
        return call;
    }

    /** Read-only final delivery gate: an existing subscription is not lasting permission. */
    public void requireDelivery(UUID actor, CallDelivery delivery) {
        CallState call = requireCall(delivery.conversationId(), delivery.callId());
        requireActivePeer(call.conversationId(), actor, call.peerOf(actor));
        if (!call.terminal() && !now().isBefore(call.deadline())) throw new ConflictException("call deadline reached");
        if (delivery.kind() == CallDelivery.Kind.STATE && !call.revision().equals(delivery.revision())) {
            throw new ConflictException("call state was superseded");
        }
        // A heartbeat may advance revision without invalidating an in-flight accepted SDP/ICE.
        if (delivery.kind() == CallDelivery.Kind.SIGNAL && call.status() != CallState.Status.ACCEPTED) {
            throw new ConflictException("call no longer accepts signals");
        }
    }

    /** True means this exact pointer can be removed. False must be revisited. */
    public boolean expire(CallRepository.Expiry candidate) {
        if (now().isBefore(candidate.deadline())) return false;
        CallRepository.Slot slot = calls.slot(candidate.conversationId());
        if (slot == null) return false;
        CallState call = calls.find(candidate.conversationId(), candidate.callId());
        if (call == null || !call.revision().equals(candidate.revision())) {
            // An unknown prewrite may still commit after a paused process resumes.
            // Remove it only when its expected slot revision can never win again.
            return !slot.revision().equals(candidate.expectedSlotRevision());
        }
        if (call.terminal()) return true;
        if (!call.deadline().equals(candidate.deadline()) || !call.callId().equals(slot.activeCallId())) {
            throw new IllegalStateException("call expiry does not match authority");
        }
        CallState expired = call.expire(now(), UUID.randomUUID());
        return expired != call && calls.change(slot, call, expired);
    }

    private void requireActivePeer(UUID room, UUID actor, UUID peer) {
        authorization.requireDirectPeer(room, actor, peer);
        var conversation = store.findConversation(room);
        if (conversation == null || Boolean.TRUE.equals(conversation.isDeleted())) throw new NotFoundException("active conversation is required");
        if (friendships.isBlocked(actor, peer) || friendships.isBlocked(peer, actor)) {
            throw new ForbiddenException("calls are unavailable between blocked users");
        }
        requireActiveAccount(actor);
        requireActiveAccount(peer);
    }
    private void requireActiveAccount(UUID userId) {
        var user = users.findById(userId);
        if (user == null || !"ACTIVE".equalsIgnoreCase(user.accountStatus())) {
            throw new ForbiddenException("call participant is unavailable");
        }
    }
    private CallState requireCall(UUID room, UUID id) {
        CallState call = calls.find(room, id);
        if (call == null) throw new NotFoundException("call not found");
        return call;
    }
    private CallRepository.Slot requireSlot(UUID room) {
        var slot = calls.slot(room);
        if (slot == null) throw new IllegalStateException("call slot is missing");
        return slot;
    }
    private Instant now() { return clock.instant().truncatedTo(ChronoUnit.MILLIS); }
    private ConflictException contention() { return new ConflictException("call state changed; reload before retrying"); }
}

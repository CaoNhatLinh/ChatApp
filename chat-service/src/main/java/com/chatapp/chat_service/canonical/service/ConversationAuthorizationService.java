package com.chatapp.chat_service.canonical.service;

import com.chatapp.chat_service.canonical.model.ConversationPermission;
import com.chatapp.chat_service.canonical.model.ConversationRole;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversation;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversationMember;
import com.chatapp.chat_service.canonical.repository.CanonicalConversationRepository;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.common.exception.ForbiddenException;
import com.chatapp.chat_service.common.exception.NotFoundException;
import com.chatapp.chat_service.common.exception.BadRequestException;
import org.springframework.stereotype.Service;

import java.util.EnumSet;
import java.util.Set;
import java.util.UUID;

@Service
public class ConversationAuthorizationService {

    private static final Set<ConversationPermission> DM_MEMBER_PERMISSIONS = EnumSet.of(
            ConversationPermission.MESSAGE_SEND,
            ConversationPermission.MESSAGE_EDIT_OWN,
            ConversationPermission.MESSAGE_DELETE_OWN,
            ConversationPermission.POLL_CREATE,
            ConversationPermission.CALL_START);

    private final CanonicalCqlStore store;
    private final CanonicalConversationRepository conversationRepository;

    public ConversationAuthorizationService(
            CanonicalCqlStore store,
            CanonicalConversationRepository conversationRepository) {
        this.store = store;
        this.conversationRepository = conversationRepository;
    }

    public CanonicalConversationMember requireMember(UUID conversationId, UUID userId) {
        CanonicalConversationMember member = store.findConversationMember(conversationId, userId);
        if (member == null) {
            throw new ForbiddenException("not member of conversation");
        }
        return member;
    }

    public void requirePermission(UUID conversationId, UUID userId, ConversationPermission permission) {
        if (!effectivePermissions(conversationId, userId).contains(permission)) {
            throw new ForbiddenException("missing conversation permission: " + permission.name());
        }
    }

    public void requireDirectPeer(UUID conversationId, UUID actorId, UUID peerId) {
        CanonicalConversation conversation = store.findConversation(conversationId);
        if (conversation == null) {
            throw new NotFoundException("conversation not found");
        }
        if (!"DM".equals(conversation.conversationType())) {
            throw new BadRequestException("calls are supported only for direct conversations");
        }
        if (peerId == null || actorId.equals(peerId)) {
            throw new ForbiddenException("a distinct direct-call peer is required");
        }
        requireMember(conversationId, actorId);
        if (store.findConversationMember(conversationId, peerId) == null) {
            throw new ForbiddenException("call peer is not a member of the conversation");
        }
    }

    public Set<ConversationPermission> effectivePermissions(UUID conversationId, UUID userId) {
        CanonicalConversation conversation = store.findConversation(conversationId);
        if (conversation == null) {
            throw new NotFoundException("conversation not found");
        }
        CanonicalConversationMember member = requireMember(conversationId, userId);
        if (userId.equals(conversation.ownerId())) {
            return EnumSet.allOf(ConversationPermission.class);
        }
        if ("DM".equals(conversation.conversationType())) {
            return EnumSet.copyOf(DM_MEMBER_PERMISSIONS);
        }

        Set<UUID> roleIds = member.roleIds() == null ? Set.of() : member.roleIds();
        EnumSet<ConversationPermission> permissions = EnumSet.noneOf(ConversationPermission.class);
        conversationRepository.findRoles(conversationId).stream()
                .filter(role -> roleIds.contains(role.roleId()))
                .map(ConversationRole::permissions)
                .forEach(permissions::addAll);
        return permissions;
    }
}

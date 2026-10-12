package com.chatapp.chat_service.canonical.service;

import com.chatapp.chat_service.canonical.admin.AdminConversationDirectoryRepository;
import com.chatapp.chat_service.canonical.model.ConversationRole;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversation;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversationMember;
import com.chatapp.chat_service.canonical.repository.CanonicalConversationRepository;
import com.chatapp.chat_service.canonical.repository.CanonicalCqlStore;
import com.chatapp.chat_service.common.exception.NotFoundException;
import org.springframework.stereotype.Service;

import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ConversationMembershipService {
    private final CanonicalCqlStore store;
    private final CanonicalConversationRepository conversations;
    private final AdminConversationDirectoryRepository adminDirectory;
    private final ConversationEntryPolicy entryPolicy;

    public ConversationMembershipService(
            CanonicalCqlStore store,
            CanonicalConversationRepository conversations,
            AdminConversationDirectoryRepository adminDirectory,
            ConversationEntryPolicy entryPolicy) {
        this.store = store;
        this.conversations = conversations;
        this.adminDirectory = adminDirectory;
        this.entryPolicy = entryPolicy;
    }

    public CanonicalConversation requireConversation(UUID conversationId) {
        CanonicalConversation conversation = store.findConversation(conversationId);
        if (conversation == null) {
            throw new NotFoundException("conversation not found");
        }
        return conversation;
    }

    public Set<UUID> defaultRoleIds(UUID conversationId) {
        return conversations.findRoles(conversationId).stream()
                .filter(ConversationRole::isDefault)
                .map(ConversationRole::roleId)
                .collect(Collectors.toUnmodifiableSet());
    }

    public void repairProjections(CanonicalConversationMember member) {
        CanonicalConversation conversation = requireConversation(member.conversationId());
        store.addConversationMembershipProjection(member.userId(), conversation, member);
        adminDirectory.index(conversation);
        store.indexCommunityConversation(conversation);
    }

    public boolean isBanned(UUID conversationId, UUID userId) {
        return entryPolicy.isBanned(conversationId, userId);
    }

    public MembershipClaimResult claim(CanonicalConversationMember member) {
        if (isBanned(member.conversationId(), member.userId())) {
            return MembershipClaimResult.BANNED;
        }
        CanonicalCqlStore.MembershipMutationResult result = store.tryAddConversationMember(member);
        if (isBanned(member.conversationId(), member.userId())) {
            if (result != CanonicalCqlStore.MembershipMutationResult.CAPACITY_REACHED) {
                store.tryRemoveConversationMember(member.conversationId(), member.userId());
            }
            return MembershipClaimResult.BANNED;
        }
        return switch (result) {
            case ADDED -> MembershipClaimResult.ADDED;
            case ALREADY_MEMBER -> MembershipClaimResult.ALREADY_MEMBER;
            case CAPACITY_REACHED -> MembershipClaimResult.CAPACITY_REACHED;
            default -> throw new IllegalStateException("unsupported membership claim result: " + result);
        };
    }

    public enum MembershipClaimResult {
        ADDED,
        ALREADY_MEMBER,
        CAPACITY_REACHED,
        BANNED
    }
}

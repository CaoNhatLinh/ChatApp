package com.chatapp.chat_service.canonical.invite;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalInviteLink;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversation;

import java.time.Instant;

final class InvitePolicy {
    private InvitePolicy() {
    }

    static String status(CanonicalInviteLink invite, int usedCount) {
        if (!Boolean.TRUE.equals(invite.isActive())) {
            return invite.revokedAt() == null ? "INACTIVE" : "REVOKED";
        }
        if (invite.expiresAt() != null && !invite.expiresAt().isAfter(Instant.now())) {
            return "EXPIRED";
        }
        if (invite.maxUses() != null && usedCount >= invite.maxUses()) {
            return "LIMIT_REACHED";
        }
        return "ACTIVE";
    }

    static String status(CanonicalInviteLink invite, CanonicalConversation conversation, int usedCount) {
        if (conversation == null) {
            return "INVALID";
        }
        if (Boolean.TRUE.equals(conversation.isDeleted())) {
            return "INACTIVE";
        }
        return status(invite, usedCount);
    }
}

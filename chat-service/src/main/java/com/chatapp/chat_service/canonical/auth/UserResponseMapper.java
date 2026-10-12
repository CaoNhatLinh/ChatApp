package com.chatapp.chat_service.canonical.auth;

import com.chatapp.chat_service.canonical.dto.CanonicalApiContracts;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalUser;

public final class UserResponseMapper {

    private UserResponseMapper() {
    }

    public static CanonicalApiContracts.UserResponse toUserResponse(CanonicalUser user) {
        return new CanonicalApiContracts.UserResponse(
                user.userId(), user.username(), user.email(), user.displayName(), user.avatarUrl(),
                user.accountStatus(), user.createdAt(), user.lastLoginAt());
    }
}

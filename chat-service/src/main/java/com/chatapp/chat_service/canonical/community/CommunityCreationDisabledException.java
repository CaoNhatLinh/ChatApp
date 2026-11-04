package com.chatapp.chat_service.canonical.community;

import com.chatapp.chat_service.common.exception.ForbiddenException;

public final class CommunityCreationDisabledException extends ForbiddenException {
    public CommunityCreationDisabledException() {
        super("community creation is currently disabled");
    }
}

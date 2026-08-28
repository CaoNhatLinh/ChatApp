package com.chatapp.chat_service.canonical.model;

/** Permissions that can be assigned to a custom role inside one conversation. */
public enum ConversationPermission {
    MESSAGE_SEND,
    MESSAGE_EDIT_OWN,
    MESSAGE_DELETE_OWN,
    MESSAGE_DELETE_ANY,
    MESSAGE_PIN,
    POLL_CREATE,
    POLL_MANAGE,
    MEMBER_INVITE,
    MEMBER_KICK,
    MEMBER_BAN,
    MEMBER_MUTE,
    ROLE_CREATE,
    ROLE_UPDATE,
    ROLE_DELETE,
    ROLE_ASSIGN,
    ROOM_UPDATE,
    INVITE_MANAGE,
    CALL_START,
    CALL_MODERATE,
    ROOM_AUDIT_READ
}

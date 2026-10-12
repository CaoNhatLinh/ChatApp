/**
 * Canonical mention formatting and query parsing.
 *
 * Mention format from backend: @[DisplayName|UUID]
 * Special: @[all|all] for mentioning everyone
 */

/**
 * Insert a mention tag into content string at cursor position.
 * Returns the new content and the new cursor position.
 */
export const insertMention = (
    content: string,
    cursorPos: number,
    userId: string,
    displayName: string
): { newContent: string; newCursorPos: number } => {
    // Find the '@' trigger position before cursor
    const beforeCursor = content.slice(0, cursorPos);
    const atIndex = beforeCursor.lastIndexOf('@');

    if (atIndex === -1) {
        return { newContent: content, newCursorPos: cursorPos };
    }

    const mentionTag = `@[${displayName}|${userId}] `;
    const before = content.slice(0, atIndex);
    const after = content.slice(cursorPos);
    const newContent = before + mentionTag + after;
    const newCursorPos = before.length + mentionTag.length;

    return { newContent, newCursorPos };
};

/**
 * Extract the current mention query (text after '@') for autocomplete.
 * Returns null if user is not currently typing a mention.
 */
export const getMentionQuery = (content: string, cursorPos: number): string | null => {
    const beforeCursor = content.slice(0, cursorPos);
    const atIndex = beforeCursor.lastIndexOf('@');

    if (atIndex === -1) return null;

    // Ensure '@' is at the start of a word (preceded by space, newline, or start of string)
    if (atIndex > 0 && !/\s/.test(beforeCursor[atIndex - 1])) return null;

    const query = beforeCursor.slice(atIndex + 1);

    // If query contains newline, user has moved past the mention
    if (/[\n\r]/.test(query)) return null;

    return query;
};

const MENTION_TOKEN_REGEX = /@\[[^|\]]*\|([^|\]]+)\]/g;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Extracts only canonical user UUIDs from serialized mention tokens. The
 * special `all` token is returned separately so the API can handle it as an
 * explicit room-wide mention rather than pretending it is a user UUID.
 */
export const extractMentionTargets = (content: string): { userIds: string[]; mentionEveryone: boolean } => {
    const userIds = new Set<string>();
    let mentionEveryone = false;
    MENTION_TOKEN_REGEX.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = MENTION_TOKEN_REGEX.exec(content)) !== null) {
        const target = match[1].trim();
        if (target === 'all') {
            mentionEveryone = true;
        } else if (UUID_REGEX.test(target)) {
            userIds.add(target);
        }
    }
    return { userIds: [...userIds], mentionEveryone };
};

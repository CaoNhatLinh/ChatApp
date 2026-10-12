package com.chatapp.chat_service.canonical.appearance;

import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalChatPreferences;
import com.chatapp.chat_service.canonical.model.CqlCanonicalRecords.CanonicalConversationPreferences;
import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import com.datastax.oss.driver.api.core.cql.Row;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public class CassandraAppearanceRepository implements AppearanceRepository {
    private final CqlSession session;
    private final PreparedStatement findUserPreferences;
    private final PreparedStatement saveUserPreferences;
    private final PreparedStatement findConversationPreferences;
    private final PreparedStatement saveConversationPreferences;
    private final PreparedStatement deleteConversationPreferences;

    public CassandraAppearanceRepository(CqlSession session) {
        this.session = session;
        this.findUserPreferences = session.prepare(
                "SELECT * FROM user_chat_preferences WHERE user_id = ?");
        this.saveUserPreferences = session.prepare("""
                INSERT INTO user_chat_preferences
                    (user_id, default_theme_id, default_bubble_style_id, default_background_asset_id, updated_at)
                VALUES (?, ?, ?, ?, ?)
                """);
        this.findConversationPreferences = session.prepare("""
                SELECT * FROM conversation_preferences_by_user WHERE user_id = ? LIMIT ?
                """);
        this.saveConversationPreferences = session.prepare("""
                INSERT INTO conversation_preferences_by_user
                    (user_id, conversation_id, theme_id, bubble_style_id, background_asset_id,
                     custom_background_url, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """);
        this.deleteConversationPreferences = session.prepare("""
                DELETE FROM conversation_preferences_by_user
                WHERE user_id = ? AND conversation_id = ?
                """);
    }

    @Override
    public CanonicalChatPreferences findUserPreferences(UUID userId) {
        Row row = session.execute(findUserPreferences.bind(userId)).one();
        return row == null ? null : new CanonicalChatPreferences(
                row.getUuid("user_id"), row.getString("default_theme_id"),
                row.getString("default_bubble_style_id"), row.getString("default_background_asset_id"),
                row.getInstant("updated_at"));
    }

    @Override
    public void saveUserPreferences(CanonicalChatPreferences preferences) {
        session.execute(saveUserPreferences.bind(
                preferences.userId(), preferences.defaultThemeId(), preferences.defaultBubbleStyleId(),
                preferences.defaultBackgroundAssetId(), preferences.updatedAt()));
    }

    @Override
    public List<CanonicalConversationPreferences> findConversationPreferences(UUID userId, int limit) {
        return session.execute(findConversationPreferences.bind(userId, limit)).all().stream()
                .map(this::mapConversationPreferences).toList();
    }

    @Override
    public void saveConversationPreferences(CanonicalConversationPreferences preferences) {
        session.execute(saveConversationPreferences.bind(
                preferences.userId(), preferences.conversationId(), preferences.themeId(),
                preferences.bubbleStyleId(), preferences.backgroundAssetId(),
                preferences.customBackgroundUrl(), preferences.updatedAt()));
    }

    @Override
    public void deleteConversationPreferences(UUID userId, UUID conversationId) {
        session.execute(deleteConversationPreferences.bind(userId, conversationId));
    }

    private CanonicalConversationPreferences mapConversationPreferences(Row row) {
        return new CanonicalConversationPreferences(
                row.getUuid("user_id"), row.getUuid("conversation_id"), row.getString("theme_id"),
                row.getString("bubble_style_id"), row.getString("background_asset_id"),
                row.getString("custom_background_url"), row.getInstant("updated_at"));
    }
}

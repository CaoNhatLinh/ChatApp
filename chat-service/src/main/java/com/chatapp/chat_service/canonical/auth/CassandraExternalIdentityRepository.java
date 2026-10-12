package com.chatapp.chat_service.canonical.auth;

import com.datastax.oss.driver.api.core.CqlSession;
import com.datastax.oss.driver.api.core.cql.PreparedStatement;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.UUID;

@Repository
public class CassandraExternalIdentityRepository implements ExternalIdentityRepository {
    private final CqlSession session;
    private final String providerNamespace;
    private final PreparedStatement findUserId;
    private final PreparedStatement claimIdentity;
    private final PreparedStatement releaseIdentity;

    public CassandraExternalIdentityRepository(
            CqlSession session,
            @Value("${app.auth.firebase.project-id:}") String firebaseProjectId) {
        this.session = session;
        this.providerNamespace = "FIREBASE_GOOGLE:" + firebaseProjectId.trim();
        this.findUserId = session.prepare("""
                SELECT user_id FROM external_identity_owner_by_key
                WHERE auth_provider = ? AND external_subject = ?
                """);
        this.claimIdentity = session.prepare("""
                INSERT INTO external_identity_owner_by_key
                    (auth_provider, external_subject, user_id, created_at)
                VALUES (?, ?, ?, ?) IF NOT EXISTS
                """);
        this.releaseIdentity = session.prepare("""
                DELETE FROM external_identity_owner_by_key
                WHERE auth_provider = ? AND external_subject = ? IF user_id = ?
                """);
    }

    @Override
    public UUID findUserId(String subject) {
        var row = session.execute(findUserId.bind(providerNamespace, subject)).one();
        return row == null ? null : row.getUuid("user_id");
    }

    @Override
    public boolean claim(String subject, UUID userId, Instant createdAt) {
        var row = session.execute(claimIdentity.bind(providerNamespace, subject, userId, createdAt)).one();
        return row != null && (row.getBoolean("[applied]") || userId.equals(row.getUuid("user_id")));
    }

    @Override
    public boolean release(String subject, UUID userId) {
        return session.execute(releaseIdentity.bind(providerNamespace, subject, userId)).wasApplied();
    }
}

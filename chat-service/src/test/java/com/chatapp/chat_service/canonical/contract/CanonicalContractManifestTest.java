package com.chatapp.chat_service.canonical.contract;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.assertj.core.api.Assertions.assertThat;

class CanonicalContractManifestTest {

    private static final Path WORKSPACE = Path.of("..").toAbsolutePath().normalize();

    @Test
    void manifestAndFrontendUseTheCanonicalConversationRoutes() throws IOException {
        String manifest = Files.readString(WORKSPACE.resolve("docs/contracts/canonical-api.yaml"));
        String frontend = Files.readString(WORKSPACE.resolve(
                "chatapp_frontend/src/features/messenger/api/messenger.api.ts"));

        assertThat(manifest)
                .contains("POST /conversations/{conversationId}/pin")
                .contains("DELETE /conversations/{conversationId}/pin")
                .contains("GET /conversations/dm/{otherUserId}")
                .contains("GET /conversations/{conversationId}/members");
        assertThat(frontend)
                .contains("apiClient.post(`/conversations/${conversationId}/pin`)")
                .contains("apiClient.delete(`/conversations/${conversationId}/pin`)")
                .contains("`/conversations/dm/${otherUserId}`")
                .contains("replyToSenderId: filters.replyToSenderId")
                .doesNotContain("recipientUserId")
                .doesNotContain("/conversations/create")
                .doesNotContain("/conversations/my")
                .doesNotContain("/unpin`)");
    }

    @Test
    void protectedAuthEndpointsAreNotCoveredByThePublicWildcard() throws IOException {
        String security = Files.readString(WORKSPACE.resolve(
                "chat-service/src/main/java/com/chatapp/chat_service/security/config/SecurityConfig.java"));
        String filter = Files.readString(WORKSPACE.resolve(
                "chat-service/src/main/java/com/chatapp/chat_service/security/jwt/JwtAuthenticationFilter.java"));

        assertThat(security).doesNotContain("\"/api/auth/**\"");
        assertThat(filter).doesNotContain("\"/api/auth/\"");
    }

    @Test
    void publishedApiContractsExistAndDescribeTheRealtimeSurface() throws IOException {
        String openApi = Files.readString(WORKSPACE.resolve("docs/api/openapi.yaml"));
        String asyncApi = Files.readString(WORKSPACE.resolve("docs/api/asyncapi.yaml"));

        assertThat(openApi)
                .contains("openapi: 3.1.0")
                .contains("security:\n  - bearerAuth: []")
                .contains("/conversations/{conversationId}/messages")
                .contains("/notifications/unread/count")
                .contains("/admin/overview")
                .contains("/admin/audit")
                .contains("/admin/analytics")
                .contains("/admin/messages/{conversationId}/{messageId}")
                .contains("/reports")
                .contains("/reports/mine")
                .contains("/admin/reports/{reportId}")
                .contains("/admin/users/{userId}/sanctions/{sanctionId}")
                .contains("/admin/conversations/{conversationId}/chat-policy")
                .contains("/admin/users/{userId}/status")
                .contains("/admin/users/{userId}/sessions/{tokenId}")
                .contains("/admin/users/{userId}/devices/{deviceId}")
                .contains("AdminAnalyticsPoint")
                .contains("maximum: 2000, default: 200");
        assertThat(asyncApi)
                .contains("asyncapi: 3.0.0")
                .contains("/topic/conversation/{conversationId}/reactions")
                .contains("/app/call.start")
                .contains("/user/queue/presence-batch");
    }
}

package com.chatapp.chat_service.canonical.email;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;

final class NotificationEmailTemplate {
    private NotificationEmailTemplate() { }
    static String render(ObjectMapper json, ResendSettings settings, EmailDeliveryRepository.Key key, String email) {
        // Deliberately bilingual and generic: no private chat text, room names, HTML from users, or tracking pixels.
        String url = settings.appUrl + "/app";
        String text = "Bạn có thông báo mới trên Nối. Mở ứng dụng để xem.\n"
                + "You have a new notification on Nối. Open the app to view it.\n\n" + url
                + "\n\nBạn có thể tắt email trong Cài đặt → Thông báo.\n"
                + "You can turn off emails in Settings → Notifications.";
        try {
            return json.writeValueAsString(Map.of("from", settings.from, "to", List.of(email),
                    "subject", "Nối · Thông báo mới / New notification", "text", text,
                    "tags", List.of(Map.of("name", "noi_user", "value", key.userId().toString()),
                            Map.of("name", "noi_month", "value", key.month()),
                            Map.of("name", "noi_notification", "value", key.notificationId().toString()))));
        } catch (JsonProcessingException exception) { throw new IllegalStateException("Email template serialization failed"); }
    }
}

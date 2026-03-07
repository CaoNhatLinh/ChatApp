package com.chatapp.chat_service.presence.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

import java.time.Instant;
import java.util.UUID;



@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserPresenceResponse {
    private UUID userId;
    private String status;        
    private String lastActiveAgo; 
    private Instant lastSeen;     

    @JsonProperty("isOnline")
    private boolean isOnline;     


    public static String formatLastActive(Instant lastActive) {
        if (lastActive == null) {
            return "Không rõ";
        }

        long secondsAgo = Instant.now().getEpochSecond() - lastActive.getEpochSecond();

        if (secondsAgo < 60) {
            return "Vừa mới";
        } else if (secondsAgo < 3600) {
            long minutes = secondsAgo / 60;
            return minutes + " phút trước";
        } else if (secondsAgo < 86400) {
            long hours = secondsAgo / 3600;
            return hours + " giờ trước";
        } else {
            long days = secondsAgo / 86400;
            return days + " ngày trước";
        }
    }
}

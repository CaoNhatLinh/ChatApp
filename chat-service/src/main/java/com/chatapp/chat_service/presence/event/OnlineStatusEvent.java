package com.chatapp.chat_service.presence.event;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.time.Instant;
import java.util.UUID;

@NoArgsConstructor 
@AllArgsConstructor
@Data
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class OnlineStatusEvent {
    private UUID userId;
    
    @JsonProperty("online")
    private boolean online;
    
    /**
     * Custom status: ONLINE, DND (Do Not Disturb), INVISIBLE, OFFLINE.
     * Defaults to ONLINE when user comes online, OFFLINE when offline.
     */
    @Builder.Default
    private String status = "ONLINE";

    private String device;
    
    private Instant timestamp;
    
    public boolean isOnline() {
        return online;
    }
    
    public void setOnline(boolean online) {
        this.online = online;
    }
    
    @JsonProperty("isOnline")
    public void setIsOnline(boolean isOnline) {
        this.online = isOnline;
    }
}
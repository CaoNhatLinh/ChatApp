package com.chatapp.chat_service.presence.controller;

import com.chatapp.chat_service.presence.dto.UserPresenceResponse;
import com.chatapp.chat_service.presence.service.PresenceService;
import com.chatapp.chat_service.security.core.SecurityContextHelper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/presence")
@RequiredArgsConstructor
public class PresenceController {

    private final PresenceService presenceService;
    private final SecurityContextHelper securityContextHelper; 

    /**
     * API này được client gọi mỗi 30 GIÂY.
     * Nó chỉ gia hạn TTL trong Redis, cực kỳ nhanh.
     * @param sessionId ID của tab/thiết bị (frontend tự tạo)
     */
    @PostMapping("/heartbeat")
    public ResponseEntity<Void> heartbeat(@RequestParam String sessionId) {
        UUID userId = securityContextHelper.getCurrentUserId(); 
        presenceService.handleHeartbeat(userId, sessionId);
        return ResponseEntity.ok().build();
    }

    /**
     * Incremental subscribe — add users to watch list.
     * Called when client starts viewing a new list of users.
     */
    @PostMapping("/subscribe")
    public ResponseEntity<Void> addSubscriptions(@RequestBody List<UUID> targetUserIds) {
        UUID userId = securityContextHelper.getCurrentUserId();
        presenceService.addSubscriptions(userId, targetUserIds);
        return ResponseEntity.ok().build();
    }

    /**
     * Incremental unsubscribe — remove users from watch list.
     * Called when client stops viewing certain users.
     */
    @PostMapping("/unsubscribe")
    public ResponseEntity<Void> removeSubscriptions(@RequestBody List<UUID> targetUserIds) {
        UUID userId = securityContextHelper.getCurrentUserId();
        presenceService.removeSubscriptions(userId, targetUserIds);
        return ResponseEntity.ok().build();
    }
    
    /**
     * API lấy trạng thái của nhiều user cùng lúc
     * (Ví dụ: khi mở danh sách bạn bè hoặc conversation list)
     */
    @PostMapping("/batch-get")
    public ResponseEntity<Map<UUID, UserPresenceResponse>> getBatchPresence(@RequestBody List<UUID> userIds) {
        Map<UUID, UserPresenceResponse> presence = presenceService.getBatchPresence(userIds);
        return ResponseEntity.ok(presence);
    }
}
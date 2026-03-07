package com.chatapp.chat_service.common.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.cassandra.core.CassandraTemplate;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/health")
public class HealthController {

    @Autowired
    private CassandraTemplate cassandraTemplate;

    @Autowired
    private RedisTemplate<String, Object> redisTemplate;

    @GetMapping
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> health = new HashMap<>();
        health.put("status", "UP");
        health.put("timestamp", Instant.now());
        health.put("service", "chat-service");
        
        try {
            cassandraTemplate.getCqlOperations().queryForObject("SELECT release_version FROM system.local", String.class);
            health.put("cassandra", "UP");
        } catch (Exception e) {
            health.put("cassandra", "DOWN - " + e.getMessage());
        }
        
        try {
            redisTemplate.getConnectionFactory().getConnection().ping();
            health.put("redis", "UP");
        } catch (Exception e) {
            health.put("redis", "DOWN - " + e.getMessage());
        }
        
        return ResponseEntity.ok(health);
    }

    @GetMapping("/websocket")
    public ResponseEntity<Map<String, Object>> websocketInfo() {
        Map<String, Object> info = new HashMap<>();
        info.put("endpoint", "/ws");
        info.put("protocol", "STOMP over WebSocket");
        info.put("allowedOrigins", "http://localhost:*");
        info.put("destinations", Map.of(
            "subscribe", new String[]{"/topic/*", "/queue/*", "/user/queue/*"},
            "send", new String[]{"/app/*"}
        ));
        info.put("instructions", Map.of(
            "connect", "Connect to ws://localhost:8080/ws with SockJS",
            "authentication", "Send JWT token in 'Authorization' header or as query param '?token=YOUR_JWT'"
        ));
        return ResponseEntity.ok(info);
    }

    @GetMapping("/ping")
    public ResponseEntity<Map<String, String>> ping() {
        Map<String, String> response = new HashMap<>();
        response.put("message", "pong");
        response.put("timestamp", Instant.now().toString());
        return ResponseEntity.ok(response);
    }
}

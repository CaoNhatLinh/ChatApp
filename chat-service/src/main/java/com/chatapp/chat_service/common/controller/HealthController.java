package com.chatapp.chat_service.common.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.cassandra.core.CassandraTemplate;
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

    @GetMapping
    public ResponseEntity<Map<String, Object>> health() {
        Map<String, Object> health = new HashMap<>();
        health.put("status", "UP");
        health.put("timestamp", Instant.now());
        health.put("service", "chat-service");
        health.put("runtimeMode", "cassandra-native");

        try {
            cassandraTemplate.getCqlOperations().queryForObject("SELECT release_version FROM system.local", String.class);
            health.put("cassandra", "UP");
        } catch (Exception e) {
            health.put("cassandra", "DOWN - " + e.getMessage());
        }

        return ResponseEntity.ok(health);
    }

    @GetMapping("/ping")
    public ResponseEntity<Map<String, String>> ping() {
        Map<String, String> response = new HashMap<>();
        response.put("message", "pong");
        response.put("timestamp", Instant.now().toString());
        return ResponseEntity.ok(response);
    }
}


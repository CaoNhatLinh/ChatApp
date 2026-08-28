package com.chatapp.chat_service.common.controller;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class ApiDocumentationController {

    @GetMapping(value = "/", produces = MediaType.APPLICATION_JSON_VALUE)
    public Map<String, Object> getApiDocumentation() {
        return Map.of(
                "service", "NovaChat canonical backend",
                "runtime", "Spring Boot + Cassandra + Kafka + Redis + Elasticsearch + Cloudinary",
                "stack", "auth, conversations, messages, polls, invites, notifications, role management, media assets",
                "basePath", "/api",
                "note", "Cassandra is authoritative; Kafka transports durable events; Redis is ephemeral; Elasticsearch is a search projection; Cloudinary stores media objects."
        );
    }
}

package com.chatapp.chat_service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

@Component
@Slf4j
public class StartupLogger {

    @Value("${server.port}")
    private String port;

    @EventListener
    public void onReady(ApplicationReadyEvent event) {
        log.info("Chat service started on port {}", port);
        log.info("Runtime stack: Spring Boot, Cassandra, Kafka, Redis, Elasticsearch, Cloudinary and WebSocket");
    }
}

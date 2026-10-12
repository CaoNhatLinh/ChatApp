package com.chatapp.chat_service.realtime;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {
    private final StompAuthenticationInterceptor authenticationInterceptor;
    private final StompOutboundAuthorizationInterceptor outboundAuthorizationInterceptor;
    private final String[] allowedOriginPatterns;

    public WebSocketConfig(
            StompAuthenticationInterceptor authenticationInterceptor,
            StompOutboundAuthorizationInterceptor outboundAuthorizationInterceptor,
            @Value("${app.websocket.allowed-origin-patterns:http://localhost:5173}") String allowedOriginPatterns) {
        this.authenticationInterceptor = authenticationInterceptor;
        this.outboundAuthorizationInterceptor = outboundAuthorizationInterceptor;
        this.allowedOriginPatterns = allowedOriginPatterns.split(",");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns(allowedOriginPatterns)
                .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.setApplicationDestinationPrefixes("/app");
        registry.setUserDestinationPrefix("/user");
        registry.enableSimpleBroker("/topic", "/queue");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(authenticationInterceptor);
    }

    @Override
    public void configureClientOutboundChannel(ChannelRegistration registration) {
        registration.interceptors(outboundAuthorizationInterceptor);
    }
}

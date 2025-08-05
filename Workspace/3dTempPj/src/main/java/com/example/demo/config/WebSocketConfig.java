package com.example.demo.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker // STOMP 기반 웹소켓 메시지 브로커 활성화
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // "/topic"으로 시작하는 메시지는 브로커로 라우팅되어 클라이언트에게 브로드캐스팅됩니다.
        config.enableSimpleBroker("/topic");
        // "/app"으로 시작하는 메시지는 @MessageMapping 어노테이션이 붙은 컨트롤러 메서드로 라우팅됩니다.
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // 클라이언트가 WebSocket 연결을 맺을 엔드포인트 "/ws"를 등록합니다.
        // SockJS를 사용하여 WebSocket을 지원하지 않는 브라우저에서도 폴백할 수 있도록 합니다.
        registry.addEndpoint("/ws").setAllowedOriginPatterns("*").withSockJS();
    }
}
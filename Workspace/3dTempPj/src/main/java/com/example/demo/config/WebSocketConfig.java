package com.example.demo.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import java.util.Arrays;

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
        registry.addEndpoint("/ws").setAllowedOrigins("http://localhost:5173", "http://192.168.5.16:5173").withSockJS();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        // 허용할 출처(Origin) 목록
        configuration.setAllowedOrigins(Arrays.asList("http://localhost:5173", "https://7215d369b7d2.ngrok-free.app", "http://192.168.5.16:5173"));
        // 허용할 HTTP 메서드
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        // 허용할 헤더
        configuration.setAllowedHeaders(Arrays.asList("*"));
        // 자격 증명(쿠키, 인증 헤더 등) 허용
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        // 모든 경로("/**")에 대해 위의 CORS 설정을 적용
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
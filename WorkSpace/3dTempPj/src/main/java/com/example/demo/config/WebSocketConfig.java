package com.example.demo.config; // 실제 프로젝트 패키지명으로 변경해주세요.

import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final WebSocketHandler webSocketHandler; // WebSocketHandler를 주입받을 필드 선언

    public WebSocketConfig(WebSocketHandler webSocketHandler) {
        this.webSocketHandler = webSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // 주입받은 webSocketHandler 인스턴스를 사용합니다.
        registry.addHandler(webSocketHandler, "/websocket") // new WebSocketHandler() 대신 주입받은 인스턴스 사용
                .setAllowedOriginPatterns("*");
    }
}
package com.example.demo.listener;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import com.example.demo.service.PlayerService;

@Component
public class WebSocketEventListener {

    private static final Logger logger = LoggerFactory.getLogger(WebSocketEventListener.class);
    private final SimpMessagingTemplate messagingTemplate;
    private final PlayerService playerService;

    public WebSocketEventListener(SimpMessagingTemplate messagingTemplate, PlayerService playerService) {
        this.messagingTemplate = messagingTemplate;
        this.playerService = playerService;
    }

    /**
     * WebSocket 연결이 수립될 때 호출됩니다.
     * @param event 세션 연결 이벤트
     */
    @EventListener
    public void handleWebSocketConnectListener(SessionConnectedEvent event) {
        SimpMessageHeaderAccessor headerAccessor = SimpMessageHeaderAccessor.wrap(event.getMessage());
        // CONNECT 메시지 수신 시 세션 ID 로깅
        logger.info("New WebSocket connection. Session ID: {}", headerAccessor.getSessionId());
        // 참고: 이 시점에는 아직 클라이언트에서 플레이어 ID를 보낸 상태가 아님.
        // 플레이어 ID는 /app/registerPlayer 메시지에서 받아야 합니다.
    }

    /**
     * WebSocket 연결이 끊어질 때 호출됩니다. (클라이언트 탭 닫기, 새로고침, 네트워크 끊김 등)
     * @param event 세션 연결 해제 이벤트
     */
    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        SimpMessageHeaderAccessor headerAccessor = SimpMessageHeaderAccessor.wrap(event.getMessage());
        String sessionId = headerAccessor.getSessionId(); // 끊긴 세션의 ID

        if (sessionId != null) {
            // PlayerService를 통해 해당 세션 ID에 해당하는 플레이어를 제거합니다.
            playerService.removePlayerBySessionId(sessionId);
            logger.info("WebSocket disconnected. Session ID: {}. Remaining players: {}", sessionId, playerService.getAllPlayers().size());

            // 모든 클라이언트에게 업데이트된 플레이어 목록을 브로드캐스팅합니다.
            // 이를 통해 연결이 끊어진 플레이어가 다른 클라이언트 화면에서 사라지게 됩니다.
            messagingTemplate.convertAndSend("/topic/playerLocations", playerService.getAllPlayers());
        }
    }
}
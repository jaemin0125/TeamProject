package com.example.demo.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

import com.example.demo.dto.PlayerState;
import com.example.demo.service.PlayerService;

@Controller
public class GameController {

    private static final Logger logger = LoggerFactory.getLogger(GameController.class);
    private final SimpMessagingTemplate messagingTemplate;
    private final PlayerService playerService;

    public GameController(SimpMessagingTemplate messagingTemplate, PlayerService playerService) {
        this.messagingTemplate = messagingTemplate;
        this.playerService = playerService;
    }

    @GetMapping("/api/hello")
    public String hello() {
        logger.info("Hello from Spring Boot server (HTTP request)!");
        return "Hello from Spring Boot!";
    }

    @MessageMapping("/registerPlayer")
    public void registerPlayer(PlayerState playerState, SimpMessageHeaderAccessor headerAccessor) {
        String sessionId = headerAccessor.getSessionId();
        playerState.setSessionId(sessionId); // 세션 ID 설정

        playerService.addPlayer(playerState, sessionId); // 플레이어 추가/업데이트
        logger.info("Player registered: {} (Session: {})", playerState.getId(), sessionId);

        // 모든 플레이어에게 현재 플레이어 목록 브로드캐스팅
        logger.info("Broadcasting player locations after register. Total players: {}", playerService.getAllPlayers().size());
        messagingTemplate.convertAndSend("/topic/playerLocations", playerService.getAllPlayers());
    }

    /**
     * 클라이언트로부터 플레이어의 이동 상태 업데이트를 수신하고,
     * 이를 다른 모든 클라이언트에게 브로드캐스팅합니다.
     * 이 메서드는 클라이언트의 STOMP 메시지 Destination이 "/app/playerMove"일 때 호출됩니다.
     *
     * @param playerState 업데이트된 플레이어 상태 (ID, 위치, 회전 등 포함)
     * @param headerAccessor STOMP 메시지 헤더 접근자 (세션 ID 등 정보 추출 가능)
     */
    @MessageMapping("/playerMove")
    public void playerMove(PlayerState playerState, SimpMessageHeaderAccessor headerAccessor) {
        // 플레이어 서비스에 업데이트된 플레이어 상태를 반영합니다.
        // 세션 ID는 이미 PlayerState 객체에 포함되어 있거나,
        // 필요하다면 headerAccessor.getSessionId()를 통해 다시 설정할 수 있습니다.
        // 여기서는 클라이언트가 보낸 playerState의 id 필드를 기준으로 업데이트합니다.
        playerService.updatePlayerPosition(playerState.getId(), playerState.getPosition(), playerState.getRotationY());
        // logger.debug("Player moved: {} at ({}, {}, {})", playerState.getId(), playerState.getPosition().getX(), playerState.getPosition().getY(), playerState.getPosition().getZ()); // 너무 많은 로그가 발생할 수 있으므로 debug 레벨로 설정

        // 업데이트된 전체 플레이어 목록을 다시 모든 클라이언트에게 브로드캐스팅합니다.
        // 클라이언트들은 이 메시지를 받아서 각 플레이어 모델의 위치를 업데이트하게 됩니다.
        messagingTemplate.convertAndSend("/topic/playerLocations", playerService.getAllPlayers());
    }

    /**
     * 웹소켓 연결이 끊어졌을 때 호출되는 메서드.
     * 이 메서드는 WebSocketEventListener의 SessionDisconnectEvent에서 호출됩니다.
     *
     * @param sessionId 연결이 끊긴 세션의 ID
     */
    // 이 메서드는 직접 @MessageMapping으로 매핑되지 않고, WebSocketEventListener에 의해 호출될 것입니다.
    // 따라서 여기에 @MessageMapping 어노테이션은 필요 없습니다.
    public void unregisterPlayer(String sessionId) {
        playerService.removePlayerBySessionId(sessionId);
        logger.info("Player unregistered (session disconnected): Session: {}. Remaining players: {}", sessionId, playerService.getAllPlayers().size());
        // 플레이어 제거 후, 업데이트된 플레이어 목록을 브로드캐스팅
        messagingTemplate.convertAndSend("/topic/playerLocations", playerService.getAllPlayers());
    }
}
package com.example.demo.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

import com.example.demo.dto.PlayerHitMessage;
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
		return "Hello from Spring Boot!";
	}

	@MessageMapping("/registerPlayer")
	public void registerPlayer(PlayerState playerState, SimpMessageHeaderAccessor headerAccessor) {
		String sessionId = headerAccessor.getSessionId();
		playerState.setSessionId(sessionId); // 세션 ID 설정

		// 🚨 이 부분이 콘솔에 로그를 출력합니다.
		logger.info("[GameController] Player registration request: ID={}, Nickname='{}', Session={}",
				playerState.getId(), playerState.getNickname(), sessionId);

		playerService.addPlayer(playerState, sessionId); // 플레이어 추가/업데이트

		// 이 부분도 콘솔에 로그를 출력합니다.
		logger.info("[GameController] Broadcasting player locations after register. Total players: {}",
				playerService.getAllPlayers().size());
		messagingTemplate.convertAndSend("/topic/playerLocations", playerService.getAllPlayers());
	}

	@MessageMapping("/playerMove")
	public void playerMove(PlayerState playerState, SimpMessageHeaderAccessor headerAccessor) {
        // 🚨 이 부분이 콘솔에 로그를 출력합니다.
		logger.info("[GameController] Player move request: ID={}, Nickname='{}', Position={}, RotationY={}, Animation={}",
				playerState.getId(), playerState.getNickname(), playerState.getPosition(),
				playerState.getRotationY(), playerState.getAnimationState());

		playerService.updatePlayerState(playerState); // 변경된 메서드 시그니처

		// 이 부분도 콘솔에 로그를 출력합니다.
		logger.info("[GameController] Broadcasting player locations after move. Total players: {}",
				playerService.getAllPlayers().size());
		messagingTemplate.convertAndSend("/topic/playerLocations", playerService.getAllPlayers());
	}

//	@MessageMapping("/sceneObjects") // 이 부분은 주석 처리되어 있을 것입니다.
//	public void updateObjectState(List<ObjectState> objectStates) {
//	    // 모든 클라이언트에게 브로드캐스트
//	    messagingTemplate.convertAndSend("/topic/sceneObjects", objectStates);
//	}

	public void unregisterPlayer(String sessionId) {
		String playerId = playerService.getPlayerIdBySessionId(sessionId); // 세션 ID로 플레이어 ID 가져오기
		playerService.removePlayerBySessionId(sessionId);
        // 이 부분도 콘솔에 로그를 출력합니다.
		logger.info("[GameController] Player unregistered (session disconnected): Session={}, Player ID={}. Remaining players: {}",
				sessionId, playerId != null ? playerId : "N/A", playerService.getAllPlayers().size());
		messagingTemplate.convertAndSend("/topic/playerLocations", playerService.getAllPlayers());
	}
	
	@MessageMapping("/playerHit")
	public void handlePlayerHit(PlayerHitMessage message) {
	    
	    // 브로드캐스트: 모든 클라이언트가 피격 알 수 있도록
	    messagingTemplate.convertAndSend("/topic/playerHit", message);
	}
}
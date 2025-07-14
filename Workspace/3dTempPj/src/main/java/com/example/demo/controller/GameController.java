package com.example.demo.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

import com.example.demo.dto.ChatMessage;
import com.example.demo.dto.ItemActionRequest;
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
		//logger.info("Hello from Spring Boot server (HTTP request)!");
		return "Hello from Spring Boot!";
	}

	@MessageMapping("/registerPlayer")
	public void registerPlayer(PlayerState playerState, SimpMessageHeaderAccessor headerAccessor) {
		String sessionId = headerAccessor.getSessionId();
		logger.info("Register player request received: Player ID={}, Nickname={}, Session ID={}",
				playerState.getId(), playerState.getNickname(), sessionId);

		// ✨ 변경: addPlayer 대신 registerPlayer 사용
		playerService.registerPlayer(playerState, sessionId);

		// 모든 클라이언트에게 업데이트된 플레이어 목록 브로드캐스트
		messagingTemplate.convertAndSend("/topic/playerLocations", playerService.getAllPlayers());
		// 모든 클라이언트에게 현재 씬 오브젝트 목록 브로드캐스트 (새로운 플레이어가 접속했으므로)
        messagingTemplate.convertAndSend("/topic/sceneObjects", playerService.getAllSceneObjects());
	}

	@MessageMapping("/updatePlayerState")
	public void updatePlayerState(PlayerState playerState) {
		// logger.debug("Player state update received for ID: {}", playerState.getId());
        
        // ✨ 변경: updatePlayerState 메소드의 모든 인자 전달
		playerService.updatePlayerState(
				playerState.getId(),
				playerState.getPosition(),
				playerState.getRotationY(),
				playerState.getAnimationState()
		);

		// 모든 클라이언트에게 업데이트된 플레이어 목록 브로드캐스트 (실시간 동기화)
		messagingTemplate.convertAndSend("/topic/playerLocations", playerService.getAllPlayers());
	}
	
    @MessageMapping("/playerHit")
    public void handlePlayerHit(PlayerHitMessage message) {
        logger.info("Player hit message received: From={}, Target={}", message.getFromId(), message.getTargetId());
        logger.info("Player hit message received: From={}, Target={}", message.getFromPosition(), message.getTargetPosition());

        PlayerState targetPlayer = playerService.getPlayer(message.getTargetId());
        if (targetPlayer != null) {
            // 체력을 10 감소시킵니다.
            int newHealth = targetPlayer.getHealth() - 10;
            playerService.setPlayerHealth(targetPlayer.getId(), newHealth);
            logger.info("Player {} hit. Health reduced to {}.", targetPlayer.getNickname(), newHealth);

            // 체력이 0 이하가 되면 사망 처리
            if (newHealth <= 0) {
                playerService.setPlayerDead(targetPlayer.getId());
                logger.info("Player {} is dead.", targetPlayer.getNickname());
                // 사망 시 추가적인 로직 (예: 리스폰 타이머 시작, 애니메이션 변경 등)
            }

            // 모든 클라이언트에게 업데이트된 플레이어 상태 브로드캐스트
            messagingTemplate.convertAndSend("/topic/playerHit", message);
        }
    }

    // ✨ 새로 추가: 아이템 줍기 요청 처리
    @MessageMapping("/pickUpItem")
    public void pickUpItem(ItemActionRequest request) {
        logger.info("Pick up item request received: PlayerId={}, ItemId={}, ActionType={}", 
            request.getPlayerId(), request.getItemId(), request.getActionType());

        // PlayerService를 통해 씬에서 아이템 제거 및 인벤토리에 추가
        if (playerService.pickUpItemFromScene(request.getPlayerId(), request.getItemId())) {
            logger.info("Player {} picked up item {}.", request.getPlayerId(), request.getItemId());
            // 씬 오브젝트 및 플레이어 인벤토리 업데이트 브로드캐스트
            messagingTemplate.convertAndSend("/topic/sceneObjects", playerService.getAllSceneObjects());
            messagingTemplate.convertAndSend("/topic/playerLocations", playerService.getAllPlayers());
        } else {
            logger.warn("Pick up item failed: PlayerId={} or ItemId={} not found.", request.getPlayerId(), request.getItemId());
        }
    }

    // ✨ 새로 추가: 아이템 사용 요청 처리
    @MessageMapping("/useItem")
    public void useItem(ItemActionRequest request) {
        logger.info("Use item request received: playerId={}, ItemId={}, ActionType={}",
        		
            request.getPlayerId(), request.getItemId(), request.getActionType());
        	
        // PlayerService를 통해 인벤토리에서 아이템 사용
        if (playerService.useItemFromPlayerInventory(request.getPlayerId(), request.getItemId(), 1)) { // 1개 사용
            logger.info("Player {} used item {}.", request.getPlayerId(), request.getItemId());
            // 아이템 사용으로 인한 플레이어 상태(체력, 인벤토리) 업데이트 브로드캐스트
            messagingTemplate.convertAndSend("/topic/playerLocations", playerService.getAllPlayers());
        } else {
            logger.warn("Use item failed: PlayerId={} or ItemId={}.", request.getPlayerId(), request.getItemId());
        }
    }
    
    @MessageMapping("/chat.send")
    public void sendChatMessage(ChatMessage chatMessage) {
        messagingTemplate.convertAndSend("/topic/chat/" + chatMessage.getRoomId(), chatMessage);
    }


	/**
	 * 웹소켓 연결이 끊어졌을 때 호출되는 메서드. 이 메서드는 WebSocketEventListener의
	 * SessionDisconnectEvent에서 호출됩니다.
	 *
	 * @param sessionId 연결이 끊긴 세션의 ID
	 */
	public void unregisterPlayer(String sessionId) {
		playerService.removePlayerBySessionId(sessionId);
		// 모든 클라이언트에게 업데이트된 플레이어 목록을 브로드캐스트합니다.
		messagingTemplate.convertAndSend("/topic/playerLocations", playerService.getAllPlayers());
	}
	
	
}
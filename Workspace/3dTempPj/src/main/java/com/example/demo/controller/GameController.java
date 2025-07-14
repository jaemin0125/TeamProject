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
        logger.info("Player hit message received: From={}, Target={}, WeaponName={}", message.getFromId(), message.getTargetId(), message.getWeaponName());

        PlayerState attacker = playerService.getPlayer(message.getFromId());
        PlayerState targetPlayer = playerService.getPlayer(message.getTargetId());

        // 1. 공격자와 피격자 정보가 서버에 모두 존재하는지, 스스로를 공격한건 아닌지 확인
        if (attacker == null || targetPlayer == null || message.getFromId().equals(message.getTargetId())) {
            logger.warn("Hit validation failed: Attacker or Target not found, or self-hit.");
            return;
        }

        // 2. 서버에 저장된 실제 플레이어 위치를 가져옴 (클라이언트가 보낸 위치를 신뢰하지 않음)
        PlayerState.Position attackerPos = attacker.getPosition();
        PlayerState.Position targetPos = targetPlayer.getPosition();

        // 3. 무기 정보 설정 (데미지, 사거리)
        int damage = 0;
        double maxRange = 0.0;
        // 프론트에서 무기 이름이 null로 오는 경우를 대비해 기본값을 "punch"로 설정
        String weaponName = message.getWeaponName() != null ? message.getWeaponName() : "punch";

        switch (weaponName) {
            case "ak-47":
                damage = 25;
                maxRange = 100.0; // AK-47의 유효 사거리 100
                break;
            case "punch":
            default:
                damage = 10;
                maxRange = 2.5; // 주먹의 유효 사거리 2.5
                break;
        }

        // 4. 서버에서 직접 거리 계산
        double distance = Math.sqrt(
            Math.pow(attackerPos.getX() - targetPos.getX(), 2) +
            Math.pow(attackerPos.getY() - targetPos.getY(), 2) +
            Math.pow(attackerPos.getZ() - targetPos.getZ(), 2)
        );

        // 5. 유효 사거리 검증
        if (distance > maxRange) {
            logger.warn("Hit validation failed: Attack from {} to {} with {} is out of range. Distance: {}, Max Range: {}",
                attacker.getNickname(), targetPlayer.getNickname(), weaponName, String.format("%.2f", distance), maxRange);
            return; // 거리가 너무 멀면 공격 무효 처리
        }

        // 6. 검증 통과 시, 데미지 처리
        logger.info("Hit validated! Attacker: {}, Target: {}, Weapon: {}, Distance: {}",
            attacker.getNickname(), targetPlayer.getNickname(), weaponName, String.format("%.2f", distance));

        int newHealth = targetPlayer.getHealth() - damage;
        playerService.setPlayerHealth(targetPlayer.getId(), newHealth);
        logger.info("Player {} hit. Health reduced to {}.", targetPlayer.getNickname(), newHealth);

        // 체력이 0 이하가 되면 사망 처리
        if (newHealth <= 0) {
            playerService.setPlayerDead(targetPlayer.getId());
            logger.info("Player {} is dead.", targetPlayer.getNickname());
        }

        // 모든 클라이언트에게 유효한 공격이었음을 브로드캐스트
        messagingTemplate.convertAndSend("/topic/playerHit", message);
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
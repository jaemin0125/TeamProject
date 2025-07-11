// src/main/java/com/example/demo/service/PlayerService.java
package com.example.demo.service;

import java.util.Collection;
import java.util.Map;
import java.util.Optional;
import java.util.Random;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import com.example.demo.dto.AnimationState;
import com.example.demo.dto.Item;
import com.example.demo.dto.ObjectState;
import com.example.demo.dto.PlayerState;
import com.example.demo.dto.PlayerState.Position;

@Service
public class PlayerService {

    private static final Logger logger = LoggerFactory.getLogger(PlayerService.class);

    // --- 아이템 생성 제한 설정 ---
    private static final int MAX_APPLES = 15; // 맵에 존재할 수 있는 사과의 최대 개수
    private static final int MAX_GUNS = 3;   // 맵에 존재할 수 있는 총의 최대 개수
    // --------------------------

    private final Map<String, PlayerState> connectedPlayers = new ConcurrentHashMap<>();
    private final Map<String, String> sessionToPlayerIdMap = new ConcurrentHashMap<>();
    private final Map<String, ObjectState> sceneObjects = new ConcurrentHashMap<>();
    private final SimpMessagingTemplate messagingTemplate;
    private final Random random = new Random();

    public PlayerService(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * 30초마다 사과 생성을 시도하고, 변경 사항이 있을 경우 모든 클라이언트에게 씬 업데이트를 브로드캐스트합니다.
     */
    @Scheduled(fixedRate = 30000) // 30초마다 실행
    public void spawnApplePeriodically() {
        long currentAppleCount = sceneObjects.values().stream()
                .filter(obj -> "apple".equals(obj.getItemType()))
                .count();

        if (currentAppleCount < MAX_APPLES) {
            spawnNewItem("apple", "/models/apple.glb", "apple", -4.5); // y좌표 -4.5
            logger.info("Spawning new apple. Current apples: {}/{}", currentAppleCount + 1, MAX_APPLES);
            messagingTemplate.convertAndSend("/topic/sceneObjects", getAllSceneObjects());
        }
    }

    /**
     * 60초마다 총 생성을 시도하고, 변경 사항이 있을 경우 모든 클라이언트에게 씬 업데이트를 브로드캐스트합니다.
     */
    @Scheduled(fixedRate = 60000) // 60초마다 실행
    public void spawnGunPeriodically() {
        long currentGunCount = sceneObjects.values().stream()
                .filter(obj -> "ak-47".equals(obj.getItemType()))
                .count();

        if (currentGunCount < MAX_GUNS) {
            spawnNewItem("ak-47", "/models/ak-47.glb", "ak-47", -4.4); // y좌표 -4.4
            logger.info("Spawning new gun. Current guns: {}/{}", currentGunCount + 1, MAX_GUNS);
            messagingTemplate.convertAndSend("/topic/sceneObjects", getAllSceneObjects());
        }
    }

    /**
     * 지정된 타입의 아이템을 랜덤 위치에 생성하고 씬에 추가합니다.
     * @param itemType 아이템 타입 (예: "apple", "ak-47")
     * @param modelPath 모델 파일 경로
     * @param objectType 오브젝트 타입
     * @param yPos 생성될 높이 (y 좌표)
     */
    private void spawnNewItem(String itemType, String modelPath, String objectType, double yPos) {
        // 맵의 특정 영역 내에서 랜덤 위치 생성
        double x = -15 + (30 * random.nextDouble()); // -15 to 15
        double z = -15 + (30 * random.nextDouble()); // -15 to 15
        Position randomPosition = new Position(x, yPos, z);

        // 새로운 아이템 객체 생성
        String itemId = itemType + "-" + UUID.randomUUID().toString();
        ObjectState newItem = new ObjectState(itemId, randomPosition, objectType, modelPath, itemType);

        // 씬에 아이템 추가
        sceneObjects.put(newItem.getId(), newItem);
        logger.debug("Spawning new {} at: {}", itemType, randomPosition);
    }


    // =================================================================
    // 아래는 기존 PlayerService의 다른 메서드들 (변경 없음)
    // =================================================================

    /**
     * Registers a new player or updates an existing player's state.
     * @param playerState The state of the player to register/update.
     * @param sessionId The WebSocket session ID associated with the player.
     */
    public void registerPlayer(PlayerState playerState, String sessionId) {
        playerState.setSessionId(sessionId); // Set the session ID
        connectedPlayers.put(playerState.getId(), playerState);
        sessionToPlayerIdMap.put(sessionId, playerState.getId());
        logger.info("Player registered/updated: ID={}, Nickname={}, SessionID={}",
                playerState.getId(), playerState.getNickname(), sessionId);
        logger.debug("Current connected players: {}", connectedPlayers.keySet());
    }

    /**
     * Updates a player's position and rotation.
     * @param playerId The ID of the player to update.
     * @param newPosition The new position of the player.
     * @param newRotationY The new Y-axis rotation of the player.
     * @param newAnimationState The new animation state of the player.
     */
    public void updatePlayerState(String playerId, Position newPosition, double newRotationY, AnimationState newAnimationState) {
        PlayerState player = connectedPlayers.get(playerId);
        if (player != null) {
            player.setPosition(newPosition);
            player.setRotationY(newRotationY);
            player.setAnimationState(newAnimationState);
            // logger.debug("Player {} updated position to ({}, {}, {})", playerId, newPosition.getX(), newPosition.getY(), newPosition.getZ());
        } else {
            logger.warn("Player with ID {} not found for update.", playerId);
        }
    }

    /**
     * Retrieves a player's state by their ID.
     * @param playerId The ID of the player to retrieve.
     * @return The PlayerState object, or null if not found.
     */
    public PlayerState getPlayer(String playerId) {
        return connectedPlayers.get(playerId);
    }

    /**
     * Retrieves a player's state by their session ID.
     * @param sessionId The session ID of the player to retrieve.
     * @return The PlayerState object, or null if not found.
     */
    public PlayerState getPlayerBySessionId(String sessionId) {
        String playerId = sessionToPlayerIdMap.get(sessionId);
        if (playerId != null) {
            return connectedPlayers.get(playerId);
        }
        return null;
    }

    /**
     * Removes a player from the game based on their session ID.
     * @param sessionId The session ID of the player to remove.
     */
    public void removePlayerBySessionId(String sessionId) {
        String playerId = sessionToPlayerIdMap.remove(sessionId); // Remove from session-to-player map
        if (playerId != null) {
            connectedPlayers.remove(playerId); // Remove from connected players map
            logger.info("Player disconnected: Session ID={}, Player ID={}", sessionId, playerId);
        } else {
            logger.warn("Attempted to remove player with unknown session ID: {}", sessionId);
        }
    }

    /**
     * Returns a collection of all currently connected players.
     * @return A Collection of PlayerState objects.
     */
    public Collection<PlayerState> getAllPlayers() {
        return connectedPlayers.values();
    }


    /**
     * Retrieves all scene objects.
     * @return A Collection of ObjectState objects.
     */
    public Collection<ObjectState> getAllSceneObjects() {
        return sceneObjects.values();
    }

    /**
     * Removes a scene object by its ID.
     * @param objectId The ID of the object to remove.
     * @return true if the object was removed, false otherwise.
     */
    public boolean removeSceneObject(String objectId) {
        ObjectState removed = sceneObjects.remove(objectId);
        if (removed != null) {
            logger.info("Scene object removed: ID={}", objectId);
            return true;
        }
        logger.warn("Attempted to remove non-existent scene object: ID={}", objectId);
        return false;
    }

    /**
     * ✨ NEW METHOD: 플레이어가 씬에서 아이템을 줍습니다.
     * @param playerId 아이템을 주울 플레이어의 ID
     * @param objectId 씬에서 주울 오브젝트의 ID
     * @return 아이템 줍기 성공 여부
     */
    public boolean pickUpItemFromScene(String playerId, String objectId) {
        PlayerState player = connectedPlayers.get(playerId);
        if (player == null) {
            logger.warn("Player {} not found. Cannot pick up item {}.", playerId, objectId);
            return false;
        }

        ObjectState sceneObject = sceneObjects.get(objectId);
        if (sceneObject == null) {
            logger.warn("Scene object {} not found. Cannot pick up item.", objectId);
            return false;
        }

        // 아이템 타입이 "APPLE"인 경우에만 줍도록 처리
        if (sceneObject.getItemType() != null) {
            // 씬에서 오브젝트 제거
            sceneObjects.remove(objectId);
            logger.info("Scene object {} (type: {}) removed from scene by player {}.", objectId, sceneObject.getItemType(), playerId);

            // 주운 아이템 정보를 기반으로 InventoryItem 생성
            Item pickedItem = new Item(
                objectId, // 새 아이템 고유 ID
                "사과", // 아이템 이름
                "food", // 아이템 타입 (음식)
                1, // 개수 1개
                "/assets/apple.png", // 이미지 경로
                10 // 체력 회복량
            );

            // 플레이어 인벤토리에 아이템 추가
            boolean success = addItemToPlayerInventory(playerId, pickedItem);
            if (success) {
                logger.info("Player {} picked up item {} (type: {}).", playerId, pickedItem.getName(), pickedItem.getType());
            } else {
                logger.error("Failed to add item {} to player {}'s inventory.", pickedItem.getName(), playerId);
            }
            return success;
        } else {
            logger.warn("Scene object {} is not a pickable item (type: {}).", objectId, sceneObject.getItemType());
            return false;
        }
    }


    /**
     * 플레이어에게 아이템을 추가합니다. 이미 가진 아이템이라면 개수를 늘리고, 새로운 아이템이라면 추가합니다.
     * @param playerId 아이템을 받을 플레이어의 ID
     * @param itemToAdd 추가할 아이템 DTO (Item)
     * @return 아이템 추가 성공 여부
     */
    public boolean addItemToPlayerInventory(String playerId, Item itemToAdd) {
        PlayerState player = connectedPlayers.get(playerId);
        if (player == null) {
            logger.warn("Player {} not found. Cannot add item {}.", playerId, itemToAdd.getName());
            return false;
        }

        Optional<Item> existingItemOpt = player.getInventory().stream()
            .filter(i -> i.getId().equals(itemToAdd.getId()))
            .findFirst();

        if (existingItemOpt.isPresent()) {
            Item existingItem = existingItemOpt.get();
            existingItem.setCount(existingItem.getCount() + itemToAdd.getCount());
            logger.info("Player {} already has item {}. Increased count to {}.", playerId, existingItem.getName(), existingItem.getCount());
        } else {
            // 새로운 Item 객체를 인벤토리에 추가 (count가 설정된 상태로)
            player.getInventory().add(itemToAdd);
            logger.info("Player {} added new item {} (count: {}).", playerId, itemToAdd.getName(), itemToAdd.getCount());
        }
        return true;
    }

    /**
     * 플레이어 인벤토리에서 아이템을 사용하고, 개수를 줄입니다.
     * @param playerId 아이템을 사용할 플레이어의 ID
     * @param itemId 사용할 아이템의 ID (인벤토리 아이템 ID)
     * @param quantityToUse 사용할 개수
     * @return 아이템 사용 성공 여부
     */
    public boolean useItemFromPlayerInventory(String playerId, String itemId, int quantityToUse) {
        PlayerState player = connectedPlayers.get(playerId);
        if (player == null) {
            logger.warn("Player {} not found. Cannot use item {}.", playerId, itemId);
            return false;
        }

        Optional<Item> itemToUseOpt = player.getInventory().stream()
            .filter(i -> i.getId().equals(itemId))
            .findFirst();
        
        
        if (itemToUseOpt.isEmpty()) {
            logger.warn("Player {} does not have item {} in inventory.", playerId, itemId);
            return false;
        }

        Item itemToUse = itemToUseOpt.get();
        if (itemToUse.getCount() < quantityToUse) {
            logger.warn("Player {} only has {} of item {} but tried to use {}.", playerId, itemToUse.getCount(), itemId, quantityToUse);
            return false;
        }

        itemToUse.setCount(itemToUse.getCount() - quantityToUse);
        logger.info("Player {} used {} of item {}. Remaining count: {}.", playerId, quantityToUse, itemToUse.getName(), itemToUse.getCount());

        // 아이템이 소모성이고 체력 회복량이 있다면 체력 회복
        if ("consumable".equalsIgnoreCase(itemToUse.getType()) || "food".equalsIgnoreCase(itemToUse.getType())) {
            int currentHealth = player.getHealth();
            int healthToRestore = (int) itemToUse.getHealthRestore();
            int newHealth = Math.min(100, currentHealth + healthToRestore); // 최대 체력 100 제한
            player.setHealth(newHealth);
            logger.info("Player {} used {}. Health restored from {} to {}.", playerId, itemToUse.getName(), currentHealth, newHealth);
        }
        
        // 아이템 개수가 0이 되면 인벤토리에서 제거
        if (itemToUse.getCount() <= 0) {
            player.getInventory().remove(itemToUse);
            logger.info("Player {} consumed last {} from inventory.", playerId, itemToUse.getName());
        }

        return true;
    }

    /**
     * 플레이어의 체력을 직접 설정합니다.
     * @param playerId 체력을 설정할 플레이어의 ID
     * @param newHealth 설정할 새로운 체력 값
     * @return 체력 설정 성공 여부
     */
    public boolean setPlayerHealth(String playerId, int newHealth) {
        PlayerState player = connectedPlayers.get(playerId);
        if (player != null) {
            player.setHealth(Math.max(0, Math.min(100, newHealth)));
            logger.info("Player {} health set to {}.", playerId, player.getHealth());
            return true;
        }
        logger.warn("Player {} not found. Cannot set health.", playerId);
        return false;
    }

    /**
     * 플레이어를 사망 상태로 설정하고 리스폰 타이머를 시작합니다.
     * @param playerId 사망 처리할 플레이어의 ID
     */
    public void setPlayerDead(String playerId) {
        PlayerState player = connectedPlayers.get(playerId);
        if (player != null) {
            player.setHealth(0); // 체력을 0으로 설정
            player.getAnimationState().setIsDead(true); // 사망 애니메이션 상태 활성화
            logger.info("Player {} is now dead.", playerId);
            // 리스폰 로직 (예: 별도의 스케줄러에서 N초 후 리스폰)은 GameController 또는 다른 매니저에서 처리
        }
    }

    /**
     * 플레이어를 리스폰 시킵니다.
     * @param playerId 리스폰 시킬 플레이어의 ID
     */
    public void respawnPlayer(String playerId) {
        PlayerState player = connectedPlayers.get(playerId);
        if (player != null) {
            player.setHealth(100); // 체력 회복
            player.setPosition(new Position(0, 5, 0)); // 기본 리스폰 위치로 이동
            player.getAnimationState().setIsDead(false); // 사망 애니메이션 상태 비활성화
            player.getAnimationState().setIsIdle(true); // Idle 상태로 전환
            logger.info("Player {} has respawned.", playerId);
        }
    }
}
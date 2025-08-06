// src/main/java/com/example/demo/service/PlayerService.java
package com.example.demo.service;

import java.util.Collection;
import java.util.Collections;
import java.util.List;
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

import com.example.demo.dto.Ammo;
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
    private static final int MAX_PIPES = 5;


    private final Map<String, PlayerState> connectedPlayers = new ConcurrentHashMap<>();
    private final Map<String, String> sessionToPlayerIdMap = new ConcurrentHashMap<>();
    private final Map<String, ObjectState> sceneObjects = new ConcurrentHashMap<>();
    private final SimpMessagingTemplate messagingTemplate;
    private final Random random = new Random();
    private final Map<String, Integer> appleReceiveMap = new ConcurrentHashMap<>(); // 아이템 횟수 제한
    
    public PlayerService(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * 30초마다 사과 생성을 시도하고, 변경 사항이 있을 경우 모든 클라이언트에게 씬 업데이트를 브로드캐스트합니다.
     */
    @Scheduled(fixedRate = 1000) // 5초마다 실행
    public void spawnApplePeriodically() {
        long currentAppleCount = sceneObjects.values().stream()
                .filter(obj -> "apple".equals(obj.getItemType()))
                .count();

        if (currentAppleCount < MAX_APPLES) {
            spawnNewItem("apple", "/objects/apple.glb", "apple", 0.4, true); // y좌표 -4.5, stackable: true
            logger.info("Spawning new apple. Current apples: {}/{}", currentAppleCount + 1, MAX_APPLES);
            messagingTemplate.convertAndSend("/topic/sceneObjects", getAllSceneObjects());
        }
    }

    /**
     * 30초마다 총 생성을 시도하고, 변경 사항이 있을 경우 모든 클라이언트에게 씬 업데이트를 브로드캐스트합니다.
     */
    @Scheduled(fixedRate = 1000) // 30초마다 실행
    public void spawnGunPeriodically() {
        long currentGunCount = sceneObjects.values().stream()
                .filter(obj -> "ak-47".equals(obj.getItemType()))
                .count();

        if (currentGunCount < MAX_GUNS) {
            spawnNewItem("ak-47", "/objects/ak-47.glb", "ak-47", 0.8, false); // y좌표 -4.4, stackable: false
            logger.info("Spawning new gun. Current guns: {}/{}", currentGunCount + 1, MAX_GUNS);
            messagingTemplate.convertAndSend("/topic/sceneObjects", getAllSceneObjects());
        }
    }
    
    /**
     * 20초마다 파이프 생성을 시도하고, 변경 사항이 있을 경우 모든 클라이언트에게 씬 업데이트를 브로드캐스트합니다.
     */
    @Scheduled(fixedRate = 1000) // 20초마다 실행
    public void spawnPipePeriodically() {
        long currentPipeCount = sceneObjects.values().stream()
                .filter(obj -> "pipe".equals(obj.getItemType()))
                .count();

        if (currentPipeCount < MAX_PIPES) {
            spawnNewItem("pipe", "/objects/pipe.glb", "pipe", 0.54, false); // y좌표 -4.4, stackable: false
            logger.info("Spawning new pipe. Current pipes: {}/{}", currentPipeCount + 1, MAX_PIPES);
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
    private void spawnNewItem(String itemType, String modelPath, String objectType, double yPos, boolean stackable) {
        // 맵의 특정 영역 내에서 랜덤 위치 생성
        double x = -15 + (30 * random.nextDouble()); // -15 to 15
        double z = -15 + (30 * random.nextDouble()); // -15 to 15
        Position randomPosition = new Position(x, yPos, z);

        // 새로운 아이템 객체 생성
        String itemId = itemType + "-" + UUID.randomUUID().toString();
        ObjectState newItem = new ObjectState(itemId, randomPosition, objectType, modelPath, itemType, null, stackable); // ammo는 null로 초기화

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
        logger.info("Registering player at position: x={}, y={}, z={}",
        	    playerState.getPosition().getX(),
        	    playerState.getPosition().getY(),
        	    playerState.getPosition().getZ());
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
    public boolean pickUpItemFromScene(String playerId, String objectId, com.example.demo.dto.ItemActionRequest.ItemData itemData) {
        PlayerState player = connectedPlayers.get(playerId);
        ObjectState sceneObject = sceneObjects.get(objectId);

        if (player == null || sceneObject == null) {
            logger.warn("Pickup failed: Player or SceneObject not found.");
            return false;
        }

        // 씬에서 오브젝트 제거
        sceneObjects.remove(objectId);
        logger.info("Scene object {} (type: {}) removed from scene by player {}.", objectId, sceneObject.getItemType(), playerId);

        // ObjectState에서 Item으로 변환
        Item pickedItem = convertObjectStateToItem(sceneObject, itemData);

        // 플레이어 인벤토리에 아이템 추가
        if (addItemToPlayerInventory(playerId, pickedItem)) {
            logger.info("Player {} picked up item {} (type: {}).", playerId, pickedItem.getName(), pickedItem.getType());
            return true;
        } else {
            logger.error("Failed to add item {} to player {}'s inventory.", pickedItem.getName(), playerId);
            // 아이템 추가 실패 시, 씬에 다시 돌려놓는 로직 추가 가능
            sceneObjects.put(objectId, sceneObject);
            return false;
        }
    }

    private Item convertObjectStateToItem(ObjectState sceneObject, com.example.demo.dto.ItemActionRequest.ItemData itemData) {
        String itemType = sceneObject.getItemType();
        boolean stackable = sceneObject.isStackable();
        String imagePath = "/objects/" + itemType + ".png";

        int currentAmmo = 0;
        int reserveAmmo = 0;
        if (itemData != null && itemData.getAmmo() != null) {
            currentAmmo = itemData.getAmmo().getCurrent();
            reserveAmmo = itemData.getAmmo().getReserve();
        }

        return new Item(sceneObject.getId(), itemType, sceneObject.getObjectType(), 1, imagePath, 10, currentAmmo, reserveAmmo, stackable);
    }

    public boolean addItemToPlayerInventory(String playerId, Item itemToAdd) {
        PlayerState player = connectedPlayers.get(playerId);
        if (player == null) {
            logger.warn("Player {} not found. Cannot add item {}.", playerId, itemToAdd.getName());
            return false;
        }

        // 중첩 가능한 아이템인 경우, 이름(타입)으로 기존 아이템을 찾음
        if (itemToAdd.isStackable()) {
            Optional<Item> existingItemOpt = player.getInventory().stream()
                .filter(i -> i.getName().equals(itemToAdd.getName()))
                .findFirst();

            if (existingItemOpt.isPresent()) {
                Item existingItem = existingItemOpt.get();
                existingItem.setCount(existingItem.getCount() + itemToAdd.getCount());
                logger.info("Player {} already has stackable item {}. Increased count to {}.", playerId, existingItem.getName(), existingItem.getCount());
                return true; // 추가 성공
            }
        } 
        
        // 중첩 불가능한 아이템이거나, 중첩 가능한데 기존에 없던 아이템인 경우
        // 인벤토리에 새롭게 추가
        player.getInventory().add(itemToAdd);
        logger.info("Player {} added new item {} (ID: {}, Count: {}).", playerId, itemToAdd.getName(), itemToAdd.getId(), itemToAdd.getCount());
        return true;
    }
    
     // 신규 : 플레이어가 존재하면 플레이어 인벤토리(list(item)) 반환 , 
    //        플레이어가 존재 x , 에러를 내지 않고 '빈 리스트'를 대신 돌려줌
    public List<Item> getInventoryForPlayer(String playerId) {
        PlayerState player = connectedPlayers.get(playerId);
        if (player == null) {
            logger.warn("❌ 존재하지 않는 playerId: {}", playerId);
            return Collections.emptyList(); // 또는 null 대신 빈 리스트 반환
        }
        return player.getInventory();
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
     * 플레이어 인벤토리에서 아이템을 제거하고 씬에 다시 생성합니다.
     * @param playerId 아이템을 버릴 플레이어의 ID
     * @param itemId 버릴 아이템의 ID (인벤토리 아이템 ID)
     * @param itemData 버릴 아이템의 상세 데이터 (탄약 정보 포함)
     * @param dropPosition 아이템이 버려질 위치
     * @return 아이템 버리기 성공 여부
     */
    public boolean dropItemFromInventory(String playerId, String itemId, com.example.demo.dto.ItemActionRequest.ItemData itemData, Position dropPosition, int quantity) {
        PlayerState player = connectedPlayers.get(playerId);
        if (player == null) {
            logger.warn("Player {} not found. Cannot drop item {}.", playerId, itemId);
            return false;
        }

        Optional<Item> itemToDropOpt = player.getInventory().stream()
            .filter(i -> i.getId().equals(itemId))
            .findFirst();
        
        if (itemToDropOpt.isEmpty()) {
            logger.warn("Player {} does not have item {} in inventory.", playerId, itemId);
            return false;
        }

        Item itemToDrop = itemToDropOpt.get();
        
        if (itemToDrop.getCount() < quantity) {
            logger.warn("Player {} only has {} of item {} but tried to drop {}.", playerId, itemToDrop.getCount(), itemId, quantity);
            return false;
        }

        itemToDrop.setCount(itemToDrop.getCount() - quantity);
        logger.info("Player {} dropped {} of item {}. Remaining count: {}.", playerId, quantity, itemToDrop.getName(), itemToDrop.getCount());

        // 아이템 개수가 0이 되면 인벤토리에서 완전히 제거
        if (itemToDrop.getCount() <= 0) {
            player.getInventory().remove(itemToDrop);
            logger.info("Player {} completely dropped item {} from inventory.", playerId, itemToDrop.getName());
        }

        // 씬에 다시 생성할 ObjectState 생성
        String newObjectId;
        boolean isStackable = itemToDrop.isStackable();

        // 중첩 가능한 아이템(사과 등)은 버릴 때마다 새로운 ID를 부여
        if (isStackable) {
            newObjectId = itemToDrop.getName() + "-" + UUID.randomUUID().toString();
        } else {
            // 중첩 불가능한 아이템(무기 등)은 원래 가지고 있던 ID를 그대로 사용
            newObjectId = itemToDrop.getId();
        }

        ObjectState droppedObject = new ObjectState(
            newObjectId,
            dropPosition,
            itemToDrop.getName(), // objectType
            itemToDrop.getImage().replace(".png", ".glb"), // modelPath (png -> glb)
            itemToDrop.getName(), // itemType
            itemToDrop.getCurrentAmmo() > 0 || itemToDrop.getReserveAmmo() > 0 ? new Ammo(itemToDrop.getCurrentAmmo(), itemToDrop.getReserveAmmo()) : null, // 탄약 정보
            isStackable // 중첩 가능 여부 설정
        );
        sceneObjects.put(droppedObject.getId(), droppedObject);
        logger.info("Dropped item {} re-added to scene at position {}.", droppedObject.getId(), dropPosition);

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
	 * 플레이어의 코인을 설정합니다.
	 * 
	 * @param playerId 코인을 설정할 플레이어의 ID
	 * @param newCoin  설정할 코인 값
	 * @return 코인 설정 성공 여부
	 */
    public boolean setPlayerCoin(String playerId, int newAmount) {
        PlayerState player = connectedPlayers.get(playerId);
        if (player == null) {
            logger.warn("존재하지 않는 플레이어 ID: {}", playerId);
            return false;
        }

        player.setCoin(newAmount);
        
        // 동기화 메시지 전송
        messagingTemplate.convertAndSend("/topic/hud/" + playerId, Map.of(
            "type", "COIN_UPDATE",
            "coin", newAmount
        ));

        return true;
    }

	/**
	 * Npc에게 아이템 구매 로직
	 */
    public boolean buyItemForPlayer(String playerId, String itemName, int price) {
        PlayerState player = connectedPlayers.get(playerId);
        if (player == null) return false;

        // ❌ 코인 부족
        if (player.getCoin() < price) {
            System.out.println("❌ 코인 부족: 구매 불가");
            messagingTemplate.convertAndSend("/topic/hud/" + playerId,
                Map.of("type", "ITEM_GIVE_RESULT", "success", false, "message", "보유 금액이 부족합니다."));
            return false;
        }
        
      // 파이프 중복 방지
        if (itemName.equals("pipe")) {
            List<Item> inventory = player.getInventory();
            boolean alreadyOwned = inventory.stream()
                .anyMatch(item -> item.getName().equals("pipe"));
            if (alreadyOwned) {
                logger.info("❌ {} 이미 pipe 보유 중 → 중복 구매 불가", playerId);
                return false;
            }
        }


        player.setCoin(player.getCoin() - price);

        // 한글 → 영문 이름 매핑
        String engItemName = switch (itemName) {
            case "사과" -> "apple";
            case "파이프" -> "pipe";
            default -> null;
        };

        if (engItemName == null) {
            System.out.println("❌ 알 수 없는 아이템: " + itemName);
            return false;
        }

        // 해당 아이템 생성
        Item item = null;
        if ("apple".equals(engItemName)) {
            item = new Item(
                UUID.randomUUID().toString(),
                "apple",
                "food",
                1,
                "/objects/apple.png",
                0.0,
                0,
                0,
                true,
                null
            );
        } else if ("pipe".equals(engItemName)) {
            item = new Item(
                UUID.randomUUID().toString(),
                "pipe",
                "tool",
                1,
                "/objects/pipe.png",
                0.0,
                0,
                0,
                true,
                null
            );
        }

//        if (item == null) return false;

        if (item == null) {
            messagingTemplate.convertAndSend("/topic/hud/" + playerId,
                Map.of("type", "ITEM_GIVE_RESULT", "success", false, "message", "아이템 생성에 실패했습니다."));
            return false;
        }
        boolean success = addItemToPlayerInventory(playerId, item);

        messagingTemplate.convertAndSend("/topic/hud/" + playerId,
            Map.of("type", "COIN_UPDATE", "coin", player.getCoin()));

        if (success) {
            messagingTemplate.convertAndSend("/topic/inventory/" + playerId,
                getInventoryForPlayer(playerId));
        }

        return success;
    }

    // 아이템 5회 초과 수령시 제한
    
    //해당 플레이어가 지금까지 몇 번 사과를 받았는지 조회
    public int getAppleReceiveCount(String playerId) {
        return appleReceiveMap.getOrDefault(playerId, 0);
    }
    //해당 플레이어의 사과 수령 횟수를 1 증가시킴.
    public void incrementAppleReceiveCount(String playerId) {
        appleReceiveMap.put(playerId, getAppleReceiveCount(playerId) + 1);
    }
    
    //해당 플레이어가 사과를 받을 수 있는지 여부를 판단함.
    public boolean canReceiveApple(String playerId) {
        return getAppleReceiveCount(playerId) < 5;
    }
    
    
    /**
     * 플레이어를 사망 상태로 설정하고 리스폰 타이머를 시작합니다.
     * @param playerId 사망 처리할 플레이어의 ID
     * 신규 : 사망시 플레이어의 코인을 죽인 플레이어에게 모두 전송하고 업데이트합니다
     */
    public void setPlayerDead(String playerId, String killerId) {
        PlayerState player = connectedPlayers.get(playerId);
        PlayerState killer = connectedPlayers.get(killerId);

        if (player != null) {
            player.setHealth(0);
            player.getAnimationState().setIsDead(true);

            // 기존 보유 코인 저장
            int lostCoins = player.getCoin();

            // 사망한 플레이어 코인 0으로 설정
            player.setCoin(0);
            logger.info("Player {} died and lost {} coins.", playerId, lostCoins);

            // 죽인 플레이어에게 코인 전송
            if (killer != null) {
                killer.setCoin(killer.getCoin() + lostCoins);
                logger.info("💰 Player {} received {} coins from {}.", killerId, lostCoins, playerId);

                // killer HUD 업데이트
                messagingTemplate.convertAndSend("/topic/hud/" + killerId,
                    Map.of("type", "COIN_UPDATE", "coin", killer.getCoin()));
            } else {
                logger.info("🕳️ {} coins destroyed (no killer)", lostCoins);
            }

            // 죽은 플레이어 HUD 업데이트
            messagingTemplate.convertAndSend("/topic/hud/" + playerId,
                Map.of("type", "COIN_UPDATE", "coin", 0));
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
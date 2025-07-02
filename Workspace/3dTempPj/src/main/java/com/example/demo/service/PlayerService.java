package com.example.demo.service;

import com.example.demo.dto.AnimationState; // AnimationState DTO를 임포트합니다.
import com.example.demo.dto.PlayerState;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Map;

@Service
public class PlayerService {

    private static final Logger logger = LoggerFactory.getLogger(PlayerService.class);

    private final Map<String, PlayerState> connectedPlayers = new ConcurrentHashMap<>();
    private final Map<String, String> sessionToPlayerIdMap = new ConcurrentHashMap<>();

    /**
     * 새로운 플레이어를 추가하거나, 기존 플레이어의 세션 ID 및 초기 상태를 업데이트합니다.
     * 클라이언트의 `id`를 기준으로 플레이어를 식별합니다.
     *
     * @param playerState 등록할 플레이어의 상태 (ID, 초기 위치 등)
     * @param sessionId 현재 연결의 세션 ID
     */
    public void addPlayer(PlayerState playerState, String sessionId) {
        if (playerState.getId() == null || playerState.getId().isEmpty()) {
            logger.error("Attempted to add player with null or empty ID.");
            return;
        }

        // 이미 존재하는 플레이어인지 확인 (클라이언트 ID 기준)
        if (connectedPlayers.containsKey(playerState.getId())) {
            // 플레이어가 이미 존재한다면, 세션 ID 및 최신 상태를 업데이트
            PlayerState existingPlayer = connectedPlayers.get(playerState.getId());
            String oldSessionId = existingPlayer.getSessionId();

            // 기존 세션 매핑 제거 (만약 이전 세션 ID가 다르고 유효하다면)
            if (oldSessionId != null && !oldSessionId.equals(sessionId) && sessionToPlayerIdMap.containsKey(oldSessionId)) {
                sessionToPlayerIdMap.remove(oldSessionId);
                logger.debug("Removed old session mapping for player {}: {}", playerState.getId(), oldSessionId);
            }

            // 플레이어 상태 업데이트 (위치, 회전, 애니메이션 상태 등 클라이언트가 보낸 최신 값으로)
            existingPlayer.setSessionId(sessionId);
            existingPlayer.setPosition(playerState.getPosition());
            existingPlayer.setRotationY(playerState.getRotationY());
            existingPlayer.setAnimationState(playerState.getAnimationState()); // <-- 이 줄을 추가합니다!

            logger.info("Player {} re-registered and updated with new session {}. Old session: {}", playerState.getId(), sessionId, oldSessionId);
        } else {
            // 새로운 플레이어라면 추가
            playerState.setSessionId(sessionId);
            connectedPlayers.put(playerState.getId(), playerState);
            logger.info("Player {} added with session {}", playerState.getId(), sessionId);
        }
        
        // 세션 ID와 플레이어 ID 매핑을 항상 최신으로 유지
        if (sessionId != null) {
            sessionToPlayerIdMap.put(sessionId, playerState.getId());
            logger.debug("Session-PlayerId map updated: {} -> {}", sessionId, playerState.getId());
        }
        logger.debug("Player count after add/update: {}", connectedPlayers.size());
    }

    /**
     * 특정 플레이어의 위치, 회전, 그리고 애니메이션 상태 정보를 업데이트합니다.
     * 이 메서드는 이제 PlayerState 전체를 인자로 받아 필요한 필드를 업데이트합니다.
     *
     * @param playerId 업데이트할 플레이어의 고유 ID
     * @param newPosition 새로운 위치
     * @param newRotationY 새로운 Y축 회전 값
     * @param newAnimationState 새로운 애니메이션 상태 (추가됨)
     */
    public void updatePlayerState(String playerId, PlayerState.Position newPosition, double newRotationY, AnimationState newAnimationState) {
        PlayerState player = connectedPlayers.get(playerId);
        if (player != null) {
            player.setPosition(newPosition);
            player.setRotationY(newRotationY);
            player.setAnimationState(newAnimationState); // <-- 이 줄이 중요합니다!
            // 이 로그는 프레임마다 너무 많이 발생할 수 있으므로, 필요한 경우에만 활성화하세요.
            // logger.debug("Updated player {} state (pos: {}, rotY: {}, anim: {})", playerId, newPosition, newRotationY, newAnimationState);
        } else {
            //logger.warn("Attempted to update non-existent player: {}", playerId);
        }
    }
    
    public void updatePlayerState(PlayerState updatedPlayerState) {
        if (updatedPlayerState == null || updatedPlayerState.getId() == null) {
            logger.warn("[PlayerService] Attempted to update with null player state or ID.");
            return;
        }

        PlayerState player = connectedPlayers.get(updatedPlayerState.getId());
        if (player != null) {
            player.setNickname(updatedPlayerState.getNickname()); // <-- 이 줄이 닉네임을 설정합니다.
            player.setPosition(updatedPlayerState.getPosition());
            player.setRotationY(updatedPlayerState.getRotationY());
            player.setAnimationState(updatedPlayerState.getAnimationState());
            // 🚨 이 부분도 콘솔에 로그를 출력합니다.
            logger.debug("[PlayerService] Updated player {} state (Nickname: {}, pos: {}, rotY: {}, anim: {})",
                    updatedPlayerState.getId(), player.getNickname(), updatedPlayerState.getPosition(),
                    updatedPlayerState.getRotationY(), updatedPlayerState.getAnimationState());
        } else {
            logger.warn("[PlayerService] Attempted to update non-existent player: {}", updatedPlayerState.getId());
        }
    }

    /**
     * 특정 플레이어 ID를 통해 플레이어를 제거합니다.
     *
     * @param playerId 제거할 플레이어의 고유 ID
     */
    public void removePlayerById(String playerId) {
        if (playerId != null) {
            PlayerState removedPlayer = connectedPlayers.remove(playerId);
            if (removedPlayer != null) {
                // 해당 플레이어 ID에 연결된 세션 매핑 제거
                // Note: 한 플레이어 ID에 여러 세션이 연결될 가능성은 낮지만, 로직은 이에 대비
                sessionToPlayerIdMap.entrySet().removeIf(entry -> entry.getValue().equals(playerId));
                //logger.info("Player removed by ID: {}. Remaining: {}", playerId, connectedPlayers.size());
            } else {
                //logger.warn("Attempted to remove non-existent player by ID: {}", playerId);
            }
        }
    }

    /**
     * 연결이 끊긴 세션 ID를 통해 플레이어를 제거합니다.
     * 이 메서드는 주로 WebSocketEventListener에서 세션 단절 시 호출됩니다.
     *
     * @param sessionId 제거할 세션의 ID
     */
    public void removePlayerBySessionId(String sessionId) {
        if (sessionId != null) {
            String playerId = sessionToPlayerIdMap.remove(sessionId); // 세션 ID로 플레이어 ID 찾아서 매핑 제거
            if (playerId != null) {
                connectedPlayers.remove(playerId); // 플레이어 ID로 플레이어 상태 제거
                //logger.info("Player removed by Session ID: {} (Player ID: {}). Remaining: {}", sessionId, playerId, connectedPlayers.size());
            } else {
                //logger.warn("Attempted to remove player for non-existent session: {}", sessionId);
            }
        }
    }

    /**
     * 현재 연결된 모든 플레이어의 상태를 반환합니다.
     *
     * @return 모든 플레이어 상태 객체의 컬렉션
     */
    public Collection<PlayerState> getAllPlayers() {
        return connectedPlayers.values();
    }

    /**
     * 주어진 ID에 해당하는 플레이어의 상태를 반환합니다.
     *
     * @param playerId 조회할 플레이어의 고유 ID
     * @return 플레이어 상태 객체, 없으면 null
     */
    public PlayerState getPlayerById(String playerId) {
        return connectedPlayers.get(playerId);
    }
}
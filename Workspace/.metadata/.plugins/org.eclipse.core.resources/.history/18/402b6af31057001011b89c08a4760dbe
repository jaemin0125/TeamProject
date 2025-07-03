package com.example.demo.service;

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

    public void addPlayer(PlayerState playerState, String sessionId) {
        if (playerState.getId() == null || playerState.getId().isEmpty()) {
            logger.error("[PlayerService] Attempted to add player with null or empty ID.");
            return;
        }

        // 🚨 이 부분이 콘솔에 로그를 출력합니다.
        logger.info("[PlayerService] Adding/Updating player: ID={}, Nickname='{}', Session={}",
                playerState.getId(), playerState.getNickname(), sessionId);

        if (connectedPlayers.containsKey(playerState.getId())) {
            PlayerState existingPlayer = connectedPlayers.get(playerState.getId());
            String oldSessionId = existingPlayer.getSessionId();

            if (oldSessionId != null && !oldSessionId.equals(sessionId) && sessionToPlayerIdMap.containsKey(oldSessionId)) {
                sessionToPlayerIdMap.remove(oldSessionId);
                // 이 부분도 콘솔에 로그를 출력합니다.
                logger.debug("[PlayerService] Removed old session mapping for player {}: {}", playerState.getId(), oldSessionId);
            }

            existingPlayer.setSessionId(sessionId);
            existingPlayer.setPosition(playerState.getPosition());
            existingPlayer.setRotationY(playerState.getRotationY());
            existingPlayer.setAnimationState(playerState.getAnimationState());
            existingPlayer.setNickname(playerState.getNickname()); // <-- 이 줄이 닉네임을 설정합니다.

            // 🚨 이 부분도 콘솔에 로그를 출력합니다.
            logger.info("[PlayerService] Player {} re-registered and updated with new session {}. Old session: {}. Current nickname: {}",
                    playerState.getId(), sessionId, oldSessionId, existingPlayer.getNickname());
        } else {
            playerState.setSessionId(sessionId);
            connectedPlayers.put(playerState.getId(), playerState);
            // 🚨 이 부분도 콘솔에 로그를 출력합니다.
            logger.info("[PlayerService] New player {} added with session {}. Nickname: {}",
                    playerState.getId(), sessionId, playerState.getNickname());
        }
        
        if (sessionId != null) {
            sessionToPlayerIdMap.put(sessionId, playerState.getId());
            // 이 부분도 콘솔에 로그를 출력합니다.
            logger.debug("[PlayerService] Session-PlayerId map updated: {} -> {}", sessionId, playerState.getId());
        }
        // 이 부분도 콘솔에 로그를 출력합니다.
        logger.debug("[PlayerService] Player count after add/update: {}", connectedPlayers.size());
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

    public void removePlayerById(String playerId) {
        // ... (생략)
    }

    public void removePlayerBySessionId(String sessionId) {
        // ... (생략)
    }

    public Collection<PlayerState> getAllPlayers() {
        return connectedPlayers.values();
    }

    public String getPlayerIdBySessionId(String sessionId) {
        return sessionToPlayerIdMap.get(sessionId);
    }
}
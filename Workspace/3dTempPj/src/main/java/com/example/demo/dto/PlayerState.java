// src/main/java/com/example/demo/dto/PlayerState.java
package com.example.demo.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List; // ✨ List 임포트 추가
import java.util.ArrayList; // ✨ ArrayList 임포트 추가

// PlayerState DTO
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PlayerState {
    private String id; // 플레이어 ID (프론트에서 uuid로 생성하고 localStorage에 저장하여 유지)
    private String sessionId; // WebSocket 세션 ID (서버에서 설정)
    private String nickname;
    private Position position;
    private double rotationY;
    private AnimationState animationState;
    private int coin = 50; // ✅ 초깃값 20

    private int health = 100; // ✨ 새로 추가: 플레이어 체력 (기본값 100)
    private List<Item> inventory = new ArrayList<>(); // ✨ 새로 추가: 플레이어 인벤토리 (초기값 빈 리스트)

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Position {
        private double x;
        private double y;
        private double z;
    }
    
    public void setCoin(int coin) {
        this.coin = coin;
    }

    public int getCoin() {
        return coin;
    }
    
}
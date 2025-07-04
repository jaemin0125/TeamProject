package com.example.demo.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

// PlayerState DTO
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PlayerState {
    private String id; // 플레이어 ID (프론트에서 uuid로 생성하고 localStorage에 저장하여 유지)
    private String sessionId; // WebSocket 세션 ID (서버에서 설정)
    private String nickname; // <-- 이 줄을 추가해야 합니다!
    private Position position;
    private double rotationY;
    private AnimationState animationState; // <-- 이 부분이 새로 추가됩니다!

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Position {
        private double x;
        private double y;
        private double z;
    }
}
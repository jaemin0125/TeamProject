package com.example.demo.dto;

import lombok.AllArgsConstructor;
import lombok.Data; // @Data 어노테이션이 getter, setter, toString 등을 자동으로 생성해줍니다.
import lombok.NoArgsConstructor;

// PlayerState DTO
@Data // 이 어노테이션이 getter, setter, equals, hashCode, toString을 자동으로 생성합니다.
@NoArgsConstructor
@AllArgsConstructor
public class PlayerState {
    private String id; // 플레이어 ID (프론트에서 uuid로 생성하고 localStorage에 저장하여 유지)
    private String sessionId; // WebSocket 세션 ID (서버에서 설정)
    private String nickname; // <-- 이 줄을 추가해야 합니다!
    private Position position;
    private double rotationY;
    private AnimationState animationState; // <-- 이 부분은 이미 잘 추가되어 있습니다!

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Position {
        private double x;
        private double y;
        private double z;
    }
}
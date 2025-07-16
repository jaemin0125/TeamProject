// com.example.demo.dto.ChatMessage.java
package com.example.demo.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
// 채팅 구현 메서드
public class BulletImpactMessage {
    private String fromId;
    private Vector3 hitPosition;
    private Vector3 hitNormal;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor  // 내부 static class로 3D 벡터 표현
    public static class Vector3 {
        public double x, y, z;
    }

    // Getters/Setters 생략 가능 (Lombok 써도 됨)
}

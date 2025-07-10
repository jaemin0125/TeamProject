// src/main/java/com/example/demo/dto/ObjectState.java
package com.example.demo.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import com.example.demo.dto.PlayerState.Position;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ObjectState {
    private String id;
    private Position position;
    private String objectType; // 기존 필드 (예: "box", "sphere", "model")
    private String modelPath;  // 모델이 있는 경우 (예: "/models/apple.glb")
    private String itemType;   // ✨ 새로 추가: 이 오브젝트가 아이템일 경우 아이템 타입 (예: "APPLE")
}
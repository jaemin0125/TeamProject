package com.example.demo.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

// ✨ 요게 필요!
import com.example.demo.dto.PlayerState.Position;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ObjectState {
    private String id;
    private Position position; // ✅ PlayerState 내부 static 클래스 사용
}

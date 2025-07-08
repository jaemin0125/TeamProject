// src/main/java/com/example/demo/dto/ItemActionRequest.java
package com.example.demo.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ItemActionRequest {
    private String playerId; // 액션을 요청한 플레이어 ID
    private String itemId;   // 액션을 수행할 아이템의 ID (씬 오브젝트 ID 또는 인벤토리 아이템 ID)
    private String actionType; // 액션의 종류 (예: "PICKUP", "USE")
    // 필요한 경우 추가적인 데이터 (예: quantity 등)를 넣을 수 있습니다.
}
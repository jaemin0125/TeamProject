// src/main/java/com/example/demo/dto/Item.java
package com.example.demo.dto;

import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class Item {
    private String id;        // 아이템의 고유 ID (예: "apple_001")
    private String name;      // 아이템 이름 (예: "사과")
    private String type;      // 아이템 타입 (예: "food", "weapon", "consumable")
    private int count;        // 아이템 개수
    private String image; // 프론트엔드에서 사용할 아이템 이미지 경로 (예: "/assets/apple.png")
    private double healthRestore; // 체력 회복량 (소모성 아이템인 경우)
    private int currentAmmo; // 현재 탄약 수
    private int reserveAmmo; // 보유 탄약 수
    private boolean stackable; // 아이템 중첩 가능 여부
    private Ammo ammo;
    // 필요한 경우 다른 아이템 속성(예: 공격력, 방어력)을 추가할 수 있습니다.
    
   
    // 기존 생성자
    public Item(String id, String name, String type, int count, String image,
            double healthRestore, int currentAmmo, int reserveAmmo,
            boolean stackable) {
    this.id = id;
    this.name = name;
    this.type = type;
    this.count = count;
    this.image = image;
    this.healthRestore = healthRestore;
    this.currentAmmo = currentAmmo;
    this.reserveAmmo = reserveAmmo;
    this.stackable = stackable;
}
    
    
    // 간단한 아이템 생성용 (NPC 보상...)
    public Item(String id, String name, String type, int count, String image) {
        this.id = id; // 🔄 UUID 무시하지 말고 전달받은 걸 저장
        this.name = name;
        this.type = type;
        this.count = count;
        this.image = image;
        this.stackable = true;
    }
}
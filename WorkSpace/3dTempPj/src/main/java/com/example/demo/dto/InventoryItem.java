package com.example.demo.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class InventoryItem {
    private String id;
    private String name;
    private int count;
    private String image; // ✅ 이미지 경로 추가
    
    public InventoryItem(String name, int count,  String image) {
        this.name = name;
        this.count = count;
        this.image = image;
    }
    // 
}
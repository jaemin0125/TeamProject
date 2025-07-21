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
    
    public InventoryItem(String name, int count) {
        this.name = name;
        this.count = count;
    }
    // 
}
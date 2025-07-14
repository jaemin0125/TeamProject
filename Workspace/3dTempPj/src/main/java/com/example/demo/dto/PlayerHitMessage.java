package com.example.demo.dto;

public class PlayerHitMessage {
    private String fromId;
    private String targetId;
    private PlayerState.Position fromPosition;
    private PlayerState.Position targetPosition;
    private String weaponName;

    // 기본 생성자
    public PlayerHitMessage() {}

    public String getFromId() {
        return fromId;
    }

    public void setFromId(String fromId) {
    	this.fromId = fromId;
    }
    
    public String getTargetId() {
    	return targetId;
    }
    
    public void setTargetId(String targetId) {
    	this.targetId = targetId;
    }

    public PlayerState.Position getFromPosition() {
    	return fromPosition;
    }

    public void setFromPosition(PlayerState.Position fromPosition) {
    	this.fromPosition = fromPosition;
    }

  
    public PlayerState.Position getTargetPosition() {
    	return targetPosition;
    }
    
    public void setTargetPosition(PlayerState.Position targetPosition) {
    	this.targetPosition = targetPosition;
    }

    public String getWeaponName() {
    	return weaponName;
    }
    
    public void setWeaponName(String weaponName) {
    	this.weaponName = weaponName;
    }
}

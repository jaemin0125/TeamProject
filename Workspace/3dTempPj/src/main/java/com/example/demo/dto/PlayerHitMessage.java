package com.example.demo.dto;

public class PlayerHitMessage {
    private String fromId;
    private String targetId;

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
}
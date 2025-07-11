// com.example.demo.dto.ChatMessage.java
package com.example.demo.dto;

// 채팅 구현 메서드
public class ChatMessage {
    private String senderId;
    private String content;
    private String roomId; // 확장성 고려

    // Getter/Setter
    public String getSenderId() { return senderId; }
    public void setSenderId(String senderId) { this.senderId = senderId; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }

    public String getRoomId() { return roomId; }
    public void setRoomId(String roomId) { this.roomId = roomId; }
}
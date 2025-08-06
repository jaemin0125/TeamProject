// com.example.demo.dto.ChatMessage.java
package com.example.demo.dto;

// 채팅 구현 메서드
public class ChatMessage {
    private String senderId;   // 내부 식별용 (예: UUID)
    private String nickName;   // 사용자 친화적 닉네임 
    private String content;

    public ChatMessage() {}
    
    // Getter/Setter
    public String getSenderId() { return senderId; }
    public void setSenderId(String senderId) { this.senderId = senderId; }

    public String getNickName() { return nickName; }
    public void setNickName(String nickName) { this.nickName = nickName; }

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
}

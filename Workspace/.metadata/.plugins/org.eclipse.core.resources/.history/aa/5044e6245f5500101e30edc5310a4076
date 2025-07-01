package com.example.demo.controller; // 실제 프로젝트 패키지명으로 변경해주세요.

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

@Component // 이 클래스를 Spring Bean으로 등록하여 다른 곳에서 주입받아 사용할 수 있게 합니다.
public class WebSocketHandler extends TextWebSocketHandler {

    // 현재 연결된 모든 WebSocket 세션을 저장하는 ConcurrentHashMap입니다.
    // 동시성 문제를 방지하기 위해 ConcurrentHashMap을 사용합니다.
    private static final Map<String, WebSocketSession> sessions = new ConcurrentHashMap<>();
    // 각 플레이어의 ID와 해당 플레이어의 마지막 알려진 상태를 저장하는 맵입니다.
    private static final Map<String, Map<String, Object>> playerStates = new ConcurrentHashMap<>();
    // JSON 직렬화/역직렬화를 위한 ObjectMapper 인스턴스
    private final ObjectMapper objectMapper = new ObjectMapper();

    // 웹소켓 연결이 수립될 때 호출됩니다.
    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String playerId = session.getId(); // 세션 ID를 플레이어 ID로 사용합니다.
        sessions.put(playerId, session); // 현재 세션을 세션 맵에 추가합니다.
        System.out.println("새로운 클라이언트 연결: " + playerId);

        // 새로 연결된 클라이언트에게 현재 접속 중인 다른 모든 플레이어의 초기 상태를 전송합니다.
        Map<String, Map<String, Object>> initialPlayers = new HashMap<>();
        for (Map.Entry<String, Map<String, Object>> entry : playerStates.entrySet()) {
            if (!entry.getKey().equals(playerId)) { // 자신을 제외한 다른 플레이어 정보만 보냅니다.
                initialPlayers.put(entry.getKey(), entry.getValue());
            }
        }

        // initialPlayers 메시지를 JSON 문자열로 변환하여 전송합니다.
        Map<String, Object> message = new HashMap<>();
        message.put("type", "initialPlayers");
        message.put("players", initialPlayers);
        session.sendMessage(new TextMessage(objectMapper.writeValueAsString(message)));
    }

    // 클라이언트로부터 텍스트 메시지를 수신할 때 호출됩니다.
    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload(); // 수신된 메시지의 페이로드(내용)를 가져옵니다.
        String playerId = session.getId();

        try {
            // JSON 메시지를 JsonNode 객체로 파싱합니다.
            JsonNode jsonNode = objectMapper.readTree(payload);
            String messageType = jsonNode.get("type").asText(); // 메시지 타입 (예: "playerUpdate")
            
//            System.out.println(jsonNode);

            if ("playerUpdate".equals(messageType)) {
                // 플레이어 업데이트 메시지 처리
                double posX = jsonNode.get("position").get("x").asDouble();
                double posY = jsonNode.get("position").get("y").asDouble();
                double posZ = jsonNode.get("position").get("z").asDouble();
                double rotationYaw = jsonNode.get("rotationYaw").asDouble();
                String viewMode = jsonNode.get("viewMode").asText();

                // 현재 플레이어의 상태를 업데이트합니다.
                Map<String, Object> currentPlayerState = new HashMap<>();
                currentPlayerState.put("position", Map.of("x", posX, "y", posY, "z", posZ));
                currentPlayerState.put("rotationYaw", rotationYaw);
                currentPlayerState.put("viewMode", viewMode);
                playerStates.put(playerId, currentPlayerState);

                // 업데이트된 플레이어 상태를 다른 모든 클라이언트에게 브로드캐스트합니다.
                Map<String, Object> broadcastMessage = new HashMap<>();
                broadcastMessage.put("type", "playerUpdate");
                broadcastMessage.put("id", playerId);
                broadcastMessage.put("position", Map.of("x", posX, "y", posY, "z", posZ));
                broadcastMessage.put("rotationYaw", rotationYaw);
                broadcastMessage.put("viewMode", viewMode);

                String jsonBroadcast = objectMapper.writeValueAsString(broadcastMessage);

                // 자신을 제외한 모든 세션에 메시지를 전송합니다.
                for (WebSocketSession s : sessions.values()) {
                    if (s.isOpen() && !s.getId().equals(playerId)) {
                        s.sendMessage(new TextMessage(jsonBroadcast));
                    }
                }
            }
            // 다른 메시지 타입이 있다면 여기에 추가할 수 있습니다.

        } catch (IOException e) {
            System.err.println("JSON 파싱 오류: " + e.getMessage());
        }
    }

    // 웹소켓 연결이 닫힐 때 호출됩니다.
    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        String playerId = session.getId(); // 연결이 끊긴 플레이어의 ID
        sessions.remove(playerId); // 세션 맵에서 해당 세션을 제거합니다.
        playerStates.remove(playerId); // 플레이어 상태 맵에서도 제거합니다.
        System.out.println("클라이언트 연결 종료: " + playerId + ", 상태: " + status);

        // 다른 모든 클라이언트에게 이 플레이어가 접속을 끊었음을 알립니다.
        Map<String, Object> disconnectMessage = new HashMap<>();
        disconnectMessage.put("type", "playerDisconnected");
        disconnectMessage.put("id", playerId);

        String jsonDisconnect = objectMapper.writeValueAsString(disconnectMessage);

        for (WebSocketSession s : sessions.values()) {
            if (s.isOpen()) { // 열려 있는 세션에만 보냅니다.
                s.sendMessage(new TextMessage(jsonDisconnect));
            }
        }
    }

    // 통신 오류 발생 시 호출됩니다.
    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) throws Exception {
        System.err.println("WebSocket 통신 오류: " + session.getId() + ", 오류: " + exception.getMessage());
        // 오류 발생 시에도 연결을 닫고 정리합니다.
        session.close(CloseStatus.SERVER_ERROR);
    }
}

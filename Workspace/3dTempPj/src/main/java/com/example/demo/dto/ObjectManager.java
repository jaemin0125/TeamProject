package com.example.demo.dto;

import java.util.Collection;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.stereotype.Component;

import com.example.demo.dto.PlayerState.Position;

@Component
public class ObjectManager {
    private final Map<String, ObjectState> objectMap = new ConcurrentHashMap<>();

    public ObjectManager() {
        // ✅ 초기 테스트용 오브젝트 등록
        registerObject(new ObjectState(
            "npc_apple",
            new Position(1, 2, 3),
            "model",
            "/models/apple.glb",
            "APPLE",
            null,
            true
        ));

        registerObject(new ObjectState(
            "npc_pipe",
            new Position(2, 2, 3),
            "model",
            "/models/pipe.glb",
            "PIPE",
            null,
            false
        ));

        // 필요시 더 추가 가능
    }

    public ObjectState getObjectById(String objectId) {
        return objectMap.get(objectId);
    }

    public void registerObject(ObjectState objectState) {
        objectMap.put(objectState.getId(), objectState);
    }

    public void removeObject(String objectId) {
        objectMap.remove(objectId);
    }

    public Collection<ObjectState> getAllObjects() {
        return objectMap.values();
    }
}



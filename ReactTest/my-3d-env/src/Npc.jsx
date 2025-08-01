// Npc.jsx
import React, { useRef, useState, useEffect } from 'react';
import { useGLTF, Html ,  useAnimations} from '@react-three/drei';
import { RigidBody, CapsuleCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { Client } from '@stomp/stompjs';
import { getOrCreatePlayerInfo } from './utils/constants'; // // utils/constants.js의 플레이어 id 가져오기
import './Npc.css';

export default function Npc({ position = [5, -4.3, -16], playerRef, onInteract, client }) {
  const gltf = useGLTF('/objects/npc.glb');
  const { actions, names } = useAnimations(gltf.animations, gltf.scene); 
  const npcRef = useRef();

  const [showMessage, setShowMessage] = useState(false);
  const [conversationStep, setConversationStep] = useState(0);

  const dialogue = [
    '이 맵에 처음 오셨습니까?',
    '언제든 물어보세요.',
    '여기서 아이템도 얻을 수 있습니다.',
  ];

  const handleTalk = () => {
    setConversationStep((prev) =>
      prev < dialogue.length - 1 ? prev + 1 : 0
    );
  };

  //Npc 애니메이션 동작
useEffect(() => {
  if (actions && names.length > 0) {
    actions[names[0]]?.reset().fadeIn(0.5).play(); //  첫 애니메이션 자동 재생
  }
}, [actions, names]);


  // Npc 아이템 수령 기믹

  const { id: currentPlayerId } = getOrCreatePlayerInfo();// currentPlayerid 가져오기
  
// 플레이어가 NPC와 상호작용할 때 아이템 달라는 요청을 서버에 보냄(클라 -> 서버)
  const handleGiveItem = () => {
    if (client && client.connected) {
      client.publish({
        destination: "/app/npc/action",
        body: JSON.stringify({
          playerId: currentPlayerId,
          actionType: "give"
        }),
      });
    }
  }; 

  const handleClose = () => {
    setShowMessage(false);
    setConversationStep(0);
  };

  //  우클릭 시 대화창 오픈
  const handlePointerDown = (e) => {
    if (e.button === 2) {
      e.stopPropagation();
      setShowMessage(true);
    }
  };

  return (
    <RigidBody type="fixed" position={position} colliders={false}>
      <primitive
        object={gltf.scene}
        ref={npcRef}
        scale={1.9}
        onPointerDown={handlePointerDown}
      />
      <CapsuleCollider args={[0.4, 1.0]} position={[0, 1.2, 0]} />

      {showMessage && (
        <Html distanceFactor={25} position={[0, 3.5, 0]}>
          <div className="npc-speech-bubble">
            <div className="npc-bubble-text">{dialogue[conversationStep]}</div>
            <div className="npc-option-button" onClick={handleTalk}>
              [1] 대화 계속
            </div>
            <div className="npc-option-button" onClick={handleGiveItem}>
              [2] 아이템 받기
            </div>
            <div className="npc-option-button" onClick={handleClose}>
              [3] 닫기
            </div>
          </div>
        </Html>
      )}
    </RigidBody>
  );
}

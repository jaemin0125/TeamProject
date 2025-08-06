import React, { useRef, useState, useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import { useGLTF, useAnimations } from '@react-three/drei';
import { RigidBody, CapsuleCollider } from '@react-three/rapier';
import * as THREE from 'three';
import './Npc.css';

export default function Npc({
  position = [-12.4, 0.8, 9.3],
  playerRef,
  client,
  onDialogueChange,
  onProximityChange,
  onShopOpen,
  onFacePlayer,
  currentPlayerId,
  inventoryRef
}) {
  const gltf = useGLTF('/objects/npc.glb');
  const { actions, names } = useAnimations(gltf.animations, gltf.scene);
  const npcRef = useRef();
  const { gl } = useThree(); // Three.js 카메라와 WebGL 렌더러
  const [isNear, setIsNear] = useState(false);
  const [dialogueState, setDialogueState] = useState(null);
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [appleReceiveCount, setAppleReceiveCount] = useState(0);
  const MAX_APPLE_LIMIT = 5;

  // ✅ 대화 흐름



  const triggerDialogueStage1 = () => {
    const state = {
      text: "테스트 NPC.",
      buttons: [
        { label: "더 대화하기", onClick: triggerDialogueStage2 },
        { label: "아이템 받기", onClick: handleGiveItem },
        { label: "구매하기", onClick: handleOpenShop },
        {
          label: "닫기", onClick: () => {
            setDialogueState(null);
            onDialogueChange?.(null);
          }
        }
      ]
    };
    setDialogueState(state);
    onDialogueChange?.(state); // 외부에도 전달
  };

  const triggerDialogueStage2 = () => {
    const state = {
      text: "사과 아이템 받기",
      buttons: [
        { label: "아이템 받기", onClick: handleGiveItem },
        {
          label: "닫기", onClick: () => {
            setDialogueState(null);
            onDialogueChange?.(null);
          }
        }
      ]
    };
    setDialogueState(state);
    onDialogueChange?.(state);
  };

  // 서버로 아이템 받기 요청
  const handleGiveItem = () => {
    const objectId = 'npc_apple';
    if (client?.connected && currentPlayerId) {
      client.publish({
        destination: '/app/npc/action',
        body: JSON.stringify({
          playerId: currentPlayerId,
          objectId,
          actionType: 'give',
        }),
      });
    }
  };


  // 구매하기 클릭 시
  const handleOpenShop = () => {
    onDialogueChange?.({
      npcName: '구매',
      shopOpen: true,
      items: [
        { icon: "/objects/apple.png", name: '사과', price: 20 },
        { icon: "/objects/pipe.png", name: '파이프', price: 30 }
      ],
      npcDescription: '상점에서 아이템 구매하세요',

      onBuy: (item) => {  // ✅ item 전체 객체 받기
        if (!client || !client.connected || !currentPlayerId) {
          console.warn("❌ STOMP 연결 또는 playerId 누락");
          return;
        }

        // 이중 검증 로직.
        // if (item.name === '파이프' && inventoryRef?.current.some(item => item?.name === 'pipe')) {
        //   return;
        // }

        client.publish({
          destination: '/app/npc/action',
          body: JSON.stringify({
            playerId: currentPlayerId,
            actionType: 'buy',
            itemData: {
              name: item.name,     // ✅ 예: '사과'
              type: item.type || 'food',  // 기본값도 설정 가능
              icon: item.icon,
              price: item.price
            },
            quantity: 1,
          }),
        });

        console.log("✅ 구매 메시지 전송됨:", item);
      },


      onClose: () => onDialogueChange(null)
    });
  };

  // ✅ 충돌 감지
  const handleIntersection = ({ other }) => {
    if (other.rigidBodyObject?.name === 'player') {
      setIsNear(true);
      onProximityChange?.(true);
    }
  };

  const handleExit = ({ other }) => {
    if (other.rigidBodyObject?.name === 'player') {
      setIsNear(false);
      setDialogueState(null);
      setIsShopOpen(false);
      onProximityChange?.(false);
      setIsShopOpen(false); // ✅ 상점도 닫기
      onDialogueChange?.(null);
    }
  };

  // 임시) 플레이어가 npc 쪽으로 회전
  const handleFaceToNpc = () => {
    if (onFacePlayer && npcRef.current) {
      const npcPos = new THREE.Vector3();
      npcRef.current.getWorldPosition(npcPos);
      onFacePlayer(npcPos); // ✅ NPC 위치 전달
    }
  };


  // NPC가 현재 바라보는 방향을 플레이어 쪽으로 회전
  const handleNpcLookToPlayer = () => {
    if (!playerRef?.current || !npcRef?.current) return;

    // ✅ RigidBody의 위치는 translation()으로 가져옴
    const playerPosRaw = playerRef.current.translation();
    const playerPos = new THREE.Vector3(playerPosRaw.x, playerPosRaw.y, playerPosRaw.z);

    const npcPos = new THREE.Vector3();
    npcRef.current.getWorldPosition(npcPos);

    const dir = new THREE.Vector3().subVectors(playerPos, npcPos).normalize();
    const targetAngle = Math.atan2(dir.x, dir.z);

    const quat = new THREE.Quaternion();
    quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), targetAngle);

    npcRef.current.quaternion.copy(quat);
  };



  // ✅ F 키로 대화 시작
  useEffect(() => {
    if (!isNear) return;
    const handleKeyDown = (e) => {
      if (e.code === 'KeyF') {
        handleFaceToNpc();
        handleNpcLookToPlayer();    // ✅ 회전 요청
        triggerDialogueStage1();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isNear]);

  // ✅ 애니메이션
  useEffect(() => {
    if (actions && names.length > 0) {
      actions[names[0]]?.reset().fadeIn(0.5).play();
    }
  }, [actions, names]);


  return (
    <>
      <RigidBody
        type="fixed"
        name="npc"
        position={position}
        colliders={false}
        onIntersectionEnter={handleIntersection}
        onIntersectionExit={handleExit}
      >
        <primitive object={gltf.scene} ref={npcRef} rotation={[0, Math.PI / 1.7, 0]} scale={1.9} />
        <CapsuleCollider args={[0.4, 1.0]} position={[0, 0.5, 0]} sensor={true} />
        <CapsuleCollider args={[0.4, 1.0]} position={[0, 1.2, 0]} sensor={false} />
      </RigidBody>

      {/* ✅ 내부 대화창 */}
      {dialogueState && (
        <div className="npc-hud-ui">
          <div className="npc-bubble-text">{dialogueState.text}</div>
          {dialogueState.buttons.map((btn, idx) => (
            <div key={idx} className="npc-option-button" onClick={btn.onClick}>
              {btn.label}
            </div>
          ))}
        </div>
      )}


    </>
  );
}  
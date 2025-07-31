import React, { useRef, useState, useEffect } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { RigidBody, CapsuleCollider } from '@react-three/rapier';
import * as THREE from 'three';
import './Npc.css';

export default function Npc({
  position = [-16, 0.5, -5],
  playerRef,
  client,
  onDialogueChange,
  onProximityChange,
  onShopOpen,
  onFacePlayer,
   currentPlayerId
}) {
  const gltf = useGLTF('/models/npc.glb');
  const { actions, names } = useAnimations(gltf.animations, gltf.scene);
  const npcRef = useRef();

  const [isNear, setIsNear] = useState(false);
  const [dialogueState, setDialogueState] = useState(null);
  const [isShopOpen, setIsShopOpen] = useState(false);



  
  
  // ✅ 대화 흐름
  const triggerDialogueStage1 = () => {
    const state = {
      text: "나는 이 맵의 안내자야.",
      buttons: [
        { label: "더 대화하기", onClick: triggerDialogueStage2 },
        { label: "아이템 받기", onClick: handleGiveItem },
        { label: "구매하기", onClick: handleOpenShop },
        { label: "닫기", onClick: () => {
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
      text: "이 사과는 네게 도움이 될 거야!",
      buttons: [
        { label: "아이템 받기", onClick: handleGiveItem },
        { label: "닫기", onClick: () => {
            setDialogueState(null);
            onDialogueChange?.(null);
          }   
        } 
      ]
    };
    setDialogueState(state);
    onDialogueChange?.(state);
  };

// const handleGiveItem = () => {
//   const objectId = 'npc_apple'; // 서버에 등록된 오브젝트 ID

//   if (client && client.connected && currentPlayerId) {
//     client.publish({
//       destination: '/app/npc/action',
//       body: JSON.stringify({
//         playerId: currentPlayerId, // ✅ 현재 메모리상의 ID를 전송
//         objectId,
//         actionType: 'give'
//       })
//     });
//   }

//   setDialogueState(null);
//   onDialogueChange?.(null);
// };



  const handleGiveItem = () => {
    const objectId = 'npc_apple';
    if (client?.connected && currentPlayerId) {
      client.publish({
        destination: '/app/npc/action',
        body: JSON.stringify({ playerId: currentPlayerId, objectId, actionType: 'give' }),
      });
    }
  };



// 구매하기 클릭 시
const handleOpenShop = () => {
  onDialogueChange?.({
      npcName: '구매', // ✅ 여기에 명시
    shopOpen: true,
    items: [
      { icon: '/icons/apple.png', name: '사과', price: 10 },
      { icon: '/icons/potion.png', name: '포션', price: 30 }
    ],
    npcDescription: '이 사과는 최고 품질이야! 다른 아이템도 살펴봐~',
    countdownTime: '1h 21min',
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

  const handleFaceToNpc = () => {
    if (onFacePlayer && npcRef.current) {
      const npcPos = new THREE.Vector3();
      npcRef.current.getWorldPosition(npcPos);
      onFacePlayer(npcPos); // ✅ NPC 위치 전달
    }
  };


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
             handleFaceToNpc();          // ✅ 회전 요청
               handleNpcLookToPlayer(); 
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
        <primitive object={gltf.scene} ref={npcRef} scale={1.9} />
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

      {/* ✅ 내부 상점창 */}
{isShopOpen && (
  <div className="shop-ui">
    <p>무엇을 구매하시겠습니까?</p>
    <button className="shop-button">🍎 사과 - 10골드</button>
    <button className="shop-button" onClick={() => setIsShopOpen(false)}>닫기</button>
  </div>
)}
    </>
  );
}  
// App.jsx
// React Hooks
import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
// React Three Fiber
import { Canvas, useFrame, useThree } from '@react-three/fiber';
// React Three Drei: KeyboardControls, useKeyboardControls, Text 컴포넌트 임포트
import { KeyboardControls, useKeyboardControls, Text } from '@react-three/drei';
// React Three Rapier
import { Physics, RigidBody, CapsuleCollider } from '@react-three/rapier';
// Leva
import { Leva, useControls } from 'leva';
// Three.js
import * as THREE from 'three';
import { CharacterModel, CharacterModel2 } from './CharacterModel'; // CharacterModel 및 CharacterModel2 임포트

// 웹소켓 라이브러리 import
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { v4 as uuidv4 } from 'uuid'; // uuid 라이브러리 임포트

// 키보드 컨트롤 맵 정의
const controlsMap = [
  { name: 'forward', keys: ['KeyW'] },
  { name: 'backward', keys: ['KeyS'] },
  { name: 'left', keys: ['KeyA'] },
  { name: 'right', keys: ['KeyD'] },
  { name: 'jump', keys: ['Space'] },
  { name: 'toggleView', keys: ['KeyV'] },
  { name: 'runFast', keys: ['ShiftLeft'] },
];

// 전역 STOMP 클라이언트 (Player 컴포넌트 외부에서 접근 가능하도록 let으로 선언)
let stompClient = null;

// 플레이어 ID를 localStorage에서 로드하거나 새로 생성합니다.
// 새로고침해도 동일한 플레이어 ID를 유지하기 위함입니다.
const getOrCreatePlayerId = () => {
  let storedPlayerId = localStorage.getItem('myPlayerId');
  if (!storedPlayerId) {
    storedPlayerId = uuidv4(); // 새 ID 생성
    localStorage.setItem('myPlayerId', storedPlayerId); // 저장
  }
  return storedPlayerId;
};

const currentPlayerId = getOrCreatePlayerId();

// 다른 플레이어를 렌더링하는 컴포넌트
// App.jsx (OtherPlayer 컴포넌트)
// App.jsx (OtherPlayer 컴포넌트 수정)
// App.jsx (OtherPlayer 컴포넌트)
function OtherPlayer({ id, position, rotationY, animationState }) {
    const modelGroupRef = useRef();
    // const previousPosition = useRef(new THREE.Vector3(position.x, position.y, position.z)); // 더 이상 필요 없음

    useFrame(() => {
        if (modelGroupRef.current) {
            // 서버에서 받은 위치로 모델의 위치를 부드럽게 보간합니다.
            // 물리 바디의 중심이 y=0에 있다고 가정하고 모델의 바닥을 맞추기 위한 오프셋입니다.
            modelGroupRef.current.position.lerp(new THREE.Vector3(position.x, position.y - 1.63, position.z), 0.2);

            // 서버에서 받은 회전 값으로 모델의 Y축 회전을 부드럽게 보간합니다.
            modelGroupRef.current.rotation.y = THREE.MathUtils.lerp(modelGroupRef.current.rotation.y, rotationY + Math.PI, 0.2);
        }
    });

    // animationState가 null 또는 undefined일 경우를 대비하여 기본값 {} 설정
    const safeAnimationState = animationState || {};

    return (
        <group ref={modelGroupRef}>
            <CharacterModel2
              {...safeAnimationState}// <-- 이 줄로 모든 것을 대체합니다!
            />
            {/* 다른 플레이어의 ID를 표시하는 텍스트 추가 */}
            <Text
                position={[0, 2.6, 0]}
                fontSize={0.2}
                color="black"
                anchorX="center"
                anchorY="middle"
                billboard
            >
                {id.substring(0, 5)}
            </Text>
        </group>
    );
}

// 현재 플레이어를 제어하고 서버와 통신하는 컴포넌트
function Player({ onHudUpdate }) {
  const { camera, gl, scene } = useThree();
  const [subscribeKeys, getKeys] = useKeyboardControls();
  const [sitToggle, setSitToggle] = useState(false);
  const [lieToggle, setLieToggle] = useState(false);
  const playerRef = useRef();
  const modelRef = useRef();
  const [isGrounded, setIsGrounded] = useState(false);
  const [viewMode, setViewMode] = useState('firstPerson');
  const [isPunching, setIsPunching] = useState(false); // isPunching 상태 추가

  const pitch = useRef(0);
  const yaw = useRef(0);

  const { speed, jumpImpulse } = useControls({
    speed: { value: 5, min: 1, max: 2000 },
    jumpImpulse: { value: 25, min: 0, max: 50 }
  });

  const toggleViewPressed = useRef(false);

  // ======================================================================
  // ===== 웹소켓 연결 및 구독 로직 =====
  // ======================================================================
  useEffect(() => {
    const WS_URL = 'http://localhost:8080/ws';

    const socket = new SockJS(WS_URL);
    stompClient = new Client({
      webSocketFactory: () => socket,
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
    });

    stompClient.onConnect = (frame) => {
      if (stompClient.connected) {
        stompClient.subscribe('/topic/playerLocations', (message) => {
          try {
            const allPlayerPositions = JSON.parse(message.body);
            onHudUpdate(prev => ({
              ...prev,
              otherPlayers: allPlayerPositions
            }));
          } catch (e) {
            console.error("[STOMP Subscribe] Failed to parse player locations message:", e, message.body);
          }
        });

        // 초기 플레이어 등록 메시지 전송
        // playerRef.current가 아직 null일 수 있으므로 초기 위치는 {x:0, y:0, z:0}으로 설정
        // 애니메이션 상태도 초기값으로 포함
        const initialPlayerState = {
          id: currentPlayerId,
          position: { x: 0, y: 0, z: 0 },
          rotationY: yaw.current + Math.PI,
          animationState: {
            isWalking: false,
            isBackward: false,
            isLeft: false,
            isRight: false,
            isJumping: false,
            isRunning: false,
            isSitted: false,
            isSittedAndWalk: false,
            isLyingDown: false,
            isLyingDownAndWalk: false,
            isPunching: false,
            isIdle: true // 초기에는 Idle 상태
          }
        };
        stompClient.publish({
          destination: '/app/registerPlayer',
          body: JSON.stringify(initialPlayerState)
        });
      } else {
        console.warn('[STOMP] onConnect triggered, but stompClient.connected is false. This might be a race condition. Will rely on reconnect logic.');
      }
    };

    stompClient.onStompError = (frame) => {
      console.error('STOMP Error:', frame);
    };

    stompClient.onDisconnect = () => {
      // console.log('[STOMP] Explicitly disconnected from WebSocket.');
    };

    stompClient.activate();

    return () => {
      const handleBeforeUnload = () => {
        if (stompClient && stompClient.connected) {
          stompClient.publish({ destination: '/app/unregisterPlayer', body: JSON.stringify({ id: currentPlayerId }) });
          stompClient.deactivate();
        }
      };
      window.addEventListener('beforeunload', handleBeforeUnload);

      if (stompClient && stompClient.connected) {
        stompClient.publish({ destination: '/app/unregisterPlayer', body: JSON.stringify({ id: currentPlayerId }) });
        stompClient.deactivate();
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []); // 빈 배열: 컴포넌트 마운트 시 한 번만 실행

  // 'C' (앉기) 및 'Z' (눕기) 토글 로직
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'KeyC') {
        setSitToggle(prev => {
          const next = !prev;
          if (next) setLieToggle(false); // C가 켜질 경우 Z 끔
          return next;
        });
      }
      if (e.code === 'KeyZ') {
        setLieToggle(prev => {
          const next = !prev;
          if (next) setSitToggle(false); // Z가 켜질 경우 C 끔
          return next;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 마우스 클릭 (펀치) 로직
  useEffect(() => {
    const handleMouseDown = (e) => {
      if (e.button === 0) setIsPunching(true); // 좌클릭
    };
    const handleMouseUp = (e) => {
      if (e.button === 0) setIsPunching(false);
    };

    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // 뷰 모드 전환 (1인칭/3인칭) 로직
  useEffect(() => {
    const unsubscribe = subscribeKeys(
      (s) => s.toggleView,
      (pressed) => {
        if (pressed && !toggleViewPressed.current) {
          setViewMode((prev) => (prev === 'firstPerson' ? 'thirdPerson' : 'firstPerson'));
        }
        toggleViewPressed.current = pressed;
      }
    );
    return () => unsubscribe();
  }, [subscribeKeys]);

  // 마우스 움직임으로 카메라 회전 로직
  const onMouseMove = useCallback((e) => {
    yaw.current -= e.movementX * 0.002;

    if (viewMode === 'firstPerson') {
      pitch.current -= e.movementY * 0.002;
    } else {
      pitch.current += e.movementY * 0.002;
    }

    pitch.current = THREE.MathUtils.clamp(pitch.current, -Math.PI / 2 + 0.1, Math.PI / 2 - 0.1);
  }, [viewMode]);

  // 캔버스 클릭 시 포인터 락 요청 로직
  useEffect(() => {
    const canvas = gl.domElement;
    const requestPointerLock = () => { canvas.requestPointerLock(); };
    canvas.addEventListener('click', requestPointerLock);
    return () => { canvas.removeEventListener('click', requestPointerLock); };
  }, [gl]);

  // 포인터 락 상태 변경 감지 및 마우스 이벤트 리스너 추가/제거 로직
  useEffect(() => {
    const canvas = gl.domElement;
    const handlePointerLockChange = () => {
      if (document.pointerLockElement === canvas) {
        document.addEventListener('mousemove', onMouseMove);
      } else {
        document.removeEventListener('mousemove', onMouseMove);
      }
    };
    if (document.pointerLockElement === canvas) {
      document.addEventListener('mousemove', onMouseMove);
    }
    document.addEventListener('pointerlockchange', handlePointerLockChange);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
    };
  }, [onMouseMove]);

  // 매 프레임마다 플레이어 움직임 및 서버 업데이트 로직
  useFrame(() => {
    const keys = getKeys();

    
    const vel = playerRef.current?.linvel() || { x: 0, y: 0, z: 0 };
    const pos = playerRef.current?.translation() || { x: 0, y: 0, z: 0 };

    // 플레이어 위치 및 애니메이션 정보 서버로 전송 (멀티플레이어 핵심)
    if (stompClient && stompClient.connected) {
      const playerState = {
        id: currentPlayerId,
        position: { x: pos.x, y: pos.y, z: pos.z },
        rotationY: yaw.current + Math.PI, // 3D 모델의 정면을 맞추기 위한 회전 보정
        animationState: {
          isWalking: keys.forward,
          isBackward: keys.backward,
          isLeft: keys.left,
          isRight: keys.right,
          isJumping: keys.jump,
          isRunning: keys.runFast && (keys.forward || keys.left || keys.right || keys.backward),
          isSitted: sitToggle,
          isSittedAndWalk: sitToggle && (keys.forward || keys.left || keys.right || keys.backward),
          isLyingDown: lieToggle,
          isLyingDownAndWalk: lieToggle && (keys.forward || keys.left || keys.right || keys.backward),
          isPunching: isPunching,
          // 모든 액션이 아닐 때만 Idle
          isIdle: !(keys.forward || keys.backward || keys.left || keys.right || keys.jump || keys.runFast || isPunching) && !sitToggle && !lieToggle
        }
      };
      stompClient.publish({
        destination: `/app/playerMove`,
        body: JSON.stringify(playerState)
      });
    }

    // 플레이어 이동 로직
    const cameraOrientationQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw.current, 0));
    const forwardVector = new THREE.Vector3(0, 0, 1).applyQuaternion(cameraOrientationQ).normalize();
    const rightVector = new THREE.Vector3().crossVectors(forwardVector, new THREE.Vector3(0, 1, 0)).normalize();
    let actualSpeed = speed;

    if (sitToggle && (keys.forward || keys.backward || keys.left || keys.right)) {
      actualSpeed = Math.max(speed * 0.5, 1.5); // 앉은 채 이동
    } else if (lieToggle && (keys.forward || keys.backward || keys.left || keys.right)) {
      actualSpeed = Math.max(speed * 0.15, 1.2); // 누운 채 이동
    } else if (keys.runFast && (keys.forward || keys.backward || keys.left || keys.right)) {
      actualSpeed = speed + 2; // 달리기
    }

    let vx = 0, vz = 0;

    if (keys.forward) {
      vx += forwardVector.x * actualSpeed;
      vz += forwardVector.z * actualSpeed;
    }
    if (keys.backward) {
      vx -= forwardVector.x * actualSpeed;
      vz -= forwardVector.z * actualSpeed;
    }
    if (keys.left) {
      vx -= rightVector.x * actualSpeed;
      vz -= rightVector.z * actualSpeed;
    }
    if (keys.right) {
      vx += rightVector.x * actualSpeed;
      vz += rightVector.z * actualSpeed;
    }

    playerRef.current.setLinvel({ x: vx, y: vel.y, z: vz }, true);

    // 점프 로직
    if (keys.jump && isGrounded && vel.y <= 0.1) {
      playerRef.current.applyImpulse({ x: 0, y: jumpImpulse, z: 0 }, true);
      setIsGrounded(false);
    }

    const playerBodyPos = new THREE.Vector3(pos.x, pos.y, pos.z);
    const headOffset = new THREE.Vector3(0, 0.3, 0);

    // 3인칭 모델 위치 및 회전 업데이트
    if (modelRef.current) {
      modelRef.current.position.copy(playerBodyPos);
      modelRef.current.position.y += -0.725; // Rapier의 RigidBody 중심과 캡슐 모델의 바닥을 맞추기 위한 오프셋
      modelRef.current.visible = viewMode === 'thirdPerson'; // 3인칭일 때만 모델 보이기

      const horizontalMovementLengthSq = vx * vx + vz * vz;
      if (horizontalMovementLengthSq > 0.01) {
        const targetRotationY = Math.atan2(vx, vz);
        modelRef.current.rotation.y = THREE.MathUtils.lerp(modelRef.current.rotation.y, targetRotationY, 0.15);
      } else {
        modelRef.current.rotation.y = THREE.MathUtils.lerp(modelRef.current.rotation.y, yaw.current, 0.15);
      }
    }

    // 카메라 위치 및 회전 업데이트 (1인칭/3인칭 뷰)
    if (viewMode === 'firstPerson') {
      const cameraPosition = playerBodyPos.clone().add(headOffset);
      camera.position.copy(cameraPosition);
      const cameraRotation = new THREE.Euler(pitch.current, yaw.current + Math.PI, 0, 'YXZ');
      camera.quaternion.setFromEuler(cameraRotation);
    } else { // Third-person camera (3인칭 카메라)
      const dist = 5;
      const phi = Math.PI / 2 - pitch.current;
      const theta = yaw.current + Math.PI;

      const camX = dist * Math.sin(phi) * Math.sin(theta);
      const camY = dist * Math.cos(phi);
      const camZ = dist * Math.sin(phi) * Math.cos(theta);

      const camPos = new THREE.Vector3(playerBodyPos.x + camX, playerBodyPos.y + 1 + camY, playerBodyPos.z + camZ);
      camera.position.copy(camPos);

      camera.lookAt(playerBodyPos.x, playerBodyPos.y + 1, playerBodyPos.z);
    }

    // HUD 상태 업데이트
    onHudUpdate?.(prev => ({
      ...prev,
      viewMode,
      isGrounded,
      position: `(${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`,
      velocity: `(${vel.x.toFixed(2)}, ${vel.y.toFixed(2)}, ${vel.z.toFixed(2)})`,
      yaw: yaw.current,
      pitch: pitch.current,
      keys,
    }));
  });

  const keys = getKeys();

  return (
    <>
      <RigidBody
        ref={playerRef}
        position={[0, 1.1, 0]}
        colliders={false}
        enabledRotations={[false, false, false]}
        onCollisionEnter={() => setIsGrounded(true)}
        onCollisionExit={() => setIsGrounded(false)}
      >
        <CapsuleCollider args={[0.35, 0.4]} />
      </RigidBody>

      <CharacterModel
        ref={modelRef}
        isWalking={keys.forward}
        isBackward={keys.backward}
        isLeft={keys.left}
        isRight={keys.right}
        isJumping={keys.jump}
        isRunning={keys.runFast && (keys.forward || keys.left || keys.right || keys.backward)}
        isSittedAndWalk={sitToggle && (keys.forward || keys.left || keys.right || keys.backward)}
        isSitted={sitToggle}
        isLyingDownAndWalk={lieToggle && (keys.forward || keys.left || keys.right || keys.backward)}
        isLyingDown={lieToggle}
        isIdle={!(keys.forward || keys.backward || keys.left || keys.right || keys.jump || keys.runFast || isPunching) && !sitToggle && !lieToggle}
        isPunching={isPunching}
      />
    </>
  );
}

// 플레이어 HUD (Head-Up Display) 컴포넌트
function PlayerHUD({ state }) {
  const otherPlayersInfo = state.otherPlayers ? Object.values(state.otherPlayers)
    .filter(p => p.id !== currentPlayerId)
    .map(p => `ID: ${p.id.substring(0, 5)}, Pos: (${p.position.x.toFixed(1)}, ${p.position.y.toFixed(1)}, ${p.position.z.toFixed(1)})`)
    .join('\n') : 'N/A';

  return (
    <div style={{
      position: 'absolute',
      top: 20,
      left: 20,
      color: 'white',
      fontSize: 14,
      backgroundColor: 'rgba(0,0,0,0.8)',
      padding: 10,
      borderRadius: 8,
      zIndex: 100
    }}>
      <div><strong>Current Player ID:</strong> {currentPlayerId.substring(0, 5)}</div>
      <div><strong>View:</strong> {state.viewMode}</div>
      <div><strong>isGrounded:</strong> {state.isGrounded ? '✅' : '❌'}</div>
      <div><strong>Position:</strong> {state.position}</div>
      <div><strong>Velocity:</strong> {state.velocity}</div>
      <div><strong>Yaw:</strong> {state.yaw?.toFixed(2) ?? 'N/A'}</div>
      <div><strong>Pitch:</strong> {state.pitch?.toFixed(2) ?? 'N/A'}</div>
      <div><strong>Keys:</strong> {state.keys ? Object.entries(state.keys).filter(([, v]) => v).map(([k]) => k).join(', ') : 'N/A'}</div>
      <br />
      <div><strong>-- Other Players --</strong></div>
      {state.otherPlayers && Object.values(state.otherPlayers).filter(p => p.id !== currentPlayerId).length > 0 &&
        <div>Total Other Players: {Object.values(state.otherPlayers).filter(p => p.id !== currentPlayerId).length}</div>
      }
      <pre style={{ whiteSpace: 'pre-wrap' }}>{otherPlayersInfo || "No other players"}</pre>
    </div>
  );
}

// 메인 App 컴포넌트
export default function App() {
  const [hudState, setHudState] = useState({});

  return (
    <>
      <Leva collapsed={false} />
      <PlayerHUD state={hudState} />

      <KeyboardControls map={controlsMap}>
        <Canvas shadows camera={{ fov: 60, position: [0, 5, 10] }} style={{ width: '100vw', height: '100vh' }}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 10, 5]} intensity={1} castShadow />
          <Physics gravity={[0, -9.81, 0]}>
            {/* 바닥 (고정된 물리 객체) */}
            <RigidBody type="fixed">
              <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <planeGeometry args={[100, 100]} />
                <meshStandardMaterial color="gray" />
              </mesh>
            </RigidBody>

            {/* 맵 경계 벽들 (투명한 고정 물리 객체) */}
            <RigidBody type="fixed" position={[0, 500, -50]}>
              <mesh>
                <boxGeometry args={[100, 1000, 1]} />
                <meshStandardMaterial transparent opacity={0} />
              </mesh>
            </RigidBody>
            <RigidBody type="fixed" position={[0, 500, 50]}>
              <mesh>
                <boxGeometry args={[100, 1000, 1]} />
                <meshStandardMaterial transparent opacity={0} />
              </mesh>
            </RigidBody>
            <RigidBody type="fixed" position={[50, 500, 0]}>
              <mesh>
                <boxGeometry args={[1, 1000, 100]} />
                <meshStandardMaterial transparent opacity={0} />
              </mesh>
            </RigidBody>
            <RigidBody type="fixed" position={[-50, 500, 0]}>
              <mesh>
                <boxGeometry args={[1, 1000, 100]} />
                <meshStandardMaterial transparent opacity={0} />
              </mesh>
            </RigidBody>

            {/* 물리 상호작용을 위한 박스 오브젝트들 */}
            <RigidBody position={[0, 0.5, -5]} colliders="cuboid"><mesh castShadow receiveShadow><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="hotpink" /></mesh></RigidBody>
            <RigidBody position={[3, 0.5, 0]} colliders="cuboid"><mesh castShadow receiveShadow><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="lightgreen" /></mesh></RigidBody>
            <RigidBody position={[-3, 0.5, 0]} colliders="cuboid"><mesh castShadow receiveShadow><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="lightblue" /></mesh></RigidBody>
            <RigidBody position={[0, 0.5, 3]} colliders="cuboid"><mesh castShadow receiveShadow><boxGeometry args={[1, 1, 1]} /><meshStandardMaterial color="orange" /></mesh></RigidBody>

            {/* 물리 상호작용을 위한 구체 오브젝트들 */}
            <RigidBody position={[5, 1.5, -5]} colliders="ball"><mesh castShadow receiveShadow><sphereGeometry args={[1, 32, 32]} /><meshStandardMaterial color="purple" /></mesh></RigidBody>
            <RigidBody position={[-5, 2.5, 5]} colliders="ball"><mesh castShadow receiveShadow><sphereGeometry args={[1.5, 32, 32]} /><meshStandardMaterial color="cyan" /></mesh></RigidBody>
            <RigidBody position={[0, 3.5, 7]} colliders="ball"><mesh castShadow receiveShadow><sphereGeometry args={[0.8, 32, 32]} /><meshStandardMaterial color="gold" /></mesh></RigidBody>
            <RigidBody position={[8, 1, 0]} colliders="ball"><mesh castShadow receiveShadow><sphereGeometry args={[0.6, 32, 32]} /><meshStandardMaterial color="red" /></mesh></RigidBody>
            <RigidBody position={[-8, 1, -8]} colliders="ball"><mesh castShadow receiveShadow><sphereGeometry args={[1.2, 32, 32]} /><meshStandardMaterial color="lime" /></mesh></RigidBody>

            {/* 현재 플레이어 컴포넌트 */}
            <Player onHudUpdate={setHudState} />

            {/* 다른 플레이어들 렌더링 */}
            {hudState.otherPlayers && Object.values(hudState.otherPlayers).map((player) => (
              // 현재 플레이어 자신은 OtherPlayer로 렌더링하지 않도록 필터링
              player.id !== currentPlayerId && (
                <OtherPlayer
                  key={player.id}
                  id={player.id}
                  position={player.position}
                  rotationY={player.rotationY}
                  animationState={player.animationState} // 이 부분이 서버에서 받은 애니메이션 상태를 OtherPlayer로 전달합니다.
                />
              )
            ))}
          </Physics>
        </Canvas>
      </KeyboardControls>
    </>
  );
}
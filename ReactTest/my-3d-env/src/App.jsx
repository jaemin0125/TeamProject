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
];

// 전역 STOMP 클라이언트 (Player 컴포넌트 외부에서 접근 가능하도록 let으로 선언)
let stompClient = null;

// 플레이어 ID를 localStorage에서 로드하거나 새로 생성합니다.
// 새로고침해도 동일한 플레이어 ID를 유지하기 위함입니다.
// 주의: 여러 브라우저 탭/창에서 같은 플레이어 ID를 갖게 되어 멀티플레이 테스트 시 오해의 소지가 있습니다.
// 각 탭이 고유한 플레이어가 되도록 하려면 `const currentPlayerId = uuidv4();` 를 직접 사용해야 합니다.
const getOrCreatePlayerId = () => {
  let storedPlayerId = localStorage.getItem('myPlayerId');
  if (!storedPlayerId) {
    storedPlayerId = uuidv4(); // 새 ID 생성
    localStorage.setItem('myPlayerId', storedPlayerId); // 저장
    //console.log("New player ID generated and stored:", storedPlayerId);
  } else {
    //console.log("Existing player ID loaded:", storedPlayerId);
  }
  return storedPlayerId;
};

const currentPlayerId = getOrCreatePlayerId();

// 다른 플레이어를 렌더링하는 컴포넌트
function OtherPlayer({ id, position, rotationY }) {
  const meshGroupRef = useRef(); // 메시와 텍스트를 담을 그룹에 대한 참조

  useFrame(() => {
    // meshGroupRef.current가 존재하는지 확인하고, 서버에서 받은 위치와 회전으로 부드럽게 보간(lerp)합니다.
    if (meshGroupRef.current) {
      meshGroupRef.current.position.lerp(new THREE.Vector3(position.x, position.y - 0.725, position.z), 0.2);
      meshGroupRef.current.rotation.y = THREE.MathUtils.lerp(meshGroupRef.current.rotation.y, rotationY, 0.2);
    }
  });

  // 플레이어마다 고유한 색상 부여 (재렌더링 시에도 동일한 색상 유지)
  const color = useMemo(() => new THREE.Color().setHSL(Math.random(), 0.7, 0.5), []);

  return (
    <group ref={meshGroupRef}> {/* 메시와 텍스트를 묶을 그룹 */}
      <mesh>
        <capsuleGeometry args={[0.35, 0.75, 8, 16]} />
        <meshStandardMaterial color={color} />
      </mesh>
      {/* 플레이어 ID 텍스트 */}
      <Text
        position={[0, 1.0, 0]} // 캡슐 상단에 위치하도록 조정
        fontSize={0.2}
        color="black"
        anchorX="center"
        anchorY="middle"
        outlineColor="white"
        outlineWidth={0.01}
      >
        {id.substring(0, 5)} {/* ID의 앞 5자리만 표시 */}
      </Text>
    </group>
  );
}

// 현재 플레이어를 제어하고 서버와 통신하는 컴포넌트
function Player({ onHudUpdate }) {
  const { camera, gl, scene } = useThree(); // Three.js 카메라 및 WebGL 렌더러 인스턴스 가져오기
  const [subscribeKeys, getKeys] = useKeyboardControls(); // 키보드 입력 상태 구독
  const playerRef = useRef(); // 물리 객체 (Rapier RigidBody) 참조
  const modelRef = useRef(); // 플레이어 3D 모델(메쉬) 참조
  const [isGrounded, setIsGrounded] = useState(false); // 플레이어의 착지 상태
  const [viewMode, setViewMode] = useState('firstPerson'); // 카메라 뷰 모드: 'firstPerson' 또는 'thirdPerson'
  const pitch = useRef(0); // 카메라 상하 회전 (피치)
  const yaw = useRef(0);   // 카메라 좌우 회전 (요)

  const [jumpImpulse] = useState(30); // 점프 힘 상수
  // Leva를 사용하여 이동 속도 제어 UI 제공
  const { speed } = useControls({ speed: { value: 5, min: 1, max: 20 } });

  const toggleViewPressed = useRef(false); // 'V' 키 중복 입력 방지 플래그

  // modelRef는 플레이어의 3D 모델 그룹을 참조합니다.
  // 이 그룹은 플레이어의 위치 및 회전과 동기화됩니다.
  // useEffect 대신 직접 JSX에서 렌더링하고 ref를 연결합니다.
  // useFrame에서 modelRef.current의 위치/회전을 직접 업데이트합니다.

  // ======================================================================
  // ===== 웹소켓 연결 및 구독 로직 =====
  // 이 useEffect는 컴포넌트 마운트 시 한 번만 실행되며, 클린업 함수를 통해 연결을 정리합니다.
  // ======================================================================
  useEffect(() => {
    const WS_URL = 'http://localhost:8080/ws'; // Spring Boot WebSocket 엔드포인트와 일치

    const socket = new SockJS(WS_URL);
    stompClient = new Client({
      webSocketFactory: () => socket,
      // debug: (str) => { console.log('STOMP Debug:', str); }, // STOMP 디버그 로그 (필요 시 주석 해제)
      reconnectDelay: 5000, // 연결 끊어졌을 때 5초 후 재연결 시도
      heartbeatIncoming: 4000, // 서버로부터 4초마다 하트비트 기대
      heartbeatOutgoing: 4000, // 클라이언트에서 4초마다 하트비트 전송
    });

    stompClient.onConnect = (frame) => {
      //console.log('[STOMP] Connected to WebSocket:', frame);

      // 중요: STOMP 연결이 '완전히' 확립되었을 때만 메시지 전송 및 구독을 시도합니다.
      if (stompClient.connected) {
        stompClient.subscribe('/topic/playerLocations', (message) => {
          try {
            const allPlayerPositions = JSON.parse(message.body);
            //console.log('[STOMP Subscribe] Received player locations:', allPlayerPositions); // Debug: 수신된 플레이어 위치 확인
            onHudUpdate(prev => ({
              ...prev,
              otherPlayers: allPlayerPositions
            }));
          } catch (e) {
            console.error("[STOMP Subscribe] Failed to parse player locations message:", e, message.body);
          }
        });

        const initialPlayerState = {
          id: currentPlayerId,
          // playerRef.current가 아직 null일 수 있으므로 기본값 0,0,0 사용
          position: { x: playerRef.current?.translation().x || 0, y: playerRef.current?.translation().y || 0, z: playerRef.current?.translation().z || 0 },
          rotationY: yaw.current + Math.PI // 3D 모델의 정면을 맞추기 위한 보정
        };
        //console.log('[STOMP Publish] Sending initial player registration:', initialPlayerState); // Debug: 등록 메시지 확인
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
      //console.log('[STOMP] Explicitly disconnected from WebSocket.');
    };

    stompClient.activate();

    return () => {
      const handleBeforeUnload = () => {
        if (stompClient && stompClient.connected) {
          //console.log("[App Cleanup] Sending DISCONNECT frame before page unload.");
          stompClient.publish({ destination: '/app/unregisterPlayer', body: JSON.stringify({ id: currentPlayerId }) });
          stompClient.deactivate();
        }
      };
      window.addEventListener('beforeunload', handleBeforeUnload);

      if (stompClient && stompClient.connected) {
        //console.log('[App Cleanup] Disconnecting STOMP client on component unmount.');
        stompClient.publish({ destination: '/app/unregisterPlayer', body: JSON.stringify({ id: currentPlayerId }) });
        stompClient.deactivate();
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []); // 빈 배열: 컴포넌트 마운트 시 한 번만 실행 (Player Ref가 없을 수 있으므로 초기 위치는 0,0,0으로 설정)

  // 뷰 모드 전환 (1인칭/3인칭) 로직
  useEffect(() => {
    const unsubscribe = subscribeKeys(
      (s) => s.toggleView, // 'V' 키 감지
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
    yaw.current -= e.movementX * 0.002; // 좌우 회전 (Yaw)

    // 뷰 모드에 따라 상하 회전(Pitch) 방향 조절
    if (viewMode === 'firstPerson') {
      pitch.current -= e.movementY * 0.002;
    } else {
      pitch.current += e.movementY * 0.002;
    }

    // 피치 값 클램핑 (상하로 너무 많이 회전하지 않도록 제한)
    pitch.current = THREE.MathUtils.clamp(pitch.current, -Math.PI / 2 + 0.1, Math.PI / 2 - 0.1);
  }, [viewMode]);

  // 캔버스 클릭 시 포인터 락 요청 로직
  useEffect(() => {
    const canvas = gl.domElement;
    const requestPointerLock = () => { canvas.requestPointerLock(); };
    canvas.addEventListener('click', requestPointerLock); // 캔버스 클릭 시 포인터 락 요청
    return () => { canvas.removeEventListener('click', requestPointerLock); };
  }, [gl]);

  // 포인터 락 상태 변경 감지 및 마우스 이벤트 리스너 추가/제거 로직
  useEffect(() => {
    const canvas = gl.domElement;
    const handlePointerLockChange = () => {
      if (document.pointerLockElement === canvas) {
        // 포인터 락 활성화 시 마우스 이동 이벤트 리스너 추가
        document.addEventListener('mousemove', onMouseMove);
      } else {
        // 포인터 락 해제 시 마우스 이동 이벤트 리스너 제거
        document.removeEventListener('mousemove', onMouseMove);
      }
    };
    // 초기 포인터 락 상태를 확인하여 리스너 설정
    if (document.pointerLockElement === canvas) {
      document.addEventListener('mousemove', onMouseMove);
    }
    document.addEventListener('pointerlockchange', handlePointerLockChange); // 포인터 락 상태 변경 이벤트 리스너 추가
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
    };
  }, [onMouseMove]);

  // 매 프레임마다 플레이어 움직임 및 서버 업데이트 로직
  useFrame(() => {
    const keys = getKeys(); // 현재 눌려진 키 상태 가져오기
    const vel = playerRef.current?.linvel() || { x: 0, y: 0, z: 0 }; // 플레이어의 현재 선형 속도
    const pos = playerRef.current?.translation() || { x: 0, y: 0, z: 0 }; // 플레이어의 현재 위치

    // 플레이어 위치 정보 서버로 전송 (멀티플레이어 핵심)
    // STOMP 클라이언트가 연결되어 있을 때만 메시지를 보냅니다.
    // 너무 잦은 업데이트는 네트워크 부하를 줄 수 있으므로, 실제 게임에서는 주기적으로 또는
    // 플레이어의 상태가 유의미하게 변경되었을 때만 보내는 최적화가 필요합니다.
    if (stompClient && stompClient.connected) {
      const playerState = {
        id: currentPlayerId,
        position: { x: pos.x, y: pos.y, z: pos.z },
        rotationY: yaw.current + Math.PI // 3D 모델의 정면을 맞추기 위한 회전 보정
      };
      // GameController의 @MessageMapping("/playerMove")와 매핑됩니다.
      stompClient.publish({
        destination: `/app/playerMove`,
        body: JSON.stringify(playerState)
      });
    }

    // 플레이어 이동 로직
    // 카메라 방향에 기반하여 이동 벡터 계산
    const cameraOrientationQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw.current, 0));
    const forwardVector = new THREE.Vector3(0, 0, 1).applyQuaternion(cameraOrientationQ).normalize();
    const rightVector = new THREE.Vector3().crossVectors(forwardVector, new THREE.Vector3(0, 1, 0)).normalize();

    let vx = 0, vz = 0;
    if (keys.forward) { vx += forwardVector.x * speed; vz += forwardVector.z * speed; }
    if (keys.backward) { vx -= forwardVector.x * speed; vz -= forwardVector.z * speed; }
    if (keys.left) { vx -= rightVector.x * speed; vz -= rightVector.z * speed; }
    if (keys.right) { vx += rightVector.x * speed; vz += rightVector.z * speed; }
    playerRef.current.setLinvel({ x: vx, y: vel.y, z: vz }, true); // 플레이어의 선형 속도 설정

    // 점프 로직
    if (keys.jump && isGrounded && vel.y <= 0.1) {
      playerRef.current.applyImpulse({ x: 0, y: jumpImpulse, z: 0 }, true); // 점프 힘 적용
      setIsGrounded(false); // 점프 후 착지 상태 해제
    }

    const playerBodyPos = new THREE.Vector3(pos.x, pos.y, pos.z);
    const headOffset = new THREE.Vector3(0, 0.3, 0); // 카메라 또는 모델의 머리 위치 오프셋

    // 3인칭 모델 위치 및 회전 업데이트
    if (modelRef.current) {
      modelRef.current.position.copy(playerBodyPos);
      modelRef.current.position.y += -0.725; // Rapier의 RigidBody 중심과 캡슐 모델의 바닥을 맞추기 위한 오프셋
      modelRef.current.visible = viewMode === 'thirdPerson'; // 3인칭일 때만 모델 보이기

      const horizontalMovementLengthSq = vx * vx + vz * vz;
      if (horizontalMovementLengthSq > 0.01) {
          // 움직일 때만 모델 방향을 이동 방향으로 회전
          const targetRotationY = Math.atan2(vx, vz) + Math.PI; // Three.js Y축 회전 보정
          modelRef.current.rotation.y = THREE.MathUtils.lerp(modelRef.current.rotation.y, targetRotationY, 0.15);
      } else {
          // 멈췄을 때는 카메라 방향으로 모델 회전
          modelRef.current.rotation.y = yaw.current + Math.PI; // Three.js Y축 회전 보정
      }
    }

    // 카메라 위치 및 회전 업데이트 (1인칭/3인칭 뷰)
    if (viewMode === 'firstPerson') {
      const cameraPosition = playerBodyPos.clone().add(headOffset);
      camera.position.copy(cameraPosition);
      const cameraRotation = new THREE.Euler(pitch.current, yaw.current + Math.PI, 0, 'YXZ'); // YXZ 순서로 오일러 각 적용
      camera.quaternion.setFromEuler(cameraRotation);
    } else { // Third-person camera (3인칭 카메라)
      const dist = 5; // 카메라와 플레이어 간의 거리
      const phi = Math.PI / 2 - pitch.current; // 구면 좌표계 phi (위도)
      const theta = yaw.current + Math.PI; // 구면 좌표계 theta (경도)

      // 구면 좌표를 직교 좌표로 변환하여 카메라 위치 계산
      const camX = dist * Math.sin(phi) * Math.sin(theta);
      const camY = dist * Math.cos(phi);
      const camZ = dist * Math.sin(phi) * Math.cos(theta);

      const camPos = new THREE.Vector3(playerBodyPos.x + camX, playerBodyPos.y + 1 + camY, playerBodyPos.z + camZ);
      camera.position.copy(camPos);

      camera.lookAt(playerBodyPos.x, playerBodyPos.y + 1, playerBodyPos.z); // 카메라가 플레이어를 바라보도록 설정
    }

    // HUD 상태 업데이트 (prop으로 전달된 onHudUpdate 함수 사용)
    onHudUpdate?.(prev => ({
      ...prev, // 기존 hudState 유지 (otherPlayers는 WebSocket Subscribe에서 업데이트됨)
      viewMode,
      isGrounded,
      position: `(${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`,
      velocity: `(${vel.x.toFixed(2)}, ${vel.y.toFixed(2)}, ${vel.z.toFixed(2)})`,
      yaw: yaw.current,
      pitch: pitch.current,
      keys,
    }));
  });

  return (
    <>
      {/* 현재 플레이어 물리 RigidBody (Rapier 물리 엔진) */}
      <RigidBody
        ref={playerRef}
        position={[0, 1.1, 0]} // 초기 위치 (지면에서 약간 위)
        colliders={false} // RigidBody 자체 콜라이더 비활성화 (CapsuleCollider를 직접 추가할 것임)
        enabledRotations={[false, false, false]} // 플레이어는 회전하지 않음 (카메라만 회전 제어)
        onCollisionEnter={() => setIsGrounded(true)} // 다른 객체와 충돌 시 착지 상태 활성화
        onCollisionExit={() => setIsGrounded(false)} // 충돌 해제 시 착지 상태 비활성화
      >
        <CapsuleCollider args={[0.35, 0.75]} /> {/* 플레이어 충돌체 (캡슐 형태) */}
      </RigidBody>

      {/* 현재 플레이어의 3D 모델 (3인칭 뷰에서만 보임) */}
      <group ref={modelRef}>
        <mesh position={[0, -0.725, 0]}> {/* 캡슐의 중심을 Rapier 물리 바디에 맞추기 위한 Y 오프셋 */}
          <capsuleGeometry args={[0.35, 0.75, 8, 16]} />
          <meshStandardMaterial color={'#00f'} /> {/* 플레이어 모델의 색상 (파란색) */}
        </mesh>
        {/* 플레이어 ID 텍스트 */}
        <Text
          position={[0, 1.0, 0]} // 캡슐 상단에 위치하도록 조정
          fontSize={0.2}
          color="black"
          anchorX="center"
          anchorY="middle"
          outlineColor="white"
          outlineWidth={0.01}
        >
          {currentPlayerId.substring(0, 5)} {/* ID의 앞 5자리만 표시 */}
        </Text>
      </group>
    </>
  );
}

// 플레이어 HUD (Head-Up Display) 컴포넌트
function PlayerHUD({ state }) {
  // 다른 플레이어 정보를 필터링하고 포맷팅하여 표시
  const otherPlayersInfo = state.otherPlayers ? Object.values(state.otherPlayers)
    .filter(p => p.id !== currentPlayerId) // 자기 자신 제외
    .map(p => `ID: ${p.id.substring(0, 5)}, Pos: (${p.position.x.toFixed(1)}, ${p.position.y.toFixed(1)}, ${p.position.z.toFixed(1)})`)
    .join('\n') : 'N/A';

  return (
    <div style={{
      position: 'absolute',
      top: 20,
      left: 20,
      color: 'white',
      fontSize: 14,
      backgroundColor: 'rgba(0,0,0,0.8)', // 반투명 배경
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
      <br/>
      <div><strong>-- Other Players --</strong></div>
      {state.otherPlayers && Object.values(state.otherPlayers).length > 1 &&
        <div>Total Other Players: {Object.values(state.otherPlayers).filter(p => p.id !== currentPlayerId).length}</div>
      }
      <pre style={{ whiteSpace: 'pre-wrap' }}>{otherPlayersInfo || "No other players"}</pre>
    </div>
  );
}

// 메인 App 컴포넌트
export default function App() {
  const [hudState, setHudState] = useState({}); // HUD에 표시할 상태

  useEffect(() => {
    if (hudState.otherPlayers) {
      //console.log('[App] hudState.otherPlayers updated:', hudState.otherPlayers);
      //console.log('[App] Number of players in hudState.otherPlayers:', hudState.otherPlayers.length);
      //hudState.otherPlayers.forEach(p => (`  - HUD Player ID: ${p.id.substring(0,5)}, SessionID: ${p.sessionId?.substring(0,5) ?? 'N/A'}, Pos: (${p.position.x.toFixed(1)}, ${p.position.y.toFixed(1)}, ${p.position.z.toFixed(1)})`));
    }
  }, [hudState.otherPlayers]);


  return (
    <>
      <Leva collapsed={false} /> {/* Leva 디버그 UI */}
      <PlayerHUD state={hudState} /> {/* 플레이어 상태 HUD */}

      <KeyboardControls map={controlsMap}> {/* 키보드 컨트롤 래퍼 */}
        <Canvas shadows camera={{ fov: 60, position: [0, 5, 10] }} style={{ width: '100vw', height: '100vh' }}>
          <ambientLight intensity={0.5} /> {/* 주변광 */}
          <directionalLight position={[5, 10, 5]} intensity={1} castShadow /> {/* 방향광 (그림자 드리움) */}
          <Physics gravity={[0, -9.81, 0]}> {/* Rapier 물리 엔진 활성화, 중력 설정 */}
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
                  key={player.id} // React는 리스트 렌더링 시 고유한 key를 필요로 합니다.
                  id={player.id}
                  position={player.position}
                  rotationY={player.rotationY}
                />
              )
            ))}
          </Physics>
        </Canvas>
      </KeyboardControls>
    </>
  );
}

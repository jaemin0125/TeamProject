// src/App.jsx
import React, { useRef, useMemo, useEffect, useState, useCallback } from 'react';

import { Canvas, useFrame, useThree } from '@react-three/fiber';
import {
  PerspectiveCamera,
  Box, Sphere, Plane, Cylinder, Torus, Cone, Capsule, Ring,
  KeyboardControls, useKeyboardControls, Text
} from '@react-three/drei';

import {
  Physics,
  RigidBody,
  CuboidCollider,
  BallCollider,
  CylinderCollider,
  ConeCollider,
  CapsuleCollider,
} from '@react-three/rapier';

import * as THREE from 'three';

import './index.css';

const controls = {
  forward: 'forward',
  backward: 'backward',
  left: 'left',
  right: 'right',
  jump: 'jump',
  toggleView: 'toggleView',
  toggleSecondPerson: 'toggleSecondPerson',
};

function OnlinePlayer({ id, position, rotationYaw, viewMode }) {
  const playerRef = useRef();
  const rotationQuaternion = useMemo(() => new THREE.Quaternion(), []);

  useFrame(() => {
    rotationQuaternion.setFromEuler(new THREE.Euler(0, rotationYaw, 0, 'YXZ'));
    if (playerRef.current) {
        playerRef.current.position.set(position.x, position.y, position.z);
        playerRef.current.quaternion.copy(rotationQuaternion);
    }
  });

  return (
    <RigidBody type="fixed" colliders={false} position={[position.x, position.y, position.z]} rotation={[0, rotationYaw, 0]}>
        <CapsuleCollider args={[0.5, 0.5]} position={[0, 0, 0]} />
        <group ref={playerRef}>
            <mesh castShadow>
                <capsuleGeometry args={[0.5, 0.75, 4, 8]} />
                <meshStandardMaterial color="skyblue" />
            </mesh>
            <mesh position={[0, 0.2, -0.6]} castShadow>
                <boxGeometry args={[0.25, 0.25, 0.1]} />
                <meshStandardMaterial color="blue" />
            </mesh>
            <Text
                position={[0, 1.2, 0]}
                rotation={[0, 0, 0]}
                fontSize={0.4}
                color="white"
                anchorX="center"
                anchorY="middle"
                maxWidth={3}
                lineHeight={1}
                textAlign="center"
            >
                {id.substring(0, 4)}
            </Text>
        </group>
    </RigidBody>
  );
}


function PlayerMovement({ socket, myPlayerId }) {
  const { camera, gl } = useThree();
  const [sub, getKeys] = useKeyboardControls();

  const playerRef = useRef();
  const [viewMode, setViewMode] = useState('firstPerson');
  const isVPressedLastFrame = useRef(false);
  const isBPressedLastFrame = useRef(false);

  const [isPointerLocked, setIsPointerLocked] = useState(false);

  const pitch = useRef(0);
  const yaw = useRef(0);

  const mouseSensitivity = 0.002;
  const minPitch = -Math.PI / 2 + 0.1;
  const maxPitch = Math.PI / 2 - 0.1;

  const tempForward = useMemo(() => new THREE.Vector3(), []);
  const tempRight = useMemo(() => new THREE.Vector3(), []);
  const tempCameraOffset = useMemo(() => new THREE.Vector3(), []);

  const JUMP_IMPULSE = 8.0;
  const PLAYER_SPEED = 5.0;

  const [canJump, setCanJump] = useState(true);
  const GROUND_RIGIDBODY_Y_POSITION = -0.5;
  const EPSILON = 0.25;

  const SMOOTHING_FACTOR = 0.2;

  useEffect(() => {
    const canvas = gl.domElement;

    const handleMouseMove = (event) => {
      if (!isPointerLocked) return;

      const deltaX = event.movementX || 0;
      const deltaY = event.movementY || 0;

      yaw.current -= deltaX * mouseSensitivity;

      if (viewMode === 'firstPerson') {
        pitch.current -= deltaY * mouseSensitivity;
      } else {
        pitch.current += deltaY * mouseSensitivity;
      }

      pitch.current = THREE.MathUtils.clamp(pitch.current, minPitch, maxPitch);
    };

    const handlePointerLockChange = () => {
      if (document.pointerLockElement === canvas) {
        setIsPointerLocked(true);
      } else {
        setIsPointerLocked(false);
      }
    };

    const handleCanvasClick = () => {
      canvas.requestPointerLock();
    };

    canvas.addEventListener('mousemove', handleMouseMove, false);
    document.addEventListener('pointerlockchange', handlePointerLockChange, false);
    canvas.addEventListener('click', handleCanvasClick, false);

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove, false);
      document.removeEventListener('pointerlockchange', handlePointerLockChange, false);
      canvas.removeEventListener('click', handleCanvasClick, false);
    };
  }, [gl, isPointerLocked, mouseSensitivity, minPitch, maxPitch, viewMode]);

  useFrame((state, delta) => {
    const { forward, backward, left, right, jump, toggleView, toggleSecondPerson } = getKeys();

    if (!playerRef.current) return;

    playerRef.current.setRotation(new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw.current, 0, 'YXZ')), true);
    
    const currentVelocity = playerRef.current.linvel();
    let velocityChangeX = 0;
    let velocityChangeZ = 0;

    const cameraYawQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw.current, 0, 'YXZ'));
    const movementForward = tempForward.set(0, 0, -1).applyQuaternion(cameraYawQuaternion).setY(0).normalize();
    const movementRight = tempRight.set(1, 0, 0).applyQuaternion(cameraYawQuaternion).setY(0).normalize();

    if (forward) {
        velocityChangeX += movementForward.x * PLAYER_SPEED;
        velocityChangeZ += movementForward.z * PLAYER_SPEED;
    }
    if (backward) {
        velocityChangeX -= movementForward.x * PLAYER_SPEED;
        velocityChangeZ -= movementForward.z * PLAYER_SPEED;
    }
    if (left) {
        velocityChangeX -= movementRight.x * PLAYER_SPEED;
        velocityChangeZ -= movementRight.z * PLAYER_SPEED;
    }
    if (right) {
        velocityChangeX += movementRight.x * PLAYER_SPEED;
        velocityChangeZ += movementRight.z * PLAYER_SPEED;
    }

    playerRef.current.setLinvel({
        x: velocityChangeX,
        y: currentVelocity.y,
        z: velocityChangeZ,
    }, true);

    const playerPhysicsPosition = playerRef.current.translation();
    const playerWorldPosition = new THREE.Vector3(playerPhysicsPosition.x, playerPhysicsPosition.y, playerPhysicsPosition.z);

    const currentLinvelY = playerRef.current.linvel().y;

    const isGrounded = Math.abs(playerWorldPosition.y - GROUND_RIGIDBODY_Y_POSITION) < EPSILON && Math.abs(currentLinvelY) < EPSILON;

    if (jump && canJump && isGrounded) {
      playerRef.current.applyImpulse({ x: 0, y: JUMP_IMPULSE, z: 0 }, true);
      setCanJump(false);
    }

    if (!canJump && isGrounded) {
        setCanJump(true);
    }

    if (toggleView && !isVPressedLastFrame.current) {
      setViewMode((prevMode) => {
        if (prevMode === 'firstPerson') return 'thirdPerson';
        return 'firstPerson';
      });
    }
    isVPressedLastFrame.current = toggleView;

    if (toggleSecondPerson && !isBPressedLastFrame.current) {
        setViewMode((prevMode) => {
            if (prevMode === 'firstPerson') return 'secondPerson';
            return 'firstPerson';
        });
    }
    isBPressedLastFrame.current = toggleSecondPerson;

    if (viewMode === 'firstPerson') {
        const eyeOffset = new THREE.Vector3(0, 0.75, 0);
        eyeOffset.applyQuaternion(cameraYawQuaternion);
        const targetCameraPosition = playerWorldPosition.clone().add(eyeOffset);
        camera.position.lerp(targetCameraPosition, SMOOTHING_FACTOR);

        const targetCameraQuaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch.current, yaw.current, 0, 'YXZ'));
        camera.quaternion.slerp(targetCameraQuaternion, SMOOTHING_FACTOR);

    } else if (viewMode === 'secondPerson') {
        const secondPersonDistance = 5;
        const secondPersonHeight = 1.5;

        const targetX = playerWorldPosition.x;
        const targetY = playerWorldPosition.y + 0.75; 
        const targetZ = playerWorldPosition.z;

        const radius = secondPersonDistance;
        const phi = Math.PI / 2 - pitch.current; 
        const theta = yaw.current + Math.PI;

        const targetCameraPosition = new THREE.Vector3(
            targetX + radius * Math.sin(phi) * Math.sin(theta),
            targetY + radius * Math.cos(phi),
            targetZ + radius * Math.sin(phi) * Math.cos(theta)
        );
        camera.position.lerp(targetCameraPosition, SMOOTHING_FACTOR);
        
        camera.lookAt(targetX, targetY, targetZ);

    } else if (viewMode === 'thirdPerson') {
        const thirdPersonDistance = 5;
        const thirdPersonHeight = 1.5;

        const targetX = playerWorldPosition.x;
        const targetY = playerWorldPosition.y + 0.75;
        const targetZ = playerWorldPosition.z;

        const radius = thirdPersonDistance;
        const phi = Math.PI / 2 - pitch.current;
        const theta = yaw.current;

        const targetCameraPosition = new THREE.Vector3(
            targetX + radius * Math.sin(phi) * Math.sin(theta),
            targetY + radius * Math.cos(phi),
            targetZ + radius * Math.sin(phi) * Math.cos(theta)
        );
        camera.position.lerp(targetCameraPosition, SMOOTHING_FACTOR);

        camera.lookAt(targetX, targetY, targetZ);
    }

    if (socket && socket.readyState === WebSocket.OPEN && myPlayerId) {
        socket.send(JSON.stringify({
            type: 'playerUpdate',
            id: myPlayerId, // 자신의 고유 ID
            position: { x: playerWorldPosition.x, y: playerWorldPosition.y, z: playerWorldPosition.z },
            rotationYaw: yaw.current,
            viewMode: viewMode
        }));
    }
  });

  return (
    <RigidBody ref={playerRef} colliders={false} enabledRotations={[false, false, false]} position={[0, GROUND_RIGIDBODY_Y_POSITION, 0]}>
      <CapsuleCollider args={[0.5, 0.5]} position={[0, 0, 0]} />

      {(viewMode === 'secondPerson' || viewMode === 'thirdPerson') && (
        <>
          <mesh position={[0, 0, 0]} castShadow>
            <capsuleGeometry args={[0.5, 0.75, 4, 8]} />
            <meshStandardMaterial color="gray" />
          </mesh>
          <mesh position={[0, 0.2, -0.6]} castShadow>
            <boxGeometry args={[0.25, 0.25, 0.1]} />
            <meshStandardMaterial color="red" />
          </mesh>
          <Text
            position={[0, 0.7, -0.6]}
            rotation={[0, Math.PI, 0]}
            fontSize={0.3}
            color="black"
            anchorX="center"
            anchorY="middle"
          >
            앞
          </Text>
          <Text
            position={[0, 0.7, 0.6]}
            rotation={[0, 0, 0]}
            fontSize={0.3}
            color="black"
            anchorX="center"
            anchorY="middle"
          >
            뒤
          </Text>
        </>
      )}
    </RigidBody>
  );
}

function RotatingBox(props) {
  const [mesh, setMesh] = useState(null);
  const setMeshRef = useCallback((node) => {
    setMesh(node);
  }, []);

  useFrame(() => {
    if (mesh) {
      mesh.rotation.x += 0.01;
      mesh.rotation.y += 0.01;
    }
  });
  return (
    <RigidBody type="fixed" {...props} receiveShadow>
      <CuboidCollider args={[0.5, 0.5, 0.5]} />
      <Box args={[1, 1, 1]} ref={setMeshRef} castShadow>
        <meshStandardMaterial color="hotpink" />
      </Box>
    </RigidBody>
  );
}

function RotatingSphere(props) {
  const [mesh, setMesh] = useState(null);
  const setMeshRef = useCallback((node) => {
    setMesh(node);
  }, []);

  useFrame(() => {
    if (mesh) {
      mesh.rotation.y += 0.005;
    }
  });
  return (
    <RigidBody type="fixed" {...props} receiveShadow>
      <BallCollider args={[0.7]} />
      <Sphere args={[0.7, 32, 32]} ref={setMeshRef} castShadow>
        <meshStandardMaterial color="lightblue" />
      </Sphere>
    </RigidBody>
  );
}

function App() {
  const map = useMemo(() => [
    { name: controls.forward, keys: ['KeyW'] },
    { name: controls.backward, keys: ['KeyS'] },
    { name: controls.left, keys: ['KeyA'] },
    { name: controls.right, keys: ['KeyD'] },
    { name: controls.jump, keys: ['Space'] },
    { name: controls.toggleView, keys: ['KeyV'] },
    { name: controls.toggleSecondPerson, keys: ['KeyB'] },
  ], []);

  const [apiMessage, setApiMessage] = useState('');
  const [socket, setSocket] = useState(null);
  const [onlinePlayers, setOnlinePlayers] = useState({});
  const myPlayerId = useRef(crypto.randomUUID());

  useEffect(() => {
    // Spring Boot WebSocket 서버에 연결
    const ws = new WebSocket('ws://localhost:8080/websocket');

    ws.onopen = () => {
      console.log('WebSocket 연결 성공: Spring Boot 서버');
      setSocket(ws);
      // 서버는 세션 ID를 플레이어 ID로 사용하므로, 클라이언트에서 별도로 'init' 메시지를 보낼 필요 없습니다.
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'playerUpdate') {
        if (data.id !== myPlayerId.current) {
            setOnlinePlayers((prevPlayers) => ({
                ...prevPlayers,
                [data.id]: {
                    position: data.position,
                    rotationYaw: data.rotationYaw,
                    viewMode: data.viewMode
                },
            }));
        }
      } else if (data.type === 'initialPlayers') {
          setOnlinePlayers(data.players);
      } else if (data.type === 'playerDisconnected') {
          setOnlinePlayers((prevPlayers) => {
              const newPlayers = { ...prevPlayers };
              delete newPlayers[data.id];
              return newPlayers;
          });
      }
    };

    ws.onclose = () => {
      console.log('WebSocket 연결 종료');
      setSocket(null);
    };

    ws.onerror = (error) => {
      console.error('WebSocket 오류:', error);
    };

    return () => {
      ws.close();
    };
  }, []);

  const fetchHelloFromSpringBoot = async () => {
    setApiMessage('서버에 요청 중...');
    try {
      const response = await fetch('/api/hello');

      if (!response.ok) {
        throw new Error(`HTTP 오류! 상태 코드: ${response.status}`);
      }

      const data = await response.text();
      setApiMessage(`서버 응답: ${data}`);
      console.log("프록시를 통해 서버 응답 받음:", data);
    } catch (error) {
      setApiMessage(`API 호출 실패: ${error.message}`);
      console.error("API 호출 중 오류 발생:", error);
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        zIndex: 100,
        backgroundColor: 'rgba(255, 255, 255, 0.7)',
        padding: '10px 20px',
        borderRadius: '8px',
        fontFamily: 'Arial, sans-serif',
        color: '#333'
      }}>
        <h2>Spring Boot 연결 테스트</h2>
        <button
          onClick={fetchHelloFromSpringBoot}
          style={{
            padding: '10px 15px',
            fontSize: '16px',
            cursor: 'pointer',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            marginRight: '10px'
          }}
        >
          Spring Boot API 호출
        </button>
        <p style={{ marginTop: '10px', fontWeight: 'bold' }}>
          {apiMessage || "버튼을 클릭하여 Spring Boot 서버 연결을 테스트하세요."}
        </p>
        <p style={{ marginTop: '10px', fontWeight: 'bold' }}>
          내 플레이어 ID: {myPlayerId.current ? myPlayerId.current.substring(0, 8) : '연결 중...'}
        </p>
      </div>

      <KeyboardControls map={map}>
        <Canvas shadows fov={75} near={0.1} far={1000}>
          <PerspectiveCamera makeDefault fov={75} near={0.1} far={1000} position={[0, 0.75, 0]} />

          <Physics gravity={[0, -9.81, 0]}>

            <ambientLight intensity={0.5} />
            <directionalLight position={[1, 1, 1]} intensity={1} castShadow />
            <pointLight position={[5, 5, 5]} intensity={1} castShadow />
            <spotLight position={[-5, 5, 5]} angle={0.15} penumbra={1} intensity={1} castShadow />

            <RigidBody type="fixed" position={[0, -1.5, 0]} receiveShadow>
              <CuboidCollider args={[30, 0.1, 30]} />
              <Plane args={[60, 60]} rotation={[-Math.PI / 2, 0, 0]}>
                <meshStandardMaterial color="lightgray" />
              </Plane>
            </RigidBody>

            <RotatingBox position={[-3, 1, -2]} />
            <RotatingSphere position={[3, 1, -2]} />
            <RigidBody type="fixed" position={[-6, 0, 0]} receiveShadow>
              <CylinderCollider args={[1.5, 0.8]} />
              <Cylinder args={[0.8, 0.8, 3, 32]} castShadow><meshStandardMaterial color="purple" /></Cylinder>
            </RigidBody>
            <RigidBody type="fixed" position={[6, 0.5, 0]} receiveShadow>
              <ConeCollider args={[1, 1]} />
              <Cone args={[1, 2, 32]} castShadow><meshStandardMaterial color="brown" /></Cone>
            </RigidBody>
            <RigidBody type="fixed" position={[0, 1.5, -5]} receiveShadow>
              <BallCollider args={[1.3]} />
              <Torus args={[1, 0.3, 16, 100]} castShadow><meshStandardMaterial color="gold" /></Torus>
            </RigidBody>
            <RigidBody type="fixed" position={[-4, 0, 4]} receiveShadow>
              <CapsuleCollider args={[1, 0.7]} />
              <Capsule args={[0.7, 2, 8, 32]} castShadow><meshStandardMaterial color="salmon" /></Capsule>
            </RigidBody>
            <RigidBody type="fixed" position={[4, 1, 4]} rotation={[Math.PI / 4, 0, 0]} receiveShadow>
              <BallCollider args={[2]} />
              <Ring args={[1.5, 2, 32]} castShadow><meshStandardMaterial color="teal" side={THREE.DoubleSide} /></Ring>
            </RigidBody>

            <PlayerMovement socket={socket} myPlayerId={myPlayerId.current} />

            {Object.entries(onlinePlayers).map(([id, player]) => (
                <OnlinePlayer
                    key={id}
                    id={id}
                    position={player.position}
                    rotationYaw={player.rotationYaw}
                    viewMode={player.viewMode}
                />
            ))}

          </Physics>
        </Canvas>
      </KeyboardControls>
    </div>
  );
}

export default App;

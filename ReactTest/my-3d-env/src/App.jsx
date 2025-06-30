import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, KeyboardControls, useKeyboardControls } from '@react-three/drei';
import { Physics, RigidBody, CapsuleCollider } from '@react-three/rapier';
import { Leva, useControls } from 'leva';
import * as THREE from 'three';

const controlsMap = [
  { name: 'forward', keys: ['KeyW'] },
  { name: 'backward', keys: ['KeyS'] },
  { name: 'left', keys: ['KeyA'] },
  { name: 'right', keys: ['KeyD'] },
  { name: 'jump', keys: ['Space'] }, 
  { name: 'toggleView', keys: ['KeyV'] },
];

function Player({ onHudUpdate }) {
  const { camera, gl } = useThree();
  const [subscribeKeys, getKeys] = useKeyboardControls();
  const playerRef = useRef();
  const modelRef = useRef();
  const [isGrounded, setIsGrounded] = useState(false);
  const [viewMode, setViewMode] = useState('firstPerson'); 
  const pitch = useRef(0); 
  const yaw = useRef(0);   

  const [jumpImpulse] = useState(30);
  const { speed } = useControls({ speed: { value: 5, min: 1, max: 20 } });

  const toggleViewPressed = useRef(false); 

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

  const onMouseMove = useCallback((e) => {
    yaw.current -= e.movementX * 0.002; 
    
    if (viewMode === 'firstPerson') {
      pitch.current -= e.movementY * 0.002; 
    } else { 
      pitch.current += e.movementY * 0.002; 
    }
    
    pitch.current = THREE.MathUtils.clamp(pitch.current, -Math.PI / 2 + 0.1, Math.PI / 2 - 0.1);
  }, [viewMode]); 

  useEffect(() => {
    const canvas = gl.domElement;

    const requestPointerLock = () => {
      canvas.requestPointerLock();
    };

    canvas.addEventListener('click', requestPointerLock);

    return () => {
      canvas.removeEventListener('click', requestPointerLock);
    };
  }, [gl]); 

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

  useFrame(() => {
    const keys = getKeys();
    const vel = playerRef.current?.linvel() || { x: 0, y: 0, z: 0 };
    const pos = playerRef.current?.translation() || { x: 0, y: 0, z: 0 };

    const cameraOrientationQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw.current, 0));
    const forwardVector = new THREE.Vector3(0, 0, 1).applyQuaternion(cameraOrientationQ).normalize();
    const rightVector = new THREE.Vector3().crossVectors(forwardVector, new THREE.Vector3(0, 1, 0)).normalize(); 

    let vx = 0, vz = 0;
    if (keys.forward) { vx += forwardVector.x * speed; vz += forwardVector.z * speed; }
    if (keys.backward) { vx -= forwardVector.x * speed; vz -= forwardVector.z * speed; }
    if (keys.left) { vx -= rightVector.x * speed; vz -= rightVector.z * speed; }
    if (keys.right) { vx += rightVector.x * speed; vz += rightVector.z * speed; }
    playerRef.current.setLinvel({ x: vx, y: vel.y, z: vz }, true);

    if (keys.jump && isGrounded && vel.y <= 0.1) {
      playerRef.current.applyImpulse({ x: 0, y: jumpImpulse, z: 0 }, true);
      setIsGrounded(false);
    }

    const playerBodyPos = new THREE.Vector3(pos.x, pos.y, pos.z);
    const headOffset = new THREE.Vector3(0, 0.3, 0); 

    if (modelRef.current) {
      modelRef.current.position.copy(playerBodyPos);
      modelRef.current.visible = viewMode === 'thirdPerson';

      if (viewMode === 'thirdPerson') {
        const horizontalMovementLengthSq = vx * vx + vz * vz;
        if (horizontalMovementLengthSq > 0.01) {
            const targetRotationY = Math.atan2(vx, vz); 
            modelRef.current.rotation.y = THREE.MathUtils.lerp(modelRef.current.rotation.y, targetRotationY, 0.15);
        } else {
            modelRef.current.rotation.y = yaw.current;
        }
      } else {
        modelRef.current.rotation.y = yaw.current;
      }
    }

    if (viewMode === 'firstPerson') {
      const cameraPosition = playerBodyPos.clone().add(headOffset);
      camera.position.copy(cameraPosition); 
      const cameraRotation = new THREE.Euler(pitch.current, yaw.current + Math.PI, 0, 'YXZ'); 
      camera.quaternion.setFromEuler(cameraRotation);
    } else { // Third-person camera
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

    onHudUpdate?.({
      viewMode,
      isGrounded,
      position: `(${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`,
      velocity: `(${vel.x.toFixed(2)}, ${vel.y.toFixed(2)}, ${vel.z.toFixed(2)})`,
      yaw: yaw.current,
      pitch: pitch.current,
      keys,
    });
  });

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
        <CapsuleCollider args={[0.35, 0.75]} />
      </RigidBody>

      <group ref={modelRef}>
        <mesh position={[0, -0.35, 0]}> 
          <capsuleGeometry args={[0.35, 0.75, 8, 16]} />
          <meshStandardMaterial color={'#00f'} />
        </mesh>
      </group>
    </>
  );
}

function PlayerHUD({ state }) {
  return (
    <div style={{
      position: 'absolute',
      top: 20,
      left: 20,
      color: 'white',
      fontSize: 14,
      backgroundColor: 'rgba(0,0,0,0.8)', // 불투명도 조정
      padding: 10,
      borderRadius: 8,
      zIndex: 100 // z-index 추가
    }}>
      <div><strong>View:</strong> {state.viewMode}</div>
      <div><strong>isGrounded:</strong> {state.isGrounded ? '✅' : '❌'}</div>
      <div><strong>Position:</strong> {state.position}</div>
      <div><strong>Velocity:</strong> {state.velocity}</div>
      <div><strong>Yaw:</strong> {state.yaw?.toFixed(2) ?? 'N/A'}</div>
      <div><strong>Pitch:</strong> {state.pitch?.toFixed(2) ?? 'N/A'}</div>
      <div><strong>Keys:</strong> {state.keys ? Object.entries(state.keys).filter(([, v]) => v).map(([k]) => k).join(', ') : 'N/A'}</div>
    </div>
  );
}

export default function App() {
  const [hudState, setHudState] = useState({});

  return (
    <>
      <Leva collapsed={false} />
      <PlayerHUD state={hudState} />
      <KeyboardControls map={controlsMap}>
        <Canvas shadows camera={{ fov: 60 }} style={{ width: '100vw', height: '100vh' }}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 10, 5]} intensity={1} castShadow />
          <Physics gravity={[0, -9.81, 0]}>
            {/* 바닥 */}
            <RigidBody type="fixed">
              <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <planeGeometry args={[100, 100]} />
                <meshStandardMaterial color="gray" />
              </mesh>
            </RigidBody>

            {/* 맵 경계 벽들 (투명) */}
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

            {/* 박스 오브젝트들 */}
            <RigidBody position={[0, 0.5, -5]} colliders="cuboid">
              <mesh castShadow receiveShadow>
                <boxGeometry args={[1, 1, 1]} />
                <meshStandardMaterial color="hotpink" />
              </mesh>
            </RigidBody>
            <RigidBody position={[3, 0.5, 0]} colliders="cuboid">
              <mesh castShadow receiveShadow>
                <boxGeometry args={[1, 1, 1]} />
                <meshStandardMaterial color="lightgreen" />
              </mesh>
            </RigidBody>
            <RigidBody position={[-3, 0.5, 0]} colliders="cuboid">
              <mesh castShadow receiveShadow>
                <boxGeometry args={[1, 1, 1]} />
                <meshStandardMaterial color="lightblue" />
              </mesh>
            </RigidBody>
            <RigidBody position={[0, 0.5, 3]} colliders="cuboid">
              <mesh castShadow receiveShadow>
                <boxGeometry args={[1, 1, 1]} />
                <meshStandardMaterial color="orange" />
              </mesh>
            </RigidBody>

            {/* 구체 오브젝트들 */}
            <RigidBody position={[5, 1.5, -5]} colliders="ball"> 
              <mesh castShadow receiveShadow>
                <sphereGeometry args={[1, 32, 32]} />
                <meshStandardMaterial color="purple" />
              </mesh>
            </RigidBody>

            <RigidBody position={[-5, 2.5, 5]} colliders="ball">
              <mesh castShadow receiveShadow>
                <sphereGeometry args={[1.5, 32, 32]} />
                <meshStandardMaterial color="cyan" />
              </mesh>
            </RigidBody>

            <RigidBody position={[0, 3.5, 7]} colliders="ball">
              <mesh castShadow receiveShadow>
                <sphereGeometry args={[0.8, 32, 32]} />
                <meshStandardMaterial color="gold" />
              </mesh>
            </RigidBody>

            <RigidBody position={[8, 1, 0]} colliders="ball">
              <mesh castShadow receiveShadow>
                <sphereGeometry args={[0.6, 32, 32]} />
                <meshStandardMaterial color="red" />
              </mesh>
            </RigidBody>
            
            <RigidBody position={[-8, 1, -8]} colliders="ball">
              <mesh castShadow receiveShadow>
                <sphereGeometry args={[1.2, 32, 32]} />
                <meshStandardMaterial color="lime" />
              </mesh>
            </RigidBody>

            <Player onHudUpdate={setHudState} />
          </Physics>
        </Canvas>
      </KeyboardControls>
    </>
  );
}
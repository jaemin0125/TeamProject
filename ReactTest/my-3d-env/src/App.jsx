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
import { Leva, useControls } from 'leva'; // 수정: '=' 기호 제거
// Three.js
import * as THREE from 'three';
// CharacterModel, CharacterModel2, CharacterModel3 임포트
import { CharacterModel, CharacterModel2, CharacterModel3 } from './CharacterModel';
// 웹소켓 라이브러리 import
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { v4 as uuidv4 } from 'uuid'; // uuid 라이브러리 임포트
const controlsMap = [
    { name: 'forward', keys: ['KeyW'] },
    { name: 'backward', keys: ['KeyS'] },
    { name: 'left', keys: ['KeyA'] },
    { name: 'right', keys: ['KeyD'] },
    { name: 'jump', keys: ['Space'] },
    { name: 'toggleView', keys: ['KeyV'] },
    { name: 'runFast', keys: ['ShiftLeft'] },
];

// 플레이어 ID를 localStorage에서 로드하거나 새로 생성합니다.
const getOrCreatePlayerInfo = () => {
    let storedPlayerId = localStorage.getItem('myPlayerId');
    if (!storedPlayerId) {
        storedPlayerId = uuidv4();
        localStorage.setItem('myPlayerId', storedPlayerId);
    }
    let storedNickname = localStorage.getItem('myNickname');
    return { id: storedPlayerId, nickname: storedNickname || '' };
};


const currentPlayerInfo = getOrCreatePlayerInfo()
// --- OtherPlayer 컴포넌트 (RigidBody와 CapsuleCollider 추가) ---
// 다른 플레이어의 모델, 위치, 애니메이션 상태를 렌더링합니다.
function OtherPlayer({ id, nickname, position, rotationY, animationState }) {
    const rigidBodyRef = useRef(); // RigidBody에 대한 ref
    const modelGroupRef = useRef(); // 모델 그룹에 대한 ref

    useFrame(() => {
        if (rigidBodyRef.current && position) {
            // 서버에서 받은 위치 정보를 기반으로 RigidBody의 위치를 직접 설정합니다.
            const newPos = new THREE.Vector3(position.x, position.y, position.z);
            rigidBodyRef.current.setTranslation(newPos, true); // true는 wakeUp을 의미
        }

        if (modelGroupRef.current) {
            // 모델의 시각적인 회전만 부드럽게 보간합니다.
            modelGroupRef.current.rotation.y = THREE.MathUtils.lerp(modelGroupRef.current.rotation.y, rotationY + Math.PI, 0.2);
        }
    });

    const safeAnimationState = animationState || {};
    const displayNickname = nickname || id.substring(0, 5);

    // 플레이어 ID의 마지막 문자에 따라 다른 캐릭터 모델을 렌더링합니다.
    // 이는 서버에서 characterType을 명시적으로 보내주지 않을 경우의 임시 로직입니다.
    const CharacterToRender = useMemo(() => {
        // playerId가 'player1', 'player2', 'player3' 등이라면
        // 마지막 숫자를 기준으로 모델을 선택할 수 있습니다.
        // 예: '...1' -> CharacterModel2, '...2' -> CharacterModel3, '...3' -> CharacterModel
        const lastChar = id.charCodeAt(id.length - 1);
        if (lastChar % 3 === 0) { // 예: ID 마지막이 0, 3, 6, 9...
            return CharacterModel;
        } else if (lastChar % 3 === 1) { // 예: ID 마지막이 1, 4, 7...
            return CharacterModel2;
        } else { // 예: ID 마지막이 2, 5, 8...
            return CharacterModel3;
        }
    }, [id]);

    return (
        <RigidBody
            ref={rigidBodyRef}
            position={[position.x, position.y, position.z]} // 초기 위치 설정
            colliders={false} // RigidBody 자체의 자동 충돌체 생성을 끔
            type="kinematicPosition" // 외부에서 위치를 제어할 수 있도록 설정
            enabledRotations={[false, false, false]} // 회전 제한
        >
            {/* 캡슐 충돌체 추가: 플레이어 모델의 대략적인 크기에 맞춥니다. */}
            <CapsuleCollider args={[0.35, 0.4]} />

            {/* 선택된 CharacterModel 컴포넌트를 RigidBody의 자식으로 둡니다. */}
            {/* 모델의 Pivot이 바닥에 오도록 y축 오프셋을 조정합니다. (Player 컴포넌트와 동일) */}
            <group ref={modelGroupRef} position-y={-1.65}>
                <CharacterToRender {...safeAnimationState} />

                {/* 플레이어 ID 텍스트는 모델 위에 표시되도록 합니다. */}
                <Text
                    position={[0, 2.6, 0]} // 모델 Y 오프셋을 고려하여 텍스트 위치 조정
                    fontSize={0.2}
                    color="black"
                    anchorX="center"
                    anchorY="middle"
                >
                    {displayNickname}
                </Text>
            </group>
        </RigidBody>
    );
}

// 두 플레이어 간의 히트 여부를 확인하는 함수
function checkHit(attackerPos, attackerQuat, targetPos) {
    const attacker = new THREE.Vector3(attackerPos.x, attackerPos.y, attackerPos.z);
    const target = new THREE.Vector3(targetPos.x, targetPos.y, targetPos.z);
    const directionToTarget = target.clone().sub(attacker);
    const distance = directionToTarget.length();

    // +Z가 정면 방향이라고 가정하고 펀치 방향을 계산
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(attackerQuat);

    const angle = forward.angleTo(directionToTarget);

    // console.log(`🎯 거리: ${distance.toFixed(2)} / 각도(deg): ${(angle * 180 / Math.PI).toFixed(1)}`);

    // 거리가 1.2 미만이고, 공격자의 정면 45도 이내 (Math.PI / 4)에 있을 때 히트로 간주
    return distance < 1.2 && angle < Math.PI / 4;
}

// --- Player 컴포넌트 (현재 플레이어의 로직) ---
// isPlayerHitted prop을 추가하여 GameCanvas로부터 직접 피격 상태를 받습니다.
function Player({ onHudUpdate, objectRefs, stompClientInstance, isPlayerHitted, nickname }) {
    const { camera, gl } = useThree();
    const [subscribeKeys, getKeys] = useKeyboardControls();
    const [sitToggle, setSitToggle] = useState(false);
    const [lieToggle, setLieToggle] = useState(false);
    const playerRef = useRef();
    const modelRef = useRef();
    const [isGrounded, setIsGrounded] = useState(false);
    const [viewMode, setViewMode] = useState('firstPerson');
    const [isPunching, setIsPunching] = useState(false);
    // isHitted 상태는 GameCanvas에서 관리하고 prop으로 전달받습니다.

    const pitch = useRef(0);
    const yaw = useRef(0);

    const { speed, jumpImpulse } = useControls({
        speed: { value: 5, min: 1, max: 2000 },
        jumpImpulse: { value: 3, min: 1, max: 50 }
    });

    const toggleViewPressed = useRef(false);

    // 펀치 시 타격 감지 및 서버 전송 로직
    useEffect(() => {
        // isPunching이 true이고 STOMP 클라이언트가 연결되어 있을 때만 실행
        if (!isPunching || !stompClientInstance || !stompClientInstance.connected) return;

        const attackerPos = playerRef.current?.translation();
        // 플레이어의 현재 회전 (yaw)을 기반으로 쿼터니언 생성
        const attackerQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw.current, 0));

        // window.onlinePlayers는 GameCanvas에서 업데이트된 다른 플레이어들의 위치 정보 (Map 객체)
        // Map.prototype.forEach()를 사용하여 올바르게 순회합니다.
        (window.onlinePlayers || new Map()).forEach((targetPlayer, id) => {
            if (id === currentPlayerInfo.id) return; // 자기 자신은 제외

            const targetPos = targetPlayer.position; // Map에서 가져온 플레이어 객체에서 position 접근
            const isHit = checkHit(attackerPos, attackerQuat, targetPos);

            if (isHit) {
                console.log(`[🥊 Player] 타격 성공 -> 대상: ${id}`);
                // 서버에 타격 정보 전송
                stompClientInstance.publish({
                    destination: '/app/playerHit',
                    body: JSON.stringify({
                        fromId: currentPlayerInfo.id, // 공격자 ID
                        targetId: id, // 피격자 ID
                    }),
                });
            }
        });
    }, [isPunching, stompClientInstance]); // isPunching 또는 stompClientInstance가 변경될 때마다 실행

    // 컴포넌트 마운트 시 초기 플레이어 등록
    useEffect(() => {
        if (stompClientInstance && stompClientInstance.connected) {
            console.log("[Player] Initial player registration upon mount.");
            const initialPlayerState = {
                id: currentPlayerInfo.id,
                nickname: nickname,
                position: { x: 0, y: 0, z: 0 },
                rotationY: yaw.current + Math.PI,
                animationState: {
                    isWalking: false, isBackward: false, isLeft: false, isRight: false,
                    isJumping: false, isRunning: false, isSitted: false, isSittedAndWalk: false,
                    isLyingDown: false, isLyingDownAndWalk: false, isPunching: false, isHitted: false, isIdle: true // isHitted 초기 상태 포함
                }
            };
            stompClientInstance.publish({
                destination: '/app/registerPlayer',
                body: JSON.stringify(initialPlayerState)
            });
        }
    }, [stompClientInstance, nickname]); // stompClientInstance가 준비되면 실행

    // 'C' (앉기) 및 'Z' (눕기) 토글 로직
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.code === 'KeyC') {
                setSitToggle(prev => {
                    const next = !prev;
                    if (next) setLieToggle(false); // 앉기 시 눕기 해제
                    return next;
                });
            }
            if (e.code === 'KeyZ') {
                setLieToggle(prev => {
                    const next = !prev;
                    if (next) setSitToggle(false); // 눕기 시 앉기 해제
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
            if (e.button === 0) { // 좌클릭
                setIsPunching(true);
                // 펀치 애니메이션 지속 시간 후 isPunching 상태를 false로 변경
                setTimeout(() => setIsPunching(false), 500);
            }
        };

        window.addEventListener('mousedown', handleMouseDown);
        return () => {
            window.removeEventListener('mousedown', handleMouseDown);
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
        } else { // 3인칭에서는 마우스 Y축 움직임이 카메라 위아래로 움직이도록 반전
            pitch.current += e.movementY * 0.002;
        }

        // pitch 값 클램핑 (카메라가 완전히 뒤집히지 않도록)
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
        // 초기 마운트 시 포인터 락 상태 확인
        if (document.pointerLockElement === canvas) {
            document.addEventListener('mousemove', onMouseMove);
        }
        document.addEventListener('pointerlockchange', handlePointerLockChange);
        return () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('pointerlockchange', handlePointerLockChange);
        };
    }, [onMouseMove]);

    // 매 프레임마다 플레이어 및 오브젝트 움직임과 서버 업데이트 로직
    useFrame(() => {
        const keys = getKeys();
        const vel = playerRef.current?.linvel() || { x: 0, y: 0, z: 0 };
        const pos = playerRef.current?.translation() || { x: 0, y: 0, z: 0 };

        // 플레이어 위치 및 애니메이션 정보 서버로 전송 (멀티플레이어 핵심)
        if (stompClientInstance && stompClientInstance.connected) {
            const playerState = {
                id: currentPlayerInfo.id,
                nickname: nickname,
                position: { x: pos.x, y: pos.y, z: pos.z },
                rotationY: yaw.current + Math.PI, // 3D 모델의 정면을 맞추기 위한 회전 보정
                animationState: {
                    isWalking: keys.forward, isBackward: keys.backward, isLeft: keys.left, isRight: keys.right,
                    isJumping: keys.jump, isRunning: keys.runFast && (keys.forward || keys.left || keys.right || keys.backward),
                    isSitted: sitToggle, isSittedAndWalk: sitToggle && (keys.forward || keys.left || keys.right || keys.backward),
                    isLyingDown: lieToggle, isLyingDownAndWalk: lieToggle && (keys.forward || keys.left || keys.right || keys.backward),
                    isPunching: isPunching,
                    isHitted: isPlayerHitted, // GameCanvas로부터 직접 전달받은 isPlayerHitted prop 사용
                    isIdle: !(keys.forward || keys.backward || keys.left || keys.right || keys.jump || keys.runFast || isPunching || isPlayerHitted) && !sitToggle && !lieToggle
                }
            };
            stompClientInstance.publish({
                destination: `/app/playerMove`,
                body: JSON.stringify(playerState)
            });

            // 오브젝트 위치 전송
            const objectPositions = Object.entries(objectRefs.current)
                .map(([id, ref]) => {
                    const objPos = ref.translation();
                    return { id, position: { x: objPos.x, y: objPos.y, z: objPos.z } };
                });

            if (objectPositions.length > 0) {
                stompClientInstance.publish({
                    destination: '/app/sceneObjects',
                    body: JSON.stringify(objectPositions),
                });
            }
        }

        // 플레이어 이동 로직
        const cameraOrientationQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw.current, 0));
        const forwardVector = new THREE.Vector3(0, 0, 1).applyQuaternion(cameraOrientationQ).normalize();
        const rightVector = new THREE.Vector3().crossVectors(forwardVector, new THREE.Vector3(0, 1, 0)).normalize();
        let actualSpeed = speed;

        if (sitToggle && (keys.forward || keys.backward || keys.left || keys.right)) {
            actualSpeed = Math.max(speed * 0.5, 1.5);
        } else if (lieToggle && (keys.forward || keys.backward || keys.left || keys.right)) {
            actualSpeed = Math.max(speed * 0.15, 1.2);
        } else if (keys.runFast && (keys.forward || keys.backward || keys.left || keys.right)) {
            actualSpeed = speed + 2;
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
            // isHit 상태는 GameCanvas에서 직접 업데이트하므로 여기서는 변경하지 않습니다.
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
                isIdle={!(keys.forward || keys.backward || keys.left || keys.right || keys.jump || keys.runFast || isPunching || isPlayerHitted) && !sitToggle && !lieToggle}
                isPunching={isPunching}
                isHitted={isPlayerHitted} // GameCanvas에서 직접 전달받은 isPlayerHitted prop 사용
            />
        </>
    );
}

// 플레이어 HUD (Head-Up Display) 컴포넌트
function PlayerHUD({ state }) {
    const { health = 100, isHit } = state; // isHit 상태를 받아옵니다.

    const otherPlayersArray = state.otherPlayers ? Array.from(state.otherPlayers.values()) : [];
    const otherPlayersInfo = otherPlayersArray
        .filter(p => p.id !== currentPlayerInfo.id)
        .map(p => {
            const displayNickname = p.nickname || p.id.substring(0, 5); // 닉네임이 없으면 UUID 5글자
            return `ID: ${displayNickname}, Pos: (${p.position?.x?.toFixed(1) || 'N/A'}, ${p.position?.y?.toFixed(1) || 'N/A'}, ${p.position?.z?.toFixed(1) || 'N/A'})`;
        })
        .join('\n');

    const myDisplayNickname = currentPlayerInfo.nickname || currentPlayerInfo.id.substring(0, 5);

    return (
        <>
            <div style={{
                position: 'absolute',
                top: 100,
                left: 20,
                color: 'white',
                fontSize: 14,
                backgroundColor: 'rgba(0,0,0,0.8)',
                padding: 10,
                borderRadius: 8,
                zIndex: 40
            }}>
                <div><strong>Current Player ID:</strong> {currentPlayerInfo.nickname}</div>
                <div><strong>View:</strong> {state.viewMode}</div>
                <div><strong>isGrounded:</strong> {state.isGrounded ? '✅' : '❌'}</div>
                <div><strong>Position:</strong> {state.position}</div>
                <div><strong>Velocity:</strong> {state.velocity}</div>
                <div><strong>Yaw:</strong> {state.yaw?.toFixed(2) ?? 'N/A'}</div>
                <div><strong>Pitch:</strong> {state.pitch?.toFixed(2) ?? 'N/A'}</div>
                <div><strong>Keys:</strong> {state.keys ? Object.entries(state.keys).filter(([, v]) => v).map(([k]) => k).join(', ') : 'N/A'}</div>
                <br />
                <div><strong>-- Other Players --</strong></div>
                {otherPlayersArray.filter(p => p.id !== currentPlayerInfo.id).length > 0 &&
                    <div>Total Other Players: {otherPlayersArray.filter(p => p.id !== currentPlayerInfo.id).length}</div>
                }
                <pre style={{ whiteSpace: 'pre-wrap' }}>{otherPlayersInfo || "No other players"}</pre>
                <div className="mb-2 text-sm">💖 체력: {health} / 100</div>
                {isHit && <div className="mt-2 text-sm text-red-400 animate-pulse">공격받음!</div>}
            </div>
        </>
    );
}

// --- SceneObject 컴포넌트 (변경 없음) ---
function SceneObject({ obj, objectRefs }) {
    const rigidBodyRef = useRef();

    useEffect(() => {
        if (rigidBodyRef.current) {
            objectRefs.current[obj.id] = rigidBodyRef.current;
        }
        return () => {
            if (objectRefs.current[obj.id] === rigidBodyRef.current) {
                delete objectRefs.current[obj.id];
            }
        };
    }, [obj.id, objectRefs]);

    useEffect(() => {
        if (rigidBodyRef.current && obj.position) {
            const newPos = new THREE.Vector3(obj.position.x, obj.position.y, obj.position.z);
            rigidBodyRef.current.setTranslation(newPos, true);
        }
    }, [obj.position]);

    return (
        <RigidBody
            ref={rigidBodyRef}
            position={[obj.position.x, obj.position.y, obj.position.z]}
            colliders={obj.collider}
        >
            <mesh castShadow receiveShadow>
                {/* obj.type이 'box'이면 boxGeometry를, 아니면 sphereGeometry를 사용합니다. */}
                {obj.type === 'box' ? (
                    <boxGeometry args={[obj.size.x, obj.size.y, obj.size.z]} />
                ) : (
                    <sphereGeometry args={[obj.radius, 32, 32]} />
                )}
                <meshStandardMaterial color={obj.color} />
            </mesh>
        </RigidBody>
    );
}

// 메인 App 컴포넌트
export default function App() {
    // sessionStorage에서 'enteredGame' 상태를 로드합니다.
    const [enteredGame, setEnteredGame] = useState(() => {
        const storedEnteredGame = sessionStorage.getItem('enteredGame');
        return storedEnteredGame === 'true'; // 문자열 'true'를 불리언 true로 변환
    });
    const [nicknameInput, setNicknameInput] = useState(currentPlayerInfo.nickname);
    const [nicknameError, setNicknameError] = useState('');

    // enteredGame 상태가 변경될 때마다 sessionStorage에 저장합니다.
    useEffect(() => {
        sessionStorage.setItem('enteredGame', enteredGame.toString());
    }, [enteredGame]);

    const handleGameEntry = () => {
        const trimmedNickname = nicknameInput.trim();
        if (trimmedNickname.length === 0) { // 닉네임이 비어있는 경우도 추가
            setNicknameError('닉네임을 입력해주세요.');
            return;
        }
        if (trimmedNickname.length > 6) {
            setNicknameError('닉네임은 6글자 이하여야 합니다.');
            return;
        }
        if (trimmedNickname.includes(' ')) {
            setNicknameError('닉네임에 공백을 포함할 수 없습니다.');
            return;
        }

        // 닉네임 유효성 검사 통과 시
        localStorage.setItem('myNickname', trimmedNickname);
        currentPlayerInfo.nickname = trimmedNickname; // 전역 currentPlayerInfo 업데이트
        setEnteredGame(true);
    };

    if (enteredGame) {
        return <GameCanvas nickname={currentPlayerInfo.nickname} />;
    }

    return (
        <div
            className="w-screen h-screen bg-cover bg-center flex items-center justify-center"
        // 여기에 배경 이미지 스타일 추가 (tailwind.config.js에서 정의한 경우)
        // style={{ backgroundImage: `url('...')` }}
        >
            {/* 오버레이 블러 + 유리효과 카드 */}
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-10 max-w-lg w-full text-center shadow-2xl border border-white/20">
                <h1 className="text-5xl font-extrabold text-white mb-6 drop-shadow-lg">
                    🕹️ 멀티플레이어 3D 게임
                </h1>
                <p className="text-lg text-gray-100 mb-4">
                    게임 입장을 위해 닉네임을 입력하세요. (최대 6글자, 공백 불가)
                </p>
                <input
                    type="text"
                    value={nicknameInput}
                    onChange={(e) => {
                        setNicknameInput(e.target.value);
                        setNicknameError(''); // 입력 시 에러 메시지 초기화
                    }}
                    placeholder="닉네임을 입력하세요"
                    maxLength={6}
                    className="px-4 py-2 mb-4 w-full rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500 text-gray-800"
                />
                {nicknameError && (
                    <p className="text-red-400 text-sm mb-4">{nicknameError}</p>
                )}
                <button
                    onClick={handleGameEntry}
                    className="px-8 py-3 bg-green-500 hover:bg-green-600 text-white text-lg font-semibold rounded-xl shadow-lg transition-transform transform hover:scale-105 active:scale-95"
                >
                    🚪 게임 입장하기
                </button>
            </div>
        </div>
    );
}
export function GameCanvas({ nickname }) {
    const [hudState, setHudState] = useState({
        health: 100,   // 초기 HP 설정
        isHit: false,  // 피격 상태를 관리하는 새로운 상태
        otherPlayers: new Map(),
    });
    const [sceneObjects, setSceneObjects] = useState([
        {
            id: 'ball1',
            type: 'sphere',
            position: { x: 5, y: 1.5, z: -5 },
            radius: 1,
            color: 'purple',
            collider: 'ball',
        },
        {
            id: 'ball2',
            type: 'sphere',
            position: { x: -5, y: 2.5, z: 5 },
            radius: 1.5,
            color: 'cyan',
            collider: 'ball',
        },
        {
            id: 'ball3',
            type: 'sphere',
            position: { x: 0, y: 3.5, z: 7 },
            radius: 0.8,
            color: 'gold',
            collider: 'ball',
        },
        {
            id: 'ball4',
            type: 'sphere',
            position: { x: 8, y: 1, z: 0 },
            radius: 0.6,
            color: 'red',
            collider: 'ball',
        },
        {
            id: 'ball5',
            type: 'sphere',
            position: { x: -8, y: 1, z: -8 },
            radius: 1.2,
            color: 'lime',
            collider: 'ball',
        },
        {
            id: 'myBox1',
            type: 'box',
            position: { x: 3, y: 0.5, z: -2 },
            size: { x: 2, y: 1, z: 2 },
            color: 'red',
            collider: 'cuboid',
        },
    ]);
    const objectRefs = useRef({});

    // STOMP 클라이언트를 App 컴포넌트 상태로 관리 (한 번만 초기화)
    const [stompClient, setStompClient] = useState(null);

    // 웹소켓 연결 및 구독 로직 (App 컴포넌트에서 단 한번 실행)
    useEffect(() => {
        const WS_URL = 'http://localhost:8080/ws';
        const socket = new SockJS(WS_URL);
        const client = new Client({
            webSocketFactory: () => socket,
            reconnectDelay: 5000,
            heartbeatIncoming: 4000,
            heartbeatOutgoing: 4000,
        });

        client.onConnect = (frame) => {
            console.log("[STOMP] Connected to WebSocket from App.jsx!", frame);

            // 플레이어 위치 구독
            client.subscribe('/topic/playerLocations', (message) => {
                try {
                    console.log("[STOMP] Received playerLocations:", message.body); // 이 줄을 추가
                    const allPlayerPositions = JSON.parse(message.body);
                    // Map 객체로 변환하여 효율적으로 관리
                    // window.onlinePlayers에 Map 객체 저장
                    window.onlinePlayers = new Map(allPlayerPositions.map(p => [p.id, p]));
                    setHudState(prev => ({
                        ...prev,
                        otherPlayers: window.onlinePlayers // Map 객체로 저장
                    }));
                } catch (e) {
                    console.error("[STOMP Subscribe] Failed to parse player locations message:", e, message.body);
                }
            });

            // 오브젝트 상태 구독
            client.subscribe('/topic/sceneObjects', (message) => {
                try {
                    const updatedObjects = JSON.parse(message.body);
                    handleSceneObjectsUpdate(updatedObjects);
                } catch (e) {
                    console.error("[STOMP Subscribe] Failed to parse scene objects message:", e, message.body);
                }
            });

            // 플레이어 피격 메시지 구독
            client.subscribe('/topic/playerHit', (message) => {
                try {
                    const data = JSON.parse(message.body);
                    console.log('[STOMP] playerHit 메시지 수신:', data);

                    // 현재 클라이언트가 피격자일 경우 (내 캐릭터)
                    if (data.targetId === currentPlayerInfo.id) {
                        console.log('💢 GameCanvas: 내가 맞았습니다! isHit 상태 true로 설정.');
                        setHudState(prev => ({
                            ...prev,
                            isHit: true, // 내 HUD와 내 CharacterModel에 적용될 상태
                            health: Math.max((prev.health ?? 100) - 10, 0), // 체력 감소
                        }));

                        setTimeout(() => {
                            console.log('💢 GameCanvas: isHit 상태 false로 재설정.');
                            setHudState(prev => ({ ...prev, isHit: false }));
                        }, 500); // 0.5초 후 초기화 (애니메이션 길이에 맞게 조절)
                    } else {
                        // 다른 플레이어가 피격자일 경우 (다른 플레이어 캐릭터)
                        setHudState(prev => {
                            const newOtherPlayers = new Map(prev.otherPlayers);
                            const targetPlayer = newOtherPlayers.get(data.targetId);
                            if (targetPlayer) {
                                console.log(`💥 GameCanvas: 다른 플레이어 ${data.targetId.substring(0, 5)}가 맞았습니다!`);
                                // 타겟 플레이어의 animationState에 isHitted를 true로 설정
                                newOtherPlayers.set(data.targetId, {
                                    ...targetPlayer,
                                    animationState: {
                                        ...targetPlayer.animationState,
                                        isHitted: true,
                                    },
                                });

                                // 일정 시간 후 isHitted 상태를 false로 되돌림
                                setTimeout(() => {
                                    setHudState(innerPrev => {
                                        const innerNewOtherPlayers = new Map(innerPrev.otherPlayers);
                                        const innerTargetPlayer = innerNewOtherPlayers.get(data.targetId);
                                        if (innerTargetPlayer) {
                                            console.log(`💥 GameCanvas: 다른 플레이어 ${data.targetId.substring(0, 5)} isHitted 상태 false로 재설정.`);
                                            innerNewOtherPlayers.set(data.targetId, {
                                                ...innerTargetPlayer,
                                                animationState: {
                                                    ...innerTargetPlayer.animationState,
                                                    isHitted: false,
                                                },
                                            });
                                        }
                                        return { ...innerPrev, otherPlayers: innerNewOtherPlayers };
                                    });
                                }, 500); // 애니메이션 지속 시간에 맞게 조절

                            }
                            return { ...prev, otherPlayers: newOtherPlayers };
                        });
                    }

                    // (선택) 내가 공격자일 경우 UI 처리하거나 무시
                    if (data.fromId === currentPlayerInfo.id) {
                        console.log('🥊 GameCanvas: 내가 공격했습니다!');
                    }

                } catch (e) {
                    console.error('[STOMP Subscribe] playerHit 메시지 파싱 실패:', e);
                }
            });

            // 연결 성공 후 stompClient 상태 설정
            setStompClient(client);
        };

        client.onStompError = (frame) => {
            console.error('STOMP Error from App.jsx:', frame);
        };

        client.onDisconnect = () => {
            console.log('[STOMP] Disconnected from WebSocket from App.jsx.');
            setStompClient(null); // 연결 해제 시 클라이언트 상태 null로
        };

        client.activate();

        // 컴포넌트 언마운트 시 웹소켓 연결 해제
        return () => {
            const handleBeforeUnload = () => {
                if (client && client.connected) {
                    client.publish({ destination: '/app/unregisterPlayer', body: JSON.stringify({ id: currentPlayerInfo.id }) });
                    client.deactivate();
                }
            };
            window.addEventListener('beforeunload', handleBeforeUnload);

            if (client && client.connected) {
                client.publish({ destination: '/app/unregisterPlayer', body: JSON.stringify({ id: currentPlayerInfo.id }) });
                client.deactivate();
            }
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, []); // 빈 배열: 컴포넌트 마운트 시 단 한 번만 실행

    // 서버에서 받은 오브젝트 상태를 업데이트하는 콜백 함수
    const handleSceneObjectsUpdate = useCallback((updatedObjects) => {
        setSceneObjects(prevObjects => {
            const newObjectsMap = new Map(prevObjects.map(obj => [obj.id, obj]));
            updatedObjects.forEach(updatedObj => {
                const currentObj = newObjectsMap.get(updatedObj.id);
                if (currentObj) {
                    newObjectsMap.set(updatedObj.id, { ...currentObj, position: updatedObj.position });
                } else {
                    newObjectsMap.set(updatedObj.id, {
                        ...updatedObj,
                        type: updatedObj.type || 'sphere',
                        radius: updatedObj.radius || 1,
                        color: updatedObj.color || 'gray',
                        collider: updatedObj.collider || 'ball',
                    });
                }
            });
            return Array.from(newObjectsMap.values());
        });
    }, []);

    return (
        <>
            <Leva collapsed={false} />
            <PlayerHUD state={hudState} />

            <KeyboardControls map={controlsMap}>
                <Canvas
                    shadows
                    camera={{ fov: 60, position: [0, 5, 10] }}
                    style={{ width: '100vw', height: '100vh' }}
                    linear={false}
                >
                    {/* 배경색을 어둡게 설정합니다. */}
                    <color attach="background" args={['#8fafdb']} />

                    <ambientLight intensity={0.5} />
                    <directionalLight position={[5, 10, 5]} intensity={1} castShadow />
                    <Physics gravity={[0, -9.81, 0]}>
                        {/* 바닥 (고정된 물리 객체) */}
                        <RigidBody type="fixed">
                            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                                <planeGeometry args={[100, 100]} />
                                <meshStandardMaterial color="green" />
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

                        {/* 현재 플레이어 컴포넌트: stompClient와 isHit 상태를 prop으로 전달 */}
                        {stompClient && ( // stompClient가 초기화된 후에만 Player 렌더링
                            <Player
                                onHudUpdate={setHudState}
                                objectRefs={objectRefs}
                                stompClientInstance={stompClient} // stompClient 인스턴스 전달
                                isPlayerHitted={hudState.isHit} // GameCanvas의 isHit 상태를 직접 prop으로 전달
                                nickname={nickname}
                            />
                        )}

                        {/* 다른 플레이어들 렌더링 */}
                        {hudState.otherPlayers && Array.from(hudState.otherPlayers.values()).map((player) => (
                            player.id !== currentPlayerInfo.id && (
                                <OtherPlayer
                                    key={player.id}
                                    id={player.id}
                                    nickname={player.nickname}
                                    position={player.position}
                                    rotationY={player.rotationY}
                                    animationState={player.animationState}
                                />
                            )
                        ))}

                        {/* 물리 상호작용을 위한 구체 오브젝트들 (SceneObject 컴포넌트로 대체) */}
                        {sceneObjects.map((obj) => (
                            <SceneObject
                                key={obj.id}
                                obj={obj}
                                objectRefs={objectRefs}
                            />
                        ))}

                    </Physics>
                </Canvas>
            </KeyboardControls>
        </>
    );
}
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
// CharacterModel, CharacterModel2, CharacterModel3 임포트
import { CharacterModel} from './CharacterModel';

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

// 플레이어 ID를 localStorage에서 로드하거나 새로 생성합니다.
const getOrCreatePlayerId = () => {
    let storedPlayerId = localStorage.getItem('myPlayerId');
    if (!storedPlayerId) {
        storedPlayerId = uuidv4();
        localStorage.setItem('myPlayerId', storedPlayerId);
    }
    return storedPlayerId;
};

const currentPlayerId = getOrCreatePlayerId();

// --- OtherPlayer 컴포넌트 ---
// 다른 플레이어의 모델, 위치, 애니메이션 상태를 렌더링합니다.
function OtherPlayer({ id, position, rotationY, animationState }) {
    const rigidBodyRef = useRef(); // RigidBody에 대한 ref
    const modelGroupRef = useRef(); // 모델 그룹에 대한 ref

    // OtherPlayer가 마운트될 때 로그를 추가하여 어떤 모델이 선택되는지 확인
    useEffect(() => {
        console.log(`[OtherPlayer] Mounted: ID: ${id.substring(0, 5)} - Initial Position: (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);
        let modelTypeName;
       
        modelTypeName = 'CharacterModel (character.glb)';
       
        console.log(`[OtherPlayer] ID: ${id.substring(0, 5)} assigned model type: ${modelTypeName}`);
    }, [id, position]);

    useFrame(() => {
        if (rigidBodyRef.current && position) {
            const newPos = new THREE.Vector3(position.x, position.y, position.z);
            rigidBodyRef.current.setTranslation(newPos, true);
        }

        if (modelGroupRef.current) {
            modelGroupRef.current.rotation.y = THREE.MathUtils.lerp(modelGroupRef.current.rotation.y, rotationY + Math.PI, 0.2);
        }
    });

    const safeAnimationState = animationState || {};

    // ID 문자열의 모든 문자의 아스키 코드 값을 합산하여 더 균등한 분포를 만듭니다.
    const CharacterToRender = useMemo(() => {

        return CharacterModel;

    }, [id]);

    return (
        <RigidBody
            ref={rigidBodyRef}
            position={[position.x, position.y, position.z]}
            colliders={false}
            type="kinematicPosition"
            enabledRotations={[false, false, false]}
        >
            <CapsuleCollider args={[0.35, 0.4]} />

            <group ref={modelGroupRef} position-y={-1.65}>
                {/* 결정된 CharacterToRender 컴포넌트를 렌더링합니다. */}
                {CharacterToRender && (
                    <CharacterToRender {...safeAnimationState} />
                )}
            </group>

            <Text
                position={[0, 2.6 - 0.725, 0]}
                fontSize={0.2}
                color="black"
                anchorX="center"
                anchorY="middle"
                billboard
            >
                {id.substring(0, 5)}
            </Text>
        </RigidBody>
    );
}

// 두 플레이어 간의 히트 여부를 확인하는 함수
function checkHit(attackerPos, attackerQuat, targetPos) {
    const attacker = new THREE.Vector3(attackerPos.x, attackerPos.y, attackerPos.z);
    const target = new THREE.Vector3(targetPos.x, targetPos.y, targetPos.z);
    const directionToTarget = target.clone().sub(attacker);
    const distance = directionToTarget.length();

    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(attackerQuat).normalize(); // 정규화 추가

    // targetPos가 attackerPos와 동일할 경우 angleTo가 NaN이 될 수 있으므로 예외 처리
    if (distance < 0.001) return false; // 거리가 너무 가까우면 충돌로 보지 않음

    const angle = forward.angleTo(directionToTarget);

    return distance < 1.2 && angle < Math.PI / 4;
}

// --- Player 컴포넌트 (현재 플레이어의 로직) ---
function Player({ onHudUpdate, objectRefs, stompClientInstance, isPlayerHitted }) {
    const { camera, gl } = useThree();
    const [subscribeKeys, getKeys] = useKeyboardControls();
    const [sitToggle, setSitToggle] = useState(false);
    const [lieToggle, setLieToggle] = useState(false);
    const playerRef = useRef();
    const modelRef = useRef();
    const [isGrounded, setIsGrounded] = useState(false);
    const [viewMode, setViewMode] = useState('firstPerson');
    const [isPunching, setIsPunching] = useState(false);

    const pitch = useRef(0);
    const yaw = useRef(0);

    const { speed, jumpImpulse } = useControls({
        speed: { value: 5, min: 1, max: 2000 },
        jumpImpulse: { value: 3, min: 1, max: 50 }
    });

    const toggleViewPressed = useRef(false);

    // 펀치 시 타격 감지 및 서버 전송 로직
    useEffect(() => {
        if (!isPunching || !stompClientInstance || !stompClientInstance.connected) return;

        const attackerPos = playerRef.current?.translation();
        const attackerQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw.current, 0));

        (window.onlinePlayers || new Map()).forEach((targetPlayer, id) => {
            if (id === currentPlayerId) return;

            const targetPos = targetPlayer.position;
            const isHit = checkHit(attackerPos, attackerQuat, targetPos);

            if (isHit) {
                console.log(`[🥊 Player] 타격 성공 -> 대상: ${id}`);
                stompClientInstance.publish({
                    destination: '/app/playerHit',
                    body: JSON.stringify({
                        fromId: currentPlayerId,
                        targetId: id,
                    }),
                });
            }
        });
    }, [isPunching, stompClientInstance]);

    // 컴포넌트 마운트 시 초기 플레이어 등록
    useEffect(() => {
        if (stompClientInstance && stompClientInstance.connected) {
            console.log("[Player] Initial player registration upon mount.");
            const initialPlayerState = {
                id: currentPlayerId,
                position: { x: 0, y: 0, z: 0 },
                rotationY: yaw.current + Math.PI,
                animationState: {
                    isWalking: false, isBackward: false, isLeft: false, isRight: false,
                    isJumping: false, isRunning: false, isSitted: false, isSittedAndWalk: false,
                    isLyingDown: false, isLyingDownAndWalk: false, isPunching: false, isHitted: false, isIdle: true // isHitted 추가
                }
            };
            stompClientInstance.publish({
                destination: '/app/registerPlayer',
                body: JSON.stringify(initialPlayerState)
            });
        }
    }, [stompClientInstance]);

    // 'C' (앉기) 및 'Z' (눕기) 토글 로직
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.code === 'KeyC') {
                setSitToggle(prev => {
                    const next = !prev;
                    if (next) setLieToggle(false);
                    return next;
                });
            }
            if (e.code === 'KeyZ') {
                setLieToggle(prev => {
                    const next = !prev;
                    if (next) setSitToggle(false);
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
            if (e.button === 0) {
                setIsPunching(true);
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
        // yaw 값을 -PI에서 PI 사이로 정규화 (시점 깨짐 방지)
        yaw.current = (yaw.current + Math.PI) % (2 * Math.PI) - Math.PI;

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

    // 매 프레임마다 플레이어 및 오브젝트 움직임과 서버 업데이트 로직
    useFrame(() => {
        const keys = getKeys();
        const vel = playerRef.current?.linvel() || { x: 0, y: 0, z: 0 };
        const pos = playerRef.current?.translation() || { x: 0, y: 0, z: 0 };

        if (stompClientInstance && stompClientInstance.connected) {
            const playerState = {
                id: currentPlayerId,
                position: { x: pos.x, y: pos.y, z: pos.z },
                rotationY: yaw.current + Math.PI,
                animationState: {
                    isWalking: keys.forward, isBackward: keys.backward, isLeft: keys.left, isRight: keys.right,
                    isJumping: keys.jump, isRunning: keys.runFast && (keys.forward || keys.left || keys.right || keys.backward),
                    isSitted: sitToggle, isSittedAndWalk: sitToggle && (keys.forward || keys.left || keys.right || keys.backward),
                    isLyingDown: lieToggle, isLyingDownAndWalk: lieToggle && (keys.forward || keys.left || keys.right || keys.backward),
                    isPunching: isPunching,
                    isHitted: isPlayerHitted, // isHitted 상태 전달
                    isIdle: !(keys.forward || keys.backward || keys.left || keys.right || keys.jump || keys.runFast || isPunching || isPlayerHitted) && !sitToggle && !lieToggle
                }
            };
            stompClientInstance.publish({
                destination: `/app/playerMove`,
                body: JSON.stringify(playerState)
            });

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

        if (keys.jump && isGrounded && vel.y <= 0.1) {
            playerRef.current.applyImpulse({ x: 0, y: jumpImpulse, z: 0 }, true);
            setIsGrounded(false);
        }

        const playerBodyPos = new THREE.Vector3(pos.x, pos.y, pos.z);
        const headOffset = new THREE.Vector3(0, 0.3, 0);

        if (modelRef.current) {
            modelRef.current.position.copy(playerBodyPos);
            modelRef.current.position.y += -0.725;
            modelRef.current.visible = viewMode === 'thirdPerson';

            const horizontalMovementLengthSq = vx * vx + vz * vz;
            if (horizontalMovementLengthSq > 0.01) {
                const targetRotationY = Math.atan2(vx, vz);
                modelRef.current.rotation.y = THREE.MathUtils.lerp(modelRef.current.rotation.y, targetRotationY, 0.15);
            } else {
                modelRef.current.rotation.y = THREE.MathUtils.lerp(modelRef.current.rotation.y, yaw.current, 0.15);
            }
        }

        if (viewMode === 'firstPerson') {
            const cameraPosition = playerBodyPos.clone().add(headOffset);
            camera.position.copy(cameraPosition);
            const cameraRotation = new THREE.Euler(pitch.current, yaw.current + Math.PI, 0, 'YXZ');
            camera.quaternion.setFromEuler(cameraRotation);
        } else {
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
                isIdle={!(keys.forward || keys.backward || keys.left || keys.right || keys.jump || keys.runFast || isPunching || isPlayerHitted) && !sitToggle && !lieToggle}
                isPunching={isPunching}
                isHitted={isPlayerHitted} // isHitted prop 전달
            />
        </>
    );
}

// 플레이어 HUD (Head-Up Display) 컴포넌트
function PlayerHUD({ state }) {
    const { health = 100, isHit } = state;

    const otherPlayersArray = state.otherPlayers ? Array.from(state.otherPlayers.values()) : [];
    const otherPlayersInfo = otherPlayersArray
        .filter(p => p.id !== currentPlayerId)
        .map(p => `ID: ${p.id.substring(0, 5)}, Pos: (${p.position?.x?.toFixed(1) || 'N/A'}, ${p.position?.y?.toFixed(1) || 'N/A'}, ${p.position?.z?.toFixed(1) || 'N/A'})`)
        .join('\n');

    return (
        <>
            <div style={{
                position: 'absolute',
                top: 10,
                left: 20,
                color: 'white',
                fontSize: 14,
                backgroundColor: 'rgba(0,0,0,0.8)',
                padding: 10,
                borderRadius: 8,
                zIndex: 40
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
                {otherPlayersArray.filter(p => p.id !== currentPlayerId).length > 0 &&
                    <div>Total Other Players: {otherPlayersArray.filter(p => p.id !== currentPlayerId).length}</div>
                }
                <pre style={{ whiteSpace: 'pre-wrap' }}>{otherPlayersInfo || "No other players"}</pre>
            </div>
            <div style={{
                position: 'absolute',
                bottom: 10,
                left: 20,
                color: 'white',
                fontSize: 30,
                backgroundColor: 'rgba(0,0,0,0.8)',
                padding: 10,
                borderRadius: 8,
                zIndex: 40
            }}>
                <div className="mb-2 text-sm">💖 HP: {health} / 100 {isHit && <span className="mt-2 text-sm text-red-400 animate-pulse">공격받음!</span>}</div>          
            </div>
        </>
    );
}

// --- SceneObject 컴포넌트 ---
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
    const [enteredGame, setEnteredGame] = useState(false);

    if (enteredGame) {
        return <GameCanvas />;
    }

    return (
        <div
            className="w-screen h-screen bg-cover bg-center flex items-center justify-center"
        >
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-10 max-w-lg w-full text-center shadow-2xl border border-white/20">
                <h1 className="text-5xl font-extrabold text-white mb-6 drop-shadow-lg">
                    🕹️ 멀티플레이어 3D 게임
                </h1>
                <p className="text-lg text-gray-100 mb-8">
                    아래 버튼을 눌러 게임을 시작하세요.
                </p>
                <button
                    onClick={() => setEnteredGame(true)}
                    className="px-8 py-3 bg-green-500 hover:bg-green-600 text-white text-lg font-semibold rounded-xl shadow-lg transition-transform transform hover:scale-105 active:scale-95"
                >
                    🚪 게임 입장하기
                </button>
            </div>
        </div>
    );
}

// React Error Boundary 컴포넌트
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                    backgroundColor: 'rgba(255, 0, 0, 0.8)', color: 'white', padding: '20px', borderRadius: '10px',
                    textAlign: 'center', zIndex: 1000
                }}>
                    <h2>게임 중 오류가 발생했습니다!</h2>
                    <p>콘솔을 확인하여 상세 오류를 파악해주세요.</p>
                    {this.state.error && <p>오류: {this.state.error.message}</p>}
                    <button
                        onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
                        style={{ marginTop: '10px', padding: '8px 15px', backgroundColor: '#fff', color: '#000', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                    >
                        다시 시도
                    </button>
                    <button
                        onClick={() => window.location.reload()}
                        style={{ marginTop: '10px', marginLeft: '10px', padding: '8px 15px', backgroundColor: '#fff', color: '#000', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                    >
                        페이지 새로고침
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}


export function GameCanvas() {
    const [hudState, setHudState] = useState({
        health: 100,
        isHit: false,
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

    const [stompClient, setStompClient] = useState(null);

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

            client.subscribe('/topic/playerLocations', (message) => {
                try {
                    const allPlayerPositions = JSON.parse(message.body);
                    console.log(`[STOMP Rx] Raw message body:`, message.body);
                    console.log(`[STOMP Rx] Parsed allPlayerPositions:`, allPlayerPositions);
                    window.onlinePlayers = new Map(allPlayerPositions.map(p => [p.id, p]));
                    console.log(`[STOMP Rx] window.onlinePlayers updated. Size: ${window.onlinePlayers.size}`);
                    console.log(`[STOMP Rx] Current otherPlayers IDs:`, Array.from(window.onlinePlayers.keys()));

                    setHudState(prev => ({
                        ...prev,
                        otherPlayers: window.onlinePlayers
                    }));
                } catch (e) {
                    console.error("[STOMP Subscribe] Failed to parse player locations message:", e, message.body);
                }
            });

            client.subscribe('/topic/sceneObjects', (message) => {
                try {
                    const updatedObjects = JSON.parse(message.body);
                    handleSceneObjectsUpdate(updatedObjects);
                }
                catch (e) {
                    console.error("[STOMP Subscribe] Failed to parse scene objects message:", e, message.body);
                }
            });

            client.subscribe('/topic/playerHit', (message) => {
                try {
                    const data = JSON.parse(message.body);
                    console.log('[STOMP] playerHit 메시지 수신:', data);

                    if (data.targetId === currentPlayerId) {
                        console.log('💢 GameCanvas: 내가 맞았습니다! isHit 상태 true로 설정.');
                        setHudState(prev => ({
                            ...prev,
                            isHit: true,
                            health: Math.max((prev.health ?? 100) - 10, 0),
                        }));

                        setTimeout(() => {
                            console.log('💢 GameCanvas: isHit 상태 false로 재설정.');
                            setHudState(prev => ({ ...prev, isHit: false }));
                        }, 500);
                    } else {
                        setHudState(prev => {
                            const newOtherPlayers = new Map(prev.otherPlayers);
                            const targetPlayer = newOtherPlayers.get(data.targetId);
                            if (targetPlayer) {
                                console.log(`💥 GameCanvas: 다른 플레이어 ${data.targetId.substring(0, 5)}가 맞았습니다!`);
                                newOtherPlayers.set(data.targetId, {
                                    ...targetPlayer,
                                    animationState: {
                                        ...targetPlayer.animationState,
                                        isHitted: true,
                                    },
                                });

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
                                }, 500);

                            }
                            return { ...prev, otherPlayers: newOtherPlayers };
                        });
                    }

                    if (data.fromId === currentPlayerId) {
                        console.log('🥊 GameCanvas: 내가 공격했습니다!');
                    }

                } catch (e) {
                    console.error('[STOMP Subscribe] playerHit 메시지 파싱 실패:', e);
                }
            });

            setStompClient(client);
        };

        client.onStompError = (frame) => {
            console.error('STOMP Error from App.jsx:', frame);
        };

        client.onDisconnect = () => {
            console.log('[STOMP] Disconnected from WebSocket from App.jsx.');
            setStompClient(null);
        };

        client.activate();

        return () => {
            const handleBeforeUnload = () => {
                if (client && client.connected) {
                    client.publish({ destination: '/app/unregisterPlayer', body: JSON.stringify({ id: currentPlayerId }) });
                    client.deactivate();
                }
            };
            window.addEventListener('beforeunload', handleBeforeUnload);

            if (client && client.connected) {
                client.publish({ destination: '/app/unregisterPlayer', body: JSON.stringify({ id: currentPlayerId }) });
                client.deactivate();
            }
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, []);

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
                    <color attach="background" args={['#8fafdb']} />

                    <ambientLight intensity={0.5} />
                    <directionalLight position={[5, 10, 5]} intensity={1} castShadow />
                    <Physics gravity={[0, -9.81, 0]}>
                        <RigidBody type="fixed">
                            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                                <planeGeometry args={[100, 100]} />
                                <meshStandardMaterial color="green" />
                            </mesh>
                        </RigidBody>

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

                        {/* ErrorBoundary와 Suspense로 모델 로딩 오류 처리 및 로딩 중 대체 UI 제공 */}
                        <ErrorBoundary>
                            <React.Suspense fallback={<Text position={[0, 1, 0]} color="black">플레이어 로딩 중...</Text>}>
                                {stompClient && (
                                    <Player
                                        onHudUpdate={setHudState}
                                        objectRefs={objectRefs}
                                        stompClientInstance={stompClient}
                                        isPlayerHitted={hudState.isHit}
                                    />
                                )}
                            </React.Suspense>
                        </ErrorBoundary>

                        {hudState.otherPlayers && Array.from(hudState.otherPlayers.values()).map((player) => {
                            if (player.id === currentPlayerId) {
                                console.log(`[OtherPlayer Render Check] Skipping self: ${player.nickname} (${player.id})`);
                                return null;
                            }
                            console.log(`[OtherPlayer Render Check] Preparing to render: ${player.nickname} (${player.id})`);
                            return (
                                <ErrorBoundary key={`other-player-error-${player.id}`}>
                                    <React.Suspense fallback={<Text position={[player.position.x, player.position.y + 1, player.position.z]} color="gray">다른 플레이어 로딩 중...</Text>}>
                                        <OtherPlayer
                                            key={player.id}
                                            id={player.id}
                                            nickname={player.nickname}
                                            position={player.position}
                                            rotationY={player.rotationY}
                                            animationState={player.animationState}
                                        />
                                    </React.Suspense>
                                </ErrorBoundary>
                            );
                        })}

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
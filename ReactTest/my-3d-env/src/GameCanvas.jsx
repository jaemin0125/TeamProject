// GameCanvas.jsx
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Canvas, extend } from '@react-three/fiber';
import { KeyboardControls, Text } from '@react-three/drei';
import { Physics, RigidBody } from '@react-three/rapier';
import { Leva } from 'leva';
import * as THREE from 'three';
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { GModMap } from './Map';

// Local Imports
import { Player } from './Player';
import { OtherPlayer } from './OtherPlayer';
import { SceneObject } from './SceneObject';
import { PlayerHUD } from './PlayerHUD';
import { controlsMap, getOrCreatePlayerInfo } from './utils/constants'; // utils 폴더에서 임포트

// H2 오류 해결을 위한 임시 확장 (CharacterModel 내부의 미확인 객체에 대한 추정)
// CharacterModel에서 H2라는 이름으로 어떤 Three.js 객체를 생성하려고 시도하는 것으로 보입니다.
// 정확한 해결을 위해서는 CharacterModel.jsx 파일을 확인하여 H2가 무엇을 의미하는지 파악하고
// 해당 Three.js 클래스를 여기에 extend 해야 합니다.
// 현재는 임시로 Object3D를 H2로 등록하여 렌더링 오류를 회피합니다.
class H2DummyObject extends THREE.Object3D {}
extend({ H2: H2DummyObject });

class PDummyObject extends THREE.Object3D {}
extend({ P: PDummyObject }); // <--- 이 부분을 추가합니다.

class ButtonDummyObject extends THREE.Object3D {}
extend({ Button: ButtonDummyObject }); // 또는 extend({ Button: THREE.Mesh });
class DivDummyObject extends THREE.Object3D {}
extend({ Div: DivDummyObject });
// 현재 플레이어 ID를 가져옵니다.
const { id: currentPlayerId} = getOrCreatePlayerInfo();


// React Error Boundary 컴포넌트
// 자식 컴포넌트에서 발생하는 오류를 잡아내어 대체 UI를 렌더링합니다.
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    // 오류 발생 시 상태를 업데이트하여 다음 렌더링에서 대체 UI를 보여줍니다.
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    // 오류 정보를 로깅합니다.
    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    render() {
        if (this.state.hasError) {
            // 오류 발생 시 보여줄 대체 UI
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

// GameCanvas 컴포넌트: 게임의 주요 렌더링 및 로직을 담당합니다.
export function GameCanvas({playerNickname}) {
    // HUD 상태 관리 (체력, 피격 여부, 다른 플레이어 정보, 사망 여부, 시점, 리스폰 진행도)
    const [hudState, setHudState] = useState({
        health: 100,
        isHit: false,
        otherPlayers: new Map(),
        isDead: false, // isDead 상태를 GameCanvas로 올림
        viewMode: 'firstPerson', // GameCanvas에서도 viewMode 상태를 관리
        respawnProgress: 0, // 리스폰 진행도 상태 추가
    });
    // 씬에 배치될 오브젝트들의 초기 상태
    const [sceneObjects, setSceneObjects] = useState([
        // {
        //     id: 'ball1',
        //     type: 'sphere',
        //     position: { x: 5, y: 1.5, z: -5 },
        //     radius: 1,
        //     color: 'purple',
        //     collider: 'ball',
        // },
        // {
        //     id: 'ball2',
        //     type: 'sphere',
        //     position: { x: -5, y: 2.5, z: 5 },
        //     radius: 1.5,
        //     color: 'cyan',
        //     collider: 'ball',
        // },
        // {
        //     id: 'ball3',
        //     type: 'sphere',
        //     position: { x: 0, y: 3.5, z: 7 },
        //     radius: 0.8,
        //     color: 'gold',
        //     collider: 'ball',
        // },
        // {
        //     id: 'ball4',
        //     type: 'sphere',
        //     position: { x: 8, y: 1, z: 0 },
        //     radius: 0.6,
        //     color: 'red',
        //     collider: 'ball',
        // },
        // {
        //     id: 'ball5',
        //     type: 'sphere',
        //     position: { x: -8, y: 1, z: -8 },
        //     radius: 1.2,
        //     color: 'lime',
        //     collider: 'ball',
        // },
        // {
        //     id: 'myBox1',
        //     type: 'box',
        //     position: { x: 3, y: 0.5, z: -2 },
        //     size: { x: 2, y: 1, z: 2 },
        //     color: 'red',
        //     collider: 'cuboid',
        // },
    ]);
    // 씬 오브젝트들의 RigidBody 참조를 저장하는 useRef
    const objectRefs = useRef({});

    // STOMP 클라이언트 상태
    const [stompClient, setStompClient] = useState(null);

    // isDead 상태를 직접 제어하는 함수를 HUD 업데이트 함수와 분리
    const setIsDeadInGameCanvas = useCallback((deadState) => {
        setHudState(prev => ({ ...prev, isDead: deadState }));
    }, []);

    // Player 컴포넌트에서 viewMode를 업데이트할 수 있도록 함수 전달
    const setViewModeInGameCanvas = useCallback((mode) => {
        setHudState(prev => ({ ...prev, viewMode: mode }));
    }, []);


    // 플레이어 죽음 및 리스폰 로직 (GameCanvas에서 관리)
    useEffect(() => {
        let respawnTimer;
        let progressInterval;

        // isDead 상태가 true가 될 때만 리스폰 타이머와 진행도 인터벌을 시작
        if (hudState.isDead) {
            console.log("플레이어 사망! 리스폰 타이머 시작 (5초)...");
            // 사망 시 1인칭 시점으로 강제 변경
            setViewModeInGameCanvas('firstPerson');

            // 진행도 초기화 및 인터벌 시작
            setHudState(prev => ({ ...prev, respawnProgress: 0 })); // 사망 시 진행도 0으로 리셋
            let currentProgress = 0;
            progressInterval = setInterval(() => {
                currentProgress += 0.1; // 100ms마다 0.1초씩 증가 (총 5초)
                if (currentProgress >= 5) {
                    currentProgress = 5; // 5초 이상 넘어가지 않도록 제한
                    clearInterval(progressInterval); // 인터벌 종료
                }
                setHudState(prev => ({ ...prev, respawnProgress: currentProgress }));
            }, 100); // 100ms마다 업데이트

            // 실제 리스폰 타이머
            respawnTimer = setTimeout(() => {
                console.log("플레이어 리스폰 중...");
                // HP 100으로 리셋, isDead 상태 해제, 진행도 0으로 리셋
                setHudState(prev => ({ ...prev, health: 100, isDead: false, respawnProgress: 0 }));
                console.log("플레이어가 리스폰되었습니다.");

                if (stompClient && stompClient.connected) {
                    stompClient.publish({
                        destination: '/app/playerRespawn',
                        body: JSON.stringify({
                            id: currentPlayerId,
                            position: { x: 0, y: 1.1, z: 0 }, // 서버에 리스폰 위치 전달
                            health: 100
                        })
                    });
                }
            }, 5000); // 5초 후 리스폰

        }

        // Cleanup function for useEffect (컴포넌트 언마운트 또는 isDead 상태 변경 시 타이머/인터벌 정리)
        return () => {
            if (respawnTimer) {
                clearTimeout(respawnTimer);
                console.log("리스폰 타이머 클리어됨.");
            }
            if (progressInterval) {
                clearInterval(progressInterval);
                console.log("진행도 인터벌 클리어됨.");
            }
        };
    }, [hudState.isDead, stompClient, setHudState, setViewModeInGameCanvas]); // 의존성 배열

    // STOMP WebSocket 연결 및 메시지 구독 로직
    useEffect(() => {
        const WS_URL = 'http://localhost:8080/ws'; // WebSocket 서버 URL
        const socket = new SockJS(WS_URL); // SockJS를 사용하여 WebSocket 연결
        const client = new Client({
            webSocketFactory: () => socket, // SockJS 소켓 팩토리 설정
            reconnectDelay: 5000, // 재연결 지연 시간
            heartbeatIncoming: 4000, // 인바운드 하트비트
            heartbeatOutgoing: 4000, // 아웃바운드 하트비트
        });

        // STOMP 클라이언트 연결 시
        client.onConnect = (frame) => {
            //console.log("[STOMP] Connected to WebSocket from App.jsx!", frame);

            // 플레이어 위치 정보 구독
            client.subscribe('/topic/playerLocations', (message) => {
                try {
                    const allPlayerPositions = JSON.parse(message.body);
                    window.onlinePlayers = new Map(allPlayerPositions.map(p => [p.id, p]));
                    setHudState(prev => ({
                        ...prev,
                        otherPlayers: window.onlinePlayers
                    }));
                } catch (e) {
                    console.error("[STOMP Subscribe] Failed to parse player locations message:", e, message.body);
                }
            });

            // 씬 오브젝트 정보 구독
            client.subscribe('/topic/sceneObjects', (message) => {
                try {
                    const updatedObjects = JSON.parse(message.body);
                    handleSceneObjectsUpdate(updatedObjects);
                }
                catch (e) {
                    console.error("[STOMP Subscribe] Failed to parse scene objects message:", e, message.body);
                }
            });

            // 플레이어 피격 정보 구독
            client.subscribe('/topic/playerHit', (message) => {
                try {
                    const data = JSON.parse(message.body);
                    console.log('[STOMP] playerHit 메시지 수신:', data);

                    if (data.targetId === currentPlayerId) {
                        console.log('💢 GameCanvas: 내가 맞았습니다! isHit 상태 true로 설정.');
                        setHudState(prev => {
                            const newHealth = Math.max((prev.health ?? 100) - 10, 0); // 체력 감소
                            return {
                                ...prev,
                                isHit: true,
                                health: newHealth,
                                isDead: newHealth <= 0 // HP가 0 이하면 isDead 상태를 true로 설정
                            };
                        });

                        // 0.5초 후 isHit 상태를 false로 재설정
                        setTimeout(() => {
                            console.log('💢 GameCanvas: isHit 상태 false로 재설정.');
                            setHudState(prev => ({ ...prev, isHit: false }));
                        }, 500);
                    } else {
                        // 다른 플레이어가 피격되었을 때 해당 플레이어의 isHitted 상태 업데이트
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

                                // 0.5초 후 isHitted 상태를 false로 재설정
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
                                        return { ...innerPrev, otherPlayers: newOtherPlayers };
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

            setStompClient(client); // STOMP 클라이언트 인스턴스 저장
        };

        // STOMP 오류 발생 시
        client.onStompError = (frame) => {
            console.error('STOMP Error from App.jsx:', frame);
        };

        // STOMP 연결 해제 시
        client.onDisconnect = () => {
            console.log('[STOMP] Disconnected from WebSocket from App.jsx.');
            setStompClient(null); // STOMP 클라이언트 상태 초기화
        };

        client.activate(); // STOMP 클라이언트 활성화 (연결 시작)

        // 컴포넌트 언마운트 시 또는 의존성 변경 시 클린업
        return () => {
            const handleBeforeUnload = () => {
                if (client && client.connected) {
                    // 페이지를 떠나기 전에 플레이어 등록 해제 메시지 전송
                    client.publish({ destination: '/app/unregisterPlayer', body: JSON.stringify({ id: currentPlayerId }) });
                    client.deactivate(); // STOMP 클라이언트 비활성화
                }
            };
            window.addEventListener('beforeunload', handleBeforeUnload);

            if (client && client.connected) {
                client.publish({ destination: '/app/unregisterPlayer', body: JSON.stringify({ id: currentPlayerId }) });
                client.deactivate();
            }
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [setIsDeadInGameCanvas]); // setIsDeadInGameCanvas 의존성 추가

    // 씬 오브젝트 업데이트 핸들러
    const handleSceneObjectsUpdate = useCallback((updatedObjects) => {
        setSceneObjects(prevObjects => {
            const newObjectsMap = new Map(prevObjects.map(obj => [obj.id, obj]));
            updatedObjects.forEach(updatedObj => {
                const currentObj = newObjectsMap.get(updatedObj.id);
                if (currentObj) {
                    // 기존 오브젝트는 위치만 업데이트
                    newObjectsMap.set(updatedObj.id, { ...currentObj, position: updatedObj.position });
                } else {
                    // 새로운 오브젝트는 추가 (기본값 설정 포함)
                    newObjectsMap.set(updatedObj.id, {
                        ...updatedObj,
                        type: updatedObj.type || 'sphere',
                        radius: updatedObj.radius || 1,
                        color: updatedObj.color || 'gray',
                        collider: updatedObj.collider || 'ball',
                    });
                }
            });
            return Array.from(newObjectsMap.values()); // Map을 다시 배열로 변환하여 상태 업데이트
        });
    }, []);

    return (
        <>
            {/* Leva 디버그 UI */}
            <Leva collapsed={false} />
            {/* 플레이어 HUD 컴포넌트 */}
            <PlayerHUD state={hudState} playerNickname={playerNickname} />

            {/* 키보드 컨트롤 맵 설정 */}
            <KeyboardControls map={controlsMap}>
                {/* Three.js 캔버스 설정 */}
                <Canvas
                    shadows // 그림자 활성화
                    camera={{ fov: 60, position: [0, 5, 10] }} // 카메라 시야각 및 초기 위치
                    style={{
                        width: '100vw',
                        height: '100vh',
                        filter: hudState.isDead ? 'grayscale(100%)' : 'none' // isDead 상태에 따라 흑백 필터 적용
                    }}
                    linear={false} // 텍스처 필터링 모드 (선형 보간 비활성화)
                >
                    {/* 배경색 설정 */}
                    <color attach="background" args={['#8fafdb']} />

                    {/* 앰비언트 라이트 (전체적인 분위기 조명) */}
                    <ambientLight intensity={0.5} />
                    {/* 방향성 라이트 (태양과 같은 광원) */}
                    <directionalLight position={[5, 10, 5]} intensity={1} castShadow />
                    {/* Rapier 물리 엔진 설정 */}
                    <Physics gravity={[0, -9.81, 0]}>
                        {/* GModMap을 Physics 내부로 이동하여 물리적 상호작용 가능하게 함 */}
                        <GModMap /> 
                        
                        {/* 기존 바닥 RigidBody 제거 - GModMap에 자체적인 물리 바디가 있을 것으로 예상 */}
                        {/* <RigidBody type="fixed">
                            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                                <planeGeometry args={[100, 100]} />
                                <meshStandardMaterial color="green" />
                            </mesh>
                        </RigidBody> */}

                        {/* 보이지 않는 경계 벽 (물리 충돌용) - 새로운 맵 크기에 맞춰 조정 */}
                        {/* GModMap의 크기를 고려하여 경계 벽의 위치와 크기를 조정했습니다. 
                            gm_construct.glb 모델의 대략적인 크기가 가로, 세로 100 유닛 정도라고 가정하고 
                            그보다 넓은 150 유닛으로 설정했습니다. 필요에 따라 조정하세요. */}
                        <RigidBody type="fixed" position={[0, 75, -75]}>
                            <mesh>
                                <boxGeometry args={[150, 150, 1]} />
                                <meshStandardMaterial transparent opacity={0} />
                            </mesh>
                        </RigidBody>
                        <RigidBody type="fixed" position={[0, 75, 75]}>
                            <mesh>
                                <boxGeometry args={[150, 150, 1]} />
                                <meshStandardMaterial transparent opacity={0} />
                            </mesh>
                        </RigidBody>
                        <RigidBody type="fixed" position={[75, 75, 0]}>
                            <mesh>
                                <boxGeometry args={[1, 150, 150]} />
                                <meshStandardMaterial transparent opacity={0} />
                            </mesh>
                        </RigidBody>
                        <RigidBody type="fixed" position={[-75, 75, 0]}>
                            <mesh>
                                <boxGeometry args={[1, 150, 150]} />
                                <meshStandardMaterial transparent opacity={0} />
                            </mesh>
                        </RigidBody>

                        {/* ErrorBoundary와 Suspense로 모델 로딩 오류 처리 및 로딩 중 대체 UI 제공 */}
                        <ErrorBoundary>
                            <React.Suspense fallback={<Text position={[0, 1, 0]} color="black">플레이어 로딩 중...</Text>}>
                                {stompClient && ( // STOMP 클라이언트가 연결되었을 때만 Player 렌더링
                                    <Player
                                        onHudUpdate={setHudState} // HUD 상태 업데이트 함수 전달
                                        objectRefs={objectRefs} // 오브젝트 참조 전달
                                        stompClientInstance={stompClient} // STOMP 클라이언트 인스턴스 전달
                                        isPlayerHitted={hudState.isHit} // 플레이어 피격 상태 전달
                                        playerNickname={playerNickname} // 플레이어 닉네임 전달
                                        isDead={hudState.isDead} // 사망 상태 전달
                                        setIsDead={setIsDeadInGameCanvas} // 사망 상태 설정 함수 전달
                                        setViewMode={setViewModeInGameCanvas} // 시점 변경 함수 전달
                                        currentPlayerId={currentPlayerId} // 현재 플레이어 ID 전달
                                    />
                                )}
                            </React.Suspense>
                        </ErrorBoundary>

                        {/* 다른 플레이어들 렌더링 */}
                        {hudState.otherPlayers && Array.from(hudState.otherPlayers.values()).map((player) => {
                            if (player.id === currentPlayerId) {
                                return null; // 현재 플레이어는 OtherPlayer로 렌더링하지 않음
                            }
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

                        {/* 씬 오브젝트들 렌더링 */}
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
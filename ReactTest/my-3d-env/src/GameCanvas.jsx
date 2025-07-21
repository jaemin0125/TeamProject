// GameCanvas.jsx
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Canvas, extend, useThree } from '@react-three/fiber';
import { KeyboardControls, Text } from '@react-three/drei';
import { Physics } from '@react-three/rapier';
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
import ChatBox from './ChatBox';
import Npc from './Npc';
import { vec2 } from 'three/tsl';



// Three.js 객체 확장 (필요한 경우에만 유지)
class H2DummyObject extends THREE.Object3D { }
extend({ H2: H2DummyObject });

class PDummyObject extends THREE.Object3D { }
extend({ P: PDummyObject });

class ButtonDummyObject extends THREE.Object3D { }
extend({ Button: ButtonDummyObject });

class DivDummyObject extends THREE.Object3D { }
extend({ Div: DivDummyObject });

// 현재 플레이어 ID를 가져옵니다.
const { id: currentPlayerId } = getOrCreatePlayerInfo();


// React Error Boundary 컴포넌트
// 자식 컴포넌트에서 발생하는 오류를 잡아내어 대체 UI를 렌더링합니다.
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    // 오류 발생 시 상태를 업데이트하여 다음 렌더링에서 대체 UI를 보여줍니다.
    static getDerivedStateFromError(error) {
        return { hasError: true, error: error };
    }

    // 오류 정보를 로깅합니다.
    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error:", error, errorInfo);
        this.setState({ errorInfo: errorInfo });
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
export function GameCanvas({ playerNickname }) {
    // HUD 상태 관리 (체력, 피격 여부, 다른 플레이어 정보, 사망 여부, 시점, 리스폰 진행도)
    function SceneCapture() {
        const { scene } = useThree();
        useEffect(() => {
            sceneRef.current = scene;
        }, [scene]);
        return null;
    }

    const sceneRef = useRef(); // GameCanvas 함수 내부에서 선언

    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [isChatting, setIsChatting] = useState(false);

    const [hudState, setHudState] = useState({
        health: 100,
        isHit: false,
        id: currentPlayerId,
        otherPlayers: new Map(),
        isDead: false, // isDead 상태를 GameCanvas로 올림
        respawnProgress: 0, // 리스폰 진행도 상태 추가
        // PlayerHUD로 전달될 추가 상태
        showInteractionPrompt: false,
        interactableObjectId: null,
    });
    // 추가 --> 인벤토리 상태 관리 (8칸 핫바) / 기존 인벤토리 방식 사용하면 Npc 아이템 수령이 제한되서 변경
    const MAX_SLOTS = 8;
    const [inventory, setInventory] = useState(() => new Array(MAX_SLOTS).fill(null));

    const inventoryRef = useRef(inventory);

    useEffect(() => {
        inventoryRef.current = inventory;
    }, [inventory]);

    // 선택된 인벤토리 슬롯 상태 추가 (0부터 시작)
    const [selectedInventorySlot, setSelectedInventorySlot] = useState(0);

    // 현재 선택된 인벤토리 슬롯에 아이템이 있는지 여부
    const isItemSelected = inventory[selectedInventorySlot] !== null;

    // 씬에 배치될 오브젝트들의 초기 상태
    const [sceneObjects, setSceneObjects] = useState([]);
    // 씬 오브젝트들의 RigidBody 참조를 저장하는 useRef
    const objectRefs = useRef({});

    // STOMP 클라이언트 상태
    const [stompClient, setStompClient] = useState(null);

    // isDead 상태를 직접 제어하는 함수를 HUD 업데이트 함수와 분리
    const setIsDeadInGameCanvas = useCallback((deadState) => {
        setHudState(prev => ({ ...prev, isDead: deadState }));
    }, []);

    const selectedItem = inventory[selectedInventorySlot];
    const playerRef = useRef(); // Player 컴포넌트의 RigidBody 참조를 위한 ref


    function spawnBulletHole(hitPosition, hitNormal) {
        const scene = sceneRef.current;
        const decalSize = 0.2;
        const geometry = new THREE.PlaneGeometry(decalSize, decalSize);
        const texture = new THREE.TextureLoader().load('/textures/bullet-hole.png');
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(hitPosition.x, hitPosition.y, hitPosition.z);

        const normal = new THREE.Vector3(hitNormal.x, hitNormal.y, hitNormal.z);
        mesh.position.addScaledVector(normal, 0.001); // 표면에 약간 튀어나오게

        const quat = new THREE.Quaternion();
        quat.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
        mesh.quaternion.copy(quat);

        // 씬에 추가
        scene.add(mesh);

        setTimeout(() => {
            scene.remove(mesh);
            geometry.dispose();
            material.dispose();
        }, 15000); // 15초 후 제거
    }
    const [isReloading, setIsReloading] = useState(false); // 재장전 상태 추가
    const [reloadProgress, setReloadProgress] = useState(0); // 재장전 진행도 상태 추가

    const handleReload = useCallback(() => {
        const currentGun = inventory[selectedInventorySlot];

        // 총이 없거나, 탄약 정보가 없거나, 이미 재장전 중이면 무시
        if (!currentGun || !currentGun.ammo || isReloading || currentGun.ammo.reserve === 0) {
            return;
        }

        const magazineSize = currentGun.magazineSize || 30; // 무기 자체의 탄창 크기 사용 (기본값 30)

        // 현재 탄창이 가득 차 있으면 재장전 불필요
        if (currentGun.ammo.current >= magazineSize) {
            console.log("Magazine is already full. No need to reload.");
            return;
        }

        setIsReloading(true); // 재장전 시작
        setReloadProgress(0); // 진행도 초기화

        let progress = 0;
        const intervalTime = 50; // 50ms마다 업데이트
        const totalTime = 2000; // 총 2초
        const increment = (intervalTime / totalTime) * 100; // 각 스텝별 증가량

        const reloadInterval = setInterval(() => {
            progress += increment;
            if (progress >= 100) {
                progress = 100;
                clearInterval(reloadInterval);
                setInventory(prev => {
                    const newInv = [...prev];
                    const gun = newInv[selectedInventorySlot];
                    if (gun && gun.ammo) {
                        const magSize = gun.magazineSize || 30; // 없으면 기본 30
                        const needed = magSize - gun.ammo.current;
                        const toReload = Math.min(needed, gun.ammo.reserve);
                        gun.ammo.current += toReload;
                        gun.ammo.reserve -= toReload;
                    }
                    return newInv;
                });
                setIsReloading(false); // 재장전 완료
                setReloadProgress(0); // 진행도 다시 초기화
            }
            setReloadProgress(progress);
        }, intervalTime);

        // 컴포넌트 언마운트 시 인터벌 정리
        return () => clearInterval(reloadInterval);

    }, [selectedInventorySlot, isReloading, inventory]);

    // 아이템 버리기 함수
    const handleDropItem = useCallback(() => {
        if (isChatting) return; // 채팅 중에는 아이템 버리기 방지

        const itemToDrop = inventoryRef.current[selectedInventorySlot];
        console.log(itemToDrop.id);
        if (!itemToDrop) {
            console.log("버릴 아이템이 없습니다.");
            return;
        }

        // 플레이어의 현재 위치 가져오기
        const playerPosition = playerRef.current?.translation();
        if (!playerPosition) {
            console.warn("플레이어 위치를 가져올 수 없습니다.");
            return;
        }

        // 인벤토리에서 아이템 개수 감소 또는 제거
        setInventory(prevInventory => {
            const newInventory = [...prevInventory];
            const itemInSlot = { ...newInventory[selectedInventorySlot] }; // 불변성을 위해 복사

            if (itemInSlot.count > 1) {
                itemInSlot.count -= 1;
                newInventory[selectedInventorySlot] = itemInSlot;
            } else {
                newInventory[selectedInventorySlot] = null; // 아이템이 1개 이하면 슬롯 비움
            }
            return newInventory;
        });

        // 서버에 아이템 버리기 요청 전송
        if (stompClient && stompClient.connected) {
            console.log(`[GameCanvas] Publishing dropItem event for ${itemToDrop.name} (ID: ${itemToDrop.id})`);
            stompClient.publish({
                destination: '/app/dropItem',
                body: JSON.stringify({
                    playerId: currentPlayerId,
                    itemId: itemToDrop.id,
                    actionType: 'DROP',
                    itemData: {
                        name: itemToDrop.name,
                        image: itemToDrop.image,
                        ammo: itemToDrop.ammo ? { current: itemToDrop.ammo.current, reserve: itemToDrop.ammo.reserve } : undefined,
                        magazineSize: itemToDrop.magazineSize,
                    },
                    quantity: 1, // 항상 1개만 버리도록 설정
                    position: {
                        x: playerPosition.x,
                        y: playerPosition.y - 0.5, // 플레이어 발 밑에 놓이도록 약간 아래로
                        z: playerPosition.z,
                    }
                }),
            });
        }
    }, [selectedInventorySlot, isChatting, stompClient, currentPlayerId]);

    // 'Q' 키 입력 감지
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.code === 'KeyQ' && !isChatting) {
                handleDropItem();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleDropItem, isChatting]);




    // 플레이어 죽음 및 리스폰 로직 (GameCanvas에서 관리)
    useEffect(() => {
        let respawnTimer;
        let progressInterval;

        // isDead 상태가 true가 될 때만 리스폰 타이머와 진행도 인터벌을 시작
        if (hudState.isDead) {
            console.log("플레이어 사망! 리스폰 타이머 시작 (5초)...");
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

                // if (stompClient && stompClient.connected) {
                //     stompClient.publish({
                //         destination: '/app/playerRespawn',
                //         body: JSON.stringify({
                //             id: currentPlayerId,
                //             position: { x: 0, y: 1.1, z: 0 }, // 서버에 리스폰 위치 전달
                //             health: 100
                //         })
                //     });
                // }
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
    }, [hudState.isDead, stompClient, setHudState]); // 의존성 배열

     useEffect(() => {
        const handleContextMenu = (event) => {
            event.preventDefault(); // 브라우저의 기본 우클릭 메뉴 동작을 막습니다.
        };

        // 전체 윈도우에 contextmenu 이벤트 리스너를 추가합니다.
        window.addEventListener('contextmenu', handleContextMenu);

        // 컴포넌트가 언마운트될 때 이벤트 리스너를 제거합니다.
        return () => {
            window.removeEventListener('contextmenu', handleContextMenu);
        };
    }, []); // 빈 배열을 전달하여 이 useEffect가 컴포넌트 마운트 시 한 번만 실행되도록 합니다.


    // 인벤토리 선택 로직 (키보드 1~8 및 마우스 휠)
    useEffect(() => {
        const handleKeyDown = (event) => {
            const key = event.key;
            //포인터락 상태에서 새로고침 방지
            if (document.pointerLockElement) {
                if(event.key === 'F5' || (event.ctrlKey && event.key === 'r') || (event.ctrlKey && event.key === 'R') || (event.ctrlKey && event.shiftKey && event.key === 'r') || (event.ctrlKey && event.shiftKey && event.key === 'R')) {
                    event.preventDefault();
                    return;
                }
            }
            if (key >= '1' && key <= '8') {
                const newSlot = parseInt(key) - 1; // 0-indexed
                setSelectedInventorySlot(newSlot);
            }
        };

        const handleWheel = (event) => {
            event.preventDefault(); // 페이지 스크롤 방지
            setSelectedInventorySlot(prevSlot => {
                const numSlots = inventory.length; // 인벤토리 슬롯 개수
                if (event.deltaY > 0) { // 휠 아래로 (다음 슬롯)
                    return (prevSlot + 1) % numSlots;
                } else { // 휠 위로 (이전 슬롯)
                    return (prevSlot - 1 + numSlots) % numSlots;
                }
            });
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('wheel', handleWheel, { passive: false }); // passive: false로 설정하여 preventDefault() 가능하게 함

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('wheel', handleWheel); // 수정: handleWheel 리스너 제거
        };
    }, [inventory.length]); // inventory.length가 변경될 때만 이펙트 재실행

    // 탄약이 모두 소진된 총기 아이템을 인벤토리에서 제거하는 로직
    useEffect(() => {
        const selectedItem = inventory[selectedInventorySlot];

        // 현재 선택된 아이템이 'ak-47'이고 탄약이 모두 소진되었는지 확인
        if (selectedItem && selectedItem.name === 'ak-47' && selectedItem?.ammo.current === 0 && selectedItem?.ammo.reserve === 0) {
            console.log(`[GameCanvas] AK-47 has run out of ammo and is being removed from inventory.`);


            // 인벤토리에서 해당 아이템 제거
            setInventory(prevInventory => {
                const newInventory = [...prevInventory];
                newInventory[selectedInventorySlot] = null; // 현재 슬롯을 비웁니다.

                return newInventory;
            });
        }
    }, [selectedItem, inventory, selectedInventorySlot]); // currentAmmo, maxAmmo, 또는 선택된 슬롯이 변경될 때마다 실행

    // useEffect(() => {
    //     if (!stompClient || !stompClient.connected) return;

    //     const selectedItem = inventory[selectedInventorySlot];
    //     const isArmed = selectedItem?.name === 'ak-47';

    //     stompClient.publish({
    //         destination: '/app/playerMove',
    //         body: JSON.stringify({
    //             id: currentPlayerId,
    //             nickname: playerNickname,
    //             position: { x: 0, y: 1.1, z: 0 }, // 기존 위치나 서버에서 받아오는 위치로
    //             rotationY: 0,
    //             animationState: {
    //                 isIdle: true, // 기본 상태지만 너가 설정한 값으로 바꿔도 됨
    //                 isArmed: isArmed, // ✅ 이게 중요
    //             }
    //         })
    //     });

    // }, [selectedInventorySlot, inventory, stompClient]);


    // STOMP WebSocket 연결 및 메시지 구독 로직
    useEffect(() => {
        const WS_URL = 'http://localhost:8080/ws';
        const socket = new SockJS(WS_URL); // SockJS를 사용하여 WebSocket 연결
        const client = new Client({
            webSocketFactory: () => socket, // SockJS 소켓 팩토리 설정
            reconnectDelay: 5000, // 재연결 지연 시간
            heartbeatIncoming: 4000, // 인바운드 하트비트
            heartbeatOutgoing: 4000, // 아웃바운드 하트비트
        });

        // STOMP 클라이언트 연결 시
        client.onConnect = (frame) => {
            //console.log("[STOMP] Connected to WebSocket from App.jsx!", frame); // 주석 해제하여 확인 가능
            setStompClient(client); // STOMP 클라이언트 인스턴스 저장

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


            client.subscribe('/topic/bulletImpacts', (message) => {
                const { hitPosition, hitNormal } = JSON.parse(message.body);
                spawnBulletHole(hitPosition, hitNormal);
            });

            // 신규 추가(Npc 대화창에서 아이템 수령 기믹) -> 
          const playerId = currentPlayerId;// 이미 있는 currentPlayerid 사용

            client.subscribe(`/topic/inventory/${playerId}`, (message) => {
                const receivedItem = JSON.parse(message.body);

                // 받은 아이템에 이미지 경로 붙이기
                const itemWithImage = {
                    ...receivedItem,
                    image: `/models/${receivedItem.name}.png`, // 
                }; // 서버가 보낸 인벤토리 변경 알림을 받아서, 클라 화면을 실시간으로 갱신(서버 -> 클라)

                setInventory((prevInventory) => {
                    // 기존에 같은 아이템이 있는지 확인
                    const existingIndex = prevInventory.findIndex(
                        (item) => item && item.name === itemWithImage.name
                    );

                    if (existingIndex !== -1) {
                        // 수량만 증가
                        const updated = [...prevInventory];
                        updated[existingIndex] = {
                            ...updated[existingIndex],
                            count: updated[existingIndex].count + itemWithImage.count,
                        };
                        return updated;
                    }

                    // 빈 슬롯 찾기
                    const emptyIndex = prevInventory.findIndex((item) => item === null);
                    if (emptyIndex !== -1) {
                        const updated = [...prevInventory];
                        updated[emptyIndex] = itemWithImage;
                        return updated;
                    }

                    console.warn("빈 인벤토리 슬롯 없음");
                    return prevInventory; // 그대로 유지
                });
            });
            //////////////////////////////////


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
                            const newHealth = Math.max((prev.health ?? 100) - data.damage, 0); // 백엔드에서 받은 데미지 값으로 체력 감소
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

            // 오브젝트 수집 이벤트 구독
            client.subscribe('/topic/collectObject', (message) => {
                try {
                    const { objectId, collectorId } = JSON.parse(message.body);
                    console.log(`[STOMP] Object ${objectId} collected by ${collectorId}`);

                    // 씬에서 오브젝트 제거 (모든 클라이언트에서)
                    setSceneObjects(prevObjects => prevObjects.filter(obj => obj.id !== objectId));

                    // 만약 현재 플레이어가 수집한 것이라면 인벤토리에 추가 (이미 GameCanvas의 'F' 키 로직에서 처리됨)
                    // 다른 플레이어가 수집한 경우에도 해당 오브젝트를 씬에서 제거하기 위함
                } catch (e) {
                    console.error('[STOMP Subscribe] collectObject 메시지 파싱 실패:', e);
                }
            });


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
    }, [playerNickname, setIsDeadInGameCanvas]); // 의존성 배열

    // 씬 오브젝트 업데이트 핸들러
    const handleSceneObjectsUpdate = useCallback((updatedObjects) => {
        setSceneObjects(updatedObjects.map(updatedObj => ({
            ...updatedObj,
            type: updatedObj.itemType || updatedObj.objectType || 'sphere',
            radius: updatedObj.radius || 1,
            color: updatedObj.color || 'gray',
            collider: updatedObj.collider || 'ball',
        })));
    }, []);

    // Player로부터 상호작용 가능한 오브젝트 ID를 받아 상태 업데이트
    const onObjectProximityChange = useCallback((objectId, isNear) => {
        setHudState(prev => ({
            ...prev,
            interactableObjectId: isNear ? objectId : null,
            showInteractionPrompt: isNear,
        }));
    }, []);

    const handlePlayerInteract = useCallback((interactedObjectId) => {
        console.log(`[GameCanvas] handlePlayerInteract called with objectId: ${interactedObjectId}`); // 추가된 로그
        const interactedObject = sceneObjects.find(obj => obj.id === interactedObjectId);
        console.log(`[GameCanvas] Found interactedObject:`, interactedObject); // 추가된 로그

        if (interactedObject && interactedObject.type === 'apple') {
            console.log(`[GameCanvas] Interacted object is an apple. Adding to inventory.`); // 추가된 로그
            setInventory(prevInventory => {
                const existingItemIndex = prevInventory.findIndex(item => item && item.name === 'apple');
                if (existingItemIndex !== -1) {
                    const newInventory = [...prevInventory];
                    newInventory[existingItemIndex].count += 1;
                    console.log(`[GameCanvas] Updated existing apple count. New inventory:`, newInventory); // 추가된 로그
                    return newInventory;
                } else {
                    const firstEmptySlotIndex = prevInventory.findIndex(item => item === null);
                    if (firstEmptySlotIndex !== -1) {
                        const newInventory = [...prevInventory];
                        // 이미지 경로 수정: 업로드된 image_52a5e6.png가 public/models에 있으므로 경로 수정
                        newInventory[firstEmptySlotIndex] = { name: 'apple', count: 1, id: interactedObject.id, image: '/models/apple.png' }; // 이미지 경로 수정
                        console.log(`[GameCanvas] Added new apple to inventory. New inventory:`, newInventory); // 추가된 로그
                        return newInventory;
                    }
                    console.log(`[GameCanvas] Inventory full, could not add apple.`); // 추가된 로그
                    return prevInventory;
                }
            });
            setHudState(prev => ({ ...prev, interactableObjectId: null, showInteractionPrompt: false }));
            console.log("Apple collected! Prompt removed."); // 추가된 로그

            // 이 부분이 사과를 맵에서 사라지게 하는 핵심 로직입니다.
            console.log(`[GameCanvas] Removing apple with ID: ${interactedObject.id} from sceneObjects.`); // 사과 제거 로그 추가
            setSceneObjects(prevObjects => prevObjects.filter(obj => obj.id !== interactedObject.id)); // interactedObject.id 사용

            if (stompClient && stompClient.connected) {
                console.log(`[GameCanvas] Publishing pickUpItem event for ${interactedObject.id}`);
                stompClient.publish({
                    destination: '/app/pickUpItem',
                    body: JSON.stringify({
                        playerId: currentPlayerId,
                        itemId: interactedObject.id,
                        actionType: 'PICKUP'
                    }),
                });
            }
        } else if (interactedObject && interactedObject.type === 'ak-47') {
            if (inventoryRef.current.some(item => item?.name === 'ak-47')) {
                console.log('인벤토리에 이미 총기가 존재함.');
                return;
            }
            console.log('실행됨');
            console.log(`[GameCanvas] Interacted object is an ak-47. Adding to inventory.`); // 추가된 로그
            setInventory(prevInventory => {
                const existingItemIndex = prevInventory.findIndex(item => item && item.name === 'ak-47');
                if (existingItemIndex !== -1) {
                    const newInventory = [...prevInventory];
                    newInventory[existingItemIndex].count += 1;
                    console.log(`[GameCanvas] Updated existing apple count. New inventory:`, newInventory); // 추가된 로그
                    return newInventory;
                } else {
                    const firstEmptySlotIndex = prevInventory.findIndex(item => item === null);
                    if (firstEmptySlotIndex !== -1) {
                        const newInventory = [...prevInventory];
                        // 이미지 경로 수정: 업로드된 image_52a5e6.png가 public/models에 있으므로 경로 수정
                        newInventory[firstEmptySlotIndex] = { name: 'ak-47', count: 1, id: interactedObject.id, image: '/models/ak-47.png', ammo: { current: 30, reserve: 120 }, magazineSize: 30 }; // 이미지 경로 수정
                        console.log(`[GameCanvas] Added new ak-47 to inventory. New inventory:`, newInventory); // 추가된 로그
                        return newInventory;
                    }
                    console.log(`[GameCanvas] Inventory full, could not add ak-47.`); // 추가된 로그
                    return prevInventory;
                }
            });
            setHudState(prev => ({ ...prev, interactableObjectId: null, showInteractionPrompt: false }));
            console.log("ak-47 collected! Prompt removed."); // 추가된 로그

            // 이 부분이 사과를 맵에서 사라지게 하는 핵심 로직입니다.
            console.log(`[GameCanvas] Removing ak-47 with ID: ${interactedObject.id} from sceneObjects.`); // 사과 제거 로그 추가
            setSceneObjects(prevObjects => prevObjects.filter(obj => obj.id !== interactedObject.id)); // interactedObject.id 사용

            if (stompClient && stompClient.connected) {
                console.log(`[GameCanvas] Publishing pickUpItem event for ${interactedObject.id}`);
                stompClient.publish({
                    destination: '/app/pickUpItem',
                    body: JSON.stringify({
                        playerId: currentPlayerId,
                        itemId: interactedObject.id,
                        actionType: 'PICKUP',
                        itemData: {
                            name: 'ak-47',
                            ammo: { current: 30, reserve: 120 },
                            magazineSize: 30
                        }
                    }),
                });
            }
        } else if (interactedObject && interactedObject.type === 'pipe') {
            if (inventoryRef.current.some(item => item?.name === 'pipe')) {
                console.log('이미 가지고 있는 무기임.')
                return;
            }
            setInventory(prevInventory => {
                const existingItemIndex = prevInventory.findIndex(item => item && item.name === 'pipe');
                if (existingItemIndex !== -1) {
                    const newInventory = [...prevInventory];
                    newInventory[existingItemIndex].count += 1;
                    console.log(`[GameCanvas] Updated existing pipe count. New inventory:`, newInventory); // 추가된 로그
                    return newInventory;
                } else {
                    const firstEmptySlotIndex = prevInventory.findIndex(item => item === null);
                    if (firstEmptySlotIndex !== -1) {
                        const newInventory = [...prevInventory];
                        // 이미지 경로 수정: 업로드된 image_52a5e6.png가 public/models에 있으므로 경로 수정
                        newInventory[firstEmptySlotIndex] = { name: 'pipe', count: 1, id: interactedObject.id, image: '/models/pipe.png', }; // 이미지 경로 수정
                        console.log(`[GameCanvas] Added new pipe to inventory. New inventory:`, newInventory); // 추가된 로그
                        return newInventory;
                    }
                    console.log(`[GameCanvas] Inventory full, could not add pipe.`); // 추가된 로그
                    return prevInventory;
                }
            });
            setHudState(prev => ({ ...prev, interactableObjectId: null, showInteractionPrompt: false }));
            console.log("pipe collected! Prompt removed."); // 추가된 로그

            // 이 부분이 사과를 맵에서 사라지게 하는 핵심 로직입니다.
            console.log(`[GameCanvas] Removing pipe with ID: ${interactedObject.id} from sceneObjects.`); // 사과 제거 로그 추가
            setSceneObjects(prevObjects => prevObjects.filter(obj => obj.id !== interactedObject.id)); // interactedObject.id 사용

            if (stompClient && stompClient.connected) {
                console.log(`[GameCanvas] Publishing pickUpItem event for ${interactedObject.id}`);
                stompClient.publish({
                    destination: '/app/pickUpItem',
                    body: JSON.stringify({
                        playerId: currentPlayerId,
                        itemId: interactedObject.id,
                        actionType: 'PICKUP'
                    }),
                });
            }
        }

        else {
            console.log(`[GameCanvas] Interacted object is not an apple or not found. Object:`, interactedObject); // 추가된 로그
        }
    }, [sceneObjects, setInventory, setHudState, stompClient, currentPlayerId]);

    const clearInventory = () => {
        setInventory([null, null, null, null, null, null, null, null]); // 또는 초기값으로 재설정
        setSelectedInventorySlot(0); // 선택 슬롯도 초기화
    };

    // 선택된 아이템 사용 함수 (좌클릭 시 호출)
    const handleUseSelectedItem = useCallback(() => {
        if (selectedInventorySlot !== null) {
            setInventory(prevInventory => {
                const newInventory = [...prevInventory];
                const itemToUse = newInventory[selectedInventorySlot];

                if (itemToUse) {
                    console.log(`[GameCanvas] Using item: ${itemToUse.name} from slot ${selectedInventorySlot}. Current count: ${itemToUse.count}`); // 상세 로그
                    if (itemToUse.name === 'apple') {
                        // 사과 사용 로직: 체력 회복
                        setHudState(prevHud => {
                            const currentHealth = prevHud.health ?? 100;
                            const newHealth = Math.min(currentHealth + 20, 100); // 체력 20 회복, 최대 100
                            console.log(`[GameCanvas] Player health: ${currentHealth} -> ${newHealth}`); // 상세 로그
                            return { ...prevHud, health: newHealth };
                        });

                        // 아이템 개수 감소 또는 슬롯 비우기
                        if (itemToUse.count > 1) {
                            newInventory[selectedInventorySlot] = { ...itemToUse, count: itemToUse.count - 1 };
                            console.log(`[GameCanvas] Item count decreased. New count: ${newInventory[selectedInventorySlot].count}`); // 상세 로그
                        } else {
                            newInventory[selectedInventorySlot] = null; // 아이템 소진 시 슬롯 비움
                            console.log(`[GameCanvas] Item consumed. Slot ${selectedInventorySlot} is now empty.`); // 상세 로그
                        }

                        // 서버에 아이템 사용 이벤트 발행
                        if (stompClient && stompClient.connected) {
                            console.log(`[GameCanvas] Publishing useItem event for ${itemToUse.name} (ID: ${itemToUse.id})`); // 상세 로그
                            stompClient.publish({
                                destination: '/app/useItem',
                                body: JSON.stringify({
                                    playerId: currentPlayerId,
                                    itemId: itemToUse.id, // 원래 오브젝트 ID 또는 아이템 타입
                                    itemType: itemToUse.name, // 아이템 이름
                                    slotIndex: selectedInventorySlot,
                                }),
                            });
                        }
                    } else {
                        console.log(`[GameCanvas] Item ${itemToUse.name} is not consumable.`);
                    }
                } else {
                    console.log(`[GameCanvas] No item found in selected slot ${selectedInventorySlot}.`); // 아이템이 없는 경우 로그
                }
                return newInventory;
            });
        } else {
            console.log(`[GameCanvas] No slot selected for item use.`); // 슬롯이 선택되지 않은 경우 로그
        }
    }, [selectedInventorySlot, inventory, setHudState, stompClient, currentPlayerId]);

    return (
        <>
            {/* Leva 디버그 UI */}
            <Leva collapsed={true} /> {/* 기본적으로 접힌 상태로 시작 */}
            {/* 플레이어 HUD 컴포넌트 */}
            <PlayerHUD
                state={hudState}
                playerNickname={playerNickname}
                inventory={inventory} // inventory prop 전달
                selectedInventorySlot={selectedInventorySlot} // selectedInventorySlot prop 전달
                selectedItem={inventory[selectedInventorySlot]}
                currentAmmo={selectedItem?.ammo?.current}
                maxAmmo={selectedItem?.ammo?.reserve}
                isReloading={isReloading} // 재장전 상태 전달
                reloadProgress={reloadProgress} // 재장전 진행도 전달
            />

            {/* 키보드 컨트롤 맵 설정 */}
            <KeyboardControls map={controlsMap}>
                {/* Three.js 캔버스 설정 */}
                <Canvas
                    gl={{ outputColorSpace: THREE.SRGBColorSpace }}
                    shadows // 그림자 활성화
                    camera={{ fov: 60, position: [0, 5, 10] }} // 카메라 시야각 및 초기 위치
                    style={{
                        width: '100vw',
                        height: '100vh',
                        filter: hudState.isDead ? 'grayscale(100%)' : 'none' // isDead 상태에 따라 흑백 필터 적용
                    }}
                    linear={false} // 텍스처 필터링 모드 (선형 보간 비활성화)
                >

                    <SceneCapture />
                    {/* 배경색 설정 */}
                    <color attach="background" args={['#8fafdb']} />

                    {/* 앰비언트 라이트 (전체적인 분위기 조명) */}
                    <ambientLight intensity={1.5} />
                    {/* 방향성 라이트 (태양과 같은 광원) */}
                    <directionalLight position={[10, 10, 10]} intensity={2} castShadow />
                    {/* Rapier 물리 엔진 설정 */}
                    <Physics gravity={[0, -9.81, 0]}> {/* 중력 설정 */}
                        {/* GModMap을 Physics 내부로 이동하여 물리적 상호작용 가능하게 함 */}
                        <GModMap />

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
                                        isDead={hudState.isDead} // 사망 상태 전달z`
                                        setIsDead={setIsDeadInGameCanvas} // 사망 상태 설정 함수 전달
                                        currentPlayerId={currentPlayerId} // 현재 플레이어 ID 전달
                                        onObjectProximityChange={onObjectProximityChange} // 새로 추가: 오브젝트 근접 감지 콜백
                                        onInteract={handlePlayerInteract} // 새로 추가: 플레이어 상호작용 요청 콜백
                                        onUseItem={handleUseSelectedItem} // 새로 추가: 아이템 사용 요청 콜백
                                        selectedInventorySlot={selectedInventorySlot} // 새로 추가: 선택된 인벤토리 슬롯 전달
                                        isItemSelected={isItemSelected} // 새로 추가: 선택된 슬롯에 아이템이 있는지 여부 전달
                                        selectedItem={inventory[selectedInventorySlot]}
                                        setInventory={setInventory}
                                        isChatting={isChatting}
                                        clearInventory={clearInventory}
                                        handleReload={handleReload}
                                        playerRef={playerRef} // playerRef 전달
                                        isReloading={isReloading} // 재장전 상태 전달
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
                                            chatMessages={chatMessages}
                                            selectedItem={inventory[selectedInventorySlot]}
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
   <Npc client={stompClient} /> 
                    </Physics>
                </Canvas>
                   {stompClient && (
                    <ChatBox
                        stompClient={stompClient}
                        currentPlayerId={currentPlayerId}
                        chatMessages={chatMessages}
                        setChatMessages={setChatMessages}
                        chatInput={chatInput}
                        setChatInput={setChatInput}
                        setIsChatting={setIsChatting}
                        playerNickname={playerNickname} 
                    />
                )}
            </KeyboardControls>
        </>
    );
}
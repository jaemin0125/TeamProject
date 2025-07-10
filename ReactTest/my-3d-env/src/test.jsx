// // GameCanvas.jsx

// // React의 핵심 훅들을 임포트합니다.
// import React, { useRef, useState, useEffect, useCallback } from 'react';
// // @react-three/fiber 라이브러리에서 3D 씬을 렌더링할 Canvas 컴포넌트와 Three.js 객체 확장을 위한 extend 함수를 임포트합니다.
// import { Canvas, extend } from '@react-three/fiber';
// // @react-three/drei 라이브러리에서 키보드 컨트롤을 위한 KeyboardControls 컴포넌트와 3D 텍스트를 위한 Text 컴포넌트를 임포트합니다.
// import { KeyboardControls, Text } from '@react-three/drei';
// // @react-three/rapier 라이브러리에서 물리 시뮬레이션을 위한 Physics 컴포넌트와 물리적 속성을 가진 객체를 위한 RigidBody 컴포넌트를 임포트합니다.
// import { Physics, RigidBody } from '@react-three/rapier';
// // Leva 라이브러리에서 디버깅 UI를 위한 Leva 컴포넌트를 임포트합니다.
// import { Leva } from 'leva';
// // Three.js 라이브러리 전체를 THREE라는 이름으로 임포트하여 3D 객체 생성 및 조작에 사용합니다.
// import * as THREE from 'three';
// // @stomp/stompjs 라이브러리에서 STOMP 클라이언트 객체를 임포트합니다.
// import { Client } from '@stomp/stompjs';
// // sockjs-client 라이브러리에서 SockJS 객체를 임포트하여 웹소켓 연결을 안정화합니다.
// import SockJS from 'sockjs-client';
// // 로컬 파일인 Map.jsx에서 GModMap 컴포넌트를 임포트합니다.
// import { GModMap } from './Map';

// // 로컬 파일들 임포트
// import { Player } from './Player'; // 현재 플레이어 컴포넌트
// import { OtherPlayer } from './OtherPlayer'; // 다른 플레이어 컴포넌트
// import { SceneObject } from './SceneObject'; // 씬 오브젝트 컴포넌트
// import { PlayerHUD } from './PlayerHUD'; // 플레이어 HUD(인터페이스) 컴포넌트
// // utils 폴더에서 컨트롤 매핑과 플레이어 정보 유틸리티 함수를 임포트합니다.
// import { controlsMap, getOrCreatePlayerInfo } from './utils/constants';

// // Three.js 객체 확장 (필요한 경우에만 유지) - HTML 태그와 유사한 이름으로 Three.js Object3D를 확장합니다.
// // 이는 3D 씬 내에서 특정 요소를 추상화하거나 구별하기 위해 사용될 수 있지만, 이 코드에서는 직접적으로 사용되지 않습니다.
// class H2DummyObject extends THREE.Object3D {} // H2 태그에 대한 더미 3D 객체
// extend({ H2: H2DummyObject }); // Three.js에 H2라는 이름을 확장합니다.

// class PDummyObject extends THREE.Object3D {} // P 태그에 대한 더미 3D 객체
// extend({ P: PDummyObject }); // Three.js에 P라는 이름을 확장합니다.

// class ButtonDummyObject extends THREE.Object3D {} // Button 태그에 대한 더미 3D 객체
// extend({ Button: ButtonDummyObject }); // Three.js에 Button이라는 이름을 확장합니다.

// class DivDummyObject extends THREE.Object3D {} // Div 태그에 대한 더미 3D 객체
// extend({ Div: DivDummyObject }); // Three.js에 Div라는 이름을 확장합니다.

// // 현재 플레이어의 고유 ID를 가져옵니다. 이 ID는 세션마다 생성되거나 로컬 스토리지에서 가져올 수 있습니다.
// const { id: currentPlayerId} = getOrCreatePlayerInfo();


// // React Error Boundary 컴포넌트 정의
// // 이 컴포넌트는 자식 컴포넌트에서 발생하는 JavaScript 오류를 잡아내어 게임 전체가 죽는 것을 방지하고 대체 UI를 렌더링합니다.
// class ErrorBoundary extends React.Component {
//     // 생성자: 초기 상태를 설정합니다.
//     constructor(props) {
//         super(props);
//         this.state = { hasError: false, error: null, errorInfo: null };
//     }

//     // 오류 발생 시 호출되는 정적 메서드: 다음 렌더링에서 대체 UI를 보여주기 위해 상태를 업데이트합니다.
//     static getDerivedStateFromError(error) {
//         return { hasError: true, error: error };
//     }

//     // 오류 정보를 로깅하는 메서드: 개발자가 디버깅할 수 있도록 콘솔에 오류와 오류 정보를 출력합니다.
//     componentDidCatch(error, errorInfo) {
//         console.error("ErrorBoundary caught an error:", error, errorInfo);
//         this.setState({ errorInfo: errorInfo });
//     }

//     // 렌더링 메서드
//     render() {
//         // hasError 상태가 true인 경우 (오류가 발생한 경우)
//         if (this.state.hasError) {
//             // 오류 발생 시 보여줄 대체 UI를 반환합니다.
//             return (
//                 <div style={{
//                     position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', // 화면 중앙에 배치
//                     backgroundColor: 'rgba(255, 0, 0, 0.8)', color: 'white', padding: '20px', borderRadius: '10px', // 빨간색 배경, 흰색 글씨 등 스타일
//                     textAlign: 'center', zIndex: 1000 // 중앙 정렬, 최상위 z-index
//                 }}>
//                     <h2>게임 중 오류가 발생했습니다!</h2> {/* 오류 제목 */}
//                     <p>콘솔을 확인하여 상세 오류를 파악해주세요.</p> {/* 오류 안내 메시지 */}
//                     <button
//                         onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })} // 다시 시도 버튼: 오류 상태를 초기화하여 자식 컴포넌트를 다시 렌더링 시도
//                         style={{ marginTop: '10px', padding: '8px 15px', backgroundColor: '#fff', color: '#000', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
//                     >
//                         다시 시도
//                     </button>
//                     <button
//                         onClick={() => window.location.reload()} // 페이지 새로고침 버튼: 브라우저를 새로고침하여 초기 상태로 돌아갑니다.
//                         style={{ marginTop: '10px', marginLeft: '10px', padding: '8px 15px', backgroundColor: '#fff', color: '#000', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
//                     >
//                         페이지 새로고침
//                     </button>
//                 </div>
//             );
//         }
//         return this.props.children; // 오류가 없으면 자식 컴포넌트들을 정상적으로 렌더링합니다.
//     }
// }


// // GameCanvas 컴포넌트: 게임의 주요 렌더링 및 로직을 담당합니다.
// export function GameCanvas({playerNickname}) {
//     // HUD 상태 관리: 체력(health), 피격 여부(isHit), 다른 플레이어 정보(otherPlayers), 사망 여부(isDead), 시점(viewMode), 리스폰 진행도(respawnProgress),
//     // 상호작용 프롬프트 표시 여부(showInteractionPrompt), 상호작용 가능한 오브젝트 ID(interactableObjectId)를 포함합니다.
//     const [hudState, setHudState] = useState({
//         health: 100, // 플레이어의 현재 체력 (초기값 100)
//         isHit: false, // 플레이어가 피격되었는지 여부
//         otherPlayers: new Map(), // 맵(Map) 형태로 다른 플레이어들의 정보를 저장
//         isDead: false, // 플레이어 사망 여부
//         viewMode: 'thirdPerson', // 현재 시점 ('firstPerson' 또는 'thirdPerson')
//         respawnProgress: 0, // 리스폰 진행도 (0부터 5까지)
//         showInteractionPrompt: false, // 상호작용 프롬프트 표시 여부
//         interactableObjectId: null, // 상호작용 가능한 오브젝트의 ID
//     });
//     // 인벤토리 상태 관리 (8칸 핫바): 각 슬롯에 아이템 객체 또는 null이 저장됩니다.
//     const [inventory, setInventory] = useState([
//         null, null, null, null, null, null, null, null // 8개의 초기 빈 슬롯
//     ]);
//     // 선택된 인벤토리 슬롯 상태 추가 (0부터 7까지의 인덱스)
//     const [selectedInventorySlot, setSelectedInventorySlot] = useState(0);

//     // 현재 선택된 인벤토리 슬롯에 아이템이 있는지 여부를 나타내는 파생 상태입니다.
//     const isItemSelected = inventory[selectedInventorySlot] !== null;

//     // 씬에 배치될 오브젝트들의 초기 상태를 정의합니다.
//     const [sceneObjects, setSceneObjects] = useState([
//         // 사과 오브젝트 5개를 정의합니다.
//         // type: 'apple'로 종류를 식별, position: 초기 위치, collider: 물리 충돌체 형태, rigidBodyType: 물리 타입 (dynamic은 중력 영향 받음),
//         // scale: 크기, color: 색상, mass: 질량 (높게 설정하여 잘 움직이지 않게 함),
//         // linearDamping: 선형 감쇠 (움직임을 빠르게 멈추게 함), restitution: 반발 계수 (튀는 정도)
//         { id: 'apple1', type: 'apple', position: { x: 0, y: 2, z: 0 }, collider: 'cuboid', rigidBodyType: 'dynamic', scale: [0.01, 0.01, 0.01], color: 'red', mass: 100000, linearDamping: 100, restitution: 0.1 },
//         { id: 'apple2', type: 'apple', position: { x: 2, y: 2, z: 0 }, collider: 'cuboid', rigidBodyType: 'dynamic', scale: [0.01, 0.01, 0.01], color: 'red', mass: 100000, linearDamping: 100, restitution: 0.1 },
//         { id: 'apple3', type: 'apple', position: { x: -2, y: 2, z: 0 }, collider: 'cuboid', rigidBodyType: 'dynamic', scale: [0.01, 0.01, 0.01], color: 'red', mass: 100000, linearDamping: 100, restitution: 0.1 },
//         { id: 'apple4', type: 'apple', position: { x: 0, y: 2, z: 2 }, collider: 'cuboid', rigidBodyType: 'dynamic', scale: [0.01, 0.01, 0.01], color: 'red', mass: 100000, linearDamping: 100, restitution: 0.1 },
//         { id: 'apple5', type: 'apple', position: { x: 0, y: 2, z: -2 }, collider: 'cuboid', rigidBodyType: 'dynamic', scale: [0.01, 0.01, 0.01], color: 'red', mass: 100000, linearDamping: 100, restitution: 0.1 }
//     ]);
//     // 씬 오브젝트들의 RigidBody 참조를 저장하는 useRef 훅. 이를 통해 오브젝트의 물리적 속성(위치, 회전, 속도 등)을 직접 조작할 수 있습니다.
//     const objectRefs = useRef({});

//     // STOMP 클라이언트 인스턴스를 저장하는 상태입니다. 연결이 되면 여기에 STOMP 클라이언트 객체가 저장됩니다.
//     const [stompClient, setStompClient] = useState(null);

//     // isDead 상태를 직접 제어하는 함수를 정의합니다. useCallback을 사용하여 불필요한 재렌더링을 방지합니다.
//     const setIsDeadInGameCanvas = useCallback((deadState) => {
//         setHudState(prev => ({ ...prev, isDead: deadState })); // 이전 hudState를 기반으로 isDead만 업데이트합니다.
//     }, []); // 의존성 배열이 비어있으므로 컴포넌트 마운트 시 한 번만 생성됩니다.

//     // Player 컴포넌트에서 viewMode를 업데이트할 수 있도록 함수를 정의합니다. useCallback을 사용합니다.
//     const setViewModeInGameCanvas = useCallback((mode) => {
//         setHudState(prev => ({ ...prev, viewMode: mode })); // 이전 hudState를 기반으로 viewMode만 업데이트합니다.
//     }, []); // 의존성 배열이 비어있으므로 컴포넌트 마운트 시 한 번만 생성됩니다.


//     // 플레이어 죽음 및 리스폰 로직을 관리하는 useEffect 훅입니다.
//     useEffect(() => {
//         let respawnTimer; // 리스폰 타이머 변수
//         let progressInterval; // 리스폰 진행도 인터벌 변수

//         // hudState.isDead 상태가 true일 때만 리스폰 로직을 시작합니다.
//         if (hudState.isDead) {
//             console.log("플레이어 사망! 리스폰 타이머 시작 (5초)..."); // 사망 로그
//             setViewModeInGameCanvas('firstPerson'); // 사망 시 1인칭 시점으로 강제 변경합니다.

//             // 리스폰 진행도 초기화 및 인터벌 시작
//             setHudState(prev => ({ ...prev, respawnProgress: 0 })); // 사망 시 진행도를 0으로 리셋합니다.
//             let currentProgress = 0; // 현재 진행도를 저장할 변수
//             progressInterval = setInterval(() => { // 100ms마다 실행되는 인터벌
//                 currentProgress += 0.1; // 0.1초씩 증가합니다.
//                 if (currentProgress >= 5) { // 5초가 되면
//                     currentProgress = 5; // 진행도를 5로 고정
//                     clearInterval(progressInterval); // 인터벌을 종료합니다.
//                 }
//                 setHudState(prev => ({ ...prev, respawnProgress: currentProgress })); // 진행도 상태를 업데이트합니다.
//             }, 100); // 100ms마다 업데이트

//             // 실제 리스폰 타이머 (5초 후 실행)
//             respawnTimer = setTimeout(() => {
//                 console.log("플레이어 리스폰 중..."); // 리스폰 중 로그
//                 // HP를 100으로 리셋, isDead 상태 해제, 진행도 0으로 리셋합니다.
//                 setHudState(prev => ({ ...prev, health: 100, isDead: false, respawnProgress: 0 }));
//                 console.log("플레이어가 리스폰되었습니다."); // 리스폰 완료 로그

//                 // STOMP 클라이언트가 연결되어 있으면 서버에 플레이어 리스폰 정보를 발행합니다.
//                 if (stompClient && stompClient.connected) {
//                     stompClient.publish({
//                         destination: '/app/playerRespawn', // 메시지 목적지
//                         body: JSON.stringify({ // JSON 형식의 메시지 본문
//                             id: currentPlayerId, // 현재 플레이어 ID
//                             position: { x: 0, y: 1.1, z: 0 }, // 리스폰 위치 (예시)
//                             health: 100 // 체력 100으로 리셋
//                         })
//                     });
//                 }
//             }, 5000); // 5초 후 리스폰

//         }

//         // Cleanup function for useEffect: 컴포넌트 언마운트 또는 isDead 상태 변경 시 타이머/인터벌을 정리합니다.
//         return () => {
//             if (respawnTimer) {
//                 clearTimeout(respawnTimer); // 리스폰 타이머를 클리어합니다.
//                 console.log("리스폰 타이머 클리어됨.");
//             }
//             if (progressInterval) {
//                 clearInterval(progressInterval); // 진행도 인터벌을 클리어합니다.
//                 console.log("진행도 인터벌 클리어됨.");
//             }
//         };
//     }, [hudState.isDead, stompClient, setHudState, setViewModeInGameCanvas]); // 의존성 배열: 이 값들이 변경될 때마다 이펙트가 다시 실행됩니다.

//     // 인벤토리 선택 로직 (키보드 1~8 및 마우스 휠)을 관리하는 useEffect 훅입니다.
//     useEffect(() => {
//         // 키보드 눌림 이벤트 핸들러
//         const handleKeyDown = (event) => {
//             const key = event.key; // 눌린 키 값
//             if (key >= '1' && key <= '8') { // '1'부터 '8'까지의 숫자 키가 눌렸을 때
//                 const newSlot = parseInt(key) - 1; // 0-indexed로 변환 (예: '1' -> 0)
//                 setSelectedInventorySlot(newSlot); // 선택된 인벤토리 슬롯을 업데이트합니다.
//             }
//         };

//         // 마우스 휠 이벤트 핸들러
//         const handleWheel = (event) => {
//             event.preventDefault(); // 페이지 스크롤을 방지합니다.
//             setSelectedInventorySlot(prevSlot => { // 이전 슬롯을 기반으로 새 슬롯을 계산합니다.
//                 const numSlots = inventory.length; // 인벤토리 슬롯 개수
//                 if (event.deltaY > 0) { // 휠을 아래로 스크롤한 경우 (다음 슬롯)
//                     return (prevSlot + 1) % numSlots; // 다음 슬롯으로 이동 (마지막 슬롯에서 다시 첫 슬롯으로 순환)
//                 } else { // 휠을 위로 스크롤한 경우 (이전 슬롯)
//                     return (prevSlot - 1 + numSlots) % numSlots; // 이전 슬롯으로 이동 (첫 슬롯에서 마지막 슬롯으로 순환)
//                 }
//             });
//         };

//         // 전역 window 객체에 이벤트 리스너를 추가합니다.
//         window.addEventListener('keydown', handleKeyDown);
//         window.addEventListener('wheel', handleWheel, { passive: false }); // passive: false로 설정하여 preventDefault()를 사용할 수 있도록 합니다.

//         // Cleanup function for useEffect: 컴포넌트 언마운트 시 이벤트 리스너를 제거합니다.
//         return () => {
//             window.removeEventListener('keydown', handleKeyDown);
//             window.removeEventListener('wheel', handleWheel); // 수정: handleWheel 리스너 제거
//         };
//     }, [inventory.length]); // 의존성 배열: inventory.length가 변경될 때만 이펙트가 재실행됩니다.

//     // STOMP WebSocket 연결 및 메시지 구독 로직을 관리하는 useEffect 훅입니다.
//     useEffect(() => {
//         const WS_URL = 'http://localhost:8080/ws'; // WebSocket 서버 URL을 정의합니다.
//         const socket = new SockJS(WS_URL); // SockJS를 사용하여 WebSocket 연결을 생성합니다. (웹소켓 폴백 지원)
//         const client = new Client({ // STOMP 클라이언트 인스턴스를 생성합니다.
//             webSocketFactory: () => socket, // SockJS 소켓을 STOMP 클라이언트의 웹소켓 팩토리로 설정합니다.
//             reconnectDelay: 5000, // 연결이 끊어졌을 때 5초 후 재연결을 시도합니다.
//             heartbeatIncoming: 4000, // 서버로부터 4초마다 하트비트 메시지를 기대합니다.
//             heartbeatOutgoing: 4000, // 4초마다 서버로 하트비트 메시지를 보냅니다.
//         });

//         // STOMP 클라이언트 연결 시 실행되는 콜백 함수
//         client.onConnect = (frame) => {
//             //console.log("[STOMP] Connected to WebSocket from App.jsx!", frame); // 연결 성공 로그 (주석 처리됨)
//             setStompClient(client); // STOMP 클라이언트 인스턴스를 상태에 저장합니다.

//             // '/topic/playerLocations' 토픽을 구독합니다. (다른 플레이어들의 위치 정보)
//             client.subscribe('/topic/playerLocations', (message) => {
//                 try {
//                     const allPlayerPositions = JSON.parse(message.body); // 메시지 본문을 파싱하여 모든 플레이어 위치를 가져옵니다.
//                     window.onlinePlayers = new Map(allPlayerPositions.map(p => [p.id, p])); // 전역 변수에 맵 형태로 저장합니다.
//                     setHudState(prev => ({ // hudState를 업데이트하여 다른 플레이어 정보를 반영합니다.
//                         ...prev,
//                         otherPlayers: window.onlinePlayers // OtherPlayer 컴포넌트 렌더링에 사용됩니다.
//                     }));
//                 } catch (e) {
//                     console.error("[STOMP Subscribe] Failed to parse player locations message:", e, message.body); // 파싱 오류 처리
//                 }
//             });

//             // '/topic/sceneObjects' 토픽을 구독합니다. (씬 오브젝트 정보)
//             client.subscribe('/topic/sceneObjects', (message) => {
//                 try {
//                     const updatedObjects = JSON.parse(message.body); // 메시지 본문을 파싱하여 업데이트된 오브젝트를 가져옵니다.
//                     handleSceneObjectsUpdate(updatedObjects); // 씬 오브젝트 상태를 업데이트하는 함수를 호출합니다.
//                 }
//                 catch (e) {
//                     console.error("[STOMP Subscribe] Failed to parse scene objects message:", e, message.body); // 파싱 오류 처리
//                 }
//             });

//             // '/topic/playerHit' 토픽을 구독합니다. (플레이어 피격 정보)
//             client.subscribe('/topic/playerHit', (message) => {
//                 try {
//                     const data = JSON.parse(message.body); // 메시지 본문을 파싱합니다.
//                     console.log('[STOMP] playerHit 메시지 수신:', data); // 수신된 메시지 로그

//                     if (data.targetId === currentPlayerId) { // 피격 대상이 현재 플레이어인 경우
//                         console.log('💢 GameCanvas: 내가 맞았습니다! isHit 상태 true로 설정.');
//                         setHudState(prev => { // hudState를 업데이트합니다.
//                             const newHealth = Math.max((prev.health ?? 100) - 10, 0); // 체력을 10 감소시키고 0 미만으로 내려가지 않게 합니다.
//                             return {
//                                 ...prev,
//                                 isHit: true, // 피격 상태를 true로 설정합니다.
//                                 health: newHealth, // 새 체력으로 업데이트합니다.
//                                 isDead: newHealth <= 0 // 체력이 0 이하면 isDead 상태를 true로 설정합니다.
//                             };
//                         });

//                         // 0.5초 후 isHit 상태를 false로 재설정하여 피격 효과를 리셋합니다.
//                         setTimeout(() => {
//                             console.log('💢 GameCanvas: isHit 상태 false로 재설정.');
//                             setHudState(prev => ({ ...prev, isHit: false }));
//                         }, 500);
//                     } else {
//                         // 다른 플레이어가 피격되었을 때 해당 플레이어의 isHitted 상태를 업데이트합니다.
//                         setHudState(prev => {
//                             const newOtherPlayers = new Map(prev.otherPlayers); // 기존 다른 플레이어 맵을 복사합니다.
//                             const targetPlayer = newOtherPlayers.get(data.targetId); // 피격된 플레이어를 찾습니다.
//                             if (targetPlayer) { // 해당 플레이어가 존재하는 경우
//                                 console.log(`💥 GameCanvas: 다른 플레이어 ${data.targetId.substring(0, 5)}가 맞았습니다!`);
//                                 newOtherPlayers.set(data.targetId, { // 해당 플레이어의 animationState.isHitted를 true로 설정합니다.
//                                     ...targetPlayer,
//                                     animationState: {
//                                         ...targetPlayer.animationState,
//                                         isHitted: true,
//                                     },
//                                 });

//                                 // 0.5초 후 isHitted 상태를 false로 재설정합니다.
//                                 setTimeout(() => {
//                                     setHudState(innerPrev => {
//                                         const innerNewOtherPlayers = new Map(innerPrev.otherPlayers);
//                                         const innerTargetPlayer = innerNewOtherPlayers.get(data.targetId);
//                                         if (innerTargetPlayer) {
//                                             console.log(`💥 GameCanvas: 다른 플레이어 ${data.targetId.substring(0, 5)} isHitted 상태 false로 재설정.`);
//                                             innerNewOtherPlayers.set(data.targetId, {
//                                                 ...innerTargetPlayer,
//                                                 animationState: {
//                                                     ...innerTargetPlayer.animationState,
//                                                     isHitted: false,
//                                                 },
//                                             });
//                                         }
//                                         return { ...innerPrev, otherPlayers: innerNewOtherPlayers };
//                                     });
//                                 }, 500);

//                             }
//                             return { ...prev, otherPlayers: newOtherPlayers };
//                         });
//                     }

//                     if (data.fromId === currentPlayerId) { // 공격 주체가 현재 플레이어인 경우
//                         console.log('🥊 GameCanvas: 내가 공격했습니다!'); // 공격 로그
//                     }

//                 } catch (e) {
//                     console.error('[STOMP Subscribe] playerHit 메시지 파싱 실패:', e); // 파싱 오류 처리
//                 }
//             });

//             // '/topic/collectObject' 토픽을 구독합니다. (오브젝트 수집 이벤트)
//             client.subscribe('/topic/collectObject', (message) => {
//                 try {
//                     const { objectId, collectorId } = JSON.parse(message.body); // 수집된 오브젝트 ID와 수집한 플레이어 ID를 파싱합니다.
//                     console.log(`[STOMP] Object ${objectId} collected by ${collectorId}`);

//                     // 씬에서 해당 오브젝트를 제거합니다 (모든 클라이언트에서 동일하게 적용).
//                     setSceneObjects(prevObjects => prevObjects.filter(obj => obj.id !== objectId));

//                     // 참고: 만약 현재 플레이어가 수집한 것이라면 인벤토리에 추가하는 로직은 이미 handlePlayerInteract에서 처리됩니다.
//                     // 이 부분은 다른 플레이어가 오브젝트를 수집했을 때 내 화면에서도 해당 오브젝트가 사라지도록 하기 위함입니다.
//                 } catch (e) {
//                     console.error('[STOMP Subscribe] collectObject 메시지 파싱 실패:', e); // 파싱 오류 처리
//                 }
//             });


//             // 초기 플레이어 정보 전송 (연결 시)
//             client.publish({
//                 destination: `/app/playerMove`, // 초기 등록 메시지 목적지 (서버가 플레이어를 인식하게 합니다)
//                 body: JSON.stringify({ // JSON 형식의 메시지 본문
//                     id: currentPlayerId, // 현재 플레이어 ID
//                     nickname: playerNickname, // 플레이어 닉네임
//                     position: { x: 0, y: 1.1, z: 0 }, // 초기 위치
//                     rotationY: 0, // 초기 Y축 회전값
//                     animationState: { isIdle: true } // 초기 애니메이션 상태 (대기)
//                 })
//             });
//         };

//         // STOMP 오류 발생 시 실행되는 콜백 함수
//         client.onStompError = (frame) => {
//             console.error('STOMP Error from App.jsx:', frame); // 오류 로그
//         };

//         // STOMP 연결 해제 시 실행되는 콜백 함수
//         client.onDisconnect = () => {
//             console.log('[STOMP] Disconnected from WebSocket from App.jsx.'); // 연결 해제 로그
//             setStompClient(null); // STOMP 클라이언트 상태를 초기화합니다.
//         };

//         client.activate(); // STOMP 클라이언트를 활성화하여 연결을 시작합니다.

//         // Cleanup function for useEffect (컴포넌트 언마운트 시 또는 의존성 변경 시 클린업)
//         return () => {
//             // 브라우저 창이 닫히거나 페이지를 떠날 때 실행되는 이벤트 핸들러
//             const handleBeforeUnload = () => {
//                 if (client && client.connected) { // STOMP 클라이언트가 연결되어 있는 경우
//                     // 페이지를 떠나기 전에 서버에 플레이어 등록 해제 메시지를 전송합니다.
//                     client.publish({ destination: '/app/unregisterPlayer', body: JSON.stringify({ id: currentPlayerId }) });
//                     client.deactivate(); // STOMP 클라이언트를 비활성화하여 연결을 끊습니다.
//                 }
//             };
//             window.addEventListener('beforeunload', handleBeforeUnload); // beforeunload 이벤트 리스너 등록

//             if (client && client.connected) { // 일반적인 클린업 (예: 컴포넌트 언마운트 시)
//                 client.publish({ destination: '/app/unregisterPlayer', body: JSON.stringify({ id: currentPlayerId }) });
//                 client.deactivate();
//             }
//             window.removeEventListener('beforeunload', handleBeforeUnload); // beforeunload 이벤트 리스너 제거
//         };
//     }, [playerNickname, setIsDeadInGameCanvas]); // 의존성 배열

//     // 씬 오브젝트 업데이트 핸들러 함수입니다. useCallback을 사용합니다.
//     const handleSceneObjectsUpdate = useCallback((updatedObjects) => {
//         setSceneObjects(prevObjects => { // 이전 오브젝트 상태를 기반으로 업데이트합니다.
//             const newObjectsMap = new Map(prevObjects.map(obj => [obj.id, obj])); // 이전 오브젝트들을 맵으로 변환하여 효율적인 조회를 가능하게 합니다.
//             updatedObjects.forEach(updatedObj => { // 업데이트된 오브젝트 각각에 대해 처리합니다.
//                 const currentObj = newObjectsMap.get(updatedObj.id); // 현재 맵에 해당 ID의 오브젝트가 있는지 확인합니다.
//                 if (currentObj) {
//                     // 기존 오브젝트는 위치만 업데이트합니다.
//                     newObjectsMap.set(updatedObj.id, { ...currentObj, position: updatedObj.position });
//                 } else {
//                     // 새로운 오브젝트는 추가합니다 (기본값 설정 포함).
//                     newObjectsMap.set(updatedObj.id, {
//                         ...updatedObj,
//                         type: updatedObj.type || 'sphere', // 타입이 없으면 'sphere' (구체)로 기본값 설정
//                         radius: updatedObj.radius || 1, // 반지름이 없으면 1로 기본값 설정
//                         color: updatedObj.color || 'gray', // 색상이 없으면 'gray'로 기본값 설정
//                         collider: updatedObj.collider || 'ball', // 충돌체가 없으면 'ball'로 기본값 설정
//                     });
//                 }
//             });
//             return Array.from(newObjectsMap.values()); // 맵을 다시 배열로 변환하여 상태를 업데이트합니다.
//         });
//     }, []); // 의존성 배열이 비어있으므로 컴포넌트 마운트 시 한 번만 생성됩니다.

//     // Player로부터 상호작용 가능한 오브젝트 ID와 근접 여부를 받아 상태를 업데이트하는 함수입니다. useCallback을 사용합니다.
//     const onObjectProximityChange = useCallback((objectId, isNear) => {
//         setHudState(prev => ({
//             ...prev,
//             interactableObjectId: isNear ? objectId : null, // 근접하면 오브젝트 ID를 설정하고, 아니면 null로 설정
//             showInteractionPrompt: isNear, // 근접 여부에 따라 상호작용 프롬프트 표시 여부를 설정
//         }));
//     }, []); // 의존성 배열이 비어있으므로 컴포넌트 마운트 시 한 번만 생성됩니다.

//     // Player로부터 상호작용 요청을 받아 처리하는 함수입니다. useCallback을 사용합니다.
//     const handlePlayerInteract = useCallback((interactedObjectId) => {
//         console.log(`[GameCanvas] handlePlayerInteract called with objectId: ${interactedObjectId}`);
//         const interactedObject = sceneObjects.find(obj => obj.id === interactedObjectId); // 상호작용한 오브젝트를 찾습니다.
//         console.log(`[GameCanvas] Found interactedObject:`, interactedObject);

//         if (interactedObject && interactedObject.type === 'apple') { // 상호작용한 오브젝트가 사과인 경우
//             console.log(`[GameCanvas] Interacted object is an apple. Adding to inventory.`);
//             setInventory(prevInventory => { // 인벤토리를 업데이트합니다.
//                 const existingItemIndex = prevInventory.findIndex(item => item && item.name === 'Apple'); // 기존에 사과가 있는지 확인합니다.
//                 if (existingItemIndex !== -1) { // 기존 사과가 있다면
//                     const newInventory = [...prevInventory]; // 새 인벤토리 배열을 복사합니다.
//                     newInventory[existingItemIndex].count += 1; // 사과 개수를 1 증가시킵니다.
//                     console.log(`[GameCanvas] Updated existing apple count. New inventory:`, newInventory);
//                     return newInventory; // 업데이트된 인벤토리 반환
//                 } else { // 기존 사과가 없다면
//                     const firstEmptySlotIndex = prevInventory.findIndex(item => item === null); // 첫 번째 빈 슬롯을 찾습니다.
//                     if (firstEmptySlotIndex !== -1) { // 빈 슬롯이 있다면
//                         const newInventory = [...prevInventory]; // 새 인벤토리 배열을 복사합니다.
//                         // 빈 슬롯에 새로운 사과 아이템을 추가합니다 (이미지 경로 포함).
//                         newInventory[firstEmptySlotIndex] = { name: 'Apple', count: 1, id: interactedObject.id, image: '/models/apple.png' };
//                         console.log(`[GameCanvas] Added new apple to inventory. New inventory:`, newInventory);
//                         return newInventory; // 업데이트된 인벤토리 반환
//                     }
//                     console.log(`[GameCanvas] Inventory full, could not add apple.`); // 인벤토리가 가득 찼을 경우
//                     return prevInventory; // 변경 없음
//                 }
//             });
//             // 상호작용 프롬프트를 숨깁니다.
//             setHudState(prev => ({ ...prev, interactableObjectId: null, showInteractionPrompt: false }));
//             console.log("Apple collected! Prompt removed.");

//             // 씬에서 수집된 사과 오브젝트를 제거합니다.
//             console.log(`[GameCanvas] Removing apple with ID: ${interactedObject.id} from sceneObjects.`);
//             setSceneObjects(prevObjects => prevObjects.filter(obj => obj.id !== interactedObject.id));

//             // STOMP 클라이언트가 연결되어 있으면 서버에 오브젝트 수집 이벤트를 발행합니다.
//             if (stompClient && stompClient.connected) {
//                 console.log(`[GameCanvas] Publishing collectObject event for ${interactedObject.id}`);
//                 stompClient.publish({
//                     destination: '/app/collectObject', // 메시지 목적지
//                     body: JSON.stringify({ objectId: interactedObject.id, collectorId: currentPlayerId }), // 메시지 본문
//                 });
//             }
//         } else {
//             console.log(`[GameCanvas] Interacted object is not an apple or not found. Object:`, interactedObject);
//         }
//     }, [sceneObjects, setInventory, setHudState, stompClient, currentPlayerId]); // 의존성 배열

//     // 선택된 아이템 사용 함수 (좌클릭 시 Player 컴포넌트에서 호출)입니다. useCallback을 사용합니다.
//     const handleUseSelectedItem = useCallback(() => {
//         if (selectedInventorySlot !== null) { // 선택된 인벤토리 슬롯이 있는 경우
//             setInventory(prevInventory => { // 인벤토리를 업데이트합니다.
//                 const newInventory = [...prevInventory]; // 새 인벤토리 배열을 복사합니다.
//                 const itemToUse = newInventory[selectedInventorySlot]; // 선택된 슬롯의 아이템을 가져옵니다.

//                 if (itemToUse) { // 아이템이 존재하는 경우
//                     console.log(`[GameCanvas] Using item: ${itemToUse.name} from slot ${selectedInventorySlot}. Current count: ${itemToUse.count}`);
//                     if (itemToUse.name === 'Apple') { // 사용하려는 아이템이 사과인 경우
//                         // 사과 사용 로직: 체력 회복
//                         setHudState(prevHud => { // HUD 상태를 업데이트합니다.
//                             const currentHealth = prevHud.health ?? 100; // 현재 체력
//                             const newHealth = Math.min(currentHealth + 20, 100); // 체력을 20 회복시키고 최대 100으로 제한합니다.
//                             console.log(`[GameCanvas] Player health: ${currentHealth} -> ${newHealth}`);
//                             return { ...prevHud, health: newHealth }; // 업데이트된 체력으로 HUD 상태 반환
//                         });

//                         // 아이템 개수 감소 또는 슬롯 비우기
//                         if (itemToUse.count > 1) { // 아이템 개수가 1보다 많으면
//                             newInventory[selectedInventorySlot] = { ...itemToUse, count: itemToUse.count - 1 }; // 개수만 1 감소
//                             console.log(`[GameCanvas] Item count decreased. New count: ${newInventory[selectedInventorySlot].count}`);
//                         } else { // 아이템 개수가 1이면 (마지막 아이템)
//                             newInventory[selectedInventorySlot] = null; // 슬롯을 비웁니다.
//                             console.log(`[GameCanvas] Item consumed. Slot ${selectedInventorySlot} is now empty.`);
//                         }

//                         // 서버에 아이템 사용 이벤트를 발행합니다.
//                         if (stompClient && stompClient.connected) {
//                             console.log(`[GameCanvas] Publishing useItem event for ${itemToUse.name} (ID: ${itemToUse.id})`);
//                             stompClient.publish({
//                                 destination: '/app/useItem', // 메시지 목적지
//                                 body: JSON.stringify({ // JSON 형식의 메시지 본문
//                                     userId: currentPlayerId, // 아이템을 사용한 플레이어 ID
//                                     itemId: itemToUse.id, // 사용된 아이템의 원래 오브젝트 ID (또는 아이템 타입)
//                                     itemType: itemToUse.name, // 아이템 이름
//                                     slotIndex: selectedInventorySlot, // 사용된 슬롯 인덱스
//                                 }),
//                             });
//                         }
//                     } else {
//                         console.log(`[GameCanvas] Item ${itemToUse.name} is not consumable.`); // 소모할 수 없는 아이템인 경우
//                     }
//                 } else {
//                     console.log(`[GameCanvas] No item found in selected slot ${selectedInventorySlot}.`); // 선택된 슬롯에 아이템이 없는 경우
//                 }
//                 return newInventory; // 업데이트된 인벤토리 반환
//             });
//         } else {
//             console.log(`[GameCanvas] No slot selected for item use.`); // 슬롯이 선택되지 않은 경우
//         }
//     }, [selectedInventorySlot, inventory, setHudState, stompClient, currentPlayerId]); // 의존성 배열


//     // GameCanvas 컴포넌트의 최종 렌더링 부분입니다.
//     return (
//         <> {/* React Fragment를 사용하여 여러 요소를 묶습니다. */}
//             {/* Leva 디버그 UI 컴포넌트: 개발 중 변수 값을 쉽게 조정할 수 있는 UI를 제공합니다. */}
//             <Leva collapsed={true} /> {/* 기본적으로 접힌 상태로 시작합니다. */}
//             {/* 플레이어 HUD 컴포넌트: 체력, 인벤토리 등 게임 내 인터페이스를 표시합니다. */}
//             <PlayerHUD
//                 state={hudState} // 현재 HUD 상태를 전달합니다.
//                 playerNickname={playerNickname} // 플레이어 닉네임을 전달합니다.
//                 inventory={inventory} // 인벤토리 상태를 전달합니다.
//                 selectedInventorySlot={selectedInventorySlot} // 선택된 인벤토리 슬롯을 전달합니다.
//             />

//             {/* 키보드 컨트롤 맵 설정: controlsMap에 정의된 키 입력에 따라 액션을 처리합니다. */}
//             <KeyboardControls map={controlsMap}>
//                 {/* Three.js 캔버스 설정 */}
//                 <Canvas
//                     shadows // 씬 전체에 그림자 활성화를 위한 설정입니다.
//                     camera={{ fov: 60, position: [0, 5, 10] }} // 카메라의 시야각(fov)과 초기 위치를 설정합니다.
//                     style={{
//                         width: '100vw', // 캔버스 너비를 뷰포트 너비에 맞춥니다.
//                         height: '100vh', // 캔버스 높이를 뷰포트 높이에 맞춥니다.
//                         // 플레이어 사망 상태(hudState.isDead)에 따라 흑백 필터(grayscale)를 적용합니다.
//                         filter: hudState.isDead ? 'grayscale(100%)' : 'none'
//                     }}
//                     linear={false} // 텍스처 필터링 모드를 선형 보간 대신 근접 보간으로 설정합니다. (픽셀이 더 뚜렷하게 보임)
//                 >
//                     {/* 씬의 배경색을 설정합니다. */}
//                     <color attach="background" args={['#8fafdb']} />

//                     {/* 앰비언트 라이트 (전체적인 분위기를 밝히는 조명) */}
//                     <ambientLight intensity={0.5} />
//                     {/* 방향성 라이트 (태양과 같은 광원): 특정 방향에서 빛을 비추고 그림자를 드리웁니다. */}
//                     <directionalLight position={[5, 10, 5]} intensity={1} castShadow />
//                     {/* Rapier 물리 엔진 설정: 이 내부에 있는 RigidBody 컴포넌트들이 물리 시뮬레이션의 영향을 받습니다. */}
//                     <Physics gravity={[0, -9.81, 0]}> {/* 중력 설정 (Y축 방향으로 -9.81) */}
//                         {/* GModMap 컴포넌트를 Physics 내부에 배치하여 맵도 물리적 상호작용이 가능하도록 합니다. */}
//                         <GModMap />

//                         {/* ErrorBoundary로 Player 컴포넌트를 감싸서 모델 로딩 오류나 렌더링 오류를 처리합니다. */}
//                         <ErrorBoundary>
//                             {/* React.Suspense로 비동기 로딩(예: 모델 로딩) 중 대체 UI를 제공합니다. */}
//                             <React.Suspense fallback={<Text position={[0, 1, 0]} color="black">플레이어 로딩 중...</Text>}>
//                                 {/* STOMP 클라이언트가 연결되었을 때만 Player 컴포넌트를 렌더링합니다. */}
//                                 {stompClient && (
//                                     <Player
//                                         onHudUpdate={setHudState} // HUD 상태 업데이트 함수를 Player에게 전달합니다.
//                                         objectRefs={objectRefs} // 씬 오브젝트 참조를 Player에게 전달합니다.
//                                         stompClientInstance={stompClient} // STOMP 클라이언트 인스턴스를 Player에게 전달합니다.
//                                         isPlayerHitted={hudState.isHit} // 플레이어 피격 상태를 전달합니다.
//                                         playerNickname={playerNickname} // 플레이어 닉네임을 전달합니다.
//                                         isDead={hudState.isDead} // 사망 상태를 전달합니다.
//                                         setIsDead={setIsDeadInGameCanvas} // 사망 상태 설정 함수를 전달합니다.
//                                         setViewMode={setViewModeInGameCanvas} // 시점 변경 함수를 전달합니다.
//                                         currentPlayerId={currentPlayerId} // 현재 플레이어 ID를 전달합니다.
//                                         onObjectProximityChange={onObjectProximityChange} // 오브젝트 근접 감지 콜백 함수를 전달합니다.
//                                         onInteract={handlePlayerInteract} // 플레이어 상호작용 요청 콜백 함수를 전달합니다.
//                                         onUseItem={handleUseSelectedItem} // 아이템 사용 요청 콜백 함수를 전달합니다.
//                                         selectedInventorySlot={selectedInventorySlot} // 선택된 인벤토리 슬롯을 전달합니다.
//                                         isItemSelected={isItemSelected} // 선택된 슬롯에 아이템이 있는지 여부를 전달합니다.
//                                     />
//                                 )}
//                             </React.Suspense>
//                         </ErrorBoundary>

//                         {/* 다른 플레이어들을 렌더링합니다. */}
//                         {hudState.otherPlayers && Array.from(hudState.otherPlayers.values()).map((player) => {
//                             if (player.id === currentPlayerId) {
//                                 return null; // 현재 플레이어는 OtherPlayer로 렌더링하지 않습니다 (Player 컴포넌트가 담당).
//                             }
//                             return (
//                                 {/* 다른 플레이어 컴포넌트도 ErrorBoundary와 Suspense로 감싸 오류 처리 및 로딩 UI를 제공합니다. */}
//                                 <ErrorBoundary key={`other-player-error-${player.id}`}>
//                                     <React.Suspense fallback={<Text position={[player.position.x, player.position.y + 1, player.position.z]} color="gray">다른 플레이어 로딩 중...</Text>}>
//                                         <OtherPlayer
//                                             key={player.id} // 고유 키
//                                             id={player.id} // 플레이어 ID
//                                             nickname={player.nickname} // 플레이어 닉네임
//                                             position={player.position} // 플레이어 위치
//                                             rotationY={player.rotationY} // 플레이어 Y축 회전
//                                             animationState={player.animationState} // 플레이어 애니메이션 상태
//                                         />
//                                     </React.Suspense>
//                                 </ErrorBoundary>
//                             );
//                         })}

//                         {/* 씬 오브젝트들을 렌더링합니다. */}
//                         {sceneObjects.map((obj) => (
//                             <SceneObject
//                                 key={obj.id} // 고유 키
//                                 obj={obj} // 오브젝트 데이터
//                                 objectRefs={objectRefs} // 오브젝트 참조
//                             />
//                         ))}

//                     </Physics>
//                 </Canvas>
//             </KeyboardControls>
//         </>
//     );
// }
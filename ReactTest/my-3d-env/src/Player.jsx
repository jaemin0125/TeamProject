// Player.jsx
import { useRef, useState, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useKeyboardControls } from '@react-three/drei';
import { RigidBody, CapsuleCollider, useRapier } from '@react-three/rapier';
import { useControls } from 'leva'; // 'leva' 임포트 수정
import * as THREE from 'three';

import { CharacterModel } from './CharacterModel'; // CharacterModel 임포트
import { checkHit } from './utils/gameUtils'; // checkHit 임포트

// Player 컴포넌트 (현재 플레이어의 로직)
export function Player({
    onHudUpdate,
    stompClientInstance,
    isPlayerHitted,
    playerNickname,
    isDead,
    setViewMode,
    currentPlayerId,
    onObjectProximityChange,
    onInteract, onUseItem,
    selectedInventorySlot,
    isItemSelected,
    selectedItem,
    isChatting,
    playerPosition
}) {
    const { camera, gl, scene } = useThree(); // Three.js 카메라와 WebGL 렌더러
    const [subscribeKeys, getKeys] = useKeyboardControls(); // 키보드 컨트롤 훅
    const [sitToggle, setSitToggle] = useState(false); // 앉기 토글 상태
    const [lieToggle, setLieToggle] = useState(false); // 눕기 토글 상태
    const playerRef = useRef(); // 플레이어 RigidBody 참조
    const modelRef = useRef(); // 플레이어 3D 모델 참조
    const [isGrounded, setIsGrounded] = useState(false); // 바닥에 닿았는지 여부
    const [currentViewMode, setCurrentViewMode] = useState('firstPerson'); // 플레이어 내부의 시점 모드
    const [isPunching, setIsPunching] = useState(false); // 펀치 동작 여부
    const [isJumping, setIsJumping] = useState(false); // 점프 상태 관리 (유지)
    const [canPunch, setCanPunch] = useState(true); // 펀치 쿨타임 상태
    const [AimingToggle, setAimingToggle] = useState(false);
    const interactableObjectIdRef = useRef(null); // 플레이어가 근접한 상호작용 가능 오브젝트 ID
    const exitTimeoutRef = useRef(null); // 충돌 종료 지연을 위한 타이머 참조
    const [isFiring, setIsFiring] = useState(false);
    const firingIntervalRef = useRef(null);

    // 스페이스바의 이전 눌림 상태를 추적하는 Ref 추가
    const lastJumpKeyStatus = useRef(false);
    const lastInteractKeyState = useRef(false); // 'F' 키의 이전 상태를 저장하는 Ref 추가

    const pitch = useRef(0); // 카메라 상하 회전 (pitch)
    const yaw = useRef(0); // 카메라 좌우 회전 (yaw)
    const roll = useRef(0); // 카메라 Z축 회전 (roll)

    // 사망 시 카메라 애니메이션을 위한 목표 값
    const deathCameraTargetY = useRef(0.1); // 카메라가 최종적으로 도달할 Y 위치 (바닥에 가까움)
    const deathCameraTargetPitch = useRef(0); // 카메라가 최종적으로 바라볼 각도 (수평으로 시작)
    const deathCameraTargetRoll = useRef(Math.PI / 4); // 카메라가 최종적으로 옆으로 쓰러질 각도 (45도)

    // Leva를 통한 디버그 컨트롤 (속도, 점프 임펄스)
    const { speed, jumpImpulse } = useControls({
        speed: { value: 5, min: 1, max: 100 },
        jumpImpulse: { value: 10, min: 1, max: 100 } // 점프 임펄스 기본값 20으로 변경
    });

    const toggleViewPressed = useRef(false); // 시점 전환 키 눌림 상태

    const { rapier, world } = useRapier(); // rapier world 객체 접근

    const fireBullet = () => {
        // 1. 플레이어의 현재 위치를 가져옵니다.
        const playerPosition = playerRef.current.translation();
        // 2. 플레이어의 현재 Y축 회전값을 가져옵니다.
        const playerRotationY = yaw.current;

        // 3. 플레이어의 회전값을 기반으로 정면 방향을 계산합니다.
        const playerRotation = new THREE.Euler(0, playerRotationY, 0, 'YXZ');
        // 4. 총구의 상대적 위치 (플레이어 모델의 중심으로부터의 오프셋)를 정의합니다.
        const gunMuzzleOffset = new THREE.Vector3(0, 0.8, 0.5); // X, Y를 0으로, Z를 -1.0으로 설정
        gunMuzzleOffset.applyEuler(playerRotation); // 플레이어의 회전을 오프셋에 적용

        // 5. 최종 레이저 시작 위치를 계산합니다.
        const origin = new THREE.Vector3(playerPosition.x, playerPosition.y, playerPosition.z).add(gunMuzzleOffset);

        // ✨ 화면 반동 적용
        let verticalRecoil;
        let horizontalRecoil;

        if (AimingToggle) { // 조준 중일 때 (반동 적게)
            verticalRecoil = Math.random() * 0.003; // 더 작은 수직 반동
            horizontalRecoil = (Math.random() - 0.5) * 0.002; // 더 작은 수평 반동
        } else { // 조준 안 할 때 (반동 크게)
            verticalRecoil = Math.random() * 0.008; // 기존 수직 반동
            horizontalRecoil = (Math.random() - 0.5) * 0.01; // 기존 수평 반동
        }

        pitch.current -= verticalRecoil;
        yaw.current += horizontalRecoil;
        pitch.current = THREE.MathUtils.clamp(pitch.current, -Math.PI / 2 + 0.1, Math.PI / 2 - 0.1);

        // 6. 레이저 방향 결정 (반동 적용 후의 카메라 방향)
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);

        // ✅ 레이캐스트 수행 (Rapier 방식)
        const ray = new rapier.Ray(origin, direction);
        const hit = world.castRay(ray, 100, true); // maxDist 100, solidOnly true

        if (hit && hit.collider) {
            const colliderHandle = hit.collider.handle;
            const collider = world.getCollider(colliderHandle);
            const rigidBody = collider.parent();

            if (rigidBody) {
                const targetId = rigidBody.userData?.id;
                if (targetId && targetId !== currentPlayerId) {
                    console.log('🎯 정확히 콜라이더 맞춤! 타겟:', targetId);

                    stompClientInstance.publish({
                        destination: '/app/playerHit',
                        body: JSON.stringify({
                            fromId: currentPlayerId,
                            fromPosition: { x: playerPosition.x, y: playerPosition.y, z: playerPosition.z },
                            targetId: targetId,
                            targetPosition: window.onlinePlayers.get(targetId)?.position ? { x: window.onlinePlayers.get(targetId).position.x, y: window.onlinePlayers.get(targetId).position.y, z: window.onlinePlayers.get(targetId).position.z } : null,
                            weaponName: selectedItem?.name // 무기 정보 추가
                        }),
                    });
                }
            }
        }

        // 🔴 시각화 (레이저 라인)
        const endVec = origin.clone().add(direction.clone().multiplyScalar(100));
        const laserGeo = new THREE.BufferGeometry().setFromPoints([origin, endVec]);
        const laserMat = new THREE.LineBasicMaterial({ color: 0xff0000 });
        const laserLine = new THREE.Line(laserGeo, laserMat);
        scene.add(laserLine);
        setTimeout(() => {
            scene.remove(laserLine);
            laserGeo.dispose();
            laserMat.dispose();
        }, 200);
    };



    // 펀치 시 타격 감지 및 서버 전송 로직
    useEffect(() => {
        // 펀치 동작 중이 아니고, 펀치 가능하며, STOMP 클라이언트가 연결되어 있고, 플레이어가 죽지 않았을 때만 실행
        if (!isPunching || !canPunch || !stompClientInstance || !stompClientInstance.connected || isDead) return;

        const playerPosition = playerRef.current?.translation(); // 공격자 위치
        const attackerQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw.current, 0)); // 공격자 회전

        let hitOccurred = false; // 타격 발생 여부 플래그

        // 모든 온라인 플레이어를 순회하며 타격 감지
        (window.onlinePlayers || new Map()).forEach((targetPlayer, targetId) => {
            if (targetId === currentPlayerId) return; // 자기 자신은 제외

            const targetPosition = targetPlayer.position; // 타겟 플레이어 위치
            const isHit = checkHit(playerPosition, attackerQuat, targetPosition); // 히트 여부 확인

            if (isHit) {
                console.log(`[🥊 Player] 타격 성공 -> 대상: ${targetId}`);
                // 서버에 플레이어 피격 메시지 전송
                stompClientInstance.publish({
                    destination: '/app/playerHit',
                    body: JSON.stringify({
                        fromId: currentPlayerId,
                        fromPosition: { x: playerPosition.x, y: playerPosition.y, z: playerPosition.z },
                        targetId: targetId,
                        targetPosition: window.onlinePlayers.get(targetId)?.position ? { x: window.onlinePlayers.get(targetId).position.x, y: window.onlinePlayers.get(targetId).position.y, z: window.onlinePlayers.get(targetId).position.z } : null,
                        weaponName: "punch" // 펀치 공격 시 무기 정보 추가
                    }),
                });
                hitOccurred = true; // 타격이 발생했음을 표시
            }
        });

        if (hitOccurred) { // 타격이 발생했을 때만 쿨타임 적용
            setCanPunch(false); // 쿨타임 시작
            setTimeout(() => {
                setCanPunch(true); // 500ms 후 쿨타임 종료
            }, 500);
        }
    }, [isPunching, canPunch, stompClientInstance, isDead, currentPlayerId]); // 의존성 배열

    useEffect(() => {
        if (!isFiring || isDead || selectedItem?.name !== 'ak-47') return;

        // 일정 간격으로 fireBullet 호출
        firingIntervalRef.current = setInterval(() => {
            fireBullet();
        }, 50); // 150ms 간격으로 발사

        return () => clearInterval(firingIntervalRef.current);
    }, [isFiring, isDead, selectedItem]);

    // 컴포넌트 마운트 시 초기 플레이어 등록
    useEffect(() => {
        if (stompClientInstance && stompClientInstance.connected) {
            //console.log("[Player] Initial player registration upon mount.");
            const initialPlayerState = {
                id: currentPlayerId,
                nickname: playerNickname,
                position: { x: 0, y: 0, z: 0 },
                rotationY: yaw.current + Math.PI,
                animationState: {
                    isWalking: false, isBackward: false, isLeft: false, isRight: false,
                    isJumping: false, isRunning: false, isSitted: false, isSittedAndWalk: false,
                    isLyingDown: false, isLyingDownAndWalk: false, isPunching: false, isHitted: false, isArmed: false, isIdle: true,
                    isDead: false // 죽음 상태 추가
                }
            };
            // 서버에 플레이어 등록 메시지 전송
            stompClientInstance.publish({
                destination: '/app/registerPlayer',
                body: JSON.stringify(initialPlayerState)
            });
        }
    }, [stompClientInstance, playerNickname, currentPlayerId]); // 의존성 배열

    // 'C' (앉기) 및 'Z' (눕기) 토글 로직
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (isDead || isChatting) return; // 죽음 상태일 때 움직임 비활성화
            if (e.code === 'KeyC') {
                setSitToggle(prev => {
                    const next = !prev;
                    if (next) setLieToggle(false); // 앉으면 눕기 해제
                    return next;
                });
            }
            if (e.code === 'KeyZ') {
                setLieToggle(prev => {
                    const next = !prev;
                    if (next) setSitToggle(false); // 누우면 앉기 해제
                    return next;
                });
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isDead, isChatting]); // isDead 의존성 추가

    // 마우스 클릭 (펀치 또는 아이템 사용) 로직
    useEffect(() => {
        const canvas = gl.domElement; // 캔버스 요소 가져오기
        const handleMouseDown = (e) => {
            if (isDead) return;



            if (e.button === 0) { // 좌클릭
                if (isItemSelected && typeof onUseItem === 'function') {
                    if (typeof selectedInventorySlot === 'number' && selectedInventorySlot >= 0 && selectedItem.name == 'apple') { // 숫자인지, 유효한 인덱스인지 확인
                        console.log(`[Player] Calling onUseItem with selected slot index: ${selectedInventorySlot}.`);
                        onUseItem(selectedInventorySlot); // <-- 인덱스를 인자로 전달
                    } else {
                        if (canPunch) {
                            setIsPunching(true);
                            setTimeout(() => setIsPunching(false), 500);
                        }
                    }
                } else if (canPunch && !isArmed) {
                    console.log(`[Player] Condition not met for item use. Performing punch.`);
                    setIsPunching(true);
                    setTimeout(() => setIsPunching(false), 500);
                }
            }

            if (e.button === 0 && selectedItem?.name === 'ak-47') {
                setIsFiring(true);
            }
            if (e.button === 2 && selectedItem.name == 'ak-47') {
                // 우클릭 눌렀을 때 → 조준 시작
                setAimingToggle(true);

            }
        };
        const handleMouseUp = (e) => {
            if (e.button === 0 && selectedItem?.name === 'ak-47') {
                fireBullet();
                setIsFiring(false);
            }
            if (e.button === 2 && selectedItem.name == 'ak-47') {
                // 우클릭 떼었을 때 → 조준 해제
                setAimingToggle(false);
            }
        };

        // 마우스 이벤트 리스너를 window 대신 캔버스에 직접 연결
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mouseup', handleMouseUp);
        return () => {
            canvas.removeEventListener('mousedown', handleMouseDown);
            canvas.removeEventListener('mouseup', handleMouseUp);
        };
    }, [canPunch, isDead, onUseItem, isItemSelected, gl, selectedInventorySlot, isFiring]); // gl을 의존성 배열에 추가

    // 뷰 모드 전환 (1인칭/3인칭) 로직
    useEffect(() => {
        const unsubscribe = subscribeKeys(
            (s) => s.toggleView,
            (pressed) => {
                if (isDead || isChatting) return; // 죽음 상태일 때 뷰 모드 전환 비활성화
                if (pressed && !toggleViewPressed.current) {
                    setCurrentViewMode((prev) => {
                        const newMode = (prev === 'firstPerson' ? 'thirdPerson' : 'firstPerson');
                        // 3인칭에서 1인칭으로 전환 시 pitch 보정
                        if (newMode === 'firstPerson' && prev === 'thirdPerson') {
                            pitch.current = 0; // 1인칭 전환 시 pitch를 0으로 초기화 (정면)
                        }
                        setViewMode(newMode); // GameCanvas의 viewMode도 업데이트
                        return newMode;
                    });
                }
                toggleViewPressed.current = pressed;
            }
        );
        return () => unsubscribe();
    }, [subscribeKeys, isDead, setViewMode, isChatting]); // 의존성 배열

    // 마우스 움직임으로 카메라 회전 로직
    const onMouseMove = useCallback((e) => {
        if (isDead) return; // 죽음 상태일 때 마우스 움직임 비활성화
        yaw.current -= e.movementX * 0.002;
        // yaw 값을 -PI에서 PI 사이로 정규화 (시점 깨짐 방지)
        yaw.current = (yaw.current + Math.PI) % (2 * Math.PI) - Math.PI;

        if (currentViewMode === 'firstPerson') {
            pitch.current -= e.movementY * 0.002;
        } else {
            pitch.current += e.movementY * 0.002;
        }

        pitch.current = THREE.MathUtils.clamp(pitch.current, -Math.PI / 2 + 0.1, Math.PI / 2 - 0.1);
    }, [currentViewMode, isDead]); // 의존성 배열

    // 캔버스 클릭 시 포인터 락 요청 로직
    useEffect(() => {
        const canvas = gl.domElement;
        const requestPointerLock = () => {
            if (isDead) return; // 죽음 상태일 때 포인터 락 비활성화
            canvas.requestPointerLock();
        };
        canvas.addEventListener('click', requestPointerLock);
        return () => { canvas.removeEventListener('click', requestPointerLock); };
    }, [gl, isDead]); // 의존성 배열

    // 포인터 락 상태 변경 감지 및 마우스 이벤트 리스너 추가/제거 로직
    useEffect(() => {
        const canvas = gl.domElement;
        const handlePointerLockChange = () => {
            if (document.pointerLockElement === canvas && !isDead) { // isDead 상태 체크 추가
                document.addEventListener('mousemove', onMouseMove);
            } else {
                document.removeEventListener('mousemove', onMouseMove);
            }
        };
        // 초기 렌더링 시 포인터 락 상태에 따라 이벤트 리스너 설정
        if (document.pointerLockElement === canvas && !isDead) {
            document.addEventListener('mousemove', onMouseMove);
        }
        document.addEventListener('pointerlockchange', handlePointerLockChange);
        return () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('pointerlockchange', handlePointerLockChange);

        };
    }, [onMouseMove, isDead, gl]); // gl을 의존성 배열에 추가

    // 플레이어 사망/리스폰 시 시점 및 위치 초기화 로직
    useEffect(() => {
        // isDead가 true로 바뀌면 (사망 시)
        if (isDead) {
            console.log("Player 컴포넌트: 사망! 1인칭 시점으로 강제 전환.");
            setCurrentViewMode('firstPerson'); // Player 내부 viewMode를 1인칭으로 설정
            setViewMode('firstPerson'); // GameCanvas의 viewMode도 1인칭으로 업데이트

            // 사망 시 플레이어의 움직임을 멈추고 중력에 의해 떨어지도록
            if (playerRef.current) {
                playerRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
                playerRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
                // 필요하다면 RigidBody의 type을 'dynamic'으로 변경하여 사망 애니메이션과 물리 효과를 줄 수 있습니다.
                // playerRef.current.setType('dynamic');
            }
        }
        // isDead가 false로 바뀌면 (리스폰 시)
        else if (!isDead && playerRef.current) {
            console.log("Player 컴포넌트: 리스폰! 위치 초기화 및 1인칭 시점 유지.");
            playerRef.current.setTranslation(new THREE.Vector3(0, 1.1, 0), true);
            playerRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
            playerRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
            // 필요하다면 RigidBody의 type을 다시 'kinematicPosition'으로 변경
            // playerRef.current.setType('kinematicPosition');
            setCurrentViewMode('firstPerson'); // 리스폰 후에도 1인칭 시점 유지
            setViewMode('firstPerson'); // GameCanvas의 viewMode도 업데이트
            roll.current = 0; // 리스폰 시 roll 각도 초기화
        }
    }, [isDead, setViewMode]); // 의존성 배열


    // 매 프레임마다 플레이어 및 오브젝트 움직임과 서버 업데이트 로직
    useFrame(() => {
        const keys = getKeys(); // 현재 눌린 키 상태 가져오기
        const { jump } = keys; // 점프 키 상태 별도로 추출
        const vel = playerRef.current?.linvel() || { x: 0, y: 0, z: 0 }; // 플레이어 선형 속도
        const pos = playerRef.current?.translation() || { x: 0, y: 0, z: 0 }; // 플레이어 위치
        const isArmed = selectedItem?.name === 'ak-47'
        const isWalkingAnim = keys.forward && !isDead && !isChatting;
        const isBackwardAnim = keys.backward && !isDead && !isChatting;
        const isLeftAnim = keys.left && !isDead && !isChatting;
        const isRightAnim = keys.right && !isDead && !isChatting;
        const isRunningAnim = keys.runFast && !sitToggle && !lieToggle && !AimingToggle && (keys.forward || keys.backward || keys.left || keys.right) && !isChatting;
        const isSittedAnim = sitToggle && !isDead && !isChatting;
        const isSittedAndWalkAnim = sitToggle && (keys.forward || keys.left || keys.right || keys.backward) && !isDead && !isChatting;
        const isLyingDownAnim = lieToggle && !isDead && !isChatting;
        const isLyingDownAndWalkAnim = lieToggle && (keys.forward || keys.left || keys.right || keys.backward) && !isDead && !isChatting;
        const isPunchingAnim = isPunching && !isDead && !isChatting;
        const isHittedAnim = isPlayerHitted && !isDead && !isChatting;
        const isJumpingAnim = isJumping && !AimingToggle && !isDead && !isChatting;
        const isAimingAnim = AimingToggle && !isDead && !sitToggle && !lieToggle && !isSittedAndWalkAnim && !isLyingDownAndWalkAnim && !isChatting;
        const isAimingAndWalkAnim = AimingToggle && (keys.forward || keys.left || keys.right || keys.backward) && !isDead && !isChatting;
        const isDeadAnim = isDead;
        const isIdleAnim = !(keys.forward || keys.backward || keys.left || keys.right || keys.jump || keys.runFast || isPunching || isPlayerHitted) && !sitToggle && !lieToggle && !isDead && !isChatting;
        const isIdleFiringAnim = isFiring && !isDead && !isChatting && !sitToggle && !lieToggle && isArmed;
        const isWalkingFiringAnim = isFiring && !isDead && !isChatting && !sitToggle && !lieToggle && (keys.forward || keys.left || keys.right || keys.backward) && isArmed;
        const isRunningFiringAnim = isFiring && !isDead && !isChatting && !sitToggle && !lieToggle && keys.runFast && (keys.forward || keys.left || keys.right || keys.backward) && isArmed;
        // STOMP 클라이언트가 연결되어 있을 때 플레이어 상태를 서버에 전송
        if (stompClientInstance && stompClientInstance.connected) {
            const playerState = {
                id: currentPlayerId,
                nickname: playerNickname,
                position: { x: pos.x, y: pos.y, z: pos.z },
                rotationY: yaw.current + Math.PI,
                animationState: {
                    isWalking: isWalkingAnim,
                    isBackward: isBackwardAnim,
                    isLeft: isLeftAnim,
                    isRight: isRightAnim,
                    isJumping: isJumpingAnim,
                    isRunning: isRunningAnim,
                    isSitted: isSittedAnim,
                    isSittedAndWalk: isSittedAndWalkAnim,
                    isLyingDown: isLyingDownAnim,
                    isLyingDownAndWalk: isLyingDownAndWalkAnim,
                    isPunching: isPunchingAnim,
                    isHitted: isHittedAnim,
                    isAiming: isAimingAnim,
                    isAimingAndWalk: isAimingAndWalkAnim,
                    isIdle: isIdleAnim,
                    isDead: isDeadAnim,
                    isArmed: isArmed,
                    isChatting: isChatting,
                    isIdleFiring: isIdleFiringAnim,
                    isWalkingFiring: isWalkingFiringAnim,
                    isRunningFiring: isRunningFiringAnim
                }
            };
            stompClientInstance.publish({
                destination: `/app/updatePlayerState`,
                body: JSON.stringify(playerState)
            });
        }

        // 카메라 방향 계산
        const cameraOrientationQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw.current, 0));
        const forwardVector = new THREE.Vector3(0, 0, 1).applyQuaternion(cameraOrientationQ).normalize();
        const rightVector = new THREE.Vector3().crossVectors(forwardVector, new THREE.Vector3(0, 1, 0)).normalize();
        let actualSpeed = speed;

        // 플레이어 움직임 로직 (사망 시 비활성화)
        if (!isDead && !isChatting) {
            // 앉거나 누웠을 때, 또는 달릴 때 속도 조절
            if (sitToggle && (keys.forward || keys.backward || keys.left || keys.right)) {
                actualSpeed = Math.max(speed * 0.5, 1.7);
            } else if (lieToggle && (keys.forward || keys.backward || keys.left || keys.right)) {
                actualSpeed = Math.max(speed * 0.3, 1.3);
            } else if (keys.runFast && !sitToggle && !lieToggle && !AimingToggle && (keys.forward || keys.backward || keys.left || keys.right)) {
                actualSpeed = speed + 2;
            } if (AimingToggle && (keys.forward || keys.backward || keys.left || keys.right)) {
                actualSpeed = Math.max(speed * 0.4, 1.5);
            } if (AimingToggle && sitToggle && (keys.forward || keys.backward || keys.left || keys.right)) {
                actualSpeed = Math.max(speed * 0.2, 1.1);
            } if (AimingToggle && lieToggle && (keys.forward || keys.backward || keys.left || keys.right)) {
                actualSpeed = Math.max(speed * 0.1, 0.7);
            }

            let vx = 0, vz = 0;

            // 키 입력에 따른 x, z 속도 계산
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

            // 플레이어 선형 속도 설정
            playerRef.current.setLinvel({ x: vx, y: vel.y, z: vz }, true);

            // 점프 로직: 키가 새로 눌렸고, 땅에 닿아 있으며, 현재 점프 중이 아닐 때만 점프 실행
            if (jump && !lastJumpKeyStatus.current && isGrounded && !AimingToggle && vel.y <= 0.1) {
                playerRef.current.applyImpulse({ x: 0, y: jumpImpulse, z: 0 }, true);
                setIsGrounded(false); // 점프했으므로 땅에 닿지 않음
                setIsJumping(true); // 점프 애니메이션 시작
            }

            // 점프 애니메이션 종료 로직: 땅에 닿았고, 수직 속도가 거의 없을 때 점프 상태 해제
            if (isGrounded && isJumping && vel.y < 0.1) {
                setIsJumping(false);
            }

            // 'F' 키 상호작용 트리거 (Player에서 직접 처리)
            if (keys.interact && !lastInteractKeyState.current) { // 'interact' 키가 새로 눌렸을 때
                console.log(`[Player] 'F' key pressed. Current interactableObjectIdRef.current: ${interactableObjectIdRef.current}`); // 추가된 로그
                if (onInteract && interactableObjectIdRef.current) { // interactableObjectIdRef.current 사용
                    onInteract(interactableObjectIdRef.current); // GameCanvas로 상호작용 요청
                } else {
                    console.log("[Player] No interactable object in range or onInteract is null.");
                }
            }
            lastInteractKeyState.current = keys.interact; // 'interact' 키의 현재 상태 저장

        } else {
            // 플레이어가 죽었을 때 움직임 멈춤
            playerRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
        }

        // 현재 점프 키 상태를 기록하여 다음 프레임에서 이전 상태와 비교
        lastJumpKeyStatus.current = jump;


        const playerBodyPos = new THREE.Vector3(pos.x, pos.y, pos.z); // 플레이어 RigidBody 위치
        const headOffset = new THREE.Vector3(0, 0.3, 0); // 기본 카메라 오프셋 (플레이어 머리 위)

        // 플레이어 모델 위치 및 가시성 업데이트
        if (modelRef.current) {
            modelRef.current.position.copy(playerBodyPos);
            modelRef.current.position.y += -0.725; // 모델의 중심을 플레이어 RigidBody에 맞춤
            modelRef.current.visible = currentViewMode === 'thirdPerson'; // 3인칭일 때만 모델 보이게 함

            // 수평 이동이 있을 때 모델 회전
            const horizontalMovementLengthSq = vel.x * vel.x + vel.z * vel.z;
            if (horizontalMovementLengthSq > 0.01) {
                const targetRotationY = Math.atan2(vel.x, vel.z);
                modelRef.current.rotation.y = THREE.MathUtils.lerp(modelRef.current.rotation.y, targetRotationY, 0.15);
            } else {
                // 이동이 없을 때는 yaw 값에 따라 모델 회전
                modelRef.current.rotation.y = THREE.MathUtils.lerp(modelRef.current.rotation.y, yaw.current, 0.15);
            }
        }

        // 카메라 위치 및 회전 로직
        if (isDead) {
            // 사망 시 카메라 쓰러짐 효과
            const targetCamY = playerBodyPos.y + deathCameraTargetY.current; // 바닥에 가까운 목표 Y
            const targetCamPitch = deathCameraTargetPitch.current; // 카메라가 최종적으로 바라볼 각도 (수평)
            const targetCamRoll = deathCameraTargetRoll.current; // 카메라가 최종적으로 옆으로 쓰러질 각도 (45도)

            // 카메라 Y 위치를 부드럽게 보간
            camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetCamY, 0.05);
            // 카메라 피치(상하 회전)를 부드럽게 보간
            pitch.current = THREE.MathUtils.lerp(pitch.current, targetCamPitch, 0.05);
            // 카메라 롤(Z축 회전)을 부드럽게 보간
            roll.current = THREE.MathUtils.lerp(roll.current, targetCamRoll, 0.05);

            // 카메라 위치는 플레이어의 마지막 위치를 기반으로
            camera.position.x = playerBodyPos.x;
            camera.position.z = playerBodyPos.z;

            // 카메라 회전 적용 (roll 각도 적용)
            const cameraRotation = new THREE.Euler(pitch.current, yaw.current + Math.PI, roll.current, 'YXZ');
            camera.quaternion.setFromEuler(cameraRotation);

        } else if (currentViewMode === 'firstPerson') {
            // 1인칭 시점: 카메라를 플레이어 머리 위에 위치시키고 플레이어 시선 방향으로 회전
            const cameraPosition = playerBodyPos.clone().add(headOffset);
            camera.position.copy(cameraPosition);
            const cameraRotation = new THREE.Euler(pitch.current, yaw.current + Math.PI, 0, 'YXZ'); // 1인칭에서는 roll 0 유지
            camera.quaternion.setFromEuler(cameraRotation);
        } else { // thirdPerson
            // 3인칭 시점: 플레이어 뒤에서 카메라가 따라다니도록 설정
            const dist = 3.5; // 카메라와 플레이어 간의 거리
            const phi = Math.PI / 2 - pitch.current; // 구면 좌표계의 phi (수직 각도)
            const theta = yaw.current + Math.PI; // 구면 좌표계의 theta (수평 각도)

            // 구면 좌표계를 이용한 카메라 위치 계산
            const camX = dist * Math.sin(phi) * Math.sin(theta);
            const camY = dist * Math.cos(phi);
            const camZ = dist * Math.sin(phi) * Math.cos(theta);

            const camPos = new THREE.Vector3(playerBodyPos.x + camX, playerBodyPos.y + 1 + camY, playerBodyPos.z + camZ);
            camera.position.copy(camPos);

            camera.lookAt(playerBodyPos.x, playerBodyPos.y + 1, playerBodyPos.z); // 카메라가 플레이어를 바라보도록 설정
        }

        // HUD 상태 업데이트
        onHudUpdate?.(prev => ({
            ...prev,
            viewMode: currentViewMode, // Player 내부 viewMode 전달
            isGrounded,
            position: `(${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)})`,
            velocity: `(${vel.x.toFixed(2)}, ${vel.y.toFixed(2)}, ${vel.z.toFixed(2)})`,
            yaw: yaw.current,
            pitch: pitch.current,
            isAiming: AimingToggle,
            keys, // 이 keys는 useFrame 스코프 내의 keys 임
        }));
    });

    // CharacterModel로 전달할 props는 useFrame에서 계산된 애니메이션 상태 변수들을 사용합니다.
    const keys = getKeys(); // Get keys for initial render of CharacterModel (before first useFrame)
    const isWalkingAnim = keys.forward && !isDead && !isChatting;
    const isBackwardAnim = keys.backward && !isDead && !isChatting;
    const isLeftAnim = keys.left && !isDead && !isChatting;
    const isRightAnim = keys.right && !isDead && !isChatting;
    const isRunningAnim = keys.runFast && !sitToggle && !lieToggle && !AimingToggle && (keys.forward || keys.backward || keys.left || keys.right) && !isChatting;
    const isSittedAnim = sitToggle && !isDead && !isChatting;
    const isSittedAndWalkAnim = sitToggle && (keys.forward || keys.left || keys.right || keys.backward) && !isDead && !isChatting;
    const isLyingDownAnim = lieToggle && !isDead && !isChatting;
    const isLyingDownAndWalkAnim = lieToggle && (keys.forward || keys.left || keys.right || keys.backward) && !isDead && !isChatting;
    const isPunchingAnim = isPunching && !isDead && !isChatting;
    const isHittedAnim = isPlayerHitted && !isDead && !isChatting;
    const isJumpingAnim = isJumping && !AimingToggle && !isDead && !isChatting;
    const isAimingAnim = AimingToggle && !isDead && !sitToggle && !lieToggle && !isSittedAndWalkAnim && !isLyingDownAndWalkAnim && !isChatting;
    const isAimingAndWalkAnim = AimingToggle && (keys.forward || keys.left || keys.right || keys.backward) && !isDead && !isChatting;
    const isDeadAnim = isDead;
    const isIdleAnim = !(keys.forward || keys.backward || keys.left || keys.right || keys.jump || keys.runFast || isPunching || isPlayerHitted) && !sitToggle && !lieToggle && !isDead && !isChatting;
    const isIdleFiringAnim = isFiring && !isDead && !isChatting && !sitToggle && !lieToggle;
    const isWalkingFiringAnim = isFiring && !isDead && !isChatting && !sitToggle && !lieToggle && (keys.forward || keys.left || keys.right || keys.backward);
    const isRunningFiringAnim = isFiring && !isDead && !sitToggle && !lieToggle && isRunningAnim;

    // 충돌 감지 (사과 상호작용)
    const handleCollisionEnter = useCallback((payload) => {
        setIsGrounded(true); // 바닥 접지 여부 업데이트
        // 충돌한 오브젝트가 SceneObject에서 설정한 userData를 가지고 있는지 확인
        if (payload.other.rigidBodyObject?.userData?.type === 'apple') {
            const objectId = payload.other.rigidBodyObject.userData.id;
            if (exitTimeoutRef.current) { // If there was an pending exit, clear it
                clearTimeout(exitTimeoutRef.current);
                exitTimeoutRef.current = null;
            }
            if (interactableObjectIdRef.current !== objectId) { // Only update if it's a new object or null
                interactableObjectIdRef.current = objectId;
                onObjectProximityChange(objectId, true);
                console.log("Player entered apple proximity:", objectId, "interactableObjectIdRef.current:", interactableObjectIdRef.current);
            }
        } else if (payload.other.rigidBodyObject?.userData?.type === 'ak-47') {
            const objectId = payload.other.rigidBodyObject.userData.id;
            if (exitTimeoutRef.current) { // If there was an pending exit, clear it
                clearTimeout(exitTimeoutRef.current);
                exitTimeoutRef.current = null;
            }
            if (interactableObjectIdRef.current !== objectId) { // Only update if it's a new object or null
                interactableObjectIdRef.current = objectId;
                onObjectProximityChange(objectId, true);
                console.log("Player entered apple proximity:", objectId, "interactableObjectIdRef.current:", interactableObjectIdRef.current);
            }
        }
    }, [onObjectProximityChange]);

    const handleCollisionExit = useCallback((payload) => {
        setIsGrounded(false); // 바닥 접지 여부 업데이트
        // 충돌 해제된 오브젝트가 SceneObject에서 설정한 userData를 가지고 있는지 확인
        if (payload.other.rigidBodyObject?.userData?.type === 'apple') {
            const objectId = payload.other.rigidBodyObject.userData.id;
            // Set a timeout to clear the ID, allowing for brief re-entries
            exitTimeoutRef.current = setTimeout(() => {
                if (interactableObjectIdRef.current === objectId) { // Only clear if it's still this object
                    interactableObjectIdRef.current = null;
                    onObjectProximityChange(objectId, false);
                    console.log("Player exited apple proximity (debounced):", objectId, "interactableObjectIdRef.current:", interactableObjectIdRef.current);
                }
                exitTimeoutRef.current = null;
            }, 200); // 200ms debounce로 변경
        } else if (payload.other.rigidBodyObject?.userData?.type === 'ak-47') {
            const objectId = payload.other.rigidBodyObject.userData.id;
            // Set a timeout to clear the ID, allowing for brief re-entries
            exitTimeoutRef.current = setTimeout(() => {
                if (interactableObjectIdRef.current === objectId) { // Only clear if it's still this object
                    interactableObjectIdRef.current = null;
                    onObjectProximityChange(objectId, false);
                    console.log("Player exited apple proximity (debounced):", objectId, "interactableObjectIdRef.current:", interactableObjectIdRef.current);
                }
                exitTimeoutRef.current = null;
            }, 200); // 200ms debounce로 변경
        }
    }, [onObjectProximityChange]);


    let characterModelPath = '/models/UnarmedCharacter.glb';
    let isArmed = false;
    if (selectedItem && selectedItem.name === 'ak-47') {
        characterModelPath = '/models/ArmedCharacter.glb';
        isArmed = true;
    }

    return (
        <>
            {/* 플레이어 RigidBody (물리 적용) */}
            <RigidBody
                ref={playerRef}
                position={[0, 1.1, 0]} // 초기 위치
                colliders={false} // 콜라이더는 CapsuleCollider로 별도 정의
                enabledRotations={[false, false, false]} // 회전 비활성화 (캐릭터가 넘어지지 않도록)
                onCollisionEnter={handleCollisionEnter} // 충돌 시작 시
                onCollisionExit={handleCollisionExit}   // 충돌 종료 시
            >
                {/* 플레이어의 캡슐 콜라이더 (실제 물리 충돌용) */}
                <CapsuleCollider args={[0.35, 0.4]} />
                {/* 추가: 아이템 줍기 감지를 위한 센서 콜라이더 */}
                {/* 이 센서는 isSensor={true}로 설정되어 물리적 충돌을 일으키지 않고 겹침만 감지합니다. */}
                <CapsuleCollider args={[0.35, 0.4]} sensor position={[0, 0, 0]} /> {/* 플레이어 주변의 넓은 센서 (크기 증가) */}
            </RigidBody>

            {/* 플레이어 3D 모델 */}
            <CharacterModel
                ref={modelRef}
                glbPath={characterModelPath}
                isArmed={isArmed}
                isWalking={isWalkingAnim}
                isBackward={isBackwardAnim}
                isLeft={isLeftAnim}
                isRight={isRightAnim}
                isJumping={isJumpingAnim}
                isRunning={isRunningAnim}
                isSittedAndWalk={isSittedAndWalkAnim}
                isSitted={isSittedAnim}
                isLyingDownAndWalk={isLyingDownAndWalkAnim}
                isLyingDown={isLyingDownAnim}
                isPunching={isPunchingAnim} // isPunching 상태를 애니메이션 prop으로 전달
                isHitted={isHittedAnim}
                isAiming={isAimingAnim}
                isAimingAndWalk={isAimingAndWalkAnim}
                isDead={isDeadAnim}
                isIdle={isIdleAnim}
                isChatting={isChatting}
                isIdleFiring={isIdleFiringAnim}
                isWalkingFiring={isWalkingFiringAnim}
                isRunningFiring={isRunningFiringAnim}
            />
        </>
    );
}
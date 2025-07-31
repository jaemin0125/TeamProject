// Player.jsx
import { useRef, useState, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useKeyboardControls } from '@react-three/drei';
import { RigidBody, CapsuleCollider, useRapier, CuboidCollider } from '@react-three/rapier';
import { useControls } from 'leva'; // 'leva' 임포트 수정
import * as THREE from 'three';
import { CharacterModel } from './CharacterModel'; // CharacterModel 임포트
import { checkHit } from './utils/gameUtils'; // checkHit 임포트
import { distance } from 'three/tsl';

// Player 컴포넌트 (현재 플레이어의 로직)
export function Player({
    onHudUpdate,
    stompClientInstance,
    isPlayerHitted,
    playerNickname,
    isDead,
    currentPlayerId,
    onObjectProximityChange,
    onInteract, onUseItem,
    selectedInventorySlot,
    isItemSelected,
    selectedItem,
    isChatting,
    clearInventory,
    handleReload,
    setInventory,
    playerRef, // playerRef를 props로 받음
    isReloading, // isReloading prop 추가
    isInventoryOpen,
    startEating,
    cancelEating

}) {
    const { camera, gl, scene } = useThree(); // Three.js 카메라와 WebGL 렌더러
    const [subscribeKeys, getKeys] = useKeyboardControls(); // 키보드 컨트롤 훅
    const [sitToggle, setSitToggle] = useState(false); // 앉기 토글 상태
    const [lieToggle, setLieToggle] = useState(false); // 눕기 토글 상태
    const modelRef = useRef(); // 플레이어 3D 모델 참조
    const [isGrounded, setIsGrounded] = useState(false); // 바닥에 닿았는지 여부
    const [currentViewMode, setCurrentViewMode] = useState('thirdPerson'); // 플레이어 내부의 시점 모드
    const [isPunching, setIsPunching] = useState(false); // 펀치 동작 여부
    const [isJumping, setIsJumping] = useState(false); // 점프 상태 관리 (유지)
    const [canPunch, setCanPunch] = useState(true); // 펀치 쿨타임 상태
    const [isSlashing, setIsSlashing] = useState(false); // 펀치 동작 여부
    const [canSlash, setCanSlash] = useState(true); // 펀치 쿨타임 상태
    const [isAiming, setIsAiming] = useState(false);
    const [isScoped, setIsScoped] = useState(false);
    const [wasDead, setWasDead] = useState(false);
    const interactableObjectIdRef = useRef(null); // 플레이어가 근접한 상호작용 가능 오브젝트 ID
    const exitTimeoutRef = useRef(null); // 충돌 종료 지연을 위한 타이머 참조
    const [isFiring, setIsFiring] = useState(false);
    const firingIntervalRef = useRef(null);
    const mouseDownTimeRef = useRef(0);
    const [canFire, setCanFire] = useState(true);

    const isReloadingRef = useRef(isReloading); // isReloading prop의 최신 값을 추적하기 위한 ref

    useEffect(() => {
        isReloadingRef.current = isReloading;
    }, [isReloading]);


    // 스페이스바의 이전 눌림 상태를 추적하는 Ref 추가
    const lastJumpKeyStatus = useRef(false);
    const lastInteractKeyState = useRef(false); // 'F' 키의 이전 상태를 저장하는 Ref 추가

    const pitch = useRef(0); // 카메라 상하 회전 (pitch)
    const yaw = useRef(0); // 카메라 좌우 회전 (yaw)
    const roll = useRef(0); // 카메라 Z축 회전 (roll)

    const recoilPitchOffset = useRef(0); // 반동으로 인한 추가 피치 오프셋
    const recoilYawOffset = useRef(0); // 반동으로 인한 추가 요 오프셋

    // 사망 시 카메라 애니메이션을 위한 목표 값
    const deathCameraTargetY = useRef(0.1); // 카메라가 최종적으로 도달할 Y 위치 (바닥에 가까움)
    const deathCameraTargetPitch = useRef(0); // 카메라가 최종적으로 바라볼 각도 (수평으로 시작)
    const deathCameraTargetRoll = useRef(Math.PI / 4); // 카메라가 최종적으로 옆으로 쓰러질 각도 (45도)

    // Leva를 통한 디버그 컨트롤 (속도, 점프 임펄스)
    const { speed, jumpImpulse, fireRate } = useControls({
        speed: { value: 5, min: 1, max: 100 },
        jumpImpulse: { value: 10, min: 1, max: 100 },
        fireRate: { value: 120, min: 20, max: 500 }
    });

    const { rapier, world } = useRapier(); // rapier world 객체 접근

    let characterModelPath = '/models/UnarmedCharacter.glb';
    let isArmed = false;
    let isUsingPipe = false;
    if (selectedItem && selectedItem.name === 'ak-47') {
        characterModelPath = '/models/ArmedCharacter.glb';
        isArmed = true;
    } if (selectedItem && selectedItem.name === 'pipe') {
        characterModelPath = '/models/PipeCharacter.glb';
        isUsingPipe = true;
    }

    useEffect(() => {
        if (!isArmed) {
            setIsAiming(false);
            setIsScoped(false);
        }
    }, [isArmed]);

    const fireBullet = () => {
        if (isReloadingRef.current) return; // 재장전 중이면 발사 불가
        // 1. 플레이어의 현재 위치를 가져옵니다.

        if (!canFire || !selectedItem?.ammo || selectedItem.ammo.current <= 0) {
            if (isFiring) {
                setIsFiring(false);
                clearInterval(firingIntervalRef.current);
            }
            return;
        }

        setInventory(prevInventory => {
            const updated = [...prevInventory];
            const item = updated[selectedInventorySlot];
            if (item?.ammo) {
                item.ammo.current -= 1;

                // 탄약 다 썼을 경우
                if (item.ammo.current <= 0) {
                    setCanFire(false);
                    setIsFiring(false);
                    clearInterval(firingIntervalRef.current);
                }
            }
            return updated;
        });



        const playerPosition = playerRef.current.translation();
        // 2. 플레이어의 현재 Y축 회전값을 가져옵니다.
        const playerRotationY = yaw.current;

        // 3. 플레이어의 회전값을 기반으로 정면 방향을 계산합니다.
        const playerRotation = new THREE.Euler(0, playerRotationY, 0, 'YXZ');
        // 4. 총구의 상대적 위치 (플레이어 모델의 중심으로부터의 오프셋)를 정의합니다.
        let gunMuzzleOffset = new THREE.Vector3(0, 0.875, 0.5); // X, Y를 0으로, Z를 -1.0으로 설정

        // 플레이어 자세에 따른 총구 오프셋 조정
        if (sitToggle) {
            gunMuzzleOffset = new THREE.Vector3(0, 0.4, 0.5); // 앉았을 때 총구 높이
        } else if (lieToggle) {
            gunMuzzleOffset = new THREE.Vector3(0, 0.05, 0.5); // 엎드렸을 때 총구 높이
        }
        gunMuzzleOffset.applyEuler(playerRotation); // 플레이어의 회전을 오프셋에 적용

        // 5. 최종 레이저 시작 위치를 계산합니다.
        const origin = new THREE.Vector3(playerPosition.x, playerPosition.y, playerPosition.z).add(gunMuzzleOffset);

        // ✨ 화면 반동 적용
        let verticalRecoil;
        let horizontalRecoil;

        if (isAiming) {
            verticalRecoil = Math.random() * 0.01; // 더 작은 수직 반동
            horizontalRecoil = (Math.random() - 0.5) * 0.006; // 더 작은
        } else if (isScoped) { // 조준 중일 때 (반동 적게)
            verticalRecoil = Math.random() * 0.005; // 더 작은 수직 반동
            horizontalRecoil = (Math.random() - 0.5) * 0.003; // 더 작은 수평 반동
        } else { // 조준 안 할 때 (반동 크게)
            verticalRecoil = Math.random() * 0.015; // 기존 수직 반동
            horizontalRecoil = (Math.random() - 0.5) * 0.01; // 기존 수평 반동
        }

        pitch.current += verticalRecoil;
        yaw.current += horizontalRecoil;
        pitch.current = THREE.MathUtils.clamp(pitch.current, -Math.PI / 2 + 0.1, Math.PI / 2 - 0.1);

        recoilPitchOffset.current += verticalRecoil;
        recoilYawOffset.current += horizontalRecoil;

        // 6. 레이저 방향 결정 (반동 적용 후의 카메라 방향)
        const direction = new THREE.Vector3();
        camera.getWorldDirection(direction);

        // ✅ 레이캐스트 수행 (Rapier 방식)
        const ray = new rapier.Ray(origin, direction);
        const hit = world.castRayAndGetNormal(ray, 100, true);

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
            const toi = hit.toi ?? hit.timeOfImpact; // 둘 중 있는 걸 사용
            if (toi === undefined) {
                console.warn('❌ TOI 정보 없음:', hit);
                return;
            }



            try {
                const hitPoint = origin.clone().add(direction.clone().multiplyScalar(toi));
                const hitNormal = new THREE.Vector3().copy(hit.normal);

                stompClientInstance.publish({
                    destination: '/app/bulletImpact',
                    body: JSON.stringify({
                        fromId: currentPlayerId,
                        hitPosition: {
                            x: hitPoint.x,
                            y: hitPoint.y,
                            z: hitPoint.z
                        },
                        hitNormal: {
                            x: hitNormal.x,
                            y: hitNormal.y,
                            z: hitNormal.z
                        }
                    })
                });
            } catch (e) {
                console.warn('피탄 자국 생성 실패:', e);
            }

            //🔴 시각화 (레이저 라인)
            // const endVec = origin.clone().add(direction.clone().multiplyScalar(100));
            // const laserGeo = new THREE.BufferGeometry().setFromPoints([origin, endVec]);
            // const laserMat = new THREE.LineBasicMaterial({ color: 0xff0000 });
            // const laserLine = new THREE.Line(laserGeo, laserMat);
            // scene.add(laserLine);
            // setTimeout(() => {
            //     scene.remove(laserLine);
            //     laserGeo.dispose();
            //     laserMat.dispose();
            // }, 200);
        };


    }



    // 펀치 시 타격 감지 및 서버 전송 로직
    useEffect(() => {
        // 펀치 동작 중이 아니고, 펀치 가능하며, STOMP 클라이언트가 연결되어 있고, 플레이어가 죽지 않았을 때만 실행
        if (!stompClientInstance || !stompClientInstance.connected || isDead) return;

        const playerPosition = playerRef.current?.translation(); // 공격자 위치
        const attackerQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw.current, 0)); // 공격자 회전

        (window.onlinePlayers || new Map()).forEach((targetPlayer, targetId) => {
            if (targetId === currentPlayerId) return; // 자기 자신은 제외

            const targetPosition = targetPlayer.position; // 타겟 플레이어 위치

            if (isPunching && canPunch && !isArmed && !isUsingPipe) {
                const isHit = checkHit(playerPosition, attackerQuat, targetPosition, false);
                if (isHit) {
                    stompClientInstance.publish({
                        destination: '/app/playerHit',
                        body: JSON.stringify({
                            fromId: currentPlayerId,
                            fromPosition: { x: playerPosition.x, y: playerPosition.y, z: playerPosition.z },
                            targetId,
                            targetPosition: { x: targetPosition.x, y: targetPosition.y, z: targetPosition.z },
                            weaponName: 'punch',
                        }),
                    });
                }
            }

            if (isSlashing && canSlash && isUsingPipe) {
                const isHit = checkHit(playerPosition, attackerQuat, targetPosition, true);
                if (isHit) {
                    stompClientInstance.publish({
                        destination: '/app/playerHit',
                        body: JSON.stringify({
                            fromId: currentPlayerId,
                            fromPosition: { x: playerPosition.x, y: playerPosition.y, z: playerPosition.z },
                            targetId,
                            targetPosition: { x: targetPosition.x, y: targetPosition.y, z: targetPosition.z },
                            weaponName: 'pipe',
                        }),
                    });
                }
            }
        });

        // ✅ 적중 여부와 관계 없이, 애니메이션 시작 시 쿨타임 적용
        if (isPunching && canPunch && !isArmed) {
            setCanPunch(false);
            setTimeout(() => setCanPunch(true), 500);
        }

        if (isSlashing && canSlash && isUsingPipe) {
            setCanSlash(false);
            setTimeout(() => setCanSlash(true), 500);
        }

    }, [isPunching, isSlashing, canPunch, canSlash, stompClientInstance, isDead, currentPlayerId, isUsingPipe, isArmed]);

    useEffect(() => {
        if (!isFiring || isDead || selectedItem?.name !== 'ak-47' || isReloadingRef.current) return;

        // 일정 간격으로 fireBullet 호출
        firingIntervalRef.current = setInterval(() => {
            fireBullet();
        }, fireRate); // 150ms 간격으로 발사

        return () => clearInterval(firingIntervalRef.current);
    }, [isFiring, isDead, selectedItem, isReloading]);

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
                    isWalking: false,
                    // isBackward: false, isLeft: false, isRight: false,
                    isJumping: false, isRunning: false, isSitted: false, isSittedAndWalk: false,
                    isLyingDown: false, isLyingDownAndWalk: false, isPunching: false, isHitted: false, isArmed: false, isUsingPipe: false, isIdle: true,
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
            if (isDead || isChatting || e.repeat) return; // 죽음 상태일 때 움직임 비활성화
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
            if (e.code === 'KeyR' && !isDead && isArmed && !isReloadingRef.current) {
                handleReload();

                setCanFire(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isDead, isChatting, isArmed, isReloading]);

    // 마우스 클릭 (펀치 또는 아이템 사용) 로직
    useEffect(() => {
        const canvas = gl.domElement; // 캔버스 요소 가져오기
        const handleMouseDown = (e) => {
            if (isDead || isChatting) return;
            if (e.button === 0) { // 좌클릭
                if (isArmed) {
                    if (isReloadingRef.current) return;
                    setIsFiring(true);
                    fireBullet();
                } else if (isUsingPipe) {
                    if (canSlash) {
                        setIsSlashing(true);
                        setTimeout(() => setIsSlashing(false), 500);
                    }
                } else {
                    if (canPunch) {
                        setIsPunching(true);
                        setTimeout(() => setIsPunching(false), 500);
                    }
                }
            }

            if (e.button === 2) { // 우클릭
                if (isArmed) {
                    setIsAiming(true);
                    mouseDownTimeRef.current = performance.now();
                } else if (selectedItem?.name === 'apple') {
                    startEating();
                }
                return;
            }

        };

        const handleMouseUp = (e) => {
            if (e.button === 0 && isArmed) {
                setIsFiring(false);
            }
            if (e.button === 2) {
                if (isArmed) {
                    const heldTime = performance.now() - mouseDownTimeRef.current;
                    setIsAiming(false);
                    if (heldTime < 200) {
                        setIsScoped(prev => !prev);
                    }
                } else {
                    // 'apple'을 들고 있을 때의 상태 의존성을 제거하고 직접 cancelEating 호출
                    cancelEating();
                }
            }
        };

        // 마우스 이벤트 리스너를 window 대신 캔버스에 직접 연결
        canvas.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            canvas.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [
        canPunch, canSlash, isDead, onUseItem, isItemSelected, gl, selectedInventorySlot, isFiring,
        sitToggle, lieToggle, isArmed, isUsingPipe, selectedItem, isScoped, isChatting,
        startEating, cancelEating, fireBullet
    ]);

    // 뷰 모드 전환 (1인칭/3인칭) 로직


    useEffect(() => {
        camera.fov = isScoped ? 60 : 60;
        camera.updateProjectionMatrix();
        if (isScoped && currentViewMode !== 'firstPerson') {
            setCurrentViewMode('firstPerson'); // 내부 시점 전환
        } else if (!isScoped && currentViewMode == 'firstPerson') {
            setCurrentViewMode('thirdPerson');
        }

    }, [isScoped, currentViewMode]);

    // 마우스 움직임으로 카메라 회전 로직
    const onMouseMove = useCallback((e) => {
        if (isDead) return; // 죽음 상태일 때 마우스 움직임 비활성화
        yaw.current -= e.movementX * 0.002;
        // yaw 값을 -PI에서 PI 사이로 정규화 (시점 깨짐 방지)
        yaw.current = (yaw.current + Math.PI) % (2 * Math.PI) - Math.PI;

        pitch.current -= e.movementY * 0.002;

        pitch.current = THREE.MathUtils.clamp(pitch.current, -Math.PI / 2 + 0.1, Math.PI / 2 - 0.1);
    }, [currentViewMode, isDead]); // 의존성 배열

    // 포인터 락 로직
    useEffect(() => {
        const canvas = gl.domElement;
        const requestPointerLock = () => {
            // 클릭 핸들러용 함수
            if (isDead || isInventoryOpen) return;
            canvas.requestPointerLock();
        };

        if (isInventoryOpen) {
            // 인벤토리가 열려 있으면 포인터 락 해제
            document.exitPointerLock();
        } else {
            // 인벤토리가 닫혀 있으면 클릭 시 포인터 락 재요청 리스너 추가
            canvas.addEventListener('click', requestPointerLock);
            // 그리고 즉시 포인터 락 재요청 시도
            if (!isDead) {
                canvas.requestPointerLock();
            }
        }

        return () => {
            // 이펙트가 다시 실행되거나 컴포넌트가 언마운트될 때 리스너 정리
            canvas.removeEventListener('click', requestPointerLock);
        };
    }, [gl, isDead, isInventoryOpen]); // 의존성 배열

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
            setWasDead(true);
            setIsScoped(false);
            setIsAiming(false);
            clearInventory();
            onObjectProximityChange(interactableObjectIdRef.current, false);
            interactableObjectIdRef.current = null;

            // 사망 시 플레이어의 움직임을 멈추고 중력에 의해 떨어지도록
            if (playerRef.current) {
                playerRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
                playerRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
                // 필요하다면 RigidBody의 type을 'dynamic'으로 변경하여 사망 애니메이션과 물리 효과를 줄 수 있습니다.
                // playerRef.current.setType('dynamic');
            }
        } else if (wasDead && !isDead && playerRef.current) {
            console.log("Player 컴포넌트: 리스폰! 위치 초기화 및 1인칭 시점 유지.");
            playerRef.current.setTranslation(new THREE.Vector3(0, 2, 0), true);
            playerRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
            playerRef.current.setAngvel({ x: 0, y: 0, z: 0 }, true);
            // 필요하다면 RigidBody의 type을 다시 'kinematicPosition'으로 변경
            // playerRef.current.setType('kinematicPosition');
            setCurrentViewMode('thirdPerson'); // 리스폰 후에도 1인칭 시점 유지
            roll.current = 0; // 리스폰 시 roll 각도 초기화
            setWasDead(false); // <--- 이 줄을 추가하여 wasDead를 false로 재설정
        }
    }, [isDead, wasDead, clearInventory, onObjectProximityChange]); // 의존성 배열




    // 매 프레임마다 플레이어 및 오브젝트 움직임과 서버 업데이트 로직
    useFrame(() => {


        pitch.current += recoilPitchOffset.current;
        yaw.current += recoilYawOffset.current;

        recoilPitchOffset.current = THREE.MathUtils.lerp(recoilPitchOffset.current, 0, 0.2); // 0.1은 감쇠 속도
        recoilYawOffset.current = THREE.MathUtils.lerp(recoilYawOffset.current, 0, 0.2); // 0.1은 감쇠 속도

        // pitch와 yaw 값을 다시 클램핑하여 유효한 범위 내에 있도록 함
        pitch.current = THREE.MathUtils.clamp(pitch.current, -Math.PI / 2 + 0.1, Math.PI / 2 - 0.1);
        yaw.current = (yaw.current + Math.PI) % (2 * Math.PI) - Math.PI;



        const keys = getKeys(); // 현재 눌린 키 상태 가져오기
        const { jump } = keys; // 점프 키 상태 별도로 추출
        const vel = playerRef.current?.linvel() || { x: 0, y: 0, z: 0 }; // 플레이어 선형 속도
        const pos = playerRef.current?.translation() || { x: 0, y: 0, z: 0 }; // 플레이어 위치
        const isWalkingAnim = (keys.forward || keys.left || keys.right || keys.backward) && !isDead && !isChatting;
        // const isBackwardAnim = keys.backward && !isDead && !isChatting;
        // const isLeftAnim = keys.left && !isDead && !isChatting;    =================>>>>>>>>>>>추후에 시점 오류 해결되면 애니메이션 추가 예정.
        // const isRightAnim = keys.right && !isDead && !isChatting;
        const isRunningAnim = keys.runFast && !sitToggle && !lieToggle && !isAiming && !isScoped && isWalkingAnim;
        const isSittedAnim = sitToggle && !isDead && !isChatting;
        const isSittedAndWalkAnim = sitToggle && isWalkingAnim;
        const isLyingDownAnim = lieToggle && !isDead && !isChatting;
        const isLyingDownAndWalkAnim = lieToggle && isWalkingAnim;
        const isPunchingAnim = isPunching && !isDead && !isChatting;
        const isSlashingAnim = isSlashing && !isDead && !isChatting;
        const isHittedAnim = isPlayerHitted && !isDead && !isChatting;
        const isJumpingAnim = isJumping && !isAiming && !isScoped && !isDead && !isChatting;
        const isAimingAnim = (isAiming || isScoped) && !isDead && !sitToggle && !lieToggle && !isSittedAndWalkAnim && !isLyingDownAndWalkAnim && !isChatting && isArmed;
        const isAimingAndWalkAnim = (isAiming || isScoped) && isWalkingAnim;
        const isDeadAnim = isDead;
        const isIdleAnim = !(keys.forward || keys.backward || keys.left || keys.right || keys.jump || isPunching || isPlayerHitted) && !sitToggle && !lieToggle && !isDead && !isChatting;
        const isIdleFiringAnim = isFiring && canFire && !isDead && !isChatting && !sitToggle && !lieToggle && isArmed;
        const isWalkingFiringAnim = isFiring && canFire && !isDead && !isChatting && !sitToggle && !lieToggle && isWalkingAnim && isArmed;
        const isRunningFiringAnim = isFiring && canFire && !isDead && !isChatting && !sitToggle && !lieToggle && isRunningAnim && isArmed;



        // isGrounded 판정을 위한 레이캐스팅
        // CapsuleCollider의 args는 [halfHeight, radius] 순서입니다.
        const capsuleHalfHeight = 0.4; // args[0]
        const capsuleRadius = 0.4;    // args[1]

        // 레이 시작점을 캡슐 콜라이더의 가장 낮은 지점에서 약간 위로 설정합니다.
        // 플레이어 위치(pos.y)에서 (캡슐 반높이 + 캡슐 반지름) 만큼 내린 후 약간의 오프셋을 더합니다.
        const rayOriginY = pos.y - capsuleHalfHeight - capsuleRadius + 0.1;
        const groundRayOrigin = { x: pos.x, y: rayOriginY, z: pos.z };
        const groundRayDir = { x: 0, y: -1, z: 0 };
        const ray = new rapier.Ray(groundRayOrigin, groundRayDir);

        // 아래로 0.15m 이내에 바닥이 있는지 검사합니다.
        // 플레이어 자신의 콜라이더는 검사에서 제외합니다.
        const hit = world.castRay(
            ray,
            0.15, // 레이 길이
            true, // solid 객체만 감지
            undefined,
            undefined,
            undefined,
            playerRef.current // 플레이어 리지드바디 제외
        );

        // 레이가 어딘가에 부딪혔다면 땅에 닿은 것으로 간주합니다.
        const newGroundedState = hit !== null;

        // isGrounded 상태를 업데이트합니다.
        if (newGroundedState !== isGrounded) {
            setIsGrounded(newGroundedState);
        }




        // STOMP 클라이언트가 연결되어 있을 때 플레이어 상태를 서버에 전송
        if (selectedItem?.name === 'ak-47') {
            isArmed = true;
        } else if (selectedItem?.name === 'pipe') {
            isUsingPipe = true;
        } else {
            isArmed = false;
            isUsingPipe = false;
        }

        if (stompClientInstance && stompClientInstance.connected) {
            const playerState = {
                id: currentPlayerId,
                nickname: playerNickname,
                position: { x: pos.x, y: pos.y, z: pos.z },
                rotationY: yaw.current + Math.PI,
                animationState: {
                    isWalking: isWalkingAnim,
                    // isBackward: isBackwardAnim,
                    // isLeft: isLeftAnim,
                    // isRight: isRightAnim,
                    isJumping: isJumpingAnim,
                    isRunning: isRunningAnim,
                    isSitted: isSittedAnim,
                    isSittedAndWalk: isSittedAndWalkAnim,
                    isLyingDown: isLyingDownAnim,
                    isLyingDownAndWalk: isLyingDownAndWalkAnim,
                    isPunching: isPunchingAnim,
                    isSlashing: isSlashingAnim,
                    isHitted: isHittedAnim,
                    isAiming: isAimingAnim,
                    isAimingAndWalk: isAimingAndWalkAnim,
                    isIdle: isIdleAnim,
                    isDead: isDeadAnim,
                    isArmed: isArmed,
                    isUsingPipe: isUsingPipe,
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
        if (!isDead) { // isDead일 때만 완전히 멈춤
            if (isChatting) {
                // 채팅 중일 때는 수평 움직임만 멈추고, 수직 속도는 유지하여 중력 적용
                playerRef.current?.setLinvel({ x: 0, y: vel.y, z: 0 }, true);
            } else {
                // 앉거나 누웠을 때, 또는 달릴 때 속도 조절
                if (sitToggle && (keys.forward || keys.backward || keys.left || keys.right)) {
                    actualSpeed = Math.max(speed * 0.5, 1.7);
                } else if (lieToggle && (keys.forward || keys.backward || keys.left || keys.right)) {
                    actualSpeed = Math.max(speed * 0.3, 1.3);
                } else if (keys.runFast && !sitToggle && !lieToggle && !isAiming && (keys.forward || keys.backward || keys.left || keys.right)) {
                    actualSpeed = speed + 2;
                } if (isScoped || isAiming && (keys.forward || keys.backward || keys.left || keys.right)) {
                    actualSpeed = Math.max(speed * 0.4, 1.5);
                } if (isScoped || isAiming && sitToggle && (keys.forward || keys.backward || keys.left || keys.right)) {
                    actualSpeed = Math.max(speed * 0.2, 1.1);
                } if (isScoped || isAiming && lieToggle && (keys.forward || keys.backward || keys.left || keys.right)) {
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
                playerRef.current?.setLinvel({ x: vx, y: vel.y, z: vz }, true);

                // // 플레이어의 시야(yaw)에 맞춰 RigidBody의 회전을 업데이트합니다.
                if (playerRef.current) {
                    const rotation = new THREE.Quaternion();
                    rotation.setFromEuler(new THREE.Euler(0, yaw.current, 0));
                    playerRef.current.setRotation(rotation, true);
                }

                // 점프 로직: 키가 새로 눌렸고, 땅에 닿아 있으며, 현재 점프 중이 아닐 때만 점프 실행
                // 점프 및 자세 변경 로직
                if (jump && !lastJumpKeyStatus.current) { // 스페이스바가 새로 눌렸을 때
                    if (lieToggle) {
                        // 1. 누운 상태 -> 앉은 상태로 변경
                        setLieToggle(false);
                        setSitToggle(true);
                    } else if (sitToggle) {
                        // 2. 앉은 상태 -> 서 있는 상태로 변경
                        setSitToggle(false);
                    } else if (isGrounded && !isAiming && vel.y <= 0.1) {
                        // 3. 서 있는 상태 -> 점프
                        playerRef.current?.applyImpulse({ x: 0, y: jumpImpulse, z: 0 }, true);
                        setIsGrounded(false); // 점프했으므로 땅에 닿지 않음
                        setIsJumping(true); // 점프 애니메이션 시작
                    }
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
            }
        } else {
            // 플레이어가 죽었을 때 움직임 멈춤
            playerRef.current?.setLinvel({ x: 0, y: 0, z: 0 }, true);
        }

        // 현재 점프 키 상태를 기록하여 다음 프레임에서 이전 상태와 비교
        lastJumpKeyStatus.current = jump;


        const playerBodyPos = new THREE.Vector3(pos.x, pos.y, pos.z); // 플레이어 RigidBody 위치
        let headOffset = new THREE.Vector3(0, 0.875, 0); // 기본 카메라 오프셋 (플레이어 머리 위)

        // 플레이어 자세에 따른 카메라 오프셋 조정
        if (sitToggle) {
            headOffset = new THREE.Vector3(0, 0.3, 0); // 앉았을 때 카메라 높이
        } else if (lieToggle) {
            headOffset = new THREE.Vector3(0, 0.05, 0); // 엎드렸을 때 카메라 높이
        }

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

        //======>>>>>>>>>>>>>>>>>>>>>>>>>>> WASD 애니메이션 별도 생성 시 (카메라 방향 시점 고정 로직) 상단의 조건문과 교체.
        // if (modelRef.current) { 
        //     modelRef.current.position.copy(playerBodyPos);
        //     modelRef.current.position.y += -0.725; // 모델 중심 정렬
        //     modelRef.current.visible = currentViewMode === 'thirdPerson'; // 3인칭 시에만 렌더링

        //     // ✅ 회전은 무조건 시야 방향(yaw.current)을 기준으로만!
        //     modelRef.current.rotation.y = THREE.MathUtils.lerp(
        //         modelRef.current.rotation.y,
        //         yaw.current,
        //         0.15
        //     );
        // }

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
            const finalPitch = pitch.current + recoilPitchOffset.current;
            const finalYaw = yaw.current + recoilYawOffset.current;
            const cameraRotation = new THREE.Euler(finalPitch, finalYaw + Math.PI, 0, 'YXZ'); // 1인칭에서는 roll 0 유지
            camera.quaternion.setFromEuler(cameraRotation);
        } else { // thirdPerson
            const dist = 8; // 카메라와 플레이어 간의 최대 거리
            const phi = Math.PI / 2 + pitch.current; // 구면 좌표계의 phi (수직 각도)
            const theta = yaw.current + Math.PI; // 구면 좌표계의 theta (수평 각도)

            const playerHeadPos = playerBodyPos.clone();
            playerHeadPos.y += 1; // 카메라가 바라볼 플레이어 머리 위치

            const cameraDirection = new THREE.Vector3(
                Math.sin(phi) * Math.sin(theta),
                Math.cos(phi),
                Math.sin(phi) * Math.cos(theta)
            );

            // 안정적인 toi 값을 위해 castRayAndGetNormal 사용
            const ray = new rapier.Ray(playerHeadPos, cameraDirection);
            const hit = world.castRayAndGetNormal(ray, dist, true, undefined, undefined, undefined, undefined, playerRef.current);

            let finalDistance = dist;

            const toi = hit?.toi ?? hit?.timeOfImpact;
            if (typeof toi === 'number') {
                finalDistance = Math.max(toi - 0.3, 0.1);
            }

            const finalCameraPos = playerHeadPos.clone().add(cameraDirection.multiplyScalar(finalDistance));
            camera.position.copy(finalCameraPos);
            camera.lookAt(playerHeadPos);

            // 디버깅 로그
            // console.log(`P: ${pitch.current.toFixed(2)}, Y: ${yaw.current.toFixed(2)} | Hit: ${hit ? `toi: ${toi}` : 'null'} | Dist: ${finalDistance.toFixed(2)}`);
        }
        // 최종 디버그 로깅
        // HUD 상태 업데이트
        onHudUpdate?.(prev => ({
            ...prev,
            viewMode: currentViewMode, // Player 내부 viewMode 전달
            isGrounded,
            position: pos, // pos 객체 직접 전달
            velocity: `(${vel.x.toFixed(2)}, ${vel.y.toFixed(2)}, ${vel.z.toFixed(2)})`,
            yaw: yaw.current,
            pitch: pitch.current,
            isAiming: isAiming,
            isScoped: isScoped,
            keys, // 이 keys는 useFrame 스코프 내의 keys 임

        }));
    });
    // CharacterModel로 전달할 props는 useFrame에서 계산된 애니메이션 상태 변수들을 사용합니다.
    const keys = getKeys(); // Get keys for initial render of CharacterModel (before first useFrame)
    const isWalkingAnim = (keys.forward || keys.left || keys.right || keys.backward) && !isDead && !isChatting;
    // const isBackwardAnim = keys.backward && !isDead && !isChatting;
    // const isLeftAnim = keys.left && !isDead && !isChatting;    =================>>>>>>>>>>>추후에 시점 오류 해결되면 애니메이션 추가 예정.
    // const isRightAnim = keys.right && !isDead && !isChatting;
    const isRunningAnim = keys.runFast && !sitToggle && !lieToggle && !isAiming && !isScoped && isWalkingAnim;
    const isSittedAnim = sitToggle && !isDead && !isChatting;
    const isSittedAndWalkAnim = sitToggle && isWalkingAnim;
    const isLyingDownAnim = lieToggle && !isDead && !isChatting;
    const isLyingDownAndWalkAnim = lieToggle && isWalkingAnim;
    const isPunchingAnim = isPunching && !isDead && !isChatting;
    const isSlashingAnim = isSlashing && !isDead && !isChatting;
    const isHittedAnim = isPlayerHitted && !isDead && !isChatting;
    const isJumpingAnim = isJumping && !isAiming && !isScoped && !isDead && !isChatting;
    const isAimingAnim = (isAiming || isScoped) && !isDead && !sitToggle && !lieToggle && !isSittedAndWalkAnim && !isLyingDownAndWalkAnim && !isChatting && isArmed;
    const isAimingAndWalkAnim = (isAiming || isScoped) && isWalkingAnim;
    const isDeadAnim = isDead;
    const isIdleAnim = !(keys.forward || keys.backward || keys.left || keys.right || keys.jump || isPunching || isPlayerHitted) && !sitToggle && !lieToggle && !isDead && !isChatting;
    const isIdleFiringAnim = isFiring && canFire && !isDead && !isChatting && !sitToggle && !lieToggle && isArmed;
    const isWalkingFiringAnim = isFiring && canFire && !isDead && !isChatting && !sitToggle && !lieToggle && isWalkingAnim && isArmed;
    const isRunningFiringAnim = isFiring && canFire && !isDead && !isChatting && !sitToggle && !lieToggle && isRunningAnim && isArmed;

    // 충돌 감지 (사과 상호작용)
    const handleCollisionEnter = useCallback((payload) => {
        setIsGrounded(true);

        const rigidBody = payload.other.rigidBodyObject;
        const type = rigidBody?.userData?.type;
        const id = rigidBody?.userData?.id;

        const validTypes = ['apple', 'ak-47', 'pipe'];

        if (validTypes.includes(type)) {
            if (interactableObjectIdRef.current !== id) {
                interactableObjectIdRef.current = id;
                onObjectProximityChange(id, true);
                console.log(`Player entered ${type} proximity:`, id);
            }
        }
    }, [onObjectProximityChange]);


    const handleCollisionExit = useCallback((payload) => {
        setIsGrounded(false); // 바닥 접지 여부 업데이트

        const rigidBody = payload.other.rigidBodyObject;
        const type = rigidBody?.userData?.type;
        const id = rigidBody?.userData?.id;

        const validTypes = ['apple', 'ak-47', 'pipe'];

        if (validTypes.includes(type) && interactableObjectIdRef.current === id) {
            interactableObjectIdRef.current = null;
            onObjectProximityChange(id, false);
            console.log(`Player exited ${type} proximity:`, id);
        }
    }, [onObjectProximityChange]);



    return (
        <>
            {/* 플레이어 RigidBody (물리 적용) */}
            <RigidBody
                ref={playerRef} // props로 받은 playerRef를 할당
                position={[0, 1.1, 0]} // 초기 위치
                colliders={false} // 콜라이더는 CapsuleCollider로 별도 정의
                enabledRotations={[false, true, false]}
                onCollisionEnter={handleCollisionEnter} // 충돌 시작 시
                onCollisionExit={handleCollisionExit}   // 충돌 종료 시
                friction={0}
                restitution={0}
            >
                {/* 플레이어의 캡슐 콜라이더 (자세에 따라 변경) */}
                {!sitToggle && !lieToggle && (
                    <CapsuleCollider args={[0.4, 0.4]} />
                )}
                {sitToggle && (
                    <CapsuleCollider args={[0.2, 0.4]} position={[0, -0.15, 0]} />
                )}
                {lieToggle && (
                    <CuboidCollider args={[0.4, 0.2, 0.8]} position={[0, -0.6, 0]} />
                )}

                {/* 아이템 줍기 감지를 위한 센서 콜라이더 (자세에 따라 변경) */}
                {!sitToggle && !lieToggle && (
                    <CapsuleCollider args={[0.4, 0.4]} isSensor />
                )}
                {sitToggle && (
                    <CapsuleCollider args={[0.2, 0.4]} isSensor position={[0, -0.15, 0]} />
                )}
                {lieToggle && (
                    <CuboidCollider args={[0.4, 0.2, 0.8]} isSensor position={[0, -0.6, 0]} />
                )}
            </RigidBody>

            {/* 플레이어 3D 모델 */}
            <CharacterModel
                ref={modelRef}
                glbPath={characterModelPath}
                isArmed={isArmed}
                isUsingPipe={isUsingPipe}
                isWalking={isWalkingAnim}
                // isBackward={isBackwardAnim}
                // isLeft={isLeftAnim}
                // isRight={isRightAnim}
                isJumping={isJumpingAnim}
                isRunning={isRunningAnim}
                isSittedAndWalk={isSittedAndWalkAnim}
                isSitted={isSittedAnim}
                isLyingDownAndWalk={isLyingDownAndWalkAnim}
                isLyingDown={isLyingDownAnim}
                isPunching={isPunchingAnim} // isPunching 상태를 애니메이션 prop으로 전달
                isSlashing={isSlashingAnim}
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
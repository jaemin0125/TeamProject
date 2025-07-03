// Player.jsx
import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useKeyboardControls } from '@react-three/drei';
import { RigidBody, CapsuleCollider } from '@react-three/rapier';
import { useControls } from 'leva';
import * as THREE from 'three';

import { CharacterModel } from './CharacterModel'; // CharacterModel 임포트
import { controlsMap } from './utils/constants'; // controlsMap 임포트
import { checkHit } from './utils/gameUtils'; // checkHit 임포트

// Player 컴포넌트 (현재 플레이어의 로직)
// isDead, setIsDead props 추가
export function Player({ onHudUpdate, objectRefs, stompClientInstance, isPlayerHitted, playerNickname, isDead, setIsDead, setViewMode, currentPlayerId }) {
    const { camera, gl } = useThree(); // Three.js 카메라와 WebGL 렌더러
    const [subscribeKeys, getKeys] = useKeyboardControls(); // 키보드 컨트롤 훅
    const [sitToggle, setSitToggle] = useState(false); // 앉기 토글 상태
    const [lieToggle, setLieToggle] = useState(false); // 눕기 토글 상태
    const playerRef = useRef(); // 플레이어 RigidBody 참조
    const modelRef = useRef(); // 플레이어 3D 모델 참조
    const [isGrounded, setIsGrounded] = useState(false); // 바닥에 닿았는지 여부
    const [currentViewMode, setCurrentViewMode] = useState('firstPerson'); // 플레이어 내부의 시점 모드
    const [isPunching, setIsPunching] = useState(false); // 펀치 동작 여부
    const [canPunch, setCanPunch] = useState(true); // 펀치 쿨타임 상태

    const pitch = useRef(0); // 카메라 상하 회전 (pitch)
    const yaw = useRef(0); // 카메라 좌우 회전 (yaw)
    const roll = useRef(0); // 카메라 Z축 회전 (roll)

    // 사망 시 카메라 애니메이션을 위한 목표 값
    const deathCameraTargetY = useRef(0.1); // 카메라가 최종적으로 도달할 Y 위치 (바닥에 가까움)
    const deathCameraTargetPitch = useRef(0); // 카메라가 최종적으로 바라볼 각도 (수평으로 시작)
    const deathCameraTargetRoll = useRef(Math.PI / 4); // 카메라가 최종적으로 옆으로 쓰러질 각도 (45도)

    // Leva를 통한 디버그 컨트롤 (속도, 점프 임펄스)
    const { speed, jumpImpulse } = useControls({
        speed: { value: 5, min: 1, max: 2000 },
        jumpImpulse: { value: 3, min: 1, max: 50 }
    });

    const toggleViewPressed = useRef(false); // 시점 전환 키 눌림 상태

    // 펀치 시 타격 감지 및 서버 전송 로직
    useEffect(() => {
        // 펀치 동작 중이 아니고, 펀치 가능하며, STOMP 클라이언트가 연결되어 있고, 플레이어가 죽지 않았을 때만 실행
        if (!isPunching || !canPunch || !stompClientInstance || !stompClientInstance.connected || isDead) return;

        const attackerPos = playerRef.current?.translation(); // 공격자 위치
        const attackerQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw.current, 0)); // 공격자 회전

        let hitOccurred = false; // 타격 발생 여부 플래그

        // 모든 온라인 플레이어를 순회하며 타격 감지
        (window.onlinePlayers || new Map()).forEach((targetPlayer, id) => {
            if (id === currentPlayerId) return; // 자기 자신은 제외

            const targetPos = targetPlayer.position; // 타겟 플레이어 위치
            const isHit = checkHit(attackerPos, attackerQuat, targetPos); // 히트 여부 확인

            if (isHit) {
               // console.log(`[🥊 Player] 타격 성공 -> 대상: ${id}`);
                // 서버에 플레이어 피격 메시지 전송
                stompClientInstance.publish({
                    destination: '/app/playerHit',
                    body: JSON.stringify({
                        fromId: currentPlayerId,
                        targetId: id,
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
                    isLyingDown: false, isLyingDownAndWalk: false, isPunching: false, isHitted: false, isIdle: true,
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
            if (isDead) return; // 죽음 상태일 때 움직임 비활성화
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
    }, [isDead]); // isDead 의존성 추가

    // 마우스 클릭 (펀치) 로직
    useEffect(() => {
        const handleMouseDown = (e) => {
            if (isDead) return; // 죽음 상태일 때 펀치 비활성화
            if (e.button === 0 && canPunch) { // canPunch가 true일 때만 펀치 시작
                setIsPunching(true);
                // 애니메이션 지속 시간 (0.5초) 후에 isPunching을 false로
                setTimeout(() => setIsPunching(false), 500);
            }
        };

        window.addEventListener('mousedown', handleMouseDown);
        return () => {
            window.removeEventListener('mousedown', handleMouseDown);
        };
    }, [canPunch, isDead]); // 의존성 배열

    // 뷰 모드 전환 (1인칭/3인칭) 로직
    useEffect(() => {
        const unsubscribe = subscribeKeys(
            (s) => s.toggleView,
            (pressed) => {
                if (isDead) return; // 죽음 상태일 때 뷰 모드 전환 비활성화
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
    }, [subscribeKeys, isDead, setViewMode]); // 의존성 배열

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
    }, [onMouseMove, isDead]); // 의존성 배열

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
        const vel = playerRef.current?.linvel() || { x: 0, y: 0, z: 0 }; // 플레이어 선형 속도
        const pos = playerRef.current?.translation() || { x: 0, y: 0, z: 0 }; // 플레이어 위치

        // STOMP 클라이언트가 연결되어 있을 때 플레이어 상태를 서버에 전송
        if (stompClientInstance && stompClientInstance.connected) {
            const playerState = {
                id: currentPlayerId,
                nickname: playerNickname,
                position: { x: pos.x, y: pos.y, z: pos.z },
                rotationY: yaw.current + Math.PI,
                animationState: {
                    isWalking: keys.forward && !isDead, // 죽음 상태일 때 애니메이션 비활성화
                    isBackward: keys.backward && !isDead,
                    isLeft: keys.left && !isDead,
                    isRight: keys.right && !isDead,
                    isJumping: keys.jump && !isDead,
                    isRunning: keys.runFast && (keys.forward || keys.left || keys.right || keys.backward) && !isDead,
                    isSitted: sitToggle && !isDead,
                    isSittedAndWalk: sitToggle && (keys.forward || keys.left || keys.right || keys.backward) && !isDead,
                    isLyingDown: lieToggle && !isDead,
                    isLyingDownAndWalk: lieToggle && (keys.forward || keys.left || keys.right || keys.backward) && !isDead,
                    isPunching: isPunching && !isDead,
                    isHitted: isPlayerHitted && !isDead, // isHitted 상태 전달
                    isIdle: !(keys.forward || keys.backward || keys.left || keys.right || keys.jump || keys.runFast || isPunching || isPlayerHitted) && !sitToggle && !lieToggle && !isDead,
                    isDead: isDead // 죽음 상태 전달
                }
            };
            stompClientInstance.publish({
                destination: `/app/playerMove`,
                body: JSON.stringify(playerState)
            });

            // 씬 오브젝트 위치 업데이트 (서버로 전송)
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

        // 카메라 방향 계산
        const cameraOrientationQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw.current, 0));
        const forwardVector = new THREE.Vector3(0, 0, 1).applyQuaternion(cameraOrientationQ).normalize();
        const rightVector = new THREE.Vector3().crossVectors(forwardVector, new THREE.Vector3(0, 1, 0)).normalize();
        let actualSpeed = speed;

        // 플레이어 움직임 로직 (사망 시 비활성화)
        if (!isDead) {
            // 앉거나 누웠을 때, 또는 달릴 때 속도 조절
            if (sitToggle && (keys.forward || keys.backward || keys.left || keys.right)) {
                actualSpeed = Math.max(speed * 0.5, 1.5);
            } else if (lieToggle && (keys.forward || keys.backward || keys.left || keys.right)) {
                actualSpeed = Math.max(speed * 0.15, 1.2);
            } else if (keys.runFast && (keys.forward || keys.backward || keys.left || keys.right)) {
                actualSpeed = speed + 2;
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

            // 점프 로직
            if (keys.jump && isGrounded && vel.y <= 0.1) {
                playerRef.current.applyImpulse({ x: 0, y: jumpImpulse, z: 0 }, true);
                setIsGrounded(false);
            }
        } else {
            // 플레이어가 죽었을 때 움직임 멈춤
            playerRef.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
        }

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
            const dist = 5; // 카메라와 플레이어 간의 거리
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
            keys,
        }));
    });

    const keys = getKeys(); // 현재 키 상태 가져오기 (애니메이션 prop에 사용)

    return (
        <>
            {/* 플레이어 RigidBody (물리 적용) */}
            <RigidBody
                ref={playerRef}
                position={[0, 1.1, 0]} // 초기 위치
                colliders={false} // 콜라이더는 CapsuleCollider로 별도 정의
                enabledRotations={[false, false, false]} // 회전 비활성화 (캐릭터가 넘어지지 않도록)
                onCollisionEnter={() => setIsGrounded(true)} // 충돌 시작 시 바닥에 닿음
                onCollisionExit={() => setIsGrounded(false)} // 충돌 종료 시 바닥에서 떨어짐
            >
                {/* 플레이어의 캡슐 콜라이더 */}
                <CapsuleCollider args={[0.35, 0.4]} />
            </RigidBody>

            {/* 플레이어 3D 모델 */}
            <CharacterModel
                ref={modelRef}
                isWalking={keys.forward && !isDead} // 죽음 상태일 때 애니메이션 비활성화
                isBackward={keys.backward && !isDead}
                isLeft={keys.left && !isDead}
                isRight={keys.right && !isDead}
                isJumping={keys.jump && !isDead}
                isRunning={keys.runFast && (keys.forward || keys.left || keys.right || keys.backward) && !isDead}
                isSittedAndWalk={sitToggle && (keys.forward || keys.left || keys.right || keys.backward) && !isDead}
                isSitted={sitToggle && !isDead}
                isLyingDownAndWalk={lieToggle && (keys.forward || keys.left || keys.right || keys.backward) && !isDead}
                isLyingDown={lieToggle && !isDead}
                isIdle={!(keys.forward || keys.backward || keys.left || keys.right || keys.jump || keys.runFast || isPunching || isPlayerHitted) && !sitToggle && !lieToggle && !isDead}
                isPunching={isPunching && !isDead}
                isHitted={isPlayerHitted && !isDead} // isHitted prop 전달
                isDead={isDead} // isDead prop 전달
            />
        </>
    );
}
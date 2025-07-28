// OtherPlayer.jsx
import { useRef, useEffect, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CapsuleCollider, CuboidCollider } from '@react-three/rapier';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

import { CharacterModel } from './CharacterModel'; // CharacterModel 임포트

import { Plane, useTexture } from '@react-three/drei';

// OtherPlayer 컴포넌트: 다른 플레이어의 모델, 위치, 애니메이션 상태를 렌더링합니다.
export function OtherPlayer({ id, position, rotationY, animationState, nickname, chatMessages, selectedItem }) {
    const rigidBodyRef = useRef(); // RigidBody에 대한 ref
    const modelGroupRef = useRef(); // 모델 그룹에 대한 ref

    const [balloonMsg, setBalloonMsg] = useState(''); // 상대방 말풍선 추가
    const balloonTimer = useRef(null);  // 상대방 말풍선 표시 쿨타임
    const balloonTexture = useTexture('/chat/ballon.png'); // 말풍선 불러오기

    // OtherPlayer가 마운트될 때 로그를 추가하여 어떤 모델이 선택되는지 확인
    useEffect(() => {
        //console.log(`[OtherPlayer] Mounted: ID: ${id.substring(0, 5)} - Initial Position: (${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`);
        let modelTypeName;
        modelTypeName = 'CharacterModel (character.glb)';
        //console.log(`[OtherPlayer] ID: ${id.substring(0, 5)} assigned model type: ${modelTypeName}`);
    }, []);

    // 매 프레임마다 RigidBody와 모델의 위치 및 회전을 업데이트합니다.
    useFrame(() => {
        if (rigidBodyRef.current && position) {
            const newPos = new THREE.Vector3(position.x, position.y, position.z);
            rigidBodyRef.current.setTranslation(newPos, true); // RigidBody 위치 업데이트

            // 플레이어의 시야(rotationY)에 맞춰 RigidBody의 회전을 업데이트합니다.
            const rotation = new THREE.Quaternion();
            rotation.setFromEuler(new THREE.Euler(0, rotationY + Math.PI, 0)); // rotationY는 서버에서 받은 값

            
            rigidBodyRef.current.setNextKinematicRotation(rotation);
        }

        if (modelGroupRef.current) {
            // 모델의 Y축 회전을 부드럽게 보간 (네트워크 지연 보정)
            modelGroupRef.current.rotation.y = THREE.MathUtils.lerp(modelGroupRef.current.rotation.y, rotationY + Math.PI, 0.2);
        }
    });

    useEffect(() => {
        if (!chatMessages || !chatMessages.length) return;

        const last = chatMessages[chatMessages.length - 1];
        if (last.senderId === id) {
            setBalloonMsg(last.content);

            clearTimeout(balloonTimer.current);
            balloonTimer.current = setTimeout(() => {
                setBalloonMsg('');
            }, 5000); // 2초 후 말풍선 제거
        }
    }, [chatMessages]);

    const safeAnimationState = animationState || {}; // animationState가 없을 경우 빈 객체 사용

    // 플레이어 ID에 따라 렌더링할 캐릭터 모델을 결정 (현재는 CharacterModel 고정)

    const isArmed = safeAnimationState.isArmed === true;
    const isUsingPipe = safeAnimationState.isUsingPipe === true;
    let characterModelPath = '';
    if (isArmed) {
        characterModelPath = '/models/ArmedCharacter.glb';
    } else if (isUsingPipe) {
        characterModelPath = '/models/PipeCharacter.glb';
    } else {
        characterModelPath = '/models/UnarmedCharacter.glb';
    }

    return (
        <RigidBody
            ref={rigidBodyRef}
            position={[position.x, position.y, position.z]} // 초기 위치 설정
            colliders={false} // 콜라이더는 CapsuleCollider로 별도 정의
            type="kinematicPosition" // 물리 엔진에 의해 움직이지 않고, 직접 위치 설정
            userData={{ id }}
        >
            {/* 플레이어의 콜라이더 (자세에 따라 변경) */}
            {!safeAnimationState.isSitted && !safeAnimationState.isLyingDown && (
                <CapsuleCollider args={[0.35, 0.4]} />
            )}
            {safeAnimationState.isSitted && (
                <CapsuleCollider args={[0.2, 0.4]} position={[0, -0.15, 0]} />
            )}
            {safeAnimationState.isLyingDown && (
                <CuboidCollider args={[0.4, 0.2, 0.8]} position={[0, -0.6, 0]} />
            )}

            {/* 모델 그룹: 모델과 닉네임 텍스트를 함께 묶음 */}
            <group ref={modelGroupRef} position-y={-1.65}> {/* 모델의 중심을 조정 */}
                {/* 결정된 CharacterToRender 컴포넌트를 렌더링하고 애니메이션 상태 전달 */}
                <CharacterModel
                    {...safeAnimationState}
                    glbPath={characterModelPath}
                />

                {/* 플레이어 닉네임 표시 */}
                <Text
                    position={[0, 2.6, 0]} // 모델 위쪽에 위치
                    fontSize={0.2}
                    color="black"
                    anchorX="center"
                    anchorY="middle"
                >
                    {nickname || id.substring(0, 5)} {/* 닉네임이 없으면 ID 앞 5자리 표시 */}
                </Text>

                {/* 채팅 말풍선 표시 및 위치 */}
                {balloonMsg && (
                    <group position={[0, 3.2, 0]}>
                        <Plane args={[2.8, 1]} position={[0, 0, 0]}>
                            <meshBasicMaterial
                                map={balloonTexture}
                                transparent
                                opacity={0.9}
                                depthWrite={false}
                                color={!balloonTexture ? 'white' : undefined} // fallback 색상
                            />
                        </Plane>
                        <Text
                            position={[0, 0, 0.01]}
                            fontSize={0.22}
                            color="#000"
                            anchorX="center"
                            anchorY="middle"
                            outlineColor="white"
                            outlineWidth={0.015}
                            maxWidth={2.4}
                            lineHeight={1.3}
                        >
                            {balloonMsg}
                        </Text>
                    </group>
                )}
            </group>
        </RigidBody>
    );
}
// OtherPlayer.jsx
import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, CapsuleCollider } from '@react-three/rapier';
import { Text } from '@react-three/drei';
import * as THREE from 'three';

import { CharacterModel } from './CharacterModel'; // CharacterModel 임포트

// OtherPlayer 컴포넌트: 다른 플레이어의 모델, 위치, 애니메이션 상태를 렌더링합니다.
export function OtherPlayer({ id, position, rotationY, animationState, nickname }) {
    const rigidBodyRef = useRef(); // RigidBody에 대한 ref
    const modelGroupRef = useRef(); // 모델 그룹에 대한 ref

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
        }

        if (modelGroupRef.current) {
            // 모델의 Y축 회전을 부드럽게 보간 (네트워크 지연 보정)
            modelGroupRef.current.rotation.y = THREE.MathUtils.lerp(modelGroupRef.current.rotation.y, rotationY + Math.PI, 0.2);
        }
    });

    const safeAnimationState = animationState || {}; // animationState가 없을 경우 빈 객체 사용

    // 플레이어 ID에 따라 렌더링할 캐릭터 모델을 결정 (현재는 CharacterModel 고정)
    const CharacterToRender = useMemo(() => {
        return CharacterModel;
    }, [id]); // id가 변경될 때만 다시 계산

    return (
        <RigidBody
            ref={rigidBodyRef}
            position={[position.x, position.y, position.z]} // 초기 위치 설정
            colliders={false} // 콜라이더는 CapsuleCollider로 별도 정의
            type="kinematicPosition" // 물리 엔진에 의해 움직이지 않고, 직접 위치 설정
            enabledRotations={[false, false, false]} // 회전 비활성화
        >
            {/* 플레이어의 캡슐 콜라이더 */}
            <CapsuleCollider args={[0.35, 0.4]} />

            {/* 모델 그룹: 모델과 닉네임 텍스트를 함께 묶음 */}
            <group ref={modelGroupRef} position-y={-1.65}> {/* 모델의 중심을 조정 */}
                {/* 결정된 CharacterToRender 컴포넌트를 렌더링하고 애니메이션 상태 전달 */}
                {CharacterToRender && (
                    <CharacterToRender {...safeAnimationState} />
                )}

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
            </group>
        </RigidBody>
    );
}
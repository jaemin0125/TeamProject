// SceneObject.jsx
import React, { useRef, useEffect } from 'react';
import { RigidBody } from '@react-three/rapier';
import * as THREE from 'three';

// SceneObject 컴포넌트: 게임 씬에 배치되는 오브젝트들을 렌더링합니다.
export function SceneObject({ obj, objectRefs }) {
    const rigidBodyRef = useRef(); // RigidBody에 대한 ref

    // 컴포넌트 마운트 시 objectRefs에 RigidBody 참조를 추가하고, 언마운트 시 제거합니다.
    useEffect(() => {
        if (rigidBodyRef.current) {
            objectRefs.current[obj.id] = rigidBodyRef.current;
        }
        return () => {
            if (objectRefs.current[obj.id] === rigidBodyRef.current) {
                delete objectRefs.current[obj.id];
            }
        };
    }, [obj.id, objectRefs]); // obj.id와 objectRefs가 변경될 때만 실행

    // 오브젝트의 위치가 변경될 때 RigidBody의 위치를 업데이트합니다.
    useEffect(() => {
        if (rigidBodyRef.current && obj.position) {
            const newPos = new THREE.Vector3(obj.position.x, obj.position.y, obj.position.z);
            rigidBodyRef.current.setTranslation(newPos, true); // RigidBody 위치 업데이트
        }
    }, [obj.position]); // obj.position이 변경될 때만 실행

    return (
        <RigidBody
            ref={rigidBodyRef}
            position={[obj.position.x, obj.position.y, obj.position.z]} // 초기 위치 설정
            colliders={obj.collider} // 콜라이더 타입 설정
        >
            {/* 오브젝트의 3D 메쉬 */}
            <mesh castShadow receiveShadow>
                {/* 오브젝트 타입에 따라 다른 기하학적 형태 렌더링 */}
                {obj.type === 'box' ? (
                    <boxGeometry args={[obj.size.x, obj.size.y, obj.z]} /> // 박스 형태
                ) : (
                    <sphereGeometry args={[obj.radius, 32, 32]} /> // 구 형태
                )}
                <meshStandardMaterial color={obj.color} /> {/* 재질 색상 설정 */}
            </mesh>
        </RigidBody>
    );
}

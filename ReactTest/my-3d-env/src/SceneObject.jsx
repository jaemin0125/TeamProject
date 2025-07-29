// SceneObject.jsx
import { useRef, useEffect } from 'react';
import { RigidBody } from '@react-three/rapier';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei'; // useGLTF 임포트

// SceneObject 컴포넌트: 게임 씬에 배치되는 오브젝트들을 렌더링합니다.
export function SceneObject({ obj, objectRefs }) {
    const rigidBodyRef = useRef(); // RigidBody에 대한 ref

    // GLB 모델 로드 (사과를 위한 모델)
    // obj.type이 'apple'일 때만 로드하도록 조건부로 호출합니다.
    
    const appleModel = obj.type === 'apple' ? useGLTF(obj.modelPath || '/models/apple.glb') : null; // Use obj.modelPath
    const ak_47Model = obj.type === 'ak-47' ? useGLTF(obj.modelPath || '/models/ak-47.glb') : null; // Use obj.modelPath
    const pipeModel = obj.type === 'pipe' ? useGLTF(obj.modelPath || '/models/pipe.glb') : null; // Use obj.modelPath
    if (obj.type === 'apple' && !appleModel) {
        console.error(`[SceneObject] Failed to load apple model for ${obj.id}. Check model path: ${obj.modelPath || '/models/apple.glb'}`);
    } else if (obj.type === 'ak-47' && !ak_47Model) {
        console.error(`[SceneObject] Failed to load ak-47 model for ${obj.id}. Check model path: ${obj.modelPath || '/models/ak-47.glb'}`);
    } else if (obj.type === 'pipe' && !pipeModel) {
        console.error(`[SceneObject] Failed to load ak-47 model for ${obj.id}. Check model path: ${obj.modelPath || '/models/pipe.glb'}`);
    }

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
            type={'dynamic'}
            ref={rigidBodyRef}
            position={[obj.position.x, obj.position.y, obj.position.z]}
            mass={obj.mass || 1} // 오브젝트의 질량
            restitution={obj.restitution || 0} // 반발력
            friction={obj.friction || 0.1} // 마찰력
            userData={obj}
        >
            {/* 오브젝트의 3D 메쉬 */}
            <mesh castShadow receiveShadow>
                {/* 오브젝트 타입에 따라 다른 기하학적 형태 렌더링 */}

                {obj.type === 'apple' && appleModel && ( // 사과 타입일 경우 GLB 모델 렌더링
                    <primitive object={appleModel.scene.clone()} scale={obj.scale || [0.01, 0.01, 0.01]} /> // 사과 모델 스케일 조정 가능
                )}
                {obj.type === 'ak-47' && ak_47Model && ( // 사과 타입일 경우 GLB 모델 렌더링
                    <primitive object={ak_47Model.scene.clone()} scale={obj.scale || [0.5, 0.5, 0.5]} /> // 사과 모델 스케일 조정 가능
                )}
                {obj.type === 'pipe' && pipeModel && ( // 사과 타입일 경우 GLB 모델 렌더링
                    <primitive object={pipeModel.scene.clone()} scale={obj.scale || [1, 1, 1]} /> // 사과 모델 스케일 조정 가능
                )}
                {/* 박스 타입 */}
                {obj.type === 'box' && (
                    <boxGeometry args={[obj.size.x, obj.size.y, obj.size.z]} />
                )}
                {/* 구 타입 */}
                {obj.type === 'sphere' && (
                    <sphereGeometry args={[obj.radius]} />
                )}
                {/* 원통 타입 (예시) */}
                {obj.type === 'cylinder' && (
                    <cylinderGeometry args={[obj.radiusTop, obj.radiusBottom, obj.height]} />
                )}
                {/* 기본 재질 (색상 적용) */}
                <meshStandardMaterial color={obj.color} />
            </mesh>
        </RigidBody>
    );
}
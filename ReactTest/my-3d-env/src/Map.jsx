// src/main/frontend/src/Map.jsx
import { useGLTF } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier';

// GModMap 컴포넌트: Three.js 씬에 맵을 로드하고 렌더링합니다.
export function GModMap() {
    // GLB 파일 로드
    // gmod_map.glb 파일이 public/models 폴더에 있다고 가정합니다.
    const { scene } = useGLTF('/models/gm_construct.glb');

    // 맵 모델이 그림자를 드리우고 받을 수 있도록 설정
    scene.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    return (
        // RigidBody로 맵을 물리 엔진에 고정합니다. (움직이지 않음)
        // type="fixed"로 설정하여 정적인 오브젝트로 만듭니다.
        // colliders="trimesh"는 복잡한 메쉬 형태를 위한 정밀한 콜라이더를 생성합니다.
        <RigidBody type="fixed" colliders="trimesh" friction={0}>
            {/* 로드된 맵 씬을 primitive로 렌더링 */}
            {/* 위치, 회전, 스케일 조정이 필요할 수 있습니다. */}
            <primitive
                object={scene}
                position={[0, 0, 0]} // 맵의 초기 위치를 조정합니다.
                rotation={[0, Math.PI / 2, 0]} // 필요한 경우 맵의 회전을 조정합니다.
                scale={[3, 3, 3]} // 맵의 스케일을 3배로 다시 조정합니다.
            />
        </RigidBody>
    );
}
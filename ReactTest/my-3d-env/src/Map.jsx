import { useGLTF } from '@react-three/drei';
import { RigidBody } from '@react-three/rapier'; // R

export function GModMap() {
  const { scene } = useGLTF('/models/gm_construct.glb');
      return (
    <RigidBody type="fixed" colliders="trimesh">
      <primitive object={scene} scale={3} />
    </RigidBody>
  );
}

import React, { useEffect, useRef } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';

export const CharacterModel = React.forwardRef(
  ({ isWalking, isBackward, isJumping, isRight, isLeft, isIdle, position = [0, 0.9, 0], scale = [0.8, 0.8, 0.8] }, ref) => {
    const { scene, animations } = useGLTF('/models/character.glb');
    const { actions, mixer } = useAnimations(animations, scene);
    const currentAction = useRef(null);

    useEffect(() => {
      if (!actions) return;
      let nextActionName = null;
      if (isJumping) nextActionName = 'Jump';
      else if (isWalking) nextActionName = 'WalkingForward';
      else if (isBackward) nextActionName = 'WalkingForward';
      else if (isLeft) nextActionName = 'WalkingForward';
      else if (isRight) nextActionName = 'WalkingForward';
      else if (isIdle) nextActionName = 'Idle';

      if (nextActionName && actions[nextActionName]) {
        const nextAction = actions[nextActionName];

        if (currentAction.current !== nextAction) {
          currentAction.current?.fadeOut(0.2);
          nextAction.reset().fadeIn(0.2).play();
          currentAction.current = nextAction;
        }
      }
    }, [isWalking, isJumping, isLeft, isRight, isIdle, actions]);

    useFrame((_, delta) => {
      mixer?.update(delta);
    });

    return <primitive object={scene} ref={ref} position={position} scale={scale} />;
  }
);

//CharacterModel.jsx
import React, { useEffect, useRef } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';

export const CharacterModel = React.forwardRef(
  ({ isWalking, isBackward, isJumping, isRight, isLeft, isIdle, isRunning, isSitted, isSittedAndWalk, isLyingDown, isLyingDownAndWalk, isLanding, isPunching, position = [0, 0.9, 0], scale = [0.8, 0.8, 0.8] }, ref) => {
    const { scene, animations } = useGLTF('/models/character.glb');
    const { actions, mixer } = useAnimations(animations, scene);
    const currentAction = useRef(null);

    useEffect(() => {

      if (!actions) return;
      let nextActionName = null;
      if (isJumping) nextActionName = 'Jump';
      else if (isRunning) nextActionName = 'Run';
      else if (isSittedAndWalk) nextActionName = 'SneakWalk';
      else if (isLyingDownAndWalk) nextActionName = 'Crawl';
      else if (isWalking || isBackward || isLeft || isRight) nextActionName = 'WalkForward';
      else if (isSitted) nextActionName = 'Crouch';
      else if (isLyingDown) nextActionName = 'LieDown';
      else if (isLanding) nextActionName = 'Landing';
      else if (isPunching) nextActionName = 'Punching';
      else if (isIdle) nextActionName = 'Idle';


      if (nextActionName && actions[nextActionName]) {
        const nextAction = actions[nextActionName];

        if (currentAction.current !== nextAction) {
          currentAction.current?.fadeOut(0.2);
          nextAction.reset().fadeIn(0.2).play();
          currentAction.current = nextAction;
        }
      }
    }, [isWalking, isBackward, isJumping, isRight, isLeft, isIdle, isRunning, isSitted, isSittedAndWalk, isLyingDown, isLyingDownAndWalk, isLanding, isPunching, actions]);

    useFrame((_, delta) => {
      mixer?.update(delta);
    });

    return <primitive object={scene} ref={ref} position={position} scale={scale} />;
  }
);

export const CharacterModel2 = React.forwardRef(
  ({ isWalking, isBackward, isJumping, isRight, isLeft, isIdle, isRunning, isSitted, isSittedAndWalk, isLyingDown, isLyingDownAndWalk, isLanding, isPunching, position = [0, 0.9, 0], scale = [0.8, 0.8, 0.8] }, ref) => {
    const { scene, animations } = useGLTF('/models/character2.glb');
    const { actions, mixer } = useAnimations(animations, scene);
    const currentAction = useRef(null);

    useEffect(() => {

      if (!actions) {
        console.log("No actions loaded for CharacterModel2.");
        return;
      }
      console.log("Available CharacterModel2 animations:", Object.keys(actions)); // 여기에 로드된 모든 애니메이션 이름이 출력됩니다.

      let nextActionName = null;
      if (isJumping) nextActionName = 'Jump';
      else if (isRunning) nextActionName = 'Run';
      else if (isSittedAndWalk) nextActionName = 'SneakWalk';
      else if (isLyingDownAndWalk) nextActionName = 'Crawl';
      else if (isWalking || isBackward || isLeft || isRight) nextActionName = 'WalkForward';
      else if (isSitted) nextActionName = 'Crouch';
      else if (isLyingDown) nextActionName = 'LieDown';
      else if (isLanding) nextActionName = 'Landing';
      else if (isPunching) nextActionName = 'Punching';
      else if (isIdle) nextActionName = 'Idle';

      console.log("CharacterModel2 - nextActionName:", nextActionName, { isWalking, isBackward, isJumping, isRight, isLeft, isIdle, isRunning, isSitted, isSittedAndWalk, isLyingDown, isLyingDownAndWalk, isLanding, isPunching });

      if (nextActionName && actions[nextActionName]) {
        const nextAction = actions[nextActionName];

        if (currentAction.current !== nextAction) {
          currentAction.current?.fadeOut(0.2);
          nextAction.reset().fadeIn(0.2).play();
          currentAction.current = nextAction;
        }
      }
    }, [isWalking, isBackward, isJumping, isRight, isLeft, isIdle, isRunning, isSitted, isSittedAndWalk, isLyingDown, isLyingDownAndWalk, isLanding, isPunching, actions]);

    useFrame((_, delta) => {
      mixer?.update(delta);
    });

    return <primitive object={scene} ref={ref} position={position} scale={scale} />;
  }
);
// CharacterModel.jsx
import React, { useEffect, useRef, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils'; // SkeletonUtils.clone 임포트

// CharacterModel 컴포넌트
export const CharacterModel = React.forwardRef(
    ({ isWalking, isBackward, isJumping, isRight, isLeft, isIdle, isRunning, isSitted, isSittedAndWalk, isLyingDown, isLyingDownAndWalk, isLanding, isPunching, isHitted, isDead, position = [0, 0.9, 0], scale = [0.8, 0.8, 0.8] }, ref) => {
        const glbPath = '/models/character.glb';
        const { scene, animations } = useGLTF(glbPath);
        // SkeletonUtils.clone을 사용하여 scene 객체를 복제합니다.
        const clonedScene = useMemo(() => skeletonClone(scene), [scene]);

        // useAnimations 훅은 컴포넌트 최상위 레벨에서 호출됩니다.
        const { actions, mixer } = useAnimations(animations, clonedScene);

        // 애니메이션 상태를 관리하는 useRef는 컴포넌트 최상위 레벨에서 선언됩니다.
        const currentAction = useRef(null);

        useEffect(() => {
            if (!clonedScene) {
                console.error(`CharacterModel (${glbPath}): Failed to load GLB scene. Check file path or integrity.`);
                return;
            }
            if (!animations || animations.length === 0) {
                console.error(`CharacterModel (${glbPath}): No animations found in model. Check model file.`);
                return;
            }
            if (!actions || Object.keys(actions).length === 0) {
                console.error(`CharacterModel (${glbPath}): No animation actions extracted. Check useAnimations hook or animation names.`);
                return;
            }
            // console.log(`CharacterModel (${glbPath}): Available animations:`, Object.keys(actions));

            let nextActionName = null;

            // isDead 상태를 가장 먼저 체크하여 사망 애니메이션의 우선순위를 높입니다.
            if (isDead) {
                nextActionName = 'Dead';
            } else if (isHitted) {
                nextActionName = 'Hit';
            } else if (isPunching) {
                nextActionName = 'Punching';
            } else if (isJumping) {
                nextActionName = 'Jump';
            } else if (isRunning) {
                nextActionName = 'Run';
            } else if (isSittedAndWalk) {
                nextActionName = 'SneakWalk';
            } else if (isLyingDownAndWalk) {
                nextActionName = 'Crawl';
            } else if (isWalking || isBackward || isLeft || isRight) {
                nextActionName = 'WalkForward';
            } else if (isSitted) {
                nextActionName = 'Crouch';
            } else if (isLyingDown) {
                nextActionName = 'LieDown';
            } else if (isLanding) {
                nextActionName = 'Landing';
            } else if (isIdle) {
                nextActionName = 'Idle';
            } 
            // console.log(`CharacterModel (${glbPath}) - nextActionName:`, nextActionName, { isWalking, isBackward, isJumping, isRight, isLeft, isIdle, isRunning, isSitted, isSittedAndWalk, isLyingDown, isLyingDownAndWalk, isLanding, isPunching, isHitted, isDead });

            if (nextActionName && actions[nextActionName]) {
                const nextAction = actions[nextActionName];

                if (currentAction.current !== nextAction) {
                    currentAction.current?.fadeOut(0.2);
                    nextAction.reset().fadeIn(0.2).play();
                    currentAction.current = nextAction;

                    // 'Dead' 애니메이션은 한 번만 재생되고 고정되어야 합니다.
                    if (nextActionName === 'Dead') {
                        nextAction.setLoop(THREE.LoopOnce);
                        nextAction.clampWhenFinished = true; // 애니메이션이 끝난 프레임에 고정
                    } else if (nextActionName === 'Hit') {
                        nextAction.setLoop(THREE.LoopOnce);
                        nextAction.clampWhenFinished = true;

                        const onFinished = () => {
                            if (currentAction.current === nextAction) {
                                actions.Idle?.reset().fadeIn(0.2).play();
                                currentAction.current = actions.Idle;
                            }
                            mixer.removeEventListener('finished', onFinished);
                        };
                        mixer.addEventListener('finished', onFinished);
                    } else {
                        nextAction.setLoop(THREE.LoopRepeat);
                    }
                }
            } else if (nextActionName) {
                console.warn(`CharacterModel (${glbPath}): Animation clip '${nextActionName}' not found.`);
            }
        }, [isWalking, isBackward, isJumping, isRight, isLeft, isIdle, isRunning, isSitted, isSittedAndWalk, isLyingDown, isLyingDownAndWalk, isLanding, isPunching, isHitted, isDead, actions, mixer, clonedScene, animations, glbPath]);

        useFrame((_, delta) => {
            mixer?.update(delta);
        });

        return <primitive object={clonedScene} ref={ref} position={position} scale={scale} />;
    }
);

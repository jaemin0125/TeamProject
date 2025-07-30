import React, { useEffect, useRef, useMemo } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils';

// CharacterModel 컴포넌트
export const CharacterModel = React.forwardRef(
    ({
        glbPath = '/models/UnarmedCharacter.glb', // 기본값 설정
        isArmed = 'false',
        isUsingPipe = 'false',
        isWalking,
        isBackward,
        isJumping,
        isRight,
        isLeft,
        isIdle,
        isRunning,
        isSitted,
        isSittedAndWalk,
        isLyingDown,
        isLyingDownAndWalk,
        isPunching,
        isSlashing,
        isHitted,
        isDead,
        isAiming,
        isAimingAndWalk,
        isIdleFiring,
        isWalkingFiring,
        isRunningFiring,
        position = [0, 0.9, 0],
        scale = [0.8, 0.8, 0.8]
    }, ref) => {

        const { scene, animations } = useGLTF(glbPath);
        const clonedScene = useMemo(() => skeletonClone(scene), [scene]);
        const { actions, mixer } = useAnimations(animations, clonedScene);
        const currentAction = useRef(null);

        useEffect(() => {
            if (!clonedScene || !animations || animations.length === 0 || !actions || Object.keys(actions).length === 0) {
                console.error(`[CharacterModel] Failed to load or parse model/animations from ${glbPath}`);
                return;
            }



            let nextActionName = null;
            // 상태에 따라 애니메이션 우선순위 지정
            if (isDead) nextActionName = isArmed ? 'ArmedDead' : 'Dead';
            else if (isRunningFiring) nextActionName = 'ArmedRunningFiring';
            else if (isWalkingFiring) nextActionName = 'ArmedWalkingFiring';
            else if (isIdleFiring) nextActionName = 'ArmedIdleFiring';
            else if (isHitted) nextActionName = isArmed ? 'ArmedHit' : 'Hit';
            else if (isJumping) nextActionName = isArmed ? 'ArmedJump' : 'Jump';
            else if (isRunning) nextActionName = isArmed ? 'ArmedRun' : 'Run';
            else if (isSittedAndWalk) nextActionName = isArmed ? 'ArmedSittedAndWalk' : 'SneakWalk';
            else if (isLyingDownAndWalk) nextActionName = isArmed ? 'ArmedLieDownAndWalk' : 'Crawl';
            else if (isAimingAndWalk) nextActionName = 'ArmedAimingAndWalk';
            else if (isAiming) nextActionName = 'ArmedAiming';
            else if (isSitted) nextActionName = isArmed ? 'ArmedSit' : 'Crouch';
            else if (isLyingDown) nextActionName = isArmed ? 'ArmedLieDown' : 'LieDown';
            else if (isWalking || isBackward || isLeft || isRight) nextActionName = isArmed ? 'ArmedWalk' : 'WalkForward';
            else if (isIdle && isArmed) nextActionName = 'ArmedIdle';
            else if (isIdle && !isArmed) nextActionName = isUsingPipe ? 'PipeIdle' : 'Idle';
            else if (isSlashing && !isArmed) nextActionName = 'Slash';
            else if (isPunching && !isArmed) nextActionName = 'Punching';

            if (nextActionName && actions[nextActionName]) {
                const nextAction = actions[nextActionName];
                if (currentAction.current !== nextAction) {
                    currentAction.current?.fadeOut(0.2);
                    nextAction.reset().fadeIn(0.2).play();
                    currentAction.current = nextAction;

                    // 반복 여부 설정
                    if (nextActionName === 'Dead' || nextActionName === 'Hit') {
                        nextAction.setLoop(THREE.LoopOnce);
                        nextAction.clampWhenFinished = true;

                        if (nextActionName === 'Hit') {
                            const onFinished = () => {
                                if (currentAction.current === nextAction && actions.Idle) {
                                    actions.Idle.reset().fadeIn(0.2).play();
                                    currentAction.current = actions.Idle;
                                }
                                mixer.removeEventListener('finished', onFinished);
                            };
                            mixer.addEventListener('finished', onFinished);
                        }
                    } else {
                        nextAction.setLoop(THREE.LoopRepeat);
                    }
                }
            }
        }, [
            isWalking, isBackward, isJumping, isRight, isLeft, isIdle, isRunning,
            isSitted, isSittedAndWalk, isLyingDown, isLyingDownAndWalk,
            isPunching, isSlashing, isHitted, isDead, isAiming, isAimingAndWalk, isIdleFiring, isWalkingFiring, isRunningFiring,
            actions, mixer, clonedScene, animations, glbPath
        ]);

        useFrame((_, delta) => {
            mixer?.update(delta);
        });

        return (
            <primitive object={clonedScene} ref={ref} position={position} scale={scale} />
        );
    }
);


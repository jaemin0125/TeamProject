// CharacterModel.jsx
import React, { useEffect, useRef } from 'react';
import { useGLTF, useAnimations } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three'; // THREE를 임포트합니다.

// CharacterModel 컴포넌트
export const CharacterModel = React.forwardRef(
    ({ isWalking, isBackward, isJumping, isRight, isLeft, isIdle, isRunning, isSitted, isSittedAndWalk, isLyingDown, isLyingDownAndWalk, isLanding, isPunching, isHitted, position = [0, 0.9, 0], scale = [0.8, 0.8, 0.8] }, ref) => {
        const { scene, animations } = useGLTF('/models/character.glb');
        const { actions, mixer } = useAnimations(animations, scene);
        const currentAction = useRef(null);

        useEffect(() => {
            if (!actions) {
                console.log("CharacterModel: No actions loaded.");
                return;
            }
            console.log("CharacterModel: Available animations:", Object.keys(actions)); // 로드된 모든 애니메이션 이름 출력

            let nextActionName = null;

            // isHitted 애니메이션을 최우선으로 처리합니다.
            if (isHitted) {
                nextActionName = 'Hit'; // 'Hit' 애니메이션 클립 이름으로 가정
            } else if (isPunching) {
                nextActionName = 'Punching'; // 'Punching' 애니메이션 클립 이름으로 가정
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

            console.log("CharacterModel - nextActionName:", nextActionName, { isWalking, isBackward, isJumping, isRight, isLeft, isIdle, isRunning, isSitted, isSittedAndWalk, isLyingDown, isLyingDownAndWalk, isLanding, isPunching, isHitted });

            if (nextActionName && actions[nextActionName]) {
                const nextAction = actions[nextActionName];

                if (currentAction.current !== nextAction) {
                    currentAction.current?.fadeOut(0.2);
                    nextAction.reset().fadeIn(0.2).play();
                    currentAction.current = nextAction;

                    // 'Hit' 애니메이션이 한 번만 재생되고 Idle로 돌아가도록 설정
                    if (nextActionName === 'Hit') {
                        nextAction.setLoop(THREE.LoopOnce); // 한 번만 재생
                        nextAction.clampWhenFinished = true; // 마지막 프레임에서 멈춤
                        
                        // 애니메이션 종료 후 Idle로 전환
                        const onFinished = () => {
                            if (currentAction.current === nextAction) { // 현재 액션이 'Hit'일 때만
                                actions.Idle?.reset().fadeIn(0.2).play();
                                currentAction.current = actions.Idle;
                            }
                            mixer.removeEventListener('finished', onFinished); // 이벤트 리스너 제거
                        };
                        mixer.addEventListener('finished', onFinished);
                    } else {
                        // 다른 애니메이션은 반복 재생 (기본값)
                        nextAction.setLoop(THREE.LoopRepeat);
                    }
                }
            } else if (nextActionName) {
                console.warn(`CharacterModel: Animation clip '${nextActionName}' not found.`);
            }
        }, [isWalking, isBackward, isJumping, isRight, isLeft, isIdle, isRunning, isSitted, isSittedAndWalk, isLyingDown, isLyingDownAndWalk, isLanding, isPunching, isHitted, actions, mixer]);

        useFrame((_, delta) => {
            mixer?.update(delta);
        });

        return <primitive object={scene} ref={ref} position={position} scale={scale} />;
    }
);

// CharacterModel2 컴포넌트 (CharacterModel과 동일한 로직 적용)
export const CharacterModel2 = React.forwardRef(
    ({ isWalking, isBackward, isJumping, isRight, isLeft, isIdle, isRunning, isSitted, isSittedAndWalk, isLyingDown, isLyingDownAndWalk, isLanding, isPunching, isHitted, position = [0, 0.9, 0], scale = [0.8, 0.8, 0.8] }, ref) => {
        const { scene, animations } = useGLTF('/models/character2.glb');
        const { actions, mixer } = useAnimations(animations, scene);
        const currentAction = useRef(null);

        useEffect(() => {
            if (!actions) {
                console.log("CharacterModel2: No actions loaded.");
                return;
            }
            console.log("CharacterModel2: Available animations:", Object.keys(actions)); // 로드된 모든 애니메이션 이름 출력

            let nextActionName = null;

            if (isHitted) {
                nextActionName = 'Hit'; // 'Hit' 애니메이션 클립 이름으로 가정
            } else if (isPunching) {
                nextActionName = 'Punching'; // 'Punching' 애니메이션 클립 이름으로 가정
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

            console.log("CharacterModel2 - nextActionName:", nextActionName, { isWalking, isBackward, isJumping, isRight, isLeft, isIdle, isRunning, isSitted, isSittedAndWalk, isLyingDown, isLyingDownAndWalk, isLanding, isPunching, isHitted });

            if (nextActionName && actions[nextActionName]) {
                const nextAction = actions[nextActionName];

                if (currentAction.current !== nextAction) {
                    currentAction.current?.fadeOut(0.2);
                    nextAction.reset().fadeIn(0.2).play();
                    currentAction.current = nextAction;

                    if (nextActionName === 'Hit') {
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
                console.warn(`CharacterModel2: Animation clip '${nextActionName}' not found.`);
            }
        }, [isWalking, isBackward, isJumping, isRight, isLeft, isIdle, isRunning, isSitted, isSittedAndWalk, isLyingDown, isLyingDownAndWalk, isLanding, isPunching, isHitted, actions, mixer]);

        useFrame((_, delta) => {
            mixer?.update(delta);
        });

        return <primitive object={scene} ref={ref} position={position} scale={scale} />;
    }
);

// CharacterModel3 컴포넌트 (CharacterModel과 동일한 로직 적용)
export const CharacterModel3 = React.forwardRef(
    ({ isWalking, isBackward, isJumping, isRight, isLeft, isIdle, isRunning, isSitted, isSittedAndWalk, isLyingDown, isLyingDownAndWalk, isLanding, isPunching, isHitted, position = [0, 0.9, 0], scale = [0.8, 0.8, 0.8] }, ref) => {
        const { scene, animations } = useGLTF('/models/character3.glb');
        const { actions, mixer } = useAnimations(animations, scene);
        const currentAction = useRef(null);

        useEffect(() => {
            if (!actions) {
                console.log("CharacterModel3: No actions loaded.");
                return;
            }
            console.log("CharacterModel3: Available animations:", Object.keys(actions)); // 로드된 모든 애니메이션 이름 출력

            let nextActionName = null;

            if (isHitted) {
                nextActionName = 'Hit'; // 'Hit' 애니메이션 클립 이름으로 가정
            } else if (isPunching) {
                nextActionName = 'Punching'; // 'Punching' 애니메이션 클립 이름으로 가정
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
            } else if (isPunching) {
                nextActionName = 'Punching';
            } else if (isIdle) {
                nextActionName = 'Idle';
            }

            console.log("CharacterModel3 - nextActionName:", nextActionName, { isWalking, isBackward, isJumping, isRight, isLeft, isIdle, isRunning, isSitted, isSittedAndWalk, isLyingDown, isLyingDownAndWalk, isLanding, isPunching, isHitted });

            if (nextActionName && actions[nextActionName]) {
                const nextAction = actions[nextActionName];

                if (currentAction.current !== nextAction) {
                    currentAction.current?.fadeOut(0.2);
                    nextAction.reset().fadeIn(0.2).play();
                    currentAction.current = nextAction;

                    if (nextActionName === 'Hit') {
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
                console.warn(`CharacterModel3: Animation clip '${nextActionName}' not found.`);
            }
        }, [isWalking, isBackward, isJumping, isRight, isLeft, isIdle, isRunning, isSitted, isSittedAndWalk, isLyingDown, isLyingDownAndWalk, isLanding, isPunching, isHitted, actions, mixer]);

        useFrame((_, delta) => {
            mixer?.update(delta);
        });

        return <primitive object={scene} ref={ref} position={position} scale={scale} />;
    }
);

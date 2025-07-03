// utils/constants.js
import { v4 as uuidv4 } from 'uuid'; // uuid 라이브러리 임포트

// 키보드 컨트롤 맵 정의
export const controlsMap = [
    { name: 'forward', keys: ['KeyW'] },
    { name: 'backward', keys: ['KeyS'] },
    { name: 'left', keys: ['KeyA'] },
    { name: 'right', keys: ['KeyD'] },
    { name: 'jump', keys: ['Space'] },
    { name: 'toggleView', keys: ['KeyV'] },
    { name: 'runFast', keys: ['ShiftLeft'] },
];

// 플레이어 ID를 localStorage에서 로드하거나 새로 생성하는 함수
export const getOrCreatePlayerInfo = () => {
    let storedPlayerId = localStorage.getItem('myPlayerId');
    if (!storedPlayerId) {
        storedPlayerId = uuidv4(); // 새로운 UUID 생성
        localStorage.setItem('myPlayerId', storedPlayerId); // localStorage에 저장
    }
    return {id: storedPlayerId}; // 플레이어 ID 반환
};
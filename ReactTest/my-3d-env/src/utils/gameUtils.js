// utils/gameUtils.js
import * as THREE from 'three'; // THREE import

// 두 플레이어 간의 히트 여부를 확인하는 함수
export function checkHit(attackerPos, attackerQuat, targetPos) {
    const attacker = new THREE.Vector3(attackerPos.x, attackerPos.y, attackerPos.z); // 공격자 위치 벡터
    const target = new THREE.Vector3(targetPos.x, targetPos.y, targetPos.z); // 타겟 위치 벡터
    const directionToTarget = target.clone().sub(attacker); // 공격자에서 타겟으로 향하는 방향 벡터
    const distance = directionToTarget.length(); // 두 플레이어 간의 거리

    // 공격자의 전방 벡터 계산
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(attackerQuat).normalize();

    // 거리가 너무 가까우면 충돌로 보지 않음 (부동 소수점 오류 방지)
    if (distance < 0.001) return false;

    // 공격자의 전방 벡터와 타겟 방향 벡터 간의 각도 계산
    const angle = forward.angleTo(directionToTarget);

    // 거리가 1.2 미만이고 각도가 Math.PI / 6 (30도) 미만일 때 히트로 판정
    return distance < 1.2 && angle < Math.PI / 6;
}
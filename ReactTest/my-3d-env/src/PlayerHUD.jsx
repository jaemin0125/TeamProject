// PlayerHUD.jsx
import React from 'react';

// PlayerHUD 컴포넌트: 플레이어의 현재 상태를 표시하는 UI (Head-Up Display)
export function PlayerHUD({ state, playerNickname }) {
    // state 객체에서 필요한 정보들을 구조 분해 할당
    const { health = 100, isHit, isDead, respawnProgress = 0 } = state;

    // 다른 플레이어 정보를 배열로 변환하고 현재 플레이어는 필터링
    const otherPlayersArray = state.otherPlayers ? Array.from(state.otherPlayers.values()) : [];
    const otherPlayersInfo = otherPlayersArray
        .filter(p => p.id !== state.currentPlayerId) // currentPlayerId는 GameCanvas에서 받아와야 합니다. (추후 수정 필요)
        .map(p => `ID: ${p.id.substring(0, 5)}, Pos: (${p.position?.x?.toFixed(1) || 'N/A'}, ${p.position?.y?.toFixed(1) || 'N/A'}, ${p.position?.z?.toFixed(1) || 'N/A'})`)
        .join('\n');

    // 리스폰 프로그레스 바 너비 계산 (5초 기준)
    const progressBarWidth = (respawnProgress / 5) * 100;

    return (
        <>
            {/* 좌측 상단 HUD 정보 */}
            <div style={{
                position: 'absolute',
                top: 10,
                left: 20,
                color: 'white',
                fontSize: 14,
                backgroundColor: 'rgba(0,0,0,0.8)',
                padding: 10,
                borderRadius: 8,
                zIndex: 40
            }}>
                <div><strong>닉네임:</strong> {playerNickname}</div>
                <div><strong>Current Player ID:</strong> {state.currentPlayerId ? state.currentPlayerId.substring(0,5) : 'N/A'}</div> {/* currentPlayerId 표시 */}
                <div><strong>View:</strong> {state.viewMode}</div>
                <div><strong>isGrounded:</strong> {state.isGrounded ? '✅' : '❌'}</div>
                <div><strong>Position:</strong> {state.position}</div>
                <div><strong>Velocity:</strong> {state.velocity}</div>
                <div><strong>Yaw:</strong> {state.yaw?.toFixed(2) ?? 'N/A'}</div>
                <div><strong>Pitch:</strong> {state.pitch?.toFixed(2) ?? 'N/A'}</div>
                <div><strong>Keys:</strong> {state.keys ? Object.entries(state.keys).filter(([, v]) => v).map(([k]) => k).join(', ') : 'N/A'}</div>
                <br />
                <div><strong>-- Other Players --</strong></div>
                {otherPlayersArray.filter(p => p.id !== state.currentPlayerId).length > 0 &&
                    <div>Total Other Players: {otherPlayersArray.filter(p => p.id !== state.currentPlayerId).length}</div>
                }
                <pre style={{ whiteSpace: 'pre-wrap' }}>{otherPlayersInfo || "No other players"}</pre>
            </div>
            {/* 좌측 하단 체력 표시 */}
            <div style={{
                position: 'absolute',
                bottom: 10,
                left: 20,
                color: 'white',
                fontSize: 30,
                backgroundColor: 'rgba(0,0,0,0.8)',
                padding: 10,
                borderRadius: 8,
                zIndex: 40
            }}>
                <div className="mb-2 text-sm">💖 HP: {health} / 100 </div>
                {isHit && <span className="mt-2 text-sm text-red-400 animate-pulse">공격당함!</span>}
            </div>
            {/* 사망 시 WASTED! 화면 */}
            {isDead && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '0', // 왼쪽 끝으로 정렬
                    transform: 'translateY(-50%)', // Y축만 중앙 정렬
                    color: 'red',
                    fontSize: 120, // GTA 이미지에 가깝게 글자 크기 더 키움
                    fontWeight: '900', // 더 굵게
                    // 배경색 투명도를 높여서 게임 화면이 더 잘 보이도록 함 (GTA 스타일)
                    backgroundColor: 'rgba(0,0,0,0.4)',
                    padding: '20px 0', // 좌우 패딩 제거
                    borderRadius: '5px', // 모서리를 둥글게 하지 않음 (GTA 스타일)
                    zIndex: 50,
                    // 테두리 제거 (GTA 스타일은 텍스트 자체에 강렬한 그림자를 가짐)
                    border: 'none',
                    // 텍스트 그림자 강화 (GTA 스타일)
                    textShadow: '8px 8px 0px rgba(0,0,0,0.7), 10px 10px 0px rgba(0,0,0,0.5)',
                    letterSpacing: '5px', // 글자 간격 유지
                    // GTA 스타일 폰트 (웹 폰트가 없으므로 시스템 폰트 중 비슷한 느낌 선택)
                    fontFamily: '"Anton", "Impact", "Arial Black", sans-serif',
                    // 애니메이션은 유지하되, 흔들림 강도 조절
                    animation: 'wastedFadeIn 1.5s forwards, wastedShake 0.1s infinite alternate', // 흔들림 이펙트 강도 줄임 (0.5s -> 0.1s)
                    whiteSpace: 'nowrap', // 텍스트가 줄 바꿈되지 않도록
                    width: '100vw', // 뷰포트 가로 전체 너비
                    textAlign: 'center', // 텍스트 중앙 정렬
                    boxSizing: 'border-box',
                }}>
                    YOU DEAD!
                    {/* 리스폰 프로그레스 바 */}
                    <div style={{
                        width: '80%', // 바 컨테이너 너비 (화면 중앙에 오도록)
                        height: '20px',
                        backgroundColor: 'rgba(255, 255, 255, 0.2)', // 반투명 흰색 배경
                        borderRadius: '10px',
                        overflow: 'hidden',
                        margin: '20px auto 0 auto', // 가로 중앙 정렬, 상단 여백
                        border: '2px solid white', // 흰색 테두리
                        boxShadow: '0 0 10px rgba(255,255,255,0.5)', // 은은한 그림자
                    }}>
                        <div style={{
                            width: `${progressBarWidth}%`, // 진행도에 따른 동적 너비
                            height: '100%',
                            backgroundColor: 'red', // 빨간색 채움
                            borderRadius: '8px', // 컨테이너보다 약간 작은 둥근 모서리
                            transition: 'width 0.1s linear', // 너비 변화 부드럽게
                        }}></div>
                    </div>
                </div>
            )}
            {/* WASTED! 애니메이션을 위한 스타일 태그 */}
            <style>
                {`
                @keyframes wastedFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes wastedShake {
                    0% { transform: translateY(-50%) rotate(0deg); }
                    25% { transform: translateY(-50.2%) rotate(0.05deg); } // 흔들림 강도 더 줄임
                    50% { transform: translateY(-49.8%) rotate(-0.05deg); } // 흔들림 강도 더 줄임
                    75% { transform: translateY(-50.2%) rotate(0.05deg); } // 흔들림 강도 더 줄임
                    100% { transform: translateY(-50%) rotate(0deg); }
                }
                `}
            </style>
        </>
    );
}
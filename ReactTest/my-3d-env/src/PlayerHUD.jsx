// PlayerHUD.jsx
import React from 'react';

// PlayerHUD 컴포넌트: 플레이어의 현재 상태를 표시하는 UI (Head-Up Display)
// 모든 JSX 요소는 하나의 부모 요소로 감싸져야 합니다. 여기서는 React Fragment (<>)를 사용합니다.
export function PlayerHUD({ state, playerNickname, inventory, selectedInventorySlot }) {
    // state 객체에서 필요한 정보들을 구조 분해 할당
    const { health = 100, isHit, isDead, respawnProgress = 0, showInteractionPrompt, interactableObjectId } = state; // showInteractionPrompt, interactableObjectId 추가

    // 다른 플레이어 정보를 배열로 변환하고 현재 플레이어는 필터링
    const otherPlayersArray = state.otherPlayers ? Array.from(state.otherPlayers.values()) : [];
    const otherPlayersInfo = otherPlayersArray
        .filter(p => p.id !== state.currentPlayerId)
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
                    width: '100%', // 전체 너비
                    textAlign: 'center', // 중앙 정렬
                    fontFamily: 'Impact, sans-serif', // GTA와 비슷한 폰트
                    textShadow: '8px 8px 0px rgba(0,0,0,0.5)', // 그림자 효과
                    animation: 'wastedFadeIn 1s forwards, wastedShake 0.1s infinite', // 애니메이션 적용
                    zIndex: 50 // 다른 HUD 요소 위에 표시
                }}>
                    WASTED!
                    {/* 리스폰 프로그레스 바 */}
                    <div style={{
                        width: '50%', // 너비 50%
                        height: '15px',
                        backgroundColor: 'rgba(255, 255, 255, 0.3)',
                        borderRadius: '5px',
                        margin: '20px auto 0 auto', // 가운데 정렬 및 상단 여백
                        overflow: 'hidden'
                    }}>
                        {/* 이 div는 progress bar의 채워지는 부분을 나타냅니다. */}
                        <div style={{
                            width: `${progressBarWidth}%`,
                            height: '100%',
                            backgroundColor: 'lime',
                            borderRadius: '5px',
                            transition: 'width 0.1s linear' // 부드러운 진행도 애니메이션
                        }}></div>
                    </div>
                    <div style={{
                        fontSize: 24, // 글자 크기 줄임
                        marginTop: 10,
                        color: 'white'
                    }}>
                        리스폰 중... ({respawnProgress.toFixed(1)}초)
                    </div>
                </div>
            )}
            {/* F 키 상호작용 프롬프트 */}
            {showInteractionPrompt && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    color: 'white',
                    fontFamily: 'Arial, sans-serif',
                    fontSize: '1.5em',
                    textShadow: '2px 2px 4px rgba(0,0,0,0.9)',
                    zIndex: 1001,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    padding: '10px 20px',
                    borderRadius: '10px',
                    textAlign: 'center'
                }}>
                    F
                </div>
            )}
            {/* 인벤토리 핫바 (하단 중앙) */}
            <div style={{
                position: 'absolute',
                bottom: 10,
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                gap: '5px', // 슬롯 간 간격
                zIndex: 40
            }}>
                {inventory.map((item, index) => {
                    console.log(`[PlayerHUD] Rendering slot ${index}. Item data:`, item); // 더 자세한 로그
                    if (item && item.image) {
                        console.log(`[PlayerHUD] Attempting to load image for slot ${index} from src: ${item.image}`); // 이미지 경로 로그
                    }
                    return (
                        <div
                            key={index}
                            style={{
                                width: '60px', // 슬롯 너비
                                height: '60px', // 슬롯 높이
                                border: `2px solid ${selectedInventorySlot === index ? 'gold' : 'gray'}`, // 선택된 슬롯 강조
                                borderRadius: '8px',
                                display: 'flex',
                                flexDirection: 'column', // 아이템 이름과 개수를 세로로 정렬
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white', // 텍스트 색상
                                backgroundColor: 'rgba(125, 125, 125, 0.35)' // 슬롯 배경색 추가
                            }}>
                            {item ? (
                                <>
                                    {/* 아이템 이미지가 있으면 렌더링 */}
                                    {item.image && (
                                        <img
                                            src={item.image}
                                            alt={item.name}
                                            style={{
                                                width: '40px', // 이미지 크기 조절
                                                height: '40px', // 이미지 크기 조절
                                                objectFit: 'contain', // 비율 유지하며 슬롯에 맞춤
                                                marginBottom: '2px', // 이미지와 텍스트 사이 간격
                                                // border: '2px solid red', // 빨간색 테두리 제거
                                                // backgroundColor: 'purple' // 보라색 배경 제거
                                            }}
                                            onError={(e) => {
                                                console.error(`[PlayerHUD] Failed to load image for ${item.name} at ${item.image}:`, e);
                                                e.target.style.display = 'none'; // 오류 발생 시 이미지 숨기기
                                            }}
                                        />
                                    )}
                                    <span>{item.name}</span>
                                    {item.count > 1 && (
                                        <span style={{ fontSize: '0.7em' }}>
                                            {item.count}
                                        </span>
                                    )}
                                </>
                            ) : (
                                <span></span> // 빈 슬롯
                            )}
                        </div>
                    );
                })}
            </div>

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

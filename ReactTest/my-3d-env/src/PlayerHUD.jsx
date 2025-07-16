// PlayerHUD.jsx
// PlayerHUD 컴포넌트: 플레이어의 현재 상태를 표시하는 UI (Head-Up Display)

import { div } from "three/tsl";

// 모든 JSX 요소는 하나의 부모 요소로 감싸져야 합니다. 여기서는 React Fragment (<>)를 사용합니다.
export function PlayerHUD({ state, playerNickname, inventory, selectedInventorySlot }) {
    // state 객체에서 필요한 정보들을 구조 분해 할당
    const { health = 100, isHit, isDead, isAiming, isScoped, respawnProgress = 0, showInteractionPrompt, interactableObjectId } = state;

    // 다른 플레이어 정보를 배열로 변환하고 현재 플레이어는 필터링
    const otherPlayersArray = state.otherPlayers ? Array.from(state.otherPlayers.values()) : [];
    const otherPlayersInfo = otherPlayersArray
        .filter(p => p.id !== state.currentPlayerId)
        .map(p => `ID: ${playerNickname}, Pos: (${p.position?.x?.toFixed(1) || 'N/A'}, ${p.position?.y?.toFixed(1) || 'N/A'}, ${p.position?.z?.toFixed(1) || 'N/A'})`)
        .join('\n');

    // 리스폰 프로그레스 바 너비 계산 (5초 기준)

    // 체력 바 색상 결정
    const healthBarColor = health > 50 ? 'limegreen' : health > 20 ? 'orange' : 'red';

    return (
        <>
            {/* 메인 HUD 컨테이너 (이전에는 없었지만, 전체적인 스타일 관리를 위해 추가) */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none', // HUD 엘리먼트가 마우스 이벤트를 가로채지 않도록 설정
                    zIndex: 999, // 다른 요소 위에 오도록 설정
                    fontFamily: 'Arial, sans-serif',
                    color: 'white',
                    textShadow: '1px 1px 2px black',
                }}
            >
                {/* 좌측 상단 HUD 정보 (디버그 정보 및 플레이어 정보) */}
                <div style={{
                    position: 'absolute',
                    top: 20,
                    left: 20,
                    color: 'white',
                    fontSize: 14,
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    padding: 15,
                    borderRadius: 10,
                    zIndex: 40,
                    maxHeight: 'calc(100% - 40px)', // 화면 높이에 따라 스크롤 가능하게
                    overflowY: 'auto',
                    boxShadow: '0 0 15px rgba(0,0,0,0.5)'
                }}>
                    <div><strong>ID:</strong> {state.id.substring(0, 5)}</div>
                    <div><strong>닉네임:</strong> {playerNickname}</div>
                    <div><strong>isGrounded:</strong> {state.isGrounded ? '✅' : '❌'}</div>
                    <div><strong>Yaw:</strong> {state.yaw?.toFixed(2) ?? 'N/A'}</div>
                    <div><strong>Pitch:</strong> {state.pitch?.toFixed(2) ?? 'N/A'}</div>
                    <br />
                    <div><strong>-- Other Players --</strong></div>
                    {otherPlayersArray.filter(p => p.id !== state.currentPlayerId).length > 0 &&
                        <div>Total Other Players: {otherPlayersArray.filter(p => p.id !== state.currentPlayerId).length}</div>
                    }
                    <pre style={{ whiteSpace: 'pre-wrap' }}>{otherPlayersInfo || "No other players"}</pre>
                </div>

                {/* 체력 바 (인벤토리 위에 위치하도록 수정) */}
                <div style={{
                    position: 'absolute',
                    bottom: 90, // 인벤토리 높이 (60px) + 인벤토리 하단 여백 (10px) + 체력바와 인벤토리 사이 간격 (20px) = 90px
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '250px',
                    height: '25px',
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '1px solid #333',
                    boxShadow: '0 0 10px rgba(0,0,0,0.5)',
                    zIndex: 600, // 인벤토리보다 위에 보이도록
                    pointerEvents: 'none',
                }}>
                    <div style={{
                        width: `${health}%`,
                        height: '100%',
                        backgroundColor: healthBarColor, // 체력에 따라 색상 변화
                        transition: 'width 0.2s ease-in-out',
                    }}></div>
                    <span style={{
                        position: 'absolute',
                        width: '100%',
                        textAlign: 'center',
                        lineHeight: '25px', // 체력바 높이와 동일
                        color: 'white',
                        fontWeight: 'bold',
                        textShadow: '1px 1px 2px black',
                    }}>
                    </span>
                </div>



                {/* 인벤토리 핫바 (하단 중앙) - 주신 코드 그대로 유지하며 다른 요소들과 위치 조절 */}
                {!isScoped && (

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
                                        backgroundColor: 'rgba(0, 0, 0, 0.7)', // 슬롯 배경색 추가
                                        boxShadow: '0 0 10px rgba(0,0,0,0.5)',
                                        pointerEvents: 'none', // 마우스 이벤트 무시
                                    }}
                                >
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
                                                    }}
                                                    onError={(e) => {
                                                        console.error(`[PlayerHUD] Failed to load image for ${item.name} at ${item.image}:`, e);
                                                        e.target.style.display = 'none'; // 오류 발생 시 이미지 숨기기
                                                    }}
                                                />
                                            )}
                                            <span style={{ fontSize: '0.7em', textShadow: '1px 1px 2px black' }}>{item.name}</span>
                                            {item.count > 1 && (
                                                <span style={{ fontSize: '0.7em', textShadow: '1px 1px 2px black' }}>
                                                    x{item.count}
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
                )}

                {isHit && !isDead && (
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            backgroundColor: 'rgba(255, 0, 0, 0.3)',
                            pointerEvents: 'none',
                            animation: 'hitFlash 0.5s forwards', // 짧은 애니메이션으로 플래시 효과
                        }}
                    ></div>
                )}

                {/* 사망 시 오버레이 (요청하신 이전 스타일로 복구) */}
                {isDead && (
                    <div
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            backgroundColor: 'rgba(0, 0, 0, 0.4)',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            color: 'white',
                            fontSize: '2em',
                            fontWeight: 'bold',
                            pointerEvents: 'none',
                            zIndex: 1000, // 다른 UI 위에 오도록
                        }}
                    >
                        YOU ARE DEAD!
                        <div style={{ fontSize: '0.6em', marginTop: '10px' }}>
                            Respawning in {Math.ceil(5 - respawnProgress)} seconds...
                        </div>
                    </div>
                )}

                {!isDead && !isAiming && !isScoped && (
                    <div
                        style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '40px',
                            height: '40px',
                            pointerEvents: 'none',
                            zIndex: 9999,
                        }}
                    >
                        {/* 위쪽 라인 */}
                        <div style={{
                            position: 'absolute',
                            top: '1px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: '2px',
                            height: '8px',
                            backgroundColor: 'white',
                            boxShadow: '0 0 4px black',
                        }}></div>

                        {/* 아래쪽 라인 */}
                        <div style={{
                            position: 'absolute',
                            bottom: '1px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: '2px',
                            height: '8px',
                            backgroundColor: 'white',
                            boxShadow: '0 0 4px black',
                        }}></div>

                        {/* 왼쪽 라인 */}
                        <div style={{
                            position: 'absolute',
                            left: '1px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: '8px',
                            height: '2px',
                            backgroundColor: 'white',
                            boxShadow: '0 0 4px black',
                        }}></div>

                        {/* 오른쪽 라인 */}
                        <div style={{
                            position: 'absolute',
                            right: '1px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            width: '8px',
                            height: '2px',
                            backgroundColor: 'white',
                            boxShadow: '0 0 4px black',
                        }}></div>
                    </div>
                )}


                {/* 크로스헤어 (사망 중이 아닐 때만) */}
                {!isDead && isAiming && !isScoped && (
                    <div
                        style={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '24px',
                            height: '24px',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            pointerEvents: 'none',
                            zIndex: 9999, // 다른 UI 위에 올라오게 충분히 크게 설정
                        }}
                    >
                        {/* 수직선 */}
                        <div style={{
                            position: 'absolute',
                            width: '2px',
                            height: '100%',
                            backgroundColor: 'white',
                            boxShadow: '0 0 4px black',
                        }}></div>
                        {/* 수평선 */}
                        <div style={{
                            position: 'absolute',
                            width: '100%',
                            height: '2px',
                            backgroundColor: 'white',
                            boxShadow: '0 0 4px black',
                        }}></div>
                        {/* 중앙 점 */}
                        <div style={{
                            position: 'absolute',
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: 'white',
                            boxShadow: '0 0 6px black',
                        }}></div>
                    </div>
                )}

                {isScoped && !isDead && (
                    <>
                        {/* 2x 스코프 이미지 오버레이 */}
                        <img
                            src="/textures/2xScope.png" // 이 경로는 실제로 이미지가 위치한 public 폴더 기준으로 작성
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                                pointerEvents: 'none',
                                zIndex: 500,
                            }}
                        />

                        {/* 중앙 빨간 점 (옵션) */}
                        <div
                            style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                width: '6px',
                                height: '6px',
                                backgroundColor: 'red',
                                borderRadius: '50%',
                                transform: 'translate(-50%, -50%)',
                                boxShadow: '0 0 6px red',
                                pointerEvents: 'none',
                                zIndex: 10000,
                            }}
                        />
                    </>
                )}







                {/* F 키 상호작용 프롬프트 (크로스헤어 위에 보이도록 zIndex 높임) */}
                {showInteractionPrompt && !isDead && !isScoped && !isAiming && (
                    <div style={{
                        position: 'absolute',
                        top: 'calc(50% + 40px)', // 크로스헤어 아래에 위치 (크로스헤어 높이의 절반 + 여백)
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        color: 'white',
                        fontFamily: 'Arial, sans-serif',
                        fontSize: '1.5em',
                        textShadow: '2px 2px 4px rgba(0,0,0,0.9)',
                        zIndex: 10000, // 크로스헤어보다 위에 보이도록
                        backgroundColor: 'rgba(0, 0, 0, 0.6)',
                        padding: '10px 20px',
                        borderRadius: '10px',
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                        animation: 'fadeInOut 1.5s ease-in-out infinite alternate', // 깜빡이는 애니메이션
                        border: '2px solid rgba(255,255,255,0.5)'
                    }}>
                        Press <span style={{ color: 'gold', fontWeight: 'bold' }}>[F]</span>
                    </div>
                )}
            </div>

            {/* CSS Keyframes for animations */}
            <style>
                {`
                @keyframes wastedFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes wastedShake {
                    0% { transform: translateY(-50%) rotate(0deg); }
                    25% { transform: translateY(-50.2%) rotate(0.05deg); }
                    50% { transform: translateY(-49.8%) rotate(-0.05deg); }
                    75% { transform: translateY(-50.2%) rotate(0.05deg); }
                    100% { transform: translateY(-50%) rotate(0deg); }
                }
                @keyframes fadeInOut {
                    0% { opacity: 0.7; }
                    100% { opacity: 1; }
                }
                @keyframes hitFlash {
                     from { opacity: 1; }
                     to { opacity: 0; }
                }   
                `}
            </style>
        </>
    );
}
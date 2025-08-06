import React from 'react';
import './Npc.css';

export default function NpcHUD({
  dialogueState,
  showPrompt,
  onCloseShop,
  gold,
  client,
  currentPlayerId,
  npcActionMessage,
}) {
  if (!dialogueState && !showPrompt) return null;

  const isShopOpen = dialogueState?.shopOpen;
  const shopItems = dialogueState?.items || [];
  const npcDescription = dialogueState?.npcDescription || '';
  const countdownTime = dialogueState?.countdownTime || '';


  return (
    <div className="npc-hud-ui">
     {/* ✅ 실패 메시지 출력 */}
      {npcActionMessage && (
        <div className="npc-warning-message" style={{ marginTop: '10px', color: 'red' }}>
          {npcActionMessage}
        </div>
      )}

      {/* ✅ F 키 안내 */}
      {showPrompt && <div className="npc-bubble-text">[F] 대화하기</div>}

      {/* ✅ 대화 선택지 */}
      {dialogueState && (
        <>
          <div className="npc-bubble-text">{dialogueState.text}</div>
          {dialogueState.buttons?.map((btn, i) => (
            <div
              key={i}
              className="npc-option-button"
              onClick={() => typeof btn.onClick === 'function' && btn.onClick()}
            >
              [{i + 1}] {btn.label}
            </div>
          ))}
        </>
      )}

      {/* ✅ 상점 UI */}
      {isShopOpen && (
        <div className="shop-container">
          {dialogueState.npcName && (
            <div className="npc-title">{dialogueState.npcName}</div>
          )}

      <div className="shop-left">
      {shopItems.map((item, index) => (
        <div className="shop-item" key={index}>
          <img src={item.icon} alt={item.name} className="shop-item-image" />
          <div className="item-details">
            <div className="item-name">{item.name} : {item.price}골드</div>
          </div>
          <button
            className="shop-buy-button"
            onClick={() => {
              console.log("🛒 구매 버튼 클릭됨:", item.name);
              dialogueState.onBuy?.(item);
            }}
          >
            구매
          </button>
        </div>
      ))}

 
    </div>

    {/* 우측 설명 영역 */}
    <div className="shop-right">
      <p>{npcDescription}</p>
    </div>

    <div className="shop-close-button" onClick={onCloseShop}>
      닫기
    </div>
  </div>
)}
    </div>
  );
}
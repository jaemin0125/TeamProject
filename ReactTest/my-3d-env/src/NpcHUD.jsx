import React from 'react';
import './Npc.css';

export default function NpcHUD({ dialogueState, showPrompt, onCloseShop, gold, }) {
  if (!dialogueState && !showPrompt) return null;


  const isShopOpen = dialogueState?.shopOpen;
  const shopItems = dialogueState?.items || [];
  const npcDescription = dialogueState?.npcDescription || '';
  const countdownTime = dialogueState?.countdownTime || '';


  return (
    <div className="npc-hud-ui">
      {/* ✅ F 키 안내 */}
      {showPrompt && (
        <div className="npc-bubble-text">
          [F] 대화하기
        </div>
      )}

      {/* ✅ 대화 선택지 */}
      {dialogueState && (
        <>
          <div className="npc-bubble-text">{dialogueState.text}</div>
          {dialogueState.buttons?.map((btn, i) => (
            <div key={i} className="npc-option-button" onClick={() => typeof btn.onClick === 'function' && btn.onClick()}>
              [{i + 1}] {btn.label}
            </div>
          ))}
        </>
      )}



      {/* 상점 UI */}
      {isShopOpen && (
        <div className="shop-container">
          {dialogueState?.npcName && <div className="npc-title">{dialogueState.npcName}</div>}
          <div className="shop-left">
            {shopItems.map((item, index) => (
              <div className="shop-item" key={index}>
                <img src={item.icon} alt={item.name} />
                <div className="item-info">
                  <span>{item.name} : {item.price} 골드</span>
                  <button
                    disabled={gold < item.price}
                    onClick={() => {
                      client.publish({
                        destination: '/app/shop/buy',
                        body: JSON.stringify({
                          playerId,
                          itemName: item.name,
                          price: item.price
                        })
                      });
                    }}
                  >
                     구매
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="shop-right">
            {/* <h3>{(npcName || '상점')}의 상점</h3>  */}
            <p>{npcDescription}</p>
          </div>
          {/* ✅ 하단 중앙 닫기 버튼 추가 */}
          <div className="shop-close-button" onClick={onCloseShop}>
            닫기
          </div>

        </div>
      )}



    </div>
  );
}



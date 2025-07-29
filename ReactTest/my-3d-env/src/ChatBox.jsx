import { useEffect, useRef } from 'react';

export default function ChatBox({
  stompClient,
  currentPlayerId, // 현재 플레이어ID
  setIsChatting,
  chatInput,
  setChatInput,
  chatMessages, // 	현재 채팅 메시지 리스트 상태
  setChatMessages, // 	새로운 메시지를 받아서 리스트를 갱신 
  playerNickname // 플레이어 닉네임
}) {
  const messageEndRef = useRef(null);
  const chatInputRef = useRef(null); // 입력창 DOM 참조

  // 메시지 수신
  useEffect(() => {
    if (!stompClient) return;

    const subscription = stompClient.subscribe(`/topic/chat`, (message) => {
      try {
        const msg = JSON.parse(message.body);
        setChatMessages(prev => [...prev, msg]);
      } catch (err) {
        console.error('[ChatBox] 메시지 파싱 오류:', err);
      }
    });

    return () => subscription.unsubscribe();
  }, [stompClient, setChatMessages]);

  // 메시지 전송
  const sendMessage = () => {
    if (chatInput.trim() === '') return;
    if (stompClient) {
      const message = {
        senderId: currentPlayerId,
        content: chatInput
      };

      stompClient.publish({
        destination: '/app/chat',
        body: JSON.stringify({
          senderId: currentPlayerId,
          nickName: playerNickname,
          content: chatInput // 서버에서 받는 필드와 일치
        }),
      });

      setChatInput('');
      chatInputRef.current?.blur(); // 메시지 전송 후 입력창 포커스 해제
    }
  };

  // 메시지 스크롤 자동 이동
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  // ESC → 포커스 해제 / Enter → 포커스
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        chatInputRef.current?.blur();
      } else if (e.key === 'Enter' && document.activeElement !== chatInputRef.current) {
        e.preventDefault();
        chatInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.messages}>
        {chatMessages.map((msg, idx) => (
          <div key={idx}>
            <strong style={{ color: msg.senderId === currentPlayerId ? '#4ade80' : '#fff' }}>
              {(msg.nickName || msg.senderId?.substring(0, 5) || '???') + ':'}
            </strong>{' '}
            {msg.content ?? '[내용 없음]'}
          </div>
        ))}
        <div ref={messageEndRef} />
      </div>
      <div style={styles.inputWrapper}>
        <input
          ref={chatInputRef}
          onFocus={() => setIsChatting(true)}
          onBlur={() => setIsChatting(false)}

          type="text"
          placeholder="채팅 입력 후 Enter"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.stopPropagation(); // 이벤트 전파 중단
              sendMessage();
            }
          }}
          style={styles.input}
        />
        
      </div>
    </div>
  );
}

// 스타일
const styles = {
  container: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: '320px',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',  // 더 진한 어둠
    padding: '12px',
    borderRadius: '12px',
    color: '#f8f8f8',
    fontSize: '14px',
    zIndex: 100,
    border: '2px solid #003366',  //  테두리
    
    backdropFilter: 'blur(3px)',
    fontFamily: 'Georgia, serif',  // 고딕 느낌
  },
  messages: {
    height: '150px',
    overflowY: 'auto',
    marginBottom: '10px',
    padding: '6px',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.1)',
  },
  inputWrapper: {
    display: 'flex',
    gap: '8px',
  },
  input: {
    flex: 1,
    padding: '6px',
    borderRadius: '6px',
    border: '1px solid #444',
    backgroundColor: 'rgba(0,0,0,0.5)',
    color: '#f8f8f8',
    fontFamily: 'inherit',
    outline: 'none',
  },
  button: {
    padding: '6px 12px',
    backgroundColor: ' #003366', 
    border: '1px solid #003366',
    borderRadius: '6px',
    color: '#fff',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'background 0.2s ease-in-out',
  },
};

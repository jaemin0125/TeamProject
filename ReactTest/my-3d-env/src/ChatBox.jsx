import { useEffect, useRef } from 'react';

export default function ChatBox({
  stompClient,
  roomId = 'room1',
  currentPlayerId,
  setIsChatting,
  chatInput,
  setChatInput,
  chatMessages,
  setChatMessages,
  nickName
}) {
  const messageEndRef = useRef(null);
  const chatInputRef = useRef(null); // 입력창 DOM 참조

  // 메시지 수신
  useEffect(() => {
    if (!stompClient) return;

    const subscription = stompClient.subscribe(`/topic/chat/${roomId}`, (message) => {
      try {
        const msg = JSON.parse(message.body);
        setChatMessages(prev => [...prev, msg]);
      } catch (err) {
        console.error('[ChatBox] 메시지 파싱 오류:', err);
      }
    });

    return () => subscription.unsubscribe();
  }, [stompClient, roomId, setChatMessages]);

  // 메시지 전송
  const sendMessage = () => {
    if (chatInput.trim() === '') return;
    if (stompClient) {
      const message = {
        senderId: currentPlayerId,
        content: chatInput,
        roomId: roomId,
      };

      stompClient.publish({
        destination: '/app/chat.send',
        body: JSON.stringify(message),
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
              {msg.senderId?.substring(0, 5) ?? '???'}:
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
        <button onClick={sendMessage} style={styles.button}>보내기</button>
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
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: '10px',
    borderRadius: '10px',
    color: 'white',
    fontSize: '14px',
    zIndex: 100,
  },
  messages: {
    height: '150px',
    overflowY: 'auto',
    marginBottom: '8px',
  },
  inputWrapper: {
    display: 'flex',
    gap: '6px',
  },
  input: {
    flex: 1,
    padding: '6px',
    borderRadius: '5px',
    border: 'none',
    outline: 'none',
  },
  button: {
    padding: '6px 10px',
    backgroundColor: '#22c55e',
    border: 'none',
    borderRadius: '5px',
    color: 'white',
    cursor: 'pointer',
  },
}
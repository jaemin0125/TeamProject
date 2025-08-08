// App.jsx
import React, { useState, useEffect, useRef } from 'react';
import { GameCanvas } from './GameCanvas'; // GameCanvas 임포트
import { getOrCreatePlayerInfo } from './utils/constants'; // getOrCreatePlayerInfo 임포트
import './App.css';


export default function App() {
    // sessionStorage에서 'enteredGame' 상태를 로드합니다.
    const [enteredGame, setEnteredGame] = useState(() => {
        const storedEnteredGame = sessionStorage.getItem('enteredGame');
        return storedEnteredGame === 'true'; // 문자열 'true'를 불리언 true로 변환
    });
    // localStorage에서 닉네임을 불러와 초기값으로 설정합니다.
    // 만약 이전에 설정된 닉네임이 없다면 '플레이어_' + ID 앞 5자리로 설정합니다.
    const [nickname, setNickname] = useState(() => {
        let storedNickname = localStorage.getItem('myNickname');
        if (!storedNickname) {
            const { id } = getOrCreatePlayerInfo(); // ID는 이 함수에서 가져옵니다.
            storedNickname = `플레이어_${id.substring(0, 5)}`;
        }
        return storedNickname;
    });

    // enteredGame 상태가 변경될 때 sessionStorage에 저장합니다.
    useEffect(() => {
        sessionStorage.setItem('enteredGame', enteredGame.toString());
    }, [enteredGame]);

    // 닉네임 제출 핸들러
    const nicknameInputRef = useRef(null);

    const handleNicknameSubmit = () => {
        localStorage.setItem('myNickname', nickname); // 입력된 닉네임 저장

        if (nickname.trim().length === 0) {
            alert('닉네임을 입력하세요.');
            nicknameInputRef.current.focus();
            return;
        }
        setEnteredGame(true); // 게임 입장 상태로 변경

    };

    // 게임 입장 전 닉네임 입력 화면
    if (enteredGame) {
        return <GameCanvas playerNickname={nickname} />; // GameCanvas에 현재 닉네임을 prop으로 전달
    }

    // 닉네임 입력 UI
    return (
        <div
            className="main_page"
            style={{ backgroundImage: "url('/Thumbnail/Thumbnail.jpg')" }} // 배경 이미지 경로 설정
        >
            <div className="display-column">
                <h1>VENICE</h1>
                <p>
                    닉네임을 입력하세요.
                </p>
                <input
                    type="text"
                    ref={nicknameInputRef}
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="닉네임을 입력하세요"
                    maxLength={10} // 닉네임 최대 길이 제한
                    className="nickname-input"
                    onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                            handleNicknameSubmit();
                        }
                    }}
                />
                <button
                    onClick={handleNicknameSubmit}
                    className="start-button"
                >
                    게임 입장
                </button>
            </div>
        </div>
    );
}
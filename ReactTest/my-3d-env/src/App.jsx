// App.jsx
import React, { useState, useEffect } from 'react';
import { GameCanvas } from './GameCanvas'; // GameCanvas 임포트
import { getOrCreatePlayerInfo } from './utils/constants'; // getOrCreatePlayerInfo 임포트

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
    const handleNicknameSubmit = () => {
        localStorage.setItem('myNickname', nickname); // 입력된 닉네임 저장
        setEnteredGame(true); // 게임 입장 상태로 변경
    };

    // 게임 입장 전 닉네임 입력 화면
    if (enteredGame) {
        return <GameCanvas playerNickname={nickname} />; // GameCanvas에 현재 닉네임을 prop으로 전달
    }

    // 닉네임 입력 UI
    return (
        <div
            className="w-screen h-screen bg-cover bg-center flex items-center justify-center"
            style={{ backgroundImage: "url('/background-image.jpg')" }} // 배경 이미지 경로 설정
        >
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-10 max-w-lg w-full text-center shadow-2xl border border-white/20">
                <h1 className="text-5xl font-extrabold text-white mb-6 drop-shadow-lg">
                    🕹️ 멀티플레이어 3D 게임
                </h1>
                <p className="text-lg text-gray-100 mb-8">
                    게임에 입장할 닉네임을 입력하세요.
                </p>
                <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="닉네임을 입력하세요"
                    maxLength={10} // 닉네임 최대 길이 제한
                    className="w-full p-3 mb-4 text-center text-lg rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500"
                    onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                            handleNicknameSubmit();
                        }
                    }}
                />
                <button
                    onClick={handleNicknameSubmit}
                    className="px-8 py-3 bg-green-500 hover:bg-green-600 text-white text-lg font-semibold rounded-xl shadow-lg transition-transform transform hover:scale-105 active:scale-95"
                >
                    🚪 게임 입장하기
                </button>
            </div>
        </div>
    );
}

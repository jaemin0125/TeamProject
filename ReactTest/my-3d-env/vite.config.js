// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // sockjs-client에서 'global'을 찾지 못하는 문제를 해결
    // 'global'을 브라우저 환경의 'window' 객체로 매핑
    global: 'window',
  },
  server: {
    // CORS 문제를 해결하기 위한 프록시 설정 (선택 사항이지만 개발에 유용)
    // Spring Boot 서버가 8080 포트에서 실행될 경우, 클라이언트 요청을 프록시합니다.
    proxy: {
      '/ws-connect': { // 웹소켓 엔드포인트
        target: 'http://localhost:8080',
        ws: true, // 웹소켓 프록시 활성화
        changeOrigin: true,
      },
      // 다른 API 엔드포인트가 있다면 여기에 추가
      // '/api': {
      //   target: 'http://localhost:8080',
      //   changeOrigin: true,
      // },
    },
  },
});
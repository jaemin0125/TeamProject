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
    // 프록시 설정은 더 이상 필요 없습니다.
    // 백엔드 서버가 AWS EC2에 배포되었으므로, 클라이언트는 직접 AWS IP로 통신합니다.
    // 'proxy' 설정을 아예 제거하거나 주석 처리하세요.
    
    // 이 부분만 추가/수정합니다:
    host: '192.168.5.16', // 당신의 내부 IP 주소를 명시
    port: 5173 // React 개발 서버 포트
  },
});
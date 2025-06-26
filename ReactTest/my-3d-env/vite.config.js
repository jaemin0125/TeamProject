// vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        // rewrite를 제거하거나 주석 처리합니다.
        // rewrite: (path) => path.replace(/^\/api/, ''), // 이 줄을 제거하거나 주석 처리!
      },
    },
  },
});
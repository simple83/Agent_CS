import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// React 변환과 개발 중 빠른 새로고침을 적용한다. API 모드는 실행 명령의 --mode로 선택한다.
export default defineConfig({
  plugins: [react()],
})

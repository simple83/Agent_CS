import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// React 변환과 개발 중 빠른 새로고침을 적용한다. API 모드는 실행 명령의 --mode로 선택한다.
export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          // 작성 화면에서만 쓰는 Markdown 변환기와 의존성을 별도 파일로 묶는다.
          // 편집기 UI를 수정해도 변환기 캐시를 재사용하고 큰 단일 청크를 피한다.
          groups: [{
            name: 'editor-markdown',
            test: /node_modules[\\/]prosemirror-markdown[\\/]/,
          }],
        },
      },
    },
  },
})

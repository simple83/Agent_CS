import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

// 빌드 결과를 제외한 TS/TSX에 기본 오류·타입·Hook·빠른 새로고침 규칙을 적용한다.
// mjs 테스트/패키징 스크립트의 실행 검증은 package.json의 test:* 명령으로 별도 수행한다.
export default defineConfig([
  globalIgnores(['dist', 'dist-mock']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
  },
])

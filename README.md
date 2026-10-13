# Agent CS

홍익대학교 컴퓨터공학과 SNS 프론트엔드입니다.

백엔드 없이 실행하려면 `npm run dev:mock`을 사용하세요. 테스트 계정, Mock/Real 전환, 빌드 및 검증 방법은 [MOCK_GUIDE.md](./MOCK_GUIDE.md)에 정리되어 있습니다.

```sh
npm install
npm run dev:mock
```

실제 API 연결: `npm run dev:real` (`.env.real.local`에 백엔드 주소 설정 필요)

API 검사: `npm run test:api`

게시글 Hook 상태 전환 검사: `npm run test:hooks` (백엔드 없이 최초 조회, 검색·새로고침, 요청 간 응답 순서 검증)

## Vite 템플릿 참고

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

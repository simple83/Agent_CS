# Agent CS

홍익대학교 컴퓨터공학과 SNS 프론트엔드입니다.

백엔드 없이 실행하려면 `npm run dev:mock`을 사용하세요. 테스트 계정, Mock/Real 전환, 빌드 및 검증 방법은 [MOCK_GUIDE.md](./MOCK_GUIDE.md)에 정리되어 있습니다.

```sh
npm install
npm run dev:mock
```

실제 API 연결: `npm run dev:real` (`.env.real.local`에 백엔드 주소 설정 필요)

API 검사: `npm run test:api`

좋아요는 게시글 상세에서만 등록·취소할 수 있습니다. 카드와 목록에는 개수만 표시합니다. 관련 상태/화면 회귀 검사는 `npm run test:likes`로 실행합니다.

게시글 Hook 상태 전환 검사: `npm run test:hooks` (백엔드 없이 최초 조회, 검색·새로고침, 요청 간 응답 순서 검증)

## Vite 템플릿 참고

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## 게시글 작성과 말머리

- 디시인사이드의 말머리 → 제목 → 편집 도구 → 본문 순서를 참고한 작성 화면입니다.
- 목록은 제목 중심의 표 형태이며, 말머리 필터와 제목/주제 태그 검색을 함께 사용할 수 있습니다.
- 말머리: 자유, 질문, 코드리뷰, 정보공유, 모집, 밥친구. 선택한 말머리는 기존 `hashtags`의 대표 태그 하나로 저장합니다. 새 category API 필드는 추가하지 않습니다.
- 기존 글은 질문 → 코드리뷰 → 정보공유 → 모집 → 밥친구 순서에서 처음 일치하는 태그로 분류하고, 없으면 자유로 표시합니다. 자유 태그 유무와 관계없이 같은 기준을 적용합니다.
- API의 제목/태그 검색 결과에 말머리 필터를 클라이언트에서 적용합니다. 현재 전체 배열 응답 기준이며, 서버 페이지네이션 도입 시 말머리 필터도 서버 계약과 함께 변경해야 합니다.
- 목록의 글쓰기 버튼은 선택한 말머리를 작성 화면에 전달합니다. 말머리는 URL에 남아 새로고침/뒤로가기에 유지됩니다.
- Tiptap 시각적 편집기에서 서식이 적용된 본문을 직접 작성합니다. 작성/미리보기 탭은 없으며 굵게, 기울임, 인라인 코드, 링크, 목록, 번호 목록, 인용, 실행 취소/다시 실행을 지원합니다.
- 코드블록 버튼으로 현재 문단을 코드로 바꾸고 본문 안에서 바로 입력합니다. 각 코드블록 상단 바의 오른쪽에서 해당 블록의 언어를 선택합니다. 설명을 이어 쓸 때는 ‘코드 아래에 문단 추가’를 사용합니다.
- 코드 하이라이트는 선택한 언어를 사용하며 자동 감지는 하지 않습니다. 상세 화면에서는 코드별 언어 표시와 복사를 지원합니다.
- 본문 API는 기존 Markdown 문자열을 그대로 사용합니다. 읽기는 Tiptap Markdown 확장, 저장은 ProseMirror 직렬화기를 사용하며 코드 안의 백틱과 공백을 별도 규칙으로 보존합니다. HTML/편집기 JSON을 서버에 저장하지 않습니다.
- 이미지 첨부는 기존 API 방식으로 유지합니다. 파일 추가/개별 제거는 가능하지만 본문 중간 삽입과 위치 저장은 백엔드 계약 확정 전까지 보류합니다.
- 등록 실패 시 현재 입력/첨부가 유지됩니다. 브라우저를 닫거나 다른 페이지로 이동한 뒤 복구하는 임시 저장은 아직 지원하지 않습니다.

편집 기능 회귀 검증: `npm run test:editor` (말머리, 시각적 문서의 Markdown 저장/복원, 코드 공백·백틱, 언어 변경·실행 취소, 안전한 HTML 처리, 등록 실패와 재시도).

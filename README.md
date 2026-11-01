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

## 내 게시글 수정·삭제

- 상세 화면 오른쪽 위의 수정·삭제 버튼은 현재 로그인한 작성자에게만 보입니다. 최종 권한 검사는 Mock/실제 서버 API가 담당합니다.
- `/posts/:postId/edit`에서 원본을 조회한 뒤 기존 작성 폼과 시각적 편집기를 재사용합니다. 새로고침과 직접 진입을 지원하고, 비로그인·타인 게시글은 편집을 막습니다.
- 저장 실패 시 현재 입력을 보존하고 요청 중에는 중복 저장을 막습니다. 성공하면 상세로 돌아가며, 취소는 저장하지 않고 돌아갑니다. 다른 화면으로 이동한 뒤의 임시 저장은 지원하지 않습니다.
- 수정하지 않은 태그는 PATCH에서 생략합니다. 말머리를 직접 변경하면 기존 말머리 태그들을 선택한 하나로 정리하고 나머지 주제 태그는 유지합니다.
- 수정 화면의 이미지는 읽기 전용입니다. 이미지 교체·삭제 규칙이 확정될 때까지 PATCH의 `images`를 생략해 기존 첨부를 유지합니다. 새 글의 이미지 첨부는 기존대로 동작합니다.
- 삭제는 확인창에서 확인한 뒤 요청합니다. 성공하면 목록으로 이동하고 실패하면 상세에 오류를 표시합니다. API는 소프트 삭제이며 복원 UI는 없습니다.
- 수정 화면도 기존 상세 조회 API를 사용하므로 진입 시 조회수가 증가할 수 있습니다. 조회수 집계 정책은 별도 작업으로 보류했습니다.

회귀 검사: `npm run test:management` (Mock 기반 수정·삭제, 직접 진입, 계정 변경, 원본 보존, 실패·중복 요청).

## 게시글 기능 파일 위치

화면을 수정할 때는 아래 역할별 폴더에서 시작합니다. 전용 CSS는 사용하는 컴포넌트 옆에 둡니다.

```text
src/features/post/
├─ components/
│  ├─ list/          # PostList, PostCard: 목록과 요약 카드
│  ├─ write/         # PostForm, PostEdit: 작성·수정 폼과 수정 권한 확인
│  │  └─ editor/     # PostEditor, CodeBlockEditor, Context, 편집기 설정·Markdown 변환
│  ├─ detail/        # PostDetail, PostLikeControl, PostOwnerActions: 상세·좋아요·작성자 도구
│  └─ content/       # PostContent와 작성·상세가 공유하는 본문·코드 스타일
├─ styles/           # PostLayout: 목록·작성 화면 공통 배치
├─ hooks/            # 조회·작성·수정·삭제·좋아요 상태와 처리 흐름
├─ services/         # Mock/Real API
├─ types/            # 게시글과 API 데이터 타입
├─ utils/            # 말머리·언어 목록 등 공통 보조 함수
└─ mocks/            # 예제 게시글 데이터
```

`PostCard`는 현재 표 형태의 목록에서는 사용하지 않는 재사용 카드입니다. 상세 본문의 복사 도구인 `CodeBlock`은 `PostContent.tsx` 내부에 유지합니다. 편집기 전용 `visualEditor.ts`와 `PostEditorContext.ts`는 `write/editor/`에서 함께 관리합니다.

## CSS 수정 기준

- `src/index.css`는 기본 글꼴·줄 높이·박스 계산만, `src/styles/tokens.css`는 공통 색상·글꼴과 다크 모드 변수를 관리합니다. 전역에서 제목·코드·입력 요소의 디자인을 지정하지 않습니다.
- 각 컴포넌트는 자신의 `*.module.css`를 직접 가져옵니다. 부모는 배치를 관리하고 자식의 모든 `button`, `label`, `select`를 일괄 선택하지 않습니다. 공용 입력·버튼은 `Controls.module.css`의 클래스를 해당 요소에 명시적으로 부여합니다.
- 작성과 상세의 문단·강조·목록·코드 표현은 `RichText.module.css`, 코드 상자와 조작 바는 `CodeBlock.module.css`를 공유합니다. 편집기 전용 크기·도구 모음·포커스는 `PostEditor.module.css`에 둡니다.
- `CodeSyntax.module.css`는 highlight.js GitHub Dark 테마를 로컬 루트 아래로 제한한 파일입니다. `hljs-*` 클래스 이름은 라이브러리 계약이므로 유지하고, 라이브러리 갱신 시 이 테마도 확인합니다. 외부 테마 CSS를 전역으로 중복 불러오지 않습니다.
- 스타일 검증에서는 목록→작성→상세 이동과 직접 진입, 편집기 단독 배치, 밝은·어두운 테마, 모바일 폭, 키보드 포커스를 확인합니다. CSS Modules는 이름 충돌을 줄이지만 상속이나 넓은 자식 선택자까지 차단하지는 않습니다.

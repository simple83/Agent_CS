# Mock / Real 실행 안내

두 버전을 별도 브랜치로 관리하지 않습니다. UI → Hook → `postApi`/`authApi` 흐름은 공통이고, 서비스 선택 파일이 Vite 환경변수로 구현을 선택합니다.

## 바로 실행

```sh
npm install
npm run dev:mock
```

터미널에 표시되는 주소를 열면 상단에 노란색 **MOCK 모드** 도구가 나타납니다. 백엔드 서버는 필요 없습니다.

| 계정 | 비밀번호 | 본인 글 |
| --- | --- | --- |
| `jinwoo99` | `mock1234` | 초기 게시글 1 |
| `dev_hero` | `mock1234` | 초기 게시글 2 |

1. 상단 **로그인** 링크에서 테스트 계정으로 로그인합니다. 현재 로그인 성공은 알림으로 표시됩니다.
2. **목록** 링크로 이동해 제목 `React` 또는 태그 `React`, `밥친구`를 검색합니다.
3. **코드블록 예제** 링크에서 TSX/C++ 코드가 있는 초기 게시글 2를 확인합니다.
4. **글쓰기** 링크에서 제목·본문·해시태그를 입력하고 등록합니다. 성공하면 생성된 글의 상세로 이동합니다.
5. 새로고침한 뒤에도 글·이미지·Mock 로그인 상태가 저장되어 있는지 확인합니다.
6. **다음 요청 실패시키기**를 누른 뒤 검색이나 글 등록을 시도합니다. 요청 1회만 실패하고 다시 시도하면 정상 동작합니다. 페이지 진입 시 자동 조회도 이 요청에 포함됩니다.
7. **Mock 로그아웃** 후 글 등록 시 인증 오류를 확인합니다.
8. **Mock 초기화**로 작성 글·좋아요·세션을 지우고 초기 예제로 돌아갑니다. 실제 모드 로그인 정보는 삭제하지 않습니다.

화면 자체의 목록 카드 → 상세 이동, 수정·삭제·좋아요 버튼 연결은 기존 미완성 상태입니다. 상단 도구는 Mock에서만 보이는 테스트용 이동 수단입니다. 수정·삭제·좋아요·refresh 서비스는 구현되어 있으며 `npm run test:api`로 검사합니다.

## 실행 명령과 모드

| 명령 | 모드 | 결과 |
| --- | --- | --- |
| `npm run dev:mock` | mock | Mock API로 개발 |
| `npm run dev:real` / `npm run dev` | real | 실제 fetch로 개발 |
| `npm run build:mock` | mock | TypeScript 검사 후 `dist-mock/` 생성 |
| `npm run preview:mock` | 빌드 결과 | `dist-mock/` 미리보기 |
| `npm run build` | production | TypeScript 검사 후 실제 API용 `dist/` 생성 |
| `npm run preview` | 빌드 결과 | `dist/` 미리보기 |
| `npm run test:api` | 테스트 | 백엔드 없이 Mock 동작과 Real 요청 구성 검사 |

모드별 파일은 `.env.mock`, `.env.real`, `.env.production`입니다. `VITE_USE_MOCK_API=true`일 때만 Mock을 선택합니다. Vite 환경변수는 실행·빌드 시 결정되므로 변경 후 개발 서버를 재시작하거나 다시 빌드해야 합니다. preview 명령으로 이미 빌드된 모드를 바꿀 수는 없습니다.

기존 `.env`는 수정하지 않았습니다. 모드별 파일의 값을 우선하여 이전 `localhost:5173` API 설정을 사용하지 않습니다. 셸에 이미 설정된 환경변수는 Vite 파일보다 우선하므로 의도하지 않은 전환이 있으면 셸의 `VITE_*` 설정도 확인하세요.

## 실제 백엔드 연결

`.env.real.local.example`을 `.env.real.local`로 복사하고 실제 주소로 바꿉니다. 예시의 8000 포트는 확정된 백엔드 주소가 아닙니다.

```env
VITE_API_BASE_URL=http://실제-백엔드-주소
```

그다음 `npm run dev:real`을 실행합니다. 주소가 없으면 API 호출 시 설정 안내가 표시됩니다. 운영 빌드는 `.env.production.local` 또는 빌드 환경에 주소를 설정합니다. `*.local` 파일은 Git에서 제외됩니다. 브라우저 코드에 들어가는 `VITE_*` 값에 비밀 키를 넣지 않습니다.

실제 백엔드가 준비되면 multipart `hashtags` 직렬화(JSON 문자열 사용 중), 이미지 교체 방식, 검색 규칙, 인증/CORS를 서버와 별도로 검증해야 합니다. Mock은 프론트 개발용 동작이며 서버의 정확한 동작을 입증하지 않습니다.

## 코드 위치

```text
src/features/auth/services/
  authApi.ts          # 구현 선택
  authApi.real.ts     # 실제 HTTP 요청
  authApi.mock.ts     # Mock 로그인·refresh·로그아웃
src/features/post/services/
  postApi.ts          # 구현 선택
  postApi.real.ts     # 실제 HTTP 요청
  postApi.mock.ts     # Mock 목록·검색·상세·작성·수정·삭제·좋아요
src/features/{auth,post}/types/*Api.types.ts  # 두 구현의 공통 인터페이스
src/features/post/mocks/mockPosts.ts       # 초기 게시글
src/shared/config/apiMode.ts               # 모드·URL
src/shared/services/authStorage.ts         # 모드별 인증 저장
src/shared/mocks/mockStore.ts              # Mock 계정·저장·지연·오류 재현
src/shared/mocks/MockToolbar.tsx            # Mock 테스트 도구
tests/api.test.mjs                         # 실제 서비스를 실행하는 자동 검사
```

API를 추가할 때 공통 인터페이스를 먼저 추가하고 Real/Mock 양쪽을 구현합니다. UI와 Hook에서 모드를 분기하지 않습니다.

## 저장·테스트 규칙

- localStorage의 `agent-cs:mock:*` 키에만 Mock 데이터를 저장합니다. 실제 인증의 기존 키는 유지합니다.
- 데이터는 같은 브라우저·같은 origin(호스트/포트)에서 유지됩니다. 개발 서버와 preview 포트가 다르면 저장 공간도 다릅니다. 여러 탭의 동시 쓰기를 조정하는 서버 수준의 동시성은 제공하지 않습니다.
- Mock 이미지: PNG/JPEG/GIF/WebP, 한 요청당 합계 1MB 이하. data URL로 저장하므로 새로고침해도 표시됩니다. 브라우저 저장 용량을 넘으면 오류가 표시되고 작은 이미지나 초기화를 안내합니다. 실제 업로드 제한과는 별개입니다.
- 기본 지연은 300ms입니다. `.env.mock.local`에서 `VITE_MOCK_DELAY_MS=1000`처럼 바꿀 수 있습니다(0~5000ms).
- 제목은 대소문자 무시 부분 일치, 태그는 `#` 제거 후 대소문자 무시 정확 일치로 처리합니다. 두 조건을 같이 적용할 수 있습니다.
- 상세 요청마다 조회수가 증가합니다. 현재 React StrictMode에서는 개발 중 최초 Effect가 다시 실행되어 조회가 두 번 발생할 수 있습니다. 기존 Hook 개선은 별도 작업입니다.
- 삭제는 soft delete, 수정·삭제는 작성자만 가능, 좋아요 중복 등록/미등록 취소는 오류입니다. 초기 좋아요·댓글 수는 예시 통계이며 댓글 데이터는 구현 범위에 포함하지 않습니다.
- Mock access token은 1시간, refresh token은 7일 유효합니다. refresh는 access token을 교체하고 refresh token은 유지합니다. 자동 refresh 연결은 기존 화면에 추가하지 않았습니다.
- 테스트는 Vite로 실제 TypeScript 모듈을 로드하고 메모리 저장소와 fetch 대역을 사용합니다. 실제 서버에 요청하지 않습니다.

Vite 공식 모드 안내: https://vite.dev/guide/env-and-mode

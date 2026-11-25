import { readFileSync } from 'node:fs';
const contract = JSON.parse(readFileSync(new URL('./fixtures/api-contract.json', import.meta.url), 'utf8'));
const detailFixture = contract['GET /posts/{post_id}'];
import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { createServer } from 'vite';

// Vite 모드 선택을 그대로 사용해 실제 TypeScript 서비스를 실행하되 백엔드 없이 검증한다.
/** 브라우저 localStorage 계약을 메모리 Map으로 흉내 내어 테스트끼리 저장 데이터가 섞이지 않게 한다. */
class MemoryStorage {
  values = new Map();
  /** 저장된 문자열 또는 미존재 시 null을 반환한다. */
  getItem(key) { return this.values.get(key) ?? null; }
  /** 실제 localStorage처럼 값을 문자열로 바꿔 저장한다. */
  setItem(key, value) { this.values.set(key, String(value)); }
  /** 지정한 키만 삭제한다. */
  removeItem(key) { this.values.delete(key); }
  /** 테스트 시작 전에 메모리 저장소 전체를 비운다. */
  clear() { this.values.clear(); }
}

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new MemoryStorage() });
const originalFetch = globalThis.fetch;
const servers = [];
// 교체한 전역 객체와 Vite 서버를 복구해 다음 테스트 프로세스에 영향을 남기지 않는다.
after(async () => {
  globalThis.fetch = originalFetch;
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else delete globalThis.localStorage;
  await Promise.all(servers.map((server) => server.close()));
});

/** 지정 모드로 서비스 모듈을 로드한다. 실제 주소는 테스트용 가짜 주소로 주입하며 지연은 제거한다. */
async function loadMode(mode, baseUrl) {
  const server = await createServer({
    configFile: false,
    mode,
    server: { middlewareMode: true, watch: null, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    define: {
      'import.meta.env.VITE_MOCK_DELAY_MS': JSON.stringify('0'),
      ...(baseUrl === undefined ? {} : { 'import.meta.env.VITE_API_BASE_URL': JSON.stringify(baseUrl) }),
    },
  });
  servers.push(server);
  const { postApi } = await server.ssrLoadModule('/src/features/post/services/postApi.ts');
  const { authApi } = await server.ssrLoadModule('/src/features/auth/services/authApi.ts');
  const { authStorage } = await server.ssrLoadModule('/src/shared/services/authStorage.ts');
  const store = await server.ssrLoadModule('/src/shared/mocks/mockStore.ts');
  return { postApi, authApi, authStorage, store };
}

const mock = await loadMode('mock');
const real = await loadMode('real', 'https://backend.example.test/api/');
const unconfiguredReal = await loadMode('real');
// Mock에서 fetch가 발생하면 즉시 실패시켜 실제 네트워크에 의존하는 코드가 섞이지 않게 한다.
beforeEach(() => {
  localStorage.clear();
  globalThis.fetch = () => { throw new Error('Unexpected network request'); };
});
/** 테스트 계정으로 세션을 만들고 앱과 동일한 저장 함수로 토큰을 보관한다. */
async function login(account_id = 'jinwoo99') {
  const response = await mock.authApi.login({ account_id, password: 'mock1234' });
  mock.authStorage.saveLogin(response);
  return response;
}

test('Mock은 네트워크 없이 예제 글·복합 검색·Markdown과 미존재 오류를 처리한다', async () => {
  assert.equal((await mock.postApi.getPosts()).length, 3);
  const posts = await mock.postApi.getPosts({ title: 'react', tag: 'React' });
  assert.equal(posts.length, 1);
  assert.ok((await mock.postApi.getPost(posts[0].id)).content.includes('```tsx'));
  assert.equal((await mock.postApi.getPosts({ title: 'no-such-title' })).length, 0);
  assert.equal((await mock.postApi.getPosts({ tag: '밥친구' })).length, 1);
  await assert.rejects(mock.postApi.getPost(999), /존재하지 않는/);
});

test('인증은 계정 확인·토큰 만료·갱신·로그아웃 후 무효화를 재현한다', async () => {
  await assert.rejects(mock.authApi.login({ account_id: 'jinwoo99', password: 'wrong' }), /비밀번호/);
  await assert.rejects(mock.postApi.createPost({ title: 'title', content: 'body' }), /로그인/);
  const session = await login();
  const database = mock.store.readMockDatabase();
  database.sessions[0].expires_at = 0;
  mock.store.saveMockDatabase(database);
  await assert.rejects(mock.postApi.createPost({ title: 'title', content: 'body' }), /만료/);
  const refreshed = await mock.authApi.refresh({ refresh_token: session.refresh_token });
  assert.equal(Object.hasOwn(refreshed, 'refresh_token'), false);
  assert.notEqual(refreshed.access_token, session.access_token);
  mock.authStorage.saveTokens(refreshed);
  assert.equal(mock.authStorage.getRefreshToken(), session.refresh_token);
  await mock.postApi.createPost({ title: 'title', content: 'body' });
  await mock.authApi.logout({ refresh_token: session.refresh_token });
  await assert.rejects(mock.postApi.createPost({ title: 'title', content: 'body' }), /로그인/);
  await assert.rejects(mock.authApi.refresh({ refresh_token: session.refresh_token }), /유효하지/);
});

test('작성한 Markdown·태그·이미지와 세션은 모듈 재로드 후에도 유지된다', async () => {
  await login();
  const content = '본문\n\n```cpp\nint main() {}\n```\n\n![사진](upload://photo)';
  const post = await mock.postApi.createPost({
    title: '새 글', content, hashtags: ['React', 'react', '자료구조'], image_ids: ['photo'],
    images: [new File([new Uint8Array([137, 80, 78, 71])], 'sample.png', { type: 'image/png' })],
  });
  assert.equal(post.author_id, 101);
  assert.ok(post.content.includes(post.images[0].image_url));
  assert.ok(!post.content.includes('upload://'));
  assert.deepEqual(post.hashtags.map((tag) => tag.name), ['react', '자료구조']);
  assert.ok(post.images[0].image_url.startsWith('data:image/png;base64,'));
  const reloaded = await loadMode('mock');
  const detail = await reloaded.postApi.getPost(post.id);
  assert.equal(detail.content, post.content);
  assert.equal(detail.images[0].image_url, post.images[0].image_url);
  assert.equal(detail.view_count, 1);
  assert.equal((await reloaded.postApi.getPost(post.id)).view_count, 2);
  const updated = await reloaded.postApi.updatePost(post.id, { title: '수정', hashtags: [], content: '사진 제거', keep_image_ids: [] });
  assert.equal(updated.content, '사진 제거');
  assert.deepEqual(updated.hashtags, []);
  assert.deepEqual(updated.images, []);
});

test('수정 소유권과 소프트 삭제는 API 계약을 따른다', async () => {
  await login();
  await assert.rejects(mock.postApi.updatePost(2, { title: 'bad' }), /본인이/);
  await assert.rejects(mock.postApi.deletePost(2), /본인이/);
  await mock.postApi.updatePost(1, { title: '내 글 수정' });
  await mock.postApi.deletePost(1);
  assert.equal((await mock.postApi.getPosts()).length, 2);
  await assert.rejects(mock.postApi.getPost(1), /존재하지 않는/);
  assert.equal(mock.store.readMockDatabase().posts.find((post) => post.id === 1).is_deleted, true);
  await login('dev_hero');
  await mock.postApi.updatePost(2, { title: '두 번째 계정 글 수정' });
});

test('좋아요는 저장되고 중복 등록을 거부하며 취소할 수 있다', async () => {
  assert.equal(await mock.postApi.getLikeStatus(2), null);
  await login();
  assert.equal(await mock.postApi.getLikeStatus(2), false);
  const before = (await mock.postApi.getPost(2)).like_count;
  await mock.postApi.likePost(2);
  assert.equal(await mock.postApi.getLikeStatus(2), true);
  const reloaded = await loadMode('mock');
  assert.equal(await reloaded.postApi.getLikeStatus(2), true);
  await assert.rejects(mock.postApi.likePost(2), /이미/);
  assert.equal((await mock.postApi.getPost(2)).like_count, before + 1);
  await mock.postApi.unlikePost(2);
  assert.equal(await mock.postApi.getLikeStatus(2), false);
  assert.equal((await mock.postApi.getPost(2)).like_count, before);
  await assert.rejects(mock.postApi.unlikePost(2), /좋아요하지/);
});

test('실제 좋아요 상태는 현재 사용자 목록 API로 읽고 잘못된 응답은 미등록으로 간주하지 않는다', async () => {
  assert.equal(await real.postApi.getLikeStatus(42), null);
  real.authStorage.saveLogin({ access_token: 'token', refresh_token: 'refresh', user_id: 7, account_id: 'user' });
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://backend.example.test/api/users/7/likes/posts');
    assert.equal(options.headers.Authorization, 'bearer token');
    return Response.json([{ id: 42 }]);
  };
  assert.equal(await real.postApi.getLikeStatus(42), true);
  assert.equal(await real.postApi.getLikeStatus(43), false);
  globalThis.fetch = async () => Response.json({ wrong: 'shape' });
  await assert.rejects(real.postApi.getLikeStatus(42), /응답 형식/);
  globalThis.fetch = async () => Response.json({ detail: '조회 실패' }, { status: 500 });
  await assert.rejects(real.postApi.getLikeStatus(42), /조회 실패/);
});

test('입력 검증과 일회성 실패는 DB를 유지하고 재시도를 허용한다', async () => {
  await login();
  await assert.rejects(mock.postApi.createPost({ title: ' ', content: 'body' }), /제목/);
  await assert.rejects(mock.postApi.createPost({ title: 'title', content: '![사진](upload://photo)', image_ids: ['photo'],
    images: [new File(['text'], 'text.txt', { type: 'text/plain' })] }), /이미지/);
  await assert.rejects(mock.postApi.createPost({ title: 'title', content: '![사진](upload://photo)', image_ids: ['photo'],
    images: [new File([new Uint8Array(1024 * 1024 + 1)], 'large.png', { type: 'image/png' })] }), /1MB/);
  mock.store.failNextMockRequest();
  await assert.rejects(mock.postApi.createPost({ title: 'retry', content: 'body' }), /테스트용/);
  assert.equal((await mock.postApi.getPosts()).length, 3);
  await mock.postApi.createPost({ title: 'retry', content: 'body' });
  assert.equal((await mock.postApi.getPosts()).length, 4);
});

test('Mock 초기화는 실제 인증 정보와 다른 저장소 키를 보존한다', async () => {
  real.authStorage.saveLogin({ access_token: 'real-access', refresh_token: 'real-refresh',
    user_id: 7, account_id: 'real-user', token_type: 'bearer' });
  localStorage.setItem('other-app-data', 'keep');
  await login();
  await mock.postApi.createPost({ title: 'new', content: 'body' });
  mock.store.failNextMockRequest();
  mock.store.resetMockData();
  assert.equal(mock.authStorage.getAccessToken(), null);
  assert.equal(real.authStorage.getAccessToken(), 'real-access');
  assert.equal(localStorage.getItem('other-app-data'), 'keep');
  assert.equal((await mock.postApi.getPosts()).length, 3);
});

test('실제 모드는 fetch·인코딩된 검색·bearer 인증·multipart 직렬화를 사용한다', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return Response.json(url.endsWith('/auth/login') ? contract['POST /auth/login']
      : options.method === 'GET' ? contract['GET /posts'] : { ...detailFixture, id: 42 });
  };
  real.authStorage.saveLogin({ access_token: 'real-token', refresh_token: 'real-refresh',
    user_id: 7, account_id: 'real-user', token_type: 'bearer' });
  await login(); // 실제 모드를 함께 로드해도 Mock 로그인은 fetch를 호출하지 않아야 한다.
  await real.postApi.getPosts({ title: 'a b', tag: 'C++' });
  assert.equal(calls[0].url, 'https://backend.example.test/api/posts?title=a+b&tag=C%2B%2B');
  const file = new File(['png'], 'photo.png', { type: 'image/png' });
  await real.postApi.createPost({ title: 'title', content: '![사진](upload://photo)', hashtags: ['React'], images: [file], image_ids: ['photo'] });
  assert.equal(calls[1].options.headers.Authorization, 'bearer real-token');
  assert.equal(calls[1].options.headers['Content-Type'], undefined);
  assert.deepEqual(calls[1].options.body.getAll('hashtags'), ['react']);
  assert.equal(calls[1].options.body.get('images').name, 'photo.png');
  await real.authApi.login({ account_id: 'real-user', password: 'example' });
  assert.equal(calls[2].url, 'https://backend.example.test/api/auth/login');
  assert.equal(calls[2].options.method, 'POST');
  globalThis.fetch = async () => Response.json({ detail: 'server error' }, { status: 401 });
  await assert.rejects(real.postApi.getPost(42), /server error/);
});

// 쉼표 입력부터 실제 multipart까지 연결해 서버가 한 필드로 해석할 배열 문자열을 보내지 않게 한다.
test('python,fastapi 입력은 개별 hashtags로 전송하고 이미지 배열도 반복 키와 순서를 유지한다', async () => {
  const editor = await servers[1].ssrLoadModule('/src/features/post/utils/postEditor.ts');
  real.authStorage.saveLogin({ access_token: 'token', refresh_token: 'refresh', user_id: 1, account_id: 'user' });
  const calls = [];
  globalThis.fetch = async (_url, options) => { calls.push(options.body); return Response.json(detailFixture); };
  const files = [new File(['one'], 'one.png'), new File(['two'], 'two.png')];
  await real.postApi.createPost({ title: '태그 검사', content: '![1](upload://one)\n\n![2](upload://two)',
    hashtags: editor.getPostTags('질문', 'python,fastapi'), images: files, image_ids: ['one', 'two'] });
  assert.deepEqual(calls[0].getAll('hashtags'), ['질문', 'python', 'fastapi']);
  assert.deepEqual(calls[0].getAll('image_ids'), ['one', 'two']);
  assert.deepEqual(calls[0].getAll('images').map((file) => file.name), ['one.png', 'two.png']);
  await real.postApi.updatePost(1, { hashtags: ['python', 'fastapi'], keep_image_ids: [10, 11] });
  assert.deepEqual(calls[1].getAll('hashtags'), ['python', 'fastapi']);
  assert.deepEqual(calls[1].getAll('keep_image_ids'), ['10', '11']);
  await real.postApi.updatePost(1, { hashtags: [], keep_image_ids: [] });
  assert.deepEqual(calls[2].getAll('hashtags'), ['[]']);
  assert.deepEqual(calls[2].getAll('keep_image_ids'), ['[]']);
  await real.postApi.updatePost(1, { title: '그대로' });
  assert.equal(calls[3].has('hashtags'), false);
  assert.equal(calls[3].has('keep_image_ids'), false);
});

test('상세·작성·수정 응답의 손상 이미지 문법을 첨부 목록으로 복원하고 다음 수정에서 ID를 유지한다', async () => {
  const url = 'https://example.test/photo.png?signature=a%2Bb';
  const payload = { ...detailFixture, content: `앞\n\n![사진](<${url})\n\n뒤`, images: [{ id: 10, image_url: url }] };
  real.authStorage.saveLogin({ access_token: 'token', refresh_token: 'refresh', user_id: 1, account_id: 'user' });
  const calls = [];
  globalThis.fetch = async (_url, options) => { calls.push(options); return Response.json(payload); };
  const expected = `앞\n\n![사진](<${url}>)\n\n뒤`;
  assert.equal((await real.postApi.getPost(payload.id)).content, expected);
  assert.equal((await real.postApi.createPost({ title: '제목', content: '본문' })).content, expected);
  assert.equal((await real.postApi.updatePost(payload.id, { content: expected, keep_image_ids: [10] })).content, expected);
  assert.equal(calls[2].body.get('content'), expected);
  assert.deepEqual(calls[2].body.getAll('keep_image_ids'), ['10']);
  assert.equal(payload.content.includes('>)'), false, '원본 응답 객체를 변경하지 않는다');
});

test('명세상 생략 가능한 게시글 배열은 빈 배열로 처리하고 null과 필수 본문 누락은 거부한다', async () => {
  globalThis.fetch = async () => Response.json({ ...detailFixture, hashtags: undefined, images: undefined });
  const result = await real.postApi.getPost(detailFixture.id);
  assert.deepEqual(result.hashtags, []);
  assert.deepEqual(result.images, []);
  for (const field of ['hashtags', 'images']) {
    globalThis.fetch = async () => Response.json({ ...detailFixture, [field]: null });
    await assert.rejects(real.postApi.getPost(detailFixture.id), /응답/);
  }
  globalThis.fetch = async () => Response.json({ ...detailFixture, content: undefined });
  await assert.rejects(real.postApi.getPost(detailFixture.id), /상세 응답/);
});

test('인증 응답의 기본 token_type을 적용하고 누락되거나 잘못된 토큰은 저장 전에 거부한다', async () => {
  const session = contract['POST /auth/login'];
  globalThis.fetch = async () => Response.json({ ...session, token_type: undefined });
  assert.equal((await real.authApi.login({ account_id: session.account_id, password: 'password' })).token_type, 'bearer');
  globalThis.fetch = async () => Response.json({ access_token: 'next' });
  assert.deepEqual(await real.authApi.refresh({ refresh_token: 'refresh' }), { access_token: 'next', token_type: 'bearer' });
  for (const patch of [{ access_token: null }, { refresh_token: '' }, { user_id: null }, { token_type: null }]) {
    globalThis.fetch = async () => Response.json({ ...session, ...patch });
    await assert.rejects(real.authApi.login({ account_id: session.account_id, password: 'password' }), /응답|토큰/);
  }
  assert.equal(real.authStorage.getAccessToken(), null);
});

test('마스킹 값·상대 경로·쿼리 포함 API 주소는 네트워크 요청 전에 거부한다', async () => {
  for (const url of ['•••••', '/api', 'https:api.example.test', 'https://api.example.test?x=1']) {
    const invalid = await loadMode('real', url);
    await assert.rejects(invalid.postApi.getPosts(), /VITE_API_BASE_URL/);
  }
});

test('실제 API 주소가 없으면 프론트 서버로 잘못 요청하지 않고 실패한다', async () => {
  await assert.rejects(unconfiguredReal.postApi.getPosts(), /실제 API 주소가 없습니다/);
  await assert.rejects(unconfiguredReal.authApi.login({ account_id: 'a', password: 'b' }), /실제 API 주소가 없습니다/);
});

test('실제 수정은 이미지 없는 multipart PATCH이고 삭제는 인증된 DELETE다', async () => {
  real.authStorage.saveLogin({ access_token: 'real-token', refresh_token: 'real-refresh',
    user_id: 7, account_id: 'real-user', token_type: 'bearer' });
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return Response.json(options.method === 'DELETE' ? { detail: '삭제 완료' } : { ...detailFixture, id: 42 });
  };
  await real.postApi.updatePost(42, { title: '수정 제목', content: '```cpp\nint n;\n```' });
  assert.equal(calls[0].url, 'https://backend.example.test/api/posts/42');
  assert.equal(calls[0].options.method, 'PATCH');
  assert.equal(calls[0].options.headers.Authorization, 'bearer real-token');
  assert.equal(calls[0].options.headers['Content-Type'], undefined);
  assert.equal(calls[0].options.body.get('title'), '수정 제목');
  assert.equal(calls[0].options.body.has('images'), false);
  assert.equal(calls[0].options.body.has('hashtags'), false);
  await real.postApi.updatePost(42, { hashtags: ['코드리뷰', 'C++'] });
  assert.deepEqual(calls[1].options.body.getAll('hashtags'), ['코드리뷰', 'c++']);
  assert.deepEqual(await real.postApi.deletePost(42), { detail: '삭제 완료' });
  assert.equal(calls[2].options.method, 'DELETE');
  assert.equal(calls[2].options.headers.Authorization, 'bearer real-token');
  globalThis.fetch = async () => Response.json({ detail: '본인 글만 변경할 수 있습니다.' }, { status: 403 });
  await assert.rejects(real.postApi.updatePost(42, { title: '실패' }), /본인 글/);
  await assert.rejects(real.postApi.deletePost(42), /본인 글/);
});


test('확정 문서의 목록·상세·생성·수정·좋아요 응답을 그대로 읽는다', async () => {
  real.authStorage.saveLogin({ access_token: 'token', refresh_token: 'refresh', user_id: 1, account_id: 'user' });
  const cases = [
    ['GET /posts', () => real.postApi.getPosts()],
    ['GET /posts/{post_id}', () => real.postApi.getPost(detailFixture.id)],
    ['POST /posts', () => real.postApi.createPost({ title: '제목', content: '본문' })],
    ['PATCH /posts/{post_id}', () => real.postApi.updatePost(detailFixture.id, { title: '수정' })],
    ['POST /posts/{post_id}/likes', () => real.postApi.likePost(contract['POST /posts/{post_id}/likes'].post_id)],
    ['DELETE /posts/{post_id}/likes', () => real.postApi.unlikePost(contract['DELETE /posts/{post_id}/likes'].post_id)],
  ];
  for (const [key, request] of cases) {
    globalThis.fetch = async () => Response.json(contract[key]);
    assert.deepEqual(await request(), contract[key], key);
  }
});

// 운영 서버의 닉네임 미설정 응답을 재현한다. 실제 서버에 글을 만들지 않고
// 목록·상세·저장 응답을 모두 검사해 HTTP 성공 뒤 파싱만 실패하는 회귀를 막는다.
test('닉네임이 null인 계정의 게시글 목록·상세·작성·수정 응답을 허용한다', async () => {
  real.authStorage.saveLogin({ access_token: 'token', refresh_token: 'refresh', user_id: 1, account_id: 'user' });
  const cases = [
    ['GET /posts', () => real.postApi.getPosts()],
    ['GET /posts/{post_id}', () => real.postApi.getPost(detailFixture.id)],
    ['POST /posts', () => real.postApi.createPost({ title: '제목', content: '본문' })],
    ['PATCH /posts/{post_id}', () => real.postApi.updatePost(detailFixture.id, { title: '수정' })],
  ];

  for (const [key, request] of cases) {
    const fixture = contract[key];
    const payload = Array.isArray(fixture)
      ? fixture.map((post) => ({ ...post, author_username: null }))
      : { ...fixture, author_username: null };
    let requestCount = 0;
    globalThis.fetch = async () => {
      requestCount += 1;
      return Response.json(payload, { status: key === 'POST /posts' ? 201 : 200 });
    };

    assert.deepEqual(await request(), payload, key);
    assert.equal(requestCount, 1, '정상 응답을 다시 요청하지 않아야 한다');
  }
});

// null 허용이 필수 필드 누락이나 잘못된 타입까지 무시하는 변경으로 확대되지 않도록 검사한다.
test('게시글 닉네임 필드 누락·잘못된 타입과 다른 필수정보 누락은 계속 거부한다', async () => {
  for (const invalid of [undefined, 123, {}, []]) {
    globalThis.fetch = async () => Response.json([{ ...contract['GET /posts'][0], author_username: invalid }]);
    await assert.rejects(real.postApi.getPosts(), /작성자 닉네임 응답/);
  }

  globalThis.fetch = async () => Response.json([{ ...contract['GET /posts'][0], author_username: null, title: undefined }]);
  await assert.rejects(real.postApi.getPosts(), /필수 정보/);
});

test('실제 refresh는 갱신 토큰을 보존하고 logout은 refresh JSON만 전송한다', async () => {
  const session = contract['POST /auth/login'];
  real.authStorage.saveLogin(session);
  globalThis.fetch = async (url, options) => {
    assert.equal(options.headers.Authorization, undefined);
    assert.deepEqual(JSON.parse(options.body), { refresh_token: session.refresh_token });
    return Response.json(contract[url.endsWith('/refresh') ? 'POST /auth/refresh' : 'POST /auth/logout']);
  };
  real.authStorage.saveTokens(await real.authApi.refresh({ refresh_token: session.refresh_token }));
  assert.equal(real.authStorage.getRefreshToken(), session.refresh_token);
  assert.equal(real.authStorage.getAccessToken(), contract['POST /auth/refresh'].access_token);
  assert.deepEqual(await real.authApi.logout({ refresh_token: session.refresh_token }), contract['POST /auth/logout']);
});

test('현재 토큰의 401만 만료 처리하며 이전 요청의 401은 새 로그인 정보를 보존한다', async () => {
  const session = { access_token: 'old-token', refresh_token: 'refresh', user_id: 1, account_id: 'user' };
  real.authStorage.saveLogin(session);
  let finish;
  globalThis.fetch = () => new Promise((resolve) => { finish = resolve; });
  const pending = real.postApi.likePost(1);
  real.authStorage.saveLogin({ ...session, access_token: 'new-token' });
  finish(Response.json({ detail: '만료' }, { status: 401 }));
  await assert.rejects(pending, /만료/);
  assert.equal(real.authStorage.getAccessToken(), 'new-token');
  globalThis.fetch = async () => Response.json({ detail: '만료' }, { status: 401 });
  await assert.rejects(real.postApi.likePost(1), /만료/);
  assert.equal(real.authStorage.getAccessToken(), null);
  assert.equal(real.authStorage.getRefreshToken(), 'refresh');
});

test('Mock 재로그인은 같은 사용자의 이전 세션만 무효화한다', async () => {
  const first = await login();
  const other = await login('dev_hero');
  await login();
  await assert.rejects(mock.authApi.refresh({ refresh_token: first.refresh_token }), /유효하지/);
  assert.ok((await mock.authApi.refresh({ refresh_token: other.refresh_token })).access_token);
  assert.equal(mock.store.readMockDatabase().sessions.length, 2);
});

test('Mock 페이지 크기·정렬·태그 검색은 확정 계약과 같고 목록에 상세 필드를 노출하지 않는다', async () => {
  const db = mock.store.readMockDatabase();
  db.posts = Array.from({ length: 25 }, (_, index) => ({ ...db.posts[0], id: index + 1, view_count: index,
    hashtags: [{ id: 1, name: index % 2 ? 'react' : 'reactjs' }] }));
  mock.store.saveMockDatabase(db);
  const first = await mock.postApi.getPosts({ sort: 'view_count' });
  const rest = await mock.postApi.getPosts({ sort: 'view_count', offset: 20 });
  assert.equal(first.length, 20); assert.equal(rest.length, 5);
  assert.equal(first[0].id, 25); assert.equal(rest[4].id, 1);
  assert.equal(Object.hasOwn(first[0], 'content'), false);
  assert.equal(Object.hasOwn(first[0], 'images'), false);
  assert.equal((await mock.postApi.getPosts({ tag: 'REACT' })).length, 12);
  assert.equal((await mock.postApi.getPosts({ tag: '#react' })).length, 0);
  for (const query of [{ limit: 0 }, { limit: 101 }, { offset: -1 }, { sort: 'unknown' }]) {
    await assert.rejects(mock.postApi.getPosts(query));
  }
});

test('이미지 참조와 파일 ID를 검증하고 수정의 생략·유지·삭제 규칙을 재현한다', async () => {
  await login();
  const file = new File(['png'], 'photo.png', { type: 'image/png' });
  const input = { title: '사진', content: '![첫째](upload://first) ![둘째](upload://second)',
    images: [file, file], image_ids: ['first', 'second'] };
  for (const invalid of [
    { ...input, image_ids: ['first', 'first'] }, { ...input, image_ids: ['first'] },
    { ...input, content: '사진 참조 없음' }, { ...input, image_ids: ['first', 'bad/id'] },
    { ...input, images: Array(11).fill(file), image_ids: Array.from({ length: 11 }, (_, i) => String(i)) },
  ]) await assert.rejects(mock.postApi.createPost(invalid));
  const post = await mock.postApi.createPost(input);
  assert.notEqual(post.images[0].image_url, post.images[1].image_url);
  const preserved = await mock.postApi.updatePost(post.id, { title: '제목만 변경' });
  assert.deepEqual(preserved.images, post.images);
  await assert.rejects(mock.postApi.updatePost(post.id, { keep_image_ids: [] }), /본문 참조/);
  await assert.rejects(mock.postApi.updatePost(post.id, { keep_image_ids: [9999] }), /해당 게시글/);
  await assert.rejects(mock.postApi.updatePost(post.id, { keep_image_ids: [post.images[0].id, post.images[0].id] }), /올바르지/);
  const changed = await mock.postApi.updatePost(post.id, { keep_image_ids: [post.images[1].id],
    content: `![둘째](<${post.images[1].image_url}>)` });
  assert.deepEqual(changed.images, [post.images[1]]);
  const removed = await mock.postApi.updatePost(post.id, { keep_image_ids: [], content: '사진 모두 제거' });
  assert.deepEqual(removed.images, []);
});

test('multipart 이미지 참조·유지 ID와 목록 페이지 옵션을 실제 요청에 직렬화한다', async () => {
  real.authStorage.saveLogin({ access_token: 'token', refresh_token: 'refresh', user_id: 1, account_id: 'user' });
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return Response.json(options.method === 'GET' ? [] : detailFixture);
  };
  await real.postApi.getPosts({ sort: 'view_count', limit: 30, offset: 60 });
  assert.ok(calls[0].url.endsWith('?sort=view_count&limit=30&offset=60'));
  const file = new File(['png'], 'photo.png', { type: 'image/png' });
  await real.postApi.updatePost(1, { content: '![새 사진](upload://new)', images: [file], image_ids: ['new'], keep_image_ids: [10] });
  assert.deepEqual(calls[1].options.body.getAll('image_ids'), ['new']);
  assert.deepEqual(calls[1].options.body.getAll('keep_image_ids'), ['10']);
  assert.equal(calls[1].options.body.getAll('images').length, 1);
  await real.postApi.updatePost(1, { content: '이미지 없음', keep_image_ids: [] });
  assert.equal(calls[2].options.body.get('keep_image_ids'), '[]');
});


test('이미지 파일을 읽는 사이 계정이 바뀌면 다른 사용자 명의로 저장하지 않는다', async () => {
  await login();
  let finish, started;
  const reading = new Promise((resolve) => { started = resolve; });
  const file = new File(['png'], 'photo.png', { type: 'image/png' });
  file.arrayBuffer = () => { started(); return new Promise((resolve) => { finish = resolve; }); };
  const pending = mock.postApi.createPost({ title: '기존 계정 초안', content: '![사진](upload://new)', images: [file], image_ids: ['new'] });
  await reading;
  await login('dev_hero');
  finish(new Uint8Array([1, 2, 3]).buffer);
  await assert.rejects(pending, /로그인 상태가 변경/);
  assert.equal(mock.store.readMockDatabase().posts.length, 3);
});


test('실제 회원가입은 확정 JSON과 201 응답을 사용하고 토큰·확인 비밀번호를 전송하지 않는다', async () => {
  const body = { account_id: 'testuser', password: '  securepassword  ' };
  real.authStorage.saveLogin({ access_token: 'keep-access', refresh_token: 'keep-refresh', user_id: 7, account_id: 'existing' });
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://backend.example.test/api/auth/signup');
    assert.equal(options.method, 'POST'); assert.equal(options.headers['Content-Type'], 'application/json');
    assert.equal(options.headers.Authorization, undefined);
    assert.deepEqual(JSON.parse(options.body), body);
    return Response.json(contract['POST /auth/signup'], { status: 201 });
  };
  assert.deepEqual(await real.authApi.signup({ ...body, password_confirmation: body.password }), contract['POST /auth/signup']);
  assert.equal(real.authStorage.getAccessToken(), 'keep-access');
  assert.equal(real.authStorage.getRefreshToken(), 'keep-refresh');
});

test('회원가입 제한과 중복·검증·서버 오류를 구분하며 검증 응답의 비밀번호를 노출하지 않는다', async () => {
  const valid = { account_id: 'testuser', password: 'securepassword' };
  for (const api of [real.authApi, mock.authApi]) {
    for (const account_id of ['abc', 'a'.repeat(31), 'Upper', 'with-dash', ' 공백 ', '한글아이디']) {
      await assert.rejects(api.signup({ ...valid, account_id }), /아이디/);
    }
    for (const password of ['short', '😀'.repeat(129)]) await assert.rejects(api.signup({ ...valid, password }), /8~128/);
  }
  for (const [status, message] of [[409, /이미 사용 중/], [422, /가입 조건/], [500, /회원가입에 실패/]]) {
    globalThis.fetch = async () => Response.json({ detail: [{ loc: ['body', 'password'], input: 'PRIVATE_PASSWORD' }] }, { status });
    await assert.rejects(real.authApi.signup(valid), (error) => error.status === status && message.test(error.message) && !error.message.includes('PRIVATE_PASSWORD'));
  }
  globalThis.fetch = async () => Response.json({ wrong: 'shape' }, { status: 201 });
  await assert.rejects(real.authApi.signup(valid), /가입 응답/);
  await assert.rejects(unconfiguredReal.authApi.signup(valid), /실제 API 주소가 없습니다/);
});

test('Mock 가입 계정은 새로고침 후 로그인·글·댓글 작성이 가능하고 비밀번호 원문은 저장하지 않는다', async () => {
  const credentials = { account_id: 'new_student', password: '😀'.repeat(128) };
  const before = mock.store.readMockDatabase();
  const registered = await mock.authApi.signup(credentials);
  assert.equal(mock.authStorage.getAccessToken(), null);
  assert.deepEqual(Object.keys(registered).sort(), ['account_id', 'created_at', 'user_id']);
  assert.deepEqual(mock.store.readMockDatabase().posts, before.posts);
  assert.equal(mock.store.readMockDatabase().sessions.length, 0);
  assert.equal(localStorage.getItem('agent-cs:mock:v1:database').includes(credentials.password), false);
  await assert.rejects(mock.authApi.signup(credentials), (error) => error.status === 409);
  await assert.rejects(mock.authApi.login({ ...credentials, password: 'wrongpassword' }), /비밀번호/);
  const reloaded = await loadMode('mock');
  const session = await reloaded.authApi.login(credentials);
  reloaded.authStorage.saveLogin(session);
  assert.equal(session.user_id, registered.user_id);
  assert.equal(reloaded.store.getActiveMockUserId(), registered.user_id);
  const post = await reloaded.postApi.createPost({ title: '새 가입자의 글', content: '본문' });
  assert.equal(post.author_id, registered.user_id);
  const { commentApi } = await servers.at(-1).ssrLoadModule('/src/features/comment/services/commentApi.ts');
  const comment = await commentApi.createComment(post.id, '새 가입자의 댓글');
  assert.equal(comment.user_id, registered.user_id);
  reloaded.store.resetMockData();
  await assert.rejects(reloaded.authApi.login(credentials), /비밀번호/);
});

test('같은 아이디의 동시 Mock 가입은 계정을 하나만 저장하며 예전 DB도 초기화 없이 확장한다', async () => {
  const old = mock.store.readMockDatabase(); delete old.users;
  localStorage.setItem('agent-cs:mock:v1:database', JSON.stringify(old));
  const credentials = { account_id: 'same_account', password: 'testpassword' };
  const results = await Promise.allSettled([mock.authApi.signup(credentials), mock.authApi.signup(credentials)]);
  assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal(results.find((item) => item.status === 'rejected').reason.status, 409);
  assert.equal(mock.store.readMockDatabase().users.length, 1);
  assert.deepEqual(mock.store.readMockDatabase().posts, old.posts);
});

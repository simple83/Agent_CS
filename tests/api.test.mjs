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
  const posts = await mock.postApi.getPosts({ title: 'react', tag: '#React' });
  assert.equal(posts.length, 1);
  assert.ok(posts[0].content.includes('```tsx'));
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
  assert.equal(refreshed.refresh_token, session.refresh_token);
  assert.notEqual(refreshed.access_token, session.access_token);
  mock.authStorage.saveTokens(refreshed);
  await mock.postApi.createPost({ title: 'title', content: 'body' });
  await mock.authApi.logout({ refresh_token: session.refresh_token });
  await assert.rejects(mock.postApi.createPost({ title: 'title', content: 'body' }), /로그인/);
  await assert.rejects(mock.authApi.refresh({ refresh_token: session.refresh_token }), /유효하지/);
});

test('작성한 Markdown·태그·이미지와 세션은 모듈 재로드 후에도 유지된다', async () => {
  await login();
  const content = '본문\n\n```cpp\nint main() {}\n```';
  const post = await mock.postApi.createPost({
    title: '새 글', content, hashtags: ['React', '#React', '자료구조'],
    images: [new File([new Uint8Array([137, 80, 78, 71])], 'sample.png', { type: 'image/png' })],
  });
  assert.equal(post.author_id, 101);
  assert.equal(post.content, content);
  assert.deepEqual(post.hashtags.map((tag) => tag.name), ['React', '자료구조']);
  assert.ok(post.image_urls[0].startsWith('data:image/png;base64,'));
  const reloaded = await loadMode('mock');
  const detail = await reloaded.postApi.getPost(post.id);
  assert.equal(detail.content, content);
  assert.equal(detail.image_urls[0], post.image_urls[0]);
  assert.equal(detail.view_count, 1);
  assert.equal((await reloaded.postApi.getPost(post.id)).view_count, 2);
  const updated = await reloaded.postApi.updatePost(post.id, { title: '수정', hashtags: [], images: [] });
  assert.equal(updated.content, content);
  assert.deepEqual(updated.hashtags, []);
  assert.deepEqual(updated.image_urls, []);
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
  await assert.rejects(mock.postApi.createPost({ title: ' ', content: 'body' }), /제목과 내용/);
  await assert.rejects(mock.postApi.createPost({ title: 'title', content: 'body',
    images: [new File(['text'], 'text.txt', { type: 'text/plain' })] }), /이미지/);
  await assert.rejects(mock.postApi.createPost({ title: 'title', content: 'body',
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
    return Response.json({ id: 42 });
  };
  real.authStorage.saveLogin({ access_token: 'real-token', refresh_token: 'real-refresh',
    user_id: 7, account_id: 'real-user', token_type: 'bearer' });
  await login(); // 실제 모드를 함께 로드해도 Mock 로그인은 fetch를 호출하지 않아야 한다.
  await real.postApi.getPosts({ title: 'a b', tag: 'C++' });
  assert.equal(calls[0].url, 'https://backend.example.test/api/posts?title=a+b&tag=C%2B%2B');
  const file = new File(['png'], 'photo.png', { type: 'image/png' });
  await real.postApi.createPost({ title: 'title', content: 'body', hashtags: ['React'], images: [file] });
  assert.equal(calls[1].options.headers.Authorization, 'bearer real-token');
  assert.equal(calls[1].options.headers['Content-Type'], undefined);
  assert.equal(calls[1].options.body.get('hashtags'), '["React"]');
  assert.equal(calls[1].options.body.get('images').name, 'photo.png');
  await real.authApi.login({ account_id: 'real-user', password: 'example' });
  assert.equal(calls[2].url, 'https://backend.example.test/api/auth/login');
  assert.equal(calls[2].options.method, 'POST');
  globalThis.fetch = async () => Response.json({ detail: 'server error' }, { status: 401 });
  await assert.rejects(real.postApi.getPost(42), /server error/);
});

test('실제 API 주소가 없으면 프론트 서버로 잘못 요청하지 않고 실패한다', async () => {
  await assert.rejects(unconfiguredReal.postApi.getPosts(), /실제 API 주소가 없습니다/);
  await assert.rejects(unconfiguredReal.authApi.login({ account_id: 'a', password: 'b' }), /실제 API 주소가 없습니다/);
});

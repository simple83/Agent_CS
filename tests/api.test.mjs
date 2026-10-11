import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { createServer } from 'vite';

// Run the actual TypeScript services with Vite's mode resolution, without a backend.
class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new MemoryStorage() });
const originalFetch = globalThis.fetch;
const servers = [];
after(async () => {
  globalThis.fetch = originalFetch;
  if (originalStorage) Object.defineProperty(globalThis, 'localStorage', originalStorage);
  else delete globalThis.localStorage;
  await Promise.all(servers.map((server) => server.close()));
});

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
beforeEach(() => {
  localStorage.clear();
  globalThis.fetch = () => { throw new Error('Unexpected network request'); };
});
async function login(account_id = 'jinwoo99') {
  const response = await mock.authApi.login({ account_id, password: 'mock1234' });
  mock.authStorage.saveLogin(response);
  return response;
}

test('mock mode serves seed data, combined filters, Markdown and missing-post errors without fetch', async () => {
  assert.equal((await mock.postApi.getPosts()).length, 3);
  const posts = await mock.postApi.getPosts({ title: 'react', tag: '#React' });
  assert.equal(posts.length, 1);
  assert.ok(posts[0].content.includes('```tsx'));
  assert.equal((await mock.postApi.getPosts({ title: 'no-such-title' })).length, 0);
  assert.equal((await mock.postApi.getPosts({ tag: '밥친구' })).length, 1);
  await assert.rejects(mock.postApi.getPost(999), /존재하지 않는/);
});

test('authentication validates credentials, expires access, refreshes and invalidates logout', async () => {
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

test('create persists Markdown, tags and images; fresh module load reads saved data and session', async () => {
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

test('ownership and soft deletion follow the API contract', async () => {
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

test('like state persists, rejects duplicates, and can be undone', async () => {
  await login();
  const before = (await mock.postApi.getPost(2)).like_count;
  await mock.postApi.likePost(2);
  await assert.rejects(mock.postApi.likePost(2), /이미/);
  assert.equal((await mock.postApi.getPost(2)).like_count, before + 1);
  await mock.postApi.unlikePost(2);
  assert.equal((await mock.postApi.getPost(2)).like_count, before);
  await assert.rejects(mock.postApi.unlikePost(2), /좋아요하지/);
});

test('input validation and one-shot failure leave data intact and allow retry', async () => {
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

test('mock reset preserves real credentials and unrelated storage', async () => {
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

test('real mode uses fetch, encoded queries, bearer auth and unchanged multipart serialization', async () => {
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return Response.json({ id: 42 });
  };
  real.authStorage.saveLogin({ access_token: 'real-token', refresh_token: 'real-refresh',
    user_id: 7, account_id: 'real-user', token_type: 'bearer' });
  await login(); // The selected Mock implementation must still avoid fetch.
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

test('real mode with no configured backend fails clearly without contacting the frontend', async () => {
  await assert.rejects(unconfiguredReal.postApi.getPosts(), /실제 API 주소가 없습니다/);
  await assert.rejects(unconfiguredReal.authApi.login({ account_id: 'a', password: 'b' }), /실제 API 주소가 없습니다/);
});

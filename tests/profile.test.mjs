import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { act, createElement } from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

// React 입력 이벤트와 실제 앱 라우트를 사용한다. 운영 서버에는 요청하지 않는다.
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/profile' });
for (const name of ['window', 'document', 'localStorage', 'HTMLElement', 'Node']) globalThis[name] = name === 'window' ? dom.window : dom.window[name];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const servers = [];
async function load(mode) {
  const server = await createServer({ configFile: false, mode,
    server: { middlewareMode: true, watch: null, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] },
    define: { 'import.meta.env.VITE_MOCK_DELAY_MS': '"0"', 'import.meta.env.VITE_API_BASE_URL': '"https://api.example.test"' } });
  servers.push(server);
  const module = (path) => server.ssrLoadModule(`/src/${path}`);
  return { module, ...(await module('features/profile/services/profileApi.ts')), ...(await module('features/auth/services/authApi.ts')),
    ...(await module('shared/services/authStorage.ts')), ...(await module('shared/mocks/mockStore.ts')) };
}
const mock = await load('mock');
const real = await load('real');
const { default: App } = await mock.module('App.tsx');
const { useProfileActions } = await mock.module('features/profile/hooks/useProfileActions.ts');
const originalApi = { ...mock.profileApi };
const originalWithdraw = mock.authApi.withdraw;
const originalFetch = globalThis.fetch;
const roots = new Set();

/** 실제 서비스로 로그인한 뒤 앱과 같은 저장 알림을 보낸다. */
const login = async (id = 'jinwoo99') => {
  const result = await mock.authApi.login({ account_id: id, password: 'mock1234' });
  await act(async () => mock.authStorage.saveLogin(result));
  return result;
};

async function mount(element = createElement(App)) {
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container); roots.add(root);
  await act(async () => root.render(element));
  return { container, async unmount() { await act(async () => root.unmount()); roots.delete(root); container.remove(); } };
}

async function waitFor(check) {
  const end = Date.now() + 5000;
  while (!check() && Date.now() < end) await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
  assert.ok(check(), '화면이 준비되어야 한다.');
}

/** React가 실제 입력으로 인식하도록 네이티브 setter와 input 이벤트를 사용한다. */
async function input(container, name, value) {
  const field = container.querySelector(`[name="${name}"]`);
  const prototype = field.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  await act(async () => { Object.getOwnPropertyDescriptor(prototype, 'value').set.call(field, value); field.dispatchEvent(new window.Event('input', { bubbles: true })); });
}
const button = (container, label) => [...container.querySelectorAll('button')].find((node) => node.textContent === label);
const click = async (node) => act(async () => node.click());
const submit = async (container, label) => act(async () => container.querySelector(`form[aria-label="${label}"]`).dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })));

afterEach(async () => {
  await act(async () => { for (const root of roots) root.unmount(); });
  roots.clear(); document.body.replaceChildren(); localStorage.clear();
  Object.assign(mock.profileApi, originalApi); mock.authApi.withdraw = originalWithdraw;
  globalThis.fetch = originalFetch;
  window.history.replaceState(null, '', '/profile');
});
after(async () => { await Promise.all(servers.map((server) => server.close())); dom.window.close(); });

test('실제 프로필은 null을 허용하고 변경 필드만 multipart로 전송하며 응답 누락을 거부한다', async () => {
  const fixture = { id: 1, account_id: 'student', username: null, email: null, bio: null, profile_image_url: null,
    is_active: true, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' };
  real.authStorage.saveLogin({ access_token: 'token', refresh_token: 'refresh', user_id: 1, account_id: 'student' });
  let request;
  globalThis.fetch = async (url, options) => { request = { url, options }; return Response.json(fixture); };
  assert.deepEqual(await real.profileApi.getMe(), fixture);
  assert.equal(request.url, 'https://api.example.test/users/me');
  const file = new File(['png'], 'photo.png', { type: 'image/png' });
  await real.profileApi.updateMe({ username: '새 닉네임', profile_image: file });
  assert.equal(request.options.method, 'PATCH');
  assert.equal(request.options.headers.Authorization, 'bearer token');
  assert.equal(request.options.headers['Content-Type'], undefined);
  assert.deepEqual([...request.options.body.keys()], ['username', 'profile_image']);
  assert.equal(request.options.body.get('username'), '새 닉네임');
  const broken = { ...fixture }; delete broken.bio;
  globalThis.fetch = async () => Response.json(broken);
  await assert.rejects(real.profileApi.getMe(), /필수 정보/);
});

test('탈퇴는 DELETE와 비밀번호 JSON을 사용하고 비밀번호 불일치 시 세션을 지우지 않는다', async () => {
  real.authStorage.saveLogin({ access_token: 'token', refresh_token: 'refresh', user_id: 1, account_id: 'student' });
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.example.test/auth/withdraw'); assert.equal(options.method, 'DELETE');
    assert.equal(options.headers.Authorization, 'bearer token');
    assert.deepEqual(JSON.parse(options.body), { password: '  password  ' });
    return Response.json({ detail: 'password included in unsafe error' }, { status: 401 });
  };
  await assert.rejects(real.authApi.withdraw('  password  '), /비밀번호와 로그인/);
  assert.equal(real.authStorage.getAccessToken(), 'token');
  globalThis.fetch = async () => new Response(null, { status: 204 });
  await real.authApi.withdraw('  password  ');
});

test('Mock 프로필 저장은 기존 글·댓글의 작성자 정보를 갱신하며 다른 계정을 보존한다', async () => {
  await login();
  const before = mock.readMockDatabase();
  const saved = await mock.profileApi.updateMe({ username: '새 닉네임', email: 'test@example.com', bio: '<script>코드</script>',
    profile_image: new File(['png'], 'photo.png', { type: 'image/png' }) });
  assert.equal(saved.id, 101); assert.equal(saved.bio, '<script>코드</script>');
  assert.match(saved.profile_image_url, /^data:image\/png;base64,/);
  assert.deepEqual(await mock.profileApi.getMe(), saved);
  const after = mock.readMockDatabase();
  assert.equal(after.posts[0].author_username, '새 닉네임');
  assert.equal(after.comments.find((comment) => comment.user_id === 101).username, '새 닉네임');
  assert.deepEqual(after.posts.filter((post) => post.author_id !== 101), before.posts.filter((post) => post.author_id !== 101));
  assert.equal(after.sessions.length, before.sessions.length);
  await assert.rejects(mock.profileApi.updateMe({ email: 'bad' }), /이메일/);
  await assert.rejects(mock.profileApi.updateMe({ profile_image: new File(['svg'], 'a.svg', { type: 'image/svg+xml' }) }), /JPG/);
  await login('dev_hero');
  await assert.rejects(mock.profileApi.updateMe({ email: 'test@example.com' }), /사용 중/);
});

test('Mock 탈퇴는 비밀번호 확인 후 해당 사용자 세션만 없애고 재로그인·갱신을 차단한다', async () => {
  const other = await login('dev_hero');
  const current = await login();
  const before = mock.readMockDatabase();
  await assert.rejects(mock.authApi.withdraw('wrong'), /비밀번호/);
  assert.deepEqual(mock.readMockDatabase(), before);
  await mock.authApi.withdraw('mock1234');
  const after = mock.readMockDatabase();
  assert.equal(after.profiles[101].is_active, false);
  assert.equal(after.sessions.some((session) => session.user_id === 101), false);
  assert.ok(after.sessions.some((session) => session.refresh_token === other.refresh_token));
  assert.deepEqual(after.posts, before.posts); assert.deepEqual(after.comments, before.comments);
  await assert.rejects(mock.authApi.login({ account_id: 'jinwoo99', password: 'mock1234' }));
  await assert.rejects(mock.authApi.refresh({ refresh_token: current.refresh_token }));
  await assert.rejects(mock.profileApi.getMe());
});

test('직접 가입한 Mock 계정도 해시로 비밀번호를 확인해 탈퇴하고 이전 데이터는 보존한다', async () => {
  await mock.authApi.signup({ account_id: 'new_profile', password: '  pass1234  ' });
  mock.authStorage.saveLogin(await mock.authApi.login({ account_id: 'new_profile', password: '  pass1234  ' }));
  const profile = await mock.profileApi.getMe();
  assert.equal(profile.email, null);
  await assert.rejects(mock.authApi.withdraw('pass1234'), /비밀번호/);
  await mock.authApi.withdraw('  pass1234  ');
  await assert.rejects(mock.authApi.login({ account_id: 'new_profile', password: '  pass1234  ' }));
  assert.ok(mock.readMockDatabase().posts.length);
  assert.equal(JSON.stringify(mock.readMockDatabase()).includes('  pass1234  '), false);
});

test('사진 선택 미리보기·선택 취소·저장 후 복원과 잘못된 파일 차단을 제공한다', async () => {
  await login();
  const { container } = await mount();
  await waitFor(() => container.querySelector('input[type=file]'));
  const field = container.querySelector('input[type=file]');
  const choose = async (file) => {
    Object.defineProperty(field, 'files', { configurable: true, value: [file] });
    await act(async () => field.dispatchEvent(new window.Event('change', { bubbles: true })));
  };
  await choose(new File(['png'], 'photo.png', { type: 'image/png' }));
  assert.match(container.querySelector('img').getAttribute('src'), /^blob:/);
  await click(button(container, '사진 선택 취소'));
  assert.equal(container.querySelector('img'), null);
  await choose(new File(['svg'], 'bad.svg', { type: 'image/svg+xml' }));
  assert.equal(container.querySelector('img'), null);
  assert.match(container.textContent, /JPG, PNG, GIF, WebP 파일/);
  await choose(new File(['new png'], 'photo.png', { type: 'image/png' }));
  await submit(container, '프로필 수정');
  await waitFor(() => container.textContent.includes('프로필을 저장했습니다'));
  assert.match(container.querySelector('img').getAttribute('src'), /^data:image\/png;/);
  assert.equal(button(container, '사진 선택 취소'), undefined);
});

test('늦게 도착한 이전 계정의 프로필 조회로 현재 계정 화면을 덮어쓰지 않는다', async () => {
  await login();
  const previous = await originalApi.getMe();
  let finish;
  mock.profileApi.getMe = () => mock.authStorage.getUserId() === 101 ? new Promise((resolve) => { finish = resolve; }) : originalApi.getMe();
  const { container } = await mount();
  await login('dev_hero');
  await waitFor(() => container.querySelector('[name=username]')?.value === '개발용사');
  await act(async () => finish(previous));
  assert.equal(container.querySelector('[name=username]').value, '개발용사');
});

test('내 프로필 직접 진입은 로그인으로 이동하고 성공 후 프로필을 표시한다', async () => {
  const { container } = await mount();
  assert.equal(window.location.pathname, '/login');
  const fields = container.querySelectorAll('input');
  for (const [index, value] of [[0, 'jinwoo99'], [1, 'mock1234']]) {
    await act(async () => { Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(fields[index], value); fields[index].dispatchEvent(new window.Event('input', { bubbles: true })); });
  }
  await act(async () => container.querySelector('form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true })));
  await waitFor(() => container.querySelector('[name=username]'));
  assert.equal(window.location.pathname, '/profile');
  assert.equal(container.querySelector('[name=username]').value, '진우');
  assert.ok(container.querySelector('a[href="/profile"]'));
});

test('프로필 조회 실패 재시도와 저장 실패 초안 보존·성공·계정 전환을 처리한다', async () => {
  await login(); mock.failNextMockRequest();
  const { container } = await mount();
  await waitFor(() => button(container, '프로필 다시 불러오기'));
  assert.equal(container.querySelector('[name=username]'), null);
  await click(button(container, '프로필 다시 불러오기'));
  await waitFor(() => container.querySelector('[name=username]'));
  await input(container, 'username', '수정 닉네임'); await input(container, 'bio', '<b>소개</b>');
  mock.failNextMockRequest(); await submit(container, '프로필 수정');
  await waitFor(() => container.textContent.includes('테스트용'));
  assert.equal(container.querySelector('[name=username]').value, '수정 닉네임');
  await submit(container, '프로필 수정');
  await waitFor(() => container.textContent.includes('프로필을 저장했습니다'));
  assert.equal((await mock.profileApi.getMe()).username, '수정 닉네임');
  assert.equal(container.querySelector('b'), null);
  await login('dev_hero');
  await waitFor(() => container.querySelector('[name=username]')?.value === '개발용사');
  assert.equal(container.querySelector('[name=bio]').value, '');
});

test('탈퇴 확인은 취소 가능하며 실패 시 로그인 유지, 성공 후 세션 정리와 완료 안내를 표시한다', async () => {
  await login();
  const { container } = await mount();
  await waitFor(() => button(container, '회원 탈퇴 진행'));
  await click(button(container, '회원 탈퇴 진행'));
  assert.ok(button(container, '회원 탈퇴 확정').disabled);
  await input(container, 'withdraw_password', 'wrong');
  await click(container.querySelector('input[type=checkbox]'));
  await submit(container, '회원 탈퇴 확인');
  await waitFor(() => container.textContent.includes('비밀번호를 확인'));
  assert.ok(mock.authStorage.getAccessToken());
  assert.equal(container.querySelector('[name=withdraw_password]').value, '');
  await click(button(container, '취소'));
  assert.equal(container.querySelector('[name=withdraw_password]'), null);
  await click(button(container, '회원 탈퇴 진행'));
  await input(container, 'withdraw_password', 'mock1234');
  await click(container.querySelector('input[type=checkbox]'));
  await submit(container, '회원 탈퇴 확인');
  await waitFor(() => window.location.pathname === '/login');
  assert.equal(mock.authStorage.getAccessToken(), null);
  assert.equal(mock.authStorage.getRefreshToken(), null);
  assert.match(container.textContent, /회원 탈퇴가 완료/);
});

test('탈퇴 중복 요청과 저장을 차단하며 늦은 성공으로 새 로그인 세션을 지우지 않는다', async () => {
  await login();
  let hook, finish, calls = 0, moved = false;
  const token = mock.authStorage.getAccessToken();
  function Probe() { hook = useProfileActions(token, () => { moved = true; }); return null; }
  const mounted = await mount(createElement(Probe));
  mock.authApi.withdraw = () => { calls++; return new Promise((resolve) => { finish = resolve; }); };
  let pending;
  await act(async () => { pending = hook.withdraw('secret'); assert.equal(await hook.withdraw('secret'), false); assert.equal(await hook.save({ username: 'wrong' }), null); });
  assert.equal(calls, 1);
  await login('dev_hero');
  const next = mock.authStorage.getAccessToken();
  await mounted.unmount();
  await act(async () => { finish(); await pending; });
  assert.equal(mock.authStorage.getAccessToken(), next); assert.equal(moved, false);
});

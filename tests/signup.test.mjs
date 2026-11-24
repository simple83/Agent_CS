import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { act, createElement } from 'react';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

// 입력 이벤트를 실제 React onChange로 처리하도록 DOM을 만든 뒤 react-dom을 불러온다.
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/login' });
for (const name of ['window', 'document', 'localStorage', 'HTMLElement', 'Node']) {
  globalThis[name] = name === 'window' ? dom.window : dom.window[name];
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const server = await createServer({ configFile: false, mode: 'mock',
  server: { middlewareMode: true, watch: null, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] },
  define: { 'import.meta.env.VITE_MOCK_DELAY_MS': '"0"' },
});
const { default: App } = await server.ssrLoadModule('/src/App.tsx');
const { useSignup } = await server.ssrLoadModule('/src/features/auth/hooks/useSignup.ts');
const { authApi } = await server.ssrLoadModule('/src/features/auth/services/authApi.ts');
const { authStorage } = await server.ssrLoadModule('/src/shared/services/authStorage.ts');
const originalSignup = authApi.signup;
const roots = new Set();

/** 앱의 실제 라우트를 마운트하거나 Hook 관찰용 컴포넌트를 실행한다. */
async function mount(element = createElement(App)) {
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container); roots.add(root);
  await act(async () => root.render(element));
  return { container, async unmount() { await act(async () => root.unmount()); roots.delete(root); container.remove(); } };
}

/** React가 관리하는 입력값을 브라우저 사용자 입력과 같은 이벤트로 변경한다. */
async function input(container, selector, value) {
  const field = container.querySelector(selector);
  assert.ok(field, selector);
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(field, value);
    field.dispatchEvent(new window.Event('input', { bubbles: true }));
  });
}

/** 지연된 Mock 응답과 React 후속 렌더링을 기다리고 제한 시간에 실패시킨다. */
async function waitFor(check) {
  const deadline = Date.now() + 5000;
  while (!check() && Date.now() < deadline) await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
  assert.ok(check(), '화면이 준비되어야 한다.');
}

/** 사용자 제출과 같은 form 이벤트를 보낸다. 검증 실패 때도 폼이 이동하지 않아야 한다. */
const submit = async (container) => act(async () => container.querySelector('form').dispatchEvent(
  new window.Event('submit', { bubbles: true, cancelable: true })));

afterEach(async () => {
  await act(async () => { for (const root of roots) root.unmount(); });
  roots.clear(); document.body.replaceChildren(); localStorage.clear(); authApi.signup = originalSignup;
  window.history.replaceState(null, '', '/login');
});
after(async () => { await server.close(); dom.window.close(); });

test('로그인→회원가입→완료→로그인→게시판을 실제 화면과 Mock으로 연결한다', async () => {
  const { container } = await mount();
  await act(async () => container.querySelector('a[href="/signup"]').click());
  assert.equal(window.location.pathname, '/signup');
  await input(container, '[name=account_id]', 'new_student');
  // 공백을 포함한 비밀번호를 변형하지 않고 가입·로그인에 같은 값으로 전송한다.
  const password = '  pass1234  ';
  await input(container, '[name=password]', password);
  await input(container, '[name=password_confirmation]', password);
  await submit(container);
  await waitFor(() => container.textContent.includes('회원가입 완료'));
  assert.equal(container.querySelector('input[type=password]'), null);
  assert.equal(authStorage.getAccessToken(), null);
  assert.equal(authStorage.getRefreshToken(), null);
  await act(async () => [...container.querySelectorAll('a')].find((node) => node.textContent === '로그인하러 가기').click());
  await input(container, '[aria-label="아이디"]', 'new_student');
  await input(container, '[aria-label="비밀번호"]', password);
  await submit(container);
  await waitFor(() => window.location.pathname === '/posts' && container.textContent.includes('로그아웃'));
  assert.ok(authStorage.getAccessToken());
});

test('직접 가입 페이지 진입과 입력 오류·확인 불일치를 처리하며 서버 요청을 보내지 않는다', async () => {
  window.history.replaceState(null, '', '/signup');
  const { container } = await mount();
  authApi.signup = async () => assert.fail('잘못된 입력은 API를 호출하지 않는다.');
  await input(container, '[name=account_id]', 'Bad');
  await submit(container);
  assert.match(container.querySelector('[role=alert]').textContent, /아이디/);
  await input(container, '[name=account_id]', 'student');
  await input(container, '[name=password]', 'short');
  await submit(container);
  assert.match(container.querySelector('[role=alert]').textContent, /8~128/);
  await input(container, '[name=password]', 'password1');
  await input(container, '[name=password_confirmation]', 'password2');
  await submit(container);
  assert.match(container.querySelector('[role=alert]').textContent, /일치하지/);
});

test('중복 아이디 오류 후 입력을 보존하고 아이디를 바꿔 다시 가입한다', async () => {
  window.history.replaceState(null, '', '/signup');
  const { container } = await mount();
  await input(container, '[name=account_id]', 'jinwoo99');
  await input(container, '[name=password]', 'test12345');
  await input(container, '[name=password_confirmation]', 'test12345');
  await submit(container);
  await waitFor(() => container.querySelector('[role=alert]'));
  assert.match(container.querySelector('[role=alert]').textContent, /이미 사용 중/);
  assert.equal(container.querySelector('[name=password]').value, 'test12345');
  await input(container, '[name=account_id]', 'available_id');
  await submit(container);
  await waitFor(() => container.textContent.includes('회원가입 완료'));
});

test('연속 제출은 한 번만 처리하고 성공 후에는 재가입을 막으며 늦은 응답은 화면을 갱신하지 않는다', async () => {
  let hook, finish, calls = 0;
  function Probe() { hook = useSignup(); return null; }
  const mounted = await mount(createElement(Probe));
  authApi.signup = () => { calls++; return new Promise((resolve) => { finish = resolve; }); };
  const request = { account_id: 'student', password: 'pass1234' };
  let pending;
  await act(async () => { pending = hook.submit(request, request.password); assert.equal(await hook.submit(request, request.password), false); });
  assert.equal(calls, 1); assert.equal(hook.isLoading, true);
  await act(async () => { finish({ user_id: 999, account_id: 'student', created_at: '2026-11-25' }); await pending; });
  await act(async () => { assert.equal(await hook.submit(request, request.password), false); });
  assert.equal(calls, 1);
  await mounted.unmount();
  const second = await mount(createElement(Probe));
  await act(async () => { pending = hook.submit(request, request.password); });
  await second.unmount();
  await act(async () => { finish({ user_id: 1000, account_id: 'student', created_at: '2026-11-25' }); assert.equal(await pending, false); });
  assert.equal(hook.registered, null);
});

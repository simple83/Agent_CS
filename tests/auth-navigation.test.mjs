import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

// 브라우저 저장소와 실제 메뉴를 연결하고 API 완료 시점만 제어한다.
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.localStorage = dom.window.localStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const server = await createServer({ configFile: false, mode: 'mock',
  server: { middlewareMode: true, watch: null, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] } });
const { AppNavigation } = await server.ssrLoadModule('/src/features/auth/components/AppNavigation.tsx');
const { authStorage } = await server.ssrLoadModule('/src/shared/services/authStorage.ts');
const { authApi } = await server.ssrLoadModule('/src/features/auth/services/authApi.ts');
const { readMockDatabase, saveMockDatabase } = await server.ssrLoadModule('/src/shared/mocks/mockStore.ts');
const originalLogout = authApi.logout;
const roots = [];
const session = { access_token: 'test-access', refresh_token: 'test-refresh', user_id: 101, account_id: 'test' };

// 화면 테스트에서도 토큰 문자열과 대응되는 Mock 세션을 함께 준비한다.
beforeEach(() => {
  const database = readMockDatabase();
  database.sessions = [{ ...session, expires_at: Date.now() + 3600000, refresh_expires_at: Date.now() + 86400000 }];
  saveMockDatabase(database);
});

/** 이동 결과를 DOM에서 검사한다. API 성공 전에 경로가 바뀌지 않는지도 확인할 수 있다. */
function LocationProbe() {
  return createElement('output', null, useLocation().pathname);
}

/** 상단 메뉴를 실제 라우터 아래에 마운트한다. 저장된 세션은 새 마운트에서도 그대로 읽는다. */
async function mountNavigation() {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => root.render(createElement(MemoryRouter, { initialEntries: ['/posts'] },
    createElement(AppNavigation), createElement(LocationProbe))));
  return container;
}

afterEach(async () => {
  await act(async () => { for (const root of roots) root.unmount(); });
  roots.length = 0;
  document.body.replaceChildren();
  localStorage.clear();
  authApi.logout = originalLogout;
});

after(async () => { await server.close(); dom.window.close(); });

test('같은 탭의 로그인/삭제를 즉시 반영하고 새 마운트에서도 로그인 상태를 복원한다', async () => {
  const container = await mountNavigation();
  assert.equal(container.querySelector('a[href="/login"]').textContent, '로그인');
  await act(async () => authStorage.saveLogin(session));
  assert.equal(container.querySelector('button').textContent, '로그아웃');
  assert.equal(container.querySelector('a[href="/login"]'), null);
  const restored = await mountNavigation();
  assert.equal(restored.querySelector('button').textContent, '로그아웃');
  await act(async () => authStorage.clear());
  assert.equal(container.querySelector('button'), null);
  assert.equal(restored.querySelector('button'), null);
});

test('다른 모드의 저장 변경은 무시하고 현재 모드의 다른 탭 로그아웃을 반영한다', async () => {
  authStorage.saveLogin(session);
  const container = await mountNavigation();
  await act(async () => window.dispatchEvent(new window.StorageEvent('storage', {
    key: 'access_token', storageArea: localStorage,
  })));
  assert.equal(container.querySelector('button').textContent, '로그아웃');
  await act(async () => {
    localStorage.removeItem('agent-cs:mock:auth:access_token');
    window.dispatchEvent(new window.StorageEvent('storage', {
      key: 'agent-cs:mock:auth:access_token', storageArea: localStorage,
    }));
  });
  assert.equal(container.querySelector('button'), null);
  assert.ok(container.querySelector('a[href="/login"]'));
});

test('빈 값과 null/undefined 문자열은 게시판 첫 진입에서 로그인으로 표시한다', async () => {
  for (const token of ['', '   ', 'null', 'undefined']) {
    localStorage.setItem('agent-cs:mock:auth:access_token', token);
    const container = await mountNavigation();
    assert.ok(container.querySelector('a[href="/login"]'));
    assert.equal(container.querySelector('button'), null);
  }
});

test('알림 없이 토큰이 삭제되어도 게시판 이동과 탭 복귀 때 로그인 표시로 갱신한다', async () => {
  authStorage.saveLogin(session);
  const container = await mountNavigation();
  await act(async () => container.querySelector('a[href="/posts/create"]').click());
  localStorage.removeItem('agent-cs:mock:auth:access_token');
  await act(async () => container.querySelector('a[href="/posts"]').click());
  assert.equal(container.querySelector('output').textContent, '/posts');
  assert.ok(container.querySelector('a[href="/login"]'));

  await act(async () => authStorage.saveLogin(session));
  localStorage.removeItem('agent-cs:mock:auth:access_token');
  await act(async () => window.dispatchEvent(new window.Event('focus')));
  assert.ok(container.querySelector('a[href="/login"]'));
  assert.equal(container.querySelector('button'), null);
});

test('표시 후 액세스 토큰이 사라지면 남은 갱신 토큰으로 세션을 종료하고 로그인으로 이동한다', async () => {
  authStorage.saveLogin(session);
  const container = await mountNavigation();
  let calls = 0;
  authApi.logout = async (input) => { calls++; assert.equal(input.refresh_token, session.refresh_token); return { message: '종료' }; };
  // 같은 탭의 직접 삭제는 storage 이벤트가 없어 화면에 이전 로그아웃 버튼이 남는다.
  localStorage.removeItem('agent-cs:mock:auth:access_token');
  await act(async () => container.querySelector('button').click());
  assert.equal(calls, 1);
  assert.equal(authStorage.getRefreshToken(), null);
  assert.equal(authStorage.getUserId(), null);
  assert.equal(container.querySelector('output').textContent, '/login');
  assert.ok(container.querySelector('a[href="/login"]'));
});

test('로그아웃 중복 요청을 막고 실패 시 세션 유지, 재시도 성공 후 로그인으로 이동한다', async () => {
  authStorage.saveLogin(session);
  const container = await mountNavigation();
  let calls = 0;
  let fail;
  authApi.logout = (request) => {
    assert.equal(request.refresh_token, 'test-refresh');
    calls++;
    return new Promise((_resolve, reject) => { fail = reject; });
  };
  await act(async () => { container.querySelector('button').click(); container.querySelector('button').click(); });
  assert.equal(calls, 1);
  assert.ok(container.querySelector('button').disabled);
  await act(async () => fail(new Error('테스트 서버 오류')));
  assert.equal(authStorage.getAccessToken(), 'test-access');
  assert.equal(container.querySelector('output').textContent, '/posts');
  assert.equal(container.querySelector('[role=alert]').textContent, '테스트 서버 오류');
  authApi.logout = async () => ({ detail: '완료' });
  await act(async () => container.querySelector('button').click());
  assert.equal(authStorage.getAccessToken(), null);
  assert.equal(container.querySelector('output').textContent, '/login');
  assert.ok(container.querySelector('a[href="/login"]'));
});

test('이전 실행의 토큰만 남고 Mock 세션이 없으면 첫 진입부터 로그인으로 표시한다', async () => {
  authStorage.saveLogin(session);
  const database = readMockDatabase();
  database.sessions = [];
  saveMockDatabase(database);
  const container = await mountNavigation();
  assert.ok(container.querySelector('a[href="/login"]'));
  assert.equal(container.querySelector('button'), null);
});

test('액세스 토큰이 만료된 Mock 세션은 첫 진입에서 로그인으로 표시한다', async () => {
  authStorage.saveLogin(session);
  const database = readMockDatabase();
  database.sessions[0].expires_at = Date.now() - 1;
  saveMockDatabase(database);
  const container = await mountNavigation();
  assert.ok(container.querySelector('a[href="/login"]'));
  assert.equal(container.querySelector('button'), null);
});

test('메뉴 표시 후 Mock 세션이 사라져도 로그아웃하면 로그인 화면으로 이동하고 게시글은 보존한다', async () => {
  authStorage.saveLogin(session);
  const container = await mountNavigation();
  const database = readMockDatabase();
  database.sessions = [];
  saveMockDatabase(database);
  let request;
  authApi.logout = (input) => (request = originalLogout(input));
  await act(async () => { container.querySelector('button').click(); await request.catch((error) => assert.equal(error.status, 401)); });
  assert.equal(container.querySelector('output').textContent, '/login');
  assert.equal(authStorage.getAccessToken(), null);
  assert.equal(authStorage.getRefreshToken(), null);
  assert.deepEqual(readMockDatabase().posts, database.posts);
});

test('갱신 토큰까지 만료되어도 로그아웃은 종료 처리하고 다른 계정 세션은 보존한다', async () => {
  authStorage.saveLogin(session);
  const container = await mountNavigation();
  const database = readMockDatabase();
  database.sessions[0].refresh_expires_at = Date.now() - 1;
  const other = { ...database.sessions[0], access_token: 'other-access', refresh_token: 'other-refresh', user_id: 102 };
  database.sessions.push(other);
  saveMockDatabase(database);
  let request;
  authApi.logout = (input) => (request = originalLogout(input));
  await act(async () => { container.querySelector('button').click(); await request.catch((error) => assert.equal(error.status, 401)); });
  assert.equal(container.querySelector('output').textContent, '/login');
  assert.equal(authStorage.getAccessToken(), null);
  assert.deepEqual(readMockDatabase().sessions.filter((item) => item.user_id === 102), [other]);
});

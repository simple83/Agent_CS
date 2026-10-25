import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
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
const originalLogout = authApi.logout;
const roots = [];
const session = { access_token: 'test-access', refresh_token: 'test-refresh', user_id: 101, account_id: 'test' };

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

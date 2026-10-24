import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import { act, createElement, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

// 실제 Hook을 React로 렌더링하고 API 응답 순서만 직접 제어한다.
const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const server = await createServer({
  configFile: false,
  mode: 'mock',
  server: { middlewareMode: true, watch: null, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] },
});
const { postApi } = await server.ssrLoadModule('/src/features/post/services/postApi.ts');
const { usePostList } = await server.ssrLoadModule('/src/features/post/hooks/usePostList.ts');
const { usePostDetail } = await server.ssrLoadModule('/src/features/post/hooks/usePostDetail.ts');
const originalApi = { getPosts: postApi.getPosts, getPost: postApi.getPost };
const roots = new Set();
let requests;

// 요청을 즉시 완료하지 않고 resolve/reject를 보관해 응답 순서 역전을 재현한다.
beforeEach(() => {
  requests = [];
  /** 매 호출의 인자와 완료 함수를 기록하는 제어 가능한 API 대체 함수다. */
  const captureRequest = (params) => new Promise((resolve, reject) => {
    requests.push({ params, resolve, reject });
  });
  postApi.getPosts = captureRequest;
  postApi.getPost = captureRequest;
});

// 남아 있는 React 루트를 정리하고 원래 API를 복구해 테스트 간 상태 누수를 막는다.
afterEach(async () => {
  await act(async () => {
    for (const root of roots) root.unmount();
  });
  roots.clear();
  document.body.replaceChildren();
  Object.assign(postApi, originalApi);
});

// 전체 검사가 끝나면 서버와 가상 DOM/전역 플래그를 정리한다.
after(async () => {
  await server.close();
  dom.window.close();
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

/** Hook을 실제 React 생명주기로 실행하고 렌더 이력·재렌더·언마운트 수단을 반환한다. */
async function renderHook(useHook, initialProps, strict = false) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  roots.add(root);
  const renders = [];
  let current;
  /** 화면을 그리지 않고 Hook의 현재 반환값과 모든 렌더 상태를 수집한다. */
  function Probe({ value }) {
    current = useHook(value);
    renders.push(current);
    return null;
  }
  /** props 변경을 React act 안에서 반영하며 필요하면 StrictMode 정리 동작도 검사한다. */
  async function rerender(value) {
    await act(async () => {
      const element = createElement(Probe, { value });
      root.render(strict ? createElement(StrictMode, null, element) : element);
    });
  }
  await rerender(initialProps);
  return {
    get current() { return current; },
    renders,
    rerender,
    /** 언마운트 후 늦은 응답이 상태를 변경하지 않는지 검사할 수 있게 루트를 제거한다. */
    async unmount() {
      await act(async () => root.unmount());
      roots.delete(root);
    },
  };
}

test('목록은 첫 렌더부터 로딩이며 초기 검색 조건 변경으로 재조회하지 않는다', async () => {
  const hook = await renderHook(usePostList, { tag: 'React' });
  assert.equal(hook.renders[0].isInitialLoading, true);
  assert.equal(hook.renders[0].isLoading, true);
  assert.deepEqual(requests[0].params, { tag: 'React' });
  await hook.rerender({ tag: 'changed' });
  assert.equal(requests.length, 1);
  await act(async () => requests[0].resolve([]));
  assert.equal(hook.current.status, 'success');
  assert.equal(hook.current.isLoading, false);
  assert.equal(hook.current.isInitialLoading, false);
  assert.deepEqual(hook.current.posts, []);
});

test('검색은 오래된 성공/오류를 무시하고 재조회는 마지막 조건을 사용한다', async () => {
  const hook = await renderHook(usePostList);
  await act(async () => { void hook.current.search({ title: ' old ' }); });
  await act(async () => { void hook.current.search({ title: ' latest ', tag: '   ' }); });
  assert.equal(hook.current.status, 'searching');
  assert.equal(hook.current.isInitialLoading, false);
  assert.deepEqual(hook.current.filters, { title: 'latest', tag: undefined });
  await act(async () => requests[0].resolve([{ id: 1 }]));
  await act(async () => requests[1].reject(new Error('stale error')));
  assert.equal(hook.current.isLoading, true);
  assert.equal(hook.current.error, null);
  assert.deepEqual(hook.current.posts, []);
  await act(async () => requests[2].reject(new Error('latest error')));
  assert.equal(hook.current.status, 'error');
  assert.equal(hook.current.isLoading, false);
  assert.equal(hook.current.error, 'latest error');
  let refresh;
  await act(async () => { refresh = hook.current.refresh(); });
  assert.equal(hook.current.status, 'refreshing');
  assert.equal(hook.current.error, null);
  assert.deepEqual(requests[3].params, { title: 'latest', tag: undefined });
  await act(async () => {
    requests[3].resolve([{ id: 3 }]);
    await refresh;
  });
  assert.equal(hook.current.status, 'success');
  assert.deepEqual(hook.current.posts, [{ id: 3 }]);
});

test('상세는 초기 로딩과 실패를 구분하고 실패 후 재조회할 수 있다', async () => {
  const hook = await renderHook(usePostDetail, 1);
  assert.equal(hook.renders[0].isInitialLoading, true);
  assert.equal(hook.renders[0].isLoading, true);
  assert.equal(hook.current.post, null);
  await act(async () => requests[0].reject(new Error('not found')));
  assert.equal(hook.current.status, 'error');
  assert.equal(hook.current.isLoading, false);
  await act(async () => { void hook.current.refresh(); });
  assert.equal(hook.current.status, 'refreshing');
  assert.equal(hook.current.isLoading, true);
  assert.equal(hook.current.isInitialLoading, false);
  assert.equal(hook.current.error, null);
  await act(async () => requests[1].resolve({ id: 1 }));
  assert.equal(hook.current.status, 'success');
  assert.equal(hook.current.post.id, 1);
});

test('글 번호를 A→B→A로 바꾸어도 이전 데이터와 오류를 비운다', async () => {
  const hook = await renderHook(usePostDetail, 1);
  await act(async () => requests[0].resolve({ id: 1, title: 'old' }));
  await hook.rerender(2);
  assert.equal(hook.current.status, 'initial-loading');
  assert.equal(hook.current.post, null);
  await hook.rerender(1);
  assert.equal(hook.current.status, 'initial-loading');
  assert.equal(hook.current.post, null);
  await act(async () => requests[1].reject(new Error('stale failure')));
  assert.equal(hook.current.error, null);
  assert.equal(hook.current.isLoading, true);
  await act(async () => requests[2].reject(new Error('current failure')));
  assert.equal(hook.current.error, 'current failure');
  await hook.rerender(3);
  assert.equal(hook.current.error, null);
  assert.equal(hook.current.isInitialLoading, true);
  await act(async () => requests[3].resolve({ id: 3 }));
  assert.equal(hook.current.post.id, 3);
});

for (const [name, useHook, props, data] of [
  ['목록', usePostList, undefined, [{ id: 1 }]],
  ['상세', usePostDetail, 1, { id: 1 }],
]) {
  test(`${name}: 이전 응답이 나중에 도착해도 최신 재조회 결과를 유지한다`, async () => {
    const hook = await renderHook(useHook, props);
    await act(async () => requests[0].resolve(data));
    await act(async () => { void hook.current.refresh(); });
    await act(async () => { void hook.current.refresh(); });
    await act(async () => requests[2].resolve(data));
    await act(async () => requests[1].reject(new Error('old refresh')));
    assert.equal(hook.current.status, 'success');
    assert.equal(hook.current.error, null);
    assert.deepEqual(hook.current.post ?? hook.current.posts, data);
    await act(async () => { void hook.current.refresh(); });
    await hook.unmount();
    const count = hook.renders.length;
    await act(async () => requests[3].resolve(data));
    assert.equal(hook.renders.length, count);
  });

  test(`${name}: StrictMode 정리는 이전 Effect 응답을 무시한다`, async () => {
    const hook = await renderHook(useHook, props, true);
    assert.equal(requests.length, 2);
    await act(async () => requests[0].reject(new Error('cleaned up effect')));
    assert.equal(hook.current.isInitialLoading, true);
    assert.equal(hook.current.error, null);
    await act(async () => requests[1].resolve(data));
    assert.equal(hook.current.status, 'success');
    assert.equal(hook.current.isLoading, false);
  });
}

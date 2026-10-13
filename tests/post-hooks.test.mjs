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

beforeEach(() => {
  requests = [];
  const captureRequest = (params) => new Promise((resolve, reject) => {
    requests.push({ params, resolve, reject });
  });
  postApi.getPosts = captureRequest;
  postApi.getPost = captureRequest;
});

afterEach(async () => {
  await act(async () => {
    for (const root of roots) root.unmount();
  });
  roots.clear();
  document.body.replaceChildren();
  Object.assign(postApi, originalApi);
});

after(async () => {
  await server.close();
  dom.window.close();
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

async function renderHook(useHook, initialProps, strict = false) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  roots.add(root);
  const renders = [];
  let current;
  function Probe({ value }) {
    current = useHook(value);
    renders.push(current);
    return null;
  }
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
    async unmount() {
      await act(async () => root.unmount());
      roots.delete(root);
    },
  };
}

test('list starts loading on its first render and keeps initialParams as initial-only', async () => {
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

test('search ignores stale successes/errors and refresh retries the latest filters', async () => {
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

test('detail starts loading, reports failure and can refresh after failure', async () => {
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

test('switching post IDs clears previous data/errors, including A to B to A', async () => {
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
  ['list', usePostList, undefined, [{ id: 1 }]],
  ['detail', usePostDetail, 1, { id: 1 }],
]) {
  test(`${name}: newer refresh wins even if an older response arrives last`, async () => {
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

  test(`${name}: StrictMode cleanup ignores the previous effect response`, async () => {
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

import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, test } from 'node:test';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

// 실제 컴포넌트/Hook을 실행하고 API 완료 시점만 제어해 중복 클릭과 늦은 응답을 재현한다.
const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const server = await createServer({ configFile: false, mode: 'mock',
  server: { middlewareMode: true, watch: null, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] } });
const { postApi } = await server.ssrLoadModule('/src/features/post/services/postApi.ts');
const { usePostLike } = await server.ssrLoadModule('/src/features/post/hooks/usePostLike.ts');
const { PostCard } = await server.ssrLoadModule('/src/features/post/components/PostCard.tsx');
const { PostDetail } = await server.ssrLoadModule('/src/features/post/components/PostDetail.tsx');
const { MOCK_POSTS } = await server.ssrLoadModule('/src/features/post/mocks/mockPosts.ts');
const original = { ...postApi };
const roots = [];

beforeEach(() => {
  postApi.getLikeStatus = async () => false;
  postApi.likePost = async () => ({ detail: '등록' });
  postApi.unlikePost = async () => ({ detail: '취소' });
});

// 루트/API 대역을 복구해 테스트끼리 요청과 상태가 섞이지 않게 한다.
afterEach(async () => {
  await act(async () => { for (const root of roots) root.unmount(); });
  roots.length = 0;
  document.body.replaceChildren();
  Object.assign(postApi, original);
});
after(async () => {
  await server.close(); dom.window.close();
  delete globalThis.window; delete globalThis.document; delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

/** 실제 DOM에 컴포넌트를 마운트하고 사용자 클릭/화면 내용을 검사할 수 있게 반환한다. */
async function mount(element) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container); roots.push(root);
  await act(async () => root.render(element));
  return { root, container };
}

/** Hook을 마운트하고 글 번호 변경과 현재 상태를 테스트에 노출한다. */
async function mountLike(postId = 1, initialCount = 5) {
  let current;
  /** 화면 없이 Hook 반환값만 관찰한다. */
  function Probe({ id, count }) { current = usePostLike(id, count); return null; }
  const { root } = await mount(createElement(Probe, { id: postId, count: initialCount }));
  return { get current() { return current; },
    /** 동일 Hook 인스턴스의 글 번호를 변경해 이전 응답 무시를 검사한다. */
    async change(id, count) { await act(async () => root.render(createElement(Probe, { id, count }))); },
    /** 언마운트 후 응답이 부작용 없이 무시되는지 검사한다. */
    async unmount() { await act(async () => root.unmount()); roots.splice(roots.indexOf(root), 1); },
  };
}

test('카드는 통계만 표시하며 좋아요 영역을 클릭해도 변경 API를 호출하지 않는다', async () => {
  let navigated;
  postApi.likePost = async () => { assert.fail('카드에서 변경 API 호출'); };
  const { container } = await mount(createElement(PostCard, { post: MOCK_POSTS[0], onClick: (id) => { navigated = id; } }));
  assert.equal(container.querySelectorAll('button').length, 0);
  const likes = [...container.querySelectorAll('span')].find((span) => span.textContent.includes('👍'));
  assert.ok(likes.textContent.includes(String(MOCK_POSTS[0].like_count)));
  await act(async () => likes.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true })));
  assert.equal(navigated, MOCK_POSTS[0].id);
});

test('상세에서만 좋아요를 등록/취소하고 조회수 증가 요청을 다시 보내지 않는다', async () => {
  let reads = 0, likes = 0, unlikes = 0;
  postApi.getPost = async () => { reads++; return MOCK_POSTS[0]; };
  postApi.likePost = async () => { likes++; return { detail: '등록' }; };
  postApi.unlikePost = async () => { unlikes++; return { detail: '취소' }; };
  const { container } = await mount(createElement(PostDetail, { postId: 1 }));
  const region = container.querySelector('[aria-label="게시글 좋아요"]');
  assert.ok(region);
  const button = region.querySelector('button');
  await act(async () => button.click());
  assert.equal(likes, 1);
  assert.equal(button.getAttribute('aria-pressed'), 'true');
  assert.ok(region.textContent.includes('좋아요 6개'));
  await act(async () => button.click());
  assert.equal(unlikes, 1);
  assert.ok(region.textContent.includes('좋아요 5개'));
  assert.equal(reads, 1);
});

test('비로그인은 버튼이 비활성화되며 상태 조회 실패 후에도 본문은 유지한다', async () => {
  postApi.getPost = async () => MOCK_POSTS[0];
  postApi.getLikeStatus = async () => null;
  const guest = await mount(createElement(PostDetail, { postId: 1 }));
  assert.equal(guest.container.querySelector('[aria-label="게시글 좋아요"] button').disabled, true);
  assert.ok(guest.container.textContent.includes('로그인 후'));
  postApi.getLikeStatus = async () => { throw new Error('상태 조회 오류'); };
  const failed = await mount(createElement(PostDetail, { postId: 1 }));
  assert.ok(failed.container.textContent.includes(MOCK_POSTS[0].content));
  assert.ok(failed.container.querySelector('[role="alert"]').textContent.includes('상태 조회 오류'));
});

test('같은 렌더의 연속 클릭은 한 번만 전송하고 성공 전에는 합계를 바꾸지 않는다', async () => {
  let finish, calls = 0;
  postApi.likePost = () => { calls++; return new Promise((resolve) => { finish = resolve; }); };
  const hook = await mountLike();
  let first;
  await act(async () => { first = hook.current.toggle(); void hook.current.toggle(); });
  assert.equal(calls, 1); assert.equal(hook.current.count, 5); assert.equal(hook.current.status, 'saving');
  await act(async () => { finish({ detail: '성공' }); await first; });
  assert.equal(hook.current.count, 6); assert.equal(hook.current.liked, true);
});

test('실패 시 합계를 유지하고 변경 재전송 전에 서버 상태를 다시 확인한다', async () => {
  const hook = await mountLike();
  postApi.likePost = async () => { throw new Error('연결 끊김'); };
  await act(async () => { await hook.current.toggle(); });
  assert.equal(hook.current.count, 5); assert.equal(hook.current.status, 'error');
  // 서버에는 이미 저장됐지만 응답을 받지 못한 상황을 재현한다.
  postApi.getLikeStatus = async () => true;
  await act(async () => { await hook.current.retry(); });
  assert.equal(hook.current.liked, true); assert.equal(hook.current.count, 6);
  await act(async () => { await hook.current.retry(); });
  assert.equal(hook.current.count, 6);
});

test('글 전환·언마운트 뒤의 이전 변경 응답은 현재 글 상태에 반영하지 않는다', async () => {
  let finish;
  postApi.likePost = () => new Promise((resolve) => { finish = resolve; });
  const hook = await mountLike();
  let pending;
  await act(async () => { pending = hook.current.toggle(); });
  await hook.change(2, 12);
  await act(async () => { finish({ detail: '성공' }); await pending; });
  assert.equal(hook.current.postId, 2); assert.equal(hook.current.count, 12); assert.equal(hook.current.liked, false);
  await act(async () => { pending = hook.current.toggle(); });
  await hook.unmount();
  await act(async () => { finish({ detail: '성공' }); await pending; });
});

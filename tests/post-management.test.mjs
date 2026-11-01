import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

// 실제 Mock 서비스와 React 화면을 함께 실행한다. 지연/실패 검사는 필요한 API만 잠시 교체한다.
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
for (const name of ['window', 'document', 'Node', 'HTMLElement', 'MutationObserver', 'DOMParser', 'localStorage']) {
  globalThis[name] = name === 'window' ? dom.window : dom.window[name];
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const server = await createServer({ configFile: false, mode: 'mock',
  server: { middlewareMode: true, watch: null, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] },
  define: { 'import.meta.env.VITE_MOCK_DELAY_MS': '"0"' },
});
const { postApi } = await server.ssrLoadModule('/src/features/post/services/postApi.ts');
const { authApi } = await server.ssrLoadModule('/src/features/auth/services/authApi.ts');
const { authStorage } = await server.ssrLoadModule('/src/shared/services/authStorage.ts');
const { usePostForm } = await server.ssrLoadModule('/src/features/post/hooks/usePostForm.ts');
const { usePostDelete } = await server.ssrLoadModule('/src/features/post/hooks/usePostDelete.ts');
const { PostEditPage } = await server.ssrLoadModule('/src/pages/PostEditPage.tsx');
const { PostDetailPage } = await server.ssrLoadModule('/src/pages/PostDetailPage.tsx');
const { PostOwnerActions } = await server.ssrLoadModule('/src/features/post/components/detail/PostOwnerActions.tsx');
const { readMockDatabase, saveMockDatabase, failNextMockRequest } = await server.ssrLoadModule('/src/shared/mocks/mockStore.ts');
const { getEditedPostTags, getPostTopicInput } = await server.ssrLoadModule('/src/features/post/utils/postEditor.ts');
const originalApi = { ...postApi };
const roots = new Set();

/** 현재 경로를 노출해 저장·삭제 완료 전후의 이동 시점을 검사한다. */
function LocationProbe() {
  return createElement('output', null, useLocation().pathname);
}

/** 실제 컴포넌트를 마운트하고 후속 props 변경과 명시적인 언마운트를 지원한다. */
async function mount(element) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  roots.add(root);
  await act(async () => root.render(element));
  return { container,
    async render(next) { await act(async () => root.render(next)); },
    async unmount() { await act(async () => root.unmount()); roots.delete(root); container.remove(); },
  };
}

/** 기존 라우트와 같은 경로에서 직접 진입/새로고침을 재현한다. */
async function mountRoute(path) {
  return mount(createElement(MemoryRouter, { initialEntries: [path] },
    createElement(Routes, null,
      createElement(Route, { path: '/posts/:postId/edit', element: createElement(PostEditPage) }),
      createElement(Route, { path: '/posts/:postId', element: createElement(PostDetailPage) }),
      createElement(Route, { path: '/posts', element: createElement('p', null, '게시글 목록') }),
      createElement(Route, { path: '/login', element: createElement('p', null, '로그인 화면') })),
    createElement(LocationProbe)));
}

/** Mock 타이머와 lazy 편집기 로딩을 기다리되 준비되지 않으면 제한 시간 내에 실패한다. */
async function waitFor(check) {
  const deadline = Date.now() + 5000;
  while (!check() && Date.now() < deadline) {
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
  }
  assert.ok(check(), '화면이 제한 시간 안에 준비되어야 한다.');
}

/** 앱과 같은 API·저장소 절차로 로그인한다. 실제 네트워크는 필요하지 않다. */
async function login(account_id = 'jinwoo99') {
  const session = await authApi.login({ account_id, password: 'mock1234' });
  await act(async () => authStorage.saveLogin(session));
}

/** 지정한 문구의 버튼만 골라 사용자 클릭을 재현한다. */
const button = (container, text) => [...container.querySelectorAll('button')].find((node) => node.textContent === text);

afterEach(async () => {
  await act(async () => { for (const root of roots) root.unmount(); });
  roots.clear();
  document.body.replaceChildren();
  localStorage.clear();
  Object.assign(postApi, originalApi);
});

after(async () => { await server.close(); dom.window.close(); });

test('태그를 손대지 않으면 원본을 보존하고 말머리를 명시적으로 바꾸면 선택한 분류 하나를 저장한다', () => {
  const tags = ['질문', '밥친구', 'a,b', ' 태그 '].map((name, id) => ({ name, id }));
  assert.deepEqual(getEditedPostTags(tags, '질문', getPostTopicInput(tags)), tags.map((tag) => tag.name));
  assert.deepEqual(getEditedPostTags(tags, '모집', getPostTopicInput(tags)), ['모집', 'a,b', ' 태그 ']);
  assert.deepEqual(getEditedPostTags(tags, '질문', '밥친구, React, #React'), ['질문', '밥친구', 'React']);
  assert.deepEqual(getEditedPostTags([], '자유', ''), []);
});

test('수정 초안은 부모 재조회와 저장 실패 후에도 보존하며 중복 PATCH와 이미지 전송을 막는다', async () => {
  await login();
  const post = await postApi.getPost(1);
  let form;
  let saved;
  /** 폼이 다시 렌더링되어도 최초 원본과 사용자 초안이 분리되어 있는지 관찰한다. */
  function Probe({ initialPost }) {
    form = usePostForm({ initialPost, onUpdated: (value) => { saved = value; } });
    return null;
  }
  const mounted = await mount(createElement(Probe, { initialPost: post }));
  assert.equal(form.title, post.title);
  assert.equal(form.content, post.content);
  await act(async () => { form.setTitle('수정 초안'); form.setContent('설명\n\n```cpp\n  int n = 1;\n```'); });
  await mounted.render(createElement(Probe, { initialPost: { ...post, title: '늦은 응답' } }));
  assert.equal(form.title, '수정 초안');
  let fail;
  let calls = 0;
  postApi.updatePost = () => { calls++; return new Promise((_resolve, reject) => { fail = reject; }); };
  let request;
  await act(async () => { request = form.submit(); assert.equal(await form.submit(), null); });
  assert.equal(calls, 1);
  assert.equal(form.isLoading, true);
  await act(async () => { fail(new Error('저장 실패')); await request; });
  assert.equal(form.title, '수정 초안');
  assert.match(form.content, /```cpp/);
  assert.equal(form.error, '저장 실패');
  postApi.updatePost = async (id, params) => {
    assert.equal(id, post.id);
    assert.equal(Object.hasOwn(params, 'images'), false);
    assert.equal(Object.hasOwn(params, 'hashtags'), false);
    return { ...post, ...params };
  };
  await act(async () => { await form.submit(); });
  assert.equal(saved.title, '수정 초안');
  assert.equal(form.isLoading, false);
});

test('수정 Hook은 제출 직전 계정 전환을 거부하고 언마운트 후 저장 완료는 이동시키지 않는다', async () => {
  await login();
  const post = await postApi.getPost(1);
  let form;
  let moved = false;
  let finish;
  /** 제출 함수의 권한 검사와 완료 콜백을 UI와 독립적으로 검사한다. */
  function Probe() { form = usePostForm({ initialPost: post, onUpdated: () => { moved = true; } }); return null; }
  const mounted = await mount(createElement(Probe));
  postApi.updatePost = () => { throw new Error('호출되면 안 됨'); };
  await login('dev_hero');
  await act(async () => { assert.equal(await form.submit(), null); });
  assert.match(form.error, /본인이/);
  await login();
  postApi.updatePost = () => new Promise((resolve) => { finish = resolve; });
  let pending;
  await act(async () => { pending = form.submit(); });
  await mounted.unmount();
  await act(async () => { finish(post); await pending; });
  assert.equal(moved, false);
});

test('수정 URL은 잘못된 번호·비로그인·타인·없는 글을 구분한다', async () => {
  const invalid = await mountRoute('/posts/Infinity/edit');
  assert.match(invalid.container.textContent, /잘못된 게시글 번호/);
  const guest = await mountRoute('/posts/1/edit');
  assert.match(guest.container.textContent, /로그인해주세요/);
  assert.equal(guest.container.querySelector('form'), null);
  await guest.unmount();
  await login();
  const other = await mountRoute('/posts/2/edit');
  await waitFor(() => other.container.textContent.includes('본인이 작성한'));
  assert.equal(other.container.querySelector('form'), null);
  const missing = await mountRoute('/posts/999/edit');
  await waitFor(() => missing.container.textContent.includes('존재하지 않는'));
  assert.equal(missing.container.querySelector('form'), null);
});

test('직접 연 수정 화면은 실제 편집기를 채우고 원본 코드·이미지를 유지한 채 저장 후 상세로 이동한다', async () => {
  await login();
  const db = readMockDatabase();
  db.posts[0].content = '\n설명\n\n```cpp\n  int n = 1;\n```\n\n뒤 문단\n\n';
  db.posts[0].image_urls = ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jK1sAAAAASUVORK5CYII='];
  saveMockDatabase(db);
  const before = await postApi.getPost(1);
  const mounted = await mountRoute('/posts/1/edit');
  await waitFor(() => mounted.container.querySelector('[role=textbox]'));
  assert.equal(mounted.container.querySelector('input').value, before.title);
  assert.ok(mounted.container.querySelector('pre code'));
  assert.equal(mounted.container.querySelector('input[type=file]'), null);
  assert.equal(mounted.container.querySelector('img').src, before.image_urls[0]);
  await act(async () => button(mounted.container, '수정 저장').click());
  await waitFor(() => mounted.container.querySelector('output').textContent === '/posts/1');
  await waitFor(() => button(mounted.container, '좋아요')?.disabled === false);
  const afterPost = await postApi.getPost(1);
  assert.equal(afterPost.content, before.content);
  assert.deepEqual(afterPost.hashtags, before.hashtags);
  assert.deepEqual(afterPost.image_urls, before.image_urls);
  await waitFor(() => button(mounted.container, '수정'));
});

test('수정 취소는 저장하지 않고 상세로 돌아가며 다른 계정으로 바뀌면 편집 폼을 제거한다', async () => {
  await login();
  let calls = 0;
  postApi.updatePost = async () => { calls++; };
  const mounted = await mountRoute('/posts/1/edit');
  await waitFor(() => button(mounted.container, '취소'));
  await act(async () => button(mounted.container, '취소').click());
  assert.equal(calls, 0);
  assert.equal(mounted.container.querySelector('output').textContent, '/posts/1');
  await mounted.unmount();
  const editing = await mountRoute('/posts/1/edit');
  await waitFor(() => editing.container.querySelector('form'));
  await login('dev_hero');
  await waitFor(() => editing.container.textContent.includes('본인이 작성한'));
  assert.equal(editing.container.querySelector('form'), null);
});

test('상세 작성자 버튼은 로그인·계정 전환·로그아웃을 즉시 반영한다', async () => {
  const mounted = await mountRoute('/posts/1');
  await waitFor(() => mounted.container.querySelector('article'));
  assert.equal(button(mounted.container, '수정'), undefined);
  await login();
  assert.ok(button(mounted.container, '수정'));
  await login('dev_hero');
  assert.equal(button(mounted.container, '수정'), undefined);
  await login();
  await act(async () => authStorage.clear());
  assert.equal(button(mounted.container, '삭제'), undefined);
});

test('삭제 확인 취소는 요청하지 않고 실패 시 머무르며 성공 후 목록 이동과 소프트 삭제를 반영한다', async () => {
  await login();
  const mounted = await mountRoute('/posts/1');
  await waitFor(() => button(mounted.container, '삭제'));
  // 일회성 Mock 실패를 좋아요 초기 조회가 먼저 소비하지 않도록 그 요청도 완료시킨다.
  await waitFor(() => button(mounted.container, '좋아요')?.disabled === false);
  let confirmations = 0;
  window.confirm = () => { confirmations++; return false; };
  await act(async () => button(mounted.container, '삭제').click());
  assert.equal(confirmations, 1);
  assert.equal(readMockDatabase().posts.find((post) => post.id === 1).is_deleted, false);
  window.confirm = () => true;
  failNextMockRequest();
  await act(async () => button(mounted.container, '삭제').click());
  await waitFor(() => mounted.container.querySelector('[role=alert]'));
  assert.equal(mounted.container.querySelector('output').textContent, '/posts/1');
  assert.match(mounted.container.querySelector('[role=alert]').textContent, /테스트용/);
  await act(async () => button(mounted.container, '삭제').click());
  await waitFor(() => mounted.container.querySelector('output').textContent === '/posts');
  assert.equal((await postApi.getPosts()).some((post) => post.id === 1), false);
  await assert.rejects(postApi.getPost(1), /존재하지 않는/);
});

test('삭제 진행 중 중복 요청을 막고 이동만 실패한 경우 재삭제를 허용하지 않는다', async () => {
  await login();
  let calls = 0;
  let finish;
  postApi.deletePost = () => { calls++; return new Promise((resolve) => { finish = resolve; }); };
  const mounted = await mount(createElement(PostOwnerActions, { postId: 1, authorId: 101,
    onEdit: () => assert.fail('삭제 중에는 수정 불가'), onDeleted: () => { throw new Error('이동 실패'); } }));
  window.confirm = () => true;
  const remove = button(mounted.container, '삭제');
  await act(async () => { remove.click(); remove.click(); });
  assert.equal(calls, 1);
  assert.ok(button(mounted.container, '수정').disabled);
  await act(async () => finish({ detail: '삭제 완료' }));
  assert.match(mounted.container.querySelector('[role=alert]').textContent, /삭제되었습니다.*화면 이동/);
  assert.ok(button(mounted.container, '삭제 완료').disabled);
});

test('삭제 Hook은 다른 계정의 요청과 언마운트 후 이동을 차단한다', async () => {
  await login('dev_hero');
  let deletion;
  let moved = false;
  let finish;
  /** 삭제 Hook의 완료 시점만 제어해 언마운트 후의 이동 여부를 확인한다. */
  function Probe() { deletion = usePostDelete(1, 101, () => { moved = true; }); return null; }
  const mounted = await mount(createElement(Probe));
  await act(async () => { await deletion.deletePost(); });
  assert.match(deletion.error, /본인이/);
  await login();
  postApi.deletePost = () => new Promise((resolve) => { finish = resolve; });
  let pending;
  await act(async () => { pending = deletion.deletePost(); });
  await mounted.unmount();
  await act(async () => { finish({ detail: '삭제' }); await pending; });
  assert.equal(moved, false);
});

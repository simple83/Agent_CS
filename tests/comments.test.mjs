import assert from 'node:assert/strict';
import { after, afterEach, test } from 'node:test';
import { act, createElement, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

// 실제 React·시각적 편집기·Mock을 실행한다. HTTP 계약 검사는 fetch만 대체해 외부 요청을 보내지 않는다.
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
for (const name of ['window', 'document', 'Node', 'HTMLElement', 'MutationObserver', 'DOMParser', 'localStorage', 'getComputedStyle']) {
  globalThis[name] = name === 'window' ? dom.window : dom.window[name];
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const server = await createServer({ configFile: false, mode: 'mock',
  server: { middlewareMode: true, watch: null, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] },
  define: { 'import.meta.env.VITE_MOCK_DELAY_MS': '"0"' },
});
const realServer = await createServer({ configFile: false, mode: 'real',
  server: { middlewareMode: true, watch: null, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] },
  define: { 'import.meta.env.VITE_API_BASE_URL': '"https://backend.example.test/api"' },
});
const { commentApi } = await server.ssrLoadModule('/src/features/comment/services/commentApi.ts');
const { realCommentApi } = await realServer.ssrLoadModule('/src/features/comment/services/commentApi.real.ts');
const { authStorage: realAuth } = await realServer.ssrLoadModule('/src/shared/services/authStorage.ts');
const { postApi } = await server.ssrLoadModule('/src/features/post/services/postApi.ts');
const { authApi } = await server.ssrLoadModule('/src/features/auth/services/authApi.ts');
const { authStorage } = await server.ssrLoadModule('/src/shared/services/authStorage.ts');
const store = await server.ssrLoadModule('/src/shared/mocks/mockStore.ts');
const utils = await server.ssrLoadModule('/src/features/comment/utils/comments.ts');
const { useComments } = await server.ssrLoadModule('/src/features/comment/hooks/useComments.ts');
const { useCommentForm } = await server.ssrLoadModule('/src/features/comment/hooks/useCommentForm.ts');
const { CommentSection } = await server.ssrLoadModule('/src/features/comment/components/CommentSection.tsx');
const { PostDetail } = await server.ssrLoadModule('/src/features/post/components/detail/PostDetail.tsx');
const { MarkdownContent } = await server.ssrLoadModule('/src/shared/components/richText/MarkdownContent.tsx');
const originalComments = { ...commentApi };
const originalPosts = { ...postApi };
const originalFetch = globalThis.fetch;
const roots = new Set();

/** 테스트마다 독립된 실제 React 루트를 만든다. */
async function mount(element) {
  const container = document.createElement('div'); document.body.append(container);
  const root = createRoot(container); roots.add(root);
  await act(async () => root.render(element));
  return { container,
    async render(next) { await act(async () => root.render(next)); },
    async unmount() { await act(async () => root.unmount()); roots.delete(root); container.remove(); },
  };
}

/** Hook의 반환값을 React 상태 갱신과 함께 관찰한다. */
async function mountHook(hook, strict = false) {
  let current;
  function Probe() { current = hook(); return null; }
  const mounted = await mount(strict ? createElement(StrictMode, null, createElement(Probe)) : createElement(Probe));
  return { ...mounted, get current() { return current; } };
}

/** Mock 지연과 lazy 모듈 로딩이 끝날 때까지 React 작업을 처리한다. */
async function waitFor(check) {
  const deadline = Date.now() + 5000;
  while (!check() && Date.now() < deadline) await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
  assert.ok(check(), '화면이 준비되어야 한다.');
}

/** 앱의 인증 절차와 동일하게 세션을 저장한다. */
async function login(account_id = 'jinwoo99') {
  const session = await authApi.login({ account_id, password: 'mock1234' });
  await act(async () => authStorage.saveLogin(session));
}

/** 정규 응답을 기반으로 소속·부모 등 필요한 값만 바꾼다. */
const fixture = (overrides = {}) => ({ ...store.readMockDatabase().comments[0], ...overrides });
const button = (container, text) => [...container.querySelectorAll('button')].find((node) => node.textContent === text);

afterEach(async () => {
  await act(async () => { for (const root of roots) root.unmount(); });
  roots.clear(); document.body.replaceChildren(); localStorage.clear();
  Object.assign(commentApi, originalComments); Object.assign(postApi, originalPosts);
  globalThis.fetch = originalFetch;
});

after(async () => { await server.close(); await realServer.close(); dom.window.close(); });

test('평면과 중첩 대댓글을 중복 없이 합치고 다른 글·부모 불일치·순환·상충 중복 응답을 거부한다', () => {
  const root = fixture();
  const reply = fixture({ id: 9, parent_comment_id: root.id });
  const result = utils.normalizeComments([{ ...root, replies: [reply] }, reply], 1);
  assert.equal(result.length, 2);
  assert.equal(utils.groupComments(result)[0].replies.length, 1);
  assert.throws(() => utils.normalizeComments([fixture({ post_id: 2 })], 1), /다른 게시글/);
  assert.throws(() => utils.normalizeComments([{ ...root, replies: [fixture({ id: 9, parent_comment_id: 88 })] }], 1), /부모/);
  assert.throws(() => utils.normalizeComments([fixture({ parent_comment_id: 1 })], 1), /부모 관계/);
  assert.throws(() => utils.normalizeComments([root, { ...root, content: '충돌' }], 1), /서로 다릅니다/);
  assert.throws(() => utils.normalizeComments({}, 1), /형식/);
});

test('삭제·블라인드 원문은 상태에서 제거하고 삭제 부모의 살아 있는 답글과 고아 답글은 표시 대상으로 남긴다', () => {
  const hidden = utils.normalizeComments([fixture({ is_blurred: true, content: '비공개' })], 1);
  assert.equal(hidden[0].content, '');
  const comments = utils.normalizeComments([
    fixture({ is_deleted: true, content: '삭제 원문' }), fixture({ id: 9, parent_comment_id: 1 }),
    fixture({ id: 10, parent_comment_id: 999 }),
  ], 1);
  assert.equal(comments[0].content, '');
  assert.equal(utils.groupComments(comments).length, 2);
  assert.equal(utils.groupComments(comments)[0].replies[0].id, 9);
});

test('기존 Mock 저장소를 확장해도 사용자 글·이미지·좋아요·세션은 보존하고 예시 댓글 수만 실제 값으로 맞춘다', () => {
  const legacy = store.readMockDatabase();
  delete legacy.comments;
  legacy.posts[0].title = '사용자 수정 제목'; legacy.posts[0].image_urls = ['이미지'];
  legacy.likes = { 1: [101] }; legacy.sessions = [{ access_token: '보존할 토큰' }];
  localStorage.setItem('agent-cs:mock:v1:database', JSON.stringify(legacy));
  const migrated = store.readMockDatabase();
  assert.deepEqual(migrated.comments, []);
  assert.equal(migrated.posts[0].title, legacy.posts[0].title);
  assert.deepEqual(migrated.posts[0].image_urls, legacy.posts[0].image_urls);
  assert.deepEqual(migrated.likes, legacy.likes); assert.deepEqual(migrated.sessions, legacy.sessions);
  assert.equal(migrated.posts[0].comment_count, 0);
  assert.deepEqual(store.readMockDatabase(), migrated);
});

test('Mock 댓글·답글·수정·현재 계약의 연쇄 삭제는 집계를 유지하고 게시글 조회수를 올리지 않는다', async () => {
  globalThis.fetch = () => { throw new Error('Mock은 네트워크를 사용하면 안 됨'); };
  await login();
  const before = store.readMockDatabase().posts[0].view_count;
  const root = await commentApi.createComment(1, '설명\n\n```cpp\n  int n;\n```');
  await login('dev_hero');
  const reply = await commentApi.createReply(1, root.id, '답글');
  await commentApi.updateComment(1, reply.id, '수정 답글');
  await assert.rejects(commentApi.createReply(1, reply.id, '더 깊은 답글'), /다시 답글/);
  await login();
  await commentApi.deleteComment(1, root.id);
  const comments = await commentApi.getComments(1);
  assert.equal(comments.some((item) => item.id === root.id || item.id === reply.id), false);
  const data = store.readMockDatabase();
  assert.equal(data.posts[0].comment_count, comments.length);
  assert.equal(data.posts[0].view_count, before);
  assert.ok(data.comments.find((item) => item.id === reply.id).is_deleted);
  await assert.rejects(commentApi.createReply(1, root.id, '삭제 후 답글'), /삭제/);
});

test('Mock은 비로그인·타인 수정/삭제·다른 게시글 소속·삭제 게시글·빈 입력·초과 길이를 거부한다', async () => {
  await assert.rejects(commentApi.createComment(1, '비로그인'), /로그인/);
  await login();
  await assert.rejects(commentApi.updateComment(1, 1, '타인 수정'), /본인이/);
  await assert.rejects(commentApi.deleteComment(1, 1), /본인이/);
  await assert.rejects(commentApi.updateComment(2, 2, '소속 불일치'), /댓글이/);
  await assert.rejects(commentApi.createReply(2, 1, '소속 불일치'), /댓글이/);
  await assert.rejects(commentApi.createComment(1, '  '), /입력/);
  await assert.rejects(commentApi.createComment(1, 'x'.repeat(utils.COMMENT_MAX_LENGTH + 1)), /이내/);
  await postApi.deletePost(1);
  await assert.rejects(commentApi.getComments(1), /게시글이/);
  await assert.rejects(commentApi.createComment(1, '삭제 후 작성'), /게시글이/);
});

test('실제 API는 JSON content와 bearer만 보내며 경로 접두사를 중복하지 않고 상태 코드를 보존한다', async () => {
  realAuth.saveLogin({ access_token: 'token', refresh_token: 'refresh', user_id: 101, account_id: 'test' });
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return options.method === 'GET' ? Response.json([fixture()])
      : options.method === 'DELETE' ? new Response(null, { status: 204 }) : Response.json(fixture());
  };
  await realCommentApi.getComments(1);
  await realCommentApi.createComment(1, '```js\nalert(1)\n```');
  await realCommentApi.createReply(1, 1, '답글');
  await realCommentApi.updateComment(1, 1, '수정');
  await realCommentApi.deleteComment(1, 1);
  assert.deepEqual(calls.map(({ options }) => options.method), ['GET', 'POST', 'POST', 'PATCH', 'DELETE']);
  assert.equal(calls[2].url, 'https://backend.example.test/api/posts/1/comments/1/replies');
  assert.equal(calls[1].options.headers.Authorization, 'bearer token');
  assert.deepEqual(JSON.parse(calls[1].options.body), { content: '```js\nalert(1)\n```' });
  assert.equal(calls[1].options.headers['Content-Type'], 'application/json');
  globalThis.fetch = async () => Response.json({ detail: '권한 없음' }, { status: 403 });
  await assert.rejects(realCommentApi.deleteComment(1, 1), (error) => error.status === 403 && error.message === '권한 없음');
});

test('코드와 댓글 HTML은 실행 요소가 되지 않으며 위험 링크·이미지·iframe을 생성하지 않는다', () => {
  const raw = '<script>window.executed = true</script>\n<img src=x onerror="window.executed=true">';
  const markdown = '```html\n' + raw + '\n```\n\n' + raw + '\n\n<iframe src="javascript:alert(1)"></iframe>\n\n'
    + '[위험](javascript:alert%281%29)\n\n![이미지](https://example.com/track.png)';
  const html = renderToStaticMarkup(createElement(MarkdownContent, { content: markdown }));
  const parsed = new JSDOM(html, { runScripts: 'dangerously' });
  assert.equal(parsed.window.executed, undefined);
  assert.equal(parsed.window.document.querySelectorAll('script, iframe, img, object, embed, [onerror]').length, 0);
  assert.equal(parsed.window.document.querySelector('pre code').textContent, raw + '\n');
  assert.equal(parsed.window.document.querySelector('a')?.getAttribute('href'), '');
  assert.equal([...parsed.window.document.querySelectorAll('button')].every((item) => item.textContent === '복사'), true);
  parsed.window.close();
});

test('초기 실패는 빈 목록과 구분하고 StrictMode의 이전 응답과 언마운트 후 결과를 무시한다', async () => {
  const requests = [];
  commentApi.getComments = () => new Promise((resolve, reject) => requests.push({ resolve, reject }));
  const hook = await mountHook(() => useComments(1, null), true);
  assert.equal(hook.current.comments, null); assert.equal(hook.current.loading, true);
  assert.equal(requests.length, 2);
  await act(async () => requests[0].resolve([fixture()]));
  assert.equal(hook.current.comments, null);
  await act(async () => requests[1].reject(new Error('조회 실패')));
  assert.equal(hook.current.loading, false); assert.match(hook.current.error, /조회 실패/);
  await act(async () => hook.current.refresh());
  await act(async () => requests[2].resolve([]));
  assert.deepEqual(hook.current.comments, []);
  await act(async () => hook.current.refresh());
  await hook.unmount();
  await act(async () => requests[3].resolve([fixture()]));
});

test('등록은 중복 요청을 차단하고 목록 재조회 실패를 저장 실패로 보고 재등록하지 않는다', async () => {
  await login();
  commentApi.getComments = async () => [];
  const hook = await mountHook(() => useComments(1, 101));
  let finish; let calls = 0;
  commentApi.createComment = () => { calls++; return new Promise((resolve) => { finish = resolve; }); };
  let pending;
  await act(async () => { pending = hook.current.create('원문'); await assert.rejects(hook.current.create('중복'), /처리 중/); });
  assert.equal(calls, 1);
  commentApi.getComments = async () => { throw new Error('조회만 실패'); };
  await act(async () => { finish(fixture({ user_id: 101 })); await pending; });
  assert.equal(hook.current.comments.length, 1);
  assert.match(hook.current.error, /변경은 완료.*목록 갱신/);
  assert.equal(hook.current.pending, false);
});

test('변경 전에 시작한 오래된 새로고침이 등록 결과를 덮어쓰지 않는다', async () => {
  await login(); commentApi.getComments = async () => [];
  const hook = await mountHook(() => useComments(1, 101));
  let stale;
  commentApi.getComments = () => new Promise((resolve) => { stale = resolve; });
  await act(async () => hook.current.refresh());
  commentApi.createComment = async () => fixture();
  commentApi.getComments = async () => [fixture()];
  await act(async () => { await hook.current.create('본문'); stale([]); });
  assert.equal(hook.current.comments.length, 1);
});

test('폼은 실패 후 코드 초안을 보존하고 재시도 성공 때만 비운다', async () => {
  let fail = true; let calls = 0;
  const hook = await mountHook(() => useCommentForm('', async () => { calls++; if (fail) throw new Error('저장 실패'); }));
  const content = '```cpp\n  int n;\n```';
  await act(async () => hook.current.setContent(content));
  await act(async () => { await hook.current.submit(); });
  assert.equal(hook.current.content, content); assert.equal(hook.current.error, '저장 실패');
  fail = false;
  await act(async () => { await hook.current.submit(); });
  assert.equal(hook.current.content, ''); assert.equal(calls, 2);
});

test('실제 댓글 화면에서 코드블록 언어 선택·등록·수정·삭제가 동작하고 집계와 조회수를 유지한다', async () => {
  await login(); let count;
  const before = store.readMockDatabase().posts[0].view_count;
  const mounted = await mount(createElement(CommentSection, { postId: 1, postAuthorId: 101, onCountChange: (value) => { count = value; } }));
  await waitFor(() => button(mounted.container, '댓글 작성')?.disabled === false);
  const originalCount = count;
  await act(async () => button(mounted.container, '댓글 작성').click());
  await waitFor(() => mounted.container.querySelector('[role=textbox]')?.editor);
  const editor = mounted.container.querySelector('[role=textbox]').editor;
  const toolbar = mounted.container.querySelector('[aria-label="본문 서식 도구"]');
  assert.deepEqual([...toolbar.querySelectorAll('button')].map((node) => node.textContent), ['코드블록']);
  await act(async () => editor.commands.setContent('코드 검토 부탁드립니다.', { contentType: 'markdown' }));
  await act(async () => button(toolbar, '코드블록').click());
  assert.equal(editor.state.doc.firstChild.textContent, '코드 검토 부탁드립니다.');
  assert.equal(editor.state.doc.firstChild.type.name, 'paragraph');
  assert.equal(editor.state.selection.$from.parent.type.name, 'codeBlock');
  await act(async () => editor.commands.insertContent('const answer = 42;'));
  const menu = mounted.container.querySelector('select[aria-label="코드블록 언어"]');
  await act(async () => { menu.value = 'javascript'; menu.dispatchEvent(new window.Event('change', { bubbles: true })); });
  await act(async () => button(mounted.container.querySelector('form'), '등록').click());
  await waitFor(() => count === originalCount + 1);
  await waitFor(() => button(mounted.container, '댓글 새로고침')?.disabled === false);
  await waitFor(() => mounted.container.querySelector('form') === null);
  assert.ok(button(mounted.container, '댓글 작성'));
  // 등록 후 다시 열면 이전 댓글의 본문과 코드가 없는 새 초안으로 시작한다.
  await act(async () => button(mounted.container, '댓글 작성').click());
  await waitFor(() => mounted.container.querySelector('[role=textbox]')?.editor);
  assert.equal(mounted.container.querySelector('[role=textbox]').editor.state.doc.textContent, '');
  await act(async () => button(mounted.container.querySelector('form'), '취소').click());
  const saved = (await commentApi.getComments(1)).find((item) => item.content.includes('const answer'));
  assert.match(saved.content, /```javascript/);
  const article = [...mounted.container.querySelectorAll('article')].find((node) => node.textContent.includes('const answer'));
  await act(async () => button(article, '수정').click());
  await waitFor(() => article.querySelector('[role=textbox]')?.editor);
  await act(async () => article.querySelector('[role=textbox]').editor.commands.setContent('수정된 댓글', { contentType: 'markdown' }));
  await act(async () => button(article, '수정 저장').click());
  await waitFor(() => article.querySelector('form') === null);
  assert.equal((await commentApi.getComments(1)).find((item) => item.id === saved.id).content, '수정된 댓글');
  let warning;
  window.confirm = (message) => { warning = message; return false; };
  await act(async () => button(article, '삭제').click());
  assert.match(warning, /다른 사람이 작성한 답글/);
  assert.equal(count, originalCount + 1);
  window.confirm = () => true;
  await act(async () => button(article, '삭제').click());
  await waitFor(() => count === originalCount);
  await waitFor(() => button(mounted.container, '댓글 새로고침')?.disabled === false);
  assert.equal(store.readMockDatabase().posts[0].view_count, before);
});

test('등록 실패는 편집기·초안을 유지하고 재시도 성공 후 목록 조회만 실패해도 편집기를 닫는다', async () => {
  await login();
  const mounted = await mount(createElement(CommentSection, { postId: 1, postAuthorId: 101, onCountChange: () => {} }));
  await waitFor(() => button(mounted.container, '댓글 작성')?.disabled === false);
  await act(async () => button(mounted.container, '댓글 작성').click());
  await waitFor(() => mounted.container.querySelector('[role=textbox]')?.editor);
  const editor = mounted.container.querySelector('[role=textbox]').editor;
  await act(async () => editor.commands.setContent('유지할 초안', { contentType: 'markdown' }));
  commentApi.createComment = async () => { throw new Error('등록 실패 테스트'); };
  await act(async () => button(mounted.container.querySelector('form'), '등록').click());
  await waitFor(() => mounted.container.querySelector('form [role=alert]'));
  assert.equal(editor.state.doc.textContent, '유지할 초안');
  assert.equal(button(mounted.container, '댓글 작성'), undefined);

  commentApi.createComment = originalComments.createComment;
  commentApi.getComments = async () => { throw new Error('목록 조회 실패 테스트'); };
  await act(async () => button(mounted.container.querySelector('form'), '등록').click());
  await waitFor(() => mounted.container.querySelector('form') === null);
  assert.ok(button(mounted.container, '댓글 작성'));
  assert.ok(mounted.container.textContent.includes('댓글 변경은 완료되었습니다.'));
  assert.equal(store.readMockDatabase().comments.filter((comment) => comment.content === '유지할 초안').length, 1);
});

test('답글은 부모 아래 작성되고 계정 변경 시 이전 폼과 작성자 도구가 사라진다', async () => {
  await login();
  const mounted = await mount(createElement(CommentSection, { postId: 1, postAuthorId: 101, onCountChange: () => {} }));
  await waitFor(() => button(mounted.container, '답글'));
  await act(async () => button(mounted.container, '답글').click());
  await waitFor(() => mounted.container.querySelector('[role=textbox]')?.editor);
  await act(async () => mounted.container.querySelector('[role=textbox]').editor.commands.setContent('새 답글', { contentType: 'markdown' }));
  await act(async () => button(mounted.container.querySelector('form'), '등록').click());
  await waitFor(() => mounted.container.querySelector('form') === null);
  const saved = (await commentApi.getComments(1)).find((item) => item.content === '새 답글');
  assert.equal(saved.parent_comment_id, 1);
  const article = [...mounted.container.querySelectorAll('article')].find((node) => node.textContent.includes('새 답글'));
  assert.equal(button(article, '답글'), undefined);
  await act(async () => button(article, '수정').click());
  await login('dev_hero');
  await waitFor(() => button(mounted.container, '댓글 작성')?.disabled === false);
  assert.equal(mounted.container.querySelector('form'), null);
  const other = [...mounted.container.querySelectorAll('article')].find((node) => node.textContent.includes('새 답글'));
  assert.equal(button(other, '수정'), undefined);
});

test('댓글 조회 실패는 게시글 본문을 유지하고 댓글 변경에도 상세 API를 다시 호출하지 않는다', async () => {
  const post = store.readMockDatabase().posts[0]; let detailCalls = 0;
  postApi.getPost = async () => { detailCalls++; return post; };
  postApi.getLikeStatus = async () => null;
  commentApi.getComments = async () => { throw new Error('댓글만 실패'); };
  const mounted = await mount(createElement(PostDetail, { postId: 1 }));
  await waitFor(() => mounted.container.textContent.includes('댓글만 실패'));
  assert.ok(mounted.container.textContent.includes(post.content));
  assert.equal(detailCalls, 1);
  commentApi.getComments = async () => [fixture()];
  await act(async () => button(mounted.container, '댓글 다시 불러오기').click());
  await waitFor(() => mounted.container.textContent.includes('댓글 1개'));
  assert.equal(detailCalls, 1);
});

import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { createElement, act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

// 편집 유틸리티는 순수 함수로, 렌더러/Hook은 가상 DOM과 실제 React로 검사한다.
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const server = await createServer({
  configFile: false, mode: 'mock',
  server: { middlewareMode: true, watch: null, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] },
});
const utils = await server.ssrLoadModule('/src/features/post/utils/postEditor.ts');
const { PostContent } = await server.ssrLoadModule('/src/features/post/components/PostContent.tsx');
const { postApi } = await server.ssrLoadModule('/src/features/post/services/postApi.ts');
const { usePostForm } = await server.ssrLoadModule('/src/features/post/hooks/usePostForm.ts');
const { PostDetailPage } = await server.ssrLoadModule('/src/pages/PostDetailPage.tsx');
const { MemoryRouter, Routes, Route } = await import('react-router');
const originalCreate = postApi.createPost;

// 테스트가 바꾼 API와 전역 환경을 되돌리고 파일 감시/가상 DOM 자원을 해제한다.
after(async () => {
  postApi.createPost = originalCreate;
  await server.close();
  dom.window.close();
  delete globalThis.window;
  delete globalThis.document;
  delete globalThis.IS_REACT_ACT_ENVIRONMENT;
});

/** 태그 이름 목록을 서버 응답과 같은 id/name 구조로 만든다. */
const tags = (...names) => names.map((name, id) => ({ name, id }));
test('새 글은 말머리 하나와 고유 태그를 저장하고 기존 글의 분류는 태그 순서에 영향받지 않는다', () => {
  assert.deepEqual(utils.getPostTags('코드리뷰', '#C++, C++, 질문, # 질문, , 코드리뷰, 알고리즘'), ['코드리뷰', 'C++', '알고리즘']);
  assert.equal(utils.getPostCategory(tags('React')), '자유');
  assert.equal(utils.getPostCategory(tags('밥친구', '질문')), '질문');
  assert.equal(utils.getPostCategory(tags('질문', '밥친구')), '질문');
  assert.equal(utils.isPostCategory('공지'), false);
});

test('백틱 묶음이 매우 많아도 코드블록 생성이 함수 인자 한도를 초과하지 않는다', () => {
  // 이전의 Math.max(...배열) 구현은 이 입력에서 RangeError를 일으킨다.
  const raw = '` '.repeat(200_000);
  assert.equal(utils.codeFence(raw, 'text'), '```text\n' + raw + '\n```');
});

test('인라인 코드는 내부 백틱과 양끝 공백을 렌더링 후에도 보존한다', () => {
  for (const raw of ['a`b', '`끝`', ' 공백 ', '   ', '앞\n뒤', 'a``b']) {
    const parsed = new JSDOM(renderToStaticMarkup(createElement(PostContent, { content: utils.inlineCode(raw) })));
    assert.equal(parsed.window.document.querySelector('code')?.textContent, raw.replace(/\n/g, ' '));
    parsed.window.close();
  }
});

test('본문의 원시 HTML과 위험한 링크는 실행 가능한 요소로 렌더링되지 않는다', () => {
  // 실제 렌더러 설정을 검사한다. 모든 형태의 XSS 안전성을 증명하는 포괄적인 보안 검사는 아니다.
  const content = '<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n'
    + '[위험](javascript:alert%281%29)\n\n[정상](https://example.com)';
  const parsed = new JSDOM(renderToStaticMarkup(createElement(PostContent, { content })));
  const doc = parsed.window.document;
  assert.equal(doc.querySelectorAll('script, img, [onerror]').length, 0);
  assert.equal(doc.querySelector('a')?.getAttribute('href'), '');
  assert.equal(doc.querySelectorAll('a')[1]?.getAttribute('href'), 'https://example.com');
  parsed.window.close();
});

test('잘못된 게시글 번호는 상세 조회 컴포넌트로 전달하지 않는다', () => {
  for (const id of ['Infinity', '-1', '1.5', '0', '9007199254740992', 'abc']) {
    // 서버 렌더에서는 Effect를 실행하지 않으므로 문구로 URL 검증 분기만 확인한다.
    const html = renderToStaticMarkup(createElement(MemoryRouter, { initialEntries: [`/posts/${id}`] },
      createElement(Routes, null, createElement(Route, { path: '/posts/:postId', element: createElement(PostDetailPage) }))));
    assert.ok(html.includes('잘못된 게시글 번호입니다.'), id);
  }
});

test('같은 렌더에서 연속 등록해도 한 번만 요청하고 저장 후 이동 실패는 저장 성공으로 구분한다', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  let form;
  let finish;
  let calls = 0;
  /** API 저장은 성공하고 이후 비동기 화면 이동만 실패하는 상황을 재현한다. */
  function Probe() {
    form = usePostForm({ onCreated: async () => { throw new Error('화면 이동 실패'); } });
    return null;
  }
  try {
    await act(async () => root.render(createElement(Probe)));
    await act(async () => { form.setTitle('중복 방지'); form.setContent('본문'); });
    postApi.createPost = () => {
      calls += 1;
      return new Promise((resolve) => { finish = resolve; });
    };
    let first;
    let duplicate;
    await act(async () => { first = form.submit(); duplicate = form.submit(); });
    assert.equal(calls, 1);
    assert.equal(await duplicate, null);
    assert.equal(form.isLoading, true);
    let result;
    await act(async () => { finish({ id: 88 }); result = await first; });
    assert.equal(result.id, 88);
    assert.equal(form.title, '');
    assert.equal(form.content, '');
    assert.equal(form.isLoading, false);
    assert.match(form.error, /88번은 등록되었습니다/);
    // 성공 후 잠금이 풀려 다음 새 글은 정상 등록할 수 있어야 한다.
    await act(async () => { form.setTitle('다음 글'); form.setContent('새 본문'); });
    postApi.createPost = async () => ({ id: 89 });
    await act(async () => { assert.equal((await form.submit()).id, 89); });
  } finally {
    await act(async () => root.unmount());
    container.remove();
    postApi.createPost = originalCreate;
  }
});

test('코드 삽입은 선택 범위만 교체하고 뒤의 설명을 보존한다', () => {
  const result = utils.insertBlock('앞 설명\nCODE\n뒤 설명', 5, 9, utils.codeFence('int n = 1;', 'cpp'));
  assert.equal(result.content, '앞 설명\n\n```cpp\nint n = 1;\n```\n\n뒤 설명');
  assert.equal(result.content.slice(result.cursor), '\n뒤 설명');
});

test('백틱과 HTML이 포함된 코드도 한 블록으로 표시하고 뒤의 설명을 보존한다', () => {
  const raw = '```js\nconsole.log("<script>alert(1)</script>");\n```';
  const markdown = utils.codeFence(raw, 'text') + '\n\n뒤 설명';
  const parsed = new JSDOM(renderToStaticMarkup(createElement(PostContent, { content: markdown })));
  assert.equal(parsed.window.document.querySelectorAll('pre').length, 1);
  assert.equal(parsed.window.document.querySelector('pre').textContent, raw + '\n');
  assert.equal(parsed.window.document.querySelectorAll('script').length, 0);
  assert.ok(parsed.window.document.body.textContent.endsWith('뒤 설명'));
  parsed.window.close();
});

test('모든 언어를 표시하고 블록별 강조를 적용하며 일반 텍스트는 강조하지 않는다', () => {
  const content = utils.CODE_LANGUAGES.map(([language]) => utils.codeFence('const answer = 42;', language)).join('\n\n');
  const parsed = new JSDOM(renderToStaticMarkup(createElement(PostContent, { content })));
  assert.equal(parsed.window.document.querySelectorAll('pre').length, utils.CODE_LANGUAGES.length);
  assert.ok(parsed.window.document.querySelector('code.language-javascript .hljs-keyword'));
  assert.equal(parsed.window.document.querySelector('code.language-text').children.length, 0);
  assert.equal(parsed.window.document.querySelectorAll('button').length, utils.CODE_LANGUAGES.length);
  parsed.window.close();
});

test('작성 실패 후 초안 전체를 보존하고 재시도는 기존 API 계약으로 전송한다', async () => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  let form;
  let submitted;
  let created;
  /** 폼 UI 없이 Hook을 마운트해 상태 보존과 API 전달값을 확인한다. */
  function Probe() {
    form = usePostForm({ initialCategory: '코드리뷰', onCreated: (post) => { created = post; } });
    return null;
  }
  try {
    await act(async () => root.render(createElement(Probe)));
    const markdown = '설명\n\n' + utils.codeFence('int value = 3;', 'cpp');
    const image = new dom.window.File(['sample'], 'sample.png', { type: 'image/png' });
    await act(async () => {
      form.setTitle(' 코드 질문 '); form.setContent(markdown);
      form.setHashtagInput('C++, C++, 질문'); form.setImages([image]);
    });
    postApi.createPost = async () => { throw new Error('일시적인 오류'); };
    await act(async () => { await form.submit(); });
    assert.equal(form.content, markdown);
    assert.equal(form.images[0], image);
    assert.equal(form.category, '코드리뷰');
    assert.equal(form.error, '일시적인 오류');
    postApi.createPost = async (params) => { submitted = params; return { id: 77 }; };
    await act(async () => { await form.submit(); });
    assert.deepEqual(submitted, { title: '코드 질문', content: markdown, images: [image], hashtags: ['코드리뷰', 'C++'] });
    assert.deepEqual(created, { id: 77 });
    assert.equal(form.content, '');
    assert.equal(form.images.length, 0);
  } finally {
    await act(async () => root.unmount()); container.remove(); postApi.createPost = originalCreate;
  }
});

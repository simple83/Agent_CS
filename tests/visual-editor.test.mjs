import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';
import { Editor } from '@tiptap/core';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorContent } from '@tiptap/react';
import { renderToStaticMarkup } from 'react-dom/server';

// 실제 편집기 엔진과 상세 렌더러를 함께 사용해 저장 경계에서 서식/코드 손실을 검사한다.
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
for (const name of ['window', 'document', 'Node', 'HTMLElement', 'MutationObserver', 'DOMParser']) {
  globalThis[name] = name === 'window' ? dom.window : dom.window[name];
}
const server = await createServer({
  configFile: false,
  server: { middlewareMode: true, watch: null, hmr: false, ws: false },
  optimizeDeps: { noDiscovery: true, include: [] },
});
const { createVisualEditorExtensions, insertCodeBlockBelow, serializeVisualEditor, isWebLink } =
  await server.ssrLoadModule('/src/shared/components/richText/visualEditor.ts');
const { MarkdownContent: PostContent } = await server.ssrLoadModule('/src/shared/components/richText/MarkdownContent.tsx');
const editors = [];
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { RichTextEditorDisabledContext: PostEditorDisabledContext } = await server.ssrLoadModule('/src/shared/components/richText/RichTextEditorContext.ts');

/** 각 사례마다 문서/실행 취소 이력이 독립된 편집기를 만든다. */
function makeEditor(content = '', variant = 'post') {
  const editor = new Editor({ extensions: createVisualEditorExtensions(variant), content, contentType: 'markdown' });
  editors.push(editor);
  return editor;
}

/** 저장된 문자열을 사용자에게 보여주는 실제 상세 렌더러로 해석한다. */
function renderDetail(markdown) {
  const container = document.createElement('div');
  container.innerHTML = renderToStaticMarkup(createElement(PostContent, { content: markdown }));
  return container;
}

// 엔진의 DOM 감시자와 Vite 서버를 해제해 테스트 프로세스가 남지 않게 한다.
after(async () => {
  editors.forEach((editor) => editor.destroy());
  await server.close();
  dom.window.close();
});

test('서식과 한글 본문을 저장하고 다시 열어도 같은 문서가 된다', () => {
  const editor = makeEditor('한글 **강조**와 *기울임*, [웹](https://example.com)\n\n- 첫 항목\n- 두 번째\n\n> 인용문\n\n1. 번호 항목');
  const markdown = serializeVisualEditor(editor);
  const restored = makeEditor(markdown);
  assert.deepEqual(restored.getJSON(), editor.getJSON());
  const detail = renderDetail(markdown);
  assert.equal(detail.querySelector('strong').textContent, '강조');
  assert.equal(detail.querySelectorAll('li').length, 3);
  assert.equal(detail.querySelector('blockquote').textContent.trim(), '인용문');
  assert.equal(detail.querySelector('a').getAttribute('href'), 'https://example.com');
});

test('코드 언어, 들여쓰기, 내부 백틱과 마지막 빈 줄이 저장 후에도 보존된다', () => {
  const raw = 'const value = `한글`;\n  ```\n<script>alert(1)</script>\n\n';
  const editor = makeEditor();
  editor.commands.setContent({ type: 'doc', content: [
    { type: 'codeBlock', attrs: { language: 'javascript' }, content: [{ type: 'text', text: raw }] },
    { type: 'paragraph', content: [{ type: 'text', text: '뒤 문단' }] },
    { type: 'codeBlock', attrs: { language: 'python' }, content: [{ type: 'text', text: 'print("안녕")' }] },
  ] });
  const markdown = serializeVisualEditor(editor);
  const restored = makeEditor(markdown);
  assert.equal(restored.state.doc.firstChild.textContent, raw);
  assert.equal(restored.state.doc.child(2).attrs.language, 'python');
  const detail = renderDetail(markdown);
  assert.equal(detail.querySelector('pre code').textContent, raw + '\n');
  assert.equal(detail.querySelector('script'), null);
});

test('인라인 코드의 백틱과 양끝 공백을 상세 화면까지 보존한다', () => {
  for (const raw of ['a`b', '`끝`', ' 공백 ', '   ', 'a``b']) {
    const editor = makeEditor();
    editor.commands.setContent({ type: 'doc', content: [{ type: 'paragraph', content: [
      { type: 'text', text: '앞 ' },
      { type: 'text', text: raw, marks: [{ type: 'code' }] },
      { type: 'text', text: ' 뒤' },
    ] }] });
    const markdown = serializeVisualEditor(editor);
    assert.equal(renderDetail(markdown).querySelector('code').textContent, raw);
    assert.deepEqual(makeEditor(markdown).getJSON(), editor.getJSON());
  }
});

test('서식 없는 특수문자와 HTML 예시는 저장 후 뜻하지 않은 서식으로 바뀌지 않는다', () => {
  const raw = '**그대로** <img src=x> [문자](주소) #제목 _밑줄_ `코드 아님`';
  const editor = makeEditor();
  editor.commands.insertContent({ type: 'text', text: raw });
  const detail = renderDetail(serializeVisualEditor(editor));
  assert.equal(detail.textContent.trim(), raw);
  assert.equal(detail.querySelector('strong, img, code, a'), null);
});

test('블록별 언어 메뉴는 커서와 무관하게 해당 블록만 바꾸며 실행 취소와 저장 잠금을 지원한다', async () => {
  const editor = makeEditor('```text\nconst a = 1;\n```');
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    // React 기반 노드 뷰는 실제 EditorContent에 마운트해야 코드와 언어 메뉴를 렌더링한다.
    await act(async () => root.render(createElement(EditorContent, { editor })));
    assert.equal(container.querySelector('[class^=hljs-]'), null);
    await act(async () => editor.commands.setContent('```text\nconst a = 1;\n```\n\n```python\nprint(1)\n```', { contentType: 'markdown' }));
    await act(async () => editor.commands.setTextSelection(editor.state.doc.content.size - 1));
    const menus = container.querySelectorAll('select');
    assert.equal(menus.length, 2);
    await act(async () => {
      menus[0].value = 'javascript';
      menus[0].dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    });
    assert.equal(editor.state.doc.firstChild.attrs.language, 'javascript');
    assert.equal(menus[1].value, 'python');
    assert.ok(container.querySelector('pre code [class^=hljs-]'));
    assert.ok(serializeVisualEditor(editor).includes('```javascript'));
    assert.ok(!serializeVisualEditor(editor).includes('코드블록'));
    await act(async () => editor.commands.undo());
    assert.equal(editor.state.doc.firstChild.attrs.language, 'text');
    assert.equal(editor.state.doc.firstChild.textContent, 'const a = 1;');
    await act(async () => editor.commands.redo());
    assert.equal(editor.state.doc.firstChild.attrs.language, 'javascript');
    await act(async () => {
      editor.setEditable(false, false);
      root.render(createElement(PostEditorDisabledContext.Provider, { value: true }, createElement(EditorContent, { editor })));
    });
    assert.ok([...container.querySelectorAll('select')].every((select) => select.disabled));
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

test('빈 코드블록이나 공백만 입력하면 필수 본문 검증에 전달할 값도 비어 있다', () => {
  for (const markdown of ['', '   ', '```text\n  \n```']) {
    assert.equal(serializeVisualEditor(makeEditor(markdown)), '');
  }
});

test('HTML 붙여넣기의 실행 요소와 인라인 이미지는 문서에 들어가지 않는다', () => {
  const editor = makeEditor();
  editor.commands.insertContent('<p>내용<img src="x" onerror="alert(1)"><script>alert(1)</script><a href="javascript:alert(1)">링크</a></p>');
  assert.equal(editor.view.dom.querySelector('img, script, [onerror], a[href^="javascript:"]'), null);
  assert.equal(isWebLink('javascript:alert(1)'), false);
  assert.equal(isWebLink('data:text/html,test'), false);
  assert.equal(isWebLink('https://example.com/경로'), true);
});


test('목록과 인용 안의 코드, 빈 문단, 줄바꿈이 상세에서도 같은 구조로 표시된다', () => {
  const editor = makeEditor();
  editor.commands.setContent({ type: 'doc', content: [
    { type: 'paragraph', content: [{ type: 'text', text: '첫 줄' }, { type: 'hardBreak' }, { type: 'text', text: '둘째 줄' }] },
    { type: 'paragraph' },
    { type: 'blockquote', content: [
      { type: 'paragraph', content: [{ type: 'text', text: '인용' }] },
      { type: 'codeBlock', attrs: { language: 'cpp' }, content: [{ type: 'text', text: 'int main() {\n  return 0;\n}' }] },
    ] },
    { type: 'orderedList', attrs: { start: 3 }, content: [{ type: 'listItem', content: [
      { type: 'paragraph', content: [{ type: 'text', text: '목록 안의 코드' }] },
      { type: 'codeBlock', attrs: { language: 'python' }, content: [{ type: 'text', text: 'if True:\n  print(1)' }] },
    ] }] },
  ] });
  const markdown = serializeVisualEditor(editor).trim();
  const detail = renderDetail(markdown);
  assert.equal(detail.querySelectorAll('br').length, 1);
  assert.ok(detail.querySelector('blockquote pre code').textContent.includes('  return 0;'));
  assert.equal(detail.querySelector('ol').getAttribute('start'), '3');
  assert.ok(detail.querySelector('li pre code').textContent.includes('  print(1)'));
  assert.ok(Array.from(detail.querySelectorAll('p')).some((p) => p.textContent === '\u00a0'));
});

test('본문 끝의 Shift+Enter와 빈 문단은 API 공백 정리 후에도 보존된다', () => {
  const editor = makeEditor();
  editor.commands.setContent({ type: 'doc', content: [
    { type: 'paragraph', content: [{ type: 'text', text: '끝 줄' }, { type: 'hardBreak' }] },
    { type: 'paragraph' },
  ] });
  const markdown = serializeVisualEditor(editor).trim();
  const detail = renderDetail(markdown);
  assert.equal(detail.querySelectorAll('br').length, 1);
  assert.equal(detail.querySelectorAll('p').length, 2);
  assert.equal(detail.querySelectorAll('p')[1].textContent, '\u00a0');
  assert.ok(!detail.textContent.includes('\\'));
});

for (const variant of ['post', 'comment']) {
  test(`${variant}: 코드 삽입은 문단 중간 커서·선택 범위에도 원문과 뒤 문단을 보존하고 한 번에 취소된다`, () => {
    for (const selection of [3, { from: 2, to: 5 }]) {
      const editor = makeEditor('작성 중인 설명입니다.\n\n뒤 문단', variant);
      editor.commands.setTextSelection(selection);
      const before = editor.getJSON();
      assert.equal(editor.commands.command(insertCodeBlockBelow), true);
      const doc = editor.state.doc;
      assert.equal(doc.child(0).textContent, '작성 중인 설명입니다.');
      assert.equal(doc.child(0).type.name, 'paragraph');
      assert.equal(doc.child(1).type.name, 'codeBlock');
      assert.equal(doc.child(1).textContent, '');
      assert.equal(doc.child(1).attrs.language, 'text');
      assert.equal(doc.child(2).textContent, '뒤 문단');
      assert.equal(editor.state.selection.$from.parent.type.name, 'codeBlock');
      editor.commands.undo();
      assert.deepEqual(editor.getJSON(), before);
      editor.commands.redo();
      assert.equal(editor.state.doc.child(1).type.name, 'codeBlock');
    }
  });

  test(`${variant}: 빈 글과 기존 코드에서도 별도 코드블록을 추가하고 읽기 전용에서는 변경하지 않는다`, () => {
    for (const content of ['', '```python\nprint(1)\n```']) {
      const editor = makeEditor(content, variant);
      const original = editor.state.doc.firstChild.toJSON();
      editor.commands.setTextSelection(1);
      editor.commands.command(insertCodeBlockBelow);
      assert.deepEqual(editor.state.doc.firstChild.toJSON(), original);
      assert.equal(editor.state.doc.child(1).type.name, 'codeBlock');
      assert.equal(editor.state.doc.child(1).textContent, '');
      assert.equal(editor.state.doc.child(2).type.name, 'paragraph');
      const before = editor.getJSON();
      editor.setEditable(false);
      assert.equal(editor.commands.command(insertCodeBlockBelow), false);
      assert.deepEqual(editor.getJSON(), before);
    }
  });
}

test('게시글 목록·인용 안에서도 현재 문단 다음에 코드를 삽입하고 주변 구조를 보존한다', () => {
  for (const content of ['- 목록 설명\n- 다음 항목', '> 인용 설명']) {
    const editor = makeEditor(content);
    let paragraphPosition;
    editor.state.doc.descendants((node, position) => {
      if (node.type.name === 'paragraph' && paragraphPosition === undefined) paragraphPosition = position;
    });
    editor.commands.setTextSelection(paragraphPosition + 2);
    const before = editor.state.doc.textContent;
    assert.equal(editor.commands.command(insertCodeBlockBelow), true);
    const parent = editor.state.selection.$from.node(-1);
    assert.equal(parent.child(0).type.name, 'paragraph');
    assert.equal(parent.child(1).type.name, 'codeBlock');
    assert.equal(editor.state.doc.textContent, before);
  }
});

test('댓글 모드는 일반 문단·코드·줄바꿈만 제공하며 붙여넣기와 과거 서식에서도 텍스트는 보존한다', () => {
  const editor = makeEditor('', 'comment');
  for (const name of ['bold', 'italic', 'code', 'link']) assert.equal(editor.schema.marks[name], undefined);
  for (const name of ['heading', 'bulletList', 'orderedList', 'blockquote', 'horizontalRule']) assert.equal(editor.schema.nodes[name], undefined);
  editor.commands.insertContent('<p><strong>굵게</strong> <em>기울임</em> <a href="https://example.com">링크</a></p><ul><li>항목</li></ul>');
  assert.equal(editor.view.dom.querySelector('strong, em, a, ul, ol, blockquote'), null);
  assert.match(editor.state.doc.textContent, /굵게.*기울임.*링크.*항목/);
  const restored = makeEditor('**굵게**와 *기울임*, `인라인` [링크](https://example.com)\n\n- 항목\n\n```cpp\nint n;\n```', 'comment');
  assert.match(restored.state.doc.textContent, /굵게.*기울임.*인라인.*링크.*항목.*int n;/);
  assert.equal(restored.view.dom.querySelector('strong, em, a, ul'), null);
  const nested = makeEditor('## 제목\n\n> 인용\n\n1. 첫 항목\n   - **중첩** `코드`\n\n     ```python\n     print(1)\n     ```\n\n2. 끝 항목', 'comment');
  assert.match(nested.state.doc.textContent, /제목.*인용.*첫 항목.*중첩.*코드.*print\(1\).*끝 항목/);
  assert.equal(nested.view.dom.querySelector('h2, blockquote, ul, ol, strong'), null);
  // React 코드 노드 뷰를 마운트하지 않은 엔진 테스트이므로 DOM 대신 문서 노드로 검증한다.
  const blocks = nested.getJSON().content.filter((node) => node.type === 'codeBlock');
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].attrs.language, 'python');
  assert.equal(blocks[0].content[0].text, 'print(1)');
  nested.state.doc.check();
  assert.equal(makeEditor(serializeVisualEditor(nested), 'comment').state.doc.textContent, nested.state.doc.textContent);
});

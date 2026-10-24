import { useRef, useState, type ComponentProps } from 'react';
import Markdown, { type ExtraProps } from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import { CODE_LANGUAGES } from '../utils/postEditor';

import 'highlight.js/styles/github-dark.css';
import './PostContent.css';

interface PostContentProps {
  content: string;
}

/*
 * Markdown의 pre 요소를 언어 표시와 복사 버튼이 있는 코드 블록으로 바꾼다.
 * 하이라이트된 code 노드의 language-* 클래스를 읽고, 등록되지 않은 언어도 이름은 표시한다.
 * 컴포넌트를 모듈 범위에 두어 부모가 다시 렌더링될 때 복사 상태가 초기화되지 않게 한다.
 */
const CodeBlock = ({ children, node, ...props }: ComponentProps<'pre'> & ExtraProps) => {
  const codeRef = useRef<HTMLPreElement>(null);
  const [message, setMessage] = useState('');
  const codeNode = node?.children.find((child) => child.type === 'element' && child.tagName === 'code');
  const classes = codeNode?.type === 'element' ? codeNode.properties.className : [];
  const language = Array.isArray(classes) ? String(classes.find((item) => String(item).startsWith('language-')) ?? '').replace('language-', '') : '';
  const label = CODE_LANGUAGES.find(([value]) => value === language)?.[1] ?? (language || '일반 텍스트');
  /** 색상용 HTML 태그를 제외한 코드 텍스트를 복사한다. 권한 거부 시 수동 복사를 안내한다. */
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(codeRef.current?.textContent ?? '');
      setMessage('복사했습니다.');
    } catch {
      setMessage('복사하지 못했습니다. 코드를 선택해 직접 복사해 주세요.');
    }
  };
  return <div className="post-code-block">
    <div className="post-code-toolbar"><span>{label}</span><button type="button" onClick={() => void copy()} aria-label={`${label} 코드 복사`}>복사</button></div>
    <pre {...props} ref={codeRef}>{children}</pre>
    {message && <p className="post-copy-status" role="status">{message}</p>}
  </div>;
};

// 매 렌더마다 새 컴포넌트 정의를 만들지 않도록 렌더러 매핑도 모듈 범위에 둔다.
const markdownComponents = { pre: CodeBlock };

/*
 * 상세 화면과 작성 미리보기에서 동일한 Markdown 문자열을 표시한다.
 * 원시 HTML을 실행하는 플러그인이나 기본 URL 검사를 우회하는 설정을 추가하지 않는다.
 * 하이라이트는 표시 전용이며 코드를 실행하지 않는다. 언어 미지정 코드의 자동 감지도 켜지 않는다.
 */
export const PostContent = ({ content }: PostContentProps) => {
  return (
    <div className="post-content">
      <Markdown rehypePlugins={[rehypeHighlight]} components={markdownComponents}>
        {content}
      </Markdown>
    </div>
  );
};

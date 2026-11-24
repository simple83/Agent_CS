import { isImageUrl } from './markdownImages';
import { useRef, useState, type ComponentProps } from 'react';
import Markdown, { defaultUrlTransform, type ExtraProps } from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import { CODE_LANGUAGES } from './codeFormatting';

import richText from './RichText.module.css';
import syntax from './CodeSyntax.module.css';
import codeStyles from './CodeBlock.module.css';

interface MarkdownContentProps {
  content: string;
  /** 게시글 본문에서만 이미지를 허용한다. 댓글은 기본값 false를 사용한다. */
  allowImages?: boolean;
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
  return <div className={codeStyles.block}>
    <div className={codeStyles.bar}><span>{label}</span><button className={codeStyles.control} type="button" onClick={() => void copy()} aria-label={`${label} 코드 복사`}>복사</button></div>
    <pre {...props} ref={codeRef}>{children}</pre>
    {message && <div className={codeStyles.status} role="status">{message}</div>}
  </div>;
};

// 매 렌더마다 새 컴포넌트 정의를 만들지 않도록 렌더러 매핑도 모듈 범위에 둔다.
/** 본문 이미지는 허용된 주소만 표시하고 외부 요청에 현재 페이지 주소를 보내지 않는다. */
const ContentImage = ({ src, alt, title }: ComponentProps<'img'>) =>
  typeof src === 'string' && isImageUrl(src)
    ? <img src={src} alt={alt ?? ''} title={title} loading="lazy" referrerPolicy="no-referrer" />
    : null;

const markdownComponents = { pre: CodeBlock, img: ContentImage };

/*
 * 저장된 Markdown 문자열을 상세 화면에 표시한다. 시각적 편집기의 저장 결과도 여기서 읽는다.
 * 원시 HTML을 실행하는 플러그인이나 기본 URL 검사를 우회하는 설정을 추가하지 않는다.
 * 하이라이트는 표시 전용이며 코드를 실행하지 않는다. 언어 미지정 코드의 자동 감지도 켜지 않는다.
 */
export const MarkdownContent = ({ content, allowImages = false }: MarkdownContentProps) => {
  return (
    <div className={`${richText.body} ${syntax.syntax}`}>
      {/* HTML은 기본 동작대로 텍스트로 표시하고 실제 요소로 해석하지 않는다. 댓글의 이미지 및 모든 실행형 임베드는 생성하지 않는다.
          skipHtml로 예시 문자열 자체를 삭제하지 않는다. 코드 강조·복사는 문자열만 다루며 실행하지 않는다. */}
      <Markdown disallowedElements={[...(allowImages ? [] : ['img']), 'iframe', 'object', 'embed', 'script', 'style']}
        urlTransform={(url, key) => key === 'src' ? (allowImages && isImageUrl(url) ? url : '') : defaultUrlTransform(url)}
        rehypePlugins={[rehypeHighlight]} components={markdownComponents}>
        {content}
      </Markdown>
    </div>
  );
};

import { fromMarkdown } from 'mdast-util-from-markdown';

/** 화면에 표시할 이미지 URL만 허용한다. SVG/data HTML 및 실행 가능한 스킴은 허용하지 않는다. */
export const isImageUrl = (url: string, draft = false): boolean => {
  if (/^https?:\/\//i.test(url)) return true;
  if (/^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z0-9+/=]+(?:#mock-image-\d+)?$/.test(url)) return true;
  return draft && /^blob:/.test(url);
};

/** Markdown 이미지 하나를 안전하게 직렬화한다. URL을 <>로 감싸 괄호/쿼리 문자열도 보존한다. */
export const imageMarkdown = (alt: string, url: string) =>
  `![${alt.replace(/[\\[\]]/g, '\\$&').replace(/\r?\n/g, ' ')}](<${url.replace(/</g, '%3C').replace(/>/g, '%3E')}>)`;

/**
 * Markdown AST의 실제 이미지 위치만 바꾼다. 코드블록/인라인 코드에 있는 예시 문자열은 건드리지 않는다.
 * 원문 위치를 뒤에서부터 치환하여 코드·공백·줄바꿈을 재직렬화로 훼손하지 않는다.
 * 참조형 이미지도 정의를 찾아 처리하며 기존 본문의 다른 서식은 그대로 둔다.
 */
export const mapMarkdownImages = (content: string, map: (url: string) => string | null): string => {
  const tree = fromMarkdown(content);
  const definitions = new Map<string, string>();
  const changes: { start: number; end: number; text: string }[] = [];
  type AstNode = { type: string; url?: string; alt?: string | null; identifier?: string;
    children?: AstNode[]; position?: { start: { offset?: number }; end: { offset?: number } } };
  const visit = (node: AstNode, action: (item: AstNode) => void) => {
    action(node);
    node.children?.forEach((child) => visit(child, action));
  };
  visit(tree, (node) => { if (node.type === 'definition' && node.identifier && node.url) definitions.set(node.identifier, node.url); });
  visit(tree, (node) => {
    if (node.type !== 'image' && node.type !== 'imageReference') return;
    const url = node.url ?? definitions.get(node.identifier ?? '');
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (url === undefined || start === undefined || end === undefined) return;
    const next = map(url);
    if (next !== url) changes.push({ start, end, text: next === null ? '' : imageMarkdown(node.alt ?? '', next) });
  });
  let result = content;
  for (const change of changes.sort((a, b) => b.start - a.start)) result = result.slice(0, change.start) + change.text + result.slice(change.end);
  return result;
};

/** 본문 이미지 URL 목록. 이미지 파일과 본문 참조의 대응을 검사할 때 사용한다. */
export const imageReferences = (content: string): string[] => {
  const urls: string[] = [];
  mapMarkdownImages(content, (url) => { urls.push(url); return url; });
  return urls;
};

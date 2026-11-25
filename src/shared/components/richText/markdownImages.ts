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
 * 서버 응답에서 확인된 ![설명](<주소) 형태의 닫는 > 누락만 복원한다.
 * 게시글의 images에 있는 안전한 주소와 정확히 일치할 때만 적용하며, 서버 데이터는 변경하지 않는다.
 * 코드·인라인 코드·HTML·링크·정상 이미지 안은 건드리지 않고 일반 텍스트 노드의 원문만 검사한다.
 * 임의 URL이나 의도적으로 이스케이프한 Markdown까지 이미지로 바꾸지 않는다.
 * 백엔드의 주소 치환 오류가 해결되기 전까지 사용하는 제한적인 응답 호환 처리다.
 */
export const repairPostImageMarkdown = (content: string, imageUrls: string[]): string => {
  const urls = [...new Set(imageUrls.filter((url) => isImageUrl(url)))];
  if (!urls.length || !content.includes('](<')) return content;

  const tree = fromMarkdown(content);
  const insertions: number[] = [];
  type Node = { type: string; children?: Node[]; position?: { start: { offset?: number }; end: { offset?: number } } };

  /** Markdown 파서가 일반 문장으로 판정한 영역에서만 누락된 구분자의 위치를 모은다. */
  const visit = (node: Node) => {
    if (['code', 'inlineCode', 'html', 'link', 'linkReference', 'image', 'imageReference', 'definition'].includes(node.type)) return;
    const start = node.position?.start.offset;
    const end = node.position?.end.offset;
    if (node.type === 'text' && start !== undefined && end !== undefined) {
      const source = content.slice(start, end);
      // 설명 안의 이스케이프된 괄호는 허용하되 문단을 넘어가는 추측 복원은 하지 않는다.
      const prefix = /!\[(?:\\.|[^\]\\\r\n[])*\]\(</g;
      for (const match of source.matchAll(prefix)) {
        const position = match.index!;
        let escapes = 0;
        for (let i = start + position - 1; i >= 0 && content[i] === '\\'; i--) escapes++;
        if (escapes % 2) continue;

        const urlStart = position + match[0].length;
        const url = urls.find((candidate) => source.startsWith(`${candidate})`, urlStart));
        if (url) insertions.push(start + urlStart + url.length);
      }
      return;
    }
    node.children?.forEach(visit);
  };

  visit(tree);
  // 뒤쪽부터 넣어 앞서 계산한 원문 위치가 밀리지 않게 한다.
  let repaired = content;
  for (const position of [...new Set(insertions)].sort((a, b) => b - a)) {
    repaired = `${repaired.slice(0, position)}>${repaired.slice(position)}`;
  }
  return repaired;
};

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

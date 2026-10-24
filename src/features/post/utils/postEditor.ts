import type { Hashtag } from '../types/post.types';

/**
 * 현재 API에 category 필드가 없으므로, 아래 이름을 대표 해시태그로 예약한다.
 * 이 순서는 선택 메뉴의 표시 순서이면서 기존 글에 여러 후보가 있을 때의 우선순위다.
 * 이름을 변경하면 이미 저장한 글의 분류에도 영향을 주므로 임의로 바꾸지 않는다.
 */
export const POST_CATEGORIES = ['자유', '질문', '코드리뷰', '정보공유', '모집', '밥친구'] as const;
export type PostCategory = typeof POST_CATEGORIES[number];

/** URL 또는 select에서 받은 문자열을 검사하고 TypeScript의 말머리 타입으로 좁힌다. */
export const isPostCategory = (value: string): value is PostCategory =>
  POST_CATEGORIES.some((category) => category === value);

/**
 * 응답의 해시태그에서 목록/상세에 표시할 말머리 하나를 결정한다.
 * 과거 글의 태그 순서가 달라도 같은 결과가 나오도록 POST_CATEGORIES 순서로 찾는다.
 * 구체적인 말머리가 없으면 자유로 표시하며, DB에 태그를 새로 쓰거나 수정하지 않는다.
 */
export const getPostCategory = (tags: Hashtag[]): PostCategory =>
  POST_CATEGORIES.find((category) =>
    category !== '자유' && tags.some((tag) => tag.name === category),
  ) ?? '자유';

/**
 * 선택한 말머리와 쉼표로 입력한 주제를 기존 API의 hashtags 배열로 합친다.
 * 공백/선행 #/빈 항목/정확히 같은 중복 태그를 제거한다(영문 대소문자는 보존).
 * 자유 입력에 들어온 말머리 이름은 제외하여 새 글에는 대표 말머리 하나만 저장한다.
 */
export const getPostTags = (category: PostCategory, input: string): string[] => [
  category,
  ...new Set(input.split(',')
    .map((tag) => tag.trim().replace(/^#+/, '').trim())
    .filter((tag) => tag && !isPostCategory(tag))),
];

/** [Markdown에 저장할 식별자, 사용자에게 보여줄 이름]. 자동 감지는 사용하지 않는다. */
export const CODE_LANGUAGES = [
  ['text', '일반 텍스트'], ['c', 'C'], ['cpp', 'C++'], ['java', 'Java'],
  ['python', 'Python'], ['javascript', 'JavaScript'], ['typescript', 'TypeScript'],
  ['jsx', 'JSX'], ['tsx', 'TSX'], ['sql', 'SQL'], ['xml', 'HTML'],
  ['css', 'CSS'], ['bash', 'Shell'], ['json', 'JSON'],
] as const;

/**
 * 코드 내부에서 가장 긴 연속 백틱의 길이를 구한다.
 * Math.max(...배열)는 항목이 아주 많으면 함수 인자 수 한도를 초과할 수 있으므로
 * 반복자로 한 덩어리씩 확인한다. 코드의 들여쓰기나 공백은 변경하지 않는다.
 */
const longestBacktickRun = (code: string): number => {
  let longest = 0;
  for (const match of code.matchAll(/`+/g)) longest = Math.max(longest, match[0].length);
  return longest;
};

/**
 * 언어 식별자가 붙은 fenced code block을 생성한다.
 * 내부 백틱보다 긴 구분자를 사용해 Markdown 예시도 하나의 코드블록에 담는다.
 * 허용 목록 밖의 언어는 일반 텍스트로 처리하고, 닫는 구분자는 새 줄에 놓는다.
 */
export function codeFence(code: string, language: string): string {
  const safeLanguage = CODE_LANGUAGES.some(([value]) => value === language) ? language : 'text';
  const fence = '`'.repeat(Math.max(3, longestBacktickRun(code) + 1));
  return `${fence}${safeLanguage}\n${code}${code.endsWith('\n') ? '' : '\n'}${fence}`;
}

/**
 * 선택한 문자열을 인라인 코드로 감싼다. 내부 백틱과 충돌하지 않는 길이를 사용한다.
 * CommonMark가 양끝의 패딩 공백을 하나씩 제거하는 규칙에 맞춰 실제 내용을 보존한다.
 * 여러 줄 선택은 인라인 표현에 맞게 한 줄로 변환한다.
 */
export function inlineCode(code: string): string {
  const text = code.replace(/\r\n?|\n/g, ' ');
  const fence = '`'.repeat(longestBacktickRun(text) + 1);
  const padding = text.startsWith('`') || text.endsWith('`') ||
    (text.startsWith(' ') && text.endsWith(' ') && /[^ ]/.test(text)) ? ' ' : '';
  return `${fence}${padding}${text}${padding}${fence}`;
}

/**
 * textarea의 [start, end) 선택 범위를 블록으로 교체하고 복귀할 커서 위치를 반환한다.
 * 앞뒤에 빈 줄을 확보하여 문단과 코드/목록/인용이 붙어 해석되는 것을 방지한다.
 * DOM을 직접 수정하지 않는 순수 함수여서 편집기와 회귀 테스트가 같은 규칙을 쓴다.
 */
export function insertBlock(content: string, start: number, end: number, block: string) {
  const before = content.slice(0, start);
  const after = content.slice(end);
  const prefix = before ? (before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n') : '';
  const suffix = after.startsWith('\n\n') ? '' : after.startsWith('\n') ? '\n' : '\n\n';
  const inserted = prefix + block + suffix;
  return { content: before + inserted + after, cursor: before.length + inserted.length };
}

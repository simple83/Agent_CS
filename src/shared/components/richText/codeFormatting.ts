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

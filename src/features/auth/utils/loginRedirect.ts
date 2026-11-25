/**
 * 로그인 뒤에는 앱의 글쓰기 화면으로만 복귀를 허용한다.
 * history state를 임의로 바꿔도 외부 주소나 로그인 화면으로 이동하지 않도록 경로를 검증한다.
 * 선택한 말머리 쿼리는 유지하며 복귀 정보가 없거나 잘못되면 기존처럼 목록으로 이동한다.
 */
export const getLoginReturnTo = (state: unknown): string => {
  if (!state || typeof state !== 'object' || !('returnTo' in state) || typeof state.returnTo !== 'string') return '/posts';
  const path = state.returnTo;
  if (!path.startsWith('/posts/create')) return '/posts';
  try {
    const url = new URL(path, 'https://app.invalid');
    return url.origin === 'https://app.invalid' && url.pathname === '/posts/create'
      ? `${url.pathname}${url.search}` : '/posts';
  } catch { return '/posts'; }
};

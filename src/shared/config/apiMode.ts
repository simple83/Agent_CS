// Vite가 시작/빌드 시 값을 치환한다. 실행 중 전환하려면 서버 재시작 또는 재빌드가 필요하다.
export const isMockApi = import.meta.env.VITE_USE_MOCK_API === 'true';

// 경로를 이어 붙일 때 //가 생기지 않도록 주소 끝의 슬래시를 제거한다. 비밀 값은 넣지 않는다.
export const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/+$/, '');

/** /로 시작하는 API 경로를 서버 주소에 연결한다. 주소 누락 시 다른 서버로 잘못 요청하지 않고 실패한다. */
export const realApiUrl = (path: string) => {
  if (!apiBaseUrl) {
    throw new Error('실제 API 주소가 없습니다. .env.real.local 또는 .env.production.local에 VITE_API_BASE_URL을 설정해주세요.');
  }
  // 마스킹 값이나 상대 경로가 프론트 서버로 전송되는 일을 요청 전에 막는다.
  // /api 같은 경로 접두사는 허용하되 쿼리·fragment·자격 증명은 주소에 포함하지 않는다.
  let base: URL;
  try { base = new URL(apiBaseUrl); }
  catch { throw new Error('VITE_API_BASE_URL에 http:// 또는 https://로 시작하는 실제 API 주소를 입력해주세요.'); }
  if (!/^https?:\/\//i.test(apiBaseUrl) || !['http:', 'https:'].includes(base.protocol)
    || base.search || base.hash || base.username || base.password) {
    throw new Error('VITE_API_BASE_URL은 쿼리·로그인 정보가 없는 HTTP(S) 서버 주소여야 합니다.');
  }
  if (!path.startsWith('/') || path.startsWith('//')) throw new Error('API 경로 형식이 올바르지 않습니다.');

  return `${apiBaseUrl}${path}`;
};

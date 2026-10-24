// Vite가 시작/빌드 시 값을 치환한다. 실행 중 전환하려면 서버 재시작 또는 재빌드가 필요하다.
export const isMockApi = import.meta.env.VITE_USE_MOCK_API === 'true';

// 경로를 이어 붙일 때 //가 생기지 않도록 주소 끝의 슬래시를 제거한다. 비밀 값은 넣지 않는다.
export const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

/** /로 시작하는 API 경로를 서버 주소에 연결한다. 주소 누락 시 다른 서버로 잘못 요청하지 않고 실패한다. */
export const realApiUrl = (path: string) => {
  if (!apiBaseUrl) {
    throw new Error('실제 API 주소가 없습니다. .env.real.local 또는 .env.production.local에 VITE_API_BASE_URL을 설정해주세요.');
  }
  return `${apiBaseUrl}${path}`;
};

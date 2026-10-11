// Vite replaces these values when starting the dev server or building the app.
export const isMockApi = import.meta.env.VITE_USE_MOCK_API === 'true';

export const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

export const realApiUrl = (path: string) => {
  if (!apiBaseUrl) {
    throw new Error('실제 API 주소가 없습니다. .env.real.local 또는 .env.production.local에 VITE_API_BASE_URL을 설정해주세요.');
  }
  return `${apiBaseUrl}${path}`;
};

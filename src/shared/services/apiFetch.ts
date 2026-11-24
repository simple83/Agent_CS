import { authStorage } from './authStorage';

/** 보호된 요청의 401만 로그인 메뉴에 반영한다. 변경 요청을 자동 재시도하지 않는다. */
export const apiFetch = async (url: string, options?: RequestInit): Promise<Response> => {
  const authorization = new Headers(options?.headers).get('Authorization');
  const token = authorization?.match(/^bearer\s+(.+)$/i)?.[1];
  const response = await fetch(url, options);
  if (response.status === 401 && token) authStorage.expireAccessToken(token);
  return response;
};

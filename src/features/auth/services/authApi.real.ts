import type {
  DetailResponse,
  LoginRequest,
  LoginResponse,
  LogoutRequest,
  RefreshRequest,
  RefreshResponse,
} from '../types/auth.types';

import type { AuthApi } from '../types/authApi.types';
import { realApiUrl } from '../../../shared/config/apiMode';

const getErrorMessage = async (response: Response, fallback: string) => {
  const errorData = await response.json().catch(() => null);

  if (
    errorData &&
    typeof errorData === 'object' &&
    'detail' in errorData &&
    typeof errorData.detail === 'string'
  ) {
    return errorData.detail;
  }

  return fallback;
};

export const realAuthApi: AuthApi = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response = await fetch(realApiUrl('/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      throw new Error(
        await getErrorMessage(response, '아이디 또는 비밀번호를 확인해주세요.'),
      );
    }

    return response.json();
  },

  refresh: async (request: RefreshRequest): Promise<RefreshResponse> => {
    const response = await fetch(realApiUrl('/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(
        await getErrorMessage(response, '로그인 갱신에 실패했습니다.'),
      );
    }

    return response.json();
  },

  logout: async (request: LogoutRequest): Promise<DetailResponse> => {
    const response = await fetch(realApiUrl('/auth/logout'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(await getErrorMessage(response, '로그아웃에 실패했습니다.'));
    }

    return response.json();
  },
};

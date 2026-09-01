import type {
  DetailResponse,
  LoginRequest,
  LoginResponse,
  LogoutRequest,
  RefreshRequest,
  RefreshResponse,
} from '../types/auth.types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

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

export const authApi = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response = await fetch(`${BASE_URL}/auth/login`, {
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
    const response = await fetch(`${BASE_URL}/auth/refresh`, {
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
    const response = await fetch(`${BASE_URL}/auth/logout`, {
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

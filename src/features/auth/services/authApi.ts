import type { LoginRequest, LoginResponse } from '../types/auth.types'

// Vite 환경 변수 적용 (필요 시 .env 파일에 VITE_API_BASE_URL 설정)
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const authApi = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    // 올바르지 않은 정보 입력 시 HTTPException 대응
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || '아이디 또는 비밀번호를 확인해주세요.');
    }

    return response.json();
  },
};
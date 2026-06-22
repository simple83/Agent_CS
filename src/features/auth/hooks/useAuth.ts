import { useState } from 'react';
import type { LoginRequest, LoginResponse } from '../types/auth.types';
import { authApi } from '../services/authApi';

export const useAuth = () => {
  const [user, setUser] = useState<LoginResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const login = async (credentials: LoginRequest): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const loginData = await authApi.login(credentials);
      setUser(loginData);
      
      // 비고 명세 반영: 발급된 토큰들을 로컬 스토리지 등에 저장하여 관리
      localStorage.setItem('access_token', loginData.access_token);
      localStorage.setItem('refresh_token', loginData.refresh_token);
      
      return true;
    } catch (err: any) {
      setError(err.message || '로그인 처리 중 오류가 발생했습니다.');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return { user, isLoading, error, login };
};
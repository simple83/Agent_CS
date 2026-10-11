import { useState } from 'react';
import { authApi } from '../services/authApi';
import { authStorage } from '../../../shared/services/authStorage';
import type { LoginRequest, LoginResponse } from '../types/auth.types';

export const useAuth = () => {
  const [user, setUser] = useState<LoginResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async (credentials: LoginRequest): Promise<boolean> => {
    setIsLoading(true);
    setError(null);

    try {
      const loginData = await authApi.login(credentials);
      setUser(loginData);

      authStorage.saveLogin(loginData);

      return true;
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : '로그인 처리 중 오류가 발생했습니다.',
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const refreshAccessToken = async (): Promise<boolean> => {
    const refreshToken = authStorage.getRefreshToken();

    if (!refreshToken) {
      setError('refresh token이 없습니다. 다시 로그인해주세요.');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const refreshed = await authApi.refresh({ refresh_token: refreshToken });
      authStorage.saveTokens(refreshed);
      return true;
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : '로그인 갱신 중 오류가 발생했습니다.',
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<boolean> => {
    const refreshToken = authStorage.getRefreshToken();

    if (!refreshToken) {
      authStorage.clear();
      setUser(null);
      return true;
    }

    setIsLoading(true);
    setError(null);

    try {
      await authApi.logout({ refresh_token: refreshToken });
      authStorage.clear();
      setUser(null);
      return true;
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : '로그아웃 처리 중 오류가 발생했습니다.',
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    user,
    isLoading,
    error,
    login,
    logout,
    refreshAccessToken,
  };
};

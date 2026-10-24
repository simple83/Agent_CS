import { useState } from 'react';
import { authApi } from '../services/authApi';
import { authStorage } from '../../../shared/services/authStorage';
import type { LoginRequest, LoginResponse } from '../types/auth.types';

/**
 * 로그인·갱신·로그아웃의 진행 상태와 오류를 UI에 제공한다.
 * user는 이 Hook에서 로그인한 결과이며 앱 전체 인증 상태나 새로고침 후 세션 복원 기능은 아니다.
 * 각 함수는 성공 여부를 반환하고 네트워크 오류는 error로 전달한다.
 */
export const useAuth = () => {
  const [user, setUser] = useState<LoginResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** 자격 증명을 API에 전달하고 성공 시 모드별 저장소에 로그인 정보를 보관한다. */
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

  /** 저장된 리프레시 토큰으로 토큰을 갱신한다. 401 응답에서 자동 실행되는 기능은 아니다. */
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

  /** 서버 세션 무효화에 성공하면 로컬 정보를 지운다. 서버 요청 실패 시 세션은 유지한다. */
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

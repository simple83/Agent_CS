import { useState } from 'react';
import { ApiError } from '../../../shared/services/ApiError';
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
      if (authStorage.getRefreshToken() !== refreshToken) return false;
      authStorage.saveTokens(refreshed);
      return true;
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401 && authStorage.getRefreshToken() === refreshToken) authStorage.clear();
      setError(
        err instanceof Error ? err.message : '로그인 갱신 중 오류가 발생했습니다.',
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * 클릭 시 토큰을 다시 읽어 오래된 메뉴 상태에서도 로그아웃을 처리한다.
   * 갱신 토큰만으로 서버 세션을 종료한다. 이미 무효인 세션의 401도 로컬 로그아웃을 완료한다.
   * 네트워크/서버 장애는 세션을 보존해 재시도할 수 있게 한다.
   */
  const logout = async (): Promise<boolean> => {
    const refreshToken = authStorage.getRefreshToken();

    if (!refreshToken) {
      authStorage.clear();
      setUser(null);
      setError(null);
      return true;
    }

    setIsLoading(true);
    setError(null);

    try {
      await authApi.logout({ refresh_token: refreshToken });
      if (authStorage.getRefreshToken() !== refreshToken) return false;
      authStorage.clear();
      setUser(null);
      return true;
    } catch (err: unknown) {
      // 다른 탭에서 새로 로그인한 토큰은 이전 요청의 인증 오류로 지우지 않는다.
      if (err instanceof ApiError && err.status === 401 && authStorage.getRefreshToken() === refreshToken) {
        authStorage.clear();
        setUser(null);
        return true;
      }
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

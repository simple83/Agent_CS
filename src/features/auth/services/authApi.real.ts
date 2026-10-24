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

/* 오류 응답의 문자열 detail을 우선 사용하고, JSON이 아니거나 구조가 다르면 기본 문구를 쓴다. */
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

/* 인증 HTTP 요청만 담당한다. 토큰 저장과 화면 상태는 Hook에서 처리하며 오류는 예외로 전달한다. */
export const realAuthApi: AuthApi = {
  /* 아이디/비밀번호를 JSON으로 전송하고 로그인 응답을 반환한다. 실패 상태는 오류로 변환한다. */
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

  /* 갱신 토큰을 JSON 본문으로 보내 새 액세스 토큰을 요청한다. 자동 재시도는 수행하지 않는다. */
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

  /* 서버에 갱신 토큰의 무효화를 요청한다. 성공 후 로컬 정보 삭제는 호출자가 수행한다. */
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

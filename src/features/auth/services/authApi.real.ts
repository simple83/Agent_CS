import type {
  DetailResponse,
  LoginRequest,
  LoginResponse,
  LogoutRequest,
  RefreshRequest,
  RefreshResponse,
  SignupRequest,
  SignupResponse,
} from '../types/auth.types';

import { ApiError } from '../../../shared/services/ApiError';
import type { AuthApi } from '../types/authApi.types';
import { realApiUrl } from '../../../shared/config/apiMode';
import { validateSignup } from '../utils/signup';
import { parseLoginResponse, parseRefreshResponse } from '../utils/authContract';
import { authStorage } from '../../../shared/services/authStorage';

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
  /**
   * 탈퇴는 비밀번호를 JSON으로 보내고 성공 상태만으로 완료 처리해 재요청을 막는다.
   * 이 API의 401은 비밀번호 불일치일 수도 있으므로 공통 401 처리로 세션을 즉시 지우지 않는다.
   * 서버 오류 원문에는 비밀번호가 포함될 수 있어 고정 안내만 사용한다.
   */
  async withdraw(password) {
    if (!password) throw new Error('현재 비밀번호를 입력해주세요.');
    const token = authStorage.getAccessToken();
    if (!token) throw new Error('로그인 후 이용해주세요.');
    const response = await fetch(realApiUrl('/auth/withdraw'), {
      method: 'DELETE', headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (!response.ok) throw new ApiError([400, 401, 403].includes(response.status)
      ? '비밀번호와 로그인 상태를 확인해주세요.' : '회원 탈퇴에 실패했습니다. 잠시 후 다시 시도해주세요.', response.status);
  },

  /**
   * 인증 없이 JSON 본문으로 가입한다. 응답에 토큰이 없으므로 인증 저장소는 변경하지 않는다.
   * 422의 상세 검증 데이터에는 입력 비밀번호가 포함될 수 있어 원문을 화면에 노출하지 않는다.
   * 계정 생성 요청은 자동 재전송하지 않는다. 최종 중복 검사와 비밀번호 해시는 서버 책임이다.
   */
  signup: async (request: SignupRequest): Promise<SignupResponse> => {
    validateSignup(request);
    const response = await fetch(realApiUrl('/auth/signup'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_id: request.account_id, password: request.password }),
    });

    if (!response.ok) {
      const messages: Record<number, string> = {
        409: '이미 사용 중인 아이디입니다. 다른 아이디를 입력해주세요.',
        422: '아이디 또는 비밀번호가 서버의 가입 조건을 충족하지 않습니다. 입력 내용을 확인해주세요.',
        429: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
      };
      throw new ApiError(messages[response.status] ?? '회원가입에 실패했습니다. 잠시 후 다시 시도해주세요.', response.status);
    }

    const data: unknown = await response.json();
    if (!data || typeof data !== 'object' || !('user_id' in data) || !Number.isSafeInteger(data.user_id)
      || Number(data.user_id) < 1 || !('account_id' in data) || data.account_id !== request.account_id
      || !('created_at' in data) || typeof data.created_at !== 'string') {
      throw new Error('가입 응답을 확인하지 못했습니다. 로그인 화면에서 가입 여부를 확인해주세요.');
    }

    return { user_id: data.user_id as number, account_id: data.account_id, created_at: data.created_at };
  },

  /* 아이디/비밀번호를 JSON으로 전송하고 로그인 응답을 반환한다. 실패 상태는 오류로 변환한다. */
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response = await fetch(realApiUrl('/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      throw new ApiError(
        await getErrorMessage(response, '아이디 또는 비밀번호를 확인해주세요.'), response.status,
      );
    }

    return parseLoginResponse(await response.json());
  },

  /* 갱신 토큰을 JSON 본문으로 보내 새 액세스 토큰을 요청한다. 자동 재시도는 수행하지 않는다. */
  refresh: async (request: RefreshRequest): Promise<RefreshResponse> => {
    const response = await fetch(realApiUrl('/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new ApiError(
        await getErrorMessage(response, '로그인 갱신에 실패했습니다.'), response.status,
      );
    }

    return parseRefreshResponse(await response.json());
  },

  /* 서버에 갱신 토큰의 무효화를 요청한다. 성공 후 로컬 정보 삭제는 호출자가 수행한다. */
  logout: async (request: LogoutRequest): Promise<DetailResponse> => {
    const response = await fetch(realApiUrl('/auth/logout'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new ApiError(await getErrorMessage(response, '로그아웃에 실패했습니다.'), response.status);
    }

    return response.json();
  },
};

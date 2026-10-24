import type {
  DetailResponse, LoginRequest, LoginResponse, LogoutRequest, RefreshRequest, RefreshResponse,
} from './auth.types';

/* 실제 HTTP와 Mock 구현이 함께 만족해야 하는 인증 서비스 계약이다. */
export interface AuthApi {
  /* 자격 증명을 검사하고 새 로그인 세션을 발급한다. */
  login(credentials: LoginRequest): Promise<LoginResponse>;

  /* 유효한 갱신 토큰으로 액세스 토큰을 교체한다. */
  refresh(request: RefreshRequest): Promise<RefreshResponse>;

  /* 지정된 세션을 무효화한다. 로컬 토큰 삭제는 호출자 책임이다. */
  logout(request: LogoutRequest): Promise<DetailResponse>;
}

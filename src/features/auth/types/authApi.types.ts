import type {
  DetailResponse, LoginRequest, LoginResponse, LogoutRequest, RefreshRequest, RefreshResponse, SignupRequest, SignupResponse,
} from './auth.types';

/* 실제 HTTP와 Mock 구현이 함께 만족해야 하는 인증 서비스 계약이다. */
export interface AuthApi {
  /** 아이디와 비밀번호로 계정을 생성한다. 토큰 저장이나 자동 로그인은 하지 않는다. */
  signup(request: SignupRequest): Promise<SignupResponse>;

  /* 자격 증명을 검사하고 새 로그인 세션을 발급한다. */
  login(credentials: LoginRequest): Promise<LoginResponse>;

  /* 유효한 갱신 토큰으로 액세스 토큰을 교체한다. */
  refresh(request: RefreshRequest): Promise<RefreshResponse>;

  /* 지정된 세션을 무효화한다. 로컬 토큰 삭제는 호출자 책임이다. */
  logout(request: LogoutRequest): Promise<DetailResponse>;

  /** 비밀번호를 확인해 계정을 비활성화한다. 성공한 현재 세션 정리는 UI에서 담당한다. */
  withdraw(password: string): Promise<void>;
}

/* 로그인 요청 본문. 비밀번호는 변형하지 않고 서버에 전달한다. */
export interface LoginRequest {
  account_id: string;
  password: string;
}

/* 로그인 성공 시 받는 토큰과 사용자 식별자. 화면 프로필 전체를 의미하지는 않는다. */
export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user_id: number;
  account_id: string;
}

/* 액세스 토큰 갱신에 사용할 리프레시 토큰을 담는다. */
export interface RefreshRequest {
  refresh_token: string;
}

/* 갱신 후 저장할 토큰 묶음. 현재 계약에서는 리프레시 토큰은 유지된다. */
export interface RefreshResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

/* 종료할 세션을 리프레시 토큰으로 지정한다. */
export interface LogoutRequest {
  refresh_token: string;
}

/* 로그아웃 등에서 반환하는 서버 안내 문구다. */
export interface DetailResponse {
  detail: string;
}

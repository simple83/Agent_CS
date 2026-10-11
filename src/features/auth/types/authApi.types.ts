import type {
  DetailResponse, LoginRequest, LoginResponse, LogoutRequest, RefreshRequest, RefreshResponse,
} from './auth.types';

export interface AuthApi {
  login(credentials: LoginRequest): Promise<LoginResponse>;
  refresh(request: RefreshRequest): Promise<RefreshResponse>;
  logout(request: LogoutRequest): Promise<DetailResponse>;
}

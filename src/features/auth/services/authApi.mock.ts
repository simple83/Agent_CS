import type { AuthApi } from '../types/authApi.types';
import {
  MOCK_USERS, readMockDatabase, saveMockDatabase, waitForMockRequest,
} from '../../../shared/mocks/mockStore';

/** 네트워크 없이 로그인 계약을 재현한다. 평문 시연 계정과 localStorage 세션은 개발 전용이다. */
export const mockAuthApi: AuthApi = {
  /** 계정을 대조하고 액세스 1시간/갱신 7일 세션을 발급한다. 만료된 기존 세션은 정리한다. */
  async login(credentials) {
    await waitForMockRequest();
    const user = MOCK_USERS.find((item) => item.account_id === credentials.account_id
      && item.password === credentials.password);
    if (!user) throw new Error('아이디 또는 비밀번호를 확인해주세요.');

    const data = readMockDatabase();
    const session = {
      user_id: user.id,
      access_token: `mock-access-${crypto.randomUUID()}`,
      refresh_token: `mock-refresh-${crypto.randomUUID()}`,
      expires_at: Date.now() + 60 * 60 * 1000,
      refresh_expires_at: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };
    data.sessions = data.sessions.filter((item) => item.refresh_expires_at > Date.now());
    data.sessions.push(session);
    saveMockDatabase(data);
    return {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      token_type: 'bearer',
      user_id: user.id,
      account_id: user.account_id,
    };
  },
  /** 갱신 토큰이 유효한 세션의 액세스 토큰만 교체한다. 갱신 토큰과 그 만료일은 유지한다. */
  async refresh({ refresh_token }) {
    await waitForMockRequest();
    const data = readMockDatabase();
    const session = data.sessions.find((item) => item.refresh_token === refresh_token);
    if (!session || session.refresh_expires_at <= Date.now()) {
      throw new Error('refresh token이 유효하지 않거나 만료되었습니다.');
    }
    session.access_token = `mock-access-${crypto.randomUUID()}`;
    session.expires_at = Date.now() + 60 * 60 * 1000;
    saveMockDatabase(data);
    return { access_token: session.access_token, refresh_token, token_type: 'bearer' };
  },
  /** 해당 갱신 토큰의 세션을 삭제한다. 같은 사용자의 다른 로그인 세션은 유지한다. */
  async logout({ refresh_token }) {
    await waitForMockRequest();
    const data = readMockDatabase();
    const session = data.sessions.find((item) => item.refresh_token === refresh_token);
    if (!session || session.refresh_expires_at <= Date.now()) {
      throw new Error('refresh token이 유효하지 않거나 만료되었습니다.');
    }
    data.sessions = data.sessions.filter((item) => item !== session);
    saveMockDatabase(data);
    return { detail: '로그아웃이 완료되었습니다.' };
  },
};

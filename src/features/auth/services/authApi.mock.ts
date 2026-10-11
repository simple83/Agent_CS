import type { AuthApi } from '../types/authApi.types';
import {
  MOCK_USERS, readMockDatabase, saveMockDatabase, waitForMockRequest,
} from '../../../shared/mocks/mockStore';

export const mockAuthApi: AuthApi = {
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

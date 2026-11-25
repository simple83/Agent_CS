import { ApiError } from '../../../shared/services/ApiError';
import type { AuthApi } from '../types/authApi.types';
import { validateSignup } from '../utils/signup';
import { deriveMockPassword } from '../../../shared/mocks/mockPassword';
import {
  MOCK_USERS, readMockDatabase, saveMockDatabase, waitForMockRequest, findMockUser, requireMockUser, getMockProfile,
} from '../../../shared/mocks/mockStore';
import { authStorage } from '../../../shared/services/authStorage';

/** 네트워크 없이 로그인 계약을 재현한다. 평문 시연 계정과 localStorage 세션은 개발 전용이다. */
export const mockAuthApi: AuthApi = {
  /**
   * 비밀번호 확인 뒤 해당 계정만 비활성화하고 모든 세션을 제거한다. 기존 글·댓글은 보존한다.
   * TODO(백엔드 협의): 탈퇴자의 글·댓글 삭제/익명화 정책이 확정되면 조회 표시 정책도 맞춘다.
   */
  async withdraw(password) {
    const token = authStorage.getAccessToken();
    await waitForMockRequest();
    if (!token || authStorage.getAccessToken() !== token) throw new Error('로그인 상태가 변경되었습니다.');
    const user = requireMockUser(readMockDatabase());
    const correct = 'password' in user ? password === user.password
      : await deriveMockPassword(password, user.password_salt) === user.password_hash;
    if (!correct) throw new ApiError('비밀번호를 확인해주세요.', 400);
    if (authStorage.getAccessToken() !== token) throw new Error('로그인 상태가 변경되었습니다.');
    const data = readMockDatabase();
    if (requireMockUser(data).id !== user.id) throw new Error('로그인 상태가 변경되었습니다.');
    data.profiles ??= {};
    data.profiles[user.id] = { ...getMockProfile(data, user.id), is_active: false, updated_at: new Date().toISOString() };
    data.sessions = data.sessions.filter((session) => session.user_id !== user.id);
    saveMockDatabase(data);
  },

  /**
   * 가입 계약과 중복 아이디 오류를 재현한다. 세션은 만들지 않고 프로필의 임시 표시명은 아이디로 사용한다.
   * 비동기 비밀번호 처리 후 DB를 다시 읽어 같은 탭의 연속 가입이나 다른 데이터 변경을 덮어쓰지 않는다.
   */
  async signup(request) {
    validateSignup(request);
    await waitForMockRequest();

    const exists = () => MOCK_USERS.some((user) => user.account_id === request.account_id)
      || readMockDatabase().users.some((user) => user.account_id === request.account_id);
    if (exists()) throw new ApiError('이미 사용 중인 아이디입니다. 다른 아이디를 입력해주세요.', 409);

    const salt = crypto.randomUUID();
    const hash = await deriveMockPassword(request.password, salt);
    // 파생값 생성 중 같은 아이디로 가입한 요청이 먼저 저장되었을 수 있다.
    if (exists()) throw new ApiError('이미 사용 중인 아이디입니다. 다른 아이디를 입력해주세요.', 409);
    const data = readMockDatabase();
    const id = data.users.reduce((max, user) => Math.max(max, user.id), 102) + 1;
    const createdAt = new Date().toISOString();
    data.users.push({ id, account_id: request.account_id, username: request.account_id, created_at: createdAt,
      password_salt: salt, password_hash: hash });
    saveMockDatabase(data);

    return { user_id: id, account_id: request.account_id, created_at: createdAt };
  },

  /** 계정을 대조하고 액세스 1시간/갱신 7일 세션을 발급한다. 만료된 기존 세션은 정리한다. */
  async login(credentials) {
    await waitForMockRequest();
    const example = MOCK_USERS.find((item) => item.account_id === credentials.account_id
      && item.password === credentials.password);
    const registered = readMockDatabase().users.find((item) => item.account_id === credentials.account_id);
    const user = example ?? (registered
      && await deriveMockPassword(credentials.password, registered.password_salt) === registered.password_hash ? registered : undefined);
    if (!user) throw new Error('아이디 또는 비밀번호를 확인해주세요.');

    const data = readMockDatabase();
    // 비밀번호 검사 중 Mock 데이터가 초기화되면 삭제된 계정의 세션을 새로 만들지 않는다.
    if (!findMockUser(data, user.id) || (!example && !data.users.some((item) => item.id === user.id && item.password_hash === registered?.password_hash))) {
      throw new Error('계정 정보가 변경되었습니다. 다시 로그인해주세요.');
    }
    const session = {
      user_id: user.id,
      access_token: `mock-access-${crypto.randomUUID()}`,
      refresh_token: `mock-refresh-${crypto.randomUUID()}`,
      expires_at: Date.now() + 60 * 60 * 1000,
      refresh_expires_at: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };
    data.sessions = data.sessions.filter((item) => item.refresh_expires_at > Date.now() && item.user_id !== user.id);
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
    if (!session || session.refresh_expires_at <= Date.now() || !findMockUser(data, session.user_id)) {
      throw new ApiError('refresh token이 유효하지 않거나 만료되었습니다.', 401);
    }
    session.access_token = `mock-access-${crypto.randomUUID()}`;
    session.expires_at = Date.now() + 60 * 60 * 1000;
    saveMockDatabase(data);
    return { access_token: session.access_token, token_type: 'bearer' };
  },
  /**
   * 해당 갱신 토큰의 세션을 삭제한다. 없거나 만료된 세션은 실제 API처럼 401로 전달한다.
   * Hook에서 401을 로컬 로그아웃 완료로 처리한다. 다른 세션·게시글은 보존한다.
   * 저장소 오류/테스트 요청 실패는 그대로 전달하므로 실제 실패를 성공으로 숨기지는 않는다.
   */
  async logout({ refresh_token }) {
    await waitForMockRequest();
    const data = readMockDatabase();
    const session = data.sessions.find((item) => item.refresh_token === refresh_token);
    if (!session || session.refresh_expires_at <= Date.now()) throw new ApiError('이미 종료되었거나 만료된 세션입니다.', 401);
    if (session) {
      data.sessions = data.sessions.filter((item) => item !== session);
      saveMockDatabase(data);
    }
    return { message: '로그아웃되었습니다.' };
  },
};

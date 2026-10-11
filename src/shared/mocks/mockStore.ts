import { MOCK_POSTS } from '../../features/post/mocks/mockPosts';
import type { PostEntity } from '../../features/post/types/post.types';
import { authStorage } from '../services/authStorage';

const DATABASE_KEY = 'agent-cs:mock:v1:database';
const FAILURE_KEY = 'agent-cs:mock:v1:fail-next';

// These are public demo accounts, never real backend credentials.
export const MOCK_USERS = [
  { id: 101, account_id: 'jinwoo99', username: '진우', password: 'mock1234' },
  { id: 102, account_id: 'dev_hero', username: '개발용사', password: 'mock1234' },
] as const;

export interface MockSession {
  user_id: number;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  refresh_expires_at: number;
}

export interface MockDatabase {
  version: 1;
  posts: PostEntity[];
  sessions: MockSession[];
  // Seed counts are sample totals; this map records demo users' new likes.
  likes: Record<string, number[]>;
}

export const readMockDatabase = (): MockDatabase => {
  const stored = localStorage.getItem(DATABASE_KEY);
  if (!stored) {
    return { version: 1, posts: structuredClone(MOCK_POSTS), sessions: [], likes: {} };
  }
  try {
    const data: MockDatabase = JSON.parse(stored);
    if (data.version !== 1 || !Array.isArray(data.posts) || !Array.isArray(data.sessions)
      || !data.likes || typeof data.likes !== 'object' || Array.isArray(data.likes)) {
      throw new Error('Invalid mock database');
    }
    return data;
  } catch {
    throw new Error('Mock 저장 데이터를 읽을 수 없습니다. 상단의 Mock 초기화를 실행해주세요.');
  }
};

export const saveMockDatabase = (data: MockDatabase) => {
  try {
    localStorage.setItem(DATABASE_KEY, JSON.stringify(data));
  } catch {
    throw new Error('Mock 저장 공간이 부족하거나 사용할 수 없습니다. 작은 이미지를 사용하거나 Mock 데이터를 초기화해주세요.');
  }
};

export const resetMockData = () => {
  localStorage.removeItem(DATABASE_KEY);
  localStorage.removeItem(FAILURE_KEY);
  // Explicit mock keys: this helper must never clear real credentials.
  for (const key of ['access_token', 'refresh_token', 'user_id', 'account_id']) {
    localStorage.removeItem(`agent-cs:mock:auth:${key}`);
  }
};

export const failNextMockRequest = () => localStorage.setItem(FAILURE_KEY, 'true');

export const waitForMockRequest = async () => {
  const configured = Number(import.meta.env.VITE_MOCK_DELAY_MS ?? 300);
  const delay = Number.isFinite(configured) ? Math.max(0, Math.min(configured, 5000)) : 300;
  await new Promise((resolve) => setTimeout(resolve, delay));
  if (localStorage.getItem(FAILURE_KEY) === 'true') {
    localStorage.removeItem(FAILURE_KEY);
    throw new Error('테스트용 Mock 요청 실패입니다. 다시 시도해주세요.');
  }
};

export const requireMockUser = (data: MockDatabase) => {
  const token = authStorage.getAccessToken();
  const session = data.sessions.find((item) => item.access_token === token);
  if (!session || session.expires_at <= Date.now()) {
    throw new Error('인증 토큰이 없거나 만료되었습니다. Mock 계정으로 로그인해주세요.');
  }
  const user = MOCK_USERS.find((item) => item.id === session.user_id);
  if (!user) throw new Error('존재하지 않는 Mock 사용자입니다.');
  return user;
};

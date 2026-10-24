import { MOCK_POSTS } from '../../features/post/mocks/mockPosts';
import type { PostEntity } from '../../features/post/types/post.types';
import { authStorage } from '../services/authStorage';

const DATABASE_KEY = 'agent-cs:mock:v1:database';
const FAILURE_KEY = 'agent-cs:mock:v1:fail-next';

// 공개된 시연 전용 계정이다. 실제 서버의 계정/비밀번호를 이 파일에 넣지 않는다.
export const MOCK_USERS = [
  { id: 101, account_id: 'jinwoo99', username: '진우', password: 'mock1234' },
  { id: 102, account_id: 'dev_hero', username: '개발용사', password: 'mock1234' },
] as const;

/** 브라우저 안에서 토큰 만료·갱신을 재현하기 위한 세션이다. 실제 인증 수단으로 사용하지 않는다. */
export interface MockSession {
  user_id: number;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  refresh_expires_at: number;
}

/** 하나의 저장소 키에 직렬화하는 시연 DB. version은 저장 구조 변경 시 호환성 판단에 사용한다. */
export interface MockDatabase {
  version: 1;
  posts: PostEntity[];
  sessions: MockSession[];
  // 기본 좋아요 수는 예시 합계이며, 이 맵에는 시연 계정이 추가한 좋아요만 기록한다.
  likes: Record<string, number[]>;
}

/**
 * 저장된 DB를 읽거나 첫 실행에 예제 데이터의 복사본을 만든다.
 * 손상된 저장값은 자동 삭제하지 않고 초기화를 안내한다. 검사 범위는 최상위 구조이며
 * 모든 게시글 필드를 검증하는 보안 경계가 아니다. 여러 탭 사이의 동시 쓰기 잠금도 제공하지 않는다.
 */
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

/** JSON으로 저장한다. 용량 초과/저장소 차단 시 성공처럼 보이지 않도록 사용자용 오류를 던진다. */
export const saveMockDatabase = (data: MockDatabase) => {
  try {
    localStorage.setItem(DATABASE_KEY, JSON.stringify(data));
  } catch {
    throw new Error('Mock 저장 공간이 부족하거나 사용할 수 없습니다. 작은 이미지를 사용하거나 Mock 데이터를 초기화해주세요.');
  }
};

/** 시연 DB·실패 예약·Mock 인증만 삭제한다. 다음 조회는 다시 예제 데이터로 시작한다. */
export const resetMockData = () => {
  localStorage.removeItem(DATABASE_KEY);
  localStorage.removeItem(FAILURE_KEY);
  // 현재 실행 모드와 무관하게 명시적인 Mock 키만 지워 실제 로그인 정보를 보호한다.
  for (const key of ['access_token', 'refresh_token', 'user_id', 'account_id']) {
    localStorage.removeItem(`agent-cs:mock:auth:${key}`);
  }
};

/** 다음 Mock 요청 한 번을 실패시키도록 예약한다. 동시에 요청하면 먼저 확인한 요청이 소비한다. */
export const failNextMockRequest = () => localStorage.setItem(FAILURE_KEY, 'true');

/** 설정된 지연(0~5000ms) 후 실패 예약을 소비한다. 실패는 DB 변경 전에 발생하여 재시도할 수 있다. */
export const waitForMockRequest = async () => {
  const configured = Number(import.meta.env.VITE_MOCK_DELAY_MS ?? 300);
  const delay = Number.isFinite(configured) ? Math.max(0, Math.min(configured, 5000)) : 300;
  await new Promise((resolve) => setTimeout(resolve, delay));
  if (localStorage.getItem(FAILURE_KEY) === 'true') {
    localStorage.removeItem(FAILURE_KEY);
    throw new Error('테스트용 Mock 요청 실패입니다. 다시 시도해주세요.');
  }
};

/** 액세스 토큰에 연결된 세션의 만료와 사용자를 확인한다. 작성·수정 등 인증 필요 동작에서 사용한다. */
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

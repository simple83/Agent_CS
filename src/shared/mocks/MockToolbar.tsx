import { useState } from 'react';
import { authApi } from '../../features/auth/services/authApi';
import { authStorage } from '../services/authStorage';
import { failNextMockRequest, resetMockData } from './mockStore';

/** Mock 모드에서만 로드하는 테스트 도구. 초기화·실패 예약으로 오류/복구 흐름을 직접 확인한다. */
export const MockToolbar = () => {
  const [message, setMessage] = useState('');
  /** Mock 세션 무효화 후 저장된 토큰을 지우고 로그인으로 이동한다. 실패 시 안내 문구를 남긴다. */
  const logout = async () => {
    try {
      const refreshToken = authStorage.getRefreshToken();
      if (refreshToken) await authApi.logout({ refresh_token: refreshToken });
      authStorage.clear();
      window.location.assign('/login');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '로그아웃에 실패했습니다.');
    }
  };
  return (
    <aside aria-label="Mock 테스트 도구" style={{ padding: 12, background: '#fff3cd', color: '#332701', textAlign: 'left', fontSize: 14 }}>
      <strong>MOCK 모드 · 백엔드 연결 없음</strong>
      <p>테스트 계정: jinwoo99 또는 dev_hero / 비밀번호: mock1234</p>
      <nav aria-label="Mock 테스트 화면 이동" style={{ display: 'flex', gap: 12, flexWrap: 'wrap', margin: '8px 0' }}>
        <a href="/login">로그인</a>
        <a href="/posts">목록</a>
        <a href="/posts/create">글쓰기</a>
        <a href="/posts/2">코드블록 예제</a>
      </nav>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => void logout()}>Mock 로그아웃</button>
        {/* 실패 예약은 지금 요청하지 않고 다음 API 호출에서 한 번 소비된다. */}
        <button type="button" onClick={() => {
          failNextMockRequest();
          setMessage('다음 Mock API 요청 1회가 실패합니다. 검색·로그인·글 등록 등으로 확인하세요.');
        }}>다음 요청 실패시키기</button>
        <button type="button" onClick={() => {
          // 로컬에서 작성한 글이 지워지므로 사용자 확인 후 전체 페이지를 다시 로드한다.
          if (!window.confirm('작성한 Mock 게시글과 Mock 로그인을 초기화할까요?')) return;
          resetMockData();
          window.location.assign('/posts');
        }}>Mock 초기화</button>
      </div>
      <p role="status">{message}</p>
    </aside>
  );
};

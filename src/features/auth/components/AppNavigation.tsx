import { useRef } from 'react';
import { NavLink, useNavigate } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import { useAuthSession } from '../hooks/useAuthSession';

/** 공통 메뉴의 인증 버튼을 현재 세션과 연결한다. 로그아웃 요청은 기존 Mock/Real API를 사용한다. */
export const AppNavigation = () => {
  const loggedIn = useAuthSession();
  const { logout, isLoading, error } = useAuth();
  const navigate = useNavigate();
  const pending = useRef(false);

  /** 연속 클릭을 막고 성공할 때만 이동한다. 실패 시 세션과 현재 화면을 유지해 재시도할 수 있다. */
  const handleLogout = async () => {
    if (pending.current) return;
    pending.current = true;
    try {
      if (await logout()) navigate('/login', { replace: true });
    } finally {
      pending.current = false;
    }
  };

  return (
    <>
      <nav className="app-nav" aria-label="주요 메뉴">
        <NavLink to="/posts" end>게시글 목록</NavLink>
        <NavLink to="/posts/create">글쓰기</NavLink>
        {loggedIn ? (
          <button type="button" disabled={isLoading} onClick={() => void handleLogout()}>
            {isLoading ? '로그아웃 중...' : '로그아웃'}
          </button>
        ) : <NavLink to="/login">로그인</NavLink>}
      </nav>

      {loggedIn && error && <p className="app-auth-error" role="alert">{error}</p>}
    </>
  );
};

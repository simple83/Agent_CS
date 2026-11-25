import styles from './AppNavigation.module.css';
import { useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import { useAuthSession } from '../hooks/useAuthSession';

/** 공통 메뉴의 인증 버튼을 현재 세션과 연결한다. 로그아웃 요청은 기존 Mock/Real API를 사용한다. */
export const AppNavigation = () => {
  // 공통 메뉴는 페이지 이동에도 유지된다. 경로 변경을 구독해 저장소 스냅샷을 다시 읽는다.
  useLocation();

  const loggedIn = useAuthSession();
  const { logout, isLoading, error } = useAuth();
  const navigate = useNavigate();
  const pending = useRef(false);

  /** 중복 요청을 막는다. 토큰이 없는 경우도 logout이 성공으로 처리해 로그인 화면으로 이동한다. */
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
      <nav className={styles.nav} aria-label="주요 메뉴">
        <NavLink className={styles.item} to="/posts" end>게시글 목록</NavLink>
        <NavLink className={styles.item} to="/posts/create">글쓰기</NavLink>
        {loggedIn && <NavLink className={styles.item} to="/profile">내 프로필</NavLink>}
        {loggedIn ? (
          <button className={styles.item} type="button" disabled={isLoading} onClick={() => void handleLogout()}>
            {isLoading ? '로그아웃 중...' : '로그아웃'}
          </button>
        ) : <NavLink className={styles.item} to="/login">로그인</NavLink>}
      </nav>

      {loggedIn && error && <p className={styles.error} role="alert">{error}</p>}
    </>
  );
};

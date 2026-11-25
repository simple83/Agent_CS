import { useState, useSyncExternalStore } from 'react';
import { Navigate } from 'react-router';
import { useAuthUserId } from '../features/auth/hooks/useAuthSession';
import { authStorage } from '../shared/services/authStorage';
import { useProfile } from '../features/profile/hooks/useProfile';
import { ProfileSettings } from '../features/profile/components/ProfileSettings';
import ui from '../shared/styles/Controls.module.css';

/** 조회 완료 후에만 폼을 만든다. 실패를 빈 프로필로 표시하거나 기존 값을 덮어쓰지 않는다. */
const ProfileLoader = ({ token, onWithdrawn }: { token: string; onWithdrawn: () => void }) => {
  const { profile, error, loading, retry } = useProfile(token);
  if (loading) return <p role="status">프로필을 불러오는 중입니다...</p>;
  if (error) return <div><p role="alert">{error}</p><button className={ui.button} onClick={retry}>프로필 다시 불러오기</button></div>;
  if (!profile) return null;
  return <ProfileSettings profile={profile} token={token} onWithdrawn={onWithdrawn} />;
};

/** 토큰/사용자 변경 시 이전 폼을 폐기한다. 다른 계정의 이메일·초안·비밀번호가 남지 않게 한다. */
export const ProfilePage = () => {
  // 성공한 탈퇴의 토큰 삭제는 일반 만료와 구분해 완료 안내가 인증 가드에 덮어쓰이지 않게 한다.
  const [withdrawn, setWithdrawn] = useState(false);
  const userId = useAuthUserId();
  const token = useSyncExternalStore(authStorage.subscribe, authStorage.getAccessToken, () => null);
  if (withdrawn) return <Navigate to="/login" replace state={{ withdrawn: true }} />;
  if (!userId || !token) return <Navigate to="/login" replace state={{ returnTo: '/profile' }} />;
  return <ProfileLoader key={`${userId}:${token}`} token={token} onWithdrawn={() => setWithdrawn(true)} />;
};

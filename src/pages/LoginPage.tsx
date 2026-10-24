import { useNavigate } from 'react-router';
import { LoginForm } from '../features/auth/components/LoginForm';

/** 로그인 성공 시 목록으로 이동한다. replace로 로그인 화면이 뒤로 가기 기록에 남지 않게 한다. */
export const LoginPage = () => {
  const navigate = useNavigate();

  return <LoginForm onLoggedIn={() => navigate('/posts', { replace: true })} />;
};

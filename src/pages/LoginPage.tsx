import { useNavigate } from 'react-router';
import { LoginForm } from '../features/auth/components/LoginForm';

export const LoginPage = () => {
  const navigate = useNavigate();

  return <LoginForm onLoggedIn={() => navigate('/posts', { replace: true })} />;
};

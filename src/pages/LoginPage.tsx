import { useLocation, useNavigate } from 'react-router';
import { LoginForm } from '../features/auth/components/LoginForm';
import { getLoginReturnTo } from '../features/auth/utils/loginRedirect';

/** 글쓰기에서 왔다면 선택한 말머리와 함께 복귀한다. 일반 로그인은 기존처럼 목록으로 이동한다. */
export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = getLoginReturnTo(location.state);

  return <>
    {returnTo !== '/posts' && <p role="status">게시글을 작성하려면 먼저 로그인해주세요. 로그인 후 작성 화면으로 돌아갑니다.</p>}
    <LoginForm returnTo={returnTo} onLoggedIn={() => navigate(returnTo, { replace: true })} />
  </>;
};

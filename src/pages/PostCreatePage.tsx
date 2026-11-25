import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router';
import { hasActiveAuthSession, useAuthSession } from '../features/auth/hooks/useAuthSession';
import { PostForm } from '../features/post/components/write/PostForm';
import type { PostEntity } from '../features/post/types/post.types';
import { isPostBoardTag } from '../features/post/utils/postEditor';


/** 목록에서 전달한 URL 말머리를 검사해 폼의 초기값으로 사용하고, 저장 후 이동을 담당한다. */
export const PostCreatePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const loggedIn = useAuthSession();
  // 상단/목록의 글쓰기 버튼, 직접 URL, 새로고침 모두 폼을 만들기 전에 검사한다.
  // 진입을 허용한 뒤에는 만료 알림만 표시해 작성 중인 본문과 임시 이미지가 사라지지 않게 한다.
  const [admitted] = useState(hasActiveAuthSession);
  const [params] = useSearchParams();
  // 새 링크는 tag로 통일하고, 기존 category 링크에서도 선택한 말머리를 복원한다.
  const value = params.get('tag') ?? params.get('category') ?? '';
  const boardTag = isPostBoardTag(value) ? value : '자유';

  if (!admitted) return <Navigate to="/login" replace state={{ returnTo: `${location.pathname}${location.search}` }} />;

  /** 서버가 반환한 실제 글 번호의 상세 화면으로 이동한다. 번호를 클라이언트에서 추측하지 않는다. */
  const handleCreated = (post: PostEntity) => {
    navigate(`/posts/${post.id}`);
  };
  
  return <>
    {!loggedIn && <p role="alert">로그인이 만료되었습니다. 작성 내용은 이 화면에 유지됩니다.{' '}
      <Link to="/login" target="_blank" rel="noopener noreferrer">새 탭에서 로그인</Link>한 뒤 다시 저장해주세요.
    </p>}
    <PostForm onCreated={handleCreated} initialBoardTag={boardTag} />
  </>;
};

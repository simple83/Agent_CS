import { useNavigate, useParams } from 'react-router';
import { PostEdit } from '../features/post/components/write/PostEdit';

/** 수정 URL을 검증하고 저장·취소 후의 이동만 담당한다. 권한과 입력은 기능 컴포넌트에 맡긴다. */
export const PostEditPage = () => {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const parsedPostId = Number(postId);

  if (!Number.isSafeInteger(parsedPostId) || parsedPostId <= 0) {
    return <p role="alert">잘못된 게시글 번호입니다.</p>;
  }

  return <PostEdit postId={parsedPostId}
    onUpdated={(post) => navigate(`/posts/${post.id}`, { replace: true })}
    onCancel={() => { void navigate(`/posts/${parsedPostId}`, { replace: true }); }}
    onLogin={() => { void navigate('/login'); }} />;
};

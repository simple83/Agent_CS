import { useNavigate, useSearchParams } from 'react-router';
import { PostForm } from '../features/post/components/write/PostForm';
import type { PostEntity } from '../features/post/types/post.types';
import { isPostBoardTag } from '../features/post/utils/postEditor';


/** 목록에서 전달한 URL 말머리를 검사해 폼의 초기값으로 사용하고, 저장 후 이동을 담당한다. */
export const PostCreatePage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // 새 링크는 tag로 통일하고, 기존 category 링크에서도 선택한 말머리를 복원한다.
  const value = params.get('tag') ?? params.get('category') ?? '';
  const boardTag = isPostBoardTag(value) ? value : '자유';

  /** 서버가 반환한 실제 글 번호의 상세 화면으로 이동한다. 번호를 클라이언트에서 추측하지 않는다. */
  const handleCreated = (post: PostEntity) => {
    navigate(`/posts/${post.id}`);
  };
  
  return (
    <PostForm onCreated={handleCreated} initialBoardTag={boardTag} />
  );
};

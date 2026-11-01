import { useAuthUserId } from '../../../auth/hooks/useAuthSession';
import { usePostDetail } from '../../hooks/usePostDetail';
import type { PostEntity } from '../../types/post.types';
import { PostForm } from './PostForm';
import layout from '../../styles/PostLayout.module.css';
import ui from '../../../../shared/styles/Controls.module.css';

interface PostEditProps {
  postId: number;
  onUpdated: (post: PostEntity) => void | Promise<void>;
  onCancel: () => void;
  onLogin: () => void;
}

/**
 * 직접 URL로 진입하거나 새로고침해도 원본을 조회한 뒤 작성자를 확인한다.
 * 조회가 끝나기 전에는 폼을 만들지 않아 빈 입력이 원본을 덮어쓰는 일을 막는다.
 * 현재 상세 API에는 조회수 증가가 포함되어 있다. 조회수 집계 정책은 이 화면에서 바꾸지 않는다.
 */
const PostEditLoader = ({ postId, onUpdated, onCancel, userId }: Omit<PostEditProps, 'onLogin'> & { userId: number }) => {
  const { post, isLoading, error } = usePostDetail(postId);

  if (isLoading) return <p role="status">수정할 게시글을 불러오는 중입니다...</p>;
  if (error || !post || post.is_deleted) return <div className={layout.page}>
    <p className={ui.error} role="alert">{error ?? '게시글이 없거나 삭제되었습니다.'}</p>
    <button type="button" className={ui.button} onClick={onCancel}>상세로 돌아가기</button>
  </div>;

  if (post.author_id !== userId) return <div className={layout.page}>
    <p role="alert">본인이 작성한 게시글만 수정할 수 있습니다.</p>
    <button type="button" className={ui.button} onClick={onCancel}>상세로 돌아가기</button>
  </div>;

  return <PostForm key={post.id} initialPost={post} onUpdated={onUpdated} onCancel={onCancel} />;
};

/**
 * 비로그인 상태에서는 수정 조회를 시작하지 않는다. 계정 전환 시 key를 바꿔 이전 초안을
 * 제거하고 새 계정으로 권한을 다시 확인한다. 저장 API 역시 서버에서 작성자를 검증한다.
 */
export const PostEdit = ({ onLogin, ...props }: PostEditProps) => {
  const userId = useAuthUserId();

  if (userId === null) return <div className={layout.page}>
    <p role="alert">게시글을 수정하려면 작성한 계정으로 로그인해주세요.</p>
    <button type="button" className={ui.button} onClick={onLogin}>로그인</button>
  </div>;

  return <PostEditLoader key={`${props.postId}:${userId}`} {...props} userId={userId} />;
};

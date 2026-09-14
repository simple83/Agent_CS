import { useParams } from 'react-router';
import { PostDetail } from '../features/post/components/PostDetail';

export const PostDetailPage = () => {
  const { postId } = useParams<{ postId: string }>();

  if (!postId) {
    return <div>잘못된 게시글 주소입니다.</div>;
  }

  const parsedPostId = Number(postId);

  if (Number.isNaN(parsedPostId)) {
    return <div>잘못된 게시글 번호입니다.</div>;
  }

  return <PostDetail postId={parsedPostId} />;
};
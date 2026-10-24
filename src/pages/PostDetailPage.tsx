import { useParams } from 'react-router';
import { PostDetail } from '../features/post/components/PostDetail';

/** URL의 글 번호를 검증한 뒤 상세 컴포넌트에 전달한다. 잘못된 번호로 API를 호출하지 않는다. */
export const PostDetailPage = () => {
  const { postId } = useParams<{ postId: string }>();

  if (!postId) {
    return <div>잘못된 게시글 주소입니다.</div>;
  }

  const parsedPostId = Number(postId);

  // NaN만 검사하면 Infinity·음수·소수도 통과하므로 안전한 양의 정수만 허용한다.
  if (!Number.isSafeInteger(parsedPostId) || parsedPostId <= 0) {
    return <div>잘못된 게시글 번호입니다.</div>;
  }

  return <PostDetail postId={parsedPostId} />;
};

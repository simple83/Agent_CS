import { useNavigate } from 'react-router';
import { PostList } from '../features/post/components/PostList';

export const PostListPage = () => {
  const navigate = useNavigate();

  return <PostList onPostClick={(postId) => navigate(`/posts/${postId}`)} />;
};

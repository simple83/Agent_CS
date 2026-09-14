import { useNavigate } from 'react-router';
import { PostForm } from '../features/post/components/PostForm';
import type { PostEntity } from '../features/post/types/post.types';


export const PostCreatePage = () => {
  const navigate = useNavigate();

  const handleCreated = (post: PostEntity) => {
    navigate(`/posts/${post.id}`);
  };
  
  return (
    <PostForm onCreated={handleCreated} />
  );
};
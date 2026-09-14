import { useEffect, useState } from 'react';
import { postApi } from '../services/postApi';
import type { PostEntity } from '../types/post.types';

export const usePostDetail = (postId: number) => {
  const [post, setPost] = useState<PostEntity | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPost = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await postApi.getPost(postId);
      setPost(data);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('게시글을 불러오는 중 오류가 발생했습니다.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPost();
  }, [postId]);

  return {
    post,
    isLoading,
    error,
    refresh: fetchPost,
  };
};
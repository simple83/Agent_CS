import { useState } from 'react';
import { postApi } from '../services/postApi';
import type { CreatePostParams, PostEntity } from '../types/post.types';

interface UsePostFormOptions {
  onCreated?: (post: PostEntity) => void;
}

export const usePostForm = ({ onCreated }: UsePostFormOptions = {}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [hashtagInput, setHashtagInput] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hashtags = hashtagInput
    .split(',')
    .map((tag) => tag.trim().replace(/^#/, ''))
    .filter(Boolean);

  const reset = () => {
    setTitle('');
    setContent('');
    setHashtagInput('');
    setImages([]);
    setError(null);
  };

  const submit = async (): Promise<PostEntity | null> => {
    const normalizedTitle = title.trim();
    const normalizedContent = content.trim();

    if (!normalizedTitle || !normalizedContent) {
      setError('제목과 내용을 모두 입력해주세요.');
      return null;
    }

    setIsLoading(true);
    setError(null);

    const params: CreatePostParams = {
      title: normalizedTitle,
      content: normalizedContent,
      images: images.length > 0 ? images : undefined,
      hashtags: hashtags.length > 0 ? hashtags : undefined,
    };

    try {
      const createdPost = await postApi.createPost(params);
      onCreated?.(createdPost);
      reset();
      return createdPost;
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : '게시글 작성 중 오류가 발생했습니다.',
      );
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    title,
    content,
    hashtagInput,
    hashtags,
    images,
    isLoading,
    error,
    setTitle,
    setContent,
    setHashtagInput,
    setImages,
    submit,
    reset,
  };
};

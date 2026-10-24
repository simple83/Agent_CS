import { useRef, useState } from 'react';
import { postApi } from '../services/postApi';
import type { CreatePostParams, PostEntity } from '../types/post.types';
import { getPostTags, type PostCategory } from '../utils/postEditor';

interface UsePostFormOptions {
  /** 저장된 글을 부모에게 알린다. Page가 상세 이동을 맡으며 비동기 콜백도 기다린다. */
  onCreated?: (post: PostEntity) => void | Promise<void>;
  /** 최초 진입 시 선택할 말머리. 작성 도중 URL이 바뀌어도 입력을 덮어쓰지 않는다. */
  initialCategory?: PostCategory;
}

/**
 * 작성 폼의 입력 상태, 검증, API 호출, 실패 후 재시도를 담당하는 Control 계층.
 * UI는 반환한 상태/함수만 사용하며 Mock/Real 선택이나 FormData 직렬화는 서비스에 맡긴다.
 * 영구 임시 저장은 제공하지 않는다. 여기서의 입력 보존은 현재 마운트된 폼에 한정된다.
 */
export const usePostForm = ({ onCreated, initialCategory = '자유' }: UsePostFormOptions = {}) => {
  const [category, setCategory] = useState<PostCategory>(initialCategory);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [hashtagInput, setHashtagInput] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // state 갱신은 다음 렌더에 반영된다. ref는 같은 렌더 안의 연속 호출도 즉시 차단한다.
  const submitting = useRef(false);
  const hashtags = getPostTags(category, hashtagInput);

  /** 저장 성공 후 입력을 초기화한다. 실패 경로에서는 호출하지 않아 재입력이 필요 없다. */
  const reset = () => {
    setCategory(initialCategory);
    setTitle('');
    setContent('');
    setHashtagInput('');
    setImages([]);
    setError(null);
  };

  /**
   * 필수 입력을 검사하고 게시글을 한 번 생성한다. 실패/진행 중 재호출은 null을 반환한다.
   * API가 성공하면 저장은 확정된 것이다. 이후 화면 이동 오류는 작성 실패로 취급하지
   * 않아 사용자가 같은 글을 다시 등록하는 것을 방지한다. 인증/권한 검사는 서버 책임이다.
   */
  const submit = async (): Promise<PostEntity | null> => {
    if (submitting.current) return null;
    const normalizedTitle = title.trim();
    const normalizedContent = content.trim();
    if (!normalizedTitle || !normalizedContent) {
      setError('제목과 내용을 모두 입력해주세요.');
      return null;
    }

    submitting.current = true;
    setIsLoading(true);
    setError(null);
    // 이 호출이 시작된 시점의 입력을 요청으로 고정한다. 파일 변환/업로드는 서비스에서 한다.
    const params: CreatePostParams = {
      title: normalizedTitle,
      content: normalizedContent,
      images: images.length > 0 ? images : undefined,
      hashtags,
    };

    try {
      const createdPost = await postApi.createPost(params);
      reset();
      try {
        await onCreated?.(createdPost);
      } catch {
        // 성공한 POST를 실패로 보고 재시도하지 않도록 저장된 글 번호를 안내한다.
        setError(`게시글 ${createdPost.id}번은 등록되었습니다. 화면 이동에 실패했으니 목록에서 확인해주세요.`);
      }
      return createdPost;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '게시글 작성 중 오류가 발생했습니다.');
      return null;
    } finally {
      // 성공/실패/콜백 오류 어느 경로에서도 다음 정상 시도를 할 수 있도록 잠금을 해제한다.
      submitting.current = false;
      setIsLoading(false);
    }
  };

  return {
    category, setCategory, title, content, hashtagInput, hashtags, images, isLoading, error,
    setTitle, setContent, setHashtagInput, setImages, submit, reset,
  };
};

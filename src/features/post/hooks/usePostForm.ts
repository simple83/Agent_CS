import { useEffect, useRef, useState } from 'react';
import { postApi } from '../services/postApi';
import type { CreatePostParams, PostEntity, UpdatePostParams } from '../types/post.types';
import { getEditedPostTags, getPostCategory, getPostTags, getPostTopicInput, type PostCategory } from '../utils/postEditor';
import { authStorage } from '../../../shared/services/authStorage';

interface UsePostFormOptions {
  /** 저장된 글을 부모에게 알린다. Page가 상세 이동을 맡으며 비동기 콜백도 기다린다. */
  onCreated?: (post: PostEntity) => void | Promise<void>;
  /** 최초 진입 시 선택할 말머리. 작성 도중 URL이 바뀌어도 입력을 덮어쓰지 않는다. */
  initialCategory?: PostCategory;
  /** 조회가 끝난 본인 글을 전달하면 수정 모드다. 다른 글로 이동할 때 폼을 key로 재마운트한다. */
  initialPost?: PostEntity;
  /** 수정 성공 후 이동을 Page에 위임한다. 작성 콜백과 구분해 POST/PATCH 흐름을 섞지 않는다. */
  onUpdated?: (post: PostEntity) => void | Promise<void>;
}

/**
 * 작성 폼의 입력 상태, 검증, API 호출, 실패 후 재시도를 담당하는 Control 계층.
 * UI는 반환한 상태/함수만 사용하며 Mock/Real 선택이나 FormData 직렬화는 서비스에 맡긴다.
 * 영구 임시 저장은 제공하지 않는다. 여기서의 입력 보존은 현재 마운트된 폼에 한정된다.
 */
export const usePostForm = ({ onCreated, onUpdated, initialPost, initialCategory = '자유' }: UsePostFormOptions = {}) => {
  // 최초 데이터만 기준으로 삼는다. 부모가 재조회 결과를 전달해도 편집 중인 초안을 덮어쓰지 않는다.
  const [editingPost] = useState(initialPost);
  const [category, setCategory] = useState<PostCategory>(() => editingPost ? getPostCategory(editingPost.hashtags) : initialCategory);
  const [title, setTitle] = useState(editingPost?.title ?? '');
  const [content, setContent] = useState(editingPost?.content ?? '');
  const [hashtagInput, setHashtagInput] = useState(() => editingPost ? getPostTopicInput(editingPost.hashtags) : '');
  const [images, setImages] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // state 갱신은 다음 렌더에 반영된다. ref는 같은 렌더 안의 연속 호출도 즉시 차단한다.
  const submitting = useRef(false);
  const active = useRef(false);
  const hashtags = editingPost ? getEditedPostTags(editingPost.hashtags, category, hashtagInput) : getPostTags(category, hashtagInput);

  // 저장 도중 다른 화면/계정으로 전환하면 늦게 온 응답으로 이전 글의 화면을 열지 않는다.
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  /** 새 글은 빈 입력으로, 수정 글은 최초 원본으로 복원한다. 실패 경로에서는 호출하지 않는다. */
  const reset = () => {
    setCategory(editingPost ? getPostCategory(editingPost.hashtags) : initialCategory);
    setTitle(editingPost?.title ?? '');
    setContent(editingPost?.content ?? '');
    setHashtagInput(editingPost ? getPostTopicInput(editingPost.hashtags) : '');
    setImages([]);
    setError(null);
  };

  /**
   * 필수 입력을 검사하고 생성 또는 수정을 한 번 요청한다. 실패/진행 중 재호출은 null이다.
   * API가 성공하면 저장은 확정된 것이다. 이후 화면 이동 오류는 작성 실패로 취급하지
   * 않아 사용자가 같은 글을 다시 등록하는 것을 방지한다. 인증/권한 검사는 서버 책임이다.
   */
  const submit = async (): Promise<PostEntity | null> => {
    if (submitting.current) return null;
    // 이벤트 직전에 로그아웃/계정 전환이 일어나도 이전 작성자 정보로 수정을 시도하지 않는다.
    if (editingPost && (!authStorage.getAccessToken() || authStorage.getUserId() !== editingPost.author_id)) {
      setError('본인이 작성한 게시글만 수정할 수 있습니다. 로그인 계정을 확인해주세요.');
      return null;
    }
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
      // 이미지 수정 계약이 확정되지 않아 PATCH에는 images 키 자체를 넣지 않는다.
      // 태그도 손대지 않았다면 생략해 표현 방식 때문에 기존 데이터가 바뀌지 않게 한다.
      // 제목만 고친 경우에는 원본 본문의 앞뒤 공백까지 유지한다. 검증용 trim과 저장값을 구분한다.
      const updates: UpdatePostParams = {
        title: normalizedTitle,
        content: content === editingPost?.content ? content : normalizedContent,
      };
      if (editingPost && (category !== getPostCategory(editingPost.hashtags) || hashtagInput !== getPostTopicInput(editingPost.hashtags))) {
        updates.hashtags = hashtags;
      }
      const savedPost = editingPost
        ? await postApi.updatePost(editingPost.id, updates)
        : await postApi.createPost(params);
      if (!active.current) return savedPost;
      if (!editingPost) reset();

      try {
        await (editingPost ? onUpdated : onCreated)?.(savedPost);
      } catch {
        // 저장 성공과 화면 이동 실패를 구분해 같은 내용을 불필요하게 다시 전송하지 않게 한다.
        setError(`게시글 ${savedPost.id}번은 ${editingPost ? '수정' : '등록'}되었습니다. 화면 이동에 실패했으니 목록에서 확인해주세요.`);
      }
      return savedPost;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '게시글 저장 중 오류가 발생했습니다.');
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

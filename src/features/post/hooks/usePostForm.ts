import { imageReferences, mapMarkdownImages } from '../../../shared/components/richText/markdownImages';
import { validatePostInput } from '../utils/postContract';
import { useEffect, useRef, useState } from 'react';
import { postApi } from '../services/postApi';
import type { CreatePostParams, PostEntity, UpdatePostParams } from '../types/post.types';
import { getEditedPostTags, getPostBoardTag, getPostTags, getPostTopicInput, type PostBoardTag } from '../utils/postEditor';
import { authStorage } from '../../../shared/services/authStorage';

interface UsePostFormOptions {
  /** 저장된 글을 부모에게 알린다. Page가 상세 이동을 맡으며 비동기 콜백도 기다린다. */
  onCreated?: (post: PostEntity) => void | Promise<void>;
  /** 최초 진입 시 선택할 말머리. 작성 도중 URL이 바뀌어도 입력을 덮어쓰지 않는다. */
  initialBoardTag?: PostBoardTag;
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
export const usePostForm = ({ onCreated, onUpdated, initialPost, initialBoardTag = '자유' }: UsePostFormOptions = {}) => {
  // 최초 데이터만 기준으로 삼는다. 부모가 재조회 결과를 전달해도 편집 중인 초안을 덮어쓰지 않는다.
  const [editingPost] = useState(initialPost);
  const [boardTag, setBoardTag] = useState<PostBoardTag>(() => editingPost ? getPostBoardTag(editingPost.hashtags) : initialBoardTag);
  const [title, setTitle] = useState(editingPost?.title ?? '');
  const [content, setContent] = useState(editingPost?.content ?? '');
  const [hashtagInput, setHashtagInput] = useState(() => editingPost ? getPostTopicInput(editingPost.hashtags) : '');
  // 임시 미리보기 URL은 저장하지 않고 제출 직전에 upload:// ID로 바꾼다. 실행 취소를 위해 해제는 폼 종료 시 한다.
  const pendingImages = useRef<{ id: string; file: File; url: string }[]>([]);

  const releaseImages = () => {
    for (const image of pendingImages.current) URL.revokeObjectURL(image.url);
    pendingImages.current = [];
  };

  /** 본문에 실제로 남아 있는 새 이미지만 개수에 포함한다. 파일은 서버 전송까지 메모리에 보관한다. */
  const addImages = (files: File[], replacingSrc?: string) => {
    const refs = new Set(imageReferences(content));
    // 교체될 임시 이미지가 본문에 한 번만 쓰였다면 새 이미지 수에서 제외한다.
    // 같은 파일을 여러 위치에 쓴 경우 나머지 참조도 업로드해야 하므로 계속 센다.
    const replacedOnce = replacingSrc && imageReferences(content).filter((url) => url === replacingSrc).length === 1;
    const activeImages = pendingImages.current.filter((image) => refs.has(image.url)
      && !(replacedOnce && image.url === replacingSrc));
    if (activeImages.length + files.length > 10) throw new Error('새 이미지는 한 번에 10개까지 첨부할 수 있습니다.');
    if (files.some((file) => !/^image\/(png|jpeg|gif|webp)$/.test(file.type))) throw new Error('PNG, JPEG, GIF, WebP 이미지를 선택해주세요.');
    const added = files.map((file) => ({ id: crypto.randomUUID(), file, url: URL.createObjectURL(file) }));
    pendingImages.current.push(...added);
    return added.map((image) => ({ src: image.url, alt: image.file.name }));
  };
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // state 갱신은 다음 렌더에 반영된다. ref는 같은 렌더 안의 연속 호출도 즉시 차단한다.
  const submitting = useRef(false);
  const active = useRef(false);
  const hashtags = editingPost ? getEditedPostTags(editingPost.hashtags, boardTag, hashtagInput) : getPostTags(boardTag, hashtagInput);

  // 저장 도중 다른 화면/계정으로 전환하면 늦게 온 응답으로 이전 글의 화면을 열지 않는다.
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; releaseImages(); };
  }, []);

  /** 새 글은 빈 입력으로, 수정 글은 최초 원본으로 복원한다. 실패 경로에서는 호출하지 않는다. */
  const reset = () => {
    setBoardTag(editingPost ? getPostBoardTag(editingPost.hashtags) : initialBoardTag);
    setTitle(editingPost?.title ?? '');
    setContent(editingPost?.content ?? '');
    setHashtagInput(editingPost ? getPostTopicInput(editingPost.hashtags) : '');
    releaseImages();
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

    const submittingToken = authStorage.getAccessToken();
    submitting.current = true;
    setIsLoading(true);
    setError(null);
    // 이 호출이 시작된 시점의 입력을 요청으로 고정한다. 파일 변환/업로드는 서비스에서 한다.
    try {
      const references = new Set(imageReferences(content));
      const selected = pendingImages.current.filter((image) => references.has(image.url));
      const submittedContent = mapMarkdownImages(content === editingPost?.content ? content : normalizedContent,
        (url) => {
          const image = selected.find((item) => item.url === url);
          return image ? `upload://${image.id}` : url;
        });
      const params: CreatePostParams = {
        title: normalizedTitle, content: submittedContent, hashtags,
        ...(selected.length ? { images: selected.map((image) => image.file), image_ids: selected.map((image) => image.id) } : {}),
      };
      // 기존 본문에서 이미지 노드를 제거하면 해당 ID도 유지 목록에서 제외한다.
      // 원래 본문에 없던 서버 첨부는 텍스트 수정만으로 삭제하지 않는다.
      const originalRefs = new Set(imageReferences(editingPost?.content ?? ''));
      const updates: UpdatePostParams = { ...params, hashtags: undefined,
        ...(editingPost?.images.length ? { keep_image_ids: editingPost.images.filter((image) =>
          references.has(image.image_url) || !originalRefs.has(image.image_url)).map((image) => image.id) } : {}),
      };
      validatePostInput(editingPost ? updates : params);
      // 입력을 건드리지 않았더라도 과거의 쉼표 결합 태그가 분리되었다면 수정 요청에 포함한다.
      const repairedTags = editingPost && (hashtags.length !== editingPost.hashtags.length
        || hashtags.some((tag, index) => tag !== editingPost.hashtags[index]?.name));
      if (editingPost && (repairedTags || boardTag !== getPostBoardTag(editingPost.hashtags) || hashtagInput !== getPostTopicInput(editingPost.hashtags))) {
        updates.hashtags = hashtags;
      }
      const savedPost = editingPost
        ? await postApi.updatePost(editingPost.id, updates)
        : await postApi.createPost(params);
      if (!active.current || authStorage.getAccessToken() !== submittingToken) return savedPost;
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
    boardTag, setBoardTag, title, content, hashtagInput, hashtags, addImages, isLoading, error,
    setTitle, setContent, setHashtagInput, submit, reset,
  };
};

import { imageReferences } from '../../../shared/components/richText/markdownImages';
import { apiFetch } from '../../../shared/services/apiFetch';
import { normalizeTags, parsePostSummary, parsePostDetail, parsePostLike, validatePostInput, validatePostQuery } from '../utils/postContract';
import type {
  CreatePostParams,
  DetailResponse,
  PostEntity,
  PostSummary,
  PostLikeResponse,
  PostQueryParams,
  UpdatePostParams,
} from '../types/post.types';

import type { PostApi } from '../types/postApi.types';
import { realApiUrl } from '../../../shared/config/apiMode';
import { authStorage } from '../../../shared/services/authStorage';

/** 현재 모드의 토큰으로 bearer 헤더를 만든다. 토큰 누락은 요청 전에 거부하고 유효성은 서버가 판단한다. */
const getAuthHeader = (): { Authorization: string } => {
  const token = authStorage.getAccessToken();

  if (!token) {
    throw new Error('인증 토큰이 없습니다. 로그인이 필요합니다.');
  }

  return { Authorization: `bearer ${token}` };
};

/** 문자열 detail만 오류 문구로 사용한다. 비JSON 응답이나 다른 구조는 기본 문구로 대체한다. */
const getErrorMessage = async (response: Response, fallback: string) => {
  const errorData = await response.json().catch(() => null);

  if (
    errorData &&
    typeof errorData === 'object' &&
    'detail' in errorData &&
    typeof errorData.detail === 'string'
  ) {
    return errorData.detail;
  }

  return fallback;
};

/** 빈 검색값을 제외하고 URLSearchParams로 인코딩한다. C++의 + 등도 검색 문자열로 보존한다. */
const buildPostQuery = (params: PostQueryParams = {}) => {
  validatePostQuery(params);
  const { title, tag, sort, limit, offset } = params;
  const searchParams = new URLSearchParams();

  if (title?.trim()) searchParams.set('title', title.trim());
  if (tag?.trim()) searchParams.set('tag', tag.trim());

  if (sort !== undefined) searchParams.set('sort', sort);
  if (limit !== undefined) searchParams.set('limit', String(limit));
  if (offset !== undefined) searchParams.set('offset', String(offset));
  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

/**
 * 작성/수정 요청의 공통 multipart 직렬화다. undefined 필드는 생략하고 배열은 반복 키로 넣는다.
 * Content-Type은 직접 지정하지 않아 브라우저가 올바른 boundary를 붙이게 한다.
 * image_ids는 새 파일과 같은 순서, keep_image_ids는 유지할 기존 이미지 ID로 전송한다.
 */
const appendPostFormData = (
  formData: FormData,
  params: CreatePostParams | UpdatePostParams,
) => {
  validatePostInput(params);
  params.image_ids?.forEach((id) => formData.append('image_ids', id));
  if ('keep_image_ids' in params && params.keep_image_ids !== undefined) {
    // 반복 키는 빈 배열을 표현할 수 없다. 확정 문서의 [] 표기로 전체 삭제와 생략(유지)을 구분한다.
    // 백엔드가 JSON 배열 지원을 없애면 명시적 삭제 방식의 추가 합의가 필요하다.
    if (params.keep_image_ids.length === 0) formData.append('keep_image_ids', '[]');
    else params.keep_image_ids.forEach((id) => formData.append('keep_image_ids', String(id)));
  }
  if (params.title !== undefined) formData.append('title', params.title);
  if (params.content !== undefined) formData.append('content', params.content);

  params.images?.forEach((file) => {
    formData.append('images', file);
  });

  if (params.hashtags !== undefined) {
    const tags = normalizeTags(params.hashtags);
    // []는 태그 전체 제거를 뜻하므로 키를 생략하지 않는다. 값이 있으면 각각 전송한다.
    if (tags.length === 0) formData.append('hashtags', '[]');
    else tags.forEach((tag) => formData.append('hashtags', tag));
  }
};

/** HTTP 접근 계층. 실패 응답은 예외로 올리고 UI 상태 갱신/오류 표시는 Hook에 맡긴다. */
export const realPostApi: PostApi = {
  /** 제목/태그 검색 조건으로 목록을 가져온다. 현재 계약은 페이지 정보가 없는 배열 응답이다. */
  getPosts: async (params: PostQueryParams = {}): Promise<PostSummary[]> => {
    const response = await apiFetch(realApiUrl(`/posts${buildPostQuery(params)}`), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(
        await getErrorMessage(response, '게시글 목록을 불러오지 못했습니다.'),
      );
    }

    const data: unknown = await response.json();
    if (!Array.isArray(data)) throw new Error('게시글 목록 응답 형식이 올바르지 않습니다.');
    return data.map(parsePostSummary);
  },

  /** 글 하나를 조회한다. 서버에서 조회수가 증가하므로 재조회도 서버에 영향을 줄 수 있다. */
  getPost: async (postId: number): Promise<PostEntity> => {
    const response = await apiFetch(realApiUrl(`/posts/${postId}`), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(
        await getErrorMessage(response, '게시글을 불러오지 못했습니다.'),
      );
    }

    return parsePostDetail(await response.json());
  },

  /** 인증된 사용자의 새 글을 multipart로 전송한다. 중복 생성 방지를 위해 자동 재시도하지 않는다. */
  createPost: async (params: CreatePostParams): Promise<PostEntity> => {
    if (imageReferences(params.content).some((url) => url.startsWith('s3://'))) throw new Error('새 글에는 내부 이미지 참조를 사용할 수 없습니다.');
    const formData = new FormData();
    appendPostFormData(formData, params);

    const response = await apiFetch(realApiUrl('/posts'), {
      method: 'POST',
      headers: getAuthHeader(),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(
        await getErrorMessage(response, '게시글 작성에 실패했습니다.'),
      );
    }

    return parsePostDetail(await response.json());
  },

  /** 전달된 필드만 수정한다. 작성자 권한과 이미지 교체 규칙의 최종 판단은 서버에서 수행한다. */
  updatePost: async (
    postId: number,
    params: UpdatePostParams,
  ): Promise<PostEntity> => {
    const formData = new FormData();
    appendPostFormData(formData, params);

    const response = await apiFetch(realApiUrl(`/posts/${postId}`), {
      method: 'PATCH',
      headers: getAuthHeader(),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(
        await getErrorMessage(response, '게시글 수정에 실패했습니다.'),
      );
    }

    return parsePostDetail(await response.json());
  },

  /** 인증 토큰과 글 번호로 삭제를 요청한다. 소프트 삭제 여부는 서버 계약을 따른다. */
  deletePost: async (postId: number): Promise<DetailResponse> => {
    const response = await apiFetch(realApiUrl(`/posts/${postId}`), {
      method: 'DELETE',
      headers: getAuthHeader(),
    });

    if (!response.ok) {
      throw new Error(
        await getErrorMessage(response, '게시글 삭제에 실패했습니다.'),
      );
    }

    return response.json();
  },

  /**
   * 상세 응답에 개인별 좋아요 여부가 없어 명세의 사용자별 좋아요 목록에서 확인한다.
   * 조회수를 증가시키는 GET /posts/{id}는 호출하지 않는다. 향후 전용 상태 API가 생기면 여기서 교체한다.
   */
  getLikeStatus: async (postId: number): Promise<boolean | null> => {
    if (!authStorage.getAccessToken()) return null;
    const userId = authStorage.getUserId();
    if (!userId) throw new Error('로그인 정보를 확인할 수 없습니다. 다시 로그인해주세요.');
    const response = await apiFetch(realApiUrl(`/users/${userId}/likes/posts`), {
      headers: getAuthHeader(),
    });
    if (!response.ok) {
      throw new Error(await getErrorMessage(response, '좋아요 상태를 확인하지 못했습니다.'));
    }
    const posts: unknown = await response.json();
    if (!Array.isArray(posts) || !posts.every((post) => post && Number.isSafeInteger(post.id))) {
      throw new Error('좋아요 목록 응답 형식이 올바르지 않습니다.');
    }
    return posts.some((post) => post.id === postId);
  },

  /** 현재 사용자의 좋아요를 등록한다. 중복 여부는 서버가 검증하며 화면 수치는 호출 후 갱신해야 한다. */
  likePost: async (postId: number): Promise<PostLikeResponse> => {
    const response = await apiFetch(realApiUrl(`/posts/${postId}/likes`), {
      method: 'POST',
      headers: getAuthHeader(),
    });

    if (!response.ok) {
      throw new Error(
        await getErrorMessage(response, '게시글 좋아요 등록에 실패했습니다.'),
      );
    }

    return parsePostLike(await response.json(), postId);
  },

  /** 현재 사용자의 좋아요를 취소한다. 게시글을 삭제하는 요청과 경로를 구분한다. */
  unlikePost: async (postId: number): Promise<PostLikeResponse> => {
    const response = await apiFetch(realApiUrl(`/posts/${postId}/likes`), {
      method: 'DELETE',
      headers: getAuthHeader(),
    });

    if (!response.ok) {
      throw new Error(
        await getErrorMessage(response, '게시글 좋아요 취소에 실패했습니다.'),
      );
    }

    return parsePostLike(await response.json(), postId);
  },
};

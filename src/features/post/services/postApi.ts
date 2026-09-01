import type {
  CreatePostParams,
  DetailResponse,
  PostEntity,
  PostQueryParams,
  UpdatePostParams,
} from '../types/post.types';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const getAuthHeader = (): { Authorization: string } => {
  const token = localStorage.getItem('access_token');

  if (!token) {
    throw new Error('인증 토큰이 없습니다. 로그인이 필요합니다.');
  }

  return { Authorization: `bearer ${token}` };
};

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

const buildPostQuery = ({ title, tag }: PostQueryParams = {}) => {
  const searchParams = new URLSearchParams();

  if (title?.trim()) searchParams.set('title', title.trim());
  if (tag?.trim()) searchParams.set('tag', tag.trim());

  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

const appendPostFormData = (
  formData: FormData,
  params: CreatePostParams | UpdatePostParams,
) => {
  if (params.title !== undefined) formData.append('title', params.title);
  if (params.content !== undefined) formData.append('content', params.content);

  params.images?.forEach((file) => {
    formData.append('images', file);
  });

  if (params.hashtags !== undefined) {
    /*
     * API 문서는 hashtags를 multipart/form-data의 text 필드로 정의하면서
     * 예시를 ["Python", "자료구조"] 형태로 제시한다.
     * 따라서 현재는 배열을 JSON 문자열로 직렬화한다.
     * 서버가 반복 key 방식(hashtags=Python&hashtags=자료구조)을 요구한다면
     * 이 부분만 백엔드 구현에 맞게 변경하면 된다.
     */
    formData.append('hashtags', JSON.stringify(params.hashtags));
  }
};

export const postApi = {
  // GET /posts?title=...&tag=...
  getPosts: async (params: PostQueryParams = {}): Promise<PostEntity[]> => {
    const response = await fetch(`${BASE_URL}/posts${buildPostQuery(params)}`, {
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

    return response.json();
  },

  // GET /posts/{post_id} - 백엔드에서 조회수 1 증가
  getPost: async (postId: number): Promise<PostEntity> => {
    const response = await fetch(`${BASE_URL}/posts/${postId}`, {
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

    return response.json();
  },

  // POST /posts
  createPost: async (params: CreatePostParams): Promise<PostEntity> => {
    const formData = new FormData();
    appendPostFormData(formData, params);

    const response = await fetch(`${BASE_URL}/posts`, {
      method: 'POST',
      headers: getAuthHeader(),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(
        await getErrorMessage(response, '게시글 작성에 실패했습니다.'),
      );
    }

    return response.json();
  },

  // PATCH /posts/{post_id}
  updatePost: async (
    postId: number,
    params: UpdatePostParams,
  ): Promise<PostEntity> => {
    const formData = new FormData();
    appendPostFormData(formData, params);

    const response = await fetch(`${BASE_URL}/posts/${postId}`, {
      method: 'PATCH',
      headers: getAuthHeader(),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(
        await getErrorMessage(response, '게시글 수정에 실패했습니다.'),
      );
    }

    return response.json();
  },

  // DELETE /posts/{post_id}
  deletePost: async (postId: number): Promise<DetailResponse> => {
    const response = await fetch(`${BASE_URL}/posts/${postId}`, {
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

  // POST /posts/{post_id}/likes
  likePost: async (postId: number): Promise<DetailResponse> => {
    const response = await fetch(`${BASE_URL}/posts/${postId}/likes`, {
      method: 'POST',
      headers: getAuthHeader(),
    });

    if (!response.ok) {
      throw new Error(
        await getErrorMessage(response, '게시글 좋아요 등록에 실패했습니다.'),
      );
    }

    return response.json();
  },

  // DELETE /posts/{post_id}/likes
  unlikePost: async (postId: number): Promise<DetailResponse> => {
    const response = await fetch(`${BASE_URL}/posts/${postId}/likes`, {
      method: 'DELETE',
      headers: getAuthHeader(),
    });

    if (!response.ok) {
      throw new Error(
        await getErrorMessage(response, '게시글 좋아요 취소에 실패했습니다.'),
      );
    }

    return response.json();
  },
};

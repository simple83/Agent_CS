import { MOCK_POSTS } from '../mocks/mockPosts';
import type { PostEntity, PostCategory, CreatePostParams } from '../types/post.type'; //

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

const getAuthHeader = (): { Authorization: string } => {
    //localStorage 에서 토큰을 확인하여 이미 로그인했는지 확인
    const token = localStorage.getItem('access_token');

    //토큰이 없을때 (로그인 안됨)
    if (!token)
    {
        throw new Error('인증 토큰이 없습니다. 로그인이 필요합니다.');
    }

    //토큰이 확인된 경우 인증 시도
    return { Authorization: `bearer ${token}` };
}

/* 실제 postApi
export const postApi = {

    게시글 목록 조회 (카테고리 필터링 지원)
    GET /posts?tag=FREE 형식으로 호출

    getposts: async (category?: string): Promise<PostEntity[]> => {
        const queryParam = category ? `?tag=${category}` : '';
        
        const response = 
        await fetch(`${BASE_URL}/posts${queryParam}`, {method: 'GET',headers: {'Content-Type': 'application/json',},});

        //응답
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || '게시글 목록을 불러오지 못했습니다.');
        }

        return response.json();
    },
*/

//목업 데이터 테스트용 postApi
export const postApi = {
  // 🧪 백엔드 미구현 상태용 Mock 서비스 함수
  getPosts: async (category?: PostCategory): Promise<PostEntity[]> => {
    // 실제 네트워크 요청처럼 0.5초 딜레이 발생시킴 (로딩 상태 테스트용)
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 카테고리 선택 시 해당하는 데이터만 필터링해서 리턴
    if (category) {
      return MOCK_POSTS.filter((post) => post.category === category);
    }

    // 전체 조회 시 데이터 전체 리턴
    return MOCK_POSTS;
  },


/*
    게시글 작성
*/
    createPost: async (params: CreatePostParams): Promise<PostEntity> => {

        //이미지 파일 전송을 위한 FormData 객체 생성
        const formData = new FormData();
        formData.append('title', params.title);
        formData.append('category', params.category);
        formData.append('content', params.content);

        //이미지 파일이 존재하면 FormData에 순서대로 배정
        if (params.images && params.images.length > 0) {
            params.images.forEach((file) => {
                formData.append('images', file);
            });
        }

        const response = await fetch(`${BASE_URL}/posts`, {
            method: 'POST',
            headers: {
                ...getAuthHeader(),
            },
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || '게시글 작성에 실패했습니다.');
        }

        return response.json();
    }

}
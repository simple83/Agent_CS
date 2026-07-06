import type { PostEntity, CreatePostParams } from '../types/post.type';

const BASE_URL = import.meta.env.BASE_URL || '';

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

export const postApi = {
/* 
    게시글 목록 조회 (카테고리 필터링 지원)
    GET /posts?tag=FREE 형식으로 호출
*/
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
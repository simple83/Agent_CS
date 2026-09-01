// 실제 백엔드 API 명세의 PostDetailResponse를 기준으로 한 타입 정의

export interface Hashtag {
  id: number;
  name: string;
}

export interface PostEntity {
  id: number;
  title: string;
  content: string;
  image_urls: string[];
  author_id: number;
  author_account_id: string;
  author_username: string;
  author_image_url: string;
  hashtags: Hashtag[];
  like_count: number;
  comment_count: number;
  view_count: number;
  created_at: string;
  updated_at: string;
  is_blurred: boolean;
  is_deleted: boolean;
  report_count: number;
}

// GET /posts의 query parameters
export interface PostQueryParams {
  title?: string;
  tag?: string;
}

// POST /posts multipart/form-data
export interface CreatePostParams {
  title: string;
  content: string;
  images?: File[];
  hashtags?: string[];
}

// PATCH /posts/{post_id} multipart/form-data
// API 명세상 모든 필드가 optional
export interface UpdatePostParams {
  title?: string;
  content?: string;
  images?: File[];
  hashtags?: string[];
}

export interface DetailResponse {
  detail: string;
}

//Post, PostResponse, Category 타입 정의

//카테고리 타입 (자유, 코드리뷰, 밥친구, 강의정보, 취업 등)
export type PostCategory = 'FREE' | 'CODE_REVIEW' | 'MEAL_MATE' | 'LECTURE_INFO' | 'JOB';

//백엔드에서 주는 게시글 구조 (엔티티)
export interface PostEntity {
  post_id: number;
  category: PostCategory;
  title: string;
  content: string;
  image_urls: string[];      // 이미지 업로드 대응
  view_count: number;        // 조회 수
  like_count: number;        // 추천 수
  comment_count: number;     // 댓글 수
  author_id: number;
  account_id: string;
  is_deleted: boolean;       // Soft Delete 여부
  created_at: string;
  updated_at: string;
}

//게시글 작성을 Request 스펙 (multipart/form-data로 보낼 데이터 규격)
export interface CreatePostParams {
  category: PostCategory;
  title: string;
  content: string;
  images?: File[]; // 파일 업로드를 위한 Binary 데이터
}
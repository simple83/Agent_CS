// 실제 백엔드 API 명세의 PostDetailResponse를 기준으로 한 타입 정의

/** 서버가 부여한 태그 식별자와 이름. 말머리도 이 구조의 대표 태그로 저장한다. */
export interface Hashtag {
  id: number;
  name: string;
}

/**
 * 서버의 게시글 응답 구조. category라는 별도 필드는 없으며 화면에서 hashtags로 말머리를 추론한다.
 * 서비스 경계의 postContract에서 필수 필드를 검증하고 목록과 상세를 구분한다.
 */
export interface PostSummary {
  id: number;
  title: string;
  author_id: number;
  author_account_id: string;
  /** 닉네임을 설정하지 않은 계정은 null이다. 화면에는 author_account_id를 대신 표시한다. */
  author_username: string | null;
  author_image_url: string | null;
  hashtags: Hashtag[];
  like_count: number;
  comment_count: number;
  view_count: number;
  created_at: string;
  updated_at: string;
}

/** 기존 이미지 ID는 수정 요청의 keep_image_ids에 사용한다. URL은 만료될 수 있다. */
export interface PostImage {
  id: number;
  image_url: string;
}

/** 목록에 없는 본문과 이미지 정보는 상세 조회에서만 얻는다. */
export interface PostEntity extends PostSummary {
  content: string;
  images: PostImage[];
  is_deleted: boolean;
}

/** 좋아요 변경 후 서버가 확정한 상태와 집계를 그대로 표시한다. */
export interface PostLikeResponse {
  post_id: number;
  like_count: number;
  is_liked: boolean;
}

/** GET /posts 검색 조건. 제목과 태그를 함께 넘기면 두 조건의 교집합을 요청한다. */
export interface PostQueryParams {
  title?: string;
  tag?: string;
  sort?: 'created_at' | 'view_count';
  limit?: number;
  offset?: number;
}

/** 작성 입력. File 배열과 태그 이름 배열은 서비스에서 multipart로 직렬화한다. */
export interface CreatePostParams {
  title: string;
  content: string;
  images?: File[];
  image_ids?: string[];
  hashtags?: string[];
}

/** 수정 입력. 생략한 필드는 유지한다. keep_image_ids 생략은 기존 이미지 유지, 빈 배열은 전체 제거 요청이다. */
export interface UpdatePostParams {
  keep_image_ids?: number[];
  title?: string;
  content?: string;
  images?: File[];
  image_ids?: string[];
  hashtags?: string[];
}

/** 게시글 삭제에서 돌려주는 서버 안내 문구다. */
export interface DetailResponse {
  detail: string;
}

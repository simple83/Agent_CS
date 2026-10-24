// 실제 백엔드 API 명세의 PostDetailResponse를 기준으로 한 타입 정의

/** 서버가 부여한 태그 식별자와 이름. 말머리도 이 구조의 대표 태그로 저장한다. */
export interface Hashtag {
  id: number;
  name: string;
}

/**
 * 서버의 게시글 응답 구조. category라는 별도 필드는 없으며 화면에서 hashtags로 말머리를 추론한다.
 * TypeScript 타입 선언은 서버 응답을 런타임에 검증하지 않으므로 실제 서버 연결 시 계약 확인이 필요하다.
 */
export interface PostEntity {
  id: number;
  title: string;
  /** 일반 설명과 코드 블록을 함께 저장하는 Markdown 문자열이다. */
  content: string;
  /** 본문 내 위치 정보가 없는 첨부 이미지 목록이다. */
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

/** GET /posts 검색 조건. 제목과 태그를 함께 넘기면 두 조건의 교집합을 요청한다. */
export interface PostQueryParams {
  title?: string;
  tag?: string;
}

/** 작성 입력. File 배열과 태그 이름 배열은 서비스에서 multipart로 직렬화한다. */
export interface CreatePostParams {
  title: string;
  content: string;
  images?: File[];
  hashtags?: string[];
}

/** 수정 입력. 생략한 필드는 유지한다. 이미지 삭제 방식은 실제 서버와 추가 합의가 필요하다. */
export interface UpdatePostParams {
  title?: string;
  content?: string;
  images?: File[];
  hashtags?: string[];
}

/** 삭제·좋아요 등에서 돌려주는 서버 안내 문구다. */
export interface DetailResponse {
  detail: string;
}

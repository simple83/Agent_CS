import type {
  CreatePostParams, DetailResponse, PostEntity, PostQueryParams, UpdatePostParams,
} from './post.types';

/** 화면/Hook이 의존하는 공통 계약. Mock과 Real은 같은 요청/응답 타입을 사용한다. */
export interface PostApi {
  /** 조건에 맞는 게시글 배열을 조회한다. */
  getPosts(params?: PostQueryParams): Promise<PostEntity[]>;
  /** 상세를 조회하며 서버/Mock의 조회수가 증가한다. */
  getPost(postId: number): Promise<PostEntity>;
  /** 로그인한 사용자로 글을 생성하고 저장된 결과를 반환한다. */
  createPost(params: CreatePostParams): Promise<PostEntity>;
  /** 본인 글의 전달된 필드를 수정한다. */
  updatePost(postId: number, params: UpdatePostParams): Promise<PostEntity>;
  /** 본인 글을 삭제 처리한다. */
  deletePost(postId: number): Promise<DetailResponse>;
  /** 현재 사용자의 좋아요 여부를 조회한다. 비로그인은 null, 조회 실패는 예외로 구분한다. */
  getLikeStatus(postId: number): Promise<boolean | null>;
  /** 로그인한 사용자의 좋아요를 등록한다. */
  likePost(postId: number): Promise<DetailResponse>;
  /** 로그인한 사용자가 추가한 좋아요를 취소한다. */
  unlikePost(postId: number): Promise<DetailResponse>;
}

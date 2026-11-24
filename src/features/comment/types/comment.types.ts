/** 확정 API의 댓글 응답이다. 삭제된 본문은 null이고 답글은 부모 replies에 포함된다. */
export interface CommentResponse {
  id: number;
  post_id: number;
  author_id: number;
  author_account_id: string;
  author_username: string;
  author_image_url: string | null;
  content: string | null;
  parent_comment_id: number | null;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  replies: CommentResponse[];
}

/** 화면과 기존 Mock DB의 내부 모델이다. API 필드 이름은 서비스 경계에서 이 구조로 변환한다. */
export interface CommentEntity {
  id: number;
  post_id: number;
  user_id: number;
  username: string;
  account_id: string;
  profile_image_url: string | null;
  content: string;
  parent_comment_id: number | null;
  created_at: string;
  updated_at: string;
  is_blurred: boolean;
  is_deleted: boolean;
  report_count: number;
}

/** 게시글의 multipart와 달리 댓글 작성·수정은 JSON content만 전송한다. */
export interface CommentApi {
  getComments(postId: number): Promise<CommentEntity[]>;
  createComment(postId: number, content: string): Promise<CommentEntity>;
  createReply(postId: number, parentId: number, content: string): Promise<CommentEntity>;
  updateComment(postId: number, commentId: number, content: string): Promise<CommentEntity>;
  deleteComment(postId: number, commentId: number): Promise<void>;
}

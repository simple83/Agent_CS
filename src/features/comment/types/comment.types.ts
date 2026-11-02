/** 화면과 Mock DB가 사용하는 평면 댓글이다. 서버의 replies 중첩은 서비스에서 정리한다. */
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

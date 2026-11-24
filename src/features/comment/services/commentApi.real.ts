import { apiFetch } from '../../../shared/services/apiFetch';
import { realApiUrl } from '../../../shared/config/apiMode';
import { authStorage } from '../../../shared/services/authStorage';
import type { CommentApi } from '../types/comment.types';
import { normalizeCommentResponse, validateCommentContent, validateCommentId } from '../utils/comments';

/** HTTP 상태를 보존해 인증/권한/삭제/입력 오류를 네트워크 오류와 구별한다. */
export class CommentApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** 공통 JSON 요청이다. 변경 요청은 자동 재전송하지 않아 응답 유실 뒤 중복 등록을 피한다. */
const request = async (path: string, method = 'GET', content?: string): Promise<unknown> => {
  const headers: Record<string, string> = {};
  if (method !== 'GET') {
    const token = authStorage.getAccessToken();
    if (!token) throw new CommentApiError('로그인이 필요합니다.', 401);
    headers.Authorization = `bearer ${token}`;
  }
  if (content !== undefined) {
    validateCommentContent(content);
    headers['Content-Type'] = 'application/json';
  }
  const response = await apiFetch(realApiUrl(path), { method, headers,
    ...(content === undefined ? {} : { body: JSON.stringify({ content }) }) });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const messages: Record<number, string> = {
      401: '로그인이 만료되었습니다. 다시 로그인해주세요.',
      403: '댓글을 변경할 권한이 없습니다.',
      404: '게시글 또는 댓글이 없거나 삭제되었습니다.',
      422: '댓글 입력 내용을 확인해주세요.',
      429: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
    };
    const detail = data && typeof data === 'object' && 'detail' in data && typeof data.detail === 'string' ? data.detail : null;
    throw new CommentApiError(detail ?? messages[response.status] ?? '댓글 요청에 실패했습니다.', response.status);
  }
  return data;
};

/** API base URL에 /api가 포함되어 있으면 여기서 중복하지 않는다. 확정 명세의 댓글 경로는 모두 /posts로 시작한다. */
const pathFor = (postId: number, commentId?: number) => {
  validateCommentId(postId);
  if (commentId !== undefined) validateCommentId(commentId);
  return `/posts/${postId}/comments${commentId === undefined ? '' : `/${commentId}`}`;
};

/** 정상 단건 응답도 목록과 같은 형식·게시글 소속 검증을 거친다. */
const mutation = async (postId: number, path: string, method: string, content: string) => {
  const data = await request(path, method, content);
  const comments = normalizeCommentResponse([data], postId, true);
  const id = (data as { id: number }).id;
  return comments.find((comment) => comment.id === id)!;
};

/** 실제 댓글 API 계약이다. 댓글 내용은 Markdown 문자열이며 서버 실행을 요청하는 API는 없다. */
export const realCommentApi: CommentApi = {
  getComments: async (postId) => normalizeCommentResponse(await request(pathFor(postId)), postId),
  createComment: (postId, content) => mutation(postId, pathFor(postId), 'POST', content),
  createReply: (postId, parentId, content) => mutation(postId, `${pathFor(postId, parentId)}/replies`, 'POST', content),
  updateComment: (postId, id, content) => mutation(postId, pathFor(postId, id), 'PATCH', content),
  deleteComment: async (postId, id) => { await request(pathFor(postId, id), 'DELETE'); },
};

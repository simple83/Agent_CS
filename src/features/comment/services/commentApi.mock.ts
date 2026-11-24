import { readMockDatabase, requireMockUser, saveMockDatabase, waitForMockRequest, type MockDatabase } from '../../../shared/mocks/mockStore';
import type { CommentApi, CommentEntity } from '../types/comment.types';
import { authStorage } from '../../../shared/services/authStorage';
import { normalizeComments, validateCommentContent, validateCommentId } from '../utils/comments';

/** 댓글 API에서도 게시글 존재와 삭제 상태를 검사한다. 상세 조회를 호출하지 않아 조회수는 증가하지 않는다. */
const findPost = (data: MockDatabase, postId: number) => {
  validateCommentId(postId);
  const post = data.posts.find((item) => item.id === postId && !item.is_deleted);
  if (!post) throw new Error('게시글이 없거나 삭제되었습니다.');
  return post;
};

/** ID뿐 아니라 URL의 게시글 소속도 검증해 다른 글의 댓글을 변경하지 못하게 한다. */
const findComment = (data: MockDatabase, postId: number, id: number) => {
  findPost(data, postId);
  validateCommentId(id);
  const comment = data.comments.find((item) => item.id === id && item.post_id === postId && !item.is_deleted);
  if (!comment) throw new Error('댓글이 없거나 삭제되었습니다.');
  return comment;
};

/** 댓글 작성자만 수정·삭제할 수 있다. 게시글 소유자에게 타인의 댓글 변경 권한을 부여하지 않는다. */
const findOwnedComment = (data: MockDatabase, postId: number, id: number) => {
  const user = requireMockUser(data);
  const comment = findComment(data, postId, id);
  if (comment.user_id !== user.id) throw new Error('본인이 작성한 댓글만 변경할 수 있습니다.');
  return comment;
};

/** 집계를 댓글 데이터에서 재계산해 대댓글 삭제와 반복 요청에서도 음수가 되지 않게 한다. */
const saveComments = (data: MockDatabase, postId: number) => {
  findPost(data, postId).comment_count = data.comments.filter((comment) => comment.post_id === postId && !comment.is_deleted).length;
  saveMockDatabase(data);
};

/** 지연 중 계정이 바뀌면 새 계정 명의로 이전 초안을 저장하지 않는다. 실제 HTTP는 시작 시 토큰을 고정한다. */
const waitForMutation = async () => {
  const token = authStorage.getAccessToken();
  await waitForMockRequest();
  if (!token || authStorage.getAccessToken() !== token) throw new Error('로그인 상태가 변경되었습니다. 다시 시도해주세요.');
};

/** 지연이 끝난 시점의 인증/DB를 읽고 한 번에 저장한다. 부모 삭제와 등록 사이에 별도 await를 두지 않는다. */
const create = async (postId: number, content: string, parentId: number | null): Promise<CommentEntity> => {
  await waitForMutation();
  const data = readMockDatabase();
  const user = requireMockUser(data);
  findPost(data, postId);
  validateCommentContent(content);
  if (parentId !== null) {
    const parent = findComment(data, postId, parentId);
    if (parent.parent_comment_id !== null) throw new Error('답글에는 다시 답글을 작성할 수 없습니다.');
    if (parent.is_blurred) throw new Error('숨김 처리된 댓글에는 답글을 작성할 수 없습니다.');
  }
  const now = new Date().toISOString();
  const comment: CommentEntity = {
    id: data.comments.reduce((max, item) => Math.max(max, item.id), 0) + 1,
    post_id: postId, user_id: user.id, username: user.username, account_id: user.account_id,
    profile_image_url: null, content, parent_comment_id: parentId, created_at: now, updated_at: now,
    is_deleted: false, is_blurred: false, report_count: 0,
  };
  data.comments.push(comment);
  saveComments(data, postId);
  return structuredClone(comment);
};

/** 네트워크 없이 실제 API와 같은 소속·인증·실패 흐름을 제공한다. */
export const mockCommentApi: CommentApi = {
  async getComments(postId) {
    await waitForMockRequest();
    const data = readMockDatabase();
    findPost(data, postId);
    return normalizeComments(data.comments.filter((comment) => comment.post_id === postId), postId);
  },
  createComment: (postId, content) => create(postId, content, null),
  createReply: (postId, parentId, content) => create(postId, content, parentId),
  async updateComment(postId, id, content) {
    await waitForMutation();
    const data = readMockDatabase();
    const comment = findOwnedComment(data, postId, id);
    if (comment.is_blurred) throw new Error('숨김 처리된 댓글은 수정할 수 없습니다.');
    validateCommentContent(content);
    comment.content = content;
    comment.updated_at = new Date().toISOString();
    saveComments(data, postId);
    return structuredClone(comment);
  },
  async deleteComment(postId, id) {
    await waitForMutation();
    const data = readMockDatabase();
    // 원본은 화면에 반환하지 않고 부모 자리와 기존 답글을 보존한다.
    const comment = findOwnedComment(data, postId, id);
    comment.is_deleted = true;
    comment.content = '';
    comment.updated_at = new Date().toISOString();
    saveComments(data, postId);
  },
};

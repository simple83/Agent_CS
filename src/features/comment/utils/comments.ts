import type { CommentEntity } from '../types/comment.types';

// TODO(backend-contract): 서버와 최대 길이 및 계산 단위를 합의한다. 현재는 프론트·Mock의 임시 보호 한도다.
export const COMMENT_MAX_LENGTH = 10000;

/** 공백뿐인 내용과 지나치게 긴 입력을 요청 전에 거부한다. 코드의 들여쓰기는 변경하지 않는다. */
export const validateCommentContent = (content: string) => {
  if (!content.trim()) throw new Error('댓글 내용을 입력해주세요.');
  if (content.length > COMMENT_MAX_LENGTH) throw new Error(`댓글은 ${COMMENT_MAX_LENGTH.toLocaleString()}자 이내로 입력해주세요.`);
};

/** URL에 들어가는 식별자는 양의 안전한 정수만 허용한다. */
export const validateCommentId = (value: number) => {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error('잘못된 게시글 또는 댓글 번호입니다.');
};

/**
 * 평면/중첩 응답을 ID 기준으로 합치고 다른 게시글의 데이터·순환 관계·상충하는 중복을 거부한다.
 * TODO(backend-contract): 실제 대댓글 포함 응답을 확인하면 서버 응답 타입을 확정한다.
 * 삭제/블라인드 본문은 화면 상태에 보관하기 전에 비운다. 서버 역시 원문을 제거해 반환해야 한다.
 */
export const normalizeComments = (input: unknown, postId: number): CommentEntity[] => {
  if (!Array.isArray(input)) throw new Error('댓글 목록 응답 형식이 올바르지 않습니다.');
  const pending: { value: unknown; parent?: number }[] = input.map((value) => ({ value }));
  const comments = new Map<number, CommentEntity>();
  let visited = 0;
  while (pending.length) {
    if (++visited > 10000) throw new Error('댓글 응답이 너무 큽니다.');
    const { value, parent } = pending.pop()!;
    if (!value || typeof value !== 'object') throw new Error('댓글 응답 형식이 올바르지 않습니다.');
    const item = value as Record<string, unknown>;
    for (const key of ['id', 'post_id', 'user_id']) validateCommentId(item[key] as number);
    if (item.post_id !== postId) throw new Error('다른 게시글의 댓글이 포함되어 있습니다.');
    if (item.parent_comment_id !== null) validateCommentId(item.parent_comment_id as number);
    if (parent !== undefined && item.parent_comment_id !== parent) throw new Error('대댓글의 부모 정보가 일치하지 않습니다.');
    for (const key of ['content', 'username', 'account_id', 'created_at', 'updated_at']) {
      if (typeof item[key] !== 'string') throw new Error('댓글 응답의 필수 정보가 없습니다.');
    }
    if (typeof item.is_deleted !== 'boolean' || typeof item.is_blurred !== 'boolean') throw new Error('댓글 표시 상태가 올바르지 않습니다.');
    if (item.replies !== undefined && !Array.isArray(item.replies)) throw new Error('대댓글 응답 형식이 올바르지 않습니다.');
    const comment: CommentEntity = {
      id: item.id as number, post_id: postId, user_id: item.user_id as number,
      username: item.username as string, account_id: item.account_id as string,
      profile_image_url: typeof item.profile_image_url === 'string' ? item.profile_image_url : null,
      content: item.is_deleted || item.is_blurred ? '' : item.content as string,
      parent_comment_id: item.parent_comment_id as number | null,
      created_at: item.created_at as string, updated_at: item.updated_at as string,
      is_deleted: item.is_deleted, is_blurred: item.is_blurred,
      report_count: typeof item.report_count === 'number' ? item.report_count : 0,
    };
    const previous = comments.get(comment.id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(comment)) throw new Error('같은 댓글의 응답 정보가 서로 다릅니다.');
    comments.set(comment.id, comment);
    for (const reply of item.replies as unknown[] ?? []) pending.push({ value: reply, parent: comment.id });
  }

  // 부모를 따라가며 순환을 검사한다. 반복문을 사용해 잘못된 깊은 응답이 호출 스택을 소진하지 않게 한다.
  for (const comment of comments.values()) {
    const seen = new Set<number>();
    let current: CommentEntity | undefined = comment;
    while (current) {
      if (seen.has(current.id) || seen.size > 32) throw new Error('댓글의 부모 관계가 올바르지 않습니다.');
      seen.add(current.id);
      current = current.parent_comment_id === null ? undefined : comments.get(current.parent_comment_id);
    }
  }
  return [...comments.values()].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id);
};

/** 부모를 잃은 답글도 버리지 않고 표시한다. 중첩이 깊어도 화면에서는 한 단계 들여쓰기로 제한한다. */
export const groupComments = (comments: CommentEntity[]) => {
  const byId = new Map(comments.map((comment) => [comment.id, comment]));
  const groups = new Map<number, { root: CommentEntity; replies: CommentEntity[] }>();
  for (const comment of comments) {
    let root = comment;
    while (root.parent_comment_id !== null && byId.has(root.parent_comment_id)) root = byId.get(root.parent_comment_id)!;
    const group = groups.get(root.id) ?? { root, replies: [] };
    if (root.id !== comment.id) group.replies.push(comment);
    groups.set(root.id, group);
  }
  return [...groups.values()].filter(({ root, replies }) => !root.is_deleted || replies.some((reply) => !reply.is_deleted));
};

/** 현재 계약의 연쇄 삭제 대상 ID를 계산한다. 삭제 범위 판단은 서버가 최종 수행한다. */
export const getCommentSubtreeIds = (comments: CommentEntity[], id: number): Set<number> => {
  const removed = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const comment of comments) {
      if (comment.parent_comment_id !== null && removed.has(comment.parent_comment_id) && !removed.has(comment.id)) {
        removed.add(comment.id);
        changed = true;
      }
    }
  }
  return removed;
};

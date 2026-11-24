import type { CommentEntity } from '../types/comment.types';

// Pydantic 문자열 길이와 맞춰 유니코드 코드 포인트로 센다. 코드 서식 문자도 길이에 포함한다.
export const COMMENT_MAX_LENGTH = 5000;
export const commentLength = (content: string) => Array.from(content).length;

/** 공백뿐인 내용과 지나치게 긴 입력을 요청 전에 거부한다. 코드의 들여쓰기는 변경하지 않는다. */
export const validateCommentContent = (content: string) => {
  if (!content.trim()) throw new Error('댓글 내용을 입력해주세요.');
  if (commentLength(content) > COMMENT_MAX_LENGTH) throw new Error(`댓글은 ${COMMENT_MAX_LENGTH.toLocaleString()}자 이내로 입력해주세요.`);
};

/** URL에 들어가는 식별자는 양의 안전한 정수만 허용한다. */
export const validateCommentId = (value: number) => {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error('잘못된 게시글 또는 댓글 번호입니다.');
};

/**
 * 확정 응답을 내부 모델로 변환한다. 삭제된 null 본문만 빈 문자열로 바꾸고 정상 댓글의 누락은 거부한다.
 * 반복문과 개수 제한으로 비정상적으로 깊은 replies가 호출 스택을 소진하지 않게 한다.
 */
export const normalizeCommentResponse = (input: unknown, postId: number, single = false): CommentEntity[] => {
  if (!Array.isArray(input)) throw new Error('댓글 목록 응답 형식이 올바르지 않습니다.');
  // 작성/수정의 단건 응답은 대댓글 자체일 수 있다. 목록 응답에서는 최상위 부모가 null이어야 한다.
  const pending = input.map((value: unknown) => ({ value, parent: single && value && typeof value === 'object'
    ? (value as { parent_comment_id: number | null }).parent_comment_id : null }));
  const flat: unknown[] = [];
  while (pending.length) {
    if (flat.length >= 10000) throw new Error('댓글 응답이 너무 큽니다.');
    const { value, parent } = pending.pop()!;
    if (!value || typeof value !== 'object') throw new Error('댓글 응답 형식이 올바르지 않습니다.');
    const item = value as Record<string, unknown>;
    // replies는 명세상 선택 배열이다. 생략은 답글 없음으로 처리하되 null은 허용하지 않는다.
    const replies = item.replies === undefined ? [] : item.replies;
    if (item.parent_comment_id !== parent || !Array.isArray(replies)) throw new Error('댓글의 부모 정보가 일치하지 않습니다.');
    if (item.author_image_url !== null && typeof item.author_image_url !== 'string') throw new Error('댓글 작성자 이미지 응답이 올바르지 않습니다.');
    flat.push({ ...item, user_id: item.author_id, username: item.author_username,
      account_id: item.author_account_id, profile_image_url: item.author_image_url,
      content: item.is_deleted === true && item.content === null ? '' : item.content,
      is_blurred: false, report_count: 0, replies: [] });
    if (parent !== null && replies.length) throw new Error('대댓글은 최대 2단계입니다.');
    for (const reply of replies) pending.push({ value: reply, parent: item.id as number });
  }
  return normalizeComments(flat, postId);
};

/**
 * 평면/중첩 응답을 ID 기준으로 합치고 다른 게시글의 데이터·순환 관계·상충하는 중복을 거부한다.
 * HTTP 응답은 normalizeCommentResponse에서 변환하며 이 함수는 내부 모델과 기존 Mock 저장소에 사용한다.
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
    for (const key of ['content', 'account_id', 'created_at', 'updated_at']) {
      if (typeof item[key] !== 'string') throw new Error('댓글 응답의 필수 정보가 없습니다.');
    }

    // 닉네임 미설정(null)은 정상 응답이다. 원댓글·답글의 조회와 작성·수정에 공통 적용한다.
    // 필드 누락(undefined)과 다른 타입은 여전히 거부하여 계약 오류를 숨기지 않는다.
    if (item.username !== null && typeof item.username !== 'string') throw new Error('댓글 작성자 닉네임 응답이 올바르지 않습니다.');

    if (typeof item.is_deleted !== 'boolean' || typeof item.is_blurred !== 'boolean') throw new Error('댓글 표시 상태가 올바르지 않습니다.');
    if (item.replies !== undefined && !Array.isArray(item.replies)) throw new Error('대댓글 응답 형식이 올바르지 않습니다.');
    const comment: CommentEntity = {
      id: item.id as number, post_id: postId, user_id: item.user_id as number,
      username: item.username as string | null, account_id: item.account_id as string,
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

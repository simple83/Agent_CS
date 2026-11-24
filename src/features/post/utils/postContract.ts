import { imageReferences } from '../../../shared/components/richText/markdownImages';
import type { CreatePostParams, PostEntity, PostLikeResponse, PostQueryParams, PostSummary, UpdatePostParams } from '../types/post.types';

/** 소문자 정규화와 중복 제거는 서버와 동일하게 수행한다. 빈 태그/초과 길이는 조용히 버리지 않는다. */
export const normalizeTags = (tags: string[]) => [...new Set(tags.map((tag) => {
  const value = tag.trim().toLowerCase();
  if (!value || Array.from(value).length > 50) throw new Error('태그는 1~50자여야 합니다.');
  return value;
}))];

/** 검색 옵션을 서버 허용 범위에서 검사한다. 기본 정렬/페이지 크기는 서버 계약과 같다. */
export const validatePostQuery = (query: PostQueryParams) => {
  if (query.sort !== undefined && !['created_at', 'view_count'].includes(query.sort)) throw new Error('지원하지 않는 정렬입니다.');
  if (query.limit !== undefined && (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > 100)) throw new Error('조회 개수는 1~100이어야 합니다.');
  if (query.offset !== undefined && (!Number.isInteger(query.offset) || query.offset < 0)) throw new Error('조회 시작 위치가 올바르지 않습니다.');
};

/** 작성/수정 입력을 동일하게 검증한다. Markdown 본문의 실제 이미지 노드만 검사하여 코드 예시를 업로드 참조로 오인하지 않는다. */
export const validatePostInput = (params: CreatePostParams | UpdatePostParams) => {
  if (params.title !== undefined && (!params.title.trim() || Array.from(params.title).length > 200)) throw new Error('제목은 1~200자여야 합니다.');
  if (params.content !== undefined && !params.content.trim()) throw new Error('본문을 입력해주세요.');
  if (params.hashtags !== undefined) normalizeTags(params.hashtags);
  const ids = params.image_ids ?? [];
  if ((params.images?.length ?? 0) > 10) throw new Error('새 이미지는 한 번에 10개까지 첨부할 수 있습니다.');
  if ((params.images?.length ?? 0) !== ids.length || new Set(ids).size !== ids.length
    || ids.some((id) => !/^[A-Za-z0-9_-]+$/.test(id))) throw new Error('이미지 파일과 참조 ID가 일치하지 않습니다.');
  if (params.content !== undefined) {
    const refs = imageReferences(params.content);
    const uploads = new Set(refs.filter((url) => url.startsWith('upload://')).map((url) => url.slice(9)));
    if (uploads.size !== ids.length || ids.some((id) => !uploads.has(id))) throw new Error('본문 이미지 참조와 파일 ID가 일치하지 않습니다.');
    if (refs.some((url) => url.startsWith('blob:'))) throw new Error('업로드되지 않은 이미지가 있습니다. 다시 선택해주세요.');
  }
  if (ids.length && params.content === undefined) throw new Error('새 이미지를 추가할 때 본문도 필요합니다.');
  if ('keep_image_ids' in params && params.keep_image_ids !== undefined) {
    const kept = params.keep_image_ids;
    if (new Set(kept).size !== kept.length || kept.some((id) => !Number.isSafeInteger(id) || id < 1)) throw new Error('기존 이미지 ID가 올바르지 않습니다.');
  }
};

/** 응답 검증의 공통 객체 검사. 타입 단언만으로 누락 필드를 화면에 넘기지 않는다. */
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('게시글 응답 형식이 올바르지 않습니다.');
  return value as Record<string, unknown>;
};

/** 목록 필드만 복사하므로 Mock 상세 데이터가 목록에 섞여 구현 차이를 숨기지 않는다. */
export const parsePostSummary = (value: unknown): PostSummary => {
  const item = object(value);
  for (const key of ['id', 'author_id', 'like_count', 'comment_count', 'view_count']) {
    if (!Number.isSafeInteger(item[key]) || Number(item[key]) < (key === 'id' || key === 'author_id' ? 1 : 0)) throw new Error('게시글 숫자 응답이 올바르지 않습니다.');
  }
  for (const key of ['title', 'author_account_id', 'created_at', 'updated_at']) {
    if (typeof item[key] !== 'string') throw new Error('게시글 필수 정보가 없습니다.');
  }

  // 실제 서버는 닉네임 미설정 계정을 null로 반환한다. 정상적인 null은 보존하되,
  // 필드 누락(undefined)이나 숫자·객체 등 계약에 없는 값은 계속 차단한다.
  // 목록·상세뿐 아니라 작성·수정 응답도 이 검증을 거치므로 저장 성공을 실패로 오인하지 않게 한다.
  if (item.author_username !== null && typeof item.author_username !== 'string') throw new Error('게시글 작성자 닉네임 응답이 올바르지 않습니다.');

  if (item.author_image_url !== null && typeof item.author_image_url !== 'string') throw new Error('작성자 이미지 응답이 올바르지 않습니다.');
  if (!Array.isArray(item.hashtags) || item.hashtags.some((tag) => !tag || !Number.isSafeInteger(tag.id) || typeof tag.name !== 'string')) throw new Error('태그 응답이 올바르지 않습니다.');
  return { id: item.id, title: item.title, author_id: item.author_id, author_account_id: item.author_account_id,
    author_username: item.author_username, author_image_url: item.author_image_url, hashtags: item.hashtags,
    like_count: item.like_count, comment_count: item.comment_count, view_count: item.view_count,
    created_at: item.created_at, updated_at: item.updated_at } as PostSummary;
};

/** 상세 이미지의 DB ID와 URL을 유지한다. 목록 응답을 상세로 잘못 사용하는 것도 차단한다. */
export const parsePostDetail = (value: unknown): PostEntity => {
  const item = object(value);
  const summary = parsePostSummary(value);
  if (typeof item.content !== 'string' || typeof item.is_deleted !== 'boolean' || !Array.isArray(item.images)
    || item.images.some((image) => !image || !Number.isSafeInteger(image.id) || image.id < 1 || typeof image.image_url !== 'string')) throw new Error('게시글 상세 응답이 올바르지 않습니다.');
  return { ...summary, content: item.content, images: item.images, is_deleted: item.is_deleted };
};

/** 다른 게시글의 좋아요 응답이나 잘못된 합계는 현재 화면에 적용하지 않는다. */
export const parsePostLike = (value: unknown, postId: number): PostLikeResponse => {
  const item = object(value);
  if (item.post_id !== postId || !Number.isSafeInteger(item.like_count) || Number(item.like_count) < 0 || typeof item.is_liked !== 'boolean') throw new Error('좋아요 응답이 올바르지 않습니다.');
  return item as unknown as PostLikeResponse;
};

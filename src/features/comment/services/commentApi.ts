import { isMockApi } from '../../../shared/config/apiMode';
import { mockCommentApi } from './commentApi.mock';
import { realCommentApi } from './commentApi.real';
import type { CommentApi } from '../types/comment.types';

/** 조회와 변경을 같은 모드로 선택한다. 댓글만 실제 서버로 나가는 혼합 동작을 방지한다. */
export const commentApi: CommentApi = isMockApi ? mockCommentApi : realCommentApi;

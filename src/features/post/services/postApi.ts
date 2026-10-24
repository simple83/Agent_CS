import { isMockApi } from '../../../shared/config/apiMode';
import type { PostApi } from '../types/postApi.types';
import { mockPostApi } from './postApi.mock';
import { realPostApi } from './postApi.real';

/** 게시글 API 전체를 한 모드로 선택한다. 목록은 Mock, 작성은 Real처럼 섞이는 상황을 방지한다. */
export const postApi: PostApi = isMockApi ? mockPostApi : realPostApi;

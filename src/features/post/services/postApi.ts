import { isMockApi } from '../../../shared/config/apiMode';
import type { PostApi } from '../types/postApi.types';
import { mockPostApi } from './postApi.mock';
import { realPostApi } from './postApi.real';

export const postApi: PostApi = isMockApi ? mockPostApi : realPostApi;

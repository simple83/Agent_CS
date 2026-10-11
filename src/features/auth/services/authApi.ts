import { isMockApi } from '../../../shared/config/apiMode';
import type { AuthApi } from '../types/authApi.types';
import { mockAuthApi } from './authApi.mock';
import { realAuthApi } from './authApi.real';

export const authApi: AuthApi = isMockApi ? mockAuthApi : realAuthApi;

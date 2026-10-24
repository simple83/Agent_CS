import { isMockApi } from '../../../shared/config/apiMode';
import type { AuthApi } from '../types/authApi.types';
import { mockAuthApi } from './authApi.mock';
import { realAuthApi } from './authApi.real';

/* 모드에 따라 인증 API 전체를 선택한다. UI와 Hook은 이 진입점만 사용해 Mock/Real 혼용을 막는다. */
export const authApi: AuthApi = isMockApi ? mockAuthApi : realAuthApi;

import { isMockApi } from '../../../shared/config/apiMode';
import { realProfileApi } from './profileApi.real';
import { mockProfileApi } from './profileApi.mock';
import type { ProfileApi } from '../types/profile.types';

/** 로그인과 같은 Vite 모드를 사용해 실제 계정과 시연 프로필이 섞이지 않게 한다. */
export const profileApi: ProfileApi = isMockApi ? mockProfileApi : realProfileApi;

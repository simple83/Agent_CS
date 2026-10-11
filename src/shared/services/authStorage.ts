import { isMockApi } from '../config/apiMode';
import type { LoginResponse, RefreshResponse } from '../../features/auth/types/auth.types';

// Preserve existing real-session keys. Mock sessions never overwrite them.
const prefix = isMockApi ? 'agent-cs:mock:auth:' : '';
const keys = ['access_token', 'refresh_token', 'user_id', 'account_id'] as const;

export const authStorage = {
  getAccessToken: () => localStorage.getItem(`${prefix}access_token`),
  getRefreshToken: () => localStorage.getItem(`${prefix}refresh_token`),
  saveLogin(data: LoginResponse) {
    for (const key of keys) localStorage.setItem(`${prefix}${key}`, String(data[key]));
  },
  saveTokens(data: RefreshResponse) {
    localStorage.setItem(`${prefix}access_token`, data.access_token);
    localStorage.setItem(`${prefix}refresh_token`, data.refresh_token);
  },
  clear() {
    for (const key of keys) localStorage.removeItem(`${prefix}${key}`);
  },
};

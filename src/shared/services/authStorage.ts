import { isMockApi } from '../config/apiMode';
import type { LoginResponse, RefreshResponse } from '../../features/auth/types/auth.types';

// 실제 로그인 키는 유지하고 Mock 키에만 접두사를 붙여 두 환경의 세션이 섞이지 않게 한다.
const prefix = isMockApi ? 'agent-cs:mock:auth:' : '';
const keys = ['access_token', 'refresh_token', 'user_id', 'account_id'] as const;

/**
 * 현재 모드의 로그인 정보를 localStorage에서 읽고 쓴다. 저장소 오류는 호출자에게 전달한다.
 * 토큰은 암호화되지 않으며 같은 출처의 스크립트에서 접근 가능하므로 XSS 방어가 필요하다.
 */
export const authStorage = {
  /** 사용자별 조회 API에 쓸 ID를 읽는다. 누락/손상된 값은 null이며 인증 판단은 서버가 맡는다. */
  getUserId() {
    const id = Number(localStorage.getItem(`${prefix}user_id`));
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  },
  /** 보호된 API의 Authorization 헤더에 넣을 액세스 토큰을 읽는다. 없으면 null이다. */
  getAccessToken: () => localStorage.getItem(`${prefix}access_token`),
  /** 갱신/로그아웃 요청에 사용할 리프레시 토큰을 읽는다. */
  getRefreshToken: () => localStorage.getItem(`${prefix}refresh_token`),
  /** 로그인 응답의 토큰과 사용자 식별자를 문자열로 저장한다. */
  saveLogin(data: LoginResponse) {
    for (const key of keys) localStorage.setItem(`${prefix}${key}`, String(data[key]));
  },
  /** 토큰 갱신 시 사용자 식별자는 그대로 두고 토큰만 교체한다. */
  saveTokens(data: RefreshResponse) {
    localStorage.setItem(`${prefix}access_token`, data.access_token);
    localStorage.setItem(`${prefix}refresh_token`, data.refresh_token);
  },
  /** 현재 모드의 인증 키만 지운다. 게시글과 다른 모드의 로그인 정보는 남긴다. */
  clear() {
    for (const key of keys) localStorage.removeItem(`${prefix}${key}`);
  },
};

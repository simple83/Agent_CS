import { isMockApi } from '../config/apiMode';
import type { LoginResponse, RefreshResponse } from '../../features/auth/types/auth.types';

// 실제 로그인 키는 유지하고 Mock 키에만 접두사를 붙여 두 환경의 세션이 섞이지 않게 한다.
const prefix = isMockApi ? 'agent-cs:mock:auth:' : '';
const keys = ['access_token', 'refresh_token', 'user_id', 'account_id'] as const;
const changeEvent = 'agent-cs:auth-changed';

/** 빈 값이나 잘못 저장된 null/undefined 문자열은 요청에 사용할 토큰으로 취급하지 않는다. */
const readToken = (key: 'access_token' | 'refresh_token') => {
  const token = localStorage.getItem(`${prefix}${key}`)?.trim();
  return token && token !== 'null' && token !== 'undefined' ? token : null;
};

/** 같은 탭에서는 storage 이벤트가 발생하지 않으므로 저장 완료 후 별도 알림을 보낸다. */
const notifyChange = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new window.Event(changeEvent));
};

/**
 * 현재 모드의 로그인 정보를 localStorage에서 읽고 쓴다. 저장소 오류는 호출자에게 전달한다.
 * 토큰은 암호화되지 않으며 같은 출처의 스크립트에서 접근 가능하므로 XSS 방어가 필요하다.
 */
export const authStorage = {
  /** 인증 변경과 탭 복귀를 구독한다. 직접 저장소를 수정해 알림이 없었던 경우도 복귀 시 다시 읽는다. */
  subscribe(onChange: () => void) {
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) return;
      // 다른 탭에서 Mock 세션만 제거한 경우도 토큰 변경과 동일하게 다시 확인한다.
      if (event.key === null || keys.some((key) => event.key === `${prefix}${key}`)
        || (isMockApi && event.key === 'agent-cs:mock:v1:database')) onChange();
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') onChange();
    };

    window.addEventListener(changeEvent, onChange);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onChange);
    document.addEventListener('visibilitychange', onVisible);
    // 화면을 그대로 둔 동안의 JWT/Mock 만료도 반영한다. 서버의 최종 권한 검사를 대신하지 않는다.
    const timer = window.setInterval(onChange, 30000);
    return () => {
      window.removeEventListener(changeEvent, onChange);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onChange);
      document.removeEventListener('visibilitychange', onVisible);
      window.clearInterval(timer);
    };
  },

  /** 사용자별 조회 API에 쓸 ID를 읽는다. 누락/손상된 값은 null이며 인증 판단은 서버가 맡는다. */
  getUserId() {
    const id = Number(localStorage.getItem(`${prefix}user_id`));
    return Number.isSafeInteger(id) && id > 0 ? id : null;
  },
  /** 보호된 API의 Authorization 헤더에 넣을 액세스 토큰을 읽는다. 없으면 null이다. */
  getAccessToken: () => readToken('access_token'),
  /** JWT exp는 메뉴 표시용 힌트다. 서명 검증과 단일 세션 무효화 여부는 서버가 판단한다. */
  hasActiveAccessToken() {
    const token = readToken('access_token');
    if (!token) return false;
    if (token.split('.').length !== 3) return true;
    try {
      const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=')));
      return typeof payload.exp === 'number' && Number.isFinite(payload.exp) && payload.exp * 1000 > Date.now();
    } catch { return false; }
  },
  /** 이전 요청의 401이 새 로그인 세션을 지우지 않도록 요청에 사용한 토큰을 대조한다. */
  expireAccessToken(token: string) {
    if (readToken('access_token') !== token) return;
    localStorage.removeItem(`${prefix}access_token`);
    notifyChange();
  },
  /** 갱신/로그아웃 요청에 사용할 리프레시 토큰을 읽는다. */
  getRefreshToken: () => readToken('refresh_token'),
  /** 로그인 응답의 토큰과 사용자 식별자를 문자열로 저장한다. */
  saveLogin(data: LoginResponse) {
    for (const key of keys) localStorage.setItem(`${prefix}${key}`, String(data[key]));
    notifyChange();
  },
  /** 서버는 액세스 토큰만 재발급한다. 기존 갱신 토큰과 사용자 식별자는 보존한다. */
  saveTokens(data: RefreshResponse) {
    localStorage.setItem(`${prefix}access_token`, data.access_token);
    notifyChange();
  },
  /** 현재 모드의 인증 키만 지운다. 게시글과 다른 모드의 로그인 정보는 남긴다. */
  clear() {
    for (const key of keys) localStorage.removeItem(`${prefix}${key}`);
    notifyChange();
  },
};

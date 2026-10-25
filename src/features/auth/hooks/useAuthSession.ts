import { useSyncExternalStore } from 'react';
import { authStorage } from '../../../shared/services/authStorage';

/** 메뉴 표시용 로그인 여부다. 토큰의 만료/실제 요청 권한은 서버가 최종 판단한다. */
const getSnapshot = () => Boolean(authStorage.getAccessToken());

/** 서버 렌더링에는 브라우저 저장소가 없으므로 로그인 전 상태로 시작한다. */
const getServerSnapshot = () => false;

/** 로그인/로그아웃 직후와 새로고침 후에도 공통 메뉴가 현재 저장된 세션을 반영하게 한다. */
export const useAuthSession = () =>
  useSyncExternalStore(authStorage.subscribe, getSnapshot, getServerSnapshot);

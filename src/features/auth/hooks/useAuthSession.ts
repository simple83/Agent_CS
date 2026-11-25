import { useSyncExternalStore } from 'react';
import { authStorage } from '../../../shared/services/authStorage';
import { isMockApi } from '../../../shared/config/apiMode';
import { getActiveMockUserId } from '../../../shared/mocks/mockStore';

/** Mock은 저장된 세션의 유효성까지 확인한다. 실제 모드의 최종 인증 판단은 서버가 담당한다. */
export const hasActiveAuthSession = () => isMockApi
  ? getActiveMockUserId() !== null
  : authStorage.hasActiveAccessToken();

/** 서버 렌더링에는 브라우저 저장소가 없으므로 로그인 전 상태로 시작한다. */
const getServerSnapshot = () => false;

/** 로그인/로그아웃 직후와 새로고침 후에도 공통 메뉴가 현재 저장된 세션을 반영하게 한다. */
export const useAuthSession = () =>
  useSyncExternalStore(authStorage.subscribe, hasActiveAuthSession, getServerSnapshot);

/** 메뉴와 작성자 도구에 동일한 로그인 판단을 적용해 만료된 Mock 계정의 관리 버튼도 숨긴다. */
const getUserSnapshot = () => isMockApi
  ? getActiveMockUserId()
  : authStorage.hasActiveAccessToken() ? authStorage.getUserId() : null;

/** 서버 렌더링에서는 저장된 사용자를 알 수 없으므로 작성자 기능을 숨긴다. */
const getServerUserSnapshot = () => null;

/**
 * 로그인 여부가 계속 true인 계정 전환도 감지한다. 작성자 버튼과 수정 화면에서 사용한다.
 * 저장된 번호는 화면 표시용이며 실제 수정·삭제 권한은 API에서 다시 검사한다.
 */
export const useAuthUserId = () =>
  useSyncExternalStore(authStorage.subscribe, getUserSnapshot, getServerUserSnapshot);

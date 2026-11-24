import type { LoginResponse, RefreshResponse } from '../types/auth.types';

/** JSON 타입 단언만으로 잘못된 토큰을 저장하지 않도록 인증 응답의 객체 형태부터 확인한다. */
const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('인증 응답 형식이 올바르지 않습니다.');
  return value as Record<string, unknown>;
};

/** 토큰은 비어 있거나 누락될 수 없다. 검사 실패 시 원문 토큰을 오류에 포함하지 않는다. */
const token = (value: unknown): string => {
  if (typeof value !== 'string' || !value.trim()) throw new Error('인증 토큰 응답이 올바르지 않습니다.');
  return value;
};

/** 갱신 응답에는 새 access_token만 필수다. 생략 가능한 token_type은 서버 기본값을 적용한다. */
export const parseRefreshResponse = (value: unknown): RefreshResponse => {
  const item = object(value);
  const tokenType = item.token_type === undefined ? 'bearer' : item.token_type;
  if (typeof tokenType !== 'string' || tokenType.toLowerCase() !== 'bearer') throw new Error('지원하지 않는 인증 토큰 종류입니다.');
  return { access_token: token(item.access_token), token_type: tokenType };
};

/** 로그인 응답의 사용자와 두 토큰을 검증한 뒤 저장 가능한 필드만 반환한다. */
export const parseLoginResponse = (value: unknown): LoginResponse => {
  const item = object(value);
  if (!Number.isSafeInteger(item.user_id) || Number(item.user_id) < 1
    || typeof item.account_id !== 'string' || !item.account_id) throw new Error('로그인 사용자 응답이 올바르지 않습니다.');
  return { ...parseRefreshResponse(item), refresh_token: token(item.refresh_token),
    user_id: item.user_id as number, account_id: item.account_id };
};

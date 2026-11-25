import { useEffect, useRef, useState } from 'react';
import { authStorage } from '../../../shared/services/authStorage';
import { authApi } from '../../auth/services/authApi';
import { profileApi } from '../services/profileApi';
import type { ProfileUpdate } from '../types/profile.types';

/** 저장과 탈퇴를 함께 잠가 중복/동시 변경을 막고, 완료 시 다른 계정의 상태를 건드리지 않는다. */
export const useProfileActions = (token: string, onWithdrawn: () => void) => {
  const mounted = useRef(false);
  const locked = useRef(false);
  const finished = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  /** 같은 렌더에서 연속 클릭해도 ref 잠금이 먼저 적용된다. 서버 변경 요청은 자동 재시도하지 않는다. */
  const begin = () => {
    if (locked.current || finished.current) return false;
    if (authStorage.getAccessToken() !== token) { setError('로그인 상태가 변경되었습니다. 다시 로그인해주세요.'); return false; }
    locked.current = true;
    setBusy(true);
    setError('');
    return true;
  };

  const current = () => mounted.current && authStorage.getAccessToken() === token;

  /** 완료 후 현재 화면에만 상태를 반영한다. 실패 시 폼의 입력값과 사진 선택은 그대로 남는다. */
  const end = () => {
    locked.current = false;
    if (mounted.current) setBusy(false);
  };

  const save = async (input: ProfileUpdate) => {
    if (!begin()) return null;
    try {
      const result = await profileApi.updateMe(input);
      if (!current()) return null;
      if (result.id !== authStorage.getUserId() || !result.is_active) throw new Error('현재 계정의 저장 결과를 확인할 수 없습니다. 다시 로그인해주세요.');
      return result;
    } catch (reason) {
      if (current()) setError(reason instanceof Error ? reason.message : '프로필 저장에 실패했습니다.');
      return null;
    } finally { end(); }
  };

  /** 성공한 탈퇴만 세션을 지운다. 언마운트 뒤 성공해도 같은 세션이면 정리하되 새 로그인은 보존한다. */
  const withdraw = async (password: string) => {
    if (!begin()) return false;
    try {
      await authApi.withdraw(password);
      finished.current = true;
      if (authStorage.getAccessToken() === token) {
        // 부모 화면에 완료 상태를 먼저 전달한다. 인증 가드보다 완료 안내가 우선되게 한다.
        try { if (mounted.current) onWithdrawn(); }
        finally { if (authStorage.getAccessToken() === token) authStorage.clear(); }
      }
      return true;
    } catch (reason) {
      if (current()) setError(reason instanceof Error ? reason.message : '회원 탈퇴에 실패했습니다.');
      return false;
    } finally { end(); }
  };

  return { save, withdraw, busy, error };
};

import { useEffect, useState } from 'react';
import { profileApi } from '../services/profileApi';
import { authStorage } from '../../../shared/services/authStorage';
import type { UserProfile } from '../types/profile.types';

/** 세션별로 마운트한다. 재시도·언마운트·계정 전환 이전의 조회 결과는 화면에 반영하지 않는다. */
export const useProfile = (token: string) => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    profileApi.getMe().then((result) => {
      if (!active || authStorage.getAccessToken() !== token) return;
      if (result.id !== authStorage.getUserId() || !result.is_active) throw new Error('현재 계정의 프로필을 확인할 수 없습니다. 다시 로그인해주세요.');
      setProfile(result);
    }).catch((reason: unknown) => {
      if (active && authStorage.getAccessToken() === token) setError(reason instanceof Error ? reason.message : '프로필을 불러오지 못했습니다.');
    }).finally(() => {
      if (active && authStorage.getAccessToken() === token) setLoading(false);
    });
    return () => { active = false; };
  }, [token, attempt]);

  /** 최초 조회 실패는 빈 프로필과 구분하고 사용자가 명시적으로 다시 조회할 수 있게 한다. */
  const retry = () => { setLoading(true); setError(''); setAttempt((value) => value + 1); };
  return { profile, error, loading, retry };
};

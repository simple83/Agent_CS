import { useEffect, useRef, useState } from 'react';
import { authApi } from '../services/authApi';
import type { SignupRequest, SignupResponse } from '../types/auth.types';
import { validateSignup } from '../utils/signup';

/** 가입 검증·중복 제출·성공 상태를 관리한다. 로그인 세션을 생성하거나 변경하지 않는다. */
export const useSignup = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registered, setRegistered] = useState<SignupResponse | null>(null);
  const pending = useRef(false);
  const completed = useRef(false);
  const active = useRef(false);

  // 화면을 떠난 뒤 완료된 요청은 이전 폼을 갱신하거나 새 화면을 이동시키지 않는다.
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  /** 확인 비밀번호는 클라이언트에서만 비교한다. 같은 렌더의 연속 제출도 ref로 즉시 차단한다. */
  const submit = async (request: SignupRequest, confirmation: string): Promise<boolean> => {
    if (pending.current || completed.current) return false;
    setError(null);

    try {
      validateSignup(request);
      if (request.password !== confirmation) throw new Error('비밀번호 확인이 일치하지 않습니다.');
    } catch (err) {
      setError(err instanceof Error ? err.message : '입력 내용을 확인해주세요.');
      return false;
    }

    pending.current = true;
    setIsLoading(true);

    try {
      const result = await authApi.signup(request);
      completed.current = true;
      if (!active.current) return false;
      setRegistered(result);
      return true;
    } catch (err) {
      if (active.current) setError(err instanceof TypeError
        ? '서버에 연결하지 못했습니다. 연결 상태를 확인해주세요. 응답을 받지 못한 경우 이미 가입되었을 수 있습니다.'
        : err instanceof Error ? err.message : '회원가입 중 오류가 발생했습니다.');
      return false;
    } finally {
      pending.current = false;
      if (active.current) setIsLoading(false);
    }
  };

  return { isLoading, error, registered, submit };
};

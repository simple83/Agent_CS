import type { SignupRequest } from '../types/auth.types';

/**
 * 확정 SignupRequest 규칙을 화면과 Real/Mock 서비스에서 공통으로 검사한다.
 * 아이디를 임의로 소문자화하거나 비밀번호를 trim하지 않아 입력한 자격 증명을 보존한다.
 * 비밀번호 길이는 Python 문자열과 동일하게 유니코드 코드 포인트로 계산한다.
 */
export const validateSignup = ({ account_id, password }: SignupRequest): void => {
  if (!/^[a-z0-9_]{4,30}$/.test(account_id)) {
    throw new Error('아이디는 영문 소문자·숫자·밑줄(_)로 4~30자 입력해주세요.');
  }

  const length = Array.from(password).length;
  if (length < 8 || length > 128) {
    throw new Error('비밀번호는 8~128자 입력해주세요.');
  }
};

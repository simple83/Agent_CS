/**
 * Mock 가입 비밀번호를 평문으로 localStorage에 남기지 않기 위한 검증값 생성이다.
 * 브라우저 표준 Web Crypto만 사용한다. 실제 인증 보안은 서버 책임이며 Mock 저장소는 사용자가 수정할 수 있다.
 * HTTPS 또는 localhost에서만 사용하고, 실제 계정 비밀번호 대신 테스트용 비밀번호를 입력해야 한다.
 */
export const deriveMockPassword = async (password: string, salt: string): Promise<string> => {
  if (!globalThis.crypto?.subtle) throw new Error('Mock 회원가입은 HTTPS 또는 localhost에서 사용해주세요.');

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations: 100000,
  }, key, 256);

  return Array.from(new Uint8Array(bits), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

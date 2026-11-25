import { useState, type FormEvent } from 'react';
import { Link, useLocation } from 'react-router';
import { getLoginReturnTo } from '../utils/loginRedirect';
import { useSignup } from '../hooks/useSignup';
import styles from './LoginForm.module.css';

/**
 * 최소 가입 입력과 완료 안내를 제공한다. 이메일·닉네임은 SignupRequest에 없어 받지 않는다.
 * 비밀번호는 컴포넌트 메모리에만 두고 가입 성공 시 비운다. URL이나 로그인 화면에 전달하지 않는다.
 */
export const SignupForm = () => {
  const location = useLocation();
  const returnTo = getLoginReturnTo(location.state);
  const [accountId, setAccountId] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const { isLoading, error, registered, submit } = useSignup();

  /**
   * 자동완성·입력 복원은 onChange 없이 실제 입력칸만 바꿀 수 있으므로 제출 순간의 값을 읽는다.
   * React 상태만 비교하면 화면과 다른 과거의 일치 값을 검증·전송할 수 있다.
   * 검증과 API 요청에는 같은 스냅샷을 사용하고 실패 시에도 화면에 실제 입력값을 유지한다.
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const readValue = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | null)?.value ?? '';
    const currentAccountId = readValue('account_id');
    const currentPassword = readValue('password');
    const currentConfirmation = readValue('password_confirmation');

    setAccountId(currentAccountId);
    setPassword(currentPassword);
    setConfirmation(currentConfirmation);
    if (await submit({ account_id: currentAccountId, password: currentPassword }, currentConfirmation)) {
      setPassword('');
      setConfirmation('');
    }
  };

  if (registered) return <section className={styles.container}>
    <h2 className={styles.title}>회원가입 완료</h2>
    <p role="status">{registered.account_id} 계정이 만들어졌습니다. 로그인 후 이용해주세요.</p>
    <Link className={styles.link} to="/login" state={{ returnTo }}>로그인하러 가기</Link>
  </section>;

  return <section className={styles.container}>
    <header className={styles.header}><h2 className={styles.title}>회원가입</h2></header>
    {/* 비밀번호 길이는 UTF-16 기준인 HTML maxlength 대신 Hook에서 API와 같은 단위로 검사한다. */}
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <label className={styles.field}>아이디
        <input className={styles.input} name="account_id" autoComplete="username" autoCapitalize="none"
          spellCheck={false} aria-describedby="signup-account-help" value={accountId}
          disabled={isLoading} required onChange={(event) => setAccountId(event.target.value)} />
      </label>
      <p id="signup-account-help" className={styles.help}>영문 소문자·숫자·밑줄(_)로 4~30자</p>

      <label className={styles.field}>비밀번호
        <input className={styles.input} name="password" type="password" autoComplete="new-password"
          aria-describedby="signup-password-help" value={password} disabled={isLoading} required
          onChange={(event) => setPassword(event.target.value)} />
      </label>
      <p id="signup-password-help" className={styles.help}>8~128자</p>

      <label className={styles.field}>비밀번호 확인
        <input className={styles.input} name="password_confirmation" type="password" autoComplete="new-password"
          value={confirmation} disabled={isLoading} required onChange={(event) => setConfirmation(event.target.value)} />
      </label>

      {error && <p className={styles.errorMessage} role="alert">{error}</p>}
      <button className={styles.button} type="submit" disabled={isLoading}>
        {isLoading ? '가입 요청 중...' : '회원가입'}
      </button>
      <Link className={styles.link} to="/login" state={{ returnTo }}>로그인으로 돌아가기</Link>
    </form>
  </section>;
};

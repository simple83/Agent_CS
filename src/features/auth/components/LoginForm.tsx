import styles from './LoginForm.module.css';
import type { FC, FormEvent } from 'react';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { Link } from 'react-router';

interface LoginFormProps {
  onLoggedIn?: () => void;
}

/*
 * 입력값을 관리하고 로그인 처리는 useAuth에 맡긴다. 성공 후 화면 이동은 부모 콜백이 결정한다.
 * 입력 요소를 내부 함수 컴포넌트로 만들지 않아 재렌더링 시 입력 포커스가 유지된다.
 */
export const LoginForm: FC<LoginFormProps> = ({ onLoggedIn }) => {
  const [accountId, setAccountId] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  
  const { login, isLoading, error } = useAuth();

  /* 기본 폼 전송을 막고 빈 입력을 검사한다. 비밀번호는 공백을 포함한 원문 그대로 전송한다. */
  const handleLoginSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!accountId.trim() || !password) {
      alert('아이디와 비밀번호를 모두 입력해주세요.');
      return;
    }

    const isSuccess = await login({
      account_id: accountId,
      password: password,
    });

    if (isSuccess) {
      onLoggedIn?.();
    }
  };


  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h2 className={styles.title}>로그인</h2>
      </header>

      <form onSubmit={handleLoginSubmit} className={styles.form}>
        <input 
          type="text" 
          aria-label="아이디" autoComplete="username"
          placeholder="아이디(account_id)" 
          value={accountId} 
          onChange={(e) => setAccountId(e.target.value)} 
          disabled={isLoading} 
          className={styles.input}
        />

        <input 
          type="password" 
          aria-label="비밀번호" autoComplete="current-password"
          placeholder="비밀번호" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          disabled={isLoading}
          className={styles.input}
        />

        <button
          type="submit"
          disabled={isLoading}
          className={styles.button}
        >
          {isLoading ? '로그인 요청 중...' : '로그인'}
        </button>

        {error && (
          <p className={styles.errorMessage}>
            {error}
          </p>
        )}

      </form>
      <p className={styles.help}>계정이 없으신가요? <Link className={styles.link} to="/signup">회원가입</Link></p>
    </div>
  );
};

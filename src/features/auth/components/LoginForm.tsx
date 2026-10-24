import type { FC, FormEvent } from 'react';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

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

    if (!accountId.trim() || !password.trim()) {
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
    <div style={styles.container}>
      <header style={styles.header}>
        <h2 style={styles.title}>로그인</h2>
      </header>

      <form onSubmit={handleLoginSubmit} style={styles.form}>
        <input 
          type="text" 
          placeholder="아이디(account_id)" 
          value={accountId} 
          onChange={(e) => setAccountId(e.target.value)} 
          disabled={isLoading} 
          style={styles.input}
        />

        <input 
          type="password" 
          placeholder="비밀번호" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          disabled={isLoading}
          style={styles.input}
        />

        <button
          type="submit"
          disabled={isLoading}
          style={{
            ...styles.button,
            backgroundColor: isLoading ? '#ccc' : '#007bff',
            cursor: isLoading ? 'not-allowed' : 'pointer',
          }}
        >
          {isLoading ? '로그인 요청 중...' : '로그인'}
        </button>

        {error && (
          <p style={styles.errorMessage}>
            {error}
          </p>
        )}

      </form>
    </div>
  );
};


// 로그인 폼 전용 배치다. as const는 CSS 속성값이 일반 문자열로 넓혀지지 않도록 한다.
const styles = {
  container: {
    padding: '20px',
    maxWidth: '360px',
    margin: '0 auto',
    fontFamily: 'sans-serif',
  },
  header: {
    marginBottom: '20px',
    textAlign: 'center' as const,
  },
  title: {
    margin: 0,
    color: '#333',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  input: {
    width: '100%',
    height: '52px',
    padding: '0 16px',
    fontSize: '17px',
    border: '1px solid #ced4da',
    borderRadius: '8px',
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  button: {
    width: '100%',
    height: '52px',
    padding: '0 16px',
    fontSize: '17px',
    fontWeight: 'bold' as const,
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    boxSizing: 'border-box' as const,
    transition: 'background-color 0.2s ease',
  },
  errorMessage: {
    color: '#dc3545',
    fontSize: '14px',
    margin: '4px 0 0 0',
    textAlign: 'center' as const,
  },
};

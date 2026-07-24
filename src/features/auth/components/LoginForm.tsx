import type { FC, FormEvent, ChangeEvent } from 'react';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export const LoginForm: FC = () => {
  const [accountId, setAccountId] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  
  const { login, isLoading, error } = useAuth();

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
      alert('로그인이 완료되었습니다!');
    }
  };

  //헤더
  const RenderHeader = () => (
    <header style={styles.header}>
      <h2 style={styles.title}>로그인</h2>
    </header>
  );

  //입력 필드
  const LoginInput = ({ 
    type, 
    placeholder, 
    value, 
    onChange, 
    disabled 
  }: {
    type: 'text' | 'password';
    placeholder: string;
    value: string;
    onChange: (e: ChangeEvent<HTMLInputElement>) => void;
    disabled: boolean;
  }) => (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      disabled={disabled}
      style={styles.input}
    />
  );

  //제출 버튼
  const SubmitButton = () => (
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
  );

  //에러 메시지
  const ErrorMessage = () => {
    if (!error) return null;
    return <p style={styles.errorMessage}>{error}</p>;
  };


  return (
    <div style={styles.container}>
      <RenderHeader />

      <form onSubmit={handleLoginSubmit} style={styles.form}>
        <LoginInput 
          type="text" 
          placeholder="아이디(account_id)" 
          value={accountId} 
          onChange={(e) => setAccountId(e.target.value)} 
          disabled={isLoading} 
        />

        <LoginInput 
          type="password" 
          placeholder="비밀번호" 
          value={password} 
          onChange={(e) => setPassword(e.target.value)} 
          disabled={isLoading} 
        />

        <SubmitButton />
        <ErrorMessage />
      </form>
    </div>
  );
};


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
    padding: '12px',
    fontSize: '15px',
    border: '1px solid #ced4da',
    borderRadius: '6px',
    outline: 'none',
  },
  button: {
    padding: '12px',
    fontSize: '16px',
    fontWeight: 'bold' as const,
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    transition: 'background-color 0.2s ease',
  },
  errorMessage: {
    color: '#dc3545',
    fontSize: '14px',
    margin: '4px 0 0 0',
    textAlign: 'center' as const,
  },
};
import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';

export const LoginForm: React.FC = () => {
  const [accountId, setAccountId] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  
  const { login, isLoading, error } = useAuth();

  const handleLoginSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!accountId.trim() || !password.trim()) {
      alert('아이디와 비밀번호를 모두 입력해주세요.');
      return;
    }

    // 명세서 Request 바디 key 구조에 맞춰 전달
    const isSuccess = await login({
      account_id: accountId,
      password: password
    });

    if (isSuccess) {
      alert('로그인이 완료되었습니다!');
      // 이후 페이지 리다이렉트나 메인 대시보드로 이동하는 로직 배치 가능
    }
    };

    //입력 필드
    interface InputFieldProps {
  type: 'text' | 'password';
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled: boolean;
    }
    const LoginInput: React.FC<InputFieldProps> = ({ type, placeholder, value, onChange, disabled }) => {
  return (
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={onChange}
      disabled={disabled}
      style={{ padding: '10px', fontSize: '16px' }}
    />
  );
    };

    //로그인 제출 버튼
    interface SubmitButtonProps {
  isLoading: boolean;
    }
    const SubmitButton: React.FC<SubmitButtonProps> = ({ isLoading }) => {
  return (
    <button 
      type="submit" 
      disabled={isLoading}
      style={{ 
        padding: '12px', 
        fontSize: '16px', 
        backgroundColor: isLoading ? '#ccc' : '#007bff', 
        color: '#fff', 
        border: 'none', 
        cursor: isLoading ? 'not-allowed' : 'pointer' 
      }}
    >
      {isLoading ? '로그인 요청 중...' : '로그인'}
    </button>
  );
    };


    //에러 메시지 출력
    interface ErrorMessageProps {
  error: string | null;
    }
    const ErrorMessage: React.FC<ErrorMessageProps> = ({ error }) => {
  if (!error) return null;
  return (
    <p style={{ color: '#dc3545', fontSize: '14px', margin: '4px 0 0 0' }}>
      {error}
    </p>
  );
    };


    return (
        <div style={{ padding: '20px', maxWidth: '360px', margin: '0 auto' }}>
        <h2>로그인</h2>
        <form onSubmit={handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        
            {/* 아이디 입력 블록 */}
            <LoginInput 
            type="text" 
            placeholder="아이디(account_id)" 
            value={accountId} 
            onChange={(e) => setAccountId(e.target.value)} 
            disabled={isLoading} 
            />

            {/* 비밀번호 입력 블록 */}
            <LoginInput 
            type="password" 
            placeholder="비밀번호" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            disabled={isLoading} 
            />
            
            {/* 버튼 블록 */}
            <SubmitButton isLoading={isLoading} />

            {/* 에러 메시지 블록 */}
            <ErrorMessage error={error} />

      </form>
    </div>
  );
};
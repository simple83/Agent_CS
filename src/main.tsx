import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

/**
 * Mock일 때만 테스트 도구를 동적으로 불러온 후 React 앱을 마운트한다.
 * StrictMode는 개발 중 Effect 정리 누락을 확인하기 위해 실행을 반복할 수 있다.
 */
async function bootstrap() {
  const MockToolbar = import.meta.env.VITE_USE_MOCK_API === 'true'
    ? (await import('./shared/mocks/MockToolbar')).MockToolbar
    : null;

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      {MockToolbar && <MockToolbar />}
      <App />
    </StrictMode>,
  );
}

void bootstrap();

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import layout from './App.module.css'
import App from './App.tsx'

/**
 * Mock 모드에서 표시가 허용된 경우에만 테스트 도구를 불러온 후 React 앱을 마운트한다.
 * 시연 빌드는 도구만 숨기며, API의 Mock/실제 모드 선택에는 영향을 주지 않는다.
 * StrictMode는 개발 중 Effect 정리 누락을 확인하기 위해 실행을 반복할 수 있다.
 */
async function bootstrap() {
  // 표시 옵션을 생략하면 기존 개발 환경처럼 도구를 제공한다. 'false'일 때만 숨긴다.
  const MockToolbar = import.meta.env.VITE_USE_MOCK_API === 'true'
    && import.meta.env.VITE_SHOW_MOCK_TOOLBAR !== 'false'
    ? (await import('./shared/mocks/MockToolbar')).MockToolbar
    : null;

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <div className={layout.shell}>
        {MockToolbar && <MockToolbar />}
        <App />
      </div>
    </StrictMode>,
  );
}

void bootstrap();

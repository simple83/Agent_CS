import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

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

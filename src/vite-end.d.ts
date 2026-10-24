/// <reference types="vite/client" />

/** Vite가 주입하는 환경 변수의 타입이다. VITE_ 변수는 번들에 노출되므로 비밀을 담지 않는다. */
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_USE_MOCK_API?: string;
  readonly VITE_MOCK_DELAY_MS?: string;
}

/** import.meta.env에 위 환경 변수 타입을 연결한다. 실제 값 검증은 apiMode에서 수행한다. */
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

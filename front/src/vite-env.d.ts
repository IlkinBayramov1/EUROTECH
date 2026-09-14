/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_DESCRIPTION: string;
  readonly VITE_APP_ENV: string;
  readonly VITE_DEFAULT_LANGUAGE: string;
  readonly VITE_SUPPORT_EMAIL: string;
  readonly VITE_EMERGENCY_CONSULAR_HOTLINE: string;
  readonly VITE_API_TIMEOUT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  readonly VITE_BASE_PATH?: string;
  readonly VITE_SITE_NAME?: string;
  readonly VITE_SITE_URL?: string;
  readonly VITE_UPI_ID?: string;
  readonly VITE_UPI_PAYEE_NAME?: string;
  readonly VITE_GA_ID?: string;
  readonly VITE_META_PIXEL_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CONTACT_URL?: string;
  /** '1' only in `npm run build:e2e`; points Auth and Firestore at local emulators. */
  readonly VITE_EMULATOR?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

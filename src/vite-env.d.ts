/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
    readonly VITE_SUPABASE_URL: string;
    readonly VITE_SUPABASE_ANON_KEY: string;
    // तुमचे इतर Environment Variables खाली जोडू शकता...
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
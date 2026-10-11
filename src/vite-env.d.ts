/// <reference types="vite/client" />

/**
 * Public configuration only. Anything prefixed VITE_ is compiled into the browser bundle and visible to every visitor,
 * so it must NEVER hold a service-role/secret key, a database password or any other privileged credential.
 */
interface ImportMetaEnv {
  /** https://<project-ref>.supabase.co */
  readonly VITE_SUPABASE_URL?: string
  /** The publishable key (sb_publishable_…) or the legacy anon key. Never a secret/service-role key. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

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
  /**
   * Which data the site uses: 'supabase' (live) or 'mock' (in-memory demo data). Optional. When unset, production builds use
   * Supabase and development uses Supabase only if it is configured. See src/services/runtime.ts.
   */
  readonly VITE_DATA_SOURCE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

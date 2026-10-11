# Administrator authentication (frontend)

Real Supabase Auth now guards `/admin`. The admin pages still show the **mock, in-memory demo data**: switching the repositories to
Supabase is a later phase. Signing in therefore opens the existing admin screens, but no real data is behind them yet.

## How it works

| Piece | File | Role |
| --- | --- | --- |
| Public settings check | `src/lib/supabaseConfig.ts` | Accepts an https project URL and a **publishable/anon key**. Refuses a secret or service-role key (`sb_secret_…`, or a JWT whose role is not `anon`), plain http (except localhost) and missing values. |
| Client | `src/lib/supabase.ts` | The only place the client is created. Password sign-in only; `persistSession` on, auto token refresh on, `detectSessionInUrl` off. |
| State machine | `src/features/auth/authController.ts` | Framework-free: loading, signed-out, signed-in plus a verified role. One backend subscription (reference-counted, safe under React StrictMode). Ignores stale answers. |
| Supabase adapter | `src/features/auth/supabaseBackend.ts` | Sign in, restore session, sign out, and read the role from `public.profiles` (`select role … eq id`). RLS lets a user read only their own row. |
| Provider | `src/features/auth/AuthProvider.tsx` | Owns the controller and clears cached query data when the user goes away. |
| Guard | `src/features/auth/RequireAdmin.tsx`, `guard.ts` | Renders admin content **only** for a verified administrator. |
| Login | `src/pages/LoginPage.tsx` | Email and password. No sign-up, registration or reset link. |

### Login, restore, logout, role verification

- **Login:** `signInWithPassword`, then the role is read from the database **before** success is reported. A valid account that is not the
  administrator is signed out immediately with a clear message; a role check that fails also signs out (access is denied, never assumed).
  Error text is generic ("The email or password is not correct.") so it never reveals whether an email exists.
- **Session restoration:** the session lives in the browser's `localStorage` under `anuditya-admin-auth` (the only thing this app stores there). On a
  refresh the guard shows "Checking your session…" until the stored session and the role have both been verified; **no admin content is rendered before that.**
- **Expiry:** when the session ends without the user asking (token refresh fails or it is revoked), the admin area closes, the visitor is sent to
  `/login` and told "Your session has ended". A normal logout is not reported as expiry.
- **Role re-checks:** the role is checked again when the token is refreshed; if it is no longer `admin` the panel closes. A failed *background* re-check keeps a verified admin signed in (the database still enforces permissions); a failed *first* check denies access and offers "Try again".
- **Logout:** ends the Supabase session, clears cached admin data, returns to `/login`. Back does not reveal admin content.
- **Redirects:** an unauthenticated visit to any `/admin/...` goes to `/login` and returns to the same path afterwards. Only same-site `/admin` paths are honoured (no open redirect). A signed-in non-admin sees a "no access" screen with Sign out (no redirect loop).

### Security boundary

**Hiding admin pages in React is not authorisation.** Everything privileged is still enforced by PostgreSQL: RLS, column grants and the admin functions (`docs/supabase/security.md`). A visitor who bypasses this UI still cannot read
or change protected data. This code never disables RLS, never calls an admin function anonymously, and never contains a service-role key (a test fails if one appears).
Remaining client-side risk: the session token sits in `localStorage`, so an XSS bug on the site could steal it; keep dependencies current and add a Content-Security-Policy at the host.

## Environment variables (public, build-time)

| Variable | Value | Notes |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` | Dashboard, Project Settings, API |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | the **publishable** key (`sb_publishable_…`), or the legacy `anon` key | Dashboard, Project Settings, API Keys |

Both are **compiled into the site and visible to every visitor**, so they must never be secrets. **Never** put a service-role or secret key, database password or any other privileged value in a `VITE_` variable;
the app refuses to start Auth with such a key.

- **Local:** copy `.env.example` to `.env.local` (git-ignored) and fill in the two values. Restart `npm run dev` after changing them.
- **Hosting provider:** add the same two variables in its project/environment settings **before building** (Vite inlines them at build time) and redeploy after any change.
- Without valid values the admin area stays closed with an explanation, and the public site keeps working.

## Supabase settings that must match your domain

The public site and the admin share one domain; the admin is at `/admin`. Domain unknown yet, so use placeholders:

1. Dashboard, Authentication, **URL Configuration**: **Site URL** = `https://YOUR_DOMAIN`. Redirect URLs: add `https://YOUR_DOMAIN` (and `http://localhost:5173` for local development only). Avoid wildcards in production.
   Password sign-in does not use redirects, but these settings still gate every Auth email and future flows, so keep them accurate.
2. Keep sign-ups and anonymous sign-ins **off** (see `admin-provisioning.md`).
3. Do **not** run `supabase config push`; change hosted settings in the Dashboard.

## Single-page-app hosting (direct links and refresh on `/admin`)

Every path must serve `index.html`. Ready-made rules are included: `public/_redirects` (Netlify, Cloudflare Pages) and `vercel.json` (Vercel). Other hosts: an equivalent catch-all rewrite, for example nginx
`try_files $uri /index.html;`. `npm run dev` and `npm run preview` already do this. Also recommended at the host: HTTPS only, `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `Cache-Control: no-store` for HTML.

## Open the hosted admin panel

After deploying with the two variables set and the administrator provisioned: open `https://YOUR_DOMAIN/admin`. You are sent to the login screen; sign in with the administrator's email and password.

# Phase 3: Supabase integration

Every module now has a Supabase repository (`src/services/supabase/`) next to the in-memory demo repository
(`src/services/mock/`). Both implement the same interfaces (`src/services/types.ts`); the UI does not know which one runs.

## Runtime modes

`src/services/runtime.ts` decides once, at start-up:

| `VITE_DATA_SOURCE` | Build | Supabase settings | Result |
| --- | --- | --- | --- |
| `supabase` | any | valid | live data |
| `supabase` | any | missing/invalid | live mode; every request fails with `not_configured` and a banner explains the site cannot reach its database. **Never demo data.** |
| `mock` | any | any | demo data, labelled "Demo mode" on every page |
| unset | production | any | live (fail closed) |
| unset | development / tests | valid | live |
| unset | development / tests | missing | demo data (so `npm run dev` and `npm test` work without credentials) |
| anything else | any | any | live (an unknown value is treated as a mistake) |

Settings are checked by `src/lib/supabaseConfig.ts`: HTTPS (http only for localhost), a **bare project URL** (a path such
as `/rest/v1` is refused), and a publishable/anon key (a secret or service-role key is refused).

## What changed for users

- **Tracking:** the Job Status page asks for the order number **and** the tracking code. The code is never read from or
  written to the URL, browser storage, the query cache or logs. Old `?ref=` links prefill the order number only.
- **Orders (admin):** "New order" creates an order through `admin_create_order` and shows the generated tracking code
  once. The order page can issue a new code (`admin_rotate_tracking_code`); the old one stops working.
- **Students (admin):** a review filter and badges (pending / approved / rejected), Approve / Reject / Back to pending on
  the student page (`admin_review_student`), the photo shown through a 5-minute signed link, and **Export CSV** (explicit
  columns, formula-injection protection, capped at 5,000 rows).
- **Public submission:** the photo is uploaded to the private `student-photos` bucket under `submissions/<uuid>.jpg|png`,
  then `submit_student` checks it exists, has the allowed type and size and is unused. Submissions are always pending.
- **Public file upload:** the spreadsheet goes to the private `school-uploads` bucket under `incoming/<uuid>.<ext>`; then
  `submit_file_upload` checks the object and creates the record. Progress is reported in coarse steps (supabase-js has no
  byte progress).
- **Files (admin):** stored files have a Download button that creates a 60-second signed link on click.
- **Dashboard:** each widget loads (and fails) on its own; new cards for submissions to review and feedback to moderate.

## Deployment (Netlify)

Set in Netlify → Site configuration → Environment variables (Builds scope):

- `VITE_SUPABASE_URL` = `https://<project-ref>.supabase.co` (no path)
- `VITE_SUPABASE_PUBLISHABLE_KEY` = the publishable (or legacy anon) key
- optional `VITE_DATA_SOURCE=supabase` (the default for production builds anyway)

Never add a service-role/secret key, database password or connection string. `public/_redirects` already sends every
path to `index.html`. Migration 13 must be applied to the project **before** the new build is published: without it,
public uploads, photo submissions and every admin list/dashboard count fail (they need `admin_summary`,
`submit_file_upload` and the upload policies).

## Known limitations

- Anonymous visitors can upload objects that are never registered (within bucket size/type limits). Rate limiting or bot
  protection in front of the API is still needed (see security.md).
- Services and advertisements admin lists read the whole table (capped at 500 rows) and filter in the browser; the
  other admin lists filter and paginate in the database.
- The admin summary is one RPC; every admin list calls it for its overall counts.
- Storage metadata (size, MIME type) is read from `storage.objects.metadata` by the database functions. This matches the
  hosted Storage behaviour as documented, but it has **not** been verified against the hosted project yet.

## Must be confirmed on the hosted project after applying migration 13

The emulator runs migrations as a superuser, so two Supabase-specific behaviours are not proven locally:

1. **Insert-only uploads work without a SELECT policy.** Upload a photo from the public form (Storage `upsert: false`
   needs INSERT only). Expected: the upload succeeds. Also confirm an anonymous `list`/`download` of the same object fails.
2. **The SECURITY DEFINER functions can see `storage.objects` rows.** `submit_student` / `submit_file_upload` read the
   object's metadata as the function owner. If the owner were subject to the storage RLS policies, every submission with a
   photo would fail with `photo_not_uploaded` (fail closed, not a leak). Expected: a real upload registers successfully.

Both functions fail closed when Storage has not recorded the object's size and type.

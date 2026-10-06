# School submission links

Each school has a public student-submission page at:

```
/school/:schoolSlug        e.g.  https://<your-domain>/school/st-marys-school
```

Admins create and copy these links under **Admin → Schools**. Links are built from the *current origin*
(`window.location.origin` + `/school/<slug>`), so nothing is hard-coded to a domain.

## What the link is, and is not

- The slug is an **identifier, not a security mechanism.** Anyone who has the link can open the form.
  It is **not** a private, password-protected or authenticated portal, and the UI says so.
- The UI hides the school dropdown and attaches the resolved school's ID to the submission, but the browser
  can never be trusted to do that correctly.

## Requirements for the real backend (Supabase or otherwise)

The prototype's mock repository (`src/services/mock/students.ts`) re-checks the school on every submission.
The production implementation must do the same, independently of the UI:

1. **Validate the school server-side.** Reject submissions whose `school_id` does not exist or is not active.
2. **Enforce it in the database**, not only in application code:
   - `students.school_id` NOT NULL with a foreign key to `schools(id)`.
   - Unique constraints on `schools.slug` and `schools.code` (case-insensitive, e.g. unique index on `lower(...)`).
   - Row-level security so anonymous users can only *insert* students for active schools and cannot read other
     students, and so only authenticated admins can read/modify schools and student records.
3. **Never expose inactive school details publicly.** `resolveBySlug` returns only `{ status: 'inactive' }`
   for a deactivated school; keep that behaviour.
4. Consider rate limiting / CAPTCHA on the public submission endpoint, because the link is public by design.

## Hosting: SPA fallback for direct navigation

This is a single-page app using client-side routing (React Router). Opening `/school/st-marys-school` directly
(from a shared link, a bookmark or a refresh) makes the browser request that path from the server. The host
must therefore serve `index.html` for any path that is not a real file, otherwise visitors get a 404.

`vite dev` and `vite preview` already do this. Production hosting needs one of:

**Netlify** — `public/_redirects`
```
/*    /index.html   200
```

**Vercel** — `vercel.json`
```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

**Nginx**
```nginx
location / { try_files $uri /index.html; }
```

**Apache** — `.htaccess`
```apache
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ /index.html [L]
```

**Firebase Hosting / Cloudflare Pages / GitHub Pages**: use the platform's SPA rewrite
(`"rewrites": [{"source":"**","destination":"/index.html"}]`, the default for Pages, or a `404.html` copy of
`index.html` on GitHub Pages).

No rewrite file is committed yet because the hosting provider has not been chosen.

## Changing a slug

Changing a school's slug breaks links that were already shared. The admin form asks for confirmation before
saving a changed slug. Slugs are unique (case-insensitive); the form suggests the next free one
(`name`, `name-2`, `name-3`, …) if a duplicate is entered.

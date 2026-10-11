# School data file submissions

Public page: **/file-upload** ("Submit School Data File"). Administrator: **/admin/files** (list, filters, review dialog).
Migration: `supabase/migrations/20261013090001_school_file_submissions.sql` (**not applied to any hosted project yet**).

## Form fields

| Field | Rule (browser, repository and database) | Stored as |
| --- | --- | --- |
| School name | an active school from `list_active_schools` | `uploaded_files.school_id` (FK) |
| Contact person | 2-80 characters after trimming, no `<` `>` | `contact_person` |
| Contact details | an email, or a 10-digit Indian mobile (spaces, hyphens, +91 / 0 prefix removed) | `contact_details` (normalised: digits, or lower-cased email) |
| File category | `student_data`, `design_materials`, `data_corrections`, `other` | `category` (enum `file_category`) |
| File description | 20-1000 characters after trimming | `description` |
| File | `.xlsx` / `.xls` / `.csv`, 1 byte to 10 MB (= the `school-uploads` bucket limit), first bytes must match the format | private object `school-uploads/incoming/<uuid>.<ext>` |
| Additional instructions | optional, up to 1000 characters; blank is stored as null | `instructions` |

Every submission is stored as `review_status = 'pending'`. `submit_school_file` has no parameter for the review state,
reviewer, notes or bucket, so a public caller cannot choose them.

## Workflow

1. The browser validates every field and the file (extension, size, the browser's MIME type may only reject, and the
   first bytes must match the format). Nothing is uploaded until the whole form is valid.
2. The repository re-validates, and checks the school is active before uploading.
3. The file is uploaded with `upsert: false` under a random UUID name into the insert-only folder (migration 13 policy).
4. `submit_school_file` re-checks the school and every field, verifies the stored object (path, extension matching the
   original name, existence, size and type recorded by Storage; fail closed when missing), and inserts the record.
5. Success is shown only after step 4 succeeded. The form is cleared by unmounting it.

**Failure after upload.** Anonymous visitors cannot delete objects, and that permission is deliberately not added. A retry
with the same file in the same page re-registers the object already uploaded instead of uploading a second copy. Objects
that are never registered are counted for the administrator in `admin_summary().storage.unregisteredUploads` (older than one
hour). **Deleting them needs a server-side job with the service role (or manual deletion in the Dashboard); this is not
implemented.**

## Review

`admin_review_file(file_id, status, notes)` (administrator only, re-checks `is_admin()`): sets `pending`, `approved`,
`rejected` or `corrections_required`, replaces the notes, records `reviewed_at` and `reviewed_by` (cleared when returning to
pending), and appends to `uploaded_file_reviews`. `uploaded_files` stays read-only for every client role.

The review dialog shows the full submission, contact details, file metadata, history and notes; Approve / Request
corrections / Reject ask for confirmation. Downloads use a 60-second signed link served as an attachment.

## Untrusted files

Extension, MIME type and first-byte checks catch mistakes and renamed files; they do **not** prove a spreadsheet is safe.
Nothing on the server opens or evaluates the files. The download panel tells the administrator to use Protected View, not
enable macros or external content, and be careful with formulas.

## Applying the migration (after review)

```
npx supabase migration list --linked      # read-only: confirm 1-13 are applied and 14 is pending
npx supabase db push --linked --dry-run    # shows what would be applied
npx supabase db push --linked              # applies pending migrations (13 too, if it is still pending)
```

Deploy the new frontend only after the migration is applied: the public form calls `submit_school_file`, and the admin file
list selects the new columns. Then update `01_preflight_read_only.sql` checks (already lists 14 versions) and re-run
`supabase/verification/verify-public-api.mjs`.

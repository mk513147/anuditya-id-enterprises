# Excel exports, students-with-photos export, and school images

## Excel export (Students page → "Export Excel")

Replaces the former CSV export (the only data export in the app). A real `.xlsx` workbook (ExcelJS, loaded only when an
export runs): worksheet "Students", bold frozen header row with filters, column widths, dates as Excel dates
(`yyyy-mm-dd`), the submission time in India time (`yyyy-mm-dd hh:mm`), identifiers and phone numbers as Text so Excel
keeps leading zeros. The columns are exactly the former CSV columns (`src/features/students/admin/studentExport.ts`); no
internal ids, photo links or storage paths. File name `anuditya-students_<date>.xlsx`. It covers every student matching
the current filters (all pages), capped at 5,000 rows.

**Formula injection:** every value is written as a literal text/number/date cell; no formula is ever produced, so
`=HYPERLINK(...)` typed into a public form stays plain text (tests check the workbook XML has no `<f>` element).

## Students with photos (Students page → "Export with photos")

A ZIP `students_export_<date>.zip` with `students.xlsx` (the student columns plus "Photo file" and "Photo status"),
`student_photos/` and `README.txt`. It covers the students matching the current filters, as the dialog states.

- Photos are downloaded with the administrator's own session through the existing administrator read policy on the
  private `student-photos` bucket; no signed URL is created and no storage path leaves the data layer.
- Each photo is requested for one student id and named `<Reference No>_<first 8 hex of the student id>.<jpg|png>`
  (sanitised); its real format is read from its bytes. Students without a photo, or whose download fails, stay in the
  workbook, marked "No photo on record" / "Download failed".
- Limits for a browser-side export: at most **500 students** and **400 MB** of photos, **4** downloads at a time. Larger
  exports are refused with a message; they would need a server-side export job (not implemented).
- The archive is built in memory, handed to the browser's download, and the object URL is revoked immediately. Nothing
  is stored, cached persistently, logged or uploaded.

## School images (School page → "School images")

Migration `20261014090001_school_images.sql` (**not applied to any hosted project yet**).

- Bucket `school-images`: private, JPEG / PNG / WebP, 5 MB. SVG is not accepted anywhere.
- Upload path `schools/<school id>/<random uuid>.<ext>`, `upsert: false` (never overwrites). Only the administrator may
  upload (storage policy), read (signed preview links, 5 minutes), or delete — and delete only objects that no record uses.
- `admin_register_school_image` re-checks the administrator and the school, the path, the type and size Storage recorded
  (fail closed), and refuses the same image twice for a school (SHA-256 computed in the browser). The first image becomes
  the primary image; later ones never replace it. `admin_set_primary_school_image` moves the primary flag.
- Browser checks before upload: extension, declared type, size, at most 20 per batch, file signature, and a real decode
  (corrupted files are refused).
- Each file has its own outcome (uploaded / failed / not accepted / already added); "Retry" re-sends only failed files.
- Storage and PostgreSQL are not one transaction: if registration fails after the upload, the client removes the object it
  just uploaded (allowed by the orphan-only delete policy). If that removal also fails (for example the network dropped),
  the object stays unregistered and invisible to everyone but the administrator; a cleanup job is not implemented.
- No public page shows school images yet; they are administrator-only. Showing them publicly would need a deliberate
  design (for example a separate public bucket for selected images), not a change to this private bucket.

## Applying the migration (after review)

```
npx supabase migration list --linked
npx supabase db push --linked --dry-run
npx supabase db push --linked
```

# Student management (admin)

Routes: `/admin/students` (list) and `/admin/students/:studentId` (record). All data comes from the in-memory mock
database (`src/services/mock/db.ts`) through the `StudentRepository` contract (`src/services/types.ts`).
Nothing is persisted: a page refresh resets the prototype, and nothing is written to `localStorage`.

## Behaviour and decisions

**Archive, not delete.** The existing model had no active/archived concept, so students gained
`isArchived` / `archivedAt` / `updatedAt`. There is intentionally **no permanent delete**.
- Archived students leave the default (Active) list but keep their record, reference number and school.
- They are found with **Status → Archived** (or **All students**) and can be **restored** at any time.
- Archiving never touches orders, the school, or other students.
- Reference numbers are generated from the total row count (archived included), so a number is never reused.
- Dashboard "Total students" and a school's student count count **active** students only.

**School relationship.** Students reference schools by `schoolId` only; the list joins the school's name/code/status
by ID. Students of an **inactive** school stay fully visible and are flagged ("inactive school"). If a school record
were ever missing, the UI shows "Unknown school" instead of failing.

**Editing.** Editable: name, parents, DOB, class, section, roll no., admission no., address, mobile and the five
optional fields (blood group, house name/colour, bus route/stoppage). **Not editable here:** reference number,
school (no confirmed school-transfer workflow exists), photo, id and submission time. The repository ignores those
keys even if a caller sends them. The edit form reuses the public form's field components and Zod rules
(`StudentCoreFields`, `studentEditSchema`) and the same normalisation (`toStudentFields`). An update is applied in
one step, so a failed save never leaves a half-edited record, and the dialog keeps what the admin typed.

**Admission-number rule (assumption).** No uniqueness rule existed anywhere. Assumed domain rule: an admission
number identifies a student *within a school*. It is enforced only when an admin **changes** the number, and only
against **non-archived** students of the **same school** (`duplicate_admission_no`). It is deliberately *not*
enforced on public submissions (parents may resubmit corrections, and rejecting them would change the public flow
with no way for them to fix it), so duplicates can already exist; an unchanged number is never re-checked, so those
records stay editable. **Needs client confirmation.** If they want strict uniqueness, enforce it at submission too.

**Orders.** `Order` references a school (`schoolId`), not students. The detail page therefore shows *"Orders for
<school>"* with a note saying so, rather than inventing a per-student link. When Order Management links students
(e.g. an order-items table), archiving must stay a soft flag so those references never dangle.

**Photos.** The public form's photo is kept as a browser object URL for the session so the detail page can show it.
It disappears on refresh (like all prototype data). Seeded students have no photo; the UI shows "No photo on file".
Photo replacement is not part of this phase.

**Filters, search and pagination.** Search matches name, reference, admission no. and roll no. (case-insensitive,
partial). Filters: school, class, section, status, and an inclusive submission-date range (compared on the *local*
calendar date). All state, including the page, lives in the URL query string, so views can be bookmarked and Back from
a record returns to the same list. Page size is 10, newest submission first.

## Production notes (Supabase, later)

Constraints and authorisation must be enforced by the database, not the UI:
- `students.school_id uuid NOT NULL REFERENCES schools(id)` (no cascade delete); keep `ON DELETE RESTRICT`.
- Soft archive: `archived_at timestamptz NULL` (replace `isArchived`); default queries filter `archived_at IS NULL`.
- Reference number from a sequence/trigger or `generated` column, unique, never reused.
- If admission numbers must be unique per school: a partial unique index
  `UNIQUE (school_id, lower(admission_no)) WHERE archived_at IS NULL` (decide first whether this also applies to the
  public submission endpoint).
- Row-level security: anonymous users may only `INSERT` students for **active** schools and cannot `SELECT`;
  only authenticated admins can `SELECT/UPDATE` students. Archive/restore and edits are admin-only.
- Put the editable-field whitelist in the API/RPC (or column-level grants) so `reference_no` and `school_id` cannot be
  changed by a client, mirroring what the mock repository does.
- Photos in Supabase Storage with a private bucket and signed URLs; store only the path in `photo_path`.
- Add `updated_at` via trigger and, ideally, an audit log for edits/archives.
- Search at scale: use a trigram/`ilike` index on name, reference, admission and roll columns; paginate server-side.

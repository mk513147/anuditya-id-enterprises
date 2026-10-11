# Admin advertisements and feedback moderation

Routes: `/admin/advertisements` and `/admin/feedback`. Details, previews and forms open in dialogs.

## One store, no copies

Admin and the public pages use the same repositories (`advertisementRepository`, `feedbackRepository`) and the
same in-memory tables (`db.advertisements`, `db.feedback`). Every admin write invalidates the TanStack Query keys
the public pages read (`['advertisements', 'public']`, `['feedback', 'approved']`), so Home, `/advertisement`
and `/feedback` show a change without a reload. Data is in memory only and resets when the page is reloaded.

## Advertisements

- Three separate ideas: **published** (`isPublished`, otherwise a draft), **enabled** (`active`) and the
  **schedule** (`startsAt` / `endsAt`). An ad is public only when all three agree (`isAdvertisementVisible`).
  The admin list shows each one and a derived public status: live, scheduled, ended or hidden.
- Dates are picked as India calendar days: a start day begins at 00:00 IST, an end day lasts until 23:59:59 IST.
- `update` changes only the fields it is given and validates the merged result. Rules live in
  `validations/advertisement.ts` and run in both the form and the repository.
- Images are links (http/https only). Nothing is uploaded; without a link a branded placeholder shows.
- No permanent delete: unpublish or disable instead.
- Home shows the featured ad plus the first three others, so a fifth public ad does not appear on Home until a
  slot frees up. `/advertisement` shows all of them.

## Feedback

- New submissions are always `pending`. Only `approved` feedback is public.
- An admin can set any status from any other (approve, reject, return to pending). Moving to the same status
  is rejected with `no_change`. The model has no moderation timestamp, so none is shown.
- No contact details are collected, so none are shown.

## Errors

`RepositoryError` codes used: `invalid_id`, `not_found`, `invalid_input` (with per-field `fieldErrors`),
`invalid_filter`, `invalid_status`, `no_change`.

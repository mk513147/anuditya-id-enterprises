# Admin services management

Route: `/admin/services`. Forms, previews and confirmations open in dialogs.

## One store

The public Home section, `/services` and the quote dialog's service list all read `serviceRepository.listPublic()`.
Admin uses the same repository, backed by `db.services` in `src/services/mock/db.ts` (seeded from `data/services.ts`).
Admin writes invalidate the `['services']` query keys, which include the public query, so changes show without a
reload. Data is in memory only and resets when the page is reloaded.

## Model

Editable: name (`title`), short label (`tagline`), category, description, image link, icon, enabled.
Assigned by the data layer: `id`, `slug` (from the name, unique, kept when renaming) and `order` (new services go last).
There is no separate enquiry-topic field: quotes and WhatsApp messages already use the service name, so names must be unique.

## Rules

- Validation lives in `validations/service.ts` and runs in both the form and the repository.
- Images are links only (http/https). Nothing is uploaded; unsafe schemes such as `javascript:` are rejected.
- No permanent delete. Disabling hides a service from Home, `/services` and the quote form.
- Errors: `invalid_id`, `not_found`, `invalid_input` (with per-field messages), `duplicate_title`, `invalid_filter`, `no_change`.
- Saving is guarded by `useSingleFlight`, so rapid repeated clicks store one change.

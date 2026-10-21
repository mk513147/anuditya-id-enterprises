# Supabase integration

**Status:** migrations 1-12 were reviewed for the hosted development project; migration 13 (Phase 3) is **new and has not
been applied anywhere**. The app now has Supabase repository adapters for every module (Phase 3, see
[phase3-integration.md](phase3-integration.md)); which data source runs is chosen at start-up (`src/services/runtime.ts`).

Contents: this file (plan, migrations, mapping) · [phase3-integration.md](phase3-integration.md) (runtime modes, deployment) · [security.md](security.md) · [testing.md](testing.md) ·
[decisions.md](decisions.md) (assumptions and open business rules).
Authentication and the administrator account: [authentication.md](authentication.md) (frontend login, environment, hosting) and
[admin-provisioning.md](admin-provisioning.md) (how the single administrator is created and recovered). The manual SQL for provisioning is in `supabase/provisioning/`.

## Implementation plan

| Phase | Scope | State |
| --- | --- | --- |
| **A (this change)** | SQL migrations, RLS, public functions, private buckets, DB tests, docs. | Drafted, tested locally in an emulator (see testing.md). Not applied. |
| B | Real login and route guard for the single administrator. | Done (see authentication.md) |
| 3 | `supabase` repository adapters for every module, insert-only public uploads, admin summary RPC, tracking-code UX, student review, CSV export. | Implemented and tested locally; migration 13 not applied. |
| C | Data/seed strategy for real data, bot protection / rate limiting, end-to-end tests against a hosted project, production rollout. | Not started |

## Migrations (apply in this order; each depends on the ones before)

| # | File | Contents |
| --- | --- | --- |
| 1 | `20261011150001_foundation.sql` | `extensions`/`private` schemas, enums, default-deny privileges, `updated_at` trigger, reference sequences. |
| 2 | `20261011150002_profiles_admin.sql` | `profiles`, the single-administrator unique index, write guards, `private.is_admin()`, `private.provision_administrator()`. |
| 3 | `20261011150003_schools.sql` | `schools`. |
| 4 | `20261011150004_students.sql` | `students` (+ approval workflow, reference trigger, immutability, admission-number rule). |
| 5 | `20261011150005_orders.sql` | `orders` (+ tracking hash), `order_status_history`, status-history and school-rename triggers. |
| 6 | `20261011150006_uploaded_files.sql` | `uploaded_files` (metadata only, honest `storage_state`). |
| 7 | `20261011150007_services_advertisements_feedback.sql` | `services`, `advertisements`, `feedback`. |
| 8 | `20261011150008_rls_policies_and_grants.sql` | Column-level grants and admin-only RLS policies. No DELETE anywhere. |
| 9 | `20261011150009_public_read_functions.sql` | Five public read functions. |
| 10 | `20261011150010_write_and_tracking_functions.sql` | `submit_student`, `submit_feedback`, `track_order`, four `admin_*` functions. |
| 11 | `20261011150011_private_storage.sql` | Private buckets and the one admin-only read policy. |
| 12 | `20261011160001_restrict_private_schema_usage.sql` | Forward-only hardening: `anon`/`authenticated` lose USAGE on `private` (they keep EXECUTE on `private.is_admin()` for RLS). |
| 15 | `20261014090001_school_images.sql` | Private `school-images` bucket (JPEG/PNG/WebP, 5 MB), `school_images` table (one primary image per school, checksum de-duplication), administrator-only upload/read and orphan-only delete policies, `admin_register_school_image`, `admin_set_primary_school_image`. See [exports-and-school-images.md](exports-and-school-images.md). |
| 14 | `20261013090001_school_file_submissions.sql` | School data file submissions: submission details and review state on `uploaded_files`, `uploaded_file_reviews` history, `submit_school_file` (public, always pending; replaces `submit_file_upload` for client roles), `admin_review_file`, file review counts and an orphaned-upload count in `admin_summary`. See [school-file-submissions.md](school-file-submissions.md). |
| 16 | `20261015090001_public_school_image_submissions.sql` | Public school-image submissions: review state, source and submitter details on `school_images`; an insert-only policy for content-named objects under `submissions/<school>/<sha256>.<ext>` in `school-images`; `school_image_already_present` and `submit_school_image` (public, always pending, never primary); `admin_review_school_image`; `admin_set_primary_school_image` now requires an approved image. See [exports-and-school-images.md](exports-and-school-images.md). Not applied. |
| 13 | `20261012090001_phase3_public_uploads_and_admin_summary.sql` | Insert-only upload policies (fixed folder, random name, allowed extension) for the two private buckets; `submit_student` validates the uploaded photo; `submit_file_upload`; `admin_summary()` (counts only, admin only). |

`supabase/seed.sql` is a **local-only** development seed (12 services and 5 fictional demo schools; no students,
orders, files, feedback or secrets). `supabase/config.toml` was changed locally to disable signup and require
12-character passwords. That file is **not** pushed anywhere by anything in this repo (see security.md).

## Entity mapping (existing code → table)

Every column below exists in `src/types/index.ts` unless marked **new**. `ID` becomes `uuid`; camelCase becomes snake_case.

| Entity (TypeScript) | Table | Notes |
| --- | --- | --- |
| *(none: no users in the app)* | `profiles` | **new** (business requirement): id → `auth.users`, `role` (`admin` only), timestamps. At most one admin row. |
| `School` | `schools` | All fields kept. `code` stored upper-case, `slug` lower-case, both unique case-insensitively. |
| `Student` | `students` | All fields kept. `isArchived`/`archivedAt` → `archived_at`. `photoUrl` → `photo_path` (a private-bucket path, never a URL). **New:** `approval_status`, `reviewed_at` (business requirement). |
| `Order` | `orders` | All fields kept (`notes` → `internal_notes`). **New:** `tracking_secret_hash` (business requirement). `schoolId` stays optional. `customer` → `customer_name`. |
| `Order.statusHistory` | `order_status_history` | `{status, at}` → `status`, `changed_at`, plus the order id. |
| `UploadedFile` | `uploaded_files` | All fields kept. **New:** `storage_bucket`, `storage_state` (so a record never claims contents exist). |
| `Service` | `services` | All fields kept (`order` → `display_order`, `image` → `image_url`). |
| `Advertisement` | `advertisements` | All fields kept (`isPublished` → `is_published`, `whatsappMessage` → `whatsapp_message`). |
| `Feedback` | `feedback` | All fields kept. **Added:** `updated_at` only. No moderator or moderation time was invented. |

Not mapped, because the code has no such concept: quote requests (the quote form only builds a WhatsApp message),
cancelled orders, enrolments or student roles.

## Repository method mapping

| Repository method | Database operation | Direct table access? |
| --- | --- | --- |
| `SchoolRepository.listActive()` | `rpc list_active_schools()` | no |
| `SchoolRepository.resolveBySlug()` | `rpc resolve_school(slug)` | no |
| `SchoolRepository.list/getDetail/create/update/setActive` | admin `select`/`insert`/`update` on `schools` (+ counts via a future admin RPC) | yes, admin only |
| `ServiceRepository.listPublic()` | `rpc list_enabled_services()` | no |
| `ServiceRepository.list/getDetail/create/update/setEnabled` | admin `select`/`insert`/`update` on `services` | yes, admin only |
| `AdvertisementRepository.listPublic()` | `rpc list_published_advertisements()` | no |
| `AdvertisementRepository.list/getDetail/create/update/setActive/setPublished` | admin `select`/`insert`/`update` on `advertisements` | yes, admin only |
| `FeedbackRepository.listApproved()` | `rpc list_approved_feedback(limit)` | no |
| `FeedbackRepository.submit()` | `rpc submit_feedback(...)` | no |
| `FeedbackRepository.list/getDetail/setStatus` | admin `select` / `update (status)` on `feedback` | yes, admin only |
| `StudentRepository.submit()` | `rpc submit_student(...)` (always pending) | no |
| `StudentRepository.list/getDetail/update/setArchived/getFilterOptions` | admin `select` / column-limited `update` on `students` | yes, admin only |
| *(new)* approve or reject a submission | `rpc admin_review_student(id, decision)` | no |
| `OrderRepository.findByReference()` → **changes to `(orderNo, trackingCode)`** | `rpc track_order(order_no, code)` | no |
| `OrderRepository.list/getDetail` | admin `select` (listing columns explicitly) on `orders`, `order_status_history` | yes, admin only |
| `OrderRepository.updateStatus()` | `rpc admin_set_order_status(id, status)` | no |
| *(new)* create an order and issue its code | `rpc admin_create_order(...)` | no |
| *(new)* replace a lost tracking code | `rpc admin_rotate_tracking_code(id)` | no |
| `FileRepository.upload()` | insert-only upload to `school-uploads/incoming/<uuid>.<ext>`, then `rpc submit_file_upload(path, name)` | no |
| `FileRepository.list/getDetail` | admin `select` on `uploaded_files` | yes, admin only |
| `FileRepository.getDownloadUrl()` | admin signed URL (60 s) on `school-uploads` | storage, admin only |
| `DashboardRepository.getCounts/getRecentSchools` | `rpc admin_summary()` | no |
| `DashboardRepository.getRecentOrders` | admin `select` on `orders` (explicit columns) | yes, admin only |

Phase 3 made the two planned interface changes: `OrderRepository.track(orderNo, trackingCode)` replaced
`findByReference`, and `StudentRepository` gained `review`, an approval filter/counts and `exportRows`.

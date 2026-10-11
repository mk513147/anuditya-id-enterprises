# Assumptions and unresolved business rules

Each item says what the draft does **today** so the behaviour is explicit, not accidental. None of these has been
confirmed by the business unless stated. Change the named migration/test together if a decision differs.

## Confirmed requirements (from the brief)

- One administrator, no public signup, no staff roles. *(migration 2; config.toml)*
- Order tracking needs the order number plus a separate high-entropy secret. *(migrations 5, 10)*
- Student submissions are saved as pending until approved. *(migrations 4, 10)*
- Spreadsheet downloads only for the authenticated administrator; student data stays private. *(migrations 8, 11)*

## Open decisions and the assumption taken

| ID | Question | Assumption in this draft | Where |
| --- | --- | --- | --- |
| **D-ADM** | Must an admission number be unique within a school? When? | Same as today's mock: **not** enforced on public submission (parents may resubmit corrections); enforced **only when an administrator changes it**, against other non-archived, non-rejected students of the same school (case-insensitive). Existing duplicates stay editable. A stricter rule would be a partial unique index on `(school_id, lower(admission_no)) where archived_at is null and approval_status <> 'rejected'`, but it would also reject legitimate resubmissions. | migration 4; test 03 |
| **D-REF** | Reference-number format and reset | `ANU-YYYY-NNNNN`, `FILE-YYYY-NNNNN`, `JOB-YYYY-NNNN`; one global sequence per kind that **never resets** (today's mock counts rows and never resets); the year is the IST year of creation. Gaps are possible after a failed insert. Per-year restart would need a different design. | migrations 1, 4, 5, 6 |
| **D-REJ** | What happens to a rejected student submission? | Kept, never deleted; the decision is reversible (rejected ↔ approved ↔ pending); no reason or note is stored (none was specified); a rejected record does not block an admission number. No automatic purge. Parents are not notified (no mechanism exists). | migration 10; test 03 |
| **D-RET** | Retention of spreadsheets and photos | **Nothing is deletable by any client role** and no purge job exists. How long files and rejected/archived student records may be kept (and how a deletion request is honoured) needs a decision, including legal advice for data about minors. | migration 11; test 05 |
| **D-PEND** | Do pending students count as "students"? | The tables hold them but the admin "active" view and dashboard counts should use `approval_status = 'approved' and archived_at is null`. Existing seeded/mock students are treated as already approved when data is migrated. This changes the admin UI in Phase B. | Phase B |
| **D-ORD-SCHOOL** | May an order exist without a school? Is `service` free text? | Yes and yes, because the current model allows both. `customer_name` is kept in sync with the school's name on rename (like the mock). A link to Services or a mandatory school would be a model change. | migration 5 |
| **D-HIST** | Is the initial status logged, and are old orders backfilled? | Only **changes** are logged (like the mock; the order date stands for "placed"). Orders imported from elsewhere have no history. | migration 5 |
| **D-TRACK** | How is the secret given to the customer? Is the customer name/quantity public? | The administrator gives the one-time code to the customer by the shop's usual channel (slip or WhatsApp). The tracking result keeps today's whitelist (including customer name and quantity); remove them if they should not be shown even with the code. Orders without a code are untrackable. | migration 10; security.md |
| **D-ORDCREATE** | Who creates orders? | The code has **no create-order path** today (orders are seed data only). `admin_create_order` is provided so a code can be issued, but an admin screen for it does not exist and was not built. | migration 10 |
| **D-IMG** | `http` or only `https` image links? | `http` and `https`, like today's rule. Recommend `https` only before launch. Images are links; there is no image upload. | migration 7 |
| **D-CAT** | Are service categories a fixed list? | A fixed enum of the three existing categories. An editable list would need a table. | migration 1 |
| **D-FEED** | Moderator/time for feedback decisions? | None stored (not in the current model, and there is one admin). Add `moderated_at` if wanted. | migration 7 |
| **D-NAME** | Name character rules | The database blocks digits and `<`/`>` and requires a letter; the app's stricter Unicode rule stays in zod. | migration 4 |
| **D-QUOTE** | Store quote requests as leads? | Not stored (the code does not store them). | none |
| **D-DOB** | Date-of-birth floor | 1980-01-01 up to today (copied from the form), compared with the server's date. | migration 4 |
| **D-DATES** | Time zone for date filters | Advertisement windows are stored as instants (IST day boundaries). The student/file date filters will need to compare in IST in the adapter; today they use the browser's local date. | Phase B |
| **D-SCHOOLLINK** | Should the school link carry a secret? | No (the slug is documented as not a secret). Spam is controlled by the approval step plus Phase B bot protection. | security.md |

## Not applicable to this codebase

The brief mentions enrolment cancellation when a student's role changes. This application has no enrolments, courses or
student roles (only the Eduyarp platform does), so nothing was modelled. Confirm it is out of scope.

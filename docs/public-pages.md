# Public pages: Job Status, Advertisement, Feedback

All three read and write through repository contracts in `src/services/types.ts`
(`OrderRepository`, `AdvertisementRepository`, `FeedbackRepository`) and the shared in-memory database
(`src/services/mock/db.ts`). Nothing is persisted: a reload resets the prototype, and nothing is written to
`localStorage` / `sessionStorage`. A Supabase implementation replaces the files in `src/services/mock/` and the
wiring in `src/services/index.ts`; the pages do not change.

## Prototype test triggers

| Page | Trigger | Effect |
|---|---|---|
| Job Status | look up `JOB-FAIL` | repository rejects (shows the error state with Try Again) |
| Feedback | submit with the name `FAIL` | repository rejects; nothing is stored; retry with another name works |
| Student form | admission number `FAIL` | (existing) |
| File upload | file name containing `FAIL` | (existing) |

Demo order references (one per stage): `JOB-2026-0007` Order Received, `-0006` Data Verification, `-0005` Designing,
`-0003` Printing, `-0004` Quality Check, `-0008` Ready, `-0009` Dispatched, `-0001` Delivered.

## Job Status (`/job-status`)

- The reference lives in the URL (`?ref=JOB-2026-0003`), so a result can be shared and Back works.
- Input is normalised (`src/lib/orderReference.ts`): trimmed, upper-cased, inner whitespace becomes a hyphen.
  Lookup is an **exact** match on the normalised value. There is no prefix, substring or fuzzy matching, so a partial
  or malformed number can never return another customer's order. Malformed input is rejected by the form and, as a
  second line of defence, by the repository.
- The page receives a `PublicOrder`: order number, school/customer name, service, quantity, status, order date,
  expected delivery. **Internal notes, ids and the school id are never returned** (whitelist projection in
  `mock/orders.ts`).
- Seven stages (`features/orders/timeline.ts`): Received, Data Verification, Designing, Printing, Quality Check,
  Ready, Dispatched / Delivered. `Dispatched` makes the last stage current ("Dispatched"); `Delivered` completes all
  seven ("Delivered") and hides the expected-delivery date.
- **Cancelled orders:** the `Order` model has no cancelled status, so none is shown. If cancellation is added
  later, add it to `ORDER_STATUSES` and render a distinct state in `OrderResult` instead of the timeline.

**Production notes.** Order numbers here are sequential and therefore guessable, so anyone could read other
customers' order status (school name, service, quantity, dates). Before going live, either issue an unguessable
tracking code per order, or require a second factor (for example the last 4 digits of the contact phone), and rate-limit
the endpoint. Expose the lookup through an RPC / edge function that returns only the whitelisted columns; do not grant
anonymous `SELECT` on the orders table.

## Advertisement (`/advertisement`)

- The Home page section and this page use the same hook (`usePublicAdvertisements`) and repository method, so they
  always agree.
- Visibility rule (`isAdvertisementVisible` in `src/lib/advertisements.ts`, applied inside the repository so hidden
  ads never reach the UI): `active` **and** `isPublished` **and** started (`startsAt` absent or past) **and** not
  ended (`endsAt` absent or future). Both edges are inclusive.
- Model additions: `isPublished` (false = draft), optional `startsAt` / `endsAt`. Dates are instants; the seed data
  uses India day boundaries (an end date of "31 Dec" is 31 Dec 23:59:59 IST), so visitors in India read the date the
  admin meant. The admin form should convert a chosen date to that instant.
- A broken or missing image falls back to the branded placeholder (`AdMedia`).
- "View details" opens an accessible dialog; focus returns to the button on close.

## Feedback (`/feedback`)

- Fields: name, optional school/organisation, rating (1 to 5), message (10 to 600 characters). No phone number or
  e-mail is collected.
- New feedback is stored with `status: 'pending'` and is **never public** until an admin approves it. Only
  `approved` items are returned by `listApproved()`; pending and rejected feedback never leave the data layer.
  The same list feeds the Home testimonials and this page.
- The submit button is disabled while sending and a synchronous guard prevents duplicate records from rapid
  clicks. On failure the form keeps every value and shows Try Again; the form is only reset after success.
- The data layer re-validates name, message and rating, so the form is not the only gatekeeper.

**Production notes.** The public submit endpoint will need rate limiting and bot protection (CAPTCHA or a
honeypot), since it accepts text from anyone. Escape or sanitise message text wherever it is rendered outside React.
RLS: anonymous users may `INSERT` with `status = 'pending'` (enforce with a column default and a CHECK / policy
`WITH CHECK (status = 'pending')`) and may `SELECT` only `status = 'approved'` rows.

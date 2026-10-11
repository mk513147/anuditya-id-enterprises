# Admin order management

Routes: `/admin/orders` (list) and `/admin/orders/:orderId` (detail and status update).

## One order store

Admin and the public `/job-status` page both use `orderRepository`, which reads and writes `db.orders`
in `src/services/mock/db.ts`. There is no second order model or collection. A status change made in Admin is
visible to the public lookup of the same reference straight away in the same session.

The data is in memory only. It is not written to `localStorage` or any other storage, and it resets when the
page is reloaded.

## Repository (`OrderRepository`)

| Method | Notes |
| --- | --- |
| `findByReference(ref)` | Unchanged. Public, exact match after normalisation, whitelisted `PublicOrder`. |
| `list(params)` | Search (reference or school name), status, inclusive order-date range, pagination, overall counts. |
| `getDetail(id)` | Rejects `invalid_id` for an empty or non-string id, `not_found` for an unknown one. |
| `updateStatus(id, status)` | Validates id and status. Rejects `invalid_id`, `invalid_status`, `not_found` or `no_change`, and changes nothing on failure. |

`Order` gained two optional fields: `statusHistory` (`{ status, at }[]`, oldest first) and `updatedAt`. Both are
internal and never part of `PublicOrder`. Seeded demo orders have no history; none is invented.

## Status workflow

The eight stored statuses (`Order Received` … `Delivered`) map to the seven public timeline stages
(`Dispatched` and `Delivered` share the last one). An admin chooses the status and confirms it; nothing
advances automatically. Any supported status can be chosen, including an earlier one to correct a mistake. The
confirmation warns about skipped stages and backward moves.

## Limitations

- Cancelled orders are not supported. Adding them would need changes to the types, the public timeline, the
  public page and the repositories together, so it is deliberately out of scope.
- Orders belong to schools, not to individual students. The screens say so.
- Status history only covers changes made since the page loaded.
- There is no authentication yet, so `/admin` is open (prototype).
- Admin search is a substring match. The public lookup stays exact-match only.

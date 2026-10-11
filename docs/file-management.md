# Admin file management

Route: `/admin/files`. Details open in a dialog (no separate route).

## What the prototype stores

The upload flow keeps **metadata only**, in `db.files` (`UploadedFile`): id, reference number (`FILE-YYYY-NNNNN`),
original name, type (`xlsx` / `xls` / `csv`), size in bytes, upload time and an internal `storagePath`. The file
**bytes are discarded**; the upload is a simulated transfer. The public upload page does not ask for a school,
so new uploads have no school. Only the four seeded demo files have one. There is no processing status.

## Admin view

`FileRepository` gained `list` (search by name or reference, school including "none", type, upload-date range,
pagination, overall counts and total size) and `getDetail`. Both return `AdminFile`, which omits `storagePath`.
Ids and filters are validated in the data layer (`invalid_id`, `not_found`, `invalid_filter`).

There is deliberately no download action and no processing-status filter or column, because the data for them
does not exist. The detail dialog says that file contents are unavailable.

Data is in memory and resets when the page is reloaded. Real storage and downloads belong to the Supabase phase.

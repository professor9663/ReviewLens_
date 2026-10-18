# ReviewLens API

All workspace endpoints require a valid Supabase Auth session cookie. APIs return JSON errors shaped as `{ "error": "..." }` unless they return a download. They authenticate with Supabase `getUser()`, validate external input, and use the caller's session client so PostgreSQL RLS applies.

## Datasets and reviews

| Method and path | Purpose |
| --- | --- |
| `GET /api/datasets` | List the signed-in user's datasets. |
| `POST /api/datasets` | Create an empty dataset or set `sample: true` to load synthetic rows. Body: `{name, description?, sample?}`. |
| `POST /api/datasets/import` | Multipart CSV upload. Fields: `file`, `name`, `description`, and optional JSON `mapping`. |
| `GET /api/datasets/{id}` | Read a dataset (storage path is never returned). |
| `PATCH /api/datasets/{id}` | Update `name` and/or `description`. |
| `DELETE /api/datasets/{id}` | Delete dataset, review rows, and original file. Saved summary metadata is retained. |
| `GET /api/datasets/{id}/reviews` | Filtered server-side page. Query: `page`, `pageSize` (1–100), `search`, `sentiment`, `rating`, `product`, `from`, `to`, `sort`, `direction`. |
| `GET /api/datasets/{id}/analytics` | Calculate dashboard metrics, products, keywords, and recent reviews from the selected dataset. |
| `GET /api/datasets/{id}/products` | Calculate product summaries. |
| `POST /api/datasets/{id}/analyze` | Re-score reviews and persist a versioned analysis run. |
| `GET /api/datasets/{id}/original` | Redirect to a 60-second signed URL after ownership authorization. |

Date filters expect `YYYY-MM-DD`. Supported sort columns are date, rating, sentiment, and word count; other values are ignored in favor of date. Search is restricted to letters, numbers, and whitespace before it is added to the PostgREST text filter.

## History, reports, and account

| Method and path | Purpose |
| --- | --- |
| `GET /api/history` | Return the latest 100 analysis runs. |
| `GET /api/history/{id}` | Read one saved run belonging to the caller. |
| `GET /api/reports` | Return the latest 100 report metadata rows. |
| `GET /api/profile` / `PATCH /api/profile` | Read/update the authenticated user's display name. |
| `GET /api/preferences` / `PATCH /api/preferences` | Read/update theme and default format. |
| `GET /api/datasets/{id}/export` | Generate `csv`, `xlsx`, `pdf`, or `json` for `scope=all` or `scope=filtered`. Filter parameters are the same as review listing. |

The JSON format is `reviewlens.export.v1` and contains generation time, scope, dataset identity, summary, and exported review rows. Report metadata is written after generation; generated files are not stored. Formula-like strings are prefixed with an apostrophe in CSV/XLSX data cells.

## Status codes

- `401`: no current authenticated user.
- `404`: invalid ID or a resource not visible to the current user.
- `413`: the export matches more than the supported 10,000-row limit.
- `503`: required Supabase environment variables are missing.
- `429`: the current process has reached a best-effort per-user limit (10 uploads per 10 minutes, 20 analyses per hour, or 60 exports per hour); `Retry-After` gives a wait in seconds.
- `500`: storage/database operation failed. Error responses do not expose credentials or query text.

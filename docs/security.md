# Security and privacy model

## Authentication

Supabase Auth owns password verification, session refresh, email confirmation, and reset links. The browser and server use separate `@supabase/ssr` clients backed by cookies. No application table stores passwords, password copies, reset secrets, or auth tokens. The anon key is public by design and is safe only because table and Storage RLS is enabled.

## Data ownership

Each user-owned row stores an authenticated user UUID. RLS policies compare it to `auth.uid()`. Review policies also require ownership of their parent dataset. API routes call `auth.getUser()`, use the session-scoped database client, validate IDs and bodies, and never accept a browser `user_id` as proof of ownership. A missing or foreign dataset therefore produces no visible row.

## File handling

The importer accepts `.csv` files up to 100 MB and 1,000,000 data rows. It uploads directly to Supabase Storage with a signed, resumable TUS upload, then streams parsed records into bounded database batches. This avoids keeping the full parsed dataset in application memory and avoids the Vercel function request-body limit. It validates mapped columns, skips blank review content, and safely represents invalid ratings/dates as null. The original file lives in the private `reviewlens-private` bucket at `{user_id}/{dataset_id}/{timestamp}-{filename}`. Download authorization is checked against the caller-owned dataset before a 60-second signed URL is generated. The Supabase project-wide Storage limit must be at least 100 MB; plan limits can be lower than the bucket limit.

Spreadsheet exports prefix values that begin with `=`, `+`, `-`, `@`, tab, or carriage return to reduce formula injection risk. Dataset analytics, re-analysis, and exports are separately capped at 10,000 records per operation; review listing is paginated.

Uploads, analyses, and exports also have a per-user, per-process request limit. This protects local demos and single-process deployments from accidental repeated work. Serverless or multi-instance deployments should add a shared edge or database rate limiter for globally enforced quotas; process memory does not coordinate across instances.

## Retention behavior

Deleting a dataset cascades its review rows and removes its source object. `analysis_runs` keep a snapshot summary and dataset name; their dataset reference becomes null. `reports` retain generation metadata and become unavailable for re-download if their dataset is deleted. Generated exports are not persisted.

## Deployment responsibilities

The application has not been assessed against a legal framework or security certification. Operators must choose appropriate provider region, backups, retention periods, SMTP, incident response, and privacy notices. User-uploaded reviews can contain personal information; only process data with a legitimate reason and appropriate permission.

# ReviewLens

ReviewLens is a multi-user customer feedback analysis application built for a BCA project and portfolio demonstration. It imports CSV reviews, classifies their sentiment with an explainable rule-based English word list, compares products, and exports review data and analysis summaries.

The application requires a Supabase project for accounts, persistence, and private original-file storage. It does not include credentials and does not claim to be connected until the environment is configured.

## Stack

- Next.js App Router, React, TypeScript
- Tailwind CSS 4 with shadcn-style, locally composed UI primitives
- Supabase Auth, PostgreSQL, Row Level Security, and private Storage
- React Hook Form and Zod validation
- Recharts, Papa Parse, ExcelJS, jsPDF and jsPDF AutoTable
- Vitest unit tests

## Local setup

Requirements: Node.js 20.19 or later and npm (Node 22.13 or later is recommended for current lint tooling).

1. Create a Supabase project at [supabase.com](https://supabase.com/).
2. Copy `.env.example` to `.env.local` and set the project URL and public anon key from **Project Settings → API**:

   ```powershell
   Copy-Item .env.example .env.local
   ```

   Keep server secrets out of `NEXT_PUBLIC_*` variables; this project does not need the service-role key.
3. Install packages and apply the schema:

   ```powershell
   npm install
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```

   You can also paste `supabase/migrations/202610180001_initial_schema.sql` into the Supabase SQL Editor. The migration creates tables, indexes, RLS policies, the user-record trigger, and the private `reviewlens-private` storage bucket.
4. In Supabase **Authentication → URL Configuration**, set the Site URL to `http://localhost:3000` and add `http://localhost:3000/auth/callback` as a redirect URL. Configure SMTP/email confirmation according to your demo needs.
5. Start the app:

   ```powershell
   npm run dev
   ```

6. Open `http://localhost:3000`, register, and confirm the email if required by the Supabase project. Load the synthetic sample dataset or import a CSV.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key; RLS remains enabled |
`.env.example` contains placeholders only. Passwords are managed by Supabase Auth and are never copied into application tables.

## Main routes

Public routes: `/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/privacy`, `/terms`.

Authenticated workspace: `/dashboard`, `/reviews`, `/sentiment`, `/products`, `/datasets`, `/datasets/new`, `/datasets/[id]`, `/history`, `/history/[id]`, `/reports`, `/settings/profile`, `/settings/security`, `/settings/preferences`.

## Import and analysis

CSV uploads are capped at 100 MB and 1,000,000 data rows. The server streams the CSV and inserts reviews in batches to avoid holding every parsed row in memory. Review text columns named `review`, `review_text`, or `text` are detected case-insensitively. Common rating, date, and product aliases are mapped automatically; users can adjust mappings and preview the first rows. Blank review rows are skipped, invalid ratings/dates become missing values, and the original file is kept in private storage. Supabase's project-wide Storage limit must allow files of at least 100 MB; the Free plan may have a lower limit.

Dataset analytics, re-analysis, and exports currently have a separate 10,000-review per-operation limit. Review listing remains paginated, so larger imported datasets can still be browsed.

Sentiment uses `lexicon-1.0`: tokenize Unicode words, count positive and negative dictionary matches, and reverse a matched term if `not`, `never`, `no`, or a listed negator appears in the previous three tokens. The larger count chooses Positive or Negative; a tie is Neutral. Scores are match counts, not confidence. Sarcasm, context, spelling errors, slang, and complex negation are known limitations. See [the viva guide](docs/viva-guide.md).

## Data model and authorization

The migration defines `profiles`, `user_preferences`, `datasets`, `reviews`, `analysis_runs`, and `reports`. Every user-owned table has RLS. Dataset and review APIs authenticate with `auth.getUser()`, use the session-bound Supabase client, validate input, and rely on RLS for ownership isolation. The application never accepts a browser-supplied owner ID as authority. Uploaded objects live in a private bucket under `{user_id}/{dataset_id}/...`; original-file downloads use a 60-second signed URL.

Deleting a dataset cascades its reviews and removes its original object. Analysis-run snapshots and report metadata remain, with foreign-key references set to null. Generated export files are produced on demand and are not persisted; report rows retain format and scope metadata.

See [API documentation](docs/api.md), [security model](docs/security.md), and [deployment guide](docs/deployment.md).

## Exports

- CSV with original review fields and sentiment scores, UTF-8 BOM, and formula-injection protection.
- Excel workbook with Summary, Reviews, Products, and Sentiment sheets.
- PDF with dataset metadata, KPIs, sentiment breakdown, product and review tables, methodology, and page numbers.
- JSON using the documented `reviewlens.export.v1` structure.
- Secure download of the original uploaded CSV.

Exports are scoped to the authenticated user and can use all rows or current review filters. Export generation is limited to 10,000 reviews.

## Checks

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Unit tests cover sentiment rules, metrics, CSV header mapping, quoted content, and invalid values. Database integration and multi-user browser tests require a configured Supabase project and two test accounts; see [testing notes](docs/testing.md).

## Troubleshooting

- **Workspace asks to connect Supabase:** Check `.env.local`, restart the dev server, and verify the URL/key pair.
- **Login redirects or confirmation links fail:** Add the exact local or production `/auth/callback` URL to Supabase Auth redirect allowlist and configure Site URL.
- **CSV original does not upload:** Apply the migrations and confirm `reviewlens-private` exists and is private. The bucket limit is 100 MB, and the Supabase project-wide Storage limit must also allow at least 100 MB.
- **A CSV column was not detected:** Use the mapping controls and map the review text explicitly. Accepted text aliases include `comment`, `feedback`, and `content` as well as `review`, `review_text`, and `text`.
- **Email confirmation does not arrive:** Configure SMTP in Supabase Auth. For a local academic demo, you may disable confirmation in the Supabase Auth provider settings, understanding that this changes the verification behavior.
- **PDF contains only the first 60 review texts:** The PDF keeps the report concise; CSV, Excel, and JSON include the full selected scope.

## Project structure

```text
src/app/                   App Router pages and protected API routes
src/components/            Workspace, auth, import, settings, and chart UI
src/lib/analysis/          Sentiment and metric functions
src/lib/import/            CSV parsing and column mapping
src/lib/supabase/          Browser, server, and cookie refresh clients
supabase/migrations/       PostgreSQL schema, RLS, and private storage policies
sample-data/               Fictional sample CSV
docs/                      API, deployment, security, testing, and viva guides
```

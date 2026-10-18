# Viva guide

## Project summary

ReviewLens is a full-stack customer feedback intelligence platform. Next.js serves the pages and protected API routes. Supabase Auth manages identity; PostgreSQL stores profiles, preferences, datasets, reviews, analysis runs, and report metadata; Supabase Storage holds private source CSVs. PostgreSQL Row Level Security and server-side session checks isolate each user's data.

## Architecture in one minute

1. The browser renders React pages and sends validated requests to Next.js Route Handlers.
2. Route Handlers read the user's Supabase session from cookies and call `auth.getUser()`.
3. A session-bound Supabase client performs parameterized operations; RLS evaluates `auth.uid()` for every owned row.
4. The analysis module normalizes and tokenizes review text, counts positive/negative terms, applies a small negation window, and derives deterministic metrics.
5. CSV, XLSX, PDF, and JSON files are generated server-side for the selected owner's records.

## Database tables

- `profiles`: display name keyed to the Supabase Auth user.
- `user_preferences`: theme and default export format.
- `datasets`: collection metadata and optional private source-file path.
- `reviews`: original text plus rating, product/date, sentiment label, match counts, and word count.
- `analysis_runs`: immutable summary snapshot and algorithm version for a saved run.
- `reports`: owner, dataset/run association, format, scope, and creation time. Generated file bytes are not retained.

Deleting a dataset deletes its reviews and original file. Analysis summaries and report metadata survive with their dataset references cleared so history does not point to a missing row.

## Sentiment method

The classifier is a lexicon/rule-based algorithm, not trained ML. Each review is tokenized. Positive and negative words each add one count. If a listed negator is among the preceding three tokens, that word's contribution is flipped. A higher positive count yields Positive; a higher negative count yields Negative; a tie yields Neutral. `positive_score` and `negative_score` are counts, not probabilities or confidence scores. `lexicon-1.0` is recorded so future rule changes can be distinguished.

Limitations: English-only dictionary, sarcasm, slang, spelling variation, word sense, mixed clauses, and complex negation can be misclassified. Human review is required for consequential decisions.

## Sample viva questions and answers

**Why use Supabase?** It combines PostgreSQL, authentication, private object storage, and row-level security so the project can demonstrate real multi-user persistence without writing password handling.

**What is RLS?** Row Level Security is a PostgreSQL feature that checks policies for each row on select/insert/update/delete. Here, policies compare a record owner to `auth.uid()` and review policies also check the parent dataset owner.

**Why check ownership in both API and database?** Server authentication and resource lookup provide clear, consistent application behavior. RLS is the final database boundary if a route has a bug or a user calls the database API directly.

**How are ratings averaged?** Only non-null ratings between one and five are included. If none exist, the result is null and the UI displays an em dash or “No valid ratings,” not a false zero.

**What does a sentiment score mean?** It is a count of dictionary matches after the documented negation rule. It is not confidence and is not produced by a trained model.

**How does the system avoid exposing uploaded files?** The bucket is private, paths include the authenticated user UUID, Storage RLS checks the user folder, and the app only creates a short-lived signed URL after querying an owned dataset.

**How are formula injection risks handled?** Text values beginning with formula-like control characters are prefixed before CSV/XLSX export so spreadsheet software is less likely to execute them as formulas.

**What would you improve next?** Add a versioned multilingual classifier, streaming imports for larger data, automated RLS integration/E2E coverage, export artifact retention policies, and operational monitoring after threat-model and product review.

## Suggested demo sequence

Use the synthetic dataset, show the dataset selector and actual metrics, filter a review, compare products, explain a negated example, save a versioned analysis run, download a report, refresh the page, and show that the dataset and history persist. Use a second test account to demonstrate isolation if the project is configured for it.

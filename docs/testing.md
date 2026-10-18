# Testing and verification

## Automated unit suite

`npm test` runs Vitest tests for:

- positive, negative, neutral, and empty sentiment;
- dictionary counts and the three-token negation behavior;
- Unicode tokenization and word counts;
- rating average, sentiment percentages, and rating distribution;
- keyword stopword removal and product grouping;
- case-insensitive CSV header aliases, custom mappings, quoted commas, escaped quotes, line breaks, blank rows, and invalid ratings.

## Static checks and production build

Run these from the repository root:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

## Supabase integration checks

These checks need a configured local or hosted Supabase project; no credentials or service-role key are included in the repository. Create two test accounts and verify:

1. Each account can create and read its own sample dataset.
2. The second account gets a not-found result when requesting the first account's dataset, reviews, export, or original file.
3. Dataset deletion cascades reviews and the original object while preserving history snapshots.
4. CSV import rejects over-limit files and missing review mappings, and correctly handles quoted fields.
5. Analysis scores and analysis-run summaries persist after refresh.
6. Review filters, pagination, and filtered exports use the same scope.
7. Reports are recorded for the owner and inaccessible to the other account.

## End-to-end demo path

Register or sign in → load sample or import a CSV → inspect dashboard → filter reviews → inspect sentiment and products → save an analysis run → export CSV/XLSX/PDF/JSON → refresh and reopen the dataset → verify private file access.

This repository does not include a browser automation harness or automated provisioning of Supabase test accounts. Run the authenticated scenarios manually in a disposable project or add a dedicated E2E environment before release.

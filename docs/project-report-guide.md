# Academic project report guide

Use this outline to prepare a BCA semester project report. Replace placeholders with your actual institution, screenshots, test results, and deployment details.

1. **Title page:** ReviewLens — Customer Feedback Intelligence Platform.
2. **Abstract:** Explain the problem of manually reviewing large feedback collections and the goal of searchable, transparent sentiment summaries.
3. **Problem statement and objectives:** CSV import, secure multi-user workspaces, review exploration, product comparison, history, and exports.
4. **Existing system and proposed system:** Compare manual spreadsheet review with a private analysis workspace. Avoid unsupported market claims.
5. **Requirements:** List functional and non-functional requirements, actors, and assumptions.
6. **System design:** Include the browser → Next.js server → Supabase diagram, route overview, threat boundaries, and data flow.
7. **Database design:** Explain each table, foreign keys, indexes, deletion behavior, and RLS policies. Add an ER diagram derived from the migration.
8. **Algorithm:** Present tokenization, lexicon counts, negation window, tie behavior, pseudocode, sample examples, and limitations.
9. **Implementation:** Describe the import mapping workflow, charts, filtering, authentication, and export formats with screenshots from your configured deployment.
10. **Testing:** Include unit results and the two-account RLS scenarios actually executed. Do not claim tests that were not run.
11. **Deployment:** Record the hosting platform, Supabase setup, environment variable names (never values), and migration revision.
12. **Limitations and future scope:** Explain lexicon accuracy, language, scale, manual integration testing, and planned improvements.
13. **Conclusion and references:** Summarize achieved objectives and cite the official framework/provider docs used.

Do not include real customer data, credentials, API keys, or personally identifying reviews in screenshots or appendices.

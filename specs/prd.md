# OpenRun PRD (M1)

## Goal

Launch a bilingual, read-only open source software directory with 50 products ingested, analyzed, reviewed, and published.

## User Stories

- I can browse software by category.
- I can search by name or keyword.
- I can view a product's summary, features, use cases, alternatives, and license.
- I can switch between English and Chinese.
- An admin can review AI content and publish it.
- An external visitor can submit a project and track its review status.
- An admin can triage submissions, enrich drafts, and publish approved listings.

## Pages

| Page | Content |
|---|---|
| Home | Category entry points, featured and recently added products |
| Category | Products in that category |
| Detail | Summary, features, use cases, alternatives, license, sources |
| Search | Keyword search and filters |
| Submit | External submission form and editorial requirements |
| Submission status | Tokenized status page for a submission |
| Admin | Review queue, editing, publishing |

## Core Data

- Software: name, slug, homepage, repository, license, categories, tags
- Facts: stars, language, last update, releases
- Analysis: summary, features, use cases, alternatives, deployment difficulty
- Status: draft / reviewed / published
- Provenance: source URL, fetched at
- Submission: repository, suggested category, note, contact, status, review history
- Reference data: categories, licenses, difficulty levels, reserved tags

## Functional Requirements

1. Ingest software metadata from GitHub on a schedule.
2. Normalize, deduplicate, and map licenses.
3. Generate structured English and Chinese content with AI.
4. Publish only after admin review.
5. Render list, category, detail, and search pages.
6. Preserve sources and update timestamps.
7. Validate external submissions for public HTTPS repositories, licenses, duplicates, and rate limits.
8. Keep submissions separate from the catalog until an editor accepts them into a draft.
9. Require verified license, bilingual summaries, and at least one category before publishing.
10. Maintain a migration-based schema and keep demo fixtures out of the production seed.

## Non-functional Requirements

- AI never overwrites fact fields.
- Repeated runs do not create duplicate records.
- Pages can be statically published and load fast.
- Secrets never enter the repository.

## Acceptance Criteria

- 50 products are reviewed and published.
- English and Chinese pages are accessible.
- Search and category filters work.
- Ingest and publish flows are repeatable.
- Submissions are deduplicated and never auto-publish.
- Re-running migrations, reference seed, demo seed, or catalog import does not create duplicates.

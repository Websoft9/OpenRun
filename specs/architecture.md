# OpenRun Architecture

One line: external data is processed by Workflow; structured records go to DB, files go to Storage, and Web presents the result.

```
Sources -> Workflow -> DB / Storage -> Web
```

## A. Core Runtime

| Layer | Responsibility | M1 |
|---|---|---|
| Web | Catalog, category, detail, and search pages | Yes |
| DB | Software, taxonomy, AI analysis, review state | Yes |
| Storage | Logos, README snapshots, raw JSON, exports | Yes |
| Workflow | Ingest, normalize, dedupe, AI analysis, publish | Yes |

## B. Product Enhancements

| Layer | Responsibility | M1 |
|---|---|---|
| Search | Keyword search, category and tag filters | Yes |
| Admin/CMS | Create, review, publish, feature content | Yes |
| AI Layer | Summaries, features, categories, bilingual content | Yes |
| Auth/Permission | User accounts, sessions, and roles | Yes |
| Cache/CDN | Page acceleration and caching | Deferred |
| Queue | Batch ingestion and AI job scheduling | Deferred |

## C. Engineering & Operations

| Layer | Responsibility | M1 |
|---|---|---|
| API/Integration | Data interfaces for frontend and third parties | Deferred |
| Monitoring/Logging | Job failures, runtime errors, metrics | Deferred |
| CI/CD | Automated test, build, and deploy | Deferred |
| Analytics | Page, search, and click behavior | Deferred |

## API Framework Decision

- Use `Hono` for the API layer.
- Why: it fits Cloudflare Workers well, stays lightweight, and gives typed routing, middleware, and env bindings without adding much framework weight.
- Do not start with heavier Node-first frameworks for M1.

## Authentication Decision

- Use `better-auth` for user accounts, sessions, and user administration.
- Use the built-in Node `node:sqlite` `DatabaseSync` adapter. Do not add Prisma or Drizzle for auth.
- Mount the auth handler at `/api/auth/*`; use server-side `auth.api` calls for the existing server-rendered login and registration forms.
- Store business data in project-owned tables and reference Better Auth `user.id`.
- Keep `ADMIN_TOKEN` for the current editorial admin surface until it is migrated to the Better Auth admin plugin.
- `013_better_auth.sql` creates the auth tables and migrates legacy `users` / `user_sessions` records.

## Database Decision

- If we stay Cloudflare-first for M1, use `D1` for the primary database and `R2` for files.
- Local development may use SQLite, but SQLite files are not deployed directly inside Workers.
- To move local data into D1, export SQLite to SQL and import that SQL with Wrangler.
- If workflow complexity grows or Python needs first-class DB access, re-evaluate PostgreSQL later.

## Principles

- M1 ships layer A plus Search, Admin, and AI.
- Prove one data path before scaling.
- AI summarizes and expresses; it never rewrites facts.
- Keep every layer replaceable; do not lock into a cloud vendor early.


## Data Lifecycle

| Layer | Source | Production | Command |
|---|---|---|---|
| Schema | Versioned SQL migrations | Yes | `npm run db:init` |
| Reference data | Categories, licenses, difficulty levels, reserved tags | Yes | `npm run db:init` |
| Demo fixtures | Deterministic sample products | No | `npm run db:demo` |
| Real catalog | GitHub/import snapshots with provenance | Yes | `npm run catalog:import -- catalog.json` |
| SPDX licenses | Checked-in SPDX License List snapshot under `seed/spdx/` | Yes | `npm run db:seed:licenses` |
| Programming languages | Checked-in GitHub Linguist snapshot under `seed/languages/` | Yes | `npm run db:seed:languages` |
| Markets / economic regions | Checked-in World Bank snapshot under `seed/markets/` | Yes | `npm run db:seed:markets` |
| OS/CPU platforms | Source-controlled vocabulary in `src/data/platforms.ts` | Yes | `npm run db:seed:platforms` |
| PCF-aligned process model | Source-controlled L1/L2/L3 preview in `src/data/process-framework.ts` | Yes | `npm run db:seed:processes` |
| Applicable industries | Source-controlled ISIC Rev.4 sections in `src/data/industries.ts` | Yes | `npm run db:seed:industries` |
| Contentful seed | Checked-in snapshot under `seed/contentful/2026-10-19/` | Yes | `npm run db:seed:contentful` |

Reference seed data is taxonomy and controlled vocabulary only. Product records are application data and must come from ingestion, catalog import, or editorial review.

## Taxonomy

- The PCF-aligned process model in `src/data/process-framework.ts` is a preview, not official APQC data. It stores L1/L2/L3 nodes with stable process codes. Full PCF data requires a license and an authorized import.
- Software-to-process fit is stored in `software_processes` with fit level, confidence, evidence, and review status. It must not be auto-published.
- Existing Contentful categories are treated as **software types**, a secondary facet used for filtering and software-type pages.
- Use cases and cross-cutting attributes belong in tags, not in additional category trees.

### PCF process model vs software categories

These two classification dimensions serve different purposes and must not be conflated:

| Dimension | Role | Entry point |
|---|---|---|
| **PCF process model** (L1 → L2 → L3) | Primary enterprise-view taxonomy. Answers "which business process needs improvement?" | A consultant starts with a customer problem, maps it to a process domain, and finds software mapped to that process. |
| **Software categories** (two-level: group → type) | Secondary software-type facet. Answers "what kind of software is this?" | A user browsing the catalog filters by software type (e.g. ERP, CRM, Database). |

A software record carries **both**: it belongs to one or more software-type categories (product-view classification), and it is mapped to one or more PCF process nodes via `software_processes` (functional-fit mapping). The two dimensions are complementary, not redundant.

Software categories are organised in two levels using `category_parents`:
- **Parent groups** (`business-apps`, `tech-platforms`): UI grouping anchors only, not assigned directly to products.
- **Leaf categories** (e.g. `erp-operations`, `crm-sales`, `developer-tools`): assigned to software records via `software_categories`.

Business-function leaf categories (ERP, CRM, HR, Finance …) belong here because they describe the *type of product*, not which process it supports. The PCF mapping is where process-fit evidence and confidence are recorded.

- Categories are the stable browse hierarchy; tags carry cross-cutting technical and use-case facets.
- The schema now supports an optional `parent_id` and `category_parents` for multi-parent catalogs. The public UI shows top-level categories, and a top-level category page exposes its subcategories and aggregates products from descendants.
- Existing flat categories remain valid because `parent_id` is nullable.
- Contentful catalogs are preserved as a hierarchy in the seed snapshot: top-level product catalogs become root categories, child catalogs become subcategories, and all parent links are retained in `category_parents`.
- Product records keep their direct catalog links. Category listing counts are computed over the whole descendant tree so a product only needs to be attached to its leaf category.

## Submission Workflow

```
Public form / GitHub issue
        |
        v
submitted / triage / needs_info
        |
        v  accept
draft software (not public)
        |
        v  editorial edit + AI analysis
reviewed
        |
        v  publish
published
```

- Applicable industries use the 21 ISIC Rev.4 sections plus `CROSS_INDUSTRY` in `src/data/industries.ts`, materialized into `industries` and linked through `software_industries`. This describes the industries of the enterprises that use the software, not the vendor's own industry.
- OS/CPU support uses a small OCI-style platform vocabulary (`os/arch`) in `src/data/platforms.ts`, materialized into `platforms` and linked through `software_platforms`. Contentful provides OS but not CPU architecture, so imported products use OS-level `unspecified` platforms until editors provide precise combinations.
- Market availability uses a World Bank-derived reference snapshot: `GLOBAL`, 7 economic regions, and 217 countries with ISO 3166-1 alpha-2 codes. `software_markets` stores product availability. This dimension is availability only; data residency, sanctions, and legal compliance are separate concerns.
- Programming language names come from GitHub Linguist. `languages` stores `name`, `slug`, and `aliases_json`; local source-name aliases live in `seed/languages/aliases.json`. Product `primary_language` values are normalized to canonical Linguist names.
- License identifiers come from the official SPDX License List. The `licenses` table is a minimal reference table: `spdx_id`, `name`, `is_osi_approved`, `reference_url`. Custom/non-SPDX licenses stay on the product and are not added to the table.
- Contentful is a one-time bootstrap source. The checked-in snapshot under `seed/contentful/2026-10-19/` is seed data; after seeding, the project database is the source of truth.
- Contentful entries are keyed by `external_source` / `external_id` on categories and software for provenance and idempotent re-seeding.
- Contentful products are not deduplicated by repository URL because one repository can legitimately power several products or editions.
- `submissions` and `submission_events` are separate from `software` so untrusted payloads never enter the public catalog.
- Submissions are deduplicated by normalized repository URL among open submissions and existing software.
- GitHub metadata and license checks are best-effort; missing permissions, private repositories, unknown licenses, and archived projects become triage or needs-info items.
- Publishing requires bilingual summaries, a verified license, and at least one category.
- The admin surface is protected by `ADMIN_TOKEN` (HTTP Basic or Bearer). Public status pages use unguessable submission tokens.
- Rate limits are in-memory per instance in M1; replace with a shared store when running multiple instances.

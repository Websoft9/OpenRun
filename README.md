# OpenRun

Contents collection and AI analysis for open source software.

## Local development

```bash
npm install
npm run db:init              # apply migrations + reference data (categories, licenses, tags)
npm run db:seed:contentful   # seed the catalog from the checked-in Contentful snapshot
npm run dev
```

`db:init` never inserts catalog records. The checked-in Contentful snapshot is the catalog seed. Demo fixtures remain available for tests via `db:demo`, but the main database uses the Contentful seed.

## Catalog import

```bash
npm run catalog:import -- path/to/catalog.json
```

The importer is idempotent by slug or normalized repository URL and preserves provenance. See `src/repositories/catalog-import.ts` for the accepted JSON shape.

## License reference data

License names come from the official SPDX License List. Do not invent license IDs. The checked-in snapshot lives under `seed/spdx/3.29.0/` and is loaded by `db:init`.

```bash
npm run db:seed:licenses              # apply the checked-in SPDX snapshot
npm run sync:spdx                     # fetch the latest SPDX list, write a new snapshot, update the DB
```

The `licenses` table is intentionally minimal:

```text
spdx_id, name, is_osi_approved, reference_url
```

Non-SPDX/custom licenses stay on the product record and are marked as needing review; they are not added to this table.

## Programming language reference data

Programming language names come from GitHub Linguist, the de facto language list used by GitHub. The checked-in snapshot lives under `seed/languages/2026-10-14/` and is loaded by `db:init`.

```bash
npm run db:seed:languages              # apply the checked-in Linguist snapshot
npm run sync:languages                 # fetch Linguist languages.yml, write a snapshot, update the DB
```

The table is intentionally small:

```text
languages(name, slug, aliases_json)
```

Manual source-name aliases, such as `unix shell -> Shell` or `object pascal -> Pascal`, live in `seed/languages/aliases.json`. Product `primary_language` values are normalized to the canonical Linguist name; unmatched values remain `Unknown`.

## Market / economic-region reference data

Software availability is modeled as markets. The checked-in snapshot under `seed/markets/2026-10-19/` comes from the World Bank country API and contains:

- `GLOBAL`
- 7 World Bank economic regions
- 217 countries with ISO 3166-1 alpha-2 codes and region parents

```bash
npm run db:seed:markets      # apply the checked-in World Bank snapshot
npm run sync:markets         # fetch World Bank country data, write a snapshot, update the DB
```

Products default to `GLOBAL`. Editors can replace that with one or more economic regions in the admin form. The public product page shows the assigned markets.

Tables:

```text
markets(code, name, type, parent_code, iso3, source)
software_markets(software_id, market_code)
```

This is market availability only. Data residency, sanctions, and legal compliance should be modeled separately.

## OS and CPU platform reference data

Platform support is a small controlled vocabulary in `src/data/platforms.ts`, materialized into the database by `db:init`:

```bash
npm run db:seed:platforms
```

Tables:

```text
platforms(code, os_code, os_name, arch_code, arch_name, variant, aliases_json, source)
software_platforms(software_id, platform_code, support_level, note)
```

Platform codes use OCI-style `os/arch` names such as `linux/amd64`, `linux/arm64`, `windows/amd64`, and `darwin/arm64`. Contentful currently provides OS only, so imported products use `linux/unspecified` or `windows/unspecified` until an editor supplies architecture-specific support.

## Industry reference data

Applicable enterprise industries use the 21 ISIC Rev.4 sections plus a `CROSS_INDUSTRY` value. The list is source-controlled in `src/data/industries.ts` and materialized by `db:init`.

```bash
npm run db:seed:industries
```

Tables:

```text
industries(code, name, name_zh, level, parent_code, source)
software_industries(software_id, industry_code)
```

`software_industries` describes the industries of the enterprises that use the software, not the software vendor's own industry. Existing products default to `CROSS_INDUSTRY`; editors can select one or more specific industries.

## PCF-aligned process framework

The process model is a PCF-aligned **preview** in `src/data/process-framework.ts`, materialized by `db:init`:

```bash
npm run db:seed:processes
```

Current coverage:

- L1: 13 domains
- L2: 45 process groups
- L3: 101 processes

Tables:

```text
process_frameworks(id, name, version, license, source)
process_nodes(code, framework_id, parent_code, level, name, name_zh, function_code, ...)
software_processes(software_id, process_code, fit_level, confidence, evidence_url, review_status)
```

API:

```text
GET /api/processes?level=1
GET /api/processes?parent=9.0
GET /api/processes/9.0
```

The preview is not official APQC PCF data. Full PCF data requires an APQC license and should be imported from an authorized source. Software-to-process mappings are intentionally left empty until reviewed.

## Contentful seed data

The repository includes a one-time Contentful snapshot under `seed/contentful/2026-10-19/` (catalog, products, licenses, tags, media metadata, delivery and pricing references). It is seed data for this project, not an ongoing upstream sync. The loader automatically uses the latest version directory unless `OPENRUN_CONTENTFUL_SEED_DIR` is set.

```bash
npm run db:seed:contentful
```

This loads the snapshot into the database selected by `OPENRUN_DB_PATH` (default: `data/openrun.sqlite`). No Contentful token is required to seed.

To refresh the snapshot from Contentful in the future, use an explicit export. It writes a new dated directory under `seed/contentful/`:

```bash
set -a; . .secrets/contentful.env; set +a
npm run catalog:contentful:export
```

After the initial seed, this project's database is the source of truth. Contentful is only a bootstrap source for the checked-in snapshot. The snapshot preserves the catalog hierarchy, products, bilingual content, licenses, tags, logos, screenshots, and source metadata. It is idempotent and preserves distinct products that share the same repository URL.

Contentful export environment variables:

| Variable | Purpose |
|---|---|
| `CONTENTFUL_ACCESS_TOKEN` | Contentful Management API token, only needed for export |
| `CONTENTFUL_SPACE_ID` | Space id, defaults to `ffrhttfighww` |
| `CONTENTFUL_ENVIRONMENT` | Environment id, defaults to `master` |

## Submissions and admin

- Public submission form: `/{locale}/submit`
- Submission status: `/{locale}/submissions/{token}`
- GitHub issue form: `.github/ISSUE_TEMPLATE/submit-app.yml`
- Admin queue: `/{locale}/admin`

Set `ADMIN_TOKEN` before starting the server. The admin queue accepts HTTP Basic (`admin:<ADMIN_TOKEN>`) or `Authorization: Bearer <ADMIN_TOKEN>`.

Optional environment variables:

| Variable | Purpose |
|---|---|
| `OPENRUN_DB_PATH` | Override the SQLite database path |
| `BETTER_AUTH_SECRET` | Secret used by Better Auth; set this in production |
| `BETTER_AUTH_URL` | Public base URL used by Better Auth |
| `ADMIN_TOKEN` | Enable and protect the admin review queue |
| `GITHUB_TOKEN` / `GITHUB_PAT` | Raise GitHub API limits during submission enrichment |
| `SUBMISSION_ENRICH=0` | Disable automatic GitHub metadata and license checks |
| `SUBMISSION_IP_SALT` | Stable salt for submission IP hashes |
| `TRUST_PROXY=1` | Trust `X-Forwarded-For`/`X-Real-IP` when running behind a trusted proxy |

## Tests

```bash
npm test
npm run check:i18n
```

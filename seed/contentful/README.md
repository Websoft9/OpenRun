# Contentful bootstrap seed

This directory holds immutable, dated Contentful snapshots. The seed loader automatically uses the newest version directory unless `OPENRUN_CONTENTFUL_SEED_DIR` points elsewhere.

- `product.json`, `catalog.json`: bootstrap catalog data. After seeding, the project database is the source of truth.
- `license.json`, `seo.json`, `baseFeature.json`, `media.json`, `delivery.json`, `price.json`, `language.json`, `aboutAppPersonnel.json`: import inputs used to derive runtime records such as licenses, tags, features, logos, and metadata. They are not runtime assets.
- `manifest.json`: source space, environment, export timestamp, and entry counts.

Do not edit an existing snapshot in place. Export a new dated directory instead.

```bash
npm run db:seed:contentful
npm run catalog:contentful:export   # optional: create a new snapshot from Contentful
```

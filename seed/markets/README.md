# Market / economic-region snapshots

Dated snapshots derived from the World Bank country API.

- `markets.json`: `GLOBAL`, World Bank economic regions, and countries with ISO 3166-1 alpha-2 codes
- `manifest.json`: source URL, fetch time, and counts

Tables:

```text
markets(code, name, type, parent_code, iso3, source)
software_markets(software_id, market_code)
```

Refresh with:

```bash
npm run sync:markets
```

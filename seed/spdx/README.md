# SPDX License List snapshots

Dated snapshots of the official SPDX License List.

- `licenses.json`: official list from https://spdx.org/licenses/licenses.json
- `manifest.json`: version, release date, and source URL

The project stores license identifiers as SPDX IDs and keeps the database table minimal:

```text
licenses(spdx_id, name, is_osi_approved, reference_url)
```

Do not hand-edit names. Refresh with:

```bash
npm run sync:spdx
```

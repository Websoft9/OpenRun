# GitHub Linguist snapshots

Dated snapshots of `github-linguist/linguist` language data.

- `<date>/languages.json`: canonical language names and aliases from `lib/linguist/languages.yml`
- `<date>/manifest.json`: source repository, commit, commit date, and count
- `aliases.json`: local source-name aliases that map to canonical Linguist names

The database table is intentionally small:

```text
languages(name, slug, aliases_json)
```

Refresh with:

```bash
npm run sync:languages
```

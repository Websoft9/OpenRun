CREATE TABLE IF NOT EXISTS languages (
  name TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  aliases_json TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_languages_slug ON languages(slug);

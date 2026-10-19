CREATE TABLE IF NOT EXISTS software_translations (
  software_id INTEGER NOT NULL,
  locale TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'published')),
  source_hash TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (software_id, locale),
  FOREIGN KEY (software_id) REFERENCES software(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS software_analysis_translations (
  software_id INTEGER NOT NULL,
  locale TEXT NOT NULL,
  features_json TEXT NOT NULL DEFAULT '[]',
  use_cases_json TEXT NOT NULL DEFAULT '[]',
  alternatives_json TEXT NOT NULL DEFAULT '[]',
  why_choose TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'published')),
  source_hash TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (software_id, locale),
  FOREIGN KEY (software_id) REFERENCES software(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS category_translations (
  category_id INTEGER NOT NULL,
  locale TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'published')),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (category_id, locale),
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tag_translations (
  tag_id INTEGER NOT NULL,
  locale TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'reviewed', 'published')),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tag_id, locale),
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

INSERT OR IGNORE INTO software_translations (software_id, locale, name, summary, status, source_hash)
SELECT software_id, 'zh', '', summary_zh, 'published', ''
FROM analyses
WHERE summary_zh <> '';

INSERT OR IGNORE INTO software_analysis_translations (
  software_id, locale, features_json, use_cases_json, alternatives_json, why_choose, status, source_hash
)
SELECT
  software_id, 'zh', features_zh, use_cases_zh, alternatives_zh, why_choose_zh, 'published', ''
FROM analyses
WHERE features_zh <> '' OR use_cases_zh <> '' OR alternatives_zh <> '' OR why_choose_zh <> '';

INSERT OR IGNORE INTO category_translations (category_id, locale, name, description, status)
SELECT id, 'zh', name_zh, description_zh, 'published'
FROM categories
WHERE name_zh <> '';

ALTER TABLE analyses DROP COLUMN summary_zh;
ALTER TABLE analyses DROP COLUMN features_zh;
ALTER TABLE analyses DROP COLUMN use_cases_zh;
ALTER TABLE analyses DROP COLUMN alternatives_zh;
ALTER TABLE analyses DROP COLUMN why_choose_zh;
ALTER TABLE categories DROP COLUMN name_zh;
ALTER TABLE categories DROP COLUMN description_zh;

CREATE INDEX IF NOT EXISTS idx_software_translations_locale_status
  ON software_translations(locale, status);
CREATE INDEX IF NOT EXISTS idx_software_analysis_translations_locale_status
  ON software_analysis_translations(locale, status);
CREATE INDEX IF NOT EXISTS idx_category_translations_locale_status
  ON category_translations(locale, status);
CREATE INDEX IF NOT EXISTS idx_tag_translations_locale_status
  ON tag_translations(locale, status);

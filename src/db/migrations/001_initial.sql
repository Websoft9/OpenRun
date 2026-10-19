PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name_en TEXT NOT NULL,
  name_zh TEXT NOT NULL,
  description_en TEXT NOT NULL,
  description_zh TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS software (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  homepage TEXT NOT NULL,
  repository TEXT NOT NULL,
  license TEXT NOT NULL,
  primary_language TEXT NOT NULL,
  stars INTEGER NOT NULL DEFAULT 0,
  monthly_views INTEGER NOT NULL DEFAULT 0,
  last_updated_at TEXT NOT NULL,
  latest_release TEXT NOT NULL,
  deployment_difficulty TEXT NOT NULL CHECK (deployment_difficulty IN ('easy', 'moderate', 'advanced')),
  status TEXT NOT NULL CHECK (status IN ('draft', 'reviewed', 'published')),
  is_featured INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS software_categories (
  software_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  PRIMARY KEY (software_id, category_id),
  FOREIGN KEY (software_id) REFERENCES software(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS software_tags (
  software_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (software_id, tag_id),
  FOREIGN KEY (software_id) REFERENCES software(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS analyses (
  software_id INTEGER PRIMARY KEY,
  summary_en TEXT NOT NULL,
  summary_zh TEXT NOT NULL,
  features_en TEXT NOT NULL,
  features_zh TEXT NOT NULL,
  use_cases_en TEXT NOT NULL,
  use_cases_zh TEXT NOT NULL,
  alternatives_en TEXT NOT NULL,
  alternatives_zh TEXT NOT NULL,
  why_choose_en TEXT NOT NULL,
  why_choose_zh TEXT NOT NULL,
  FOREIGN KEY (software_id) REFERENCES software(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS provenance (
  software_id INTEGER PRIMARY KEY,
  source_url TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  reviewed_at TEXT NOT NULL,
  published_at TEXT NOT NULL,
  FOREIGN KEY (software_id) REFERENCES software(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS search_index (
  software_id INTEGER PRIMARY KEY,
  keyword_blob TEXT NOT NULL,
  FOREIGN KEY (software_id) REFERENCES software(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS licenses (
  spdx_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  is_osi_approved INTEGER NOT NULL DEFAULT 0,
  is_copyleft INTEGER NOT NULL DEFAULT 0,
  reference_url TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS difficulty_levels (
  value TEXT PRIMARY KEY CHECK (value IN ('easy', 'moderate', 'advanced')),
  name_en TEXT NOT NULL,
  name_zh TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reserved_tags (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description_en TEXT NOT NULL DEFAULT '',
  description_zh TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT NOT NULL UNIQUE,
  repository_url TEXT NOT NULL,
  normalized_repository TEXT NOT NULL,
  homepage TEXT NOT NULL DEFAULT '',
  suggested_category TEXT,
  note TEXT NOT NULL DEFAULT '',
  submitter_contact TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'web',
  status TEXT NOT NULL CHECK (
    status IN ('submitted', 'triage', 'needs_info', 'accepted', 'ingested', 'reviewed', 'published', 'rejected', 'duplicate')
  ),
  status_reason TEXT NOT NULL DEFAULT '',
  license_spdx TEXT,
  metadata_json TEXT NOT NULL DEFAULT '',
  software_id INTEGER,
  ip_hash TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (software_id) REFERENCES software(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS submission_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  submission_id INTEGER NOT NULL,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  actor TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (submission_id) REFERENCES submissions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_software_status ON software(status);
CREATE INDEX IF NOT EXISTS idx_software_featured ON software(is_featured);
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_tags_slug ON tags(slug);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_token ON submissions(token);
CREATE INDEX IF NOT EXISTS idx_submissions_software ON submissions(software_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_submissions_open_repo
  ON submissions(normalized_repository)
  WHERE status IN ('submitted', 'triage', 'needs_info', 'accepted', 'ingested', 'reviewed');
CREATE INDEX IF NOT EXISTS idx_submission_events_submission ON submission_events(submission_id);

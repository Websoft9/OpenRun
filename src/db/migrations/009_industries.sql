CREATE TABLE IF NOT EXISTS industries (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_zh TEXT NOT NULL DEFAULT '',
  level TEXT NOT NULL DEFAULT 'section' CHECK (level IN ('section', 'division', 'group', 'class', 'special')),
  parent_code TEXT REFERENCES industries(code) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_industries_level ON industries(level);

CREATE TABLE IF NOT EXISTS software_industries (
  software_id INTEGER NOT NULL,
  industry_code TEXT NOT NULL,
  PRIMARY KEY (software_id, industry_code),
  FOREIGN KEY (software_id) REFERENCES software(id) ON DELETE CASCADE,
  FOREIGN KEY (industry_code) REFERENCES industries(code) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_software_industries_industry ON software_industries(industry_code);

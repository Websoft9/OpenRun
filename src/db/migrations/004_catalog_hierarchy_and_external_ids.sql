ALTER TABLE categories ADD COLUMN parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE categories ADD COLUMN position INTEGER NOT NULL DEFAULT 0;
ALTER TABLE categories ADD COLUMN external_source TEXT NOT NULL DEFAULT '';
ALTER TABLE categories ADD COLUMN external_id TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_external
  ON categories(external_source, external_id)
  WHERE external_id <> '';

CREATE TABLE IF NOT EXISTS category_parents (
  category_id INTEGER NOT NULL,
  parent_id INTEGER NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (category_id, parent_id),
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_category_parents_parent ON category_parents(parent_id);

ALTER TABLE software ADD COLUMN external_source TEXT NOT NULL DEFAULT '';
ALTER TABLE software ADD COLUMN external_id TEXT NOT NULL DEFAULT '';
ALTER TABLE software ADD COLUMN logo_url TEXT NOT NULL DEFAULT '';
ALTER TABLE software ADD COLUMN screenshots_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE software ADD COLUMN metadata_json TEXT NOT NULL DEFAULT '{}';

CREATE UNIQUE INDEX IF NOT EXISTS idx_software_external
  ON software(external_source, external_id)
  WHERE external_id <> '';

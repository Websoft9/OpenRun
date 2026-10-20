PRAGMA defer_foreign_keys = ON;

CREATE TABLE process_nodes_new (
  code TEXT PRIMARY KEY,
  framework_id TEXT NOT NULL,
  parent_code TEXT REFERENCES process_nodes_new(code) ON DELETE CASCADE,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5),
  name TEXT NOT NULL,
  name_zh TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  inputs_json TEXT NOT NULL DEFAULT '[]',
  outputs_json TEXT NOT NULL DEFAULT '[]',
  roles_json TEXT NOT NULL DEFAULT '[]',
  kpis_json TEXT NOT NULL DEFAULT '[]',
  source TEXT NOT NULL DEFAULT '',
  license TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (framework_id) REFERENCES process_frameworks(id) ON DELETE CASCADE
);

INSERT INTO process_nodes_new (
  code, framework_id, parent_code, level, name, name_zh, description, position,
  inputs_json, outputs_json, roles_json, kpis_json, source, license
)
SELECT
  code, framework_id, parent_code, level, name, name_zh, description, position,
  inputs_json, outputs_json, roles_json, kpis_json, source, license
FROM process_nodes;

DROP TABLE process_nodes;
ALTER TABLE process_nodes_new RENAME TO process_nodes;

CREATE INDEX IF NOT EXISTS idx_process_nodes_framework_level ON process_nodes(framework_id, level);
CREATE INDEX IF NOT EXISTS idx_process_nodes_parent ON process_nodes(parent_code);

DROP TABLE IF EXISTS software_business_functions;
DROP TABLE IF EXISTS business_functions;

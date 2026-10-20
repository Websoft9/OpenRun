CREATE TABLE IF NOT EXISTS process_frameworks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  license TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS process_nodes (
  code TEXT PRIMARY KEY,
  framework_id TEXT NOT NULL,
  parent_code TEXT REFERENCES process_nodes(code) ON DELETE CASCADE,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 5),
  name TEXT NOT NULL,
  name_zh TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  function_code TEXT REFERENCES business_functions(code) ON DELETE SET NULL,
  position INTEGER NOT NULL DEFAULT 0,
  inputs_json TEXT NOT NULL DEFAULT '[]',
  outputs_json TEXT NOT NULL DEFAULT '[]',
  roles_json TEXT NOT NULL DEFAULT '[]',
  kpis_json TEXT NOT NULL DEFAULT '[]',
  source TEXT NOT NULL DEFAULT '',
  license TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (framework_id) REFERENCES process_frameworks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_process_nodes_framework_level ON process_nodes(framework_id, level);
CREATE INDEX IF NOT EXISTS idx_process_nodes_parent ON process_nodes(parent_code);
CREATE INDEX IF NOT EXISTS idx_process_nodes_function ON process_nodes(function_code);

CREATE TABLE IF NOT EXISTS software_processes (
  software_id INTEGER NOT NULL,
  process_code TEXT NOT NULL,
  fit_level TEXT NOT NULL DEFAULT 'partial' CHECK (fit_level IN ('core', 'partial', 'adjacent')),
  confidence REAL NOT NULL DEFAULT 0,
  evidence_url TEXT NOT NULL DEFAULT '',
  review_status TEXT NOT NULL DEFAULT 'draft' CHECK (review_status IN ('draft', 'reviewed', 'published')),
  note TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (software_id, process_code),
  FOREIGN KEY (software_id) REFERENCES software(id) ON DELETE CASCADE,
  FOREIGN KEY (process_code) REFERENCES process_nodes(code) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_software_processes_process ON software_processes(process_code);

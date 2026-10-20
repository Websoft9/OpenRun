CREATE TABLE IF NOT EXISTS business_functions (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_zh TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS software_business_functions (
  software_id INTEGER NOT NULL,
  function_code TEXT NOT NULL,
  PRIMARY KEY (software_id, function_code),
  FOREIGN KEY (software_id) REFERENCES software(id) ON DELETE CASCADE,
  FOREIGN KEY (function_code) REFERENCES business_functions(code) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_software_business_functions_function
  ON software_business_functions(function_code);

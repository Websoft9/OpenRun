CREATE TABLE IF NOT EXISTS markets (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('global', 'region', 'country')),
  parent_code TEXT REFERENCES markets(code) ON DELETE SET NULL,
  iso3 TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_markets_type ON markets(type);
CREATE INDEX IF NOT EXISTS idx_markets_parent ON markets(parent_code);

CREATE TABLE IF NOT EXISTS software_markets (
  software_id INTEGER NOT NULL,
  market_code TEXT NOT NULL,
  PRIMARY KEY (software_id, market_code),
  FOREIGN KEY (software_id) REFERENCES software(id) ON DELETE CASCADE,
  FOREIGN KEY (market_code) REFERENCES markets(code) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_software_markets_market ON software_markets(market_code);

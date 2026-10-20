CREATE TABLE IF NOT EXISTS platforms (
  code TEXT PRIMARY KEY,
  os_code TEXT NOT NULL,
  os_name TEXT NOT NULL,
  arch_code TEXT NOT NULL,
  arch_name TEXT NOT NULL,
  variant TEXT NOT NULL DEFAULT '',
  aliases_json TEXT NOT NULL DEFAULT '[]',
  source TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_platforms_os ON platforms(os_code);
CREATE INDEX IF NOT EXISTS idx_platforms_arch ON platforms(arch_code);

CREATE TABLE IF NOT EXISTS software_platforms (
  software_id INTEGER NOT NULL,
  platform_code TEXT NOT NULL,
  support_level TEXT NOT NULL DEFAULT 'supported' CHECK (support_level IN ('supported', 'tested', 'experimental')),
  note TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (software_id, platform_code),
  FOREIGN KEY (software_id) REFERENCES software(id) ON DELETE CASCADE,
  FOREIGN KEY (platform_code) REFERENCES platforms(code) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_software_platforms_platform ON software_platforms(platform_code);

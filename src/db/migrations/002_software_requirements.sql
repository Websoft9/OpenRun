ALTER TABLE software ADD COLUMN supports_server INTEGER NOT NULL DEFAULT 0;
ALTER TABLE software ADD COLUMN supports_desktop INTEGER NOT NULL DEFAULT 0;
ALTER TABLE software ADD COLUMN supports_cli INTEGER NOT NULL DEFAULT 0;
ALTER TABLE software ADD COLUMN supports_saas INTEGER NOT NULL DEFAULT 0;
ALTER TABLE software ADD COLUMN has_ui INTEGER NOT NULL DEFAULT 1;
ALTER TABLE software ADD COLUMN has_ai INTEGER NOT NULL DEFAULT 0;
ALTER TABLE software ADD COLUMN has_free_tier INTEGER NOT NULL DEFAULT 0;
ALTER TABLE software ADD COLUMN has_public_pricing INTEGER NOT NULL DEFAULT 0;
ALTER TABLE software ADD COLUMN self_service_setup INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_software_requirements
  ON software(supports_server, supports_saas, has_ai, has_free_tier, has_public_pricing, self_service_setup);

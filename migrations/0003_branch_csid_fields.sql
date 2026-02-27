-- Add per-branch ZATCA CSID fields for Phase 2 device registration
ALTER TABLE branches ADD COLUMN IF NOT EXISTS zatca_device_id TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS zatca_environment TEXT DEFAULT 'sandbox';
ALTER TABLE branches ADD COLUMN IF NOT EXISTS zatca_certificate TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS zatca_certificate_expiry TIMESTAMP;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS zatca_secret_key TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS zatca_compliance_csid TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS zatca_production_csid TEXT;

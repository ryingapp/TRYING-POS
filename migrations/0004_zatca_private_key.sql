-- Add ZATCA private key storage for invoice signing (XAdES-BES)
-- The private key is generated during CSR creation and used to sign invoices

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS zatca_private_key TEXT;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS zatca_private_key TEXT;

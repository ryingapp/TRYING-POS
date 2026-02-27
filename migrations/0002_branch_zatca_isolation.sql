-- Branch-level ZATCA isolation: each branch gets its own ICV counter and hash chain
-- Also add branchId to invoices table for tracking

-- Add ZATCA fields to branches table
ALTER TABLE branches ADD COLUMN IF NOT EXISTS zatca_invoice_counter INTEGER DEFAULT 0;
ALTER TABLE branches ADD COLUMN IF NOT EXISTS zatca_last_invoice_hash TEXT DEFAULT 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYmVlYTI3OWI5MDRhNjId';

-- Add branchId to invoices table
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS branch_id VARCHAR REFERENCES branches(id);

-- Initialize branch counters from existing invoice data
-- For each branch, set its counter to the max invoice_counter of its orders' invoices
UPDATE branches b
SET zatca_invoice_counter = COALESCE(
  (SELECT MAX(i.invoice_counter) 
   FROM invoices i 
   JOIN orders o ON i.order_id = o.id 
   WHERE o.branch_id = b.id),
  0
);

-- Backfill branchId on existing invoices from their orders
UPDATE invoices i
SET branch_id = o.branch_id
FROM orders o
WHERE i.order_id = o.id
AND i.branch_id IS NULL
AND o.branch_id IS NOT NULL;

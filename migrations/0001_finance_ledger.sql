CREATE TABLE IF NOT EXISTS "finance_ledger" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "restaurant_id" varchar NOT NULL REFERENCES "restaurants"("id"),
  "branch_id" varchar REFERENCES "branches"("id"),
  "order_id" varchar REFERENCES "orders"("id"),
  "invoice_id" varchar REFERENCES "invoices"("id"),
  "payment_transaction_id" varchar REFERENCES "payment_transactions"("id"),
  "event_type" text NOT NULL,
  "event_source" text NOT NULL DEFAULT 'server',
  "amount" numeric(12,2),
  "currency" text DEFAULT 'SAR',
  "idempotency_key" text,
  "payload" text,
  "previous_entry_hash" text,
  "entry_hash" text NOT NULL,
  "created_by" varchar REFERENCES "users"("id"),
  "created_by_name" text,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "finance_ledger_restaurant_created_idx" ON "finance_ledger" ("restaurant_id", "created_at");
CREATE INDEX IF NOT EXISTS "finance_ledger_order_created_idx" ON "finance_ledger" ("order_id", "created_at");
CREATE INDEX IF NOT EXISTS "finance_ledger_invoice_created_idx" ON "finance_ledger" ("invoice_id", "created_at");

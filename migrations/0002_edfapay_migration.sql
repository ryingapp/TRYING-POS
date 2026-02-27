-- EdfaPay migration: Add EdfaPay payment gateway support

-- Add EdfaPay credentials to restaurants table
ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "edfapay_merchant_id" text;--> statement-breakpoint
ALTER TABLE "restaurants" ADD COLUMN IF NOT EXISTS "edfapay_password" text;--> statement-breakpoint

-- Create EdfaPay merchants table
CREATE TABLE IF NOT EXISTS "edfapay_merchants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" varchar NOT NULL,
	"edfapay_merchant_id" text,
	"edfapay_password" text,
	"name" text,
	"public_name" text,
	"email" text,
	"status" text DEFAULT 'active',
	"payment_methods" text[],
	"notification_url" text,
	"is_live" boolean DEFAULT false,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);--> statement-breakpoint

-- Create EdfaPay invoices table
CREATE TABLE IF NOT EXISTS "edfapay_invoices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" varchar NOT NULL,
	"order_id" varchar,
	"edfapay_transaction_id" text,
	"edfapay_gway_id" text,
	"status" text DEFAULT 'initiated',
	"amount" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'SAR',
	"description" text,
	"callback_url" text,
	"customer_name" text,
	"customer_phone" text,
	"customer_email" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);--> statement-breakpoint

-- Add EdfaPay transaction fields to payment_transactions
ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "edfapay_transaction_id" text;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD COLUMN IF NOT EXISTS "edfapay_gway_id" text;--> statement-breakpoint

-- Add foreign keys for EdfaPay tables
ALTER TABLE "edfapay_merchants" ADD CONSTRAINT "edfapay_merchants_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edfapay_invoices" ADD CONSTRAINT "edfapay_invoices_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edfapay_invoices" ADD CONSTRAINT "edfapay_invoices_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;

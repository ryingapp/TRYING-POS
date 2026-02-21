CREATE TABLE "apple_pay_domains" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" varchar NOT NULL,
	"merchant_id" varchar NOT NULL,
	"moyasar_domain_id" text,
	"host" text NOT NULL,
	"status" text DEFAULT 'initiated',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "branches" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" varchar NOT NULL,
	"name" text NOT NULL,
	"name_ar" text,
	"address" text,
	"phone" text,
	"opening_time" text,
	"closing_time" text,
	"is_main" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cash_transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" varchar NOT NULL,
	"branch_id" varchar,
	"session_id" varchar,
	"type" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"reason" text,
	"performed_by" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" varchar NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"parent_id" varchar,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "coupon_usage" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"coupon_id" varchar NOT NULL,
	"order_id" varchar NOT NULL,
	"customer_phone" text,
	"discount_amount" numeric(10, 2) NOT NULL,
	"used_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" varchar NOT NULL,
	"code" text NOT NULL,
	"name_en" text,
	"name_ar" text,
	"discount_type" text DEFAULT 'percentage' NOT NULL,
	"discount_value" numeric(10, 2) NOT NULL,
	"min_order_amount" numeric(10, 2) DEFAULT '0',
	"max_discount_amount" numeric(10, 2),
	"start_date" timestamp,
	"end_date" timestamp,
	"is_active" boolean DEFAULT true,
	"usage_limit" integer,
	"usage_per_customer" integer DEFAULT 1,
	"usage_count" integer DEFAULT 0,
	"applicable_order_types" text[],
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" varchar NOT NULL,
	"name" text,
	"name_ar" text,
	"phone" text NOT NULL,
	"email" text,
	"address" text,
	"notes" text,
	"total_orders" integer DEFAULT 0,
	"total_spent" numeric(10, 2) DEFAULT '0',
	"last_order_at" timestamp,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customization_groups" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" varchar NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"selection_type" text DEFAULT 'single' NOT NULL,
	"min_selections" integer DEFAULT 0,
	"max_selections" integer DEFAULT 1,
	"is_required" boolean DEFAULT false,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "customization_options" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" varchar NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"price_adjustment" numeric(10, 2) DEFAULT '0',
	"is_default" boolean DEFAULT false,
	"is_available" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "day_sessions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" varchar NOT NULL,
	"branch_id" varchar,
	"date" text NOT NULL,
	"status" text DEFAULT 'open',
	"opened_by" varchar,
	"closed_by" varchar,
	"opened_at" timestamp DEFAULT now(),
	"closed_at" timestamp,
	"opening_balance" numeric(10, 2) DEFAULT '0',
	"closing_balance" numeric(10, 2),
	"expected_balance" numeric(10, 2),
	"difference" numeric(10, 2),
	"total_sales" numeric(10, 2) DEFAULT '0',
	"total_orders" integer DEFAULT 0,
	"cash_sales" numeric(10, 2) DEFAULT '0',
	"card_sales" numeric(10, 2) DEFAULT '0',
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" varchar NOT NULL,
	"branch_id" varchar,
	"name" text NOT NULL,
	"name_ar" text,
	"unit" text NOT NULL,
	"current_stock" numeric(10, 2) DEFAULT '0',
	"min_stock" numeric(10, 2) DEFAULT '0',
	"cost_per_unit" numeric(10, 2) DEFAULT '0',
	"category" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inventory_transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inventory_item_id" varchar NOT NULL,
	"branch_id" varchar,
	"type" text NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"unit_cost" numeric(10, 2),
	"total_cost" numeric(10, 2),
	"notes" text,
	"reference_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" varchar NOT NULL,
	"order_id" varchar NOT NULL,
	"invoice_number" text NOT NULL,
	"invoice_type" text DEFAULT 'standard',
	"status" text DEFAULT 'issued',
	"subtotal" numeric(10, 2) NOT NULL,
	"tax_amount" numeric(10, 2) NOT NULL,
	"tax_rate" numeric(5, 2) DEFAULT '15.00',
	"discount" numeric(10, 2) DEFAULT '0',
	"delivery_fee" numeric(10, 2) DEFAULT '0',
	"total" numeric(10, 2) NOT NULL,
	"customer_name" text,
	"customer_phone" text,
	"customer_vat_number" text,
	"payment_method" text,
	"is_paid" boolean DEFAULT false,
	"qr_code_data" text,
	"xml_content" text,
	"zatca_status" text DEFAULT 'pending',
	"zatca_submission_id" text,
	"zatca_warnings" text,
	"zatca_errors" text,
	"related_invoice_id" varchar,
	"invoice_counter" integer,
	"invoice_hash" text,
	"previous_invoice_hash" text,
	"uuid" text,
	"csid_token" text,
	"signed_xml" text,
	"created_at" timestamp DEFAULT now(),
	"issued_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "menu_item_customizations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"menu_item_id" varchar NOT NULL,
	"customization_group_id" varchar NOT NULL,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "menu_item_variants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"menu_item_id" varchar NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"price_adjustment" numeric(10, 2) DEFAULT '0',
	"is_default" boolean DEFAULT false,
	"is_available" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "menu_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" varchar NOT NULL,
	"category_id" varchar NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"description_en" text,
	"description_ar" text,
	"price" numeric(10, 2) NOT NULL,
	"image" text,
	"is_available" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"prep_time" integer,
	"calories" integer,
	"sugar" numeric(6, 2),
	"fat" numeric(6, 2),
	"saturated_fat" numeric(6, 2),
	"sodium" numeric(8, 2),
	"protein" numeric(6, 2),
	"carbs" numeric(6, 2),
	"fiber" numeric(6, 2),
	"caffeine" numeric(6, 2),
	"allergens" jsonb DEFAULT '[]'::jsonb,
	"is_high_sodium" boolean DEFAULT false,
	"is_spicy" boolean DEFAULT false,
	"is_vegetarian" boolean DEFAULT false,
	"is_vegan" boolean DEFAULT false,
	"is_gluten_free" boolean DEFAULT false,
	"is_new" boolean DEFAULT false,
	"is_bestseller" boolean DEFAULT false,
	"walking_minutes" integer,
	"running_minutes" integer
);
--> statement-breakpoint
CREATE TABLE "moyasar_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"merchant_id" varchar NOT NULL,
	"restaurant_id" varchar NOT NULL,
	"document_type" text NOT NULL,
	"document_info" jsonb,
	"file_data" text,
	"file_name" text,
	"file_mime_type" text,
	"is_uploaded" boolean DEFAULT false,
	"moyasar_document_id" text,
	"upload_error" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "moyasar_invoices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" varchar NOT NULL,
	"order_id" varchar,
	"moyasar_invoice_id" text,
	"status" text DEFAULT 'initiated',
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'SAR',
	"description" text,
	"invoice_url" text,
	"callback_url" text,
	"customer_name" text,
	"customer_phone" text,
	"customer_email" text,
	"expired_at" timestamp,
	"paid_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "moyasar_merchants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" varchar NOT NULL,
	"moyasar_merchant_id" text,
	"moyasar_entity_id" text,
	"merchant_type" text DEFAULT 'establishment' NOT NULL,
	"admin_email" text,
	"email" text,
	"owners_count" integer DEFAULT 1,
	"signatory" text DEFAULT 'owner',
	"signatory_count" integer DEFAULT 1,
	"activity_license_required" boolean DEFAULT false,
	"name" text,
	"public_name" text,
	"country" text DEFAULT 'SA',
	"time_zone" text DEFAULT 'Asia/Riyadh',
	"website" text,
	"statement_descriptor" text,
	"enabled_schemes" text[],
	"payment_methods" text[],
	"fees" jsonb,
	"status" text DEFAULT 'draft',
	"signature_status" text DEFAULT 'unsigned',
	"signature_url" text,
	"rejection_reasons" jsonb,
	"live_public_key" text,
	"live_secret_key" text,
	"test_public_key" text,
	"test_secret_key" text,
	"required_documents" jsonb,
	"uploaded_documents" jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notification_settings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" varchar NOT NULL,
	"branch_id" varchar,
	"new_order_sound" boolean DEFAULT true,
	"new_order_popup" boolean DEFAULT true,
	"order_ready_sound" boolean DEFAULT true,
	"low_stock_alert" boolean DEFAULT true,
	"low_stock_threshold" integer DEFAULT 10,
	"new_reservation_alert" boolean DEFAULT true,
	"reservation_reminder_minutes" integer DEFAULT 30,
	"queue_alert_enabled" boolean DEFAULT true,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" varchar NOT NULL,
	"branch_id" varchar,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"title_ar" text,
	"message" text NOT NULL,
	"message_ar" text,
	"priority" text DEFAULT 'normal',
	"reference_type" text,
	"reference_id" varchar,
	"is_read" boolean DEFAULT false,
	"read_at" timestamp,
	"read_by" varchar,
	"target_role" text,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "order_audit_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" varchar NOT NULL,
	"order_id" varchar NOT NULL,
	"action" text NOT NULL,
	"previous_value" text,
	"new_value" text,
	"field" text,
	"user_id" varchar,
	"user_name" text,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "order_item_customizations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_item_id" varchar NOT NULL,
	"customization_option_id" varchar NOT NULL,
	"price_adjustment" numeric(10, 2) DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" varchar NOT NULL,
	"menu_item_id" varchar NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" varchar NOT NULL,
	"branch_id" varchar,
	"table_id" varchar,
	"customer_id" varchar,
	"order_number" text NOT NULL,
	"order_type" text NOT NULL,
	"status" text DEFAULT 'pending',
	"customer_name" text,
	"customer_phone" text,
	"customer_address" text,
	"notes" text,
	"kitchen_notes" text,
	"subtotal" numeric(10, 2) DEFAULT '0',
	"discount" numeric(10, 2) DEFAULT '0',
	"delivery_fee" numeric(10, 2) DEFAULT '0',
	"tax" numeric(10, 2) DEFAULT '0',
	"total" numeric(10, 2) DEFAULT '0',
	"payment_method" text DEFAULT 'cash',
	"is_paid" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" varchar NOT NULL,
	"order_id" varchar NOT NULL,
	"moyasar_payment_id" text,
	"type" text DEFAULT 'payment' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"amount" integer NOT NULL,
	"currency" text DEFAULT 'SAR',
	"payment_method" text,
	"card_brand" text,
	"card_last4" text,
	"refunded_amount" integer DEFAULT 0,
	"refund_reason" text,
	"metadata" jsonb,
	"webhook_received" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "printers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" varchar NOT NULL,
	"branch_id" varchar,
	"name" text NOT NULL,
	"type" text DEFAULT 'receipt' NOT NULL,
	"connection_type" text DEFAULT 'network' NOT NULL,
	"ip_address" text,
	"port" integer DEFAULT 9100,
	"is_default" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"paper_width" integer DEFAULT 80,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "promotions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" varchar NOT NULL,
	"branch_id" varchar,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"description_en" text,
	"description_ar" text,
	"image" text,
	"discount_type" text DEFAULT 'percentage' NOT NULL,
	"discount_value" numeric(10, 2) NOT NULL,
	"min_order_amount" numeric(10, 2) DEFAULT '0',
	"max_discount_amount" numeric(10, 2),
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"is_active" boolean DEFAULT true,
	"applicable_order_types" text[],
	"applicable_menu_items" text[],
	"applicable_categories" text[],
	"usage_limit" integer,
	"usage_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "queue_counters" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" varchar NOT NULL,
	"branch_id" varchar,
	"date" text NOT NULL,
	"last_number" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "queue_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" varchar NOT NULL,
	"branch_id" varchar,
	"queue_number" integer NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"party_size" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'waiting',
	"estimated_wait_minutes" integer,
	"notified_at" timestamp,
	"seated_at" timestamp,
	"table_id" varchar,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" varchar NOT NULL,
	"menu_item_id" varchar NOT NULL,
	"inventory_item_id" varchar NOT NULL,
	"quantity" numeric(10, 4) NOT NULL,
	"unit" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" varchar NOT NULL,
	"branch_id" varchar,
	"reservation_number" text,
	"table_id" varchar,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"customer_email" text,
	"guest_count" integer NOT NULL,
	"reservation_date" timestamp NOT NULL,
	"reservation_time" text NOT NULL,
	"duration" integer DEFAULT 90,
	"status" text DEFAULT 'pending',
	"special_requests" text,
	"notes" text,
	"source" text DEFAULT 'website',
	"deposit_amount" numeric(10, 2) DEFAULT '20.00',
	"deposit_paid" boolean DEFAULT false,
	"deposit_applied_to_order" varchar,
	"reminder_sent" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "restaurants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_en" text NOT NULL,
	"name_ar" text NOT NULL,
	"description_en" text,
	"description_ar" text,
	"address" text,
	"phone" text,
	"whatsapp" text,
	"email" text,
	"kitchen_type" text,
	"price_range" text,
	"opening_time" text,
	"closing_time" text,
	"working_hours" jsonb,
	"logo" text,
	"banner" text,
	"menu_header_type" text DEFAULT 'logo_banner',
	"menu_theme_color" text DEFAULT 'red',
	"menu_display_style" text DEFAULT 'grid',
	"service_dine_in" boolean DEFAULT true,
	"service_pickup" boolean DEFAULT true,
	"service_delivery" boolean DEFAULT true,
	"service_table_booking" boolean DEFAULT false,
	"service_queue" boolean DEFAULT false,
	"reservation_duration" integer DEFAULT 90,
	"reservation_deposit_amount" numeric(10, 2) DEFAULT '20.00',
	"reservation_deposit_required" boolean DEFAULT true,
	"vat_number" text,
	"commercial_registration" text,
	"postal_code" text,
	"building_number" text,
	"street_name" text,
	"district" text,
	"city" text,
	"country" text DEFAULT 'SA',
	"owner_name" text,
	"owner_phone" text,
	"bank_name" text,
	"bank_account_holder" text,
	"bank_account_number" text,
	"bank_swift" text,
	"bank_iban" text,
	"social_instagram" text,
	"social_twitter" text,
	"social_tiktok" text,
	"social_snapchat" text,
	"social_facebook" text,
	"tax_enabled" boolean DEFAULT true,
	"tax_rate" numeric(5, 2) DEFAULT '15.00',
	"auto_print_invoice" boolean DEFAULT false,
	"moyasar_publishable_key" text,
	"moyasar_secret_key" text,
	"zatca_device_id" text,
	"zatca_environment" text DEFAULT 'sandbox',
	"zatca_certificate" text,
	"zatca_certificate_expiry" timestamp,
	"zatca_secret_key" text,
	"zatca_compliance_csid" text,
	"zatca_production_csid" text,
	"zatca_last_invoice_hash" text DEFAULT 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYmVlYTI3OWI5MDRhNjId',
	"zatca_invoice_counter" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"subscription_start" timestamp,
	"subscription_end" timestamp,
	"subscription_plan" text,
	"subscription_notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" varchar NOT NULL,
	"order_id" varchar,
	"customer_name" text,
	"customer_phone" text,
	"rating" integer NOT NULL,
	"comment" text,
	"is_public" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "tables" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" varchar NOT NULL,
	"branch_id" varchar,
	"table_number" text NOT NULL,
	"capacity" integer NOT NULL,
	"status" text DEFAULT 'available',
	"location" text
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"restaurant_id" varchar NOT NULL,
	"branch_id" varchar,
	"email" text NOT NULL,
	"password" text DEFAULT '' NOT NULL,
	"name" text,
	"phone" text,
	"role" text DEFAULT 'cashier' NOT NULL,
	"is_active" boolean DEFAULT true,
	"perm_dashboard" boolean DEFAULT false,
	"perm_pos" boolean DEFAULT false,
	"perm_orders" boolean DEFAULT false,
	"perm_menu" boolean DEFAULT false,
	"perm_kitchen" boolean DEFAULT false,
	"perm_inventory" boolean DEFAULT false,
	"perm_reviews" boolean DEFAULT false,
	"perm_marketing" boolean DEFAULT false,
	"perm_qr" boolean DEFAULT false,
	"perm_reports" boolean DEFAULT false,
	"perm_settings" boolean DEFAULT false,
	"perm_tables" boolean DEFAULT false,
	"last_login_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "apple_pay_domains" ADD CONSTRAINT "apple_pay_domains_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apple_pay_domains" ADD CONSTRAINT "apple_pay_domains_merchant_id_moyasar_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."moyasar_merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "branches" ADD CONSTRAINT "branches_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_session_id_day_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."day_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_usage" ADD CONSTRAINT "coupon_usage_coupon_id_coupons_id_fk" FOREIGN KEY ("coupon_id") REFERENCES "public"."coupons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupon_usage" ADD CONSTRAINT "coupon_usage_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coupons" ADD CONSTRAINT "coupons_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customization_groups" ADD CONSTRAINT "customization_groups_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customization_options" ADD CONSTRAINT "customization_options_group_id_customization_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."customization_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_sessions" ADD CONSTRAINT "day_sessions_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_sessions" ADD CONSTRAINT "day_sessions_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_sessions" ADD CONSTRAINT "day_sessions_opened_by_users_id_fk" FOREIGN KEY ("opened_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "day_sessions" ADD CONSTRAINT "day_sessions_closed_by_users_id_fk" FOREIGN KEY ("closed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_transactions" ADD CONSTRAINT "inventory_transactions_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_customizations" ADD CONSTRAINT "menu_item_customizations_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_customizations" ADD CONSTRAINT "menu_item_customizations_customization_group_id_customization_groups_id_fk" FOREIGN KEY ("customization_group_id") REFERENCES "public"."customization_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item_variants" ADD CONSTRAINT "menu_item_variants_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moyasar_documents" ADD CONSTRAINT "moyasar_documents_merchant_id_moyasar_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."moyasar_merchants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moyasar_documents" ADD CONSTRAINT "moyasar_documents_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moyasar_invoices" ADD CONSTRAINT "moyasar_invoices_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moyasar_invoices" ADD CONSTRAINT "moyasar_invoices_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moyasar_merchants" ADD CONSTRAINT "moyasar_merchants_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_settings" ADD CONSTRAINT "notification_settings_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_read_by_users_id_fk" FOREIGN KEY ("read_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_audit_log" ADD CONSTRAINT "order_audit_log_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_audit_log" ADD CONSTRAINT "order_audit_log_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_audit_log" ADD CONSTRAINT "order_audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item_customizations" ADD CONSTRAINT "order_item_customizations_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item_customizations" ADD CONSTRAINT "order_item_customizations_customization_option_id_customization_options_id_fk" FOREIGN KEY ("customization_option_id") REFERENCES "public"."customization_options"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "printers" ADD CONSTRAINT "printers_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "printers" ADD CONSTRAINT "printers_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_counters" ADD CONSTRAINT "queue_counters_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_counters" ADD CONSTRAINT "queue_counters_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_entries" ADD CONSTRAINT "queue_entries_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_entries" ADD CONSTRAINT "queue_entries_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_entries" ADD CONSTRAINT "queue_entries_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_menu_item_id_menu_items_id_fk" FOREIGN KEY ("menu_item_id") REFERENCES "public"."menu_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_inventory_item_id_inventory_items_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservations" ADD CONSTRAINT "reservations_table_id_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."tables"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tables" ADD CONSTRAINT "tables_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_restaurant_id_restaurants_id_fk" FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;
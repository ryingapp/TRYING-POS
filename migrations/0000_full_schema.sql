-- ========================================================
-- TryingPOS - Full Database Schema
-- Generated from shared/schema.ts
-- Run this to create a fresh database from scratch
-- ========================================================

-- 1. RESTAURANTS
CREATE TABLE IF NOT EXISTS restaurants (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR UNIQUE,
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  description_en TEXT,
  description_ar TEXT,
  address TEXT,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  kitchen_type TEXT,
  price_range TEXT,
  opening_time TEXT,
  closing_time TEXT,
  working_hours JSONB,
  logo TEXT,
  banner TEXT,
  menu_header_type TEXT DEFAULT 'logo_banner',
  menu_theme_color TEXT DEFAULT 'red',
  menu_display_style TEXT DEFAULT 'grid',
  service_dine_in BOOLEAN DEFAULT true,
  service_pickup BOOLEAN DEFAULT true,
  service_delivery BOOLEAN DEFAULT true,
  service_table_booking BOOLEAN DEFAULT false,
  service_queue BOOLEAN DEFAULT false,
  reservation_duration INTEGER DEFAULT 90,
  reservation_deposit_amount DECIMAL(10,2) DEFAULT 20.00,
  reservation_deposit_required BOOLEAN DEFAULT true,
  vat_number TEXT,
  commercial_registration TEXT,
  commercial_registration_name TEXT,
  short_address TEXT,
  registration_type TEXT DEFAULT 'CRN',
  industry TEXT DEFAULT 'Food',
  invoice_type TEXT DEFAULT '1100',
  postal_code TEXT,
  building_number TEXT,
  street_name TEXT,
  district TEXT,
  city TEXT,
  country TEXT DEFAULT 'SA',
  owner_name TEXT,
  owner_phone TEXT,
  bank_name TEXT,
  bank_account_holder TEXT,
  bank_account_number TEXT,
  bank_swift TEXT,
  bank_iban TEXT,
  zakat_manager_name TEXT,
  zakat_manager_phone TEXT,
  zakat_manager_email TEXT,
  social_instagram TEXT,
  social_twitter TEXT,
  social_tiktok TEXT,
  social_snapchat TEXT,
  social_facebook TEXT,
  tax_enabled BOOLEAN DEFAULT true,
  tax_rate DECIMAL(5,2) DEFAULT 15.00,
  auto_print_invoice BOOLEAN DEFAULT false,
  edfapay_merchant_id TEXT,
  edfapay_password TEXT,
  edfapay_softpos_auth_token TEXT,
  zatca_device_id TEXT,
  zatca_environment TEXT DEFAULT 'sandbox',
  zatca_certificate TEXT,
  zatca_certificate_expiry TIMESTAMP,
  zatca_secret_key TEXT,
  zatca_compliance_csid TEXT,
  zatca_production_csid TEXT,
  zatca_private_key TEXT,
  zatca_last_invoice_hash TEXT DEFAULT 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYmVlYTI3OWI5MDRhNjId',
  zatca_invoice_counter INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  subscription_start TIMESTAMP,
  subscription_end TIMESTAMP,
  subscription_plan TEXT,
  subscription_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. BRANCHES
CREATE TABLE IF NOT EXISTS branches (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR NOT NULL REFERENCES restaurants(id),
  slug VARCHAR,
  name TEXT NOT NULL,
  name_ar TEXT,
  address TEXT,
  phone TEXT,
  opening_time TEXT,
  closing_time TEXT,
  is_main BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  zatca_invoice_counter INTEGER DEFAULT 0,
  zatca_last_invoice_hash TEXT DEFAULT 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYmVlYTI3OWI5MDRhNjId',
  zatca_device_id TEXT,
  zatca_environment TEXT DEFAULT 'sandbox',
  zatca_certificate TEXT,
  zatca_certificate_expiry TIMESTAMP,
  zatca_secret_key TEXT,
  zatca_compliance_csid TEXT,
  zatca_production_csid TEXT,
  zatca_private_key TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. ZATCA DEVICES
CREATE TABLE IF NOT EXISTS zatca_devices (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR NOT NULL REFERENCES restaurants(id),
  branch_id VARCHAR NOT NULL REFERENCES branches(id),
  name TEXT NOT NULL,
  name_ar TEXT,
  serial_number TEXT,
  is_active BOOLEAN DEFAULT true,
  zatca_request_id TEXT,
  zatca_environment TEXT DEFAULT 'sandbox',
  zatca_compliance_csid TEXT,
  zatca_production_csid TEXT,
  zatca_certificate TEXT,
  zatca_certificate_expiry TIMESTAMP,
  zatca_secret_key TEXT,
  zatca_private_key TEXT,
  zatca_invoice_counter INTEGER DEFAULT 0,
  zatca_last_invoice_hash TEXT DEFAULT 'NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYmVlYTI3OWI5MDRhNjId',
  registration_step INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 4. USERS
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR REFERENCES restaurants(id),
  branch_id VARCHAR REFERENCES branches(id),
  email TEXT NOT NULL,
  password TEXT NOT NULL DEFAULT '',
  name TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'cashier',
  is_active BOOLEAN DEFAULT true,
  perm_dashboard BOOLEAN DEFAULT false,
  perm_pos BOOLEAN DEFAULT false,
  perm_orders BOOLEAN DEFAULT false,
  perm_menu BOOLEAN DEFAULT false,
  perm_kitchen BOOLEAN DEFAULT false,
  perm_inventory BOOLEAN DEFAULT false,
  perm_reviews BOOLEAN DEFAULT false,
  perm_marketing BOOLEAN DEFAULT false,
  perm_qr BOOLEAN DEFAULT false,
  perm_reports BOOLEAN DEFAULT false,
  perm_settings BOOLEAN DEFAULT false,
  perm_tables BOOLEAN DEFAULT false,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. KITCHEN SECTIONS
CREATE TABLE IF NOT EXISTS kitchen_sections (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR NOT NULL REFERENCES restaurants(id),
  branch_id VARCHAR REFERENCES branches(id),
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  icon TEXT,
  color TEXT DEFAULT '#8B1A1A',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 6. CATEGORIES
CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR NOT NULL REFERENCES restaurants(id),
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  parent_id VARCHAR,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

-- 7. MENU ITEMS
CREATE TABLE IF NOT EXISTS menu_items (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR NOT NULL REFERENCES restaurants(id),
  category_id VARCHAR NOT NULL REFERENCES categories(id),
  kitchen_section_id VARCHAR REFERENCES kitchen_sections(id),
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  description_en TEXT,
  description_ar TEXT,
  price DECIMAL(10,2) NOT NULL,
  image TEXT,
  is_available BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  prep_time INTEGER,
  calories INTEGER,
  sugar DECIMAL(6,2),
  fat DECIMAL(6,2),
  saturated_fat DECIMAL(6,2),
  sodium DECIMAL(8,2),
  protein DECIMAL(6,2),
  carbs DECIMAL(6,2),
  fiber DECIMAL(6,2),
  caffeine DECIMAL(6,2),
  allergens JSONB DEFAULT '[]',
  is_high_sodium BOOLEAN DEFAULT false,
  is_spicy BOOLEAN DEFAULT false,
  is_vegetarian BOOLEAN DEFAULT false,
  is_vegan BOOLEAN DEFAULT false,
  is_gluten_free BOOLEAN DEFAULT false,
  is_new BOOLEAN DEFAULT false,
  is_bestseller BOOLEAN DEFAULT false,
  walking_minutes INTEGER,
  running_minutes INTEGER
);

-- 8. TABLES
CREATE TABLE IF NOT EXISTS tables (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR NOT NULL REFERENCES restaurants(id),
  branch_id VARCHAR REFERENCES branches(id),
  table_number TEXT NOT NULL,
  capacity INTEGER NOT NULL,
  status TEXT DEFAULT 'available',
  location TEXT
);

-- 9. CUSTOMERS
CREATE TABLE IF NOT EXISTS customers (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR NOT NULL REFERENCES restaurants(id),
  name TEXT,
  name_ar TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  notes TEXT,
  total_orders INTEGER DEFAULT 0,
  total_spent DECIMAL(10,2) DEFAULT 0,
  last_order_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 10. ORDERS
CREATE TABLE IF NOT EXISTS orders (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR NOT NULL REFERENCES restaurants(id),
  branch_id VARCHAR REFERENCES branches(id),
  table_id VARCHAR REFERENCES tables(id),
  customer_id VARCHAR REFERENCES customers(id),
  order_number TEXT NOT NULL,
  order_type TEXT NOT NULL,
  status TEXT DEFAULT 'created',
  ready_at_time TIMESTAMP,
  customer_name TEXT,
  customer_phone TEXT,
  customer_address TEXT,
  notes TEXT,
  kitchen_notes TEXT,
  subtotal DECIMAL(10,2) DEFAULT 0,
  discount DECIMAL(10,2) DEFAULT 0,
  delivery_fee DECIMAL(10,2) DEFAULT 0,
  tax DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
  payment_method TEXT DEFAULT 'cash',
  is_paid BOOLEAN DEFAULT false,
  day_session_id VARCHAR,
  day_session_date VARCHAR,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 11. ORDER ITEMS
CREATE TABLE IF NOT EXISTS order_items (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id VARCHAR NOT NULL REFERENCES orders(id),
  menu_item_id VARCHAR REFERENCES menu_items(id),
  item_name TEXT,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  notes TEXT
);

-- 12. INVENTORY ITEMS
CREATE TABLE IF NOT EXISTS inventory_items (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR NOT NULL REFERENCES restaurants(id),
  branch_id VARCHAR REFERENCES branches(id),
  name TEXT NOT NULL,
  name_ar TEXT,
  unit TEXT NOT NULL,
  current_stock DECIMAL(10,2) DEFAULT 0,
  min_stock DECIMAL(10,2) DEFAULT 0,
  cost_per_unit DECIMAL(10,2) DEFAULT 0,
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 13. RECIPES
CREATE TABLE IF NOT EXISTS recipes (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR NOT NULL REFERENCES restaurants(id),
  menu_item_id VARCHAR NOT NULL REFERENCES menu_items(id),
  inventory_item_id VARCHAR NOT NULL REFERENCES inventory_items(id),
  quantity DECIMAL(10,4) NOT NULL,
  unit TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 14. INVENTORY TRANSACTIONS
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  inventory_item_id VARCHAR NOT NULL REFERENCES inventory_items(id),
  branch_id VARCHAR REFERENCES branches(id),
  type TEXT NOT NULL,
  quantity DECIMAL(10,2) NOT NULL,
  unit_cost DECIMAL(10,2),
  total_cost DECIMAL(10,2),
  notes TEXT,
  reference_id VARCHAR,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 15. PRINTERS
CREATE TABLE IF NOT EXISTS printers (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR NOT NULL REFERENCES restaurants(id),
  branch_id VARCHAR REFERENCES branches(id),
  kitchen_section_id VARCHAR REFERENCES kitchen_sections(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'receipt',
  connection_type TEXT NOT NULL DEFAULT 'network',
  ip_address TEXT,
  port INTEGER DEFAULT 9100,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  paper_width INTEGER DEFAULT 80,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 16. EDFAPAY MERCHANTS
CREATE TABLE IF NOT EXISTS edfapay_merchants (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR NOT NULL REFERENCES restaurants(id),
  edfapay_merchant_id TEXT,
  edfapay_password TEXT,
  name TEXT,
  public_name TEXT,
  email TEXT,
  status TEXT DEFAULT 'active',
  payment_methods TEXT[],
  notification_url TEXT,
  is_live BOOLEAN DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 17. INVOICES
CREATE TABLE IF NOT EXISTS invoices (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR NOT NULL REFERENCES restaurants(id),
  branch_id VARCHAR REFERENCES branches(id),
  order_id VARCHAR NOT NULL REFERENCES orders(id),
  invoice_number TEXT NOT NULL,
  invoice_type TEXT DEFAULT 'standard',
  status TEXT DEFAULT 'issued',
  subtotal DECIMAL(10,2) NOT NULL,
  tax_amount DECIMAL(10,2) NOT NULL,
  tax_rate DECIMAL(5,2) DEFAULT 15.00,
  discount DECIMAL(10,2) DEFAULT 0,
  delivery_fee DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  customer_vat_number TEXT,
  payment_method TEXT,
  is_paid BOOLEAN DEFAULT false,
  qr_code_data TEXT,
  xml_content TEXT,
  zatca_status TEXT DEFAULT 'pending',
  zatca_submission_id TEXT,
  zatca_warnings TEXT,
  zatca_errors TEXT,
  related_invoice_id VARCHAR,
  invoice_counter INTEGER,
  invoice_hash TEXT,
  previous_invoice_hash TEXT,
  uuid TEXT,
  csid_token TEXT,
  signed_xml TEXT,
  cashier_name TEXT,
  refund_reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  issued_at TIMESTAMP DEFAULT NOW()
);

-- 18. INVOICE AUDIT LOG
CREATE TABLE IF NOT EXISTS invoice_audit_log (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR NOT NULL REFERENCES restaurants(id),
  invoice_id VARCHAR REFERENCES invoices(id),
  action TEXT NOT NULL,
  user_id VARCHAR REFERENCES users(id),
  user_name TEXT,
  details TEXT,
  ip_address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 19. PAYMENT TRANSACTIONS
CREATE TABLE IF NOT EXISTS payment_transactions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR NOT NULL REFERENCES restaurants(id),
  order_id VARCHAR NOT NULL REFERENCES orders(id),
  edfapay_transaction_id TEXT,
  edfapay_gway_id TEXT,
  type TEXT NOT NULL DEFAULT 'payment',
  status TEXT NOT NULL DEFAULT 'pending',
  amount INTEGER NOT NULL,
  currency TEXT DEFAULT 'SAR',
  payment_method TEXT,
  card_brand TEXT,
  card_last4 TEXT,
  refunded_amount INTEGER DEFAULT 0,
  refund_reason TEXT,
  metadata JSONB,
  webhook_received BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 20. EDFAPAY INVOICES
CREATE TABLE IF NOT EXISTS edfapay_invoices (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR NOT NULL REFERENCES restaurants(id),
  order_id VARCHAR REFERENCES orders(id),
  edfapay_transaction_id TEXT,
  edfapay_gway_id TEXT,
  status TEXT DEFAULT 'initiated',
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'SAR',
  description TEXT,
  callback_url TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 21. RESERVATIONS
CREATE TABLE IF NOT EXISTS reservations (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR NOT NULL REFERENCES restaurants(id),
  branch_id VARCHAR REFERENCES branches(id),
  reservation_number TEXT,
  table_id VARCHAR REFERENCES tables(id),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  guest_count INTEGER NOT NULL,
  reservation_date TIMESTAMP NOT NULL,
  reservation_time TEXT NOT NULL,
  duration INTEGER DEFAULT 90,
  status TEXT DEFAULT 'pending',
  special_requests TEXT,
  notes TEXT,
  source TEXT DEFAULT 'website',
  deposit_amount DECIMAL(10,2) DEFAULT 20.00,
  deposit_paid BOOLEAN DEFAULT false,
  deposit_code TEXT,
  deposit_applied_to_order VARCHAR,
  reminder_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 22. PROMOTIONS
CREATE TABLE IF NOT EXISTS promotions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR NOT NULL REFERENCES restaurants(id),
  branch_id VARCHAR REFERENCES branches(id),
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  description_en TEXT,
  description_ar TEXT,
  image TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percentage',
  discount_value DECIMAL(10,2) NOT NULL,
  min_order_amount DECIMAL(10,2) DEFAULT 0,
  max_discount_amount DECIMAL(10,2),
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT true,
  applicable_order_types TEXT[],
  applicable_menu_items TEXT[],
  applicable_categories TEXT[],
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 23. COUPONS
CREATE TABLE IF NOT EXISTS coupons (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR NOT NULL REFERENCES restaurants(id),
  code TEXT NOT NULL,
  name_en TEXT,
  name_ar TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percentage',
  discount_value DECIMAL(10,2) NOT NULL,
  min_order_amount DECIMAL(10,2) DEFAULT 0,
  max_discount_amount DECIMAL(10,2),
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  usage_limit INTEGER,
  usage_per_customer INTEGER DEFAULT 1,
  usage_count INTEGER DEFAULT 0,
  applicable_order_types TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 24. COUPON USAGE
CREATE TABLE IF NOT EXISTS coupon_usage (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id VARCHAR NOT NULL REFERENCES coupons(id),
  order_id VARCHAR NOT NULL REFERENCES orders(id),
  customer_phone TEXT,
  discount_amount DECIMAL(10,2) NOT NULL,
  used_at TIMESTAMP DEFAULT NOW()
);

-- 25. REVIEWS
CREATE TABLE IF NOT EXISTS reviews (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR NOT NULL REFERENCES restaurants(id),
  order_id VARCHAR REFERENCES orders(id),
  customer_name TEXT,
  customer_phone TEXT,
  rating INTEGER NOT NULL,
  comment TEXT,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 26. MENU ITEM VARIANTS
CREATE TABLE IF NOT EXISTS menu_item_variants (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id VARCHAR NOT NULL REFERENCES menu_items(id),
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  price_adjustment DECIMAL(10,2) DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  is_available BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0
);

-- 27. CUSTOMIZATION GROUPS
CREATE TABLE IF NOT EXISTS customization_groups (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR NOT NULL REFERENCES restaurants(id),
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  selection_type TEXT NOT NULL DEFAULT 'single',
  min_selections INTEGER DEFAULT 0,
  max_selections INTEGER DEFAULT 1,
  is_required BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0
);

-- 28. CUSTOMIZATION OPTIONS
CREATE TABLE IF NOT EXISTS customization_options (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id VARCHAR NOT NULL REFERENCES customization_groups(id),
  name_en TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  price_adjustment DECIMAL(10,2) DEFAULT 0,
  is_default BOOLEAN DEFAULT false,
  is_available BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0
);

-- 29. MENU ITEM CUSTOMIZATIONS (link)
CREATE TABLE IF NOT EXISTS menu_item_customizations (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id VARCHAR NOT NULL REFERENCES menu_items(id),
  customization_group_id VARCHAR NOT NULL REFERENCES customization_groups(id),
  sort_order INTEGER DEFAULT 0
);

-- 30. ORDER ITEM CUSTOMIZATIONS
CREATE TABLE IF NOT EXISTS order_item_customizations (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id VARCHAR NOT NULL REFERENCES order_items(id),
  customization_option_id VARCHAR NOT NULL REFERENCES customization_options(id),
  price_adjustment DECIMAL(10,2) DEFAULT 0
);

-- 31. QUEUE ENTRIES
CREATE TABLE IF NOT EXISTS queue_entries (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR NOT NULL REFERENCES restaurants(id),
  branch_id VARCHAR REFERENCES branches(id),
  queue_number INTEGER NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  party_size INTEGER NOT NULL DEFAULT 1,
  status TEXT DEFAULT 'waiting',
  estimated_wait_minutes INTEGER,
  notified_at TIMESTAMP,
  seated_at TIMESTAMP,
  table_id VARCHAR REFERENCES tables(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 32. QUEUE COUNTERS
CREATE TABLE IF NOT EXISTS queue_counters (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR NOT NULL REFERENCES restaurants(id),
  branch_id VARCHAR REFERENCES branches(id),
  date TEXT NOT NULL,
  last_number INTEGER DEFAULT 0
);

-- 33. DAY SESSIONS
CREATE TABLE IF NOT EXISTS day_sessions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR NOT NULL REFERENCES restaurants(id),
  branch_id VARCHAR REFERENCES branches(id),
  date TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  opened_by VARCHAR REFERENCES users(id),
  closed_by VARCHAR REFERENCES users(id),
  opened_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP,
  opening_balance DECIMAL(10,2) DEFAULT 0,
  closing_balance DECIMAL(10,2),
  expected_balance DECIMAL(10,2),
  difference DECIMAL(10,2),
  total_sales DECIMAL(10,2) DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  cash_sales DECIMAL(10,2) DEFAULT 0,
  card_sales DECIMAL(10,2) DEFAULT 0,
  notes TEXT
);

-- 34. CASH TRANSACTIONS
CREATE TABLE IF NOT EXISTS cash_transactions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR NOT NULL REFERENCES restaurants(id),
  branch_id VARCHAR REFERENCES branches(id),
  session_id VARCHAR REFERENCES day_sessions(id),
  type TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  reason TEXT,
  performed_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 35. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR NOT NULL REFERENCES restaurants(id),
  branch_id VARCHAR REFERENCES branches(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  title_ar TEXT,
  message TEXT NOT NULL,
  message_ar TEXT,
  priority TEXT DEFAULT 'normal',
  reference_type TEXT,
  reference_id VARCHAR,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  read_by VARCHAR REFERENCES users(id),
  target_role TEXT,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 36. ORDER AUDIT LOG
CREATE TABLE IF NOT EXISTS order_audit_log (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR NOT NULL REFERENCES restaurants(id),
  order_id VARCHAR NOT NULL REFERENCES orders(id),
  action TEXT NOT NULL,
  previous_value TEXT,
  new_value TEXT,
  field TEXT,
  user_id VARCHAR REFERENCES users(id),
  user_name TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 37. NOTIFICATION SETTINGS
CREATE TABLE IF NOT EXISTS notification_settings (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR NOT NULL REFERENCES restaurants(id),
  branch_id VARCHAR REFERENCES branches(id),
  new_order_sound BOOLEAN DEFAULT true,
  new_order_popup BOOLEAN DEFAULT true,
  order_ready_sound BOOLEAN DEFAULT true,
  low_stock_alert BOOLEAN DEFAULT true,
  low_stock_threshold INTEGER DEFAULT 10,
  new_reservation_alert BOOLEAN DEFAULT true,
  reservation_reminder_minutes INTEGER DEFAULT 30,
  queue_alert_enabled BOOLEAN DEFAULT true,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 38. DELIVERY INTEGRATIONS
CREATE TABLE IF NOT EXISTS delivery_integrations (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR NOT NULL REFERENCES restaurants(id),
  branch_id VARCHAR REFERENCES branches(id),
  platform TEXT NOT NULL,
  chain_id TEXT,
  vendor_id TEXT,
  client_id TEXT,
  client_secret TEXT,
  webhook_secret TEXT,
  access_token TEXT,
  token_expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT false,
  auto_accept BOOLEAN DEFAULT false,
  outlet_status TEXT DEFAULT 'closed',
  last_sync_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 39. DELIVERY ORDERS
CREATE TABLE IF NOT EXISTS delivery_orders (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR NOT NULL REFERENCES restaurants(id),
  branch_id VARCHAR REFERENCES branches(id),
  order_id VARCHAR REFERENCES orders(id),
  integration_id VARCHAR NOT NULL REFERENCES delivery_integrations(id),
  platform TEXT NOT NULL,
  external_order_id TEXT NOT NULL,
  order_code TEXT,
  platform_status TEXT NOT NULL DEFAULT 'new',
  transport_type TEXT,
  raw_payload JSONB,
  customer_name TEXT,
  customer_phone TEXT,
  delivery_address TEXT,
  delivery_lat TEXT,
  delivery_lng TEXT,
  subtotal DECIMAL(10,2) DEFAULT 0,
  delivery_fee DECIMAL(10,2) DEFAULT 0,
  discount DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
  items JSONB,
  estimated_delivery_time TIMESTAMP,
  accepted_at TIMESTAMP,
  ready_at TIMESTAMP,
  picked_up_at TIMESTAMP,
  delivered_at TIMESTAMP,
  cancelled_at TIMESTAMP,
  cancel_reason TEXT,
  driver_name TEXT,
  driver_phone TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

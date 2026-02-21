import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Restaurant table - main tenant entity
export const restaurants = pgTable("restaurants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  slug: varchar("slug").unique(), // URL-friendly name, e.g. "al-majlis"
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  descriptionEn: text("description_en"),
  descriptionAr: text("description_ar"),
  address: text("address"),
  phone: text("phone"),
  whatsapp: text("whatsapp"),
  email: text("email"),
  kitchenType: text("kitchen_type"),
  priceRange: text("price_range"),
  openingTime: text("opening_time"),
  closingTime: text("closing_time"),
  workingHours: jsonb("working_hours").$type<Record<string, { open: string; close: string }>>(),
  logo: text("logo"),
  banner: text("banner"),
  // Menu display settings
  menuHeaderType: text("menu_header_type").default("logo_banner"), // logo, banner, logo_banner
  menuThemeColor: text("menu_theme_color").default("red"), // red, blue, purple, green
  menuDisplayStyle: text("menu_display_style").default("grid"), // grid, list
  // Services
  serviceDineIn: boolean("service_dine_in").default(true),
  servicePickup: boolean("service_pickup").default(true),
  serviceDelivery: boolean("service_delivery").default(true),
  serviceTableBooking: boolean("service_table_booking").default(false),
  serviceQueue: boolean("service_queue").default(false),
  // Reservation settings
  reservationDuration: integer("reservation_duration").default(90), // minutes
  reservationDepositAmount: decimal("reservation_deposit_amount", { precision: 10, scale: 2 }).default("20.00"),
  reservationDepositRequired: boolean("reservation_deposit_required").default(true),
  // ZATCA/Tax fields
  vatNumber: text("vat_number"),
  commercialRegistration: text("commercial_registration"),
  postalCode: text("postal_code"),
  buildingNumber: text("building_number"),
  streetName: text("street_name"),
  district: text("district"),
  city: text("city"),
  country: text("country").default("SA"),
  ownerName: text("owner_name"),
  ownerPhone: text("owner_phone"),
  bankName: text("bank_name"),
  bankAccountHolder: text("bank_account_holder"),
  bankAccountNumber: text("bank_account_number"),
  bankSwift: text("bank_swift"),
  bankIban: text("bank_iban"),
  // Social media links
  socialInstagram: text("social_instagram"),
  socialTwitter: text("social_twitter"),
  socialTiktok: text("social_tiktok"),
  socialSnapchat: text("social_snapchat"),
  socialFacebook: text("social_facebook"),
  taxEnabled: boolean("tax_enabled").default(true),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default("15.00"),
  autoPrintInvoice: boolean("auto_print_invoice").default(false),
  // ZATCA device registration
  moyasarPublishableKey: text("moyasar_publishable_key"),
  moyasarSecretKey: text("moyasar_secret_key"),
  zatcaDeviceId: text("zatca_device_id"),
  zatcaEnvironment: text("zatca_environment").default("sandbox"), // sandbox, production
  zatcaCertificate: text("zatca_certificate"),
  zatcaCertificateExpiry: timestamp("zatca_certificate_expiry"),
  zatcaSecretKey: text("zatca_secret_key"),
  zatcaComplianceCsid: text("zatca_compliance_csid"),
  zatcaProductionCsid: text("zatca_production_csid"),
  zatcaLastInvoiceHash: text("zatca_last_invoice_hash").default("NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYmVlYTI3OWI5MDRhNjId"),
  zatcaInvoiceCounter: integer("zatca_invoice_counter").default(0),
  isActive: boolean("is_active").default(true),
  subscriptionStart: timestamp("subscription_start"),
  subscriptionEnd: timestamp("subscription_end"),
  subscriptionPlan: text("subscription_plan"),
  subscriptionNotes: text("subscription_notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Restaurant branches
export const branches = pgTable("branches", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").references(() => restaurants.id).notNull(),
  slug: varchar("slug"), // URL-friendly branch name, e.g. "riyadh-main"
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  address: text("address"),
  phone: text("phone"),
  openingTime: text("opening_time"),
  closingTime: text("closing_time"),
  isMain: boolean("is_main").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Users and roles
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").references(() => restaurants.id).notNull(),
  branchId: varchar("branch_id").references(() => branches.id),
  email: text("email").notNull(),
  password: text("password").notNull().default(""),
  name: text("name"),
  phone: text("phone"),
  role: text("role").notNull().default("cashier"), // owner, branch_manager, cashier, kitchen, accountant
  isActive: boolean("is_active").default(true),
  // Permissions
  permDashboard: boolean("perm_dashboard").default(false),
  permPos: boolean("perm_pos").default(false),
  permOrders: boolean("perm_orders").default(false),
  permMenu: boolean("perm_menu").default(false),
  permKitchen: boolean("perm_kitchen").default(false),
  permInventory: boolean("perm_inventory").default(false),
  permReviews: boolean("perm_reviews").default(false),
  permMarketing: boolean("perm_marketing").default(false),
  permQr: boolean("perm_qr").default(false),
  permReports: boolean("perm_reports").default(false),
  permSettings: boolean("perm_settings").default(false),
  permTables: boolean("perm_tables").default(false),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Menu categories
export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").references(() => restaurants.id).notNull(),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  parentId: varchar("parent_id"),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
});

// Allergen types for menu items
export const allergenTypes = ["nuts", "gluten", "dairy", "eggs", "soy", "fish", "shellfish", "sesame", "wheat"] as const;

// Menu items
export const menuItems = pgTable("menu_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").references(() => restaurants.id).notNull(),
  categoryId: varchar("category_id").references(() => categories.id).notNull(),
  kitchenSectionId: varchar("kitchen_section_id").references(() => kitchenSections.id),
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  descriptionEn: text("description_en"),
  descriptionAr: text("description_ar"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  image: text("image"),
  isAvailable: boolean("is_available").default(true),
  sortOrder: integer("sort_order").default(0),
  prepTime: integer("prep_time"),
  // Nutritional Information (SFDA Compliance)
  calories: integer("calories"), // السعرات الحرارية
  sugar: decimal("sugar", { precision: 6, scale: 2 }), // السكر بالجرام
  fat: decimal("fat", { precision: 6, scale: 2 }), // الدهون بالجرام
  saturatedFat: decimal("saturated_fat", { precision: 6, scale: 2 }), // الدهون المشبعة
  sodium: decimal("sodium", { precision: 8, scale: 2 }), // الصوديوم بالملجم
  protein: decimal("protein", { precision: 6, scale: 2 }), // البروتين بالجرام
  carbs: decimal("carbs", { precision: 6, scale: 2 }), // الكربوهيدرات بالجرام
  fiber: decimal("fiber", { precision: 6, scale: 2 }), // الألياف بالجرام
  caffeine: decimal("caffeine", { precision: 6, scale: 2 }), // الكافيين بالملجم
  // Allergens & Labels
  allergens: jsonb("allergens").$type<string[]>().default([]), // مسببات الحساسية
  isHighSodium: boolean("is_high_sodium").default(false), // وسم الملّاحة
  isSpicy: boolean("is_spicy").default(false), // حار
  isVegetarian: boolean("is_vegetarian").default(false), // نباتي
  isVegan: boolean("is_vegan").default(false), // نباتي صرف
  isGlutenFree: boolean("is_gluten_free").default(false), // خالي من الجلوتين
  isNew: boolean("is_new").default(false), // جديد
  isBestseller: boolean("is_bestseller").default(false), // الأكثر مبيعاً
  // Burn time (walking minutes to burn calories)
  walkingMinutes: integer("walking_minutes"), // دقائق المشي لحرق السعرات
  runningMinutes: integer("running_minutes"), // دقائق الجري لحرق السعرات
});

// Tables
export const tables = pgTable("tables", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").references(() => restaurants.id).notNull(),
  branchId: varchar("branch_id").references(() => branches.id),
  tableNumber: text("table_number").notNull(),
  capacity: integer("capacity").notNull(),
  status: text("status").default("available"),
  location: text("location"),
});

// Customers
export const customers = pgTable("customers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").references(() => restaurants.id).notNull(),
  name: text("name"),
  nameAr: text("name_ar"),
  phone: text("phone").notNull(),
  email: text("email"),
  address: text("address"),
  notes: text("notes"),
  totalOrders: integer("total_orders").default(0),
  totalSpent: decimal("total_spent", { precision: 10, scale: 2 }).default("0"),
  lastOrderAt: timestamp("last_order_at"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Orders
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").references(() => restaurants.id).notNull(),
  branchId: varchar("branch_id").references(() => branches.id),
  tableId: varchar("table_id").references(() => tables.id),
  customerId: varchar("customer_id").references(() => customers.id),
  orderNumber: text("order_number").notNull(),
  orderType: text("order_type").notNull(),
  status: text("status").default("pending"),
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  customerAddress: text("customer_address"),
  notes: text("notes"),
  kitchenNotes: text("kitchen_notes"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).default("0"),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0"),
  deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 }).default("0"),
  tax: decimal("tax", { precision: 10, scale: 2 }).default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).default("0"),
  paymentMethod: text("payment_method").default("cash"),
  isPaid: boolean("is_paid").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Order items
export const orderItems = pgTable("order_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderId: varchar("order_id").references(() => orders.id).notNull(),
  menuItemId: varchar("menu_item_id").references(() => menuItems.id).notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: decimal("total_price", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
});

// Recipes - linking menu items to inventory (ingredients)
export const recipes = pgTable("recipes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").references(() => restaurants.id).notNull(),
  menuItemId: varchar("menu_item_id").references(() => menuItems.id).notNull(),
  inventoryItemId: varchar("inventory_item_id").references(() => inventoryItems.id).notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 4 }).notNull(), // amount of ingredient needed
  unit: text("unit").notNull(), // unit for this recipe ingredient
  createdAt: timestamp("created_at").defaultNow(),
});

// Printers
export const printers = pgTable("printers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").references(() => restaurants.id).notNull(),
  branchId: varchar("branch_id").references(() => branches.id),
  kitchenSectionId: varchar("kitchen_section_id").references(() => kitchenSections.id), // null = all sections
  name: text("name").notNull(),
  type: text("type").notNull().default("receipt"), // receipt, kitchen, label
  connectionType: text("connection_type").notNull().default("network"), // network, usb, bluetooth
  ipAddress: text("ip_address"),
  port: integer("port").default(9100),
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),
  paperWidth: integer("paper_width").default(80), // 58mm or 80mm
  createdAt: timestamp("created_at").defaultNow(),
});

// Inventory items (raw materials/ingredients)
export const inventoryItems = pgTable("inventory_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").references(() => restaurants.id).notNull(),
  branchId: varchar("branch_id").references(() => branches.id),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  unit: text("unit").notNull(), // kg, g, liter, piece, box
  currentStock: decimal("current_stock", { precision: 10, scale: 2 }).default("0"),
  minStock: decimal("min_stock", { precision: 10, scale: 2 }).default("0"),
  costPerUnit: decimal("cost_per_unit", { precision: 10, scale: 2 }).default("0"),
  category: text("category"), // vegetables, meat, dairy, spices, etc
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Inventory transactions (stock in/out)
export const inventoryTransactions = pgTable("inventory_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  inventoryItemId: varchar("inventory_item_id").references(() => inventoryItems.id).notNull(),
  branchId: varchar("branch_id").references(() => branches.id),
  type: text("type").notNull(), // purchase, usage, adjustment, transfer, waste
  quantity: decimal("quantity", { precision: 10, scale: 2 }).notNull(),
  unitCost: decimal("unit_cost", { precision: 10, scale: 2 }),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }),
  notes: text("notes"),
  referenceId: varchar("reference_id"), // order ID or purchase order ID
  createdAt: timestamp("created_at").defaultNow(),
});

// Moyasar Merchants - for payment gateway onboarding per restaurant
export const moyasarMerchants = pgTable("moyasar_merchants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").references(() => restaurants.id).notNull(),
  moyasarMerchantId: text("moyasar_merchant_id"),
  moyasarEntityId: text("moyasar_entity_id"),
  merchantType: text("merchant_type").notNull().default("establishment"),
  adminEmail: text("admin_email"),
  email: text("email"),
  ownersCount: integer("owners_count").default(1),
  signatory: text("signatory").default("owner"),
  signatoryCount: integer("signatory_count").default(1),
  activityLicenseRequired: boolean("activity_license_required").default(false),
  name: text("name"),
  publicName: text("public_name"),
  country: text("country").default("SA"),
  timeZone: text("time_zone").default("Asia/Riyadh"),
  website: text("website"),
  statementDescriptor: text("statement_descriptor"),
  enabledSchemes: text("enabled_schemes").array(),
  paymentMethods: text("payment_methods").array(),
  fees: jsonb("fees").$type<{
    tax_inclusive: boolean;
    mada_charge_rate: number;
    mada_charge_fixed: number;
    mada_refund_rate: number;
    mada_refund_fixed: number;
    cc_charge_rate: number;
    cc_charge_fixed: number;
    cc_refund_rate: number;
    cc_refund_fixed: number;
  }>(),
  status: text("status").default("draft"),
  signatureStatus: text("signature_status").default("unsigned"),
  signatureUrl: text("signature_url"),
  rejectionReasons: jsonb("rejection_reasons").$type<string[]>(),
  livePublicKey: text("live_public_key"),
  liveSecretKey: text("live_secret_key"),
  testPublicKey: text("test_public_key"),
  testSecretKey: text("test_secret_key"),
  requiredDocuments: jsonb("required_documents").$type<string[]>(),
  uploadedDocuments: jsonb("uploaded_documents").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Moyasar merchant documents
export const moyasarDocuments = pgTable("moyasar_documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  merchantId: varchar("merchant_id").references(() => moyasarMerchants.id).notNull(),
  restaurantId: varchar("restaurant_id").references(() => restaurants.id).notNull(),
  // Document type
  documentType: text("document_type").notNull(), // owner_id, signatory_id, bank_iban_certificate, commercial_registration, etc.
  // Document info fields (varies by type)
  documentInfo: jsonb("document_info").$type<{
    id?: string; // National ID number
    date_of_birth?: string;
    mobile?: string;
    holder?: string;
    iban?: string;
    number?: string;
    expiry_date?: string;
    name?: string;
    street?: string;
    district?: string;
    building_number?: string;
    secondary_number?: string;
    postal_code?: string;
    city?: string;
    country?: string;
  }>(),
  // File data (base64)
  fileData: text("file_data"),
  fileName: text("file_name"),
  fileMimeType: text("file_mime_type"),
  // Upload status
  isUploaded: boolean("is_uploaded").default(false),
  moyasarDocumentId: text("moyasar_document_id"), // ID from Moyasar after upload
  uploadError: text("upload_error"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Invoices for ZATCA compliance
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").references(() => restaurants.id).notNull(),
  orderId: varchar("order_id").references(() => orders.id).notNull(),
  invoiceNumber: text("invoice_number").notNull(),
  invoiceType: text("invoice_type").default("standard"),
  status: text("status").default("issued"),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }).notNull(),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).default("15.00"),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0"),
  deliveryFee: decimal("delivery_fee", { precision: 10, scale: 2 }).default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  customerVatNumber: text("customer_vat_number"),
  paymentMethod: text("payment_method"),
  isPaid: boolean("is_paid").default(false),
  qrCodeData: text("qr_code_data"),
  xmlContent: text("xml_content"),
  zatcaStatus: text("zatca_status").default("pending"),
  zatcaSubmissionId: text("zatca_submission_id"),
  zatcaWarnings: text("zatca_warnings"),
  zatcaErrors: text("zatca_errors"),
  relatedInvoiceId: varchar("related_invoice_id"),
  // ZATCA Phase 2 fields
  invoiceCounter: integer("invoice_counter"),
  invoiceHash: text("invoice_hash"),
  previousInvoiceHash: text("previous_invoice_hash"),
  uuid: text("uuid"),
  csidToken: text("csid_token"),
  signedXml: text("signed_xml"),
  createdAt: timestamp("created_at").defaultNow(),
  issuedAt: timestamp("issued_at").defaultNow(),
});

// ===============================
// PAYMENT TRANSACTIONS - سجل المعاملات المالية
// ===============================
export const paymentTransactions = pgTable("payment_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").references(() => restaurants.id).notNull(),
  orderId: varchar("order_id").references(() => orders.id).notNull(),
  moyasarPaymentId: text("moyasar_payment_id"),
  type: text("type").notNull().default("payment"), // payment, refund
  status: text("status").notNull().default("pending"), // pending, paid, failed, refunded
  amount: integer("amount").notNull(), // in halalas (smallest unit)
  currency: text("currency").default("SAR"),
  paymentMethod: text("payment_method"), // creditcard, applepay, stcpay, mada
  cardBrand: text("card_brand"), // visa, mastercard, mada
  cardLast4: text("card_last4"),
  refundedAmount: integer("refunded_amount").default(0),
  refundReason: text("refund_reason"),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  webhookReceived: boolean("webhook_received").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ===============================
// MOYASAR INVOICES - فواتير مؤسر (روابط دفع)
// ===============================
export const moyasarInvoices = pgTable("moyasar_invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").references(() => restaurants.id).notNull(),
  orderId: varchar("order_id").references(() => orders.id),
  moyasarInvoiceId: text("moyasar_invoice_id"),
  status: text("status").default("initiated"), // initiated, paid, expired
  amount: integer("amount").notNull(), // in halalas
  currency: text("currency").default("SAR"),
  description: text("description"),
  invoiceUrl: text("invoice_url"),
  callbackUrl: text("callback_url"),
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  customerEmail: text("customer_email"),
  expiredAt: timestamp("expired_at"),
  paidAt: timestamp("paid_at"),
  metadata: jsonb("metadata").$type<Record<string, any>>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ===============================
// APPLE PAY DOMAINS
// ===============================
export const applePayDomains = pgTable("apple_pay_domains", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").references(() => restaurants.id).notNull(),
  merchantId: varchar("merchant_id").references(() => moyasarMerchants.id).notNull(),
  moyasarDomainId: text("moyasar_domain_id"),
  host: text("host").notNull(),
  status: text("status").default("initiated"), // initiated, validated, registered
  createdAt: timestamp("created_at").defaultNow(),
});

// ===============================
// 1. RESERVATIONS - نظام الحجوزات
// ===============================
export const reservations = pgTable("reservations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").references(() => restaurants.id).notNull(),
  branchId: varchar("branch_id").references(() => branches.id),
  reservationNumber: text("reservation_number"),
  tableId: varchar("table_id").references(() => tables.id),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  customerEmail: text("customer_email"),
  guestCount: integer("guest_count").notNull(),
  reservationDate: timestamp("reservation_date").notNull(),
  reservationTime: text("reservation_time").notNull(), // "14:00"
  duration: integer("duration").default(90), // minutes
  status: text("status").default("pending"), // pending, confirmed, seated, completed, cancelled, no_show
  specialRequests: text("special_requests"),
  notes: text("notes"),
  source: text("source").default("website"), // website, phone, walk_in, app
  depositAmount: decimal("deposit_amount", { precision: 10, scale: 2 }).default("20.00"),
  depositPaid: boolean("deposit_paid").default(false),
  depositAppliedToOrder: varchar("deposit_applied_to_order"),
  reminderSent: boolean("reminder_sent").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ===============================
// 2. PROMOTIONS & COUPONS - العروض والكوبونات
// ===============================
export const promotions = pgTable("promotions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").references(() => restaurants.id).notNull(),
  branchId: varchar("branch_id").references(() => branches.id), // null = all branches
  nameEn: text("name_en").notNull(),
  nameAr: text("name_ar").notNull(),
  descriptionEn: text("description_en"),
  descriptionAr: text("description_ar"),
  image: text("image"),
  discountType: text("discount_type").notNull().default("percentage"), // percentage, fixed
  discountValue: decimal("discount_value", { precision: 10, scale: 2 }).notNull(),
  minOrderAmount: decimal("min_order_amount", { precision: 10, scale: 2 }).default("0"),
  maxDiscountAmount: decimal("max_discount_amount", { precision: 10, scale: 2 }), // cap for percentage
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  isActive: boolean("is_active").default(true),
  applicableOrderTypes: text("applicable_order_types").array(), // ['dine_in', 'pickup', 'delivery']
  applicableMenuItems: text("applicable_menu_items").array(), // specific item IDs, null = all
  applicableCategories: text("applicable_categories").array(), // specific category IDs
  usageLimit: integer("usage_limit"), // total times can be used
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const coupons = pgTable("coupons", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").references(() => restaurants.id).notNull(),
  code: text("code").notNull(), // e.g., "SAVE20"
  nameEn: text("name_en"),
  nameAr: text("name_ar"),
  discountType: text("discount_type").notNull().default("percentage"), // percentage, fixed
  discountValue: decimal("discount_value", { precision: 10, scale: 2 }).notNull(),
  minOrderAmount: decimal("min_order_amount", { precision: 10, scale: 2 }).default("0"),
  maxDiscountAmount: decimal("max_discount_amount", { precision: 10, scale: 2 }),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  isActive: boolean("is_active").default(true),
  usageLimit: integer("usage_limit"), // total times can be used
  usagePerCustomer: integer("usage_per_customer").default(1), // times per customer
  usageCount: integer("usage_count").default(0),
  applicableOrderTypes: text("applicable_order_types").array(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const couponUsage = pgTable("coupon_usage", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  couponId: varchar("coupon_id").references(() => coupons.id).notNull(),
  orderId: varchar("order_id").references(() => orders.id).notNull(),
  customerPhone: text("customer_phone"),
  discountAmount: decimal("discount_amount", { precision: 10, scale: 2 }).notNull(),
  usedAt: timestamp("used_at").defaultNow(),
});

// ===============================
// REVIEWS / التقييمات
// ===============================
export const reviews = pgTable("reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").references(() => restaurants.id).notNull(),
  orderId: varchar("order_id").references(() => orders.id),
  customerName: text("customer_name"),
  customerPhone: text("customer_phone"),
  rating: integer("rating").notNull(), // 1-5
  comment: text("comment"),
  isPublic: boolean("is_public").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// ===============================
// Kitchen Sections - أقسام المطبخ
// ===============================
export const kitchenSections = pgTable("kitchen_sections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").references(() => restaurants.id).notNull(),
  branchId: varchar("branch_id").references(() => branches.id),
  nameEn: text("name_en").notNull(), // e.g., "Appetizers", "Grills", "Pizza"
  nameAr: text("name_ar").notNull(), // e.g., "المقبلات", "المشاوي", "البيتزا"
  icon: text("icon"), // emoji or icon name: 🥗🍖🍕🍰🚚
  color: text("color").default("#8B1A1A"), // color for UI
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// ===============================
// 3. MENU VARIANTS & CUSTOMIZATIONS - المتغيرات والتخصيصات
// ===============================
export const menuItemVariants = pgTable("menu_item_variants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  menuItemId: varchar("menu_item_id").references(() => menuItems.id).notNull(),
  nameEn: text("name_en").notNull(), // e.g., "Small", "Medium", "Large"
  nameAr: text("name_ar").notNull(),
  priceAdjustment: decimal("price_adjustment", { precision: 10, scale: 2 }).default("0"), // can be + or -
  isDefault: boolean("is_default").default(false),
  isAvailable: boolean("is_available").default(true),
  sortOrder: integer("sort_order").default(0),
});

export const customizationGroups = pgTable("customization_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").references(() => restaurants.id).notNull(),
  nameEn: text("name_en").notNull(), // e.g., "Choose your rice", "Add extras"
  nameAr: text("name_ar").notNull(),
  selectionType: text("selection_type").notNull().default("single"), // single, multiple
  minSelections: integer("min_selections").default(0),
  maxSelections: integer("max_selections").default(1),
  isRequired: boolean("is_required").default(false),
  sortOrder: integer("sort_order").default(0),
});

export const customizationOptions = pgTable("customization_options", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").references(() => customizationGroups.id).notNull(),
  nameEn: text("name_en").notNull(), // e.g., "White Rice", "Extra Cheese"
  nameAr: text("name_ar").notNull(),
  priceAdjustment: decimal("price_adjustment", { precision: 10, scale: 2 }).default("0"),
  isDefault: boolean("is_default").default(false),
  isAvailable: boolean("is_available").default(true),
  sortOrder: integer("sort_order").default(0),
});

// Link menu items to customization groups
export const menuItemCustomizations = pgTable("menu_item_customizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  menuItemId: varchar("menu_item_id").references(() => menuItems.id).notNull(),
  customizationGroupId: varchar("customization_group_id").references(() => customizationGroups.id).notNull(),
  sortOrder: integer("sort_order").default(0),
});

// Store selected customizations for order items
export const orderItemCustomizations = pgTable("order_item_customizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderItemId: varchar("order_item_id").references(() => orderItems.id).notNull(),
  customizationOptionId: varchar("customization_option_id").references(() => customizationOptions.id).notNull(),
  priceAdjustment: decimal("price_adjustment", { precision: 10, scale: 2 }).default("0"),
});

// ===============================
// 4. QUEUE MANAGEMENT - نظام الطابور
// ===============================
export const queueEntries = pgTable("queue_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").references(() => restaurants.id).notNull(),
  branchId: varchar("branch_id").references(() => branches.id),
  queueNumber: integer("queue_number").notNull(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  partySize: integer("party_size").notNull().default(1),
  status: text("status").default("waiting"), // waiting, notified, seated, cancelled, no_show
  estimatedWaitMinutes: integer("estimated_wait_minutes"),
  notifiedAt: timestamp("notified_at"),
  seatedAt: timestamp("seated_at"),
  tableId: varchar("table_id").references(() => tables.id),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Daily queue counter reset
export const queueCounters = pgTable("queue_counters", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").references(() => restaurants.id).notNull(),
  branchId: varchar("branch_id").references(() => branches.id),
  date: text("date").notNull(), // "2026-02-10"
  lastNumber: integer("last_number").default(0),
});

// Day Sessions - إدارة اليوم
export const daySessions = pgTable("day_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").references(() => restaurants.id).notNull(),
  branchId: varchar("branch_id").references(() => branches.id),
  date: text("date").notNull(), // "2026-02-11"
  status: text("status").default("open"), // open, closed
  openedBy: varchar("opened_by").references(() => users.id),
  closedBy: varchar("closed_by").references(() => users.id),
  openedAt: timestamp("opened_at").defaultNow(),
  closedAt: timestamp("closed_at"),
  openingBalance: decimal("opening_balance", { precision: 10, scale: 2 }).default("0"),
  closingBalance: decimal("closing_balance", { precision: 10, scale: 2 }),
  expectedBalance: decimal("expected_balance", { precision: 10, scale: 2 }),
  difference: decimal("difference", { precision: 10, scale: 2 }),
  totalSales: decimal("total_sales", { precision: 10, scale: 2 }).default("0"),
  totalOrders: integer("total_orders").default(0),
  cashSales: decimal("cash_sales", { precision: 10, scale: 2 }).default("0"),
  cardSales: decimal("card_sales", { precision: 10, scale: 2 }).default("0"),
  notes: text("notes"),
});

// Cash Transactions - تحويلات نقدية
export const cashTransactions = pgTable("cash_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").references(() => restaurants.id).notNull(),
  branchId: varchar("branch_id").references(() => branches.id),
  sessionId: varchar("session_id").references(() => daySessions.id),
  type: text("type").notNull(), // deposit, withdrawal, adjustment
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  reason: text("reason"),
  performedBy: varchar("performed_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Notifications - الإشعارات
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").references(() => restaurants.id).notNull(),
  branchId: varchar("branch_id").references(() => branches.id),
  type: text("type").notNull(), // order, kitchen, inventory, reservation, queue, system
  title: text("title").notNull(),
  titleAr: text("title_ar"),
  message: text("message").notNull(),
  messageAr: text("message_ar"),
  priority: text("priority").default("normal"), // low, normal, high, urgent
  referenceType: text("reference_type"), // order, reservation, inventory_item, queue_entry
  referenceId: varchar("reference_id"),
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  readBy: varchar("read_by").references(() => users.id),
  targetRole: text("target_role"), // all, kitchen, cashier, manager
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Order Audit Log - سجل تعديلات الطلبات
export const orderAuditLog = pgTable("order_audit_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").references(() => restaurants.id).notNull(),
  orderId: varchar("order_id").references(() => orders.id).notNull(),
  action: text("action").notNull(), // created, status_changed, payment_updated, cancelled, item_added, item_removed, modified
  previousValue: text("previous_value"),
  newValue: text("new_value"),
  field: text("field"), // status, paymentMethod, isPaid, total, etc.
  userId: varchar("user_id").references(() => users.id),
  userName: text("user_name"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertOrderAuditLogSchema = createInsertSchema(orderAuditLog).omit({ id: true, createdAt: true });
export type OrderAuditLog = typeof orderAuditLog.$inferSelect;

// Notification Settings - إعدادات الإشعارات
export const notificationSettings = pgTable("notification_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  restaurantId: varchar("restaurant_id").references(() => restaurants.id).notNull(),
  branchId: varchar("branch_id").references(() => branches.id),
  // Order notifications
  newOrderSound: boolean("new_order_sound").default(true),
  newOrderPopup: boolean("new_order_popup").default(true),
  // Kitchen notifications
  orderReadySound: boolean("order_ready_sound").default(true),
  // Inventory notifications
  lowStockAlert: boolean("low_stock_alert").default(true),
  lowStockThreshold: integer("low_stock_threshold").default(10),
  // Reservation notifications
  newReservationAlert: boolean("new_reservation_alert").default(true),
  reservationReminderMinutes: integer("reservation_reminder_minutes").default(30),
  // Queue notifications
  queueAlertEnabled: boolean("queue_alert_enabled").default(true),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas
export const insertRestaurantSchema = createInsertSchema(restaurants).omit({ id: true, createdAt: true });
export const insertBranchSchema = createInsertSchema(branches).omit({ id: true, createdAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true });
export const insertMenuItemSchema = createInsertSchema(menuItems).omit({ id: true });
export const insertTableSchema = createInsertSchema(tables).omit({ id: true });
export const insertCustomerSchema = createInsertSchema(customers).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true, updatedAt: true });
export const insertOrderItemSchema = createInsertSchema(orderItems).omit({ id: true });
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true, issuedAt: true });
export const insertInventoryItemSchema = createInsertSchema(inventoryItems).omit({ id: true, createdAt: true, updatedAt: true });
export const insertInventoryTransactionSchema = createInsertSchema(inventoryTransactions).omit({ id: true, createdAt: true });
export const insertRecipeSchema = createInsertSchema(recipes).omit({ id: true, createdAt: true });
export const insertPrinterSchema = createInsertSchema(printers).omit({ id: true, createdAt: true });
export const insertMoyasarMerchantSchema = createInsertSchema(moyasarMerchants).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMoyasarDocumentSchema = createInsertSchema(moyasarDocuments).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPaymentTransactionSchema = createInsertSchema(paymentTransactions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertMoyasarInvoiceSchema = createInsertSchema(moyasarInvoices).omit({ id: true, createdAt: true, updatedAt: true });
export const insertApplePayDomainSchema = createInsertSchema(applePayDomains).omit({ id: true, createdAt: true });

// New Insert Schemas for added features
export const insertReservationSchema = createInsertSchema(reservations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPromotionSchema = createInsertSchema(promotions).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCouponSchema = createInsertSchema(coupons).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCouponUsageSchema = createInsertSchema(couponUsage).omit({ id: true, usedAt: true });
export const insertMenuItemVariantSchema = createInsertSchema(menuItemVariants).omit({ id: true });
export const insertCustomizationGroupSchema = createInsertSchema(customizationGroups).omit({ id: true });
export const insertCustomizationOptionSchema = createInsertSchema(customizationOptions).omit({ id: true });
export const insertMenuItemCustomizationSchema = createInsertSchema(menuItemCustomizations).omit({ id: true });
export const insertOrderItemCustomizationSchema = createInsertSchema(orderItemCustomizations).omit({ id: true });
export const insertQueueEntrySchema = createInsertSchema(queueEntries).omit({ id: true, createdAt: true, updatedAt: true });
export const insertQueueCounterSchema = createInsertSchema(queueCounters).omit({ id: true });
export const insertDaySessionSchema = createInsertSchema(daySessions).omit({ id: true, openedAt: true });
export const insertCashTransactionSchema = createInsertSchema(cashTransactions).omit({ id: true, createdAt: true });
export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true, createdAt: true });
export const insertNotificationSettingsSchema = createInsertSchema(notificationSettings).omit({ id: true, updatedAt: true });
export const insertReviewSchema = createInsertSchema(reviews).omit({ id: true, createdAt: true });
export const insertKitchenSectionSchema = createInsertSchema(kitchenSections).omit({ id: true, createdAt: true });

// Types
export type Restaurant = typeof restaurants.$inferSelect;
export type InsertRestaurant = z.infer<typeof insertRestaurantSchema>;
export type Branch = typeof branches.$inferSelect;
export type InsertBranch = z.infer<typeof insertBranchSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type MenuItem = typeof menuItems.$inferSelect;
export type InsertMenuItem = z.infer<typeof insertMenuItemSchema>;
export type Table = typeof tables.$inferSelect;
export type InsertTable = z.infer<typeof insertTableSchema>;
export type Customer = typeof customers.$inferSelect;
export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type InsertInventoryItem = z.infer<typeof insertInventoryItemSchema>;
export type InventoryTransaction = typeof inventoryTransactions.$inferSelect;
export type InsertInventoryTransaction = z.infer<typeof insertInventoryTransactionSchema>;
export type Recipe = typeof recipes.$inferSelect;
export type InsertRecipe = z.infer<typeof insertRecipeSchema>;
export type Printer = typeof printers.$inferSelect;
export type InsertPrinter = z.infer<typeof insertPrinterSchema>;
export type MoyasarMerchant = typeof moyasarMerchants.$inferSelect;
export type InsertMoyasarMerchant = z.infer<typeof insertMoyasarMerchantSchema>;
export type MoyasarDocument = typeof moyasarDocuments.$inferSelect;
export type InsertMoyasarDocument = z.infer<typeof insertMoyasarDocumentSchema>;
export type PaymentTransaction = typeof paymentTransactions.$inferSelect;
export type InsertPaymentTransaction = z.infer<typeof insertPaymentTransactionSchema>;
export type MoyasarInvoice = typeof moyasarInvoices.$inferSelect;
export type InsertMoyasarInvoice = z.infer<typeof insertMoyasarInvoiceSchema>;
export type ApplePayDomain = typeof applePayDomains.$inferSelect;
export type InsertApplePayDomain = z.infer<typeof insertApplePayDomainSchema>;

// New Types for added features
export type Reservation = typeof reservations.$inferSelect;
export type InsertReservation = z.infer<typeof insertReservationSchema>;
export type Promotion = typeof promotions.$inferSelect;
export type InsertPromotion = z.infer<typeof insertPromotionSchema>;
export type Coupon = typeof coupons.$inferSelect;
export type InsertCoupon = z.infer<typeof insertCouponSchema>;
export type CouponUsage = typeof couponUsage.$inferSelect;
export type InsertCouponUsage = z.infer<typeof insertCouponUsageSchema>;
export type MenuItemVariant = typeof menuItemVariants.$inferSelect;
export type InsertMenuItemVariant = z.infer<typeof insertMenuItemVariantSchema>;
export type CustomizationGroup = typeof customizationGroups.$inferSelect;
export type InsertCustomizationGroup = z.infer<typeof insertCustomizationGroupSchema>;
export type CustomizationOption = typeof customizationOptions.$inferSelect;
export type InsertCustomizationOption = z.infer<typeof insertCustomizationOptionSchema>;
export type MenuItemCustomization = typeof menuItemCustomizations.$inferSelect;
export type InsertMenuItemCustomization = z.infer<typeof insertMenuItemCustomizationSchema>;
export type OrderItemCustomization = typeof orderItemCustomizations.$inferSelect;
export type InsertOrderItemCustomization = z.infer<typeof insertOrderItemCustomizationSchema>;
export type QueueEntry = typeof queueEntries.$inferSelect;
export type InsertQueueEntry = z.infer<typeof insertQueueEntrySchema>;
export type QueueCounter = typeof queueCounters.$inferSelect;
export type InsertQueueCounter = z.infer<typeof insertQueueCounterSchema>;
export type DaySession = typeof daySessions.$inferSelect;
export type InsertDaySession = z.infer<typeof insertDaySessionSchema>;
export type CashTransaction = typeof cashTransactions.$inferSelect;
export type InsertCashTransaction = z.infer<typeof insertCashTransactionSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type NotificationSettings = typeof notificationSettings.$inferSelect;
export type InsertNotificationSettings = z.infer<typeof insertNotificationSettingsSchema>;
export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;
export type KitchenSection = typeof kitchenSections.$inferSelect;
export type InsertKitchenSection = z.infer<typeof insertKitchenSectionSchema>;

// Extended types for frontend
export type OrderWithItems = Order & { items: (OrderItem & { menuItem: MenuItem })[] };
export type MenuItemWithCategory = MenuItem & { category: Category };
export type InvoiceWithOrder = Invoice & { order: OrderWithItems; restaurant: Restaurant };

// Enums for UI
export const orderTypes = ["dine_in", "pickup", "delivery"] as const;
export const orderStatuses = ["payment_pending", "pending", "confirmed", "preparing", "ready", "completed", "cancelled", "refunded"] as const;
export const tableStatuses = ["available", "occupied", "reserved", "maintenance"] as const;
export const kitchenTypes = ["fast_food", "casual_dining", "fine_dining", "cafe", "bakery", "other"] as const;
export const priceRanges = ["$", "$$", "$$$", "$$$$"] as const;
export const paymentMethods = ["cash", "card", "mada", "stc_pay", "apple_pay", "bank_transfer", "tap_to_pay", "split"] as const;
export const invoiceTypes = ["standard", "simplified", "credit_note", "debit_note"] as const;
export const invoiceStatuses = ["draft", "issued", "cancelled", "reported"] as const;
export const zatcaStatuses = ["pending", "submitted", "accepted", "rejected"] as const;
export const inventoryUnits = ["kg", "g", "liter", "ml", "piece", "box", "pack", "dozen"] as const;
export const inventoryCategories = ["vegetables", "fruits", "meat", "poultry", "seafood", "dairy", "grains", "spices", "beverages", "packaging", "other"] as const;
export const inventoryTransactionTypes = ["purchase", "usage", "adjustment", "transfer", "waste", "return"] as const;
export const userRoles = ["platform_admin", "owner", "branch_manager", "cashier", "kitchen", "accountant"] as const;
export const printerTypes = ["receipt", "kitchen", "label"] as const;
export const printerConnectionTypes = ["network", "usb", "bluetooth"] as const;
export const menuHeaderTypes = ["logo", "banner", "logo_banner"] as const;
export const menuThemeColors = ["red", "blue", "purple", "green"] as const;
export const menuDisplayStyles = ["grid", "list"] as const;

// New Enums for added features
export const reservationStatuses = ["pending", "confirmed", "seated", "completed", "cancelled", "no_show"] as const;
export const reservationSources = ["website", "phone", "walk_in", "app"] as const;
export const discountTypes = ["percentage", "fixed"] as const;
export const customizationSelectionTypes = ["single", "multiple"] as const;
export const queueStatuses = ["waiting", "notified", "seated", "cancelled", "no_show"] as const;
export const daySessionStatuses = ["open", "closed"] as const;
export const cashTransactionTypes = ["deposit", "withdrawal", "adjustment"] as const;
export const notificationTypes = ["order", "kitchen", "inventory", "reservation", "queue", "system"] as const;
export const notificationPriorities = ["low", "normal", "high", "urgent"] as const;

// Moyasar enums
export const merchantTypes = ["freelancer", "establishment", "company", "foreign_company"] as const;
export const signatoryTypes = ["owner", "commercial_contract", "power_of_attorney"] as const;
export const merchantStatuses = ["draft", "pending", "active", "missing_docs", "rejected", "hold"] as const;
export const signatureStatuses = ["unsigned", "initiated", "signed", "rejected"] as const;
export const moyasarDocumentTypes = [
  "owner_id", "signatory_id", "bank_iban_certificate", "commercial_registration",
  "company_address", "owner_address", "signatory_address", "vat_certificate",
  "activity_license", "freelance_certificate", "investment_license", "power_of_attorney", "other"
] as const;
export const paymentSchemes = ["mada", "visa", "master"] as const;

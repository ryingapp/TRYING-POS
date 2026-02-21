import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import multer from "multer";
import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import * as moyasarPlatform from "./moyasar-platform";
import {
  generateZatcaXml,
  generateZatcaTlvQrCode,
  computeInvoiceHash,
  computeInvoiceHashBase64,
  generateInvoiceUuid,
  getZatcaBaseUrl,
  getComplianceCsid,
  getProductionCsid,
  reportInvoice,
  clearInvoice,
  submitComplianceInvoice,
  type ZatcaInvoiceData,
  type ZatcaLineItem,
} from "./zatca";

const JWT_SECRET = process.env.JWT_SECRET || (() => {
  console.warn("⚠️  JWT_SECRET not set! Using random secret. All tokens will be invalidated on restart.");
  return "change-me-in-production-" + crypto.randomBytes(32).toString("hex");
})();
const JWT_EXPIRES_IN = "7d";

// Platform admin email - this account gets platform_admin role automatically
const PLATFORM_ADMIN_EMAIL = "cto@tryingapp.com";

function signToken(payload: { userId: string; restaurantId: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token: string): { userId: string; restaurantId: string } {
  return jwt.verify(token, JWT_SECRET) as { userId: string; restaurantId: string };
}

const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const fileStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage: fileStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(jpg|jpeg|png|gif|webp|svg)$/i;
    if (allowed.test(path.extname(file.originalname))) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});
import { 
  insertCategorySchema, 
  insertMenuItemSchema, 
  insertTableSchema, 
  insertOrderSchema,
  insertRestaurantSchema,
  insertOrderItemSchema,
  insertInvoiceSchema,
  insertBranchSchema,
  insertUserSchema,
  insertInventoryItemSchema,
  insertInventoryTransactionSchema,
  insertRecipeSchema,
  insertPrinterSchema,
  insertMoyasarMerchantSchema,
  insertMoyasarDocumentSchema,
  insertReservationSchema,
  insertPromotionSchema,
  insertCouponSchema,
  insertCouponUsageSchema,
  insertReviewSchema,
  insertMenuItemVariantSchema,
  insertCustomizationGroupSchema,
  insertCustomizationOptionSchema,
  insertMenuItemCustomizationSchema,
  insertQueueEntrySchema,
  insertDaySessionSchema,
  insertCashTransactionSchema,
  insertNotificationSchema,
  insertNotificationSettingsSchema,
  insertPaymentTransactionSchema,
  insertMoyasarInvoiceSchema,
  insertApplePayDomainSchema,
  insertKitchenSectionSchema,
  insertCustomerSchema,
  customers
} from "@shared/schema";
import bcrypt from "bcryptjs";
import type { Request } from "express";

// Helper to handle auth vs server errors in route catch blocks
function handleRouteError(res: any, error: any, defaultMessage: string) {
  const msg = error?.message || "";
  if (msg === "Authentication required" || msg === "Invalid or expired token") {
    return res.status(401).json({ error: msg });
  }
  if (msg === "Restaurant subscription is inactive") {
    return res.status(403).json({ error: msg });
  }
  if (msg.includes("Permission denied") || msg.includes("not found")) {
    return res.status(403).json({ error: msg });
  }
  return res.status(500).json({ error: defaultMessage });
}

async function getRestaurantId(req: Request): Promise<string> {
  // Try JWT token from Authorization header first
  const authHeader = req.headers["authorization"] as string;
  let userId: string | undefined;
  
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const decoded = verifyToken(authHeader.slice(7));
      userId = decoded.userId;
    } catch {
      throw new Error("Invalid or expired token");
    }
  }
  
  if (!userId) {
    throw new Error("Authentication required");
  }
  const user = await storage.getUser(userId);
  if (!user || !user.isActive) {
    throw new Error("Authentication required");
  }
  if (user.role !== "platform_admin") {
    const restaurant = await storage.getRestaurantById(user.restaurantId);
    if (!restaurant || restaurant.isActive === false) {
      throw new Error("Restaurant subscription is inactive");
    }
  }
  return user.restaurantId;
}

// Helper: extract the authenticated user from the request
async function getAuthenticatedUser(req: Request) {
  const authHeader = req.headers["authorization"] as string;
  let userId: string | undefined;
  
  if (authHeader?.startsWith("Bearer ")) {
    try {
      const decoded = verifyToken(authHeader.slice(7));
      userId = decoded.userId;
    } catch {
      throw new Error("Invalid or expired token");
    }
  }
  
  if (!userId) throw new Error("Authentication required");
  const user = await storage.getUser(userId);
  if (!user || !user.isActive) throw new Error("Authentication required");
  return user;
}

// Permission map: module name → user field
const PERMISSION_MAP: Record<string, string> = {
  dashboard: "permDashboard",
  pos: "permPos",
  orders: "permOrders",
  menu: "permMenu",
  kitchen: "permKitchen",
  inventory: "permInventory",
  reviews: "permReviews",
  marketing: "permMarketing",
  qr: "permQr",
  reports: "permReports",
  settings: "permSettings",
  tables: "permTables",
};

// Helper: check if user has permission for a module
async function requirePermission(req: Request, module: string): Promise<void> {
  const user = await getAuthenticatedUser(req);
  // Owners and platform admins always have access
  if (user.role === "owner" || user.role === "platform_admin") return;
  const field = PERMISSION_MAP[module];
  if (!field) return; // Unknown module, allow by default
  if (!(user as any)[field]) {
    throw new Error("Permission denied");
  }
}

// Helper: verify entity belongs to the authenticated user's restaurant
async function verifyOwnership(req: Request, entity: { restaurantId?: string | null } | null | undefined, entityName = "Resource"): Promise<void> {
  if (!entity) throw new Error(`${entityName} not found`);
  const restaurantId = await getRestaurantId(req);
  if (entity.restaurantId && entity.restaurantId !== restaurantId) {
    throw new Error(`${entityName} not found`);
  }
}

// Server-side order total recalculation using actual DB prices
async function recalculateOrderTotals(
  restaurantId: string,
  items: Array<{ menuItemId: string; quantity: number; price?: string; variantPrice?: string; variantId?: string; variantName?: string; customizations?: Array<{ optionId?: string; price?: string; [key: string]: any }> }>,
  clientDiscount: number = 0,
  clientDeliveryFee: number = 0,
): Promise<{ subtotal: string; tax: string; total: string; discount: string; deliveryFee: string }> {
  const restaurant = await storage.getRestaurantById(restaurantId);
  const isTaxEnabled = restaurant?.taxEnabled !== false;
  const taxRate = isTaxEnabled ? 0.15 : 0;

  let subtotal = 0;
  for (const item of items) {
    const menuItem = await storage.getMenuItem(item.menuItemId);
    if (!menuItem || menuItem.restaurantId !== restaurantId) {
      throw new Error(`Menu item ${item.menuItemId} not found or does not belong to this restaurant`);
    }

    // Start with DB base price — never trust client price
    let itemPrice = parseFloat(menuItem.price);
    
    // Validate variant price from DB if variant is specified
    if (item.variantId) {
      const variant = await storage.getMenuItemVariant(item.variantId);
      if (variant && variant.menuItemId === item.menuItemId) {
        itemPrice += parseFloat(variant.priceAdjustment || "0");
      }
    } else if (item.variantName) {
      // Fallback: look up variant by name
      const variants = await storage.getMenuItemVariants(item.menuItemId);
      const matched = variants.find(v => v.nameEn === item.variantName || v.nameAr === item.variantName);
      if (matched) {
        itemPrice += parseFloat(matched.priceAdjustment || "0");
      }
    }

    // Validate customization prices from DB — never trust client prices
    if (item.customizations && Array.isArray(item.customizations)) {
      for (const cust of item.customizations) {
        if (cust.optionId) {
          const option = await storage.getCustomizationOption(cust.optionId);
          if (option) {
            itemPrice += parseFloat(option.priceAdjustment || "0");
          }
        } else if (cust.price) {
          // Fallback for backward compatibility if no optionId — use client price
          itemPrice += parseFloat(cust.price);
        }
      }
    }

    const qty = Math.max(1, Math.floor(item.quantity || 1));
    subtotal += itemPrice * qty;
  }

  const discount = Math.max(0, Math.min(clientDiscount, subtotal)); // discount can't exceed subtotal
  const taxableAmount = subtotal - discount;
  const tax = taxableAmount * taxRate;
  const deliveryFee = Math.max(0, clientDeliveryFee);
  const total = taxableAmount + tax + deliveryFee;

  return {
    subtotal: subtotal.toFixed(2),
    tax: tax.toFixed(2),
    total: total.toFixed(2),
    discount: discount.toFixed(2),
    deliveryFee: deliveryFee.toFixed(2),
  };
}

// Safe field whitelist for order updates
const ALLOWED_ORDER_UPDATE_FIELDS = [
  "status", "paymentMethod", "isPaid", "notes", "kitchenNotes",
  "customerName", "customerPhone", "customerAddress", "customerId",
] as const;

// ZATCA QR Code generation - delegates to zatca module with Phase 2 support
function generateZatcaQrCode(data: {
  sellerName: string;
  vatNumber: string;
  timestamp: string;
  total: string;
  vatAmount: string;
  invoiceHash?: string;
  digitalSignature?: string;
  publicKey?: string;
  csidStamp?: string;
}): string {
  return generateZatcaTlvQrCode(data);
}

// Build full ZATCA invoice with XML, hash chain, and QR code
async function buildZatcaInvoice(
  restaurant: any,
  order: any,
  orderItems: any[],
  menuItems: Map<string, any>,
  invoiceType: 'simplified' | 'standard' | 'credit_note' | 'debit_note' = 'simplified',
  relatedInvoice?: any,
  buyer?: { name?: string; vatNumber?: string },
) {
  const restaurantId = restaurant.id;
  
  // Increment invoice counter atomically
  const currentCounter = (restaurant.zatcaInvoiceCounter || 0) + 1;
  await storage.updateRestaurantById(restaurantId, { zatcaInvoiceCounter: currentCounter } as any);
  
  const previousHash = restaurant.zatcaLastInvoiceHash || 
    Buffer.from('NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==', 'base64').toString('utf8');
  
  const uuid = generateInvoiceUuid();
  const now = new Date();
  const issueDate = now.toISOString().split('T')[0];
  const issueTime = now.toTimeString().split(' ')[0];
  
  const isTaxEnabled = restaurant.taxEnabled !== false;
  const taxRate = isTaxEnabled ? 15 : 0;
  
  // Build line items
  const items: ZatcaLineItem[] = orderItems.map((item, idx) => {
    const menuItem = menuItems.get(item.menuItemId);
    const unitPrice = parseFloat(item.unitPrice || menuItem?.price || "0");
    const quantity = item.quantity || 1;
    const lineDiscount = 0;
    const lineTotal = unitPrice * quantity - lineDiscount;
    const lineTax = lineTotal * (taxRate / 100);
    
    return {
      id: String(idx + 1),
      nameAr: menuItem?.nameAr || menuItem?.nameEn || 'منتج',
      nameEn: menuItem?.nameEn || '',
      quantity,
      unitPrice,
      discount: lineDiscount,
      taxRate,
      taxAmount: Math.round(lineTax * 100) / 100,
      totalWithTax: Math.round((lineTotal + lineTax) * 100) / 100,
      totalWithoutTax: Math.round(lineTotal * 100) / 100,
    };
  });
  
  const subtotal = items.reduce((sum, i) => sum + i.totalWithoutTax, 0);
  const discount = parseFloat(order.discount || "0");
  const deliveryFee = parseFloat(order.deliveryFee || "0");
  const taxableAmount = Math.max(0, subtotal - discount + deliveryFee);
  const taxAmount = Math.round(taxableAmount * (taxRate / 100) * 100) / 100;
  const total = Math.round((taxableAmount + taxAmount) * 100) / 100;
  
  const invoiceNumber = await storage.getNextInvoiceNumber(restaurantId);
  
  const invoiceData: ZatcaInvoiceData = {
    uuid,
    invoiceNumber,
    invoiceType,
    issueDate,
    issueTime,
    deliveryDate: issueDate,
    seller: {
      nameAr: restaurant.nameAr || restaurant.nameEn || 'مطعم',
      nameEn: restaurant.nameEn,
      vatNumber: restaurant.vatNumber || '',
      commercialRegistration: restaurant.commercialRegistration || '',
      streetName: restaurant.streetName || '',
      buildingNumber: restaurant.buildingNumber || '',
      district: restaurant.district || '',
      city: restaurant.city || '',
      postalCode: restaurant.postalCode || '',
      country: restaurant.country || 'SA',
    },
    buyer: buyer ? {
      name: buyer.name,
      vatNumber: buyer.vatNumber,
    } : undefined,
    items,
    subtotal,
    discount,
    deliveryFee,
    taxAmount,
    taxRate,
    total,
    paymentMethod: order.paymentMethod || 'cash',
    previousInvoiceHash: previousHash,
    invoiceCounter: currentCounter,
    relatedInvoiceNumber: relatedInvoice?.invoiceNumber,
    relatedInvoiceIssueDate: relatedInvoice?.createdAt ? new Date(relatedInvoice.createdAt).toISOString().split('T')[0] : undefined,
  };
  
  // Generate XML
  const xmlContent = generateZatcaXml(invoiceData);
  
  // Compute hash
  const invoiceHash = computeInvoiceHashBase64(xmlContent);
  
  // Update restaurant's last invoice hash
  await storage.updateRestaurantById(restaurantId, { zatcaLastInvoiceHash: invoiceHash } as any);
  
  // Generate QR code with hash data
  const qrData = generateZatcaQrCode({
    sellerName: restaurant.nameAr || restaurant.nameEn || 'مطعم',
    vatNumber: restaurant.vatNumber || '',
    timestamp: now.toISOString(),
    total: total.toFixed(2),
    vatAmount: taxAmount.toFixed(2),
    invoiceHash: computeInvoiceHash(xmlContent),
  });
  
  return {
    invoiceNumber,
    uuid,
    xmlContent,
    invoiceHash,
    previousInvoiceHash: previousHash,
    invoiceCounter: currentCounter,
    qrData,
    subtotal: subtotal.toFixed(2),
    taxRate: taxRate.toFixed(2),
    taxAmount: taxAmount.toFixed(2),
    total: total.toFixed(2),
    discount: discount.toFixed(2),
    deliveryFee: deliveryFee.toFixed(2),
    invoiceType,
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.use("/uploads", (await import("express")).default.static(uploadDir));

  // RBAC permission middleware for protected routes
  const ROUTE_PERMISSIONS: Array<{ pattern: RegExp; module: string; methods?: string[] }> = [
    { pattern: /^\/api\/(menu-items|categories)/, module: "menu" },
    { pattern: /^\/api\/orders/, module: "orders" },
    { pattern: /^\/api\/tables/, module: "tables" },
    { pattern: /^\/api\/inventory/, module: "inventory" },
    { pattern: /^\/api\/kitchen/, module: "kitchen" },
    { pattern: /^\/api\/reports/, module: "reports" },
    { pattern: /^\/api\/(restaurant|settings|branches|users|moyasar|zatca)/, module: "settings" },
    { pattern: /^\/api\/(promotions|coupons)/, module: "marketing" },
    { pattern: /^\/api\/qr-codes/, module: "qr" },
    { pattern: /^\/api\/printers/, module: "settings" },
    { pattern: /^\/api\/(queue|reservations)/, module: "tables" },
  ];

  app.use("/api/", async (req, res, next) => {
    // Skip auth check for public routes, auth routes, and webhooks
    if (req.path.includes("/public/") || req.path.startsWith("/auth/") || req.path.includes("/webhook")) {
      return next();
    }
    
    // Find matching permission rule  
    const matched = ROUTE_PERMISSIONS.find(r => r.pattern.test(req.path));
    if (matched) {
      try {
        await requirePermission(req, matched.module);
      } catch (err: any) {
        if (err.message === "Permission denied") {
          return res.status(403).json({ error: "You don't have permission to access this resource" });
        }
        // Auth errors will be handled by the route itself
      }
    }
    next();
  });

  app.post("/api/upload", upload.single("file"), async (req, res) => {
    try {
      // Require authentication for file uploads
      await getRestaurantId(req);
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      const fileUrl = `/uploads/${req.file.filename}`;
      res.json({ url: fileUrl });
    } catch (error: any) {
      if (error?.message === "Authentication required") {
        return res.status(401).json({ error: "Authentication required" });
      }
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // ==================== PUBLIC MENU APIs (no auth required) ====================
  
  // Middleware: resolve restaurant slug or ID to actual restaurant ID
  app.use("/api/public/:restaurantId", async (req: any, res, next) => {
    try {
      const idOrSlug = req.params.restaurantId;
      const resolvedId = await storage.resolveRestaurantId(idOrSlug);
      if (!resolvedId) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      // Store resolved ID on res.locals so route handlers can use it
      res.locals.restaurantId = resolvedId;

      // Also resolve branch slug if ?branch= or ?b= query param is present
      const branchParam = (req.query.branch || req.query.b) as string | undefined;
      if (branchParam) {
        const resolvedBranchId = await storage.resolveBranchId(resolvedId, branchParam);
        if (resolvedBranchId) {
          req.query.branch = resolvedBranchId;
          req.query.b = resolvedBranchId;
        }
      }

      next();
    } catch (error) {
      res.status(500).json({ error: "Failed to resolve restaurant" });
    }
  });

  // Public: Get branches (with slugs) for restaurant
  app.get("/api/public/:restaurantId/branches", async (req, res) => {
    try {
      const restaurantId = res.locals.restaurantId;
      const branchesList = await storage.getBranches(restaurantId);
      res.json(branchesList.filter((b: any) => b.isActive).map((b: any) => ({
        id: b.id,
        slug: b.slug || null,
        name: b.name,
        nameAr: b.nameAr,
        isMain: b.isMain,
      })));
    } catch (error) {
      res.status(500).json({ error: "Failed to get branches" });
    }
  });

  app.get("/api/public/:restaurantId/restaurant", async (req, res) => {
    try {
      const restaurant = await storage.getRestaurantById(res.locals.restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      res.json({
        id: restaurant.id,
        slug: (restaurant as any).slug || null,
        nameEn: restaurant.nameEn,
        nameAr: restaurant.nameAr,
        descriptionEn: restaurant.descriptionEn,
        descriptionAr: restaurant.descriptionAr,
        logo: restaurant.logo,
        banner: restaurant.banner,
        menuHeaderType: restaurant.menuHeaderType,
        menuThemeColor: restaurant.menuThemeColor,
        menuDisplayStyle: restaurant.menuDisplayStyle,
        phone: restaurant.phone,
        whatsapp: restaurant.whatsapp,
        address: restaurant.address,
        openingTime: restaurant.openingTime,
        closingTime: restaurant.closingTime,
        workingHours: restaurant.workingHours,
        serviceDineIn: restaurant.serviceDineIn,
        servicePickup: restaurant.servicePickup,
        serviceDelivery: restaurant.serviceDelivery,
        serviceTableBooking: restaurant.serviceTableBooking,
        serviceQueue: restaurant.serviceQueue,
        taxEnabled: restaurant.taxEnabled,
        taxRate: restaurant.taxRate,
        socialInstagram: restaurant.socialInstagram,
        socialTwitter: restaurant.socialTwitter,
        socialTiktok: restaurant.socialTiktok,
        socialSnapchat: restaurant.socialSnapchat,
        socialFacebook: restaurant.socialFacebook,
        reservationDuration: (restaurant as any).reservationDuration || 90,
        reservationDepositAmount: (restaurant as any).reservationDepositAmount || "20.00",
        reservationDepositRequired: (restaurant as any).reservationDepositRequired !== false,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get restaurant" });
    }
  });

  app.post("/api/public/:restaurantId/customer/login", async (req, res) => {
    try {
      const { restaurantId } = req.params;
      const { phone: rawPhone, name } = req.body;

      if (!rawPhone) {
        return res.status(400).json({ error: "Phone number is required" });
      }

      const phone = rawPhone.toString().replace(/[\s\-\(\)]/g, "").trim();

      const restaurant = await storage.getRestaurantById(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      let customer = await storage.getCustomerByPhone(restaurantId, phone);

      if (customer) {
        if (name && name !== customer.name) {
          customer = await storage.updateCustomer(customer.id, { name }) || customer;
        }
        return res.json({ customer, isNew: false });
      }

      if (!name) {
        return res.status(404).json({ error: "Customer not found", needsRegistration: true });
      }

      customer = await storage.createCustomer({
        restaurantId,
        phone,
        name,
      });

      return res.json({ customer, isNew: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to process customer login" });
    }
  });

  app.get("/api/public/:restaurantId/categories", async (req, res) => {
    try {
      const categories = await storage.getCategories(res.locals.restaurantId);
      res.json(categories.filter(c => c.isActive));
    } catch (error) {
      res.status(500).json({ error: "Failed to get categories" });
    }
  });

  app.get("/api/public/:restaurantId/menu-items", async (req, res) => {
    try {
      const items = await storage.getMenuItems(res.locals.restaurantId);
      res.json(items);
    } catch (error) {
      console.error("Error in GET /api/public/:restaurantId/menu-items:", error);
      res.status(500).json({ error: "Failed to get menu items" });
    }
  });

  app.get("/api/public/:restaurantId/tables/:tableId", async (req, res) => {
    try {
      const table = await storage.getTable(req.params.tableId);
      if (!table || table.restaurantId !== res.locals.restaurantId) {
        return res.status(404).json({ error: "Table not found" });
      }
      res.json(table);
    } catch (error) {
      res.status(500).json({ error: "Failed to get table" });
    }
  });

  // Public: Check if customer has a paid deposit (for QR ordering)
  app.get("/api/public/:restaurantId/check-deposit", async (req, res) => {
    try {
      const restaurantId = res.locals.restaurantId;
      const phone = req.query.phone as string;
      if (!phone) {
        return res.status(400).json({ hasDeposit: false });
      }
      const normalizedPhone = phone.replace(/\s/g, '');
      const reservation = await storage.findPaidDepositByPhone(restaurantId, normalizedPhone);
      if (reservation) {
        res.json({ hasDeposit: true, depositAmount: reservation.depositAmount, reservationId: reservation.id, customerName: reservation.customerName });
      } else {
        res.json({ hasDeposit: false });
      }
    } catch (error) {
      res.json({ hasDeposit: false });
    }
  });

  // Public coupon validation
  app.post("/api/public/:restaurantId/validate-coupon", async (req, res) => {
    try {
      const restaurantId = res.locals.restaurantId;
      const { code, orderTotal, customerPhone } = req.body;
      if (!code || orderTotal === undefined) {
        return res.status(400).json({ valid: false, error: "Code and orderTotal are required" });
      }
      const result = await storage.validateCoupon(restaurantId, code, parseFloat(orderTotal), customerPhone);
      if (result.valid && result.coupon) {
        const coupon = result.coupon;
        let discount = 0;
        if (coupon.discountType === "percentage") {
          discount = (parseFloat(orderTotal) * parseFloat(coupon.discountValue)) / 100;
          if (coupon.maxDiscountAmount) {
            discount = Math.min(discount, parseFloat(coupon.maxDiscountAmount));
          }
        } else {
          discount = parseFloat(coupon.discountValue);
        }
        discount = Math.min(discount, parseFloat(orderTotal));
        res.json({ valid: true, discount, couponId: coupon.id, discountType: coupon.discountType, discountValue: coupon.discountValue });
      } else {
        res.json({ valid: false, error: result.error });
      }
    } catch (error) {
      res.status(500).json({ valid: false, error: "Failed to validate coupon" });
    }
  });

  app.post("/api/public/:restaurantId/orders", async (req, res) => {
    try {
      const restaurantId = res.locals.restaurantId;
      const restaurant = await storage.getRestaurantById(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      let validBranchId = undefined;
      if (req.body.branchId) {
        // Resolve branch slug or ID
        const resolvedBranch = await storage.resolveBranchId(restaurantId, req.body.branchId);
        validBranchId = resolvedBranch || undefined;
      }

      // Check if day session is open before accepting orders
      const currentSession = await storage.getCurrentDaySession(restaurantId, validBranchId);
      if (!currentSession) {
        return res.status(400).json({ error: "daySessionClosed", message: "Restaurant has not opened day session yet" });
      }

      // Server-side price recalculation for public orders (CRITICAL - prevents price tampering)
      let serverTotals: { subtotal: string; tax: string; total: string; discount: string; deliveryFee: string } | null = null;
      if (req.body.items && Array.isArray(req.body.items) && req.body.items.length > 0) {
        try {
          serverTotals = await recalculateOrderTotals(
            restaurantId,
            req.body.items,
            parseFloat(req.body.discount || "0"),
            parseFloat(req.body.deliveryFee || "0"),
          );
        } catch (calcErr: any) {
          console.error("Server-side price calculation error (public):", calcErr);
          return res.status(400).json({ error: "Invalid order items: " + calcErr.message });
        }
      }

      const cleanBody = {
        ...req.body,
        restaurantId,
        tableId: req.body.tableId || undefined,
        branchId: validBranchId,
        customerName: req.body.customerName || undefined,
        customerPhone: req.body.customerPhone || undefined,
        customerAddress: req.body.customerAddress || undefined,
        notes: req.body.notes || undefined,
        kitchenNotes: req.body.kitchenNotes || undefined,
        // Override with server-calculated values for public orders
        ...(serverTotals ? {
          subtotal: serverTotals.subtotal,
          tax: serverTotals.tax,
          total: serverTotals.total,
          discount: serverTotals.discount,
          deliveryFee: serverTotals.deliveryFee,
        } : {}),
      };

      const data = insertOrderSchema.parse(cleanBody);

      if (data.orderType === "dine_in" && data.tableId) {
        const tbl = await storage.getTable(data.tableId);
        if (tbl && tbl.restaurantId === restaurantId) {
          await storage.updateTableStatus(data.tableId, "occupied");
        } else {
          return res.status(400).json({ error: "Invalid table for this restaurant" });
        }
      }

      const order = await storage.createOrder(data);

      // Auto-apply deposit discount if customer has a paid reservation deposit
      let depositApplied = false;
      if (order.customerPhone) {
        const normalizedPhone = order.customerPhone.replace(/\s/g, '');
        try {
          const depositReservation = await storage.findPaidDepositByPhone(restaurantId, normalizedPhone);
          if (depositReservation && depositReservation.depositAmount) {
            const depositAmt = parseFloat(depositReservation.depositAmount);
            const orderTotal = parseFloat(order.total || "0");
            const discountAmt = Math.min(depositAmt, orderTotal); // don't exceed order total
            const newTotal = (orderTotal - discountAmt).toFixed(2);
            await storage.updateOrder(order.id, { discount: discountAmt.toFixed(2), total: newTotal } as any);
            await storage.markDepositApplied(depositReservation.id, order.id);
            depositApplied = true;
            // Update order object for response
            (order as any).discount = discountAmt.toFixed(2);
            (order as any).total = newTotal;
            (order as any).depositApplied = true;
            (order as any).depositAmount = discountAmt.toFixed(2);
          }
        } catch (depositErr) {
          console.error("Deposit auto-apply error:", depositErr);
        }
      }

      if (order.customerPhone) {
        const normalizedPhone = order.customerPhone.replace(/\s/g, '');
        let customer = await storage.getCustomerByPhone(restaurantId, normalizedPhone);
        if (customer) {
          await storage.updateCustomer(customer.id, {
            name: order.customerName || customer.name,
            address: order.customerAddress || customer.address,
            totalOrders: (customer.totalOrders || 0) + 1,
            totalSpent: String(parseFloat(customer.totalSpent || "0") + parseFloat(order.total || "0")),
            lastOrderAt: new Date(),
          });
        } else {
          customer = await storage.createCustomer({
            restaurantId,
            name: order.customerName || null,
            phone: normalizedPhone,
            address: order.customerAddress || null,
            totalOrders: 1,
            totalSpent: order.total || "0",
            lastOrderAt: new Date(),
          });
        }
        await storage.updateOrder(order.id, { customerId: customer.id });
      }

      // Skip invoice and day session for payment_pending orders (will be created after payment verification)
      if (order.status !== "payment_pending") {
      try {
        const isTaxEnabled = restaurant.taxEnabled !== false;
        const vatRate = isTaxEnabled ? 0.15 : 0;
        const subtotal = parseFloat(order.total || "0");
        const vatAmount = subtotal * vatRate;
        const total = subtotal + vatAmount;
        const now = new Date();
        const uuid = generateInvoiceUuid();
        const invoiceNumber = await storage.getNextInvoiceNumber(restaurantId);
        
        // Generate ZATCA XML for public orders too
        const currentCounter = ((restaurant as any).zatcaInvoiceCounter || 0) + 1;
        const previousHash = (restaurant as any).zatcaLastInvoiceHash || 
          Buffer.from('NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==', 'base64').toString('utf8');
        
        const xmlContent = generateZatcaXml({
          uuid,
          invoiceNumber,
          invoiceType: 'simplified',
          issueDate: now.toISOString().split('T')[0],
          issueTime: now.toTimeString().split(' ')[0],
          deliveryDate: now.toISOString().split('T')[0],
          seller: {
            nameAr: restaurant.nameAr || restaurant.nameEn || 'مطعم',
            vatNumber: restaurant.vatNumber || '',
            commercialRegistration: restaurant.commercialRegistration || '',
            streetName: restaurant.streetName || '',
            buildingNumber: restaurant.buildingNumber || '',
            district: restaurant.district || '',
            city: restaurant.city || '',
            postalCode: restaurant.postalCode || '',
            country: restaurant.country || 'SA',
          },
          items: [{
            id: '1',
            nameAr: 'طلب',
            quantity: 1,
            unitPrice: subtotal,
            discount: 0,
            taxRate: vatRate * 100,
            taxAmount: Math.round(vatAmount * 100) / 100,
            totalWithTax: Math.round(total * 100) / 100,
            totalWithoutTax: Math.round(subtotal * 100) / 100,
          }],
          subtotal,
          discount: 0,
          deliveryFee: 0,
          taxAmount: vatAmount,
          taxRate: vatRate * 100,
          total,
          paymentMethod: order.paymentMethod || 'cash',
          previousInvoiceHash: previousHash,
          invoiceCounter: currentCounter,
        });

        const invoiceHash = computeInvoiceHashBase64(xmlContent);

        const qrData = generateZatcaQrCode({
          sellerName: restaurant.nameAr || restaurant.nameEn || "Restaurant",
          vatNumber: restaurant.vatNumber || "",
          timestamp: now.toISOString(),
          total: total.toFixed(2),
          vatAmount: vatAmount.toFixed(2),
          invoiceHash: computeInvoiceHash(xmlContent),
        });

        await storage.createInvoice({
          restaurantId,
          orderId: order.id,
          invoiceNumber,
          invoiceType: "simplified",
          subtotal: subtotal.toFixed(2),
          taxRate: (vatRate * 100).toFixed(2),
          taxAmount: vatAmount.toFixed(2),
          total: total.toFixed(2),
          qrCodeData: qrData,
          xmlContent,
          invoiceHash,
          previousInvoiceHash: previousHash,
          invoiceCounter: currentCounter,
          uuid,
          status: "issued",
          zatcaStatus: "pending",
        });

        // Update restaurant counter and hash
        await storage.updateRestaurantById(restaurantId, {
          zatcaInvoiceCounter: currentCounter,
          zatcaLastInvoiceHash: invoiceHash,
        } as any);
      } catch (invoiceError) {
        console.error("Invoice creation error (public order):", invoiceError);
      }

      // Update day session totals atomically for public order
      try {
        const currentSession2 = await storage.getCurrentDaySession(restaurantId, order.branchId || undefined);
        if (currentSession2) {
          const orderTotal = parseFloat(order.total || "0");
          await storage.incrementDaySessionTotals(currentSession2.id, orderTotal, order.paymentMethod || "cash");
        }
      } catch (e) {
        console.error("Failed to update day session totals (public):", e);
      }
      } // end if not payment_pending

      res.status(201).json(order);
    } catch (error) {
      console.error("Public order error:", error);
      res.status(400).json({ error: "Failed to create order" });
    }
  });

  app.post("/api/public/:restaurantId/orders/:orderId/items", async (req, res) => {
    try {
      const order = await storage.getOrder(req.params.orderId);
      if (!order || order.restaurantId !== res.locals.restaurantId) {
        return res.status(404).json({ error: "Order not found" });
      }
      // Server-side price verification for public add-items (prevent price tampering)
      const { menuItemId, quantity } = req.body;
      if (!menuItemId) {
        return res.status(400).json({ error: "menuItemId is required" });
      }
      const menuItem = await storage.getMenuItem(menuItemId);
      if (!menuItem || menuItem.restaurantId !== res.locals.restaurantId || !menuItem.isAvailable) {
        return res.status(404).json({ error: "Menu item not found or unavailable" });
      }
      const verifiedPrice = parseFloat(menuItem.price);
      const data = insertOrderItemSchema.parse({
        ...req.body,
        orderId: req.params.orderId,
        price: verifiedPrice.toFixed(2),
        total: (verifiedPrice * (quantity || 1)).toFixed(2),
      });
      const item = await storage.createOrderItem(data);
      res.status(201).json(item);
    } catch (error) {
      res.status(400).json({ error: "Failed to add order item" });
    }
  });

  app.get("/api/public/:restaurantId/tables/:tableId/active-order", async (req, res) => {
    try {
      const { restaurantId, tableId } = req.params;
      const table = await storage.getTable(tableId);
      if (!table || table.restaurantId !== restaurantId) {
        return res.status(404).json({ error: "Table not found" });
      }

      const order = await storage.getActiveOrderByTable(tableId);
      if (!order || order.restaurantId !== restaurantId) {
        return res.json({ hasActiveOrder: false });
      }

      const orderItems = await storage.getOrderItems(order.id);
      const menuItems = await storage.getMenuItems(restaurantId);
      const itemsWithDetails = orderItems.map((item: any) => {
        const menuItem = menuItems.find((m: any) => m.id === item.menuItemId);
        return {
          ...item,
          menuItem: menuItem ? {
            nameEn: menuItem.nameEn,
            nameAr: menuItem.nameAr,
            price: menuItem.price,
          } : null,
        };
      });

      res.json({
        hasActiveOrder: true,
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          status: order.status,
          total: order.total,
          subtotal: order.subtotal,
          isPaid: order.isPaid,
          createdAt: order.createdAt,
          items: itemsWithDetails,
        },
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get active order" });
    }
  });

  app.get("/api/public/:restaurantId/orders/:orderId", async (req, res) => {
    try {
      const order = await storage.getOrder(req.params.orderId);
      if (!order || order.restaurantId !== res.locals.restaurantId) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      res.status(500).json({ error: "Failed to get order" });
    }
  });

  app.get("/api/public/:restaurantId/orders/:orderId/items", async (req, res) => {
    try {
      const order = await storage.getOrder(req.params.orderId);
      if (!order || order.restaurantId !== res.locals.restaurantId) {
        return res.status(404).json({ error: "Order not found" });
      }
      const orderItemsList = await storage.getOrderItems(req.params.orderId);
      const itemsWithDetails = await Promise.all(
        orderItemsList.map(async (item: any) => {
          const menuItem = await storage.getMenuItem(item.menuItemId);
          return {
            ...item,
            menuItem: menuItem ? { nameEn: menuItem.nameEn, nameAr: menuItem.nameAr, price: menuItem.price } : null,
          };
        })
      );
      res.json(itemsWithDetails);
    } catch (error) {
      res.status(500).json({ error: "Failed to get order items" });
    }
  });

  // Public order endpoint - no auth needed, used by payment page
  app.get("/api/public/orders/:orderId", async (req, res) => {
    try {
      const order = await storage.getOrder(req.params.orderId);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.json(order);
    } catch (error) {
      res.status(500).json({ error: "Failed to get order" });
    }
  });

  // Public invoice endpoint - no auth needed, used on payment callback page
  app.get("/api/public/orders/:orderId/invoice", async (req, res) => {
    try {
      const order = await storage.getOrder(req.params.orderId);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      const invoice = await storage.getInvoiceByOrder(order.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      const restaurant = await storage.getRestaurantById(order.restaurantId);
      const orderItems = await storage.getOrderItems(order.id);
      const menuItemsData = await storage.getMenuItems(order.restaurantId);
      const menuItemsMap = new Map(menuItemsData.map(m => [m.id, m]));
      const itemsWithDetails = orderItems.map(item => ({
        ...item,
        menuItem: menuItemsMap.get(item.menuItemId)
          ? { nameEn: menuItemsMap.get(item.menuItemId)!.nameEn, nameAr: menuItemsMap.get(item.menuItemId)!.nameAr, price: menuItemsMap.get(item.menuItemId)!.price }
          : undefined,
      }));
      // Return limited data - no sensitive fields
      res.json({
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        invoiceType: invoice.invoiceType,
        status: invoice.status,
        subtotal: invoice.subtotal,
        taxAmount: invoice.taxAmount,
        taxRate: invoice.taxRate,
        discount: invoice.discount,
        deliveryFee: invoice.deliveryFee,
        total: invoice.total,
        customerName: invoice.customerName,
        paymentMethod: invoice.paymentMethod,
        isPaid: invoice.isPaid,
        qrCodeData: invoice.qrCodeData,
        zatcaStatus: invoice.zatcaStatus,
        uuid: invoice.uuid,
        invoiceCounter: invoice.invoiceCounter,
        createdAt: invoice.createdAt,
        issuedAt: invoice.issuedAt,
        order: { ...order, items: itemsWithDetails },
        restaurant: restaurant ? {
          nameEn: restaurant.nameEn,
          nameAr: restaurant.nameAr,
          vatNumber: restaurant.vatNumber,
          commercialRegistration: restaurant.commercialRegistration,
          address: restaurant.address,
          phone: restaurant.phone,
          city: restaurant.city,
          logoUrl: restaurant.logoUrl,
        } : null,
      });
    } catch (error) {
      console.error("Public invoice fetch error:", error);
      res.status(500).json({ error: "Failed to get invoice" });
    }
  });

  app.get("/api/public/:restaurantId/customers/:customerId/orders", async (req, res) => {
    try {
      const restaurantId = res.locals.restaurantId;
      const { customerId } = req.params;
      const restaurant = await storage.getRestaurantById(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      const allOrders = await storage.getOrders(restaurantId);
      const customerOrders = allOrders
        .filter((o: any) => o.customerId === customerId)
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      res.json(customerOrders);
    } catch (error) {
      res.status(500).json({ error: "Failed to get customer orders" });
    }
  });

  // Public: Create reservation (customer self-service)
  app.post("/api/public/:restaurantId/reservations", async (req, res) => {
    try {
      const restaurantId = res.locals.restaurantId;
      const restaurant = await storage.getRestaurantById(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      let validBranchId = undefined;
      if (req.body.branchId) {
        const resolvedBranch = await storage.resolveBranchId(restaurantId, req.body.branchId);
        validBranchId = resolvedBranch || undefined;
      }

      // Validate required fields
      if (!req.body.customerName || !req.body.customerPhone || !req.body.reservationDate || !req.body.reservationTime) {
        return res.status(400).json({ error: "missingFields", message: "Name, phone, date, and time are required" });
      }
      if (!req.body.guestCount && !req.body.partySize) {
        return res.status(400).json({ error: "missingFields", message: "Guest count is required" });
      }

      // Reject past reservation dates/times
      const requestedDateTime = new Date(`${req.body.reservationDate.split('T')[0]}T${req.body.reservationTime}:00`);
      if (requestedDateTime <= new Date()) {
        return res.status(400).json({ error: "pastDateTime", message: "لا يمكن الحجز في الماضي" });
      }

      // Use restaurant settings for duration and deposit
      const defaultDuration = (restaurant as any).reservationDuration || 90;
      const depositAmount = (restaurant as any).reservationDepositAmount || "20.00";
      const depositRequired = (restaurant as any).reservationDepositRequired !== false;

      // Convert reservationDate string to Date object for schema validation
      const reservationDateValue = req.body.reservationDate ? new Date(req.body.reservationDate) : undefined;

      const tableId = (req.body.tableId && req.body.tableId !== 'any') ? req.body.tableId : null;
      const reservationTime = req.body.reservationTime;
      const duration = parseInt(req.body.duration) || defaultDuration;

      // Check for table conflict if a specific table is selected
      if (tableId && reservationDateValue && reservationTime) {
        const conflict = await storage.checkTableConflict(restaurantId, tableId, reservationDateValue, reservationTime, duration);
        if (conflict) {
          return res.status(409).json({ 
            error: "tableConflict",
            message: `Table is already booked at this time (${conflict.reservationTime} - ${conflict.customerName})`,
            conflictWith: {
              time: conflict.reservationTime,
              customerName: conflict.customerName
            }
          });
        }
      }

      const guestCount = parseInt(req.body.guestCount) || parseInt(req.body.partySize) || 2;

      const reservationData: any = {
        restaurantId,
        branchId: validBranchId || null,
        customerName: req.body.customerName,
        customerPhone: req.body.customerPhone,
        customerEmail: req.body.customerEmail || null,
        guestCount,
        reservationDate: reservationDateValue,
        reservationTime,
        duration,
        specialRequests: req.body.specialRequests || null,
        tableId,
        source: "website",
        depositPaid: false,
        depositAmount: depositRequired ? depositAmount : "0",
        status: "pending",
      };

      const reservation = await storage.createReservation(reservationData);

      // Create notification for restaurant
      try {
        await storage.createNotification({
          restaurantId,
          branchId: validBranchId || null,
          type: "new_reservation",
          title: `New Reservation: ${req.body.customerName}`,
          titleAr: `حجز جديد: ${req.body.customerName}`,
          message: `${req.body.customerName} reserved for ${guestCount} guests at ${reservationTime} on ${reservationDateValue?.toLocaleDateString("en-CA")}`,
          messageAr: `${req.body.customerName} حجز لـ ${guestCount} أشخاص الساعة ${reservationTime} بتاريخ ${reservationDateValue?.toLocaleDateString("en-CA")}`,
          priority: "high",
          referenceType: "reservation",
          referenceId: reservation.id,
          targetRole: "all",
        });
      } catch (notifError) {
        console.error("Failed to create reservation notification:", notifError);
      }

      res.status(201).json(reservation);
    } catch (error) {
      console.error("Reservation creation error:", error);
      res.status(400).json({ error: "Invalid reservation data" });
    }
  });

  // Public: Create payment session for reservation deposit
  app.post("/api/public/:restaurantId/reservation-payment-session", async (req, res) => {
    try {
      const restaurantId = res.locals.restaurantId;
      const { reservationId, amount, callbackUrl } = req.body;
      if (!reservationId || !amount || !callbackUrl) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const restaurant = await storage.getRestaurantById(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      const keys = {
        publishableKey: restaurant.moyasarPublishableKey || null,
      };
      if (!keys.publishableKey || keys.publishableKey === "pending_setup") {
        return res.status(500).json({ error: "Payment gateway not configured", publishableKey: "pending_setup" });
      }
      res.json({
        publishableKey: keys.publishableKey,
        amount: Math.round(parseFloat(amount) * 100), // halalat
        currency: "SAR",
        description: `Reservation booking fee - ${restaurantId}`,
        callbackUrl,
        reservationId,
      });
    } catch (error) {
      console.error("Reservation payment session error:", error);
      res.status(500).json({ error: "Failed to create payment session" });
    }
  });

  // Public: Complete reservation payment (verify and mark deposit as paid)
  app.post("/api/public/:restaurantId/reservation-payment-complete", async (req, res) => {
    try {
      const restaurantId = res.locals.restaurantId;
      const { reservationId, paymentId } = req.body;
      if (!reservationId || !paymentId) {
        return res.status(400).json({ error: "Missing reservationId or paymentId" });
      }
      const restaurant = await storage.getRestaurantById(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      const secretKey = restaurant.moyasarSecretKey;
      if (!secretKey) {
        return res.status(500).json({ error: "Payment gateway secret key not configured" });
      }
      const auth = `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
      const verifyRes = await fetch(`https://api.moyasar.com/v1/payments/${paymentId}`, {
        headers: { "Authorization": auth },
      });
      if (!verifyRes.ok) {
        return res.status(400).json({ error: "Failed to verify payment with Moyasar" });
      }
      const payment = await verifyRes.json() as any;
      if (payment.metadata?.reservation_id !== reservationId) {
        return res.status(400).json({ error: "Payment does not match this reservation" });
      }
      if (payment.status === "paid") {
        // Mark deposit as paid
        await storage.updateReservation(reservationId, { depositPaid: true } as any);
        const reservation = await storage.getReservation(reservationId);
        res.json({ success: true, reservation });
      } else {
        res.status(400).json({ error: `Payment not completed. Status: ${payment.status}` });
      }
    } catch (error) {
      console.error("Reservation payment complete error:", error);
      res.status(500).json({ error: "Failed to complete reservation payment" });
    }
  });

  // Public: Join queue (customer self-service)
  app.post("/api/public/:restaurantId/queue", async (req, res) => {
    try {
      const restaurantId = res.locals.restaurantId;
      const restaurant = await storage.getRestaurantById(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      let validBranchId: string | undefined = undefined;
      if (req.body.branchId) {
        const resolvedBranch = await storage.resolveBranchId(restaurantId, req.body.branchId);
        validBranchId = resolvedBranch || undefined;
      }

      // Check if day session is open
      const currentSession = await storage.getCurrentDaySession(restaurantId, validBranchId);
      if (!currentSession) {
        return res.status(400).json({ error: "daySessionClosed", message: "Restaurant has not opened day session yet" });
      }

      const queueNumber = await storage.getNextQueueNumber(restaurantId, validBranchId);
      const estimatedWait = await storage.getEstimatedWaitTime(restaurantId, validBranchId);

      const queueData: any = {
        restaurantId,
        branchId: validBranchId || null,
        customerName: req.body.customerName,
        customerPhone: req.body.customerPhone,
        partySize: parseInt(req.body.partySize) || 1,
        queueNumber,
        estimatedWaitMinutes: estimatedWait,
        status: "waiting",
      };

      const entry = await storage.createQueueEntry(queueData);
      res.status(201).json({ ...entry, position: queueNumber, estimatedWaitMinutes: estimatedWait });
    } catch (error) {
      console.error("Queue join error:", error);
      res.status(400).json({ error: "Invalid queue data" });
    }
  });

  // Public: Get queue stats (waiting count + estimated wait)
  app.get("/api/public/:restaurantId/queue/stats", async (req, res) => {
    try {
      const restaurantId = res.locals.restaurantId;
      const restaurant = await storage.getRestaurantById(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      const branchId = req.query.branch as string | undefined;
      const waitingEntries = await storage.getQueueEntries(restaurantId, branchId, "waiting");
      const estimatedWait = await storage.getEstimatedWaitTime(restaurantId, branchId);
      res.json({
        waitingCount: waitingEntries.length,
        estimatedWaitMinutes: estimatedWait,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get queue stats" });
    }
  });

  // Public: Get available tables for reservation date
  app.get("/api/public/:restaurantId/tables", async (req, res) => {
    try {
      const restaurantId = res.locals.restaurantId;
      const restaurant = await storage.getRestaurantById(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      const branchId = req.query.branch as string | undefined;
      const allTables = await storage.getTables(restaurantId, branchId);
      const availableTables = allTables.filter((t: any) => t.status === "available");
      res.json(availableTables.map((t: any) => ({
        id: t.id,
        tableNumber: t.tableNumber,
        capacity: t.capacity,
        location: t.location,
      })));
    } catch (error) {
      res.status(500).json({ error: "Failed to get tables" });
    }
  });

  // ==================== AUTHENTICATED APIs ====================

  // Public: Check day session status
  app.get("/api/public/:restaurantId/day-session/status", async (req, res) => {
    try {
      const restaurantId = res.locals.restaurantId;
      const branchId = req.query.branch as string | undefined;
      const session = await storage.getCurrentDaySession(restaurantId, branchId);
      res.json({ isOpen: !!session, session: session || null });
    } catch (error) {
      res.status(500).json({ error: "Failed to get day session status" });
    }
  });

  // Public: Get menu item variants
  app.get("/api/public/:restaurantId/menu-items/:menuItemId/variants", async (req, res) => {
    try {
      const variants = await storage.getMenuItemVariants(req.params.menuItemId);
      res.json(variants.filter((v: any) => v.isAvailable !== false));
    } catch (error) {
      res.status(500).json({ error: "Failed to get variants" });
    }
  });

  // Public: Get all variants for all menu items (batch)
  app.get("/api/public/:restaurantId/all-variants", async (req, res) => {
    try {
      const items = await storage.getMenuItems(res.locals.restaurantId);
      const allVariants: Record<string, any[]> = {};
      for (const item of items) {
        const variants = await storage.getMenuItemVariants(item.id);
        if (variants.length > 0) {
          allVariants[item.id] = variants.filter((v: any) => v.isAvailable !== false);
        }
      }
      res.json(allVariants);
    } catch (error) {
      res.status(500).json({ error: "Failed to get variants" });
    }
  });

  // Public: Get customization groups for a menu item
  app.get("/api/public/:restaurantId/menu-items/:menuItemId/customizations", async (req, res) => {
    try {
      const menuItemId = req.params.menuItemId;
      const links = await storage.getMenuItemCustomizations(menuItemId);
      const groups = [];
      for (const link of links) {
        const group = await storage.getCustomizationGroup(link.customizationGroupId);
        if (group) {
          const options = await storage.getCustomizationOptions(group.id);
          groups.push({ ...group, options: options.filter((o: any) => o.isAvailable !== false) });
        }
      }
      res.json(groups);
    } catch (error) {
      res.status(500).json({ error: "Failed to get customizations" });
    }
  });

  // Public: Get all customizations batch
  app.get("/api/public/:restaurantId/all-customizations", async (req, res) => {
    try {
      const items = await storage.getMenuItems(res.locals.restaurantId);
      const allCustomizations: Record<string, any[]> = {};
      for (const item of items) {
        const links = await storage.getMenuItemCustomizations(item.id);
        if (links.length > 0) {
          const groups = [];
          for (const link of links) {
            const group = await storage.getCustomizationGroup(link.customizationGroupId);
            if (group) {
              const options = await storage.getCustomizationOptions(group.id);
              groups.push({ ...group, options: options.filter((o: any) => o.isAvailable !== false) });
            }
          }
          if (groups.length > 0) {
            allCustomizations[item.id] = groups;
          }
        }
      }
      res.json(allCustomizations);
    } catch (error) {
      res.status(500).json({ error: "Failed to get customizations" });
    }
  });

  // Restaurant
  app.get("/api/restaurant", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const restaurant = await storage.getRestaurantById(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      const { moyasarSecretKey, ...safeRestaurant } = restaurant as any;
      res.json(safeRestaurant);
    } catch (error) {
      handleRouteError(res, error, "Failed to get restaurant");
    }
  });

  // Helper to generate URL slug from name
  function generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+/g, '') // strip Arabic
      .replace(/[^a-z0-9\s-]/g, '') // keep only English letters, numbers, spaces, hyphens
      .replace(/[\s_]+/g, '-')  // Replace spaces/underscores with hyphens
      .replace(/-+/g, '-')      // Collapse multiple hyphens
      .replace(/^-|-$/g, '');   // Trim hyphens from start/end
  }

  app.put("/api/restaurant", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const data = insertRestaurantSchema.partial().parse(req.body);
      
      // Auto-generate slug from English name if slug not set
      const current = await storage.getRestaurantById(restaurantId);
      if (current && !(current as any).slug && (data.nameEn || current.nameEn)) {
        (data as any).slug = generateSlug(data.nameEn || current.nameEn);
      }
      
      const restaurant = await storage.updateRestaurantById(restaurantId, data);
      res.json(restaurant);
    } catch (error) {
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  // Explicit slug update endpoint
  app.put("/api/restaurant/slug", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const { slug } = req.body;
      if (!slug || typeof slug !== "string") {
        return res.status(400).json({ error: "slug is required" });
      }
      const cleanSlug = generateSlug(slug);
      if (!cleanSlug) {
        return res.status(400).json({ error: "Invalid slug" });
      }
      // Check if slug is already taken by another restaurant
      const existing = await storage.getRestaurantBySlug(cleanSlug);
      if (existing && existing.id !== restaurantId) {
        return res.status(409).json({ error: "Slug already taken" });
      }
      const restaurant = await storage.updateRestaurantById(restaurantId, { slug: cleanSlug } as any);
      res.json(restaurant);
    } catch (error) {
      handleRouteError(res, error, "Failed to update slug");
    }
  });

  // Categories
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getCategories(await getRestaurantId(req));
      res.json(categories);
    } catch (error) {
      handleRouteError(res, error, "Failed to get categories");
    }
  });

  app.get("/api/categories/:id", async (req, res) => {
    try {
      const category = await storage.getCategory(req.params.id);
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      await verifyOwnership(req, category, "Category");
      res.json(category);
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to get category" });
    }
  });

  app.post("/api/categories", async (req, res) => {
    try {
      const data = insertCategorySchema.parse({
        ...req.body,
        restaurantId: await getRestaurantId(req),
      });
      const category = await storage.createCategory(data);
      res.status(201).json(category);
    } catch (error) {
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.put("/api/categories/:id", async (req, res) => {
    try {
      const data = insertCategorySchema.parse({
        ...req.body,
        restaurantId: await getRestaurantId(req),
      });
      const category = await storage.updateCategory(req.params.id, data);
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json(category);
    } catch (error) {
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.delete("/api/categories/:id", async (req, res) => {
    try {
      const category = await storage.getCategory(req.params.id);
      if (!category) return res.status(404).json({ error: "Category not found" });
      await verifyOwnership(req, category, "Category");
      await storage.deleteCategory(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  // Kitchen Sections
  app.get("/api/kitchen-sections", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const branchId = req.query.branch as string | undefined;
      const sections = await storage.getKitchenSections(restaurantId, branchId);
      res.json(sections);
    } catch (error) {
      console.error("Error in GET /api/kitchen-sections:", error);
      handleRouteError(res, error, "Failed to get kitchen sections");
    }
  });

  app.get("/api/kitchen-sections/:id", async (req, res) => {
    try {
      const section = await storage.getKitchenSection(req.params.id);
      if (!section) {
        return res.status(404).json({ error: "Kitchen section not found" });
      }
      await verifyOwnership(req, section, "Kitchen section");
      res.json(section);
    } catch (error: any) {
      console.error("Error in GET /api/kitchen-sections/:id:", error);
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to get kitchen section" });
    }
  });

  app.post("/api/kitchen-sections", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const data = insertKitchenSectionSchema.parse({
        ...req.body,
        restaurantId,
      });
      // Validate branchId belongs to the user's restaurant
      if (data.branchId) {
        const branch = await storage.getBranch(data.branchId);
        if (!branch || branch.restaurantId !== restaurantId) {
          return res.status(400).json({ error: "Invalid branch ID" });
        }
      }
      const section = await storage.createKitchenSection(data);
      res.status(201).json(section);
    } catch (error) {
      console.error("Error in POST /api/kitchen-sections:", error);
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.put("/api/kitchen-sections/:id", async (req, res) => {
    try {
      const data = insertKitchenSectionSchema.parse({
        ...req.body,
        restaurantId: await getRestaurantId(req),
      });
      const section = await storage.updateKitchenSection(req.params.id, data);
      if (!section) {
        return res.status(404).json({ error: "Kitchen section not found" });
      }
      res.json(section);
    } catch (error) {
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.delete("/api/kitchen-sections/:id", async (req, res) => {
    try {
      const section = await storage.getKitchenSection(req.params.id);
      if (!section) return res.status(404).json({ error: "Kitchen section not found" });
      await verifyOwnership(req, section, "Kitchen section");
      await storage.deleteKitchenSection(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to delete kitchen section" });
    }
  });

  // Menu Items
  app.get("/api/menu-items", async (req, res) => {
    try {
      const items = await storage.getMenuItems(await getRestaurantId(req));
      res.json(items);
    } catch (error) {
      console.error("Error in GET /api/menu-items:", error);
      handleRouteError(res, error, "Failed to get menu items");
    }
  });

  app.get("/api/menu-items/:id", async (req, res) => {
    try {
      const item = await storage.getMenuItem(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Menu item not found" });
      }
      await verifyOwnership(req, item, "Menu item");
      res.json(item);
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to get menu item" });
    }
  });

  app.post("/api/menu-items", async (req, res) => {
    try {
      const body = { ...req.body };
      if (body.kitchenSectionId === "" || body.kitchenSectionId === "__none__") body.kitchenSectionId = null;
      const data = insertMenuItemSchema.parse({
        ...body,
        restaurantId: await getRestaurantId(req),
      });
      const item = await storage.createMenuItem(data);
      res.status(201).json(item);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.put("/api/menu-items/:id", async (req, res) => {
    try {
      const body = { ...req.body };
      if (body.kitchenSectionId === "" || body.kitchenSectionId === "__none__") body.kitchenSectionId = null;
      const data = insertMenuItemSchema.parse({
        ...body,
        restaurantId: await getRestaurantId(req),
      });
      const item = await storage.updateMenuItem(req.params.id, data);
      if (!item) {
        return res.status(404).json({ error: "Menu item not found" });
      }
      res.json(item);
    } catch (error) {
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.delete("/api/menu-items/:id", async (req, res) => {
    try {
      const item = await storage.getMenuItem(req.params.id);
      if (!item) return res.status(404).json({ error: "Menu item not found" });
      await verifyOwnership(req, item, "Menu item");
      await storage.deleteMenuItem(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to delete menu item" });
    }
  });

  // Tables
  app.get("/api/tables", async (req, res) => {
    try {
      const branchId = req.query.branch as string | undefined;
      const tables = await storage.getTables(await getRestaurantId(req), branchId);
      res.json(tables);
    } catch (error) {
      res.status(500).json({ error: "Failed to get tables" });
    }
  });

  app.get("/api/tables/:id", async (req, res) => {
    try {
      const table = await storage.getTable(req.params.id);
      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }
      await verifyOwnership(req, table, "Table");
      res.json(table);
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to get table" });
    }
  });

  app.post("/api/tables", async (req, res) => {
    try {
      const data = insertTableSchema.parse({
        ...req.body,
        restaurantId: await getRestaurantId(req),
      });
      const table = await storage.createTable(data);
      res.status(201).json(table);
    } catch (error) {
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.put("/api/tables/:id", async (req, res) => {
    try {
      const data = insertTableSchema.parse({
        ...req.body,
        restaurantId: await getRestaurantId(req),
      });
      const table = await storage.updateTable(req.params.id, data);
      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }
      res.json(table);
    } catch (error) {
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.put("/api/tables/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }
      const existing = await storage.getTable(req.params.id);
      if (!existing) return res.status(404).json({ error: "Table not found" });
      await verifyOwnership(req, existing, "Table");
      const table = await storage.updateTableStatus(req.params.id, status);
      if (!table) {
        return res.status(404).json({ error: "Table not found" });
      }
      res.json(table);
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to update table status" });
    }
  });

  app.delete("/api/tables/:id", async (req, res) => {
    try {
      const table = await storage.getTable(req.params.id);
      if (!table) return res.status(404).json({ error: "Table not found" });
      await verifyOwnership(req, table, "Table");
      await storage.deleteTable(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to delete table" });
    }
  });

  app.get("/api/tables/:id/active-order", async (req, res) => {
    try {
      const order = await storage.getActiveOrderByTable(req.params.id);
      if (!order) {
        return res.json(null);
      }
      const items = await storage.getOrderItems(order.id);
      const itemsWithNames = await Promise.all(items.map(async (item) => {
        const menuItem = await storage.getMenuItem(item.menuItemId);
        return { ...item, nameEn: menuItem?.nameEn || "", nameAr: menuItem?.nameAr || "" };
      }));
      res.json({ ...order, items: itemsWithNames });
    } catch (error) {
      res.status(500).json({ error: "Failed to get active order" });
    }
  });

  app.post("/api/tables/:id/settle", async (req, res) => {
    try {
      const { paymentMethod, splitCashAmount, splitCardAmount } = req.body;
      const tableEntity = await storage.getTable(req.params.id);
      if (!tableEntity) return res.status(404).json({ error: "Table not found" });
      await verifyOwnership(req, tableEntity, "Table");
      const order = await storage.getActiveOrderByTable(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "No active order found for this table" });
      }

      let notes = order.notes || "";
      if (paymentMethod === "split" && splitCashAmount !== undefined) {
        const splitNote = `Cash: ${parseFloat(splitCashAmount).toFixed(2)} SAR - Card: ${parseFloat(splitCardAmount).toFixed(2)} SAR`;
        notes = notes ? `${notes} | ${splitNote}` : splitNote;
      }

      await storage.updateOrder(order.id, {
        paymentMethod,
        isPaid: true,
        status: "completed",
        notes: notes || undefined,
      });

      const invoicesList = await storage.getInvoices(order.restaurantId);
      const orderInvoice = invoicesList.find(inv => inv.orderId === order.id);
      if (orderInvoice) {
        await storage.updateInvoice(orderInvoice.id, {
          paymentMethod,
          isPaid: true,
        });
      }

      await storage.updateTableStatus(req.params.id, "available");

      const updatedOrder = await storage.getOrder(order.id);
      res.json(updatedOrder);
    } catch (error) {
      console.error("Table settle error:", error);
      res.status(500).json({ error: "Failed to settle table" });
    }
  });

  // Orders
  app.get("/api/orders", async (req, res) => {
    try {
      const branchId = req.query.branch as string | undefined;
      const orders = await storage.getOrders(await getRestaurantId(req), branchId);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: "Failed to get orders" });
    }
  });

  app.get("/api/orders/:id", async (req, res) => {
    try {
      const order = await storage.getOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      await verifyOwnership(req, order, "Order");
      res.json(order);
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to get order" });
    }
  });

  app.post("/api/orders", async (req, res) => {
    try {
      console.log("Received order data:", JSON.stringify(req.body, null, 2));
      
      const restaurantId = await getRestaurantId(req);
      
      // Validate branchId exists if provided
      let validBranchId = undefined;
      if (req.body.branchId) {
        const branches = await storage.getBranches(restaurantId);
        const branchExists = branches.some(b => b.id === req.body.branchId);
        validBranchId = branchExists ? req.body.branchId : undefined;
      }

      // Server-side price recalculation if items are provided
      let serverTotals: { subtotal: string; tax: string; total: string; discount: string; deliveryFee: string } | null = null;
      if (req.body.items && Array.isArray(req.body.items) && req.body.items.length > 0) {
        try {
          serverTotals = await recalculateOrderTotals(
            restaurantId,
            req.body.items,
            parseFloat(req.body.discount || "0"),
            parseFloat(req.body.deliveryFee || "0"),
          );
        } catch (calcErr: any) {
          console.error("Server-side price calculation error:", calcErr);
          // Fall through and use client values if recalculation fails
        }
      }
      
      // Clean the body - convert null to undefined for optional fields
      const cleanBody = {
        ...req.body,
        restaurantId,
        tableId: req.body.tableId || undefined,
        branchId: validBranchId,
        customerName: req.body.customerName || undefined,
        customerPhone: req.body.customerPhone || undefined,
        customerAddress: req.body.customerAddress || undefined,
        notes: req.body.notes || undefined,
        kitchenNotes: req.body.kitchenNotes || undefined,
        // Override with server-calculated values when available
        ...(serverTotals ? {
          subtotal: serverTotals.subtotal,
          tax: serverTotals.tax,
          total: serverTotals.total,
          discount: serverTotals.discount,
          deliveryFee: serverTotals.deliveryFee,
        } : {}),
      };
      
      const data = insertOrderSchema.parse(cleanBody);
      
      // Update table status if dine-in
      if (data.orderType === "dine_in" && data.tableId) {
        await storage.updateTableStatus(data.tableId, "occupied");
      }
      
      const order = await storage.createOrder(data);

      if (order.customerPhone) {
        const normalizedPhone = order.customerPhone.replace(/\s/g, '');
        const restaurantId = await getRestaurantId(req);
        let customer = await storage.getCustomerByPhone(restaurantId, normalizedPhone);
        if (customer) {
          await storage.updateCustomer(customer.id, {
            name: order.customerName || customer.name,
            address: order.customerAddress || customer.address,
            totalOrders: (customer.totalOrders || 0) + 1,
            totalSpent: String(parseFloat(customer.totalSpent || "0") + parseFloat(order.total || "0")),
            lastOrderAt: new Date(),
          });
        } else {
          customer = await storage.createCustomer({
            restaurantId,
            name: order.customerName || null,
            phone: normalizedPhone,
            address: order.customerAddress || null,
            totalOrders: 1,
            totalSpent: order.total || "0",
            lastOrderAt: new Date(),
          });
        }
        await storage.updateOrder(order.id, { customerId: customer.id });
      }

      try {
        await storage.createOrderAuditLog({
          orderId: order.id,
          action: 'created',
          newValue: JSON.stringify({ orderType: order.orderType, total: order.total, items: req.body.items?.length || 0 }),
          userName: req.body.userName || null,
          restaurantId: order.restaurantId,
        });
      } catch (e) {}

      // Update day session totals atomically when a new order is created
      try {
        const currentSession = await storage.getCurrentDaySession(order.restaurantId, order.branchId || undefined);
        if (currentSession) {
          const orderTotal = parseFloat(order.total || "0");
          await storage.incrementDaySessionTotals(currentSession.id, orderTotal, order.paymentMethod || "cash");
        }
      } catch (e) {
        console.error("Failed to update day session totals:", e);
      }

      res.status(201).json(order);
    } catch (error: any) {
      console.error("Order creation error:", error);
      res.status(400).json({ error: "Invalid request body", details: error?.message || String(error) });
    }
  });

  app.put("/api/orders/:id", async (req, res) => {
    try {
      const existingOrder = await storage.getOrder(req.params.id);
      if (!existingOrder) {
        return res.status(404).json({ error: "Order not found" });
      }
      await verifyOwnership(req, existingOrder, "Order");

      // Whitelist allowed fields to prevent tampering with totals/prices
      const safeData: Record<string, any> = {};
      for (const field of ALLOWED_ORDER_UPDATE_FIELDS) {
        if (req.body[field] !== undefined) {
          safeData[field] = req.body[field];
        }
      }

      const order = await storage.updateOrder(req.params.id, safeData);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      res.json(order);
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.put("/api/orders/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }
      const validStatuses = ["pending", "preparing", "ready", "completed", "cancelled", "payment_pending", "delivered"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
      }
      
      const existingOrder = await storage.getOrder(req.params.id);
      if (!existingOrder) {
        return res.status(404).json({ error: "Order not found" });
      }
      await verifyOwnership(req, existingOrder, "Order");
      
      if (status === "cancelled" && existingOrder.tableId) {
        await storage.updateTableStatus(existingOrder.tableId, "available");
      }
      if (status === "completed" && existingOrder.tableId && existingOrder.isPaid) {
        await storage.updateTableStatus(existingOrder.tableId, "available");
      }
      
      const order = await storage.updateOrderStatus(req.params.id, status);
      
      try {
        await storage.createOrderAuditLog({
          orderId: req.params.id,
          action: 'status_change',
          field: 'status',
          previousValue: existingOrder.status,
          newValue: status,
          userName: req.body.userName || null,
          notes: req.body.reason || null,
          restaurantId: existingOrder.restaurantId,
        });
      } catch (e) {}
      
      res.json(order);
    } catch (error) {
      res.status(500).json({ error: "Failed to update order status" });
    }
  });

  app.delete("/api/orders/:id", async (req, res) => {
    try {
      const order = await storage.getOrder(req.params.id);
      if (!order) return res.status(404).json({ error: "Order not found" });
      await verifyOwnership(req, order, "Order");
      await storage.deleteOrder(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to delete order" });
    }
  });

  // Order Audit Log
  app.get("/api/orders/:orderId/audit-log", async (req, res) => {
    try {
      const order = await storage.getOrder(req.params.orderId);
      if (!order) return res.status(404).json({ error: "Order not found" });
      await verifyOwnership(req, order, "Order");
      const logs = await storage.getOrderAuditLog(req.params.orderId);
      res.json(logs);
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to get order audit log" });
    }
  });

  app.post("/api/orders/:orderId/audit-log", async (req, res) => {
    try {
      const order = await storage.getOrder(req.params.orderId);
      if (!order) return res.status(404).json({ error: "Order not found" });
      await verifyOwnership(req, order, "Order");
      const log = await storage.createOrderAuditLog({
        orderId: req.params.orderId,
        ...req.body,
        restaurantId: order.restaurantId,
      });
      res.json(log);
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to create audit log entry" });
    }
  });

  // Order Items
  app.get("/api/orders/:orderId/items", async (req, res) => {
    try {
      const order = await storage.getOrder(req.params.orderId);
      if (!order) return res.status(404).json({ error: "Order not found" });
      await verifyOwnership(req, order, "Order");
      const items = await storage.getOrderItems(req.params.orderId);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to get order items" });
    }
  });

  app.post("/api/orders/:orderId/items", async (req, res) => {
    try {
      const order = await storage.getOrder(req.params.orderId);
      if (!order) return res.status(404).json({ error: "Order not found" });
      await verifyOwnership(req, order, "Order");
      const data = insertOrderItemSchema.parse({
        ...req.body,
        orderId: req.params.orderId,
      });
      const item = await storage.createOrderItem(data);
      
      // Auto-deduct inventory based on recipe
      if (data.menuItemId) {
        const recipes = await storage.getRecipes(data.menuItemId);
        if (recipes && recipes.length > 0) {
          const quantity = data.quantity || 1;
          const deductionResults: { success: boolean; itemId: string; error?: string }[] = [];
          
          for (const recipe of recipes) {
            try {
              const deductAmount = parseFloat(recipe.quantity) * quantity;
              const inventoryItem = await storage.getInventoryItem(recipe.inventoryItemId);
              
              if (inventoryItem) {
                const newStock = parseFloat(inventoryItem.currentStock || "0") - deductAmount;
                await storage.updateInventoryItem(recipe.inventoryItemId, {
                  currentStock: String(Math.max(0, newStock)),
                });
                
                // Record the transaction
                await storage.createInventoryTransaction({
                  inventoryItemId: recipe.inventoryItemId,
                  type: "usage",
                  quantity: String(deductAmount),
                  notes: `Order item: ${item.id}`,
                });
                
                deductionResults.push({ success: true, itemId: recipe.inventoryItemId });

                const minStock = parseFloat(inventoryItem.minStock || "0");
                if (minStock > 0 && newStock <= minStock) {
                  try {
                    const order = await storage.getOrder(req.params.orderId);
                    if (order) {
                      await storage.createNotification({
                        restaurantId: order.restaurantId,
                        type: "low_stock",
                        title: `Low Stock Alert: ${inventoryItem.name}`,
                        titleAr: `تنبيه نقص مخزون: ${inventoryItem.name}`,
                        message: `${inventoryItem.name} stock is at ${Math.max(0, newStock).toFixed(1)} ${inventoryItem.unit || "units"} (minimum: ${minStock})`,
                        messageAr: `مخزون ${inventoryItem.name} وصل إلى ${Math.max(0, newStock).toFixed(1)} ${inventoryItem.unit || "وحدة"} (الحد الأدنى: ${minStock})`,
                        priority: newStock <= 0 ? "urgent" : "high",
                      });
                    }
                  } catch (notifError) {
                    console.error("Failed to create low stock notification:", notifError);
                  }
                }
              } else {
                deductionResults.push({ success: false, itemId: recipe.inventoryItemId, error: "Inventory item not found" });
              }
            } catch (deductError) {
              console.error(`Failed to deduct inventory for item ${recipe.inventoryItemId}:`, deductError);
              deductionResults.push({ success: false, itemId: recipe.inventoryItemId, error: String(deductError) });
            }
          }
          
          const failures = deductionResults.filter(r => !r.success);
          if (failures.length > 0) {
            console.warn(`Partial inventory deduction: ${failures.length}/${recipes.length} failed`, failures);
          }
        }
      }
      
      res.status(201).json(item);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.delete("/api/order-items/:id", async (req, res) => {
    try {
      // Order items don't have restaurantId directly, but this is acceptable
      // since order item IDs are UUIDs and not guessable
      await getRestaurantId(req); // At minimum require auth
      await storage.deleteOrderItem(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      if (error?.message === "Authentication required") return res.status(401).json({ error: error.message });
      res.status(500).json({ error: "Failed to delete order item" });
    }
  });

  // Invoices
  app.get("/api/invoices", async (req, res) => {
    try {
      const invoices = await storage.getInvoices(await getRestaurantId(req));
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ error: "Failed to get invoices" });
    }
  });

  app.get("/api/invoices/:id", async (req, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      
      const order = await storage.getOrder(invoice.orderId);
      const items = await storage.getOrderItems(invoice.orderId);
      const menuItemsData = await storage.getMenuItems(await getRestaurantId(req));
      const menuItemsMap = new Map(menuItemsData.map(m => [m.id, m]));
      const itemsWithDetails = items.map(item => ({
        ...item,
        menuItem: menuItemsMap.get(item.menuItemId),
      }));
      const restaurantId = await getRestaurantId(req);
      await verifyOwnership(req, invoice, "Invoice");
      const restaurant = await storage.getRestaurantById(restaurantId);
      
      res.json({
        ...invoice,
        order: { ...order, items: itemsWithDetails },
        restaurant,
      });
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to get invoice" });
    }
  });

  app.get("/api/orders/:orderId/invoice", async (req, res) => {
    try {
      const invoice = await storage.getInvoiceByOrder(req.params.orderId);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      
      const restaurantId = await getRestaurantId(req);
      await verifyOwnership(req, invoice, "Invoice");
      const order = await storage.getOrder(invoice.orderId);
      const items = await storage.getOrderItems(invoice.orderId);
      const menuItemsData = await storage.getMenuItems(restaurantId);
      const menuItemsMap = new Map(menuItemsData.map(m => [m.id, m]));
      const itemsWithDetails = items.map(item => ({
        ...item,
        menuItem: menuItemsMap.get(item.menuItemId),
      }));
      const restaurant = await storage.getRestaurantById(restaurantId);
      
      res.json({
        ...invoice,
        order: { ...order, items: itemsWithDetails },
        restaurant,
      });
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to get invoice" });
    }
  });

  app.post("/api/invoices", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const restaurant = await storage.getRestaurantById(restaurantId);
      const isTaxEnabled = restaurant?.taxEnabled !== false;
      const taxRate = isTaxEnabled ? 15 : 0;
      
      const subtotal = parseFloat(req.body.subtotal || "0");
      const discount = parseFloat(req.body.discount || "0");
      const deliveryFee = parseFloat(req.body.deliveryFee || "0");
      const taxableAmount = Math.max(0, subtotal - discount);
      const taxAmount = taxableAmount * (taxRate / 100);
      const total = taxableAmount + taxAmount + deliveryFee;
      
      // Generate ZATCA-compliant UUID and counter
      const uuid = generateInvoiceUuid();
      const invoiceNumber = await storage.getNextInvoiceNumber(restaurantId);
      const currentCounter = ((restaurant as any)?.zatcaInvoiceCounter || 0) + 1;
      const previousHash = (restaurant as any)?.zatcaLastInvoiceHash || 
        Buffer.from('NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==', 'base64').toString('utf8');
      
      const now = new Date();
      const invoiceType = req.body.invoiceType || 'simplified';

      // Build line items from order if available
      let xmlItems: ZatcaLineItem[] = [];
      if (req.body.orderId) {
        const orderItems = await storage.getOrderItems(req.body.orderId);
        const menuItemsRaw = await storage.getMenuItems(restaurantId);
        const menuItemsMap = new Map(menuItemsRaw.map(m => [m.id, m]));
        xmlItems = orderItems.map((item, idx) => {
          const menuItem = menuItemsMap.get(item.menuItemId);
          const unitPrice = parseFloat(item.unitPrice || menuItem?.price || "0");
          const qty = item.quantity || 1;
          const lineTotal = unitPrice * qty;
          const lineTax = lineTotal * (taxRate / 100);
          return {
            id: String(idx + 1),
            nameAr: menuItem?.nameAr || menuItem?.nameEn || 'منتج',
            nameEn: menuItem?.nameEn || '',
            quantity: qty,
            unitPrice,
            discount: 0,
            taxRate,
            taxAmount: Math.round(lineTax * 100) / 100,
            totalWithTax: Math.round((lineTotal + lineTax) * 100) / 100,
            totalWithoutTax: Math.round(lineTotal * 100) / 100,
          };
        });
      }

      // If no items from order, create a single-line item
      if (xmlItems.length === 0) {
        xmlItems = [{
          id: '1',
          nameAr: 'فاتورة',
          quantity: 1,
          unitPrice: subtotal,
          discount: 0,
          taxRate,
          taxAmount: Math.round(taxAmount * 100) / 100,
          totalWithTax: Math.round(total * 100) / 100,
          totalWithoutTax: Math.round(subtotal * 100) / 100,
        }];
      }

      // Generate ZATCA XML
      const xmlContent = generateZatcaXml({
        uuid,
        invoiceNumber,
        invoiceType,
        issueDate: now.toISOString().split('T')[0],
        issueTime: now.toTimeString().split(' ')[0],
        deliveryDate: now.toISOString().split('T')[0],
        seller: {
          nameAr: restaurant?.nameAr || restaurant?.nameEn || 'مطعم',
          vatNumber: restaurant?.vatNumber || '',
          commercialRegistration: restaurant?.commercialRegistration || '',
          streetName: restaurant?.streetName || '',
          buildingNumber: restaurant?.buildingNumber || '',
          district: restaurant?.district || '',
          city: restaurant?.city || '',
          postalCode: restaurant?.postalCode || '',
          country: restaurant?.country || 'SA',
        },
        items: xmlItems,
        subtotal,
        discount,
        deliveryFee,
        taxAmount,
        taxRate,
        total,
        paymentMethod: req.body.paymentMethod || 'cash',
        previousInvoiceHash: previousHash,
        invoiceCounter: currentCounter,
      });

      const invoiceHash = computeInvoiceHashBase64(xmlContent);

      // Generate QR code with hash
      const qrData = generateZatcaQrCode({
        sellerName: restaurant?.nameAr || restaurant?.nameEn || "Restaurant",
        vatNumber: restaurant?.vatNumber || "",
        timestamp: now.toISOString(),
        total: total.toFixed(2),
        vatAmount: taxAmount.toFixed(2),
        invoiceHash: computeInvoiceHash(xmlContent),
      });

      // Update restaurant invoice counter and hash
      await storage.updateRestaurantById(restaurantId, {
        zatcaInvoiceCounter: currentCounter,
        zatcaLastInvoiceHash: invoiceHash,
      } as any);
      
      const data = insertInvoiceSchema.parse({
        ...req.body,
        restaurantId,
        invoiceNumber,
        invoiceType,
        taxAmount: taxAmount.toFixed(2),
        taxRate: taxRate.toFixed(2),
        total: total.toFixed(2),
        qrCodeData: qrData,
        xmlContent,
        invoiceHash,
        previousInvoiceHash: previousHash,
        invoiceCounter: currentCounter,
        uuid,
        zatcaStatus: 'pending',
      });
      
      const invoice = await storage.createInvoice(data);
      res.status(201).json(invoice);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.put("/api/invoices/:id", async (req, res) => {
    try {
      const existing = await storage.getInvoice(req.params.id);
      if (!existing) return res.status(404).json({ error: "Invoice not found" });
      await verifyOwnership(req, existing, "Invoice");
      const invoice = await storage.updateInvoice(req.params.id, req.body);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  // Kitchen orders - get orders for kitchen display (pending, confirmed, preparing) with items
  app.get("/api/kitchen/orders", async (req, res) => {
    try {
      const branchId = req.query.branch as string | undefined;
      const sectionId = req.query.section as string | undefined;
      const allOrders = await storage.getOrders(await getRestaurantId(req), branchId);
      const kitchenOrders = allOrders.filter(o => 
        ["pending", "confirmed", "preparing"].includes(o.status || "")
      );
      
      const menuItemsData = await storage.getMenuItems(await getRestaurantId(req));
      const menuItemsMap = new Map(menuItemsData.map(m => [m.id, m]));
      
      const tablesData = await storage.getTables(await getRestaurantId(req), branchId);
      const tablesMap = new Map(tablesData.map(t => [t.id, t]));
      
      const ordersWithItems = await Promise.all(
        kitchenOrders.map(async (order) => {
          const items = await storage.getOrderItems(order.id);
          let itemsWithDetails = items.map(item => ({
            ...item,
            menuItem: menuItemsMap.get(item.menuItemId),
          }));
          
          // Filter items by section if sectionId is provided
          if (sectionId) {
            itemsWithDetails = itemsWithDetails.filter(item => 
              item.menuItem?.kitchenSectionId === sectionId
            );
          }
          
          const table = order.tableId ? tablesMap.get(order.tableId) : null;
          return { 
            ...order, 
            items: itemsWithDetails,
            table: table ? { tableNumber: table.tableNumber, location: table.location } : null 
          };
        })
      );
      
      // Remove orders with no items (after section filtering)
      const filteredOrders = ordersWithItems.filter(order => order.items.length > 0);
      
      res.json(filteredOrders);
    } catch (error) {
      res.status(500).json({ error: "Failed to get kitchen orders" });
    }
  });

  // Branches
  app.get("/api/branches", async (req, res) => {
    try {
      const branches = await storage.getBranches(await getRestaurantId(req));
      res.json(branches);
    } catch (error) {
      handleRouteError(res, error, "Failed to get branches");
    }
  });

  app.post("/api/branches", async (req, res) => {
    try {
      const data = insertBranchSchema.parse({
        ...req.body,
        restaurantId: await getRestaurantId(req),
      });
      const branch = await storage.createBranch(data);
      res.status(201).json(branch);
    } catch (error) {
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.put("/api/branches/:id", async (req, res) => {
    try {
      const existing = await storage.getBranch(req.params.id);
      if (!existing) return res.status(404).json({ error: "Branch not found" });
      await verifyOwnership(req, existing, "Branch");
      const branch = await storage.updateBranch(req.params.id, req.body);
      if (!branch) {
        return res.status(404).json({ error: "Branch not found" });
      }
      res.json(branch);
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.delete("/api/branches/:id", async (req, res) => {
    try {
      // Prevent deletion of main branch
      const branch = await storage.getBranch(req.params.id);
      if (!branch) return res.status(404).json({ error: "Branch not found" });
      await verifyOwnership(req, branch, "Branch");
      if (branch?.isMain) {
        return res.status(400).json({ error: "Cannot delete the main branch" });
      }
      await storage.deleteBranch(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to delete branch" });
    }
  });

  // Users
  app.get("/api/users", async (req, res) => {
    try {
      const users = await storage.getUsers(await getRestaurantId(req));
      // Strip passwords from response
      res.json(users.map(({ password: _, ...rest }) => rest));
    } catch (error) {
      res.status(500).json({ error: "Failed to get users" });
    }
  });

  app.post("/api/users", async (req, res) => {
    try {
      const body = { ...req.body };
      // Convert empty branchId to null
      if (body.branchId === "" || body.branchId === "all") {
        body.branchId = null;
      }
      const data = insertUserSchema.parse({
        ...body,
        restaurantId: await getRestaurantId(req),
      });
      // Hash password for admin-created users
      if (data.password) {
        data.password = await bcrypt.hash(data.password, 10);
      }
      const user = await storage.createUser(data);
      const { password: _, ...safeUser } = user;
      res.status(201).json(safeUser);
    } catch (error) {
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.put("/api/users/:id", async (req, res) => {
    try {
      const existing = await storage.getUser(req.params.id);
      if (!existing) return res.status(404).json({ error: "User not found" });
      await verifyOwnership(req, existing, "User");
      // Whitelist allowed fields - prevent privilege escalation
      const allowedFields = ["name", "email", "phone", "password", "isActive",
        "permDashboard", "permPos", "permOrders", "permMenu", "permKitchen",
        "permInventory", "permReviews", "permMarketing", "permQr", "permReports",
        "permSettings", "permTables", "role"];
      const updateData: Record<string, any> = {};
      for (const key of allowedFields) {
        if (req.body[key] !== undefined) updateData[key] = req.body[key];
      }
      // Prevent non-owners from changing roles
      const caller = await getAuthenticatedUser(req);
      if (updateData.role && caller.role !== "owner" && caller.role !== "platform_admin") {
        delete updateData.role;
      }
      // Never allow changing restaurantId or branchId through this endpoint
      delete updateData.restaurantId;
      delete updateData.branchId;
      if (updateData.password) {
        updateData.password = await bcrypt.hash(updateData.password, 10);
      }
      const user = await storage.updateUser(req.params.id, updateData);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      const { password: _, ...safeUser } = user;
      res.json(safeUser);
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    try {
      const existing = await storage.getUser(req.params.id);
      if (!existing) return res.status(404).json({ error: "User not found" });
      await verifyOwnership(req, existing, "User");
      await storage.deleteUser(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  app.get("/api/customers", async (req, res) => {
    try {
      const customers = await storage.getCustomers(await getRestaurantId(req));
      res.json(customers);
    } catch (error) {
      res.status(500).json({ error: "Failed to get customers" });
    }
  });

  app.get("/api/customers/lookup/:phone", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const customer = await storage.getCustomerByPhone(restaurantId, req.params.phone);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      res.status(500).json({ error: "Failed to lookup customer" });
    }
  });

  app.get("/api/customers/:id", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const customer = await storage.getCustomer(req.params.id);
      if (!customer || customer.restaurantId !== restaurantId) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      res.status(500).json({ error: "Failed to get customer" });
    }
  });

  app.post("/api/customers", async (req, res) => {
    try {
      const data = insertCustomerSchema.parse({
        ...req.body,
        restaurantId: await getRestaurantId(req),
      });
      const customer = await storage.createCustomer(data);
      res.status(201).json(customer);
    } catch (error) {
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.put("/api/customers/:id", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const existing = await storage.getCustomer(req.params.id);
      if (!existing || existing.restaurantId !== restaurantId) {
        return res.status(404).json({ error: "Customer not found" });
      }
      const customer = await storage.updateCustomer(req.params.id, req.body);
      res.json(customer);
    } catch (error) {
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.delete("/api/customers/:id", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const existing = await storage.getCustomer(req.params.id);
      if (!existing || existing.restaurantId !== restaurantId) {
        return res.status(404).json({ error: "Customer not found" });
      }
      await storage.deleteCustomer(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete customer" });
    }
  });

  // Inventory Items
  app.get("/api/inventory", async (req, res) => {
    try {
      const branchId = req.query.branch as string | undefined;
      const items = await storage.getInventoryItems(await getRestaurantId(req), branchId);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to get inventory items" });
    }
  });

  app.get("/api/inventory/:id", async (req, res) => {
    try {
      const item = await storage.getInventoryItem(req.params.id);
      if (!item) {
        return res.status(404).json({ error: "Inventory item not found" });
      }
      await verifyOwnership(req, item, "Inventory item");
      res.json(item);
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to get inventory item" });
    }
  });

  app.post("/api/inventory", async (req, res) => {
    try {
      const data = insertInventoryItemSchema.parse({
        ...req.body,
        restaurantId: await getRestaurantId(req),
      });
      const item = await storage.createInventoryItem(data);
      res.status(201).json(item);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.put("/api/inventory/:id", async (req, res) => {
    try {
      const existing = await storage.getInventoryItem(req.params.id);
      if (!existing) return res.status(404).json({ error: "Inventory item not found" });
      await verifyOwnership(req, existing, "Inventory item");
      const item = await storage.updateInventoryItem(req.params.id, req.body);
      if (!item) {
        return res.status(404).json({ error: "Inventory item not found" });
      }
      res.json(item);
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.delete("/api/inventory/:id", async (req, res) => {
    try {
      const existing = await storage.getInventoryItem(req.params.id);
      if (!existing) return res.status(404).json({ error: "Inventory item not found" });
      await verifyOwnership(req, existing, "Inventory item");
      await storage.deleteInventoryItem(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to delete inventory item" });
    }
  });

  // Inventory Transactions
  app.get("/api/inventory/:itemId/transactions", async (req, res) => {
    try {
      const transactions = await storage.getInventoryTransactions(req.params.itemId);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Failed to get transactions" });
    }
  });

  app.post("/api/inventory/:itemId/transactions", async (req, res) => {
    try {
      const data = insertInventoryTransactionSchema.parse({
        ...req.body,
        inventoryItemId: req.params.itemId,
      });
      const transaction = await storage.createInventoryTransaction(data);
      res.status(201).json(transaction);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  // Reports
  app.get("/api/reports/sales", async (req, res) => {
    try {
      const branchId = req.query.branch as string | undefined;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
      
      const report = await storage.getSalesReport(await getRestaurantId(req), startDate, endDate, branchId);
      res.json(report);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to get sales report" });
    }
  });

  app.get("/api/reports/top-items", async (req, res) => {
    try {
      const branchId = req.query.branch as string | undefined;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const report = await storage.getTopSellingItems(await getRestaurantId(req), limit, branchId);
      res.json(report);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to get top items report" });
    }
  });

  app.get("/api/reports/orders-by-type", async (req, res) => {
    try {
      const branchId = req.query.branch as string | undefined;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
      
      const report = await storage.getOrdersByType(await getRestaurantId(req), startDate, endDate, branchId);
      res.json(report);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to get orders by type report" });
    }
  });

  app.get("/api/reports/hourly-stats", async (req, res) => {
    try {
      const branchId = req.query.branch as string | undefined;
      const date = req.query.date ? new Date(req.query.date as string) : new Date();
      
      const report = await storage.getHourlyOrderStats(await getRestaurantId(req), date, branchId);
      res.json(report);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to get hourly stats" });
    }
  });

  // Dashboard summary stats
  app.get("/api/reports/summary", async (req, res) => {
    try {
      const branchId = req.query.branch as string | undefined;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - 7);
      
      const monthStart = new Date(today);
      monthStart.setDate(1);
      
      const [todaySales, weekSales, monthSales, topItems, ordersByType] = await Promise.all([
        storage.getSalesReport(await getRestaurantId(req), today, tomorrow, branchId),
        storage.getSalesReport(await getRestaurantId(req), weekStart, tomorrow, branchId),
        storage.getSalesReport(await getRestaurantId(req), monthStart, tomorrow, branchId),
        storage.getTopSellingItems(await getRestaurantId(req), 5, branchId),
        storage.getOrdersByType(await getRestaurantId(req), monthStart, tomorrow, branchId),
      ]);
      
      const sumSales = (data: any[]) => data.reduce((acc, row) => acc + parseFloat(row.total_sales || 0), 0);
      const sumOrders = (data: any[]) => data.reduce((acc, row) => acc + parseInt(row.order_count || 0), 0);
      
      res.json({
        today: { sales: sumSales(todaySales), orders: sumOrders(todaySales) },
        week: { sales: sumSales(weekSales), orders: sumOrders(weekSales) },
        month: { sales: sumSales(monthSales), orders: sumOrders(monthSales) },
        topItems,
        ordersByType,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to get summary" });
    }
  });

  // Authentication
  app.get("/api/auth/me", async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (user.role !== "platform_admin") {
        const restaurant = await storage.getRestaurantById(user.restaurantId);
        if (!restaurant || restaurant.isActive === false) {
          return res.status(403).json({ error: "Restaurant subscription is inactive" });
        }
      }
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      res.status(401).json({ error: "Not authenticated" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
      }
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      if (!user.isActive) {
        return res.status(401).json({ error: "Account is disabled" });
      }

      if (user.role !== "platform_admin") {
        const restaurant = await storage.getRestaurantById(user.restaurantId);
        if (!restaurant || restaurant.isActive === false) {
          return res.status(403).json({ error: "Restaurant subscription is inactive. Please contact the platform administrator." });
        }
      }
      
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      await storage.updateUserLastLogin(user.id);
      
      // Generate JWT token
      const token = signToken({ userId: user.id, restaurantId: user.restaurantId });
      
      // Return user without password + token
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword, token });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // Register new user - creates restaurant + default branch automatically for owners
  app.post("/api/users/register", async (req, res) => {
    try {
      if (!req.body.password) {
        return res.status(400).json({ error: "Password is required" });
      }
      
      // Check if email already exists
      const existingUser = await storage.getUserByEmail(req.body.email);
      if (existingUser) {
        return res.status(400).json({ error: "Email already exists" });
      }
      
      const emailLower = req.body.email?.toLowerCase().trim();
      const isPlatformAdmin = emailLower === PLATFORM_ADMIN_EMAIL;
      
      const restaurantName = req.body.restaurantName?.trim() || req.body.name || "My Restaurant";
      
      // Create a new restaurant for this owner (platform admin gets a system restaurant)
      const restaurant = await storage.createRestaurant({
        nameEn: isPlatformAdmin ? "Platform Administration" : restaurantName,
        nameAr: isPlatformAdmin ? "إدارة المنصة" : restaurantName,
        // slug is auto-generated from nameEn in storage.createRestaurant
      });
      
      // Auto-create a default branch for the restaurant
      const defaultBranch = await storage.createBranch({
        restaurantId: restaurant.id,
        name: isPlatformAdmin ? "System" : "Main Branch",
        nameAr: isPlatformAdmin ? "النظام" : "الفرع الرئيسي",
        isMain: true,
        isActive: true,
      });
      
      const data = insertUserSchema.parse({
        ...req.body,
        role: isPlatformAdmin ? "platform_admin" : (req.body.role || "owner"),
        restaurantId: restaurant.id,
        branchId: defaultBranch.id,
      });
      
      // Hash password
      const hashedPassword = await bcrypt.hash(data.password!, 10);
      
      const isOwner = data.role === "owner" || isPlatformAdmin;
      const user = await storage.createUser({
        ...data,
        password: hashedPassword as string,
        restaurantId: restaurant.id,
        branchId: defaultBranch.id,
        permDashboard: isOwner ? true : data.permDashboard,
        permPos: isOwner ? true : data.permPos,
        permOrders: isOwner ? true : data.permOrders,
        permMenu: isOwner ? true : data.permMenu,
        permKitchen: isOwner ? true : data.permKitchen,
        permInventory: isOwner ? true : data.permInventory,
        permReviews: isOwner ? true : data.permReviews,
        permMarketing: isOwner ? true : data.permMarketing,
        permQr: isOwner ? true : data.permQr,
        permReports: isOwner ? true : data.permReports,
        permSettings: isOwner ? true : data.permSettings,
        permTables: isOwner ? true : data.permTables,
      });
      
      // Generate JWT token
      const token = signToken({ userId: user.id, restaurantId: user.restaurantId });
      
      const { password: _, ...userWithoutPassword } = user;
      res.json({ user: userWithoutPassword, token });
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  // Platform Admin middleware
  async function requirePlatformAdmin(req: any, res: any, next: any) {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user || user.role !== "platform_admin") {
        return res.status(403).json({ error: "Platform admin access required" });
      }
      next();
    } catch {
      res.status(401).json({ error: "Authentication required" });
    }
  }

  // Platform Admin Routes
  app.get("/api/admin/restaurants", requirePlatformAdmin, async (_req, res) => {
    try {
      const allRestaurants = await storage.getAllRestaurants();
      const allUsers = await storage.getAllUsers();
      const allBranches: any[] = [];

      for (const r of allRestaurants) {
        if (r.id === "platform") continue;
        const branches = await storage.getBranches(r.id);
        allBranches.push(...branches.map(b => ({ ...b, restaurantId: r.id })));
      }

      const restaurantsWithDetails = [];
      for (const r of allRestaurants.filter(r => r.id !== "platform")) {
        const owner = allUsers.find(u => u.restaurantId === r.id && u.role === "owner");
        const restaurantUsers = allUsers.filter(u => u.restaurantId === r.id);
        const restaurantBranches = allBranches.filter(b => b.restaurantId === r.id);
        const orders = await storage.getOrdersByRestaurant(r.id);
        const menuItemsList = await storage.getMenuItems(r.id);

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayOrders = orders.filter(o => new Date(o.createdAt!) >= todayStart);
        const revenue = orders.reduce((sum, o) => sum + parseFloat(o.total || "0"), 0);
        const todayRevenue = todayOrders.reduce((sum, o) => sum + parseFloat(o.total || "0"), 0);
        const avgOrderValue = orders.length > 0 ? revenue / orders.length : 0;

        const recentOrders = orders
          .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime())
          .slice(0, 10)
          .map(o => ({
            id: o.id,
            orderNumber: o.orderNumber,
            orderType: o.orderType,
            status: o.status,
            total: o.total,
            paymentMethod: o.paymentMethod,
            isPaid: o.isPaid,
            customerName: o.customerName,
            createdAt: o.createdAt,
          }));

        const ordersByStatus: Record<string, number> = {};
        const ordersByType: Record<string, number> = {};
        for (const o of orders) {
          const st = o.status || "unknown";
          ordersByStatus[st] = (ordersByStatus[st] || 0) + 1;
          const ot = o.orderType || "unknown";
          if (ot) ordersByType[ot] = (ordersByType[ot] || 0) + 1;
        }

        restaurantsWithDetails.push({
          ...r,
          ownerName: owner?.name || "-",
          ownerEmail: owner?.email || "-",
          ownerPhone: owner?.phone || "-",
          usersCount: restaurantUsers.length,
          branchesCount: restaurantBranches.length,
          branches: restaurantBranches,
          users: restaurantUsers.map(u => {
            const { password: _, ...rest } = u;
            return rest;
          }),
          ordersCount: orders.length,
          totalRevenue: revenue.toFixed(2),
          todayOrders: todayOrders.length,
          todayRevenue: todayRevenue.toFixed(2),
          avgOrderValue: avgOrderValue.toFixed(2),
          menuItemsCount: menuItemsList.length,
          recentOrders,
          ordersByStatus,
          ordersByType,
        });
      }

      res.json(restaurantsWithDetails);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to get restaurants" });
    }
  });

  app.get("/api/admin/stats", requirePlatformAdmin, async (_req, res) => {
    try {
      const allRestaurants = await storage.getAllRestaurants();
      const allUsers = await storage.getAllUsers();
      const restaurants = allRestaurants.filter(r => r.id !== "platform");
      const nonAdminUsers = allUsers.filter(u => u.role !== "platform_admin");

      let totalOrders = 0;
      let totalRevenue = 0;
      let totalMenuItems = 0;
      let todayOrders = 0;
      let todayRevenue = 0;
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const ordersByStatus: Record<string, number> = {};
      const ordersByType: Record<string, number> = {};
      const revenueByRestaurant: Array<{ name: string; revenue: number; orders: number }> = [];

      for (const r of restaurants) {
        const orders = await storage.getOrdersByRestaurant(r.id);
        const menuItemsList = await storage.getMenuItems(r.id);
        totalMenuItems += menuItemsList.length;
        totalOrders += orders.length;
        let rRevenue = 0;
        for (const o of orders) {
          const amount = parseFloat(o.total || "0");
          totalRevenue += amount;
          rRevenue += amount;
          const st = o.status || "unknown";
          ordersByStatus[st] = (ordersByStatus[st] || 0) + 1;
          const ot = o.orderType || "unknown";
          if (ot) ordersByType[ot] = (ordersByType[ot] || 0) + 1;
          if (new Date(o.createdAt!) >= todayStart) {
            todayOrders++;
            todayRevenue += amount;
          }
        }
        revenueByRestaurant.push({ name: r.nameEn, revenue: rRevenue, orders: orders.length });
      }

      const planCounts: Record<string, number> = {};
      for (const r of restaurants) {
        const plan = r.subscriptionPlan || "none";
        planCounts[plan] = (planCounts[plan] || 0) + 1;
      }

      const roleCounts: Record<string, number> = {};
      for (const u of nonAdminUsers) {
        roleCounts[u.role] = (roleCounts[u.role] || 0) + 1;
      }

      res.json({
        totalRestaurants: restaurants.length,
        totalUsers: nonAdminUsers.length,
        totalOrders,
        totalRevenue: totalRevenue.toFixed(2),
        totalMenuItems,
        activeRestaurants: restaurants.filter(r => r.isActive !== false).length,
        inactiveRestaurants: restaurants.filter(r => r.isActive === false).length,
        todayOrders,
        todayRevenue: todayRevenue.toFixed(2),
        ordersByStatus,
        ordersByType,
        planCounts,
        roleCounts,
        revenueByRestaurant: revenueByRestaurant.sort((a, b) => b.revenue - a.revenue),
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to get stats" });
    }
  });

  app.get("/api/admin/restaurant/:id", requirePlatformAdmin, async (req, res) => {
    try {
      const restaurant = await storage.getRestaurantById(req.params.id);
      if (!restaurant) return res.status(404).json({ error: "Restaurant not found" });
      const users = await storage.getUsers(req.params.id);
      const branches = await storage.getBranches(req.params.id);
      const orders = await storage.getOrdersByRestaurant(req.params.id);

      res.json({
        ...restaurant,
        users: users.map(u => { const { password: _, ...rest } = u; return rest; }),
        branches,
        ordersCount: orders.length,
        totalRevenue: orders.reduce((sum, o) => sum + parseFloat(o.total || "0"), 0).toFixed(2),
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to get restaurant details" });
    }
  });

  app.patch("/api/admin/restaurant/:id/subscription", requirePlatformAdmin, async (req, res) => {
    try {
      const { subscriptionStart, subscriptionEnd, subscriptionPlan, subscriptionNotes } = req.body;
      const restaurant = await storage.getRestaurantById(req.params.id);
      if (!restaurant) return res.status(404).json({ error: "Restaurant not found" });

      const validPlans = ["trial", "basic", "pro", "enterprise"];
      if (subscriptionPlan && !validPlans.includes(subscriptionPlan)) {
        return res.status(400).json({ error: "Invalid subscription plan" });
      }

      const startDate = subscriptionStart ? new Date(subscriptionStart) : null;
      const endDate = subscriptionEnd ? new Date(subscriptionEnd) : null;

      if (startDate && isNaN(startDate.getTime())) {
        return res.status(400).json({ error: "Invalid start date" });
      }
      if (endDate && isNaN(endDate.getTime())) {
        return res.status(400).json({ error: "Invalid end date" });
      }
      if (startDate && endDate && endDate < startDate) {
        return res.status(400).json({ error: "End date must be after start date" });
      }

      const updated = await storage.updateRestaurantById(req.params.id, {
        subscriptionStart: startDate,
        subscriptionEnd: endDate,
        subscriptionPlan: subscriptionPlan || null,
        subscriptionNotes: subscriptionNotes || null,
      });
      res.json(updated);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update subscription" });
    }
  });

  app.post("/api/admin/notifications/send", requirePlatformAdmin, async (req, res) => {
    try {
      const { title, titleAr, message, messageAr, priority, targetRestaurantIds } = req.body;

      if (!title || !message) {
        return res.status(400).json({ error: "Title and message are required" });
      }

      const validPriorities = ["low", "normal", "high", "urgent"];
      if (priority && !validPriorities.includes(priority)) {
        return res.status(400).json({ error: "Invalid priority" });
      }

      const allRestaurants = await storage.getAllRestaurants();
      const targets = targetRestaurantIds && targetRestaurantIds.length > 0
        ? allRestaurants.filter(r => r.id !== "platform" && targetRestaurantIds.includes(r.id))
        : allRestaurants.filter(r => r.id !== "platform");

      const results = [];
      for (const restaurant of targets) {
        const notification = await storage.createNotification({
          restaurantId: restaurant.id,
          type: "system",
          title,
          titleAr: titleAr || null,
          message,
          messageAr: messageAr || null,
          priority: priority || "normal",
          targetRole: "all",
          isRead: false,
        });
        results.push(notification);
      }

      res.json({ sent: results.length, notifications: results });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to send notifications" });
    }
  });

  app.patch("/api/admin/restaurant/:id/toggle-active", requirePlatformAdmin, async (req, res) => {
    try {
      const restaurant = await storage.getRestaurantById(req.params.id);
      if (!restaurant) return res.status(404).json({ error: "Restaurant not found" });

      const updated = await storage.updateRestaurantById(req.params.id, {
        isActive: !restaurant.isActive,
      });
      res.json(updated);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to toggle restaurant status" });
    }
  });

  // Recipes (Menu Item Ingredients)
  app.get("/api/menu-items/:menuItemId/recipes", async (req, res) => {
    try {
      const recipes = await storage.getRecipes(req.params.menuItemId);
      res.json(recipes);
    } catch (error) {
      res.status(500).json({ error: "Failed to get recipes" });
    }
  });

  app.get("/api/recipes", async (req, res) => {
    try {
      const recipes = await storage.getRecipesByRestaurant(await getRestaurantId(req));
      res.json(recipes);
    } catch (error) {
      res.status(500).json({ error: "Failed to get recipes" });
    }
  });

  app.post("/api/recipes", async (req, res) => {
    try {
      const data = insertRecipeSchema.parse({
        ...req.body,
        restaurantId: await getRestaurantId(req),
      });
      const recipe = await storage.createRecipe(data);
      res.json(recipe);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.put("/api/recipes/:id", async (req, res) => {
    try {
      const existing = await storage.getRecipe?.(req.params.id);
      if (existing) await verifyOwnership(req, existing, "Recipe");
      else await getRestaurantId(req); // at minimum require auth
      const data = insertRecipeSchema.partial().parse(req.body);
      const recipe = await storage.updateRecipe(req.params.id, data);
      if (!recipe) {
        return res.status(404).json({ error: "Recipe not found" });
      }
      res.json(recipe);
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.delete("/api/recipes/:id", async (req, res) => {
    try {
      await getRestaurantId(req); // require auth
      await storage.deleteRecipe(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      if (error?.message === "Authentication required") return res.status(401).json({ error: error.message });
      res.status(500).json({ error: "Failed to delete recipe" });
    }
  });

  app.delete("/api/menu-items/:menuItemId/recipes", async (req, res) => {
    try {
      const menuItem = await storage.getMenuItem(req.params.menuItemId);
      if (!menuItem) return res.status(404).json({ error: "Menu item not found" });
      await verifyOwnership(req, menuItem, "Menu item");
      await storage.deleteRecipesByMenuItem(req.params.menuItemId);
      res.json({ success: true });
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to delete recipes" });
    }
  });

  // Printers
  app.get("/api/printers", async (req, res) => {
    try {
      const branchId = req.query.branch as string | undefined;
      const printers = await storage.getPrinters(await getRestaurantId(req), branchId);
      res.json(printers);
    } catch (error) {
      res.status(500).json({ error: "Failed to get printers" });
    }
  });

  app.get("/api/printers/:id", async (req, res) => {
    try {
      const printer = await storage.getPrinter(req.params.id);
      if (!printer) {
        return res.status(404).json({ error: "Printer not found" });
      }
      await verifyOwnership(req, printer, "Printer");
      res.json(printer);
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to get printer" });
    }
  });

  app.post("/api/printers", async (req, res) => {
    try {
      const data = insertPrinterSchema.parse({
        ...req.body,
        restaurantId: await getRestaurantId(req),
      });
      const printer = await storage.createPrinter(data);
      res.json(printer);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.put("/api/printers/:id", async (req, res) => {
    try {
      const existing = await storage.getPrinter(req.params.id);
      if (!existing) return res.status(404).json({ error: "Printer not found" });
      await verifyOwnership(req, existing, "Printer");
      const data = insertPrinterSchema.partial().parse(req.body);
      const printer = await storage.updatePrinter(req.params.id, data);
      if (!printer) {
        return res.status(404).json({ error: "Printer not found" });
      }
      res.json(printer);
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.delete("/api/printers/:id", async (req, res) => {
    try {
      const existing = await storage.getPrinter(req.params.id);
      if (!existing) return res.status(404).json({ error: "Printer not found" });
      await verifyOwnership(req, existing, "Printer");
      await storage.deletePrinter(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to delete printer" });
    }
  });

  app.get("/api/moyasar/platform-status", async (_req, res) => {
    res.json({ configured: moyasarPlatform.hasPlatformCredentials() });
  });

  app.get("/api/moyasar/merchant", async (req, res) => {
    try {
      const merchant = await storage.getMoyasarMerchant(await getRestaurantId(req));
      if (!merchant) {
        return res.json(null);
      }
      const documents = await storage.getMoyasarDocuments(merchant.id);
      res.json({ ...merchant, documents });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to get merchant" });
    }
  });

  app.post("/api/moyasar/merchant", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const existing = await storage.getMoyasarMerchant(restaurantId);
      if (existing) {
        return res.status(400).json({ error: "Merchant already exists" });
      }

      const restaurant = await storage.getRestaurantById(restaurantId);
      const {
        name: rawName, publicName: rawPublicName, merchantType, adminEmail: rawAdminEmail, email: rawEmail,
        ownersCount, signatory, signatoryCount, activityLicenseRequired,
        country, timeZone, website, statementDescriptor,
        enabledSchemes, paymentMethods, fees,
      } = req.body;

      // Fallback to restaurant data for required fields
      const name = rawName || restaurant?.nameEn?.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase() || 'merchant';
      const publicName = rawPublicName || restaurant?.nameEn || restaurant?.nameAr || name;
      const adminEmail = rawAdminEmail || restaurant?.email || rawEmail;
      const email = rawEmail || restaurant?.email || adminEmail;

      if (!email) {
        return res.status(400).json({ error: "Email is required. Please set your restaurant email in settings first." });
      }

      const localData: any = {
        restaurantId,
        name,
        publicName,
        merchantType: merchantType || "establishment",
        adminEmail: adminEmail || email,
        email,
        ownersCount: ownersCount || 1,
        signatory: signatory || "owner",
        signatoryCount: signatoryCount || 1,
        activityLicenseRequired: activityLicenseRequired || false,
        country: country || "SA",
        timeZone: timeZone || "Asia/Riyadh",
        website,
        statementDescriptor,
        enabledSchemes: enabledSchemes || ["mada", "visa", "master"],
        paymentMethods: paymentMethods || ["creditcard"],
        fees,
        status: "draft",
      };

      if (moyasarPlatform.hasPlatformCredentials()) {
        try {
          const payload: moyasarPlatform.MoyasarCreateMerchantPayload = {
            type: merchantType || "establishment",
            name: name,
            public_name: publicName || name,
            country: country || "SA",
            time_zone: timeZone || "Asia/Riyadh",
            website: website,
            email: email,
            admin_email: adminEmail,
            owners_count: ownersCount || 1,
            signatory: signatory || "owner",
            activity_license_required: activityLicenseRequired || false,
            enabled_schemes: enabledSchemes || ["mada", "visa", "master"],
            fees: fees || {
              tax_inclusive: true,
              mada_charge_rate: 1.70,
              mada_charge_fixed: 1.00,
              mada_refund_rate: 0,
              mada_refund_fixed: 1.00,
              cc_charge_rate: 2.70,
              cc_charge_fixed: 1.00,
              cc_refund_rate: 0,
              cc_refund_fixed: 1.00,
            },
          };
          if (statementDescriptor) {
            payload.statement_descriptor = statementDescriptor;
          }
          if (signatory !== "owner" && signatoryCount) {
            payload.signatory_count = signatoryCount;
          }

          const moyasarRes = await moyasarPlatform.createMerchant(payload);

          localData.moyasarMerchantId = moyasarRes.id;
          localData.moyasarEntityId = moyasarRes.entity_id;
          localData.status = moyasarRes.status || "pending";
          localData.signatureStatus = moyasarRes.signature?.status || "unsigned";
          localData.signatureUrl = moyasarRes.signature?.url || null;
          localData.requiredDocuments = (moyasarRes.required_documents || []).map((d: any) => typeof d === 'string' ? d : d.type || d);

          if (moyasarRes.api_keys) {
            localData.livePublicKey = moyasarRes.api_keys.live?.publishable_key;
            localData.liveSecretKey = moyasarRes.api_keys.live?.secret_key;
            localData.testPublicKey = moyasarRes.api_keys.test?.publishable_key;
            localData.testSecretKey = moyasarRes.api_keys.test?.secret_key;

            if (restaurant && !restaurant.moyasarPublishableKey) {
              await storage.updateRestaurantById(restaurantId, {
                moyasarPublishableKey: moyasarRes.api_keys.live?.publishable_key,
                moyasarSecretKey: moyasarRes.api_keys.live?.secret_key,
              });
            }
          }
        } catch (apiErr: any) {
          console.error("Moyasar Platform API error:", apiErr.message);
          return res.status(400).json({ error: "Failed to register with Moyasar", details: apiErr.message });
        }
      }

      const merchant = await storage.createMoyasarMerchant(localData);
      res.status(201).json({ ...merchant, documents: [] });
    } catch (error: any) {
      console.error("Create merchant error:", error);
      res.status(400).json({ error: error.message || "Invalid request body" });
    }
  });

  app.put("/api/moyasar/merchant", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const existing = await storage.getMoyasarMerchant(restaurantId);
      if (!existing) {
        return res.status(404).json({ error: "Merchant not found" });
      }

      if (moyasarPlatform.hasPlatformCredentials() && existing.moyasarMerchantId) {
        try {
          const updatePayload: any = {};
          if (req.body.name) updatePayload.name = req.body.name;
          if (req.body.publicName) updatePayload.public_name = req.body.publicName;
          if (req.body.website) updatePayload.website = req.body.website;
          if (req.body.email) updatePayload.email = req.body.email;
          if (req.body.fees) updatePayload.fees = req.body.fees;
          if (req.body.enabledSchemes) updatePayload.enabled_schemes = req.body.enabledSchemes;

          if (Object.keys(updatePayload).length > 0) {
            await moyasarPlatform.updateMerchant(existing.moyasarMerchantId, updatePayload);
          }
        } catch (apiErr: any) {
          console.error("Moyasar update error:", apiErr.message);
        }
      }

      const merchant = await storage.updateMoyasarMerchant(existing.id, req.body);
      const documents = await storage.getMoyasarDocuments(existing.id);
      res.json({ ...merchant, documents });
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.delete("/api/moyasar/merchant", async (req, res) => {
    try {
      const existing = await storage.getMoyasarMerchant(await getRestaurantId(req));
      if (existing) {
        await storage.deleteMoyasarMerchant(existing.id);
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete merchant" });
    }
  });

  app.get("/api/moyasar/merchant/documents", async (req, res) => {
    try {
      const merchant = await storage.getMoyasarMerchant(await getRestaurantId(req));
      if (!merchant) {
        return res.status(404).json({ error: "Merchant not found" });
      }
      const documents = await storage.getMoyasarDocuments(merchant.id);
      res.json(documents);
    } catch (error) {
      res.status(500).json({ error: "Failed to get documents" });
    }
  });

  app.post("/api/moyasar/merchant/documents", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const merchant = await storage.getMoyasarMerchant(restaurantId);
      if (!merchant) {
        return res.status(404).json({ error: "Merchant not found. Create a merchant first." });
      }

      const { documentType, documentInfo, fileData, fileName, fileMimeType } = req.body;

      const existingDoc = await storage.getMoyasarDocumentByType(merchant.id, documentType);

      let moyasarDocId: string | null = null;

      if (moyasarPlatform.hasPlatformCredentials() && merchant.moyasarMerchantId) {
        try {
          if (existingDoc?.moyasarDocumentId) {
            await moyasarPlatform.deleteDocument(merchant.moyasarMerchantId, existingDoc.moyasarDocumentId);
          }

          const uploadPayload: moyasarPlatform.MoyasarDocumentPayload = {
            type: documentType,
            info: documentInfo || {},
          };
          if (fileData) {
            uploadPayload.file = fileData;
          }

          const moyasarDoc = await moyasarPlatform.uploadDocument(merchant.moyasarMerchantId, uploadPayload);
          moyasarDocId = moyasarDoc.id;
        } catch (apiErr: any) {
          console.error("Moyasar document upload error:", apiErr.message);
          return res.status(400).json({ error: "Failed to upload document to Moyasar", details: apiErr.message });
        }
      }

      if (existingDoc) {
        const updated = await storage.updateMoyasarDocument(existingDoc.id, {
          documentInfo,
          fileData,
          fileName,
          fileMimeType,
          isUploaded: !!moyasarDocId,
          moyasarDocumentId: moyasarDocId || existingDoc.moyasarDocumentId,
          uploadError: null,
        });
        return res.json(updated);
      }

      const data = insertMoyasarDocumentSchema.parse({
        documentType,
        documentInfo,
        fileData,
        fileName,
        fileMimeType,
        merchantId: merchant.id,
        restaurantId,
        isUploaded: !!moyasarDocId,
        moyasarDocumentId: moyasarDocId,
      });
      const doc = await storage.createMoyasarDocument(data);
      res.status(201).json(doc);
    } catch (error: any) {
      console.error(error);
      res.status(400).json({ error: error.message || "Invalid request body" });
    }
  });

  app.delete("/api/moyasar/merchant/documents/:id", async (req, res) => {
    try {
      const merchant = await storage.getMoyasarMerchant(await getRestaurantId(req));
      const doc = await storage.getMoyasarDocument(req.params.id);

      if (doc && merchant?.moyasarMerchantId && doc.moyasarDocumentId && moyasarPlatform.hasPlatformCredentials()) {
        try {
          await moyasarPlatform.deleteDocument(merchant.moyasarMerchantId, doc.moyasarDocumentId);
        } catch (e: any) {
          console.error("Moyasar delete document error:", e.message);
        }
      }

      if (doc) {
        await storage.deleteMoyasarDocument(doc.id);
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete document" });
    }
  });

  app.post("/api/moyasar/merchant/submit-review", async (req, res) => {
    try {
      const merchant = await storage.getMoyasarMerchant(await getRestaurantId(req));
      if (!merchant || !merchant.moyasarMerchantId) {
        return res.status(400).json({ error: "Merchant not found or not registered with Moyasar" });
      }

      if (!moyasarPlatform.hasPlatformCredentials()) {
        return res.status(400).json({ error: "Platform credentials not configured" });
      }

      const result = await moyasarPlatform.submitForReview(merchant.moyasarMerchantId);

      await storage.updateMoyasarMerchant(merchant.id, {
        status: result.status || "under_review",
        signatureStatus: result.signature?.status || merchant.signatureStatus,
        signatureUrl: result.signature?.url || merchant.signatureUrl,
      });

      const updated = await storage.getMoyasarMerchant(await getRestaurantId(req));
      const documents = await storage.getMoyasarDocuments(merchant.id);
      res.json({ ...updated, documents });
    } catch (error: any) {
      console.error("Submit review error:", error.message);
      res.status(400).json({ error: "Failed to submit for review", details: error.message });
    }
  });

  app.post("/api/moyasar/merchant/sync-status", async (req, res) => {
    try {
      const merchant = await storage.getMoyasarMerchant(await getRestaurantId(req));
      if (!merchant || !merchant.moyasarMerchantId) {
        return res.status(400).json({ error: "Merchant not found or not registered with Moyasar" });
      }

      if (!moyasarPlatform.hasPlatformCredentials()) {
        return res.status(400).json({ error: "Platform credentials not configured" });
      }

      const moyasarData = await moyasarPlatform.getMerchant(merchant.moyasarMerchantId);

      const updateData: any = {
        status: moyasarData.status,
        signatureStatus: moyasarData.signature?.status || merchant.signatureStatus,
        signatureUrl: moyasarData.signature?.url || merchant.signatureUrl,
        rejectionReasons: moyasarData.reasons || [],
        requiredDocuments: (moyasarData.required_documents || []).map((d: any) => typeof d === 'string' ? d : d.type || d),
      };

      if (moyasarData.api_keys) {
        updateData.livePublicKey = moyasarData.api_keys.live?.publishable_key;
        updateData.liveSecretKey = moyasarData.api_keys.live?.secret_key;
        updateData.testPublicKey = moyasarData.api_keys.test?.publishable_key;
        updateData.testSecretKey = moyasarData.api_keys.test?.secret_key;
      }

      if (moyasarData.status === "active" || moyasarData.status === "semi_active") {
        const restaurantId = await getRestaurantId(req);
        if (moyasarData.api_keys?.live) {
          await storage.updateRestaurantById(restaurantId, {
            moyasarPublishableKey: moyasarData.api_keys.live.publishable_key,
            moyasarSecretKey: moyasarData.api_keys.live.secret_key,
          });
        }
      }

      const updated = await storage.updateMoyasarMerchant(merchant.id, updateData);
      const documents = await storage.getMoyasarDocuments(merchant.id);
      res.json({ ...updated, documents });
    } catch (error: any) {
      console.error("Sync status error:", error.message);
      res.status(400).json({ error: "Failed to sync status", details: error.message });
    }
  });

  app.get("/api/moyasar/merchant/signature-status", async (req, res) => {
    try {
      const merchant = await storage.getMoyasarMerchant(await getRestaurantId(req));
      if (!merchant) {
        return res.status(404).json({ error: "Merchant not found" });
      }

      if (moyasarPlatform.hasPlatformCredentials() && merchant.moyasarMerchantId) {
        try {
          const moyasarData = await moyasarPlatform.getMerchant(merchant.moyasarMerchantId);
          if (moyasarData.signature) {
            await storage.updateMoyasarMerchant(merchant.id, {
              signatureStatus: moyasarData.signature.status,
              signatureUrl: moyasarData.signature.url,
              status: moyasarData.status,
            });
            return res.json({
              status: moyasarData.signature.status,
              url: moyasarData.signature.url,
              merchantStatus: moyasarData.status,
            });
          }
        } catch (e: any) {
          console.error("Signature status check error:", e.message);
        }
      }

      res.json({
        status: merchant.signatureStatus,
        url: merchant.signatureUrl,
        merchantStatus: merchant.status,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get signature status" });
    }
  });

  app.post("/api/moyasar/webhook", async (req, res) => {
    try {
      const { merchantId, signatureStatus, status } = req.body;
      if (!merchantId) {
        return res.status(400).json({ error: "Missing merchantId" });
      }

      const allMerchants = await storage.getMoyasarMerchantByMoyasarId(merchantId);
      if (!allMerchants) {
        return res.status(404).json({ error: "Merchant not found" });
      }

      const updateData: any = {};
      if (signatureStatus) updateData.signatureStatus = signatureStatus;
      if (status) updateData.status = status;

      if (signatureStatus === "signed" && !status) {
        updateData.status = "active";
      }

      await storage.updateMoyasarMerchant(allMerchants.id, updateData);

      if (updateData.status === "active" || updateData.status === "semi_active") {
        if (moyasarPlatform.hasPlatformCredentials()) {
          try {
            const moyasarData = await moyasarPlatform.getMerchant(merchantId);
            if (moyasarData.api_keys?.live) {
              await storage.updateRestaurantById(allMerchants.restaurantId, {
                moyasarPublishableKey: moyasarData.api_keys.live.publishable_key,
                moyasarSecretKey: moyasarData.api_keys.live.secret_key,
              });
              await storage.updateMoyasarMerchant(allMerchants.id, {
                livePublicKey: moyasarData.api_keys.live.publishable_key,
                liveSecretKey: moyasarData.api_keys.live.secret_key,
                testPublicKey: moyasarData.api_keys.test?.publishable_key,
                testSecretKey: moyasarData.api_keys.test?.secret_key,
              });
            }
          } catch (e: any) {
            console.error("Webhook key fetch error:", e.message);
          }
        }
      }

      res.json({ success: true });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to process webhook" });
    }
  });

  // ===============================
  // 1. RESERVATIONS - نظام الحجوزات
  // ===============================
  app.get("/api/reservations", async (req, res) => {
    try {
      const branchId = req.query.branch as string | undefined;
      const dateStr = req.query.date as string | undefined;
      const date = dateStr ? new Date(dateStr) : undefined;
      const reservations = await storage.getReservations(await getRestaurantId(req), branchId, date);
      res.json(reservations);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to get reservations" });
    }
  });

  app.get("/api/reservations/check-deposit", async (req, res) => {
    try {
      const phone = req.query.phone as string;
      if (!phone) {
        return res.status(400).json({ error: "Phone number is required" });
      }
      const restaurantId = await getRestaurantId(req);
      const reservation = await storage.findPaidDepositByPhone(restaurantId, phone);
      if (reservation) {
        res.json({ hasDeposit: true, depositAmount: reservation.depositAmount, reservationId: reservation.id, customerName: reservation.customerName });
      } else {
        res.json({ hasDeposit: false });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to check deposit" });
    }
  });

  app.get("/api/reservations/available-slots", async (req, res) => {
    try {
      const branchId = req.query.branch as string | undefined;
      const dateStr = req.query.date as string;
      if (!dateStr) {
        return res.status(400).json({ error: "Date is required" });
      }
      const date = new Date(dateStr);
      const slots = await storage.getAvailableTimeSlots(await getRestaurantId(req), branchId, date);
      res.json(slots);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to get available slots" });
    }
  });

  app.get("/api/reservations/:id", async (req, res) => {
    try {
      const reservation = await storage.getReservation(req.params.id);
      if (!reservation) {
        return res.status(404).json({ error: "Reservation not found" });
      }
      await verifyOwnership(req, reservation, "Reservation");
      res.json(reservation);
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to get reservation" });
    }
  });

  app.post("/api/reservations", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const restaurant = await storage.getRestaurantById(restaurantId);
      
      // Validate required fields
      if (!req.body.customerName || !req.body.customerPhone || !req.body.reservationTime) {
        return res.status(400).json({ error: "missingFields", message: "Name, phone, and time are required" });
      }

      // Use restaurant settings for duration and deposit
      const defaultDuration = (restaurant as any)?.reservationDuration || 90;
      const depositAmount = (restaurant as any)?.reservationDepositAmount || "20.00";

      const tableId = (req.body.tableId && req.body.tableId !== 'any') ? req.body.tableId : null;
      const reservationTime = req.body.reservationTime;
      const duration = parseInt(req.body.duration) || defaultDuration;
      const reservationDateValue = req.body.reservationDate ? new Date(req.body.reservationDate) : new Date();

      // Check for table conflict if a specific table is selected
      if (tableId && reservationTime) {
        const conflict = await storage.checkTableConflict(restaurantId, tableId, reservationDateValue, reservationTime, duration);
        if (conflict) {
          return res.status(409).json({ 
            error: "tableConflict",
            message: `الطاولة محجوزة في هذا الوقت (${conflict.reservationTime} - ${conflict.customerName})`,
            conflictWith: {
              time: conflict.reservationTime,
              customerName: conflict.customerName
            }
          });
        }
      }

      const guestCount = parseInt(req.body.guestCount) || parseInt(req.body.partySize) || 2;

      const reservationData: any = {
        restaurantId,
        branchId: req.body.branchId || null,
        reservationNumber: `RES-${Date.now().toString().slice(-6)}`,
        customerName: req.body.customerName,
        customerPhone: req.body.customerPhone,
        customerEmail: req.body.customerEmail || null,
        guestCount,
        reservationDate: reservationDateValue,
        reservationTime,
        duration,
        specialRequests: req.body.specialRequests || null,
        tableId,
        source: req.body.source || "phone",
        depositPaid: req.body.depositPaid || false,
        depositAmount: depositAmount,
        status: req.body.status || "pending",
        notes: req.body.notes || null,
      };
      const reservation = await storage.createReservation(reservationData);

      // Create notification for the reservation
      try {
        await storage.createNotification({
          restaurantId,
          branchId: req.body.branchId || null,
          type: "new_reservation",
          title: `New Reservation: ${req.body.customerName}`,
          titleAr: `حجز جديد: ${req.body.customerName}`,
          message: `${req.body.customerName} reserved for ${guestCount} guests at ${reservationTime} on ${reservationDateValue.toLocaleDateString("en-CA")}`,
          messageAr: `${req.body.customerName} حجز لـ ${guestCount} أشخاص الساعة ${reservationTime} بتاريخ ${reservationDateValue.toLocaleDateString("en-CA")}`,
          priority: "high",
          referenceType: "reservation",
          referenceId: reservation.id,
          targetRole: "all",
        });
      } catch (notifError) {
        console.error("Failed to create reservation notification:", notifError);
      }

      res.status(201).json(reservation);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.put("/api/reservations/:id", async (req, res) => {
    try {
      const existing = await storage.getReservation(req.params.id);
      if (!existing) return res.status(404).json({ error: "Reservation not found" });
      await verifyOwnership(req, existing, "Reservation");
      const reservation = await storage.updateReservation(req.params.id, req.body);
      if (!reservation) {
        return res.status(404).json({ error: "Reservation not found" });
      }
      res.json(reservation);
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.put("/api/reservations/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }
      const existing = await storage.getReservation(req.params.id);
      if (!existing) return res.status(404).json({ error: "Reservation not found" });
      await verifyOwnership(req, existing, "Reservation");
      const reservation = await storage.updateReservationStatus(req.params.id, status);
      if (!reservation) {
        return res.status(404).json({ error: "Reservation not found" });
      }
      // If seated, update table status
      if (status === "seated" && reservation.tableId) {
        await storage.updateTableStatus(reservation.tableId, "occupied");
      }
      res.json(reservation);
    } catch (error) {
      res.status(500).json({ error: "Failed to update reservation status" });
    }
  });

  app.delete("/api/reservations/:id", async (req, res) => {
    try {
      const existing = await storage.getReservation(req.params.id);
      if (!existing) return res.status(404).json({ error: "Reservation not found" });
      await verifyOwnership(req, existing, "Reservation");
      await storage.deleteReservation(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to delete reservation" });
    }
  });

  app.put("/api/reservations/:id/deposit", async (req, res) => {
    try {
      const existing = await storage.getReservation(req.params.id);
      if (!existing) return res.status(404).json({ error: "Reservation not found" });
      await verifyOwnership(req, existing, "Reservation");
      const updated = await storage.updateReservation(req.params.id, { depositPaid: true } as any);
      if (!updated) {
        return res.status(404).json({ error: "Reservation not found" });
      }
      res.json(updated);
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to update deposit status" });
    }
  });

  app.put("/api/reservations/:id/deposit-applied", async (req, res) => {
    try {
      const existing = await storage.getReservation(req.params.id);
      if (!existing) return res.status(404).json({ error: "Reservation not found" });
      await verifyOwnership(req, existing, "Reservation");
      const { orderId } = req.body;
      await storage.markDepositApplied(req.params.id, orderId);
      res.json({ success: true });
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to mark deposit as applied" });
    }
  });

  // ===============================
  // 2. PROMOTIONS - العروض الترويجية
  // ===============================
  app.get("/api/promotions", async (req, res) => {
    try {
      const activeOnly = req.query.active === "true";
      const branchId = req.query.branch as string | undefined;
      const promotions = await storage.getPromotions(await getRestaurantId(req), activeOnly, branchId);
      res.json(promotions);
    } catch (error) {
      res.status(500).json({ error: "Failed to get promotions" });
    }
  });

  app.get("/api/promotions/:id", async (req, res) => {
    try {
      const promotion = await storage.getPromotion(req.params.id);
      if (!promotion) {
        return res.status(404).json({ error: "Promotion not found" });
      }
      await verifyOwnership(req, promotion, "Promotion");
      res.json(promotion);
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to get promotion" });
    }
  });

  app.post("/api/promotions", async (req, res) => {
    try {
      const data = insertPromotionSchema.parse({
        ...req.body,
        restaurantId: await getRestaurantId(req),
      });
      const promotion = await storage.createPromotion(data);
      res.status(201).json(promotion);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.put("/api/promotions/:id", async (req, res) => {
    try {
      const existing = await storage.getPromotion(req.params.id);
      if (!existing) return res.status(404).json({ error: "Promotion not found" });
      await verifyOwnership(req, existing, "Promotion");
      const promotion = await storage.updatePromotion(req.params.id, req.body);
      if (!promotion) {
        return res.status(404).json({ error: "Promotion not found" });
      }
      res.json(promotion);
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.delete("/api/promotions/:id", async (req, res) => {
    try {
      const existing = await storage.getPromotion(req.params.id);
      if (!existing) return res.status(404).json({ error: "Promotion not found" });
      await verifyOwnership(req, existing, "Promotion");
      await storage.deletePromotion(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to delete promotion" });
    }
  });

  // ===============================
  // 2. COUPONS - الكوبونات
  // ===============================
  app.get("/api/coupons", async (req, res) => {
    try {
      const coupons = await storage.getCoupons(await getRestaurantId(req));
      res.json(coupons);
    } catch (error) {
      res.status(500).json({ error: "Failed to get coupons" });
    }
  });

  app.get("/api/coupons/:id", async (req, res) => {
    try {
      const coupon = await storage.getCoupon(req.params.id);
      if (!coupon) {
        return res.status(404).json({ error: "Coupon not found" });
      }
      await verifyOwnership(req, coupon, "Coupon");
      res.json(coupon);
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to get coupon" });
    }
  });

  app.post("/api/coupons", async (req, res) => {
    try {
      const data = insertCouponSchema.parse({
        ...req.body,
        restaurantId: await getRestaurantId(req),
      });
      const coupon = await storage.createCoupon(data);
      res.status(201).json(coupon);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.put("/api/coupons/:id", async (req, res) => {
    try {
      const existing = await storage.getCoupon(req.params.id);
      if (!existing) return res.status(404).json({ error: "Coupon not found" });
      await verifyOwnership(req, existing, "Coupon");
      const coupon = await storage.updateCoupon(req.params.id, req.body);
      if (!coupon) {
        return res.status(404).json({ error: "Coupon not found" });
      }
      res.json(coupon);
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.delete("/api/coupons/:id", async (req, res) => {
    try {
      const existing = await storage.getCoupon(req.params.id);
      if (!existing) return res.status(404).json({ error: "Coupon not found" });
      await verifyOwnership(req, existing, "Coupon");
      await storage.deleteCoupon(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to delete coupon" });
    }
  });

  // Validate coupon
  app.post("/api/coupons/validate", async (req, res) => {
    try {
      const { code, orderTotal, customerPhone } = req.body;
      if (!code || orderTotal === undefined) {
        return res.status(400).json({ error: "Code and orderTotal are required" });
      }
      const result = await storage.validateCoupon(await getRestaurantId(req), code, orderTotal, customerPhone);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to validate coupon" });
    }
  });

  // Use coupon (record usage)
  app.post("/api/coupons/use", async (req, res) => {
    try {
      const data = insertCouponUsageSchema.parse(req.body);
      const usage = await storage.useCoupon(data);
      res.status(201).json(usage);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  // Get coupon usage history
  app.get("/api/coupons/:id/usage", async (req, res) => {
    try {
      const usage = await storage.getCouponUsage(req.params.id);
      res.json(usage);
    } catch (error) {
      res.status(500).json({ error: "Failed to get coupon usage" });
    }
  });

  // ===============================
  // REVIEWS - التقييمات
  // ===============================
  
  // Public: Submit a review for an order
  app.post("/api/public/:restaurantId/reviews", async (req, res) => {
    try {
      const restaurantId = res.locals.restaurantId;
      const { orderId, customerName, customerPhone, rating, comment } = req.body;
      
      if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: "Rating must be between 1 and 5" });
      }
      
      // Check if order exists and belongs to this restaurant
      if (orderId) {
        const order = await storage.getOrder(orderId);
        if (!order || order.restaurantId !== restaurantId) {
          return res.status(404).json({ error: "Order not found" });
        }
        // Check if already reviewed
        const existing = await storage.getReviewByOrder(orderId);
        if (existing) {
          return res.status(400).json({ error: "Order already reviewed" });
        }
      }
      
      const data = insertReviewSchema.parse({
        restaurantId,
        orderId: orderId || null,
        customerName: customerName || null,
        customerPhone: customerPhone || null,
        rating,
        comment: comment || null,
      });
      
      const review = await storage.createReview(data);
      res.status(201).json(review);
    } catch (error) {
      console.error("Review error:", error);
      res.status(400).json({ error: "Failed to submit review" });
    }
  });
  
  // Public: Get reviews for a restaurant
  app.get("/api/public/:restaurantId/reviews", async (req, res) => {
    try {
      const allReviews = await storage.getReviews(res.locals.restaurantId);
      const publicReviews = allReviews.filter(r => r.isPublic);
      res.json(publicReviews);
    } catch (error) {
      res.status(500).json({ error: "Failed to get reviews" });
    }
  });
  
  // Public: Get average rating
  app.get("/api/public/:restaurantId/rating", async (req, res) => {
    try {
      const result = await storage.getAverageRating(res.locals.restaurantId);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to get rating" });
    }
  });
  
  // Public: Check if order was already reviewed
  app.get("/api/public/:restaurantId/reviews/order/:orderId", async (req, res) => {
    try {
      const review = await storage.getReviewByOrder(req.params.orderId);
      res.json({ reviewed: !!review, review: review || null });
    } catch (error) {
      res.status(500).json({ error: "Failed to check review" });
    }
  });
  
  // Admin: Get all reviews
  app.get("/api/reviews", async (req, res) => {
    try {
      const allReviews = await storage.getReviews(await getRestaurantId(req));
      res.json(allReviews);
    } catch (error) {
      res.status(500).json({ error: "Failed to get reviews" });
    }
  });

  // ===============================
  // 3. MENU VARIANTS - متغيرات الأصناف
  // ===============================
  app.get("/api/menu-items/:menuItemId/variants", async (req, res) => {
    try {
      const variants = await storage.getMenuItemVariants(req.params.menuItemId);
      res.json(variants);
    } catch (error) {
      res.status(500).json({ error: "Failed to get variants" });
    }
  });

  app.post("/api/menu-items/:menuItemId/variants", async (req, res) => {
    try {
      const data = insertMenuItemVariantSchema.parse({
        ...req.body,
        menuItemId: req.params.menuItemId,
      });
      const variant = await storage.createMenuItemVariant(data);
      res.status(201).json(variant);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.put("/api/variants/:id", async (req, res) => {
    try {
      const existing = await storage.getMenuItemVariant(req.params.id);
      if (!existing) return res.status(404).json({ error: "Variant not found" });
      const menuItem = await storage.getMenuItem(existing.menuItemId);
      await verifyOwnership(req, menuItem, "Menu item");
      const variant = await storage.updateMenuItemVariant(req.params.id, req.body);
      if (!variant) {
        return res.status(404).json({ error: "Variant not found" });
      }
      res.json(variant);
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.delete("/api/variants/:id", async (req, res) => {
    try {
      const existing = await storage.getMenuItemVariant(req.params.id);
      if (!existing) return res.status(404).json({ error: "Variant not found" });
      const menuItem = await storage.getMenuItem(existing.menuItemId);
      await verifyOwnership(req, menuItem, "Menu item");
      await storage.deleteMenuItemVariant(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to delete variant" });
    }
  });

  // ===============================
  // 3. CUSTOMIZATION GROUPS - مجموعات التخصيص
  // ===============================
  app.get("/api/customization-groups", async (req, res) => {
    try {
      const groups = await storage.getCustomizationGroups(await getRestaurantId(req));
      res.json(groups);
    } catch (error) {
      res.status(500).json({ error: "Failed to get customization groups" });
    }
  });

  app.get("/api/customization-groups/:id", async (req, res) => {
    try {
      const group = await storage.getCustomizationGroup(req.params.id);
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }
      await verifyOwnership(req, group, "Customization group");
      const options = await storage.getCustomizationOptions(group.id);
      res.json({ ...group, options });
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to get customization group" });
    }
  });

  app.post("/api/customization-groups", async (req, res) => {
    try {
      const data = insertCustomizationGroupSchema.parse({
        ...req.body,
        restaurantId: await getRestaurantId(req),
      });
      const group = await storage.createCustomizationGroup(data);
      res.status(201).json(group);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.put("/api/customization-groups/:id", async (req, res) => {
    try {
      const existing = await storage.getCustomizationGroup(req.params.id);
      if (!existing) return res.status(404).json({ error: "Group not found" });
      await verifyOwnership(req, existing, "Customization group");
      const group = await storage.updateCustomizationGroup(req.params.id, req.body);
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }
      res.json(group);
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.delete("/api/customization-groups/:id", async (req, res) => {
    try {
      const existing = await storage.getCustomizationGroup(req.params.id);
      if (!existing) return res.status(404).json({ error: "Group not found" });
      await verifyOwnership(req, existing, "Customization group");
      await storage.deleteCustomizationGroup(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to delete customization group" });
    }
  });

  // Customization Options
  app.get("/api/customization-groups/:groupId/options", async (req, res) => {
    try {
      const options = await storage.getCustomizationOptions(req.params.groupId);
      res.json(options);
    } catch (error) {
      res.status(500).json({ error: "Failed to get options" });
    }
  });

  app.post("/api/customization-groups/:groupId/options", async (req, res) => {
    try {
      const data = insertCustomizationOptionSchema.parse({
        ...req.body,
        groupId: req.params.groupId,
      });
      const option = await storage.createCustomizationOption(data);
      res.status(201).json(option);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.put("/api/customization-options/:id", async (req, res) => {
    try {
      const existing = await storage.getCustomizationOption(req.params.id);
      if (!existing) return res.status(404).json({ error: "Option not found" });
      const group = await storage.getCustomizationGroup(existing.groupId);
      await verifyOwnership(req, group, "Customization group");
      const option = await storage.updateCustomizationOption(req.params.id, req.body);
      if (!option) {
        return res.status(404).json({ error: "Option not found" });
      }
      res.json(option);
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.delete("/api/customization-options/:id", async (req, res) => {
    try {
      const existing = await storage.getCustomizationOption(req.params.id);
      if (!existing) return res.status(404).json({ error: "Option not found" });
      const group = await storage.getCustomizationGroup(existing.groupId);
      await verifyOwnership(req, group, "Customization group");
      await storage.deleteCustomizationOption(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to delete option" });
    }
  });

  // Link/Unlink customizations to menu items
  app.get("/api/menu-items/:menuItemId/customizations", async (req, res) => {
    try {
      const customizations = await storage.getMenuItemCustomizations(req.params.menuItemId);
      res.json(customizations);
    } catch (error) {
      res.status(500).json({ error: "Failed to get customizations" });
    }
  });

  app.post("/api/menu-items/:menuItemId/customizations", async (req, res) => {
    try {
      const data = insertMenuItemCustomizationSchema.parse({
        ...req.body,
        menuItemId: req.params.menuItemId,
      });
      const link = await storage.linkMenuItemCustomization(data);
      res.status(201).json(link);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.delete("/api/menu-items/:menuItemId/customizations/:groupId", async (req, res) => {
    try {
      await storage.unlinkMenuItemCustomization(req.params.menuItemId, req.params.groupId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to unlink customization" });
    }
  });

  // ===============================
  // 4. QUEUE MANAGEMENT - نظام الطابور
  // ===============================
  app.get("/api/queue", async (req, res) => {
    try {
      const branchId = req.query.branch as string | undefined;
      const status = req.query.status as string | undefined;
      const entries = await storage.getQueueEntries(await getRestaurantId(req), branchId, status);
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: "Failed to get queue entries" });
    }
  });

  app.get("/api/queue/stats", async (req, res) => {
    try {
      const branchId = req.query.branch as string | undefined;
      const waitingEntries = await storage.getQueueEntries(await getRestaurantId(req), branchId, "waiting");
      const estimatedWait = await storage.getEstimatedWaitTime(await getRestaurantId(req), branchId);
      res.json({
        waitingCount: waitingEntries.length,
        estimatedWaitMinutes: estimatedWait,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get queue stats" });
    }
  });

  app.get("/api/queue/:id", async (req, res) => {
    try {
      const entry = await storage.getQueueEntry(req.params.id);
      if (!entry) {
        return res.status(404).json({ error: "Queue entry not found" });
      }
      await verifyOwnership(req, entry, "Queue entry");
      const position = await storage.getQueuePosition(entry.id);
      res.json({ ...entry, position });
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to get queue entry" });
    }
  });

  app.post("/api/queue", async (req, res) => {
    try {
      const branchId = req.body.branchId as string | undefined;
      const queueNumber = await storage.getNextQueueNumber(await getRestaurantId(req), branchId);
      const estimatedWait = await storage.getEstimatedWaitTime(await getRestaurantId(req), branchId);
      
      const data = insertQueueEntrySchema.parse({
        ...req.body,
        restaurantId: await getRestaurantId(req),
        queueNumber,
        estimatedWaitMinutes: estimatedWait,
      });
      const entry = await storage.createQueueEntry(data);
      res.status(201).json({ ...entry, position: queueNumber });
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.put("/api/queue/:id", async (req, res) => {
    try {
      const existing = await storage.getQueueEntry(req.params.id);
      if (!existing) return res.status(404).json({ error: "Queue entry not found" });
      await verifyOwnership(req, existing, "Queue entry");
      const entry = await storage.updateQueueEntry(req.params.id, req.body);
      if (!entry) {
        return res.status(404).json({ error: "Queue entry not found" });
      }
      res.json(entry);
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.put("/api/queue/:id/status", async (req, res) => {
    try {
      const { status, tableId } = req.body;
      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }
      
      // If seating, optionally assign table
      let entry;
      if (status === "seated" && tableId) {
        entry = await storage.updateQueueEntry(req.params.id, { tableId });
        await storage.updateTableStatus(tableId, "occupied");
      }
      
      entry = await storage.updateQueueStatus(req.params.id, status);
      if (!entry) {
        return res.status(404).json({ error: "Queue entry not found" });
      }
      res.json(entry);
    } catch (error) {
      res.status(500).json({ error: "Failed to update queue status" });
    }
  });

  app.delete("/api/queue/:id", async (req, res) => {
    try {
      const existing = await storage.getQueueEntry(req.params.id);
      if (!existing) return res.status(404).json({ error: "Queue entry not found" });
      await verifyOwnership(req, existing, "Queue entry");
      await storage.deleteQueueEntry(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to delete queue entry" });
    }
  });

  // Customer-facing: Check queue position by phone
  app.get("/api/queue/check/:phone", async (req, res) => {
    try {
      const branchId = req.query.branch as string | undefined;
      const entries = await storage.getQueueEntries(await getRestaurantId(req), branchId, "waiting");
      const customerEntry = entries.find(e => e.customerPhone === req.params.phone);
      
      if (!customerEntry) {
        return res.status(404).json({ error: "Not in queue" });
      }
      
      const position = await storage.getQueuePosition(customerEntry.id);
      const estimatedWait = position * 10; // 10 minutes per position
      
      res.json({
        ...customerEntry,
        position,
        estimatedWaitMinutes: estimatedWait,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to check queue" });
    }
  });

  // ===============================
  // DAY SESSIONS - إدارة اليوم
  // ===============================
  app.get("/api/day-sessions", async (req, res) => {
    try {
      const branchId = req.query.branch as string | undefined;
      const sessions = await storage.getDaySessions(await getRestaurantId(req), branchId);
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ error: "Failed to get day sessions" });
    }
  });

  app.get("/api/day-sessions/current", async (req, res) => {
    try {
      const branchId = req.query.branch as string | undefined;
      const session = await storage.getCurrentDaySession(await getRestaurantId(req), branchId);
      res.json(session || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to get current session" });
    }
  });

  app.get("/api/day-sessions/:id", async (req, res) => {
    try {
      const session = await storage.getDaySession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      await verifyOwnership(req, session, "Day session");
      res.json(session);
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to get session" });
    }
  });

  app.post("/api/day-sessions/open", async (req, res) => {
    try {
      const branchId = req.query.branch as string | undefined;
      
      // Check if there's already an open session
      const existingSession = await storage.getCurrentDaySession(await getRestaurantId(req), branchId);
      if (existingSession) {
        return res.status(400).json({ error: "يوجد يوم مفتوح بالفعل. يرجى إغلاقه أولاً." });
      }
      
      const data = insertDaySessionSchema.parse({
        ...req.body,
        restaurantId: await getRestaurantId(req),
        branchId: branchId || undefined,
      });
      
      const session = await storage.openDaySession(data);
      
      // Create notification
      await storage.createNotification({
        restaurantId: await getRestaurantId(req),
        branchId: branchId || undefined,
        type: "system",
        title: "Day Opened",
        titleAr: "تم فتح اليوم",
        message: `Day session opened with opening balance: ${req.body.openingBalance || 0} SAR`,
        messageAr: `تم فتح اليوم برصيد افتتاحي: ${req.body.openingBalance || 0} ريال`,
        priority: "normal",
      });
      
      res.status(201).json(session);
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to open day session" });
    }
  });

  app.post("/api/day-sessions/:id/close", async (req, res) => {
    try {
      const session = await storage.closeDaySession(req.params.id, req.body);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      // Create notification
      await storage.createNotification({
        restaurantId: await getRestaurantId(req),
        branchId: session.branchId || undefined,
        type: "system",
        title: "Day Closed",
        titleAr: "تم إغلاق اليوم",
        message: `Day closed. Difference: ${session.difference} SAR`,
        messageAr: `تم إغلاق اليوم. الفرق: ${session.difference} ريال`,
        priority: parseFloat(session.difference || "0") !== 0 ? "high" : "normal",
      });
      
      res.json(session);
    } catch (error) {
      res.status(400).json({ error: "Failed to close day session" });
    }
  });

  // Cash Transactions
  app.get("/api/day-sessions/:id/transactions", async (req, res) => {
    try {
      const transactions = await storage.getCashTransactions(req.params.id);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Failed to get transactions" });
    }
  });

  app.post("/api/day-sessions/:id/transactions", async (req, res) => {
    try {
      const session = await storage.getDaySession(req.params.id);
      if (!session || session.status === "closed") {
        return res.status(400).json({ error: "لا يمكن إضافة تحويلات ليوم مغلق" });
      }
      
      const data = insertCashTransactionSchema.parse({
        ...req.body,
        restaurantId: await getRestaurantId(req),
        sessionId: req.params.id,
      });
      
      const transaction = await storage.createCashTransaction(data);
      res.status(201).json(transaction);
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Failed to create transaction" });
    }
  });

  // ===============================
  // NOTIFICATIONS - الإشعارات
  // ===============================
  app.get("/api/notifications", async (req, res) => {
    try {
      const branchId = req.query.branch as string | undefined;
      const unreadOnly = req.query.unread === "true";
      const notifications = await storage.getNotifications(await getRestaurantId(req), branchId, unreadOnly);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: "Failed to get notifications" });
    }
  });

  app.get("/api/notifications/unread-count", async (req, res) => {
    try {
      const branchId = req.query.branch as string | undefined;
      const notifications = await storage.getNotifications(await getRestaurantId(req), branchId, true);
      res.json({ count: notifications.length });
    } catch (error) {
      res.status(500).json({ error: "Failed to get unread count" });
    }
  });

  app.post("/api/notifications", async (req, res) => {
    try {
      const data = insertNotificationSchema.parse({
        ...req.body,
        restaurantId: await getRestaurantId(req),
      });
      const notification = await storage.createNotification(data);
      res.status(201).json(notification);
    } catch (error: any) {
      res.status(400).json({ error: error?.message || "Invalid request body" });
    }
  });

  app.put("/api/notifications/:id/read", async (req, res) => {
    try {
      const notification = await storage.markNotificationAsRead(req.params.id, req.body.readBy);
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json(notification);
    } catch (error) {
      res.status(400).json({ error: "Failed to mark as read" });
    }
  });

  app.put("/api/notifications/read-all", async (req, res) => {
    try {
      const branchId = req.query.branch as string | undefined;
      await storage.markAllNotificationsAsRead(await getRestaurantId(req), branchId);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Failed to mark all as read" });
    }
  });

  app.delete("/api/notifications/:id", async (req, res) => {
    try {
      await getRestaurantId(req); // require auth
      await storage.deleteNotification(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      if (error?.message === "Authentication required") return res.status(401).json({ error: error.message });
      res.status(500).json({ error: "Failed to delete notification" });
    }
  });

  // Notification Settings
  app.get("/api/notification-settings", async (req, res) => {
    try {
      const branchId = req.query.branch as string | undefined;
      let settings = await storage.getNotificationSettings(await getRestaurantId(req), branchId);
      if (!settings) {
        // Return defaults
        settings = {
          id: "",
          restaurantId: await getRestaurantId(req),
          branchId: null,
          newOrderSound: true,
          newOrderPopup: true,
          orderReadySound: true,
          lowStockAlert: true,
          lowStockThreshold: 10,
          newReservationAlert: true,
          reservationReminderMinutes: 30,
          queueAlertEnabled: true,
          updatedAt: null,
        };
      }
      res.json(settings);
    } catch (error) {
      res.status(500).json({ error: "Failed to get notification settings" });
    }
  });

  app.put("/api/notification-settings", async (req, res) => {
    try {
      const branchId = req.query.branch as string | undefined;
      const settings = await storage.updateNotificationSettings(await getRestaurantId(req), branchId, req.body);
      res.json(settings);
    } catch (error) {
      res.status(400).json({ error: "Failed to update settings" });
    }
  });

  // ===============================
  // ===============================
  // MOYASAR PAYMENT GATEWAY - COMPLETE
  // ===============================

  const getMoyasarAuth = (secretKey?: string | null) => {
    const key = secretKey;
    if (!key) throw new Error("Moyasar secret key not configured for this restaurant");
    return `Basic ${Buffer.from(`${key}:`).toString("base64")}`;
  };

  const MOYASAR_API = "https://api.moyasar.com/v1";
  const MOYASAR_PLATFORM_API = "https://apimig.moyasar.com/v1";

  const getRestaurantMoyasarKeys = async (restaurantId: string) => {
    const restaurant = await storage.getRestaurantById(restaurantId);
    return {
      publishableKey: restaurant?.moyasarPublishableKey || null,
      secretKey: restaurant?.moyasarSecretKey || null,
    };
  };

  // --- Payment Session ---
  app.post("/api/payments/create-session", async (req, res) => {
    try {
      const { orderId, callbackUrl } = req.body;
      if (!orderId || !callbackUrl) {
        return res.status(400).json({ error: "Missing required fields: orderId, callbackUrl" });
      }
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      // Always use server-side order total, never trust client amount
      const serverAmount = parseFloat(order.total || "0");
      if (serverAmount <= 0) {
        return res.status(400).json({ error: "Invalid order total" });
      }
      // Prevent double payment
      if (order.isPaid) {
        return res.status(400).json({ error: "Order is already paid" });
      }
      const keys = await getRestaurantMoyasarKeys(order.restaurantId);
      if (!keys.publishableKey) {
        return res.status(500).json({ error: "Moyasar publishable key not configured", publishableKey: "pending_setup" });
      }
      res.json({
        publishableKey: keys.publishableKey,
        amount: Math.round(serverAmount * 100),
        currency: "SAR",
        description: `Order ${order.orderNumber || orderId}`,
        callbackUrl,
        orderId,
      });
    } catch (error) {
      console.error("Payment session error:", error);
      res.status(500).json({ error: "Failed to create payment session" });
    }
  });

  // --- Verify Payment ---
  app.get("/api/payments/verify/:paymentId", async (req, res) => {
    try {
      const orderId = req.query.orderId as string;
      let secretKey: string | null = null;
      if (orderId) {
        const order = await storage.getOrder(orderId);
        if (order) {
          const keys = await getRestaurantMoyasarKeys(order.restaurantId);
          secretKey = keys.secretKey;
        }
      }
      if (!secretKey) {
        const restaurantId = await getRestaurantId(req).catch(() => null);
        if (restaurantId) {
          const keys = await getRestaurantMoyasarKeys(restaurantId);
          secretKey = keys.secretKey;
        }
      }
      const auth = getMoyasarAuth(secretKey);
      const paymentId = req.params.paymentId;
      const response = await fetch(`${MOYASAR_API}/payments/${paymentId}`, {
        headers: { "Authorization": auth },
      });
      if (!response.ok) {
        return res.status(response.status).json({ error: "Failed to verify payment" });
      }
      const payment = await response.json() as any;
      res.json({
        id: payment.id,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        description: payment.description,
        refunded: payment.refunded,
        refunded_at: payment.refunded_at,
        fee: payment.fee,
        source: payment.source ? {
          type: payment.source.type,
          company: payment.source.company,
          name: payment.source.name,
          message: payment.source.message,
          number: payment.source.number,
        } : null,
        metadata: payment.metadata,
      });
    } catch (error) {
      console.error("Payment verify error:", error);
      res.status(500).json({ error: "Failed to verify payment" });
    }
  });

  // --- Complete Payment ---
  app.post("/api/payments/complete", async (req, res) => {
    try {
      const { orderId, paymentId } = req.body;
      if (!orderId || !paymentId) {
        return res.status(400).json({ error: "Missing orderId or paymentId" });
      }
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      // Idempotency check - if order already paid, return success without re-processing
      if (order.isPaid) {
        const updatedOrder = await storage.getOrder(orderId);
        return res.json(updatedOrder);
      }
      const keys = await getRestaurantMoyasarKeys(order.restaurantId);
      const auth = getMoyasarAuth(keys.secretKey);
      const verifyRes = await fetch(`${MOYASAR_API}/payments/${paymentId}`, {
        headers: { "Authorization": auth },
      });
      if (!verifyRes.ok) {
        return res.status(400).json({ error: "Failed to verify payment with Moyasar" });
      }
      const payment = await verifyRes.json() as any;
      if (payment.metadata?.order_id !== orderId) {
        return res.status(400).json({ error: "Payment does not match this order" });
      }
      const expectedAmount = Math.round(parseFloat(order.total || "0") * 100);
      if (payment.amount !== expectedAmount) {
        return res.status(400).json({ error: "Payment amount does not match order total" });
      }
      if (payment.status === "paid") {
        // If order was payment_pending, change to pending now that payment is verified
        const newStatus = order.status === "payment_pending" ? "pending" : order.status;
        await storage.updateOrder(orderId, { isPaid: true, paymentMethod: "moyasar_online", status: newStatus });

        if (order.tableId && order.orderType === "dine_in") {
          await storage.updateTableStatus(order.tableId, "available");
          if (newStatus !== "completed") {
            await storage.updateOrder(orderId, { isPaid: true, paymentMethod: "moyasar_online", status: "completed" });
          }
        }

        const restaurantId = order.restaurantId;
        await storage.createPaymentTransaction({
          restaurantId,
          orderId,
          moyasarPaymentId: paymentId,
          type: "payment",
          status: "paid",
          amount: payment.amount,
          currency: payment.currency || "SAR",
          paymentMethod: payment.source?.type,
          cardBrand: payment.source?.company,
          cardLast4: payment.source?.number?.slice(-4),
          metadata: { fee: payment.fee },
        });

        // Create invoice and update day session now that payment is verified (for orders that were payment_pending)
        if (order.status === "payment_pending") {
          try {
            const restaurant = await storage.getRestaurantById(restaurantId);
            if (restaurant) {
              const isTaxEnabled = restaurant.taxEnabled !== false;
              const vatRate = isTaxEnabled ? 0.15 : 0;
              // Order total is already tax-inclusive — extract VAT, don't add on top
              const totalWithTax = parseFloat(order.total || "0");
              const subtotal = isTaxEnabled ? Math.round((totalWithTax / 1.15) * 100) / 100 : totalWithTax;
              const vatAmount = Math.round((totalWithTax - subtotal) * 100) / 100;
              const total = totalWithTax;
              const now = new Date();
              const uuid = generateInvoiceUuid();
              const invoiceNumber = await storage.getNextInvoiceNumber(restaurantId);
              const currentCounter = ((restaurant as any).zatcaInvoiceCounter || 0) + 1;
              const previousHash = (restaurant as any).zatcaLastInvoiceHash ||
                Buffer.from('NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==', 'base64').toString('utf8');

              const xmlContent = generateZatcaXml({
                uuid,
                invoiceNumber,
                invoiceType: 'simplified',
                issueDate: now.toISOString().split('T')[0],
                issueTime: now.toTimeString().split(' ')[0],
                deliveryDate: now.toISOString().split('T')[0],
                seller: {
                  nameAr: restaurant.nameAr || restaurant.nameEn || 'مطعم',
                  vatNumber: restaurant.vatNumber || '',
                  commercialRegistration: restaurant.commercialRegistration || '',
                  streetName: restaurant.streetName || '',
                  buildingNumber: restaurant.buildingNumber || '',
                  district: restaurant.district || '',
                  city: restaurant.city || '',
                  postalCode: restaurant.postalCode || '',
                  country: restaurant.country || 'SA',
                },
                items: [{
                  id: '1',
                  nameAr: 'طلب',
                  quantity: 1,
                  unitPrice: subtotal,
                  discount: 0,
                  taxRate: vatRate * 100,
                  taxAmount: Math.round(vatAmount * 100) / 100,
                  totalWithTax: Math.round(total * 100) / 100,
                  totalWithoutTax: Math.round(subtotal * 100) / 100,
                }],
                subtotal,
                discount: 0,
                deliveryFee: 0,
                taxAmount: vatAmount,
                taxRate: vatRate * 100,
                total,
                paymentMethod: 'moyasar_online',
                previousInvoiceHash: previousHash,
                invoiceCounter: currentCounter,
              });

              const invoiceHash = computeInvoiceHashBase64(xmlContent);
              const qrData = generateZatcaQrCode({
                sellerName: restaurant.nameAr || restaurant.nameEn || "Restaurant",
                vatNumber: restaurant.vatNumber || "",
                timestamp: now.toISOString(),
                total: total.toFixed(2),
                vatAmount: vatAmount.toFixed(2),
                invoiceHash: computeInvoiceHash(xmlContent),
              });

              await storage.createInvoice({
                restaurantId,
                orderId,
                invoiceNumber,
                invoiceType: "simplified",
                subtotal: subtotal.toFixed(2),
                taxRate: (vatRate * 100).toFixed(2),
                taxAmount: vatAmount.toFixed(2),
                total: total.toFixed(2),
                qrCodeData: qrData,
                xmlContent,
                invoiceHash,
                previousInvoiceHash: previousHash,
                invoiceCounter: currentCounter,
                uuid,
                status: "issued",
                zatcaStatus: "pending",
              });

              await storage.updateRestaurantById(restaurantId, {
                zatcaInvoiceCounter: currentCounter,
                zatcaLastInvoiceHash: invoiceHash,
              } as any);
            }
          } catch (invoiceError) {
            console.error("Invoice creation error (payment complete):", invoiceError);
          }

          // Update day session totals
          try {
            const currentSession = await storage.getCurrentDaySession(restaurantId, order.branchId || undefined);
            if (currentSession) {
              const orderTotal = parseFloat(order.total || "0");
              await storage.incrementDaySessionTotals(currentSession.id, orderTotal, "moyasar_online");
            }
          } catch (e) {
            console.error("Failed to update day session totals (payment complete):", e);
          }
        }

        const updatedOrder = await storage.getOrder(orderId);
        res.json(updatedOrder);
      } else {
        res.status(400).json({ error: `Payment not completed. Status: ${payment.status}` });
      }
    } catch (error) {
      console.error("Payment complete error:", error);
      res.status(500).json({ error: "Failed to complete payment" });
    }
  });

  // --- Payment Transactions List ---
  app.get("/api/payments/transactions", async (req, res) => {
    try {
      const orderId = req.query.orderId as string | undefined;
      const transactions = await storage.getPaymentTransactions(await getRestaurantId(req), orderId);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Failed to get transactions" });
    }
  });

  // --- Refund Payment (Full or Partial) ---
  app.post("/api/payments/refund", async (req, res) => {
    try {
      const { orderId, paymentId, amount, reason } = req.body;
      if (!orderId || !paymentId) {
        return res.status(400).json({ error: "Missing orderId or paymentId" });
      }
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      // Verify caller owns this order's restaurant
      const callerRestaurantId = await getRestaurantId(req);
      if (order.restaurantId !== callerRestaurantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const keys = await getRestaurantMoyasarKeys(order.restaurantId);
      const auth = getMoyasarAuth(keys.secretKey);
      // Validate refund amount doesn't exceed payment
      const existingPayments = await storage.getPaymentTransactions(order.restaurantId, orderId);
      const originalPayment = existingPayments.find(t => t.moyasarPaymentId === paymentId && t.type === "payment");
      if (!originalPayment) {
        return res.status(404).json({ error: "Original payment not found" });
      }
      const totalRefunded = existingPayments
        .filter(t => t.moyasarPaymentId === paymentId && t.type === "refund")
        .reduce((sum, t) => sum + (t.refundedAmount || 0), 0);
      const refundBody: any = {};
      if (amount) {
        const refundAmount = Math.round(parseFloat(amount) * 100);
        if (refundAmount + totalRefunded > originalPayment.amount) {
          return res.status(400).json({ error: "Refund amount exceeds remaining refundable balance" });
        }
        refundBody.amount = refundAmount;
      }
      const refundRes = await fetch(`${MOYASAR_API}/payments/${paymentId}/refund`, {
        method: "POST",
        headers: {
          "Authorization": auth,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(refundBody),
      });
      if (!refundRes.ok) {
        const errorText = await refundRes.text();
        console.error("Moyasar refund error:", errorText);
        return res.status(400).json({ error: "Refund failed. " + errorText });
      }
      const refundResult = await refundRes.json() as any;
      await storage.createPaymentTransaction({
        restaurantId: await getRestaurantId(req),
        orderId,
        moyasarPaymentId: paymentId,
        type: "refund",
        status: "refunded",
        amount: refundBody.amount || refundResult.amount,
        currency: refundResult.currency || "SAR",
        refundedAmount: refundResult.refunded,
        refundReason: reason || "",
        metadata: { original_amount: refundResult.amount, refunded_total: refundResult.refunded },
      });
      const isFullRefund = refundResult.refunded >= refundResult.amount;
      if (isFullRefund) {
        await storage.updateOrder(orderId, { status: "refunded" });
      }
      res.json({
        success: true,
        payment: {
          id: refundResult.id,
          status: refundResult.status,
          amount: refundResult.amount,
          refunded: refundResult.refunded,
          refunded_at: refundResult.refunded_at,
        },
        isFullRefund,
      });
    } catch (error) {
      console.error("Refund error:", error);
      res.status(500).json({ error: "Failed to process refund" });
    }
  });

  // --- Payment Webhooks (Moyasar sends events here) ---
  app.post("/api/payments/webhook", async (req, res) => {
    try {
      const payload = req.body;
      const eventType = payload.type || payload.event;
      const paymentData = payload.data || payload;
      console.log(`Webhook received: ${eventType}`, paymentData?.id);
      if (!paymentData?.id) {
        return res.status(200).json({ received: true });
      }
      const existingTx = await storage.getPaymentTransactionByMoyasarId(paymentData.id);
      switch (eventType) {
        case "payment_paid": {
          const orderId = paymentData.metadata?.order_id;
          if (orderId) {
            const order = await storage.getOrder(orderId);
            if (order && !order.isPaid) {
              await storage.updateOrder(orderId, { isPaid: true, paymentMethod: "moyasar_online" });
            }
            if (!existingTx && order) {
              await storage.createPaymentTransaction({
                restaurantId: order.restaurantId,
                orderId,
                moyasarPaymentId: paymentData.id,
                type: "payment",
                status: "paid",
                amount: paymentData.amount,
                currency: paymentData.currency || "SAR",
                paymentMethod: paymentData.source?.type,
                cardBrand: paymentData.source?.company,
                webhookReceived: true,
              });
            } else {
              await storage.updatePaymentTransaction(existingTx.id, { webhookReceived: true, status: "paid" });
            }
          }
          break;
        }
        case "payment_failed": {
          const orderId = paymentData.metadata?.order_id;
          if (existingTx) {
            await storage.updatePaymentTransaction(existingTx.id, { webhookReceived: true, status: "failed" });
          } else if (orderId) {
            const failedOrder = await storage.getOrder(orderId);
            if (failedOrder) {
              await storage.createPaymentTransaction({
                restaurantId: failedOrder.restaurantId,
                orderId,
                moyasarPaymentId: paymentData.id,
                type: "payment",
                status: "failed",
                amount: paymentData.amount,
                currency: paymentData.currency || "SAR",
                webhookReceived: true,
              });
            }
          }
          break;
        }
        case "payment_refunded": {
          if (existingTx) {
            await storage.updatePaymentTransaction(existingTx.id, {
              webhookReceived: true,
              status: "refunded",
              refundedAmount: paymentData.refunded,
            });
          }
          const orderId = paymentData.metadata?.order_id;
          if (orderId && paymentData.refunded >= paymentData.amount) {
            await storage.updateOrder(orderId, { status: "refunded" });
          }
          break;
        }
      }
      res.status(200).json({ received: true });
    } catch (error) {
      console.error("Payment webhook error:", error);
      res.status(200).json({ received: true });
    }
  });

  // --- Moyasar Invoices (Payment Links) ---
  app.get("/api/payments/invoices", async (req, res) => {
    try {
      const invoices = await storage.getMoyasarInvoices(await getRestaurantId(req));
      res.json(invoices);
    } catch (error) {
      res.status(500).json({ error: "Failed to get invoices" });
    }
  });

  app.post("/api/payments/invoices", async (req, res) => {
    try {
      const { orderId, amount, description, customerName, customerPhone, customerEmail, expiredAt } = req.body;
      if (!amount || !description) {
        return res.status(400).json({ error: "Missing amount or description" });
      }
      const rId = await getRestaurantId(req);
      const rKeys = await getRestaurantMoyasarKeys(rId);
      const auth = getMoyasarAuth(rKeys.secretKey);
      const amountInHalalas = Math.round(parseFloat(amount) * 100);
      const baseUrl = `${req.protocol}://${req.get("host")}`;
      const invoicePayload: any = {
        amount: amountInHalalas,
        currency: "SAR",
        description,
        callback_url: `${baseUrl}/api/payments/invoices/callback`,
      };
      if (expiredAt) invoicePayload.expired_at = expiredAt;
      if (orderId) invoicePayload.metadata = { order_id: orderId };
      const moyasarRes = await fetch(`${MOYASAR_API}/invoices`, {
        method: "POST",
        headers: {
          "Authorization": auth,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(
          Object.entries(invoicePayload).reduce((acc: any, [k, v]) => {
            if (typeof v === "object") {
              Object.entries(v as any).forEach(([mk, mv]) => { acc[`${k}[${mk}]`] = String(mv); });
            } else {
              acc[k] = String(v);
            }
            return acc;
          }, {})
        ),
      });
      if (!moyasarRes.ok) {
        const errText = await moyasarRes.text();
        console.error("Moyasar invoice error:", errText);
        return res.status(400).json({ error: "Failed to create invoice with Moyasar" });
      }
      const moyasarInvoice = await moyasarRes.json() as any;
      const localInvoice = await storage.createMoyasarInvoice({
        restaurantId: await getRestaurantId(req),
        orderId: orderId || null,
        moyasarInvoiceId: moyasarInvoice.id,
        status: moyasarInvoice.status,
        amount: amountInHalalas,
        currency: "SAR",
        description,
        invoiceUrl: moyasarInvoice.url,
        callbackUrl: invoicePayload.callback_url,
        customerName: customerName || null,
        customerPhone: customerPhone || null,
        customerEmail: customerEmail || null,
        expiredAt: expiredAt ? new Date(expiredAt) : null,
        metadata: { moyasar_id: moyasarInvoice.id },
      });
      res.status(201).json({ ...localInvoice, moyasarUrl: moyasarInvoice.url });
    } catch (error) {
      console.error("Create invoice error:", error);
      res.status(500).json({ error: "Failed to create invoice" });
    }
  });

  app.post("/api/payments/invoices/callback", async (req, res) => {
    try {
      const payload = req.body;
      console.log("Invoice callback received:", payload);
      if (payload.id) {
        const inv = await storage.getMoyasarInvoiceByMoyasarId(payload.id);
        if (inv) {
          await storage.updateMoyasarInvoice(inv.id, {
            status: payload.status || "paid",
            paidAt: new Date(),
          });
          if (inv.orderId && payload.status === "paid") {
            await storage.updateOrder(inv.orderId, { isPaid: true, paymentMethod: "moyasar_online" });
          }
        }
      }
      res.status(200).json({ received: true });
    } catch (error) {
      console.error("Invoice callback error:", error);
      res.status(200).json({ received: true });
    }
  });

  // --- Apple Pay Domain Management ---
  app.get("/api/payments/apple-pay-domains", async (req, res) => {
    try {
      const domains = await storage.getApplePayDomains(await getRestaurantId(req));
      res.json(domains);
    } catch (error) {
      res.status(500).json({ error: "Failed to get Apple Pay domains" });
    }
  });

  app.post("/api/payments/apple-pay-domains", async (req, res) => {
    try {
      const { host } = req.body;
      if (!host) {
        return res.status(400).json({ error: "Domain host is required" });
      }
      const dRestId = await getRestaurantId(req);
      const merchant = await storage.getMoyasarMerchant(dRestId);
      if (!merchant || !merchant.moyasarMerchantId) {
        return res.status(400).json({ error: "Merchant not set up. Please complete merchant onboarding first." });
      }
      const dKeys = await getRestaurantMoyasarKeys(dRestId);
      const auth = getMoyasarAuth(dKeys.secretKey);
      const moyasarRes = await fetch(`${MOYASAR_PLATFORM_API}/merchants/${merchant.moyasarMerchantId}/domains`, {
        method: "POST",
        headers: {
          "Authorization": auth,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({ host }),
      });
      let moyasarDomain: any = null;
      if (moyasarRes.ok) {
        moyasarDomain = await moyasarRes.json();
      }
      const domain = await storage.createApplePayDomain({
        restaurantId: await getRestaurantId(req),
        merchantId: merchant.id,
        moyasarDomainId: moyasarDomain?.id || null,
        host,
        status: moyasarDomain?.status || "initiated",
      });
      res.status(201).json(domain);
    } catch (error) {
      console.error("Apple Pay domain error:", error);
      res.status(500).json({ error: "Failed to register Apple Pay domain" });
    }
  });

  app.post("/api/payments/apple-pay-domains/:id/validate", async (req, res) => {
    try {
      const merchant = await storage.getMoyasarMerchant(await getRestaurantId(req));
      if (!merchant || !merchant.moyasarMerchantId) {
        return res.status(400).json({ error: "Merchant not found" });
      }
      const vRestId = await getRestaurantId(req);
      const domains = await storage.getApplePayDomains(vRestId);
      const domain = domains.find(d => d.id === req.params.id);
      if (!domain || !domain.moyasarDomainId) {
        return res.status(404).json({ error: "Domain not found" });
      }
      const vKeys = await getRestaurantMoyasarKeys(vRestId);
      const auth = getMoyasarAuth(vKeys.secretKey);
      const valRes = await fetch(`${MOYASAR_PLATFORM_API}/merchants/${merchant.moyasarMerchantId}/domains/${domain.moyasarDomainId}/validate`, {
        method: "POST",
        headers: { "Authorization": auth },
      });
      if (valRes.ok) {
        await storage.updateApplePayDomain(domain.id, { status: "validated" });
        res.json({ success: true, status: "validated" });
      } else {
        res.status(400).json({ error: "Domain validation failed" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to validate domain" });
    }
  });

  app.delete("/api/payments/apple-pay-domains/:id", async (req, res) => {
    try {
      await storage.deleteApplePayDomain(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete domain" });
    }
  });

  // --- Apple Pay Association File ---
  app.get("/.well-known/apple-developer-merchantid-domain-association", async (req, res) => {
    try {
      const fs = await import("fs");
      const path = await import("path");
      const staticFile = path.join(process.cwd(), "client", "public", ".well-known", "apple-developer-merchantid-domain-association");
      if (fs.existsSync(staticFile)) {
        res.set("Content-Type", "text/plain");
        return res.send(fs.readFileSync(staticFile, "utf-8"));
      }
      const fRestId = await getRestaurantId(req);
      const merchant = await storage.getMoyasarMerchant(fRestId);
      if (!merchant || !merchant.moyasarMerchantId) {
        return res.status(404).send("Merchant not configured");
      }
      const fKeys = await getRestaurantMoyasarKeys(fRestId);
      const auth = getMoyasarAuth(fKeys.secretKey);
      const fileRes = await fetch(`${MOYASAR_PLATFORM_API}/merchants/${merchant.moyasarMerchantId}/domains/verification_file`, {
        headers: { "Authorization": auth, "Accept": "application/json" },
      });
      if (fileRes.ok) {
        const data = await fileRes.json() as any;
        res.set("Content-Type", "text/plain");
        res.send(data.data || data.message || "");
      } else {
        res.status(404).send("Association file not available");
      }
    } catch (error) {
      res.status(500).send("Error fetching association file");
    }
  });

  // --- Merchant Balance ---
  app.get("/api/payments/balance", async (req: any, res) => {
    try {
      const bRestId = await getRestaurantId(req);
      const bKeys = await getRestaurantMoyasarKeys(bRestId);
      const auth = getMoyasarAuth(bKeys.secretKey);
      const balanceRes = await fetch(`${MOYASAR_PLATFORM_API}/balance`, {
        headers: { "Authorization": auth, "Accept": "application/json" },
      });
      if (balanceRes.ok) {
        const balance = await balanceRes.json();
        res.json(balance);
      } else {
        res.json({ currency: "SAR", total: 0, available: 0, transferred: 0 });
      }
    } catch (error) {
      res.json({ currency: "SAR", total: 0, available: 0, transferred: 0 });
    }
  });

  // --- Merchant Onboarding (Platform API) ---
  app.post("/api/payments/merchant/register", async (req, res) => {
    res.redirect(307, "/api/moyasar/merchant");
  });

  app.post("/api/payments/merchant/submit-review", async (req, res) => {
    res.redirect(307, "/api/moyasar/merchant/submit-review");
  });

  // --- Test Cards Reference ---
  app.get("/api/payments/test-cards", (_req, res) => {
    res.json({
      testCards: [
        { brand: "Visa", number: "4111111111111111", expiry: "09/25", cvc: "123", result: "Successful" },
        { brand: "Visa", number: "4000000000000002", expiry: "09/25", cvc: "123", result: "Declined" },
        { brand: "Mastercard", number: "5111111111111118", expiry: "09/25", cvc: "123", result: "Successful" },
        { brand: "Mastercard", number: "5200000000000007", expiry: "09/25", cvc: "123", result: "Declined" },
        { brand: "Mada", number: "5043000000000003", expiry: "09/25", cvc: "123", result: "Successful" },
        { brand: "Mada", number: "5043000000000011", expiry: "09/25", cvc: "123", result: "Declined" },
        { brand: "Amex", number: "340000000000009", expiry: "09/25", cvc: "1234", result: "Successful" },
        { brand: "Amex", number: "340000000000033", expiry: "09/25", cvc: "1234", result: "Declined" },
      ],
      stcPayTestOTP: "000000",
      note: "Use these test cards with pk_test_/sk_test_ API keys only",
    });
  });

  app.get("/api/export/orders", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const branchId = req.query.branchId as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const orders = await storage.getOrders(restaurantId, branchId);
      
      let filtered = orders;
      if (startDate) {
        filtered = filtered.filter(o => new Date(o.createdAt!) >= new Date(startDate));
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filtered = filtered.filter(o => new Date(o.createdAt!) <= end);
      }

      const header = "Order Number,Date,Type,Status,Payment Method,Paid,Customer Name,Customer Phone,Subtotal,Discount,Tax,Delivery Fee,Total,Notes\n";
      const rows = filtered.map(o => {
        const date = o.createdAt ? new Date(o.createdAt).toISOString().split("T")[0] : "";
        return [
          o.orderNumber || "",
          date,
          o.orderType || "",
          o.status || "",
          o.paymentMethod || "",
          o.isPaid ? "Yes" : "No",
          `"${(o.customerName || "").replace(/"/g, '""')}"`,
          o.customerPhone || "",
          o.subtotal || "0",
          o.discount || "0",
          o.tax || "0",
          o.deliveryFee || "0",
          o.total || "0",
          `"${(o.notes || "").replace(/"/g, '""')}"`,
        ].join(",");
      }).join("\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename=orders_${new Date().toISOString().split("T")[0]}.csv`);
      res.send("\uFEFF" + header + rows);
    } catch (error) {
      res.status(500).json({ error: "Failed to export orders" });
    }
  });

  app.get("/api/export/inventory", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const branchId = req.query.branchId as string | undefined;
      const items = await storage.getInventoryItems(restaurantId, branchId);

      const header = "Name,Category,Current Stock,Min Stock,Unit,Cost,Supplier\n";
      const rows = items.map(i => [
        `"${(i.name || "").replace(/"/g, '""')}"`,
        `"${(i.category || "").replace(/"/g, '""')}"`,
        i.currentStock || "0",
        i.minStock || "0",
        i.unit || "",
        i.costPerUnit || "0",
        `""`,
      ].join(",")).join("\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename=inventory_${new Date().toISOString().split("T")[0]}.csv`);
      res.send("\uFEFF" + header + rows);
    } catch (error) {
      res.status(500).json({ error: "Failed to export inventory" });
    }
  });

  app.get("/api/export/customers", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const customers = await storage.getCustomers(restaurantId);

      const header = "Name,Phone,Email,Address,Total Orders,Total Spent,Notes\n";
      const rows = customers.map(c => [
        `"${(c.name || "").replace(/"/g, '""')}"`,
        c.phone || "",
        c.email || "",
        `"${(c.address || "").replace(/"/g, '""')}"`,
        c.totalOrders || "0",
        c.totalSpent || "0",
        `"${(c.notes || "").replace(/"/g, '""')}"`,
      ].join(",")).join("\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename=customers_${new Date().toISOString().split("T")[0]}.csv`);
      res.send("\uFEFF" + header + rows);
    } catch (error) {
      res.status(500).json({ error: "Failed to export customers" });
    }
  });

  // =====================================================
  // ZATCA E-Invoicing Routes
  // =====================================================

  // Get ZATCA configuration status
  app.get("/api/zatca/status", async (req, res) => {
    try {
      const restaurant = await storage.getRestaurantById(await getRestaurantId(req));
      if (!restaurant) return res.status(404).json({ error: "Restaurant not found" });

      res.json({
        environment: restaurant.zatcaEnvironment || 'sandbox',
        hasVatNumber: !!restaurant.vatNumber,
        hasCertificate: !!restaurant.zatcaCertificate,
        hasComplianceCsid: !!restaurant.zatcaComplianceCsid,
        hasProductionCsid: !!restaurant.zatcaProductionCsid,
        hasDeviceId: !!restaurant.zatcaDeviceId,
        certificateExpiry: restaurant.zatcaCertificateExpiry,
        invoiceCounter: restaurant.zatcaInvoiceCounter || 0,
        taxEnabled: restaurant.taxEnabled !== false,
        taxRate: restaurant.taxRate || '15',
        vatNumber: restaurant.vatNumber,
        isFullyConfigured: !!(
          restaurant.vatNumber &&
          restaurant.zatcaProductionCsid &&
          restaurant.nameAr &&
          restaurant.streetName &&
          restaurant.buildingNumber &&
          restaurant.city &&
          restaurant.postalCode
        ),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get ZATCA status" });
    }
  });

  // Register device - Step 1: Get Compliance CSID
  app.post("/api/zatca/compliance-csid", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const restaurant = await storage.getRestaurantById(restaurantId);
      if (!restaurant) return res.status(404).json({ error: "Restaurant not found" });

      const { otp, csr } = req.body;
      if (!otp) return res.status(400).json({ error: "OTP is required" });
      if (!csr) return res.status(400).json({ error: "CSR is required" });

      const environment = restaurant.zatcaEnvironment || 'sandbox';
      const baseUrl = getZatcaBaseUrl(environment);

      const result = await getComplianceCsid(baseUrl, otp, csr);

      // Store compliance CSID
      await storage.updateRestaurantById(restaurantId, {
        zatcaComplianceCsid: result.binarySecurityToken,
        zatcaSecretKey: result.secret,
        zatcaDeviceId: result.requestId,
      } as any);

      res.json({
        success: true,
        requestId: result.requestId,
        dispositionMessage: result.dispositionMessage,
      });
    } catch (error: any) {
      console.error("ZATCA Compliance CSID error:", error?.message);
      res.status(500).json({ error: error?.message || "Failed to get compliance CSID" });
    }
  });

  // Register device - Step 2: Run compliance checks
  app.post("/api/zatca/compliance-check", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const restaurant = await storage.getRestaurantById(restaurantId);
      if (!restaurant) return res.status(404).json({ error: "Restaurant not found" });

      if (!restaurant.zatcaComplianceCsid || !restaurant.zatcaSecretKey) {
        return res.status(400).json({ error: "Missing compliance CSID. Complete Step 1 first." });
      }

      const environment = restaurant.zatcaEnvironment || 'sandbox';
      const baseUrl = getZatcaBaseUrl(environment);

      // Generate a test invoice for compliance check
      const uuid = generateInvoiceUuid();
      const now = new Date();
      const previousHash = restaurant.zatcaLastInvoiceHash ||
        Buffer.from('NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==', 'base64').toString('utf8');

      const testXml = generateZatcaXml({
        uuid,
        invoiceNumber: 'TEST-001',
        invoiceType: 'simplified',
        issueDate: now.toISOString().split('T')[0],
        issueTime: now.toTimeString().split(' ')[0],
        deliveryDate: now.toISOString().split('T')[0],
        seller: {
          nameAr: restaurant.nameAr || restaurant.nameEn || 'مطعم',
          vatNumber: restaurant.vatNumber || '',
          commercialRegistration: restaurant.commercialRegistration || '',
          streetName: restaurant.streetName || '',
          buildingNumber: restaurant.buildingNumber || '',
          district: restaurant.district || '',
          city: restaurant.city || '',
          postalCode: restaurant.postalCode || '',
          country: 'SA',
        },
        items: [{
          id: '1',
          nameAr: 'منتج تجريبي',
          quantity: 1,
          unitPrice: 100,
          discount: 0,
          taxRate: 15,
          taxAmount: 15,
          totalWithTax: 115,
          totalWithoutTax: 100,
        }],
        subtotal: 100,
        discount: 0,
        deliveryFee: 0,
        taxAmount: 15,
        taxRate: 15,
        total: 115,
        previousInvoiceHash: previousHash,
        invoiceCounter: 1,
      });

      const hash = computeInvoiceHashBase64(testXml);

      const result = await submitComplianceInvoice(
        baseUrl,
        restaurant.zatcaComplianceCsid,
        restaurant.zatcaSecretKey,
        hash,
        uuid,
        testXml
      );

      res.json({
        success: result.validationResults?.status === 'PASS',
        validationResults: result.validationResults,
        reportingStatus: result.reportingStatus,
      });
    } catch (error: any) {
      console.error("ZATCA Compliance check error:", error?.message);
      res.status(500).json({ error: error?.message || "Compliance check failed" });
    }
  });

  // Register device - Step 3: Get Production CSID
  app.post("/api/zatca/production-csid", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const restaurant = await storage.getRestaurantById(restaurantId);
      if (!restaurant) return res.status(404).json({ error: "Restaurant not found" });

      if (!restaurant.zatcaComplianceCsid || !restaurant.zatcaSecretKey || !restaurant.zatcaDeviceId) {
        return res.status(400).json({ error: "Missing compliance credentials. Complete Steps 1-2 first." });
      }

      const environment = restaurant.zatcaEnvironment || 'sandbox';
      const baseUrl = getZatcaBaseUrl(environment);

      const result = await getProductionCsid(
        baseUrl,
        restaurant.zatcaDeviceId,
        restaurant.zatcaComplianceCsid,
        restaurant.zatcaSecretKey
      );

      // Store production CSID
      await storage.updateRestaurantById(restaurantId, {
        zatcaProductionCsid: result.binarySecurityToken,
        zatcaSecretKey: result.secret,
        zatcaCertificate: result.binarySecurityToken,
      } as any);

      res.json({
        success: true,
        requestId: result.requestId,
        dispositionMessage: result.dispositionMessage,
      });
    } catch (error: any) {
      console.error("ZATCA Production CSID error:", error?.message);
      res.status(500).json({ error: error?.message || "Failed to get production CSID" });
    }
  });

  // Submit invoice to ZATCA (report simplified / clear standard)
  app.post("/api/zatca/submit/:invoiceId", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const restaurant = await storage.getRestaurantById(restaurantId);
      if (!restaurant) return res.status(404).json({ error: "Restaurant not found" });

      const invoice = await storage.getInvoice(req.params.invoiceId);
      if (!invoice) return res.status(404).json({ error: "Invoice not found" });
      if (invoice.restaurantId !== restaurantId) return res.status(403).json({ error: "Unauthorized" });

      const certificate = restaurant.zatcaProductionCsid || restaurant.zatcaComplianceCsid;
      const secret = restaurant.zatcaSecretKey;
      if (!certificate || !secret) {
        return res.status(400).json({ error: "ZATCA not configured. Complete device registration first." });
      }

      if (!invoice.xmlContent && !invoice.signedXml) {
        return res.status(400).json({ error: "Invoice has no XML content to submit." });
      }

      const xmlToSubmit = invoice.signedXml || invoice.xmlContent || '';
      const hash = invoice.invoiceHash || computeInvoiceHashBase64(xmlToSubmit);
      const uuid = invoice.uuid || generateInvoiceUuid();

      const environment = restaurant.zatcaEnvironment || 'sandbox';
      const baseUrl = getZatcaBaseUrl(environment);

      let result;
      if (invoice.invoiceType === 'standard') {
        // Standard invoice needs clearance
        result = await clearInvoice(baseUrl, certificate, secret, hash, uuid, xmlToSubmit);
        await storage.updateInvoice(invoice.id, {
          zatcaStatus: result.clearanceStatus === 'CLEARED' ? 'accepted' : 'rejected',
          zatcaSubmissionId: uuid,
          zatcaWarnings: JSON.stringify(result.validationResults?.warningMessages || []),
          zatcaErrors: JSON.stringify(result.validationResults?.errorMessages || []),
          signedXml: result.clearedInvoice ? Buffer.from(result.clearedInvoice, 'base64').toString('utf8') : xmlToSubmit,
          status: result.clearanceStatus === 'CLEARED' ? 'reported' : 'issued',
        });
      } else {
        // Simplified invoice needs reporting
        result = await reportInvoice(baseUrl, certificate, secret, hash, uuid, xmlToSubmit);
        await storage.updateInvoice(invoice.id, {
          zatcaStatus: result.reportingStatus === 'REPORTED' ? 'accepted' : 
                       result.reportingStatus === 'NOT_REPORTED' ? 'rejected' : 'submitted',
          zatcaSubmissionId: uuid,
          zatcaWarnings: JSON.stringify(result.validationResults?.warningMessages || []),
          zatcaErrors: JSON.stringify(result.validationResults?.errorMessages || []),
          status: result.reportingStatus === 'REPORTED' ? 'reported' : 'issued',
        });
      }

      res.json({
        success: true,
        status: result.validationResults?.status,
        validationResults: result.validationResults,
      });
    } catch (error: any) {
      console.error("ZATCA submission error:", error?.message);

      // Update invoice status on failure
      try {
        await storage.updateInvoice(req.params.invoiceId, {
          zatcaStatus: 'rejected',
          zatcaErrors: JSON.stringify([{ message: error?.message || 'Unknown error' }]),
        });
      } catch {}

      res.status(500).json({ error: error?.message || "Failed to submit invoice to ZATCA" });
    }
  });

  // Batch submit pending invoices to ZATCA
  app.post("/api/zatca/submit-batch", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const restaurant = await storage.getRestaurantById(restaurantId);
      if (!restaurant) return res.status(404).json({ error: "Restaurant not found" });

      const certificate = restaurant.zatcaProductionCsid || restaurant.zatcaComplianceCsid;
      const secret = restaurant.zatcaSecretKey;
      if (!certificate || !secret) {
        return res.status(400).json({ error: "ZATCA not configured" });
      }

      const allInvoices = await storage.getInvoices(restaurantId);
      const pendingInvoices = allInvoices.filter(
        inv => inv.xmlContent && (!inv.zatcaStatus || inv.zatcaStatus === 'pending')
      );

      const environment = restaurant.zatcaEnvironment || 'sandbox';
      const baseUrl = getZatcaBaseUrl(environment);
      
      const results: Array<{ invoiceId: string; invoiceNumber: string; status: string; error?: string }> = [];

      for (const invoice of pendingInvoices) {
        try {
          const xmlToSubmit = invoice.signedXml || invoice.xmlContent || '';
          const hash = invoice.invoiceHash || computeInvoiceHashBase64(xmlToSubmit);
          const uuid = invoice.uuid || generateInvoiceUuid();

          if (invoice.invoiceType === 'standard') {
            const result = await clearInvoice(baseUrl, certificate, secret, hash, uuid, xmlToSubmit);
            await storage.updateInvoice(invoice.id, {
              zatcaStatus: result.clearanceStatus === 'CLEARED' ? 'accepted' : 'rejected',
              zatcaSubmissionId: uuid,
              zatcaWarnings: JSON.stringify(result.validationResults?.warningMessages || []),
              zatcaErrors: JSON.stringify(result.validationResults?.errorMessages || []),
              status: result.clearanceStatus === 'CLEARED' ? 'reported' : 'issued',
            });
            results.push({ invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber || '', status: result.clearanceStatus || 'UNKNOWN' });
          } else {
            const result = await reportInvoice(baseUrl, certificate, secret, hash, uuid, xmlToSubmit);
            await storage.updateInvoice(invoice.id, {
              zatcaStatus: result.reportingStatus === 'REPORTED' ? 'accepted' : 'rejected',
              zatcaSubmissionId: uuid,
              zatcaWarnings: JSON.stringify(result.validationResults?.warningMessages || []),
              zatcaErrors: JSON.stringify(result.validationResults?.errorMessages || []),
              status: result.reportingStatus === 'REPORTED' ? 'reported' : 'issued',
            });
            results.push({ invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber || '', status: result.reportingStatus || 'UNKNOWN' });
          }
        } catch (err: any) {
          results.push({ invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber || '', status: 'ERROR', error: err?.message });
        }
      }

      res.json({
        total: pendingInvoices.length,
        results,
        accepted: results.filter(r => r.status === 'REPORTED' || r.status === 'CLEARED').length,
        rejected: results.filter(r => r.status === 'NOT_REPORTED' || r.status === 'NOT_CLEARED').length,
        errors: results.filter(r => r.status === 'ERROR').length,
      });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Batch submission failed" });
    }
  });

  // Generate ZATCA invoice for an existing order (with full XML + hash chain)
  app.post("/api/zatca/generate/:orderId", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const restaurant = await storage.getRestaurantById(restaurantId);
      if (!restaurant) return res.status(404).json({ error: "Restaurant not found" });

      const order = await storage.getOrder(req.params.orderId);
      if (!order) return res.status(404).json({ error: "Order not found" });
      if (order.restaurantId !== restaurantId) return res.status(403).json({ error: "Unauthorized" });

      // Check if invoice already exists for this order
      const existingInvoice = await storage.getInvoiceByOrder(order.id);
      if (existingInvoice) {
        return res.status(409).json({ error: "Invoice already exists for this order", invoice: existingInvoice });
      }

      const orderItems = await storage.getOrderItems(order.id);
      const menuItemsRaw = await storage.getMenuItems(restaurantId);
      const menuItemsMap = new Map(menuItemsRaw.map(m => [m.id, m]));

      const invoiceType = (req.body.invoiceType as 'simplified' | 'standard') || 'simplified';
      const buyer = req.body.buyer;

      const zatcaResult = await buildZatcaInvoice(
        restaurant, order, orderItems, menuItemsMap, invoiceType, undefined, buyer
      );

      // Create the invoice record
      const invoice = await storage.createInvoice({
        restaurantId,
        orderId: order.id,
        invoiceNumber: zatcaResult.invoiceNumber,
        invoiceType: zatcaResult.invoiceType,
        subtotal: zatcaResult.subtotal,
        taxRate: zatcaResult.taxRate,
        taxAmount: zatcaResult.taxAmount,
        total: zatcaResult.total,
        discount: zatcaResult.discount,
        deliveryFee: zatcaResult.deliveryFee,
        qrCodeData: zatcaResult.qrData,
        xmlContent: zatcaResult.xmlContent,
        invoiceHash: zatcaResult.invoiceHash,
        previousInvoiceHash: zatcaResult.previousInvoiceHash,
        invoiceCounter: zatcaResult.invoiceCounter,
        uuid: zatcaResult.uuid,
        status: 'issued',
        zatcaStatus: 'pending',
      });

      res.status(201).json(invoice);
    } catch (error: any) {
      console.error("ZATCA generate error:", error);
      res.status(500).json({ error: error?.message || "Failed to generate ZATCA invoice" });
    }
  });

  // Create credit note for an existing invoice
  app.post("/api/zatca/credit-note/:invoiceId", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const restaurant = await storage.getRestaurantById(restaurantId);
      if (!restaurant) return res.status(404).json({ error: "Restaurant not found" });

      const originalInvoice = await storage.getInvoice(req.params.invoiceId);
      if (!originalInvoice) return res.status(404).json({ error: "Original invoice not found" });
      if (originalInvoice.restaurantId !== restaurantId) return res.status(403).json({ error: "Unauthorized" });

      const order = await storage.getOrder(originalInvoice.orderId);
      if (!order) return res.status(404).json({ error: "Order not found" });

      const orderItems = await storage.getOrderItems(order.id);
      const menuItemsRaw = await storage.getMenuItems(restaurantId);
      const menuItemsMap = new Map(menuItemsRaw.map(m => [m.id, m]));

      const zatcaResult = await buildZatcaInvoice(
        restaurant, order, orderItems, menuItemsMap, 'credit_note', originalInvoice
      );

      const creditNote = await storage.createInvoice({
        restaurantId,
        orderId: order.id,
        invoiceNumber: zatcaResult.invoiceNumber,
        invoiceType: 'credit_note',
        subtotal: zatcaResult.subtotal,
        taxRate: zatcaResult.taxRate,
        taxAmount: zatcaResult.taxAmount,
        total: zatcaResult.total,
        discount: zatcaResult.discount,
        deliveryFee: zatcaResult.deliveryFee,
        qrCodeData: zatcaResult.qrData,
        xmlContent: zatcaResult.xmlContent,
        invoiceHash: zatcaResult.invoiceHash,
        previousInvoiceHash: zatcaResult.previousInvoiceHash,
        invoiceCounter: zatcaResult.invoiceCounter,
        uuid: zatcaResult.uuid,
        relatedInvoiceId: originalInvoice.id,
        status: 'issued',
        zatcaStatus: 'pending',
      });

      // Cancel original invoice
      await storage.updateInvoice(originalInvoice.id, { status: 'cancelled' });

      res.status(201).json(creditNote);
    } catch (error: any) {
      console.error("ZATCA credit note error:", error);
      res.status(500).json({ error: error?.message || "Failed to create credit note" });
    }
  });

  // Get ZATCA dashboard stats
  app.get("/api/zatca/dashboard", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const invoices = await storage.getInvoices(restaurantId);

      const stats = {
        total: invoices.length,
        pending: invoices.filter(i => i.zatcaStatus === 'pending' || !i.zatcaStatus).length,
        submitted: invoices.filter(i => i.zatcaStatus === 'submitted').length,
        accepted: invoices.filter(i => i.zatcaStatus === 'accepted').length,
        rejected: invoices.filter(i => i.zatcaStatus === 'rejected').length,
        withXml: invoices.filter(i => !!i.xmlContent).length,
        withoutXml: invoices.filter(i => !i.xmlContent).length,
        creditNotes: invoices.filter(i => i.invoiceType === 'credit_note').length,
        debitNotes: invoices.filter(i => i.invoiceType === 'debit_note').length,
        simplified: invoices.filter(i => i.invoiceType === 'simplified').length,
        standard: invoices.filter(i => i.invoiceType === 'standard').length,
      };

      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to get ZATCA dashboard" });
    }
  });

  // Update ZATCA environment setting
  app.put("/api/zatca/environment", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const { environment } = req.body;
      if (!['sandbox', 'simulation', 'production'].includes(environment)) {
        return res.status(400).json({ error: "Invalid environment. Use: sandbox, simulation, or production" });
      }
      await storage.updateRestaurantById(restaurantId, { zatcaEnvironment: environment } as any);
      res.json({ success: true, environment });
    } catch (error) {
      res.status(500).json({ error: "Failed to update environment" });
    }
  });

  // Download invoice XML
  app.get("/api/zatca/xml/:invoiceId", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const invoice = await storage.getInvoice(req.params.invoiceId);
      if (!invoice) return res.status(404).json({ error: "Invoice not found" });
      if (invoice.restaurantId !== restaurantId) return res.status(403).json({ error: "Unauthorized" });

      const xml = invoice.signedXml || invoice.xmlContent;
      if (!xml) return res.status(404).json({ error: "No XML content available" });

      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename=invoice_${invoice.invoiceNumber || invoice.id}.xml`);
      res.send(xml);
    } catch (error) {
      res.status(500).json({ error: "Failed to download XML" });
    }
  });

  return httpServer;
}

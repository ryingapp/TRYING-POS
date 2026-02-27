import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { sql } from "drizzle-orm";
import multer from "multer";
import path from "path";
import fs from "fs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import * as edfapay from "./edfapay";
import {
  generateZatcaXml,
  generateZatcaTlvQrCode,
  computeInvoiceHash,
  computeInvoiceHashBase64,
  generateInvoiceUuid,
  injectQrCodeIntoXml,
  getZatcaBaseUrl,
  getComplianceCsid,
  getProductionCsid,
  reportInvoice,
  clearInvoice,
  submitComplianceInvoice,
  generateZatcaCsr,
  signInvoiceXml,
  buildSignedInvoice,
  validateB2BBuyer,
  bankersRound,
  isMockEnvironment,
  mockGetComplianceCsid,
  mockSubmitComplianceInvoice,
  mockGetProductionCsid,
  mockReportInvoice,
  mockClearInvoice,
  type ZatcaInvoiceData,
  type ZatcaLineItem,
} from "./zatca";
import * as hungerstation from "./hungerstation";
import * as jahez from "./jahez";
import {
  validatePhoneNumber,
  validateEmail,
  validatePrice,
  validateQuantity,
  normalizeMobilePhone,
  normalizeEmail,
} from "./validators";

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
  insertEdfapayMerchantSchema,
  insertEdfapayInvoiceSchema,
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

  insertKitchenSectionSchema,
  insertCustomerSchema,
  insertDeliveryIntegrationSchema,
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

// Build full ZATCA invoice with XML, hash chain, signing, and QR code
async function buildZatcaInvoice(
  restaurant: any,
  order: any,
  orderItems: any[],
  menuItems: Map<string, any>,
  invoiceType: 'simplified' | 'standard' | 'credit_note' | 'debit_note' = 'simplified',
  relatedInvoice?: any,
  buyer?: { name?: string; vatNumber?: string; streetName?: string; buildingNumber?: string; district?: string; city?: string; postalCode?: string; country?: string },
  noteReason?: string,
) {
  const restaurantId = restaurant.id;
  const branchId = order.branchId || null;
  
  // B2B validation for standard invoices (BR-KSA-46)
  if (invoiceType === 'standard') {
    const buyerErrors = validateB2BBuyer(buyer);
    if (buyerErrors.length > 0) {
      throw new Error(`B2B buyer validation failed: ${buyerErrors.join('; ')}`);
    }
  }
  
  // Get branch-level ZATCA counter and hash (falls back to restaurant if no branch)
  const { counter: prevCounter, lastHash } = await storage.getZatcaCounterAndHash(restaurantId, branchId);
  const currentCounter = prevCounter + 1;
  
  const previousHash = lastHash || 
    Buffer.from('NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==', 'base64').toString('utf8');
  
  const uuid = generateInvoiceUuid();
  const now = new Date();
  const issueDate = now.toISOString().split('T')[0];
  const issueTime = now.toTimeString().split(' ')[0];
  
  // Delivery date: use order creation for dine-in/pickup, supply date for delivery
  const orderCreatedAt = order.createdAt ? new Date(order.createdAt) : now;
  const deliveryDate = order.orderType === 'delivery'
    ? (order.updatedAt ? new Date(order.updatedAt).toISOString().split('T')[0] : issueDate)
    : orderCreatedAt.toISOString().split('T')[0];
  
  const isTaxEnabled = restaurant.taxEnabled !== false;
  const taxRate = isTaxEnabled ? 15 : 0;
  
  // Build line items with banker's rounding
  const items: ZatcaLineItem[] = orderItems.map((item, idx) => {
    const menuItem = item.menuItemId ? menuItems.get(item.menuItemId) : null;
    const unitPrice = parseFloat(item.unitPrice || menuItem?.price || "0");
    const quantity = item.quantity || 1;
    const lineDiscount = 0;
    const lineTotal = bankersRound(unitPrice * quantity - lineDiscount);
    const lineTax = bankersRound(lineTotal * (taxRate / 100));
    
    return {
      id: String(idx + 1),
      nameAr: menuItem?.nameAr || menuItem?.nameEn || item.itemName || 'منتج',
      nameEn: menuItem?.nameEn || item.itemName || '',
      quantity,
      unitPrice,
      discount: lineDiscount,
      taxRate,
      taxAmount: lineTax,
      totalWithTax: bankersRound(lineTotal + lineTax),
      totalWithoutTax: lineTotal,
    };
  });
  
  const subtotal = bankersRound(items.reduce((sum, i) => sum + i.totalWithoutTax, 0));
  const discount = bankersRound(parseFloat(order.discount || "0"));
  const deliveryFee = bankersRound(parseFloat(order.deliveryFee || "0"));
  const taxableAmount = bankersRound(Math.max(0, subtotal - discount + deliveryFee));
  const taxAmount = bankersRound(taxableAmount * (taxRate / 100));
  const total = bankersRound(taxableAmount + taxAmount);
  
  const invoiceNumber = await storage.getNextInvoiceNumber(restaurantId, branchId);
  
  const invoiceData: ZatcaInvoiceData = {
    uuid,
    invoiceNumber,
    invoiceType,
    issueDate,
    issueTime,
    deliveryDate,
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
      streetName: buyer.streetName,
      buildingNumber: buyer.buildingNumber,
      district: buyer.district,
      city: buyer.city,
      postalCode: buyer.postalCode,
      country: buyer.country,
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
    noteReason: noteReason,
  };
  
  // Generate unsigned XML
  const unsignedXml = generateZatcaXml(invoiceData);
  
  // Resolve signing credentials (private key + certificate)
  let privateKey: string | null = null;
  let certificate: string | null = null;
  
  // Try branch-level credentials first
  if (branchId) {
    const branch = await storage.getBranch(branchId);
    if (branch && (branch as any).zatcaPrivateKey && (branch as any).zatcaCertificate) {
      privateKey = (branch as any).zatcaPrivateKey;
      certificate = (branch as any).zatcaProductionCsid || (branch as any).zatcaComplianceCsid || (branch as any).zatcaCertificate;
    }
  }
  // Fallback to restaurant-level
  if (!privateKey && restaurant.zatcaPrivateKey && restaurant.zatcaCertificate) {
    privateKey = restaurant.zatcaPrivateKey;
    certificate = restaurant.zatcaProductionCsid || restaurant.zatcaComplianceCsid || restaurant.zatcaCertificate;
  }
  
  // Sign + QR pipeline
  const { finalXml, invoiceHash, qrData, signatureValue, signedXml } = buildSignedInvoice(
    unsignedXml,
    privateKey,
    certificate,
    {
      sellerName: restaurant.nameAr || restaurant.nameEn || 'مطعم',
      vatNumber: restaurant.vatNumber || '',
      timestamp: now.toISOString(),
      total: total.toFixed(2),
      vatAmount: taxAmount.toFixed(2),
    },
  );
  
  // Update branch-level (and restaurant-level) counter and hash
  await storage.updateZatcaCounterAndHash(restaurantId, branchId, currentCounter, invoiceHash);
  
  return {
    branchId,
    invoiceNumber,
    uuid,
    xmlContent: finalXml,
    signedXml: signedXml || null, // Only set if actually signed
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

// CSV injection prevention - sanitize cell values
function csvSafe(value: string | null | undefined): string {
  if (!value) return "";
  const str = String(value);
  // Prefix dangerous characters that could trigger formula injection in Excel/Sheets
  if (/^[=+\-@\t\r]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

function csvQuote(value: string | null | undefined): string {
  return `"${csvSafe(value).replace(/"/g, '""')}"`;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.use("/uploads", (await import("express")).default.static(uploadDir));

  // Health check endpoint - no auth required
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString(), uptime: process.uptime() });
  });

  // RBAC permission middleware for protected routes
  const ROUTE_PERMISSIONS: Array<{ pattern: RegExp; module: string; methods?: string[] }> = [
    { pattern: /^\/api\/(menu-items|categories)/, module: "menu" },
    { pattern: /^\/api\/orders/, module: "orders" },
    { pattern: /^\/api\/tables/, module: "tables" },
    { pattern: /^\/api\/inventory/, module: "inventory" },
    { pattern: /^\/api\/kitchen/, module: "kitchen" },
    { pattern: /^\/api\/reports/, module: "reports" },
    { pattern: /^\/api\/(restaurant|settings|branches|users|zatca)/, module: "settings" },
    { pattern: /^\/api\/(promotions|coupons)/, module: "marketing" },
    { pattern: /^\/api\/qr-codes/, module: "qr" },
    { pattern: /^\/api\/printers/, module: "settings" },
    { pattern: /^\/api\/(queue|reservations)/, module: "tables" },
    { pattern: /^\/api\/delivery/, module: "settings" },
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

  // Public order endpoint - no auth needed, used by payment page
  // MUST be registered BEFORE the :restaurantId middleware to avoid "orders" being treated as a restaurant slug
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
      const itemsWithDetails = orderItems.map(item => {
        const menuItem = item.menuItemId ? menuItemsMap.get(item.menuItemId) : null;
        return {
          ...item,
          menuItem: menuItem
            ? { nameEn: menuItem.nameEn, nameAr: menuItem.nameAr, price: menuItem.price }
            : item.itemName ? { nameEn: item.itemName, nameAr: item.itemName, price: item.unitPrice } : undefined,
        };
      });
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
          logo: restaurant.logo,
        } : null,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get invoice" });
    }
  });

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
        const taxRatePercent = isTaxEnabled ? 15 : 0;
        // order.total already includes tax from recalculateOrderTotals — extract VAT, don't add on top
        const totalWithTax = parseFloat(order.total || "0");
        const orderDiscount = parseFloat(order.discount || "0");
        const orderDeliveryFee = parseFloat(order.deliveryFee || "0");
        const now = new Date();
        const uuid = generateInvoiceUuid();
        const invoiceNumber = await storage.getNextInvoiceNumber(restaurantId, order.branchId);
        
        // Generate ZATCA XML for public orders too — use branch-level counter/hash
        const orderBranchId = order.branchId || null;
        const { counter: prevCounter, lastHash: prevHash } = await storage.getZatcaCounterAndHash(restaurantId, orderBranchId);
        const currentCounter = prevCounter + 1;
        const previousHash = prevHash || 
          Buffer.from('NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==', 'base64').toString('utf8');
        
        // Build itemized line items from order items (ZATCA requires itemization)
        const pubOrderItems = await storage.getOrderItems(order.id);
        const pubMenuItemsRaw = await storage.getMenuItems(restaurantId);
        const pubMenuItemsMap = new Map(pubMenuItemsRaw.map(m => [m.id, m]));
        
        const xmlItems: ZatcaLineItem[] = pubOrderItems.map((item, idx) => {
          const menuItem = item.menuItemId ? pubMenuItemsMap.get(item.menuItemId) : null;
          const unitPrice = parseFloat(item.unitPrice || menuItem?.price || "0");
          const qty = item.quantity || 1;
          const lineTotal = bankersRound(unitPrice * qty);
          const lineTax = bankersRound(lineTotal * (taxRatePercent / 100));
          return {
            id: String(idx + 1),
            nameAr: menuItem?.nameAr || menuItem?.nameEn || item.itemName || 'منتج',
            nameEn: menuItem?.nameEn || item.itemName || '',
            quantity: qty,
            unitPrice,
            discount: 0,
            taxRate: taxRatePercent,
            taxAmount: lineTax,
            totalWithTax: bankersRound(lineTotal + lineTax),
            totalWithoutTax: lineTotal,
          };
        });

        // Calculate totals with banker's rounding
        const itemsSubtotal = bankersRound(xmlItems.reduce((sum, i) => sum + i.totalWithoutTax, 0));
        const taxableAmt = bankersRound(Math.max(0, itemsSubtotal - orderDiscount + orderDeliveryFee));
        const vatAmount = bankersRound(taxableAmt * (taxRatePercent / 100));
        const invoiceTotal = bankersRound(taxableAmt + vatAmount);
        
        const unsignedXmlContent = generateZatcaXml({
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
          items: xmlItems,
          subtotal: itemsSubtotal,
          discount: orderDiscount,
          deliveryFee: orderDeliveryFee,
          taxAmount: vatAmount,
          taxRate: taxRatePercent,
          total: invoiceTotal,
          paymentMethod: order.paymentMethod || 'cash',
          previousInvoiceHash: previousHash,
          invoiceCounter: currentCounter,
        });

        // Resolve signing credentials
        let privKey: string | null = null;
        let cert: string | null = null;
        if (orderBranchId) {
          const br = await storage.getBranch(orderBranchId);
          if (br && (br as any).zatcaPrivateKey) {
            privKey = (br as any).zatcaPrivateKey;
            cert = (br as any).zatcaProductionCsid || (br as any).zatcaComplianceCsid || (br as any).zatcaCertificate;
          }
        }
        if (!privKey && (restaurant as any).zatcaPrivateKey) {
          privKey = (restaurant as any).zatcaPrivateKey;
          cert = restaurant.zatcaProductionCsid || restaurant.zatcaComplianceCsid || restaurant.zatcaCertificate;
        }

        // Sign + QR pipeline
        const signResult = buildSignedInvoice(
          unsignedXmlContent, privKey, cert,
          {
            sellerName: restaurant.nameAr || restaurant.nameEn || "مطعم",
            vatNumber: restaurant.vatNumber || "",
            timestamp: now.toISOString(),
            total: invoiceTotal.toFixed(2),
            vatAmount: vatAmount.toFixed(2),
          },
        );

        const xmlContent = signResult.finalXml;
        const invoiceHash = signResult.invoiceHash;
        const qrData = signResult.qrData;

        await storage.createInvoice({
          restaurantId,
          branchId: orderBranchId,
          orderId: order.id,
          invoiceNumber,
          invoiceType: "simplified",
          subtotal: itemsSubtotal.toFixed(2),
          taxRate: taxRatePercent.toFixed(2),
          taxAmount: vatAmount.toFixed(2),
          total: invoiceTotal.toFixed(2),
          qrCodeData: qrData,
          xmlContent,
          invoiceHash,
          previousInvoiceHash: previousHash,
          invoiceCounter: currentCounter,
          uuid,
          status: "issued",
          zatcaStatus: "pending",
          customerName: order.customerName || null,
          customerPhone: order.customerPhone || null,
          paymentMethod: order.paymentMethod || 'cash',
          signedXml: signResult.signedXml || null,
        });

        // Update branch-level (and restaurant-level) counter and hash
        await storage.updateZatcaCounterAndHash(restaurantId, orderBranchId, currentCounter, invoiceHash);
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
          const menuItem = item.menuItemId ? await storage.getMenuItem(item.menuItemId) : null;
          return {
            ...item,
            menuItem: menuItem 
              ? { nameEn: menuItem.nameEn, nameAr: menuItem.nameAr, price: menuItem.price } 
              : item.itemName ? { nameEn: item.itemName, nameAr: item.itemName, price: item.unitPrice } : null,
          };
        })
      );
      res.json(itemsWithDetails);
    } catch (error) {
      res.status(500).json({ error: "Failed to get order items" });
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

  // Public: Create payment session for reservation deposit (EdfaPay)
  app.post("/api/public/:restaurantId/reservation-payment-session", async (req, res) => {
    try {
      const restaurantId = res.locals.restaurantId;
      const { reservationId, amount, callbackUrl, payerEmail, payerPhone, payerName } = req.body;
      if (!reservationId || !amount || !callbackUrl) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const restaurant = await storage.getRestaurantById(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      const merchantId = restaurant.edfapayMerchantId;
      const password = restaurant.edfapayPassword;
      if (!merchantId || !password) {
        return res.status(500).json({ error: "Payment gateway not configured", configured: false });
      }
      
      const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() 
        || req.socket.remoteAddress 
        || "127.0.0.1";
      
      // Build webhook notification URL
      const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
      const host = req.headers["x-forwarded-host"] || req.headers.host || "tryingpos.com";
      const notificationUrl = `${protocol}://${host}/api/payments/webhook`;

      const edfaResult = await edfapay.initiateSale({
        merchantId,
        password,
        orderId: reservationId,
        amount: parseFloat(amount).toFixed(2),
        currency: "SAR",
        description: `Reservation booking fee - ${restaurant.nameEn || restaurantId}`,
        payerFirstName: payerName?.split(" ")[0] || "Customer",
        payerLastName: payerName?.split(" ").slice(1).join(" ") || "Guest",
        payerEmail: payerEmail || "customer@example.com",
        payerPhone: payerPhone || "0500000000",
        payerIp: clientIp,
        callbackUrl,
        notificationUrl,
      });
      
      if (edfaResult.result === "REDIRECT" && edfaResult.redirect_url) {
        res.json({
          action: "redirect",
          redirectUrl: edfaResult.redirect_url,
          transId: edfaResult.trans_id,
          reservationId,
        });
      } else if (edfaResult.result === "SUCCESS") {
        res.json({
          action: "success",
          transId: edfaResult.trans_id,
          reservationId,
        });
      } else {
        res.status(400).json({ error: "Payment initiation failed" });
      }
    } catch (error) {
      console.error("Reservation payment session error:", error);
      res.status(500).json({ error: "Failed to create payment session" });
    }
  });

  // Public: Complete reservation payment (EdfaPay)
  app.post("/api/public/:restaurantId/reservation-payment-complete", async (req, res) => {
    try {
      const restaurantId = res.locals.restaurantId;
      const { reservationId, transId, gwayId } = req.body;
      if (!reservationId) {
        return res.status(400).json({ error: "Missing reservationId" });
      }
      const restaurant = await storage.getRestaurantById(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      
      let paymentVerified = false;
      
      if (gwayId && restaurant.edfapayMerchantId && restaurant.edfapayPassword) {
        try {
          const statusResult = await edfapay.getTransactionStatus({
            merchantId: restaurant.edfapayMerchantId,
            password: restaurant.edfapayPassword,
            gwayPaymentId: gwayId,
            orderId: reservationId,
          });
          paymentVerified = edfapay.isSuccessfulPayment(statusResult.status);
        } catch (e) {
          console.error("EdfaPay status check error:", e);
        }
      }
      
      if (paymentVerified) {
        await storage.updateReservation(reservationId, { depositPaid: true } as any);
        const reservation = await storage.getReservation(reservationId);
        res.json({ success: true, reservation });
      } else {
        res.status(400).json({ error: "Payment not verified" });
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
      const { edfapayPassword, edfapaySoftposAuthToken, ...safeRestaurant } = restaurant as any;
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
      const caller = await getAuthenticatedUser(req);
      
      // ✅ Validate email format if provided
      if (req.body.email) {
        const emailValidation = validateEmail(req.body.email);
        if (!emailValidation.valid) {
          return res.status(400).json({ error: emailValidation.error, code: "INVALID_EMAIL" });
        }
        req.body.email = normalizeEmail(req.body.email);
      }
      
      // ✅ Validate phone format if provided
      if (req.body.phone) {
        const phoneValidation = validatePhoneNumber(req.body.phone);
        if (!phoneValidation.valid) {
          return res.status(400).json({ error: phoneValidation.error, code: "INVALID_PHONE" });
        }
        req.body.phone = normalizeMobilePhone(req.body.phone);
      }
      
      // ✅ Validate ownerPhone format if provided
      if (req.body.ownerPhone) {
        const phoneValidation = validatePhoneNumber(req.body.ownerPhone);
        if (!phoneValidation.valid) {
          return res.status(400).json({ error: `Owner Phone: ${phoneValidation.error}`, code: "INVALID_OWNER_PHONE" });
        }
        req.body.ownerPhone = normalizeMobilePhone(req.body.ownerPhone);
      }
      
      const data = insertRestaurantSchema.partial().parse(req.body);
      
      // Protect business fields - once saved, only platform_admin can modify
      const lockedFields = ['vatNumber', 'commercialRegistration', 'ownerName', 'ownerPhone',
        'postalCode', 'buildingNumber', 'streetName', 'district', 'city',
        'bankName', 'bankAccountHolder', 'bankAccountNumber', 'bankSwift', 'bankIban'] as const;
      const current = await storage.getRestaurantById(restaurantId);
      if (current && caller.role !== 'platform_admin') {
        for (const field of lockedFields) {
          const currentValue = (current as any)[field];
          const newValue = (data as any)[field];
          // If field already has a value and user is trying to change it, only allow platform_admin
          if (currentValue && String(currentValue).trim() !== '' && newValue !== undefined && newValue !== currentValue) {
            return res.status(403).json({ 
              error: `لا يمكن تعديل ${field} - هذا الحقل مقفل. تواصل مع إدارة المنصة للتعديل`,
              code: "LOCKED_FIELD"
            });
          }
        }
      }
      
      // Only platform_admin can set/change SoftPOS auth token
      if (caller.role !== 'platform_admin') {
        delete (data as any).edfapaySoftposAuthToken;
      }

      // Auto-generate slug from English name if slug not set
      if (current && !(current as any).slug && (data.nameEn || current.nameEn)) {
        (data as any).slug = generateSlug(data.nameEn || current.nameEn);
      }
      
      const restaurant = await storage.updateRestaurantById(restaurantId, data);
      
      // Audit log if tax settings changed
      if (data.taxEnabled !== undefined || (data as any).vatNumber !== undefined) {
        const userIp = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
        await storage.createInvoiceAuditLog({
          restaurantId,
          action: 'tax_settings_changed',
          userName: caller.name || caller.email || 'Unknown',
          userId: caller.id,
          details: JSON.stringify({
            taxEnabled: data.taxEnabled,
            vatNumber: (data as any).vatNumber,
            previousTaxEnabled: current?.taxEnabled,
            previousVatNumber: current?.vatNumber,
          }),
          ipAddress: userIp,
        });
      }
      
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
      const restaurantId = await getRestaurantId(req);
      const data = insertMenuItemSchema.parse({
        ...body,
        restaurantId,
      });

      // Get old item to detect availability change
      const oldItem = await storage.getMenuItem(req.params.id);
      const item = await storage.updateMenuItem(req.params.id, data);
      if (!item) {
        return res.status(404).json({ error: "Menu item not found" });
      }

      // Sync availability change to delivery platforms (async, non-blocking)
      if (oldItem && oldItem.isAvailable !== item.isAvailable) {
        (async () => {
          try {
            const integrations = await storage.getDeliveryIntegrations(restaurantId);
            for (const integration of integrations) {
              if (!integration.isActive) continue;

              if (integration.platform === "jahez") {
                // Jahez: update product visibility via API
                try {
                  await jahez.updateProductVisibility(
                    integration,
                    item.id,
                    item.isAvailable ?? false
                  );
                  console.log(`[Menu Sync] Jahez: Product ${item.id} visibility → ${item.isAvailable}`);
                } catch (err: any) {
                  console.error(`[Menu Sync] Jahez visibility update failed for ${item.id}:`, err.message);
                }
              } else if (integration.platform === "hungerstation") {
                // HungerStation: update product active status via Catalog API
                // Uses item.id as SKU identifier
                try {
                  const result = await hungerstation.updateProductAvailability(
                    integration,
                    item.id, // SKU = our menu item ID
                    item.isAvailable ?? false
                  );
                  console.log(`[Menu Sync] HungerStation: Product ${item.id} active → ${item.isAvailable}, job_id: ${result?.job_id}`);
                } catch (err: any) {
                  console.error(`[Menu Sync] HungerStation availability update failed for ${item.id}:`, err.message);
                }
              }
            }
          } catch (err: any) {
            console.error("[Menu Sync] Error syncing availability:", err.message);
          }
        })();
      }

      // Sync price change to delivery platforms (async, non-blocking)
      if (oldItem && oldItem.price !== item.price) {
        (async () => {
          try {
            const integrations = await storage.getDeliveryIntegrations(restaurantId);
            for (const integration of integrations) {
              if (!integration.isActive) continue;

              if (integration.platform === "hungerstation") {
                try {
                  const result = await hungerstation.updateProductPrice(
                    integration,
                    item.id,
                    parseFloat(item.price),
                    item.isAvailable ?? true
                  );
                  console.log(`[Menu Sync] HungerStation: Product ${item.id} price → ${item.price}, job_id: ${result?.job_id}`);
                } catch (err: any) {
                  console.error(`[Menu Sync] HungerStation price update failed for ${item.id}:`, err.message);
                }
              } else if (integration.platform === "jahez") {
                // Jahez: sync the full product to update price
                try {
                  await jahez.syncProduct(integration, {
                    product_id: item.id,
                    product_price: parseFloat(item.price),
                    category_id: item.categoryId || "",
                    name: { ar: item.nameAr || "", en: item.nameEn || "" },
                    description: { ar: item.descriptionAr || "", en: item.descriptionEn || "" },
                    image_path: item.image || "",
                    calories: item.calories || 0,
                    is_visible: item.isAvailable !== false,
                  });
                  console.log(`[Menu Sync] Jahez: Product ${item.id} price → ${item.price}`);
                } catch (err: any) {
                  console.error(`[Menu Sync] Jahez price update failed for ${item.id}:`, err.message);
                }
              }
            }
          } catch (err: any) {
            console.error("[Menu Sync] Error syncing price:", err.message);
          }
        })();
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

      // Sync deletion to delivery platforms (async, non-blocking)
      (async () => {
        try {
          const integrations = await storage.getDeliveryIntegrations(item.restaurantId);
          for (const integration of integrations) {
            if (!integration.isActive) continue;
            if (integration.platform === "jahez") {
              try {
                await jahez.deleteProduct(integration, item.id);
                console.log(`[Menu Sync] Jahez: Product ${item.id} deleted`);
              } catch (err: any) {
                console.error(`[Menu Sync] Jahez delete failed for ${item.id}:`, err.message);
              }
            }
          }
        } catch (err: any) {
          console.error("[Menu Sync] Error syncing deletion:", err.message);
        }
      })();

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
      const restaurantId = await getRestaurantId(req);
      
      // Validate branchId if provided
      let branchId = req.body.branchId || null;
      if (branchId) {
        const branches = await storage.getBranches(restaurantId);
        if (!branches.some(b => b.id === branchId)) {
          return res.status(400).json({ error: "Invalid branch" });
        }
      }
      
      const data = insertTableSchema.parse({
        ...req.body,
        restaurantId,
        branchId,
      });
      const table = await storage.createTable(data);
      res.status(201).json(table);
    } catch (error) {
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.put("/api/tables/:id", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      
      // Validate branchId if provided
      let branchId = req.body.branchId || null;
      if (branchId) {
        const branches = await storage.getBranches(restaurantId);
        if (!branches.some(b => b.id === branchId)) {
          return res.status(400).json({ error: "Invalid branch" });
        }
      }
      
      const data = insertTableSchema.parse({
        ...req.body,
        restaurantId,
        branchId,
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
      const period = (req.query.period as string) || "today"; // today, week, archived, all
      
      let orders = await storage.getOrders(await getRestaurantId(req), branchId);
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      // Filter by period
      switch (period) {
        case "today": {
          orders = orders.filter(o => {
            const orderDate = new Date(o.createdAt);
            const orderDateOnly = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());
            return orderDateOnly.getTime() === today.getTime();
          });
          break;
        }
        case "week": {
          orders = orders.filter(o => {
            const orderDate = new Date(o.createdAt);
            const orderDateOnly = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());
            return orderDateOnly.getTime() >= weekAgo.getTime() && orderDateOnly.getTime() < today.getTime();
          });
          break;
        }
        case "archived": {
          orders = orders.filter(o => (o as any).isArchived === true);
          break;
        }
        case "all":
        default:
          // No filter
          break;
      }
      
      // Include items for each order
      const ordersWithItems = await Promise.all(
        orders.map(async (order) => {
          try {
            const items = await storage.getOrderItems(order.id);
            // Enrich items with menu item names
            const enrichedItems = await Promise.all(
              items.map(async (item: any) => {
                if (item.menuItemId && !item.itemName) {
                  try {
                    const menuItem = await storage.getMenuItem(item.menuItemId);
                    return { ...item, itemName: menuItem?.nameAr || menuItem?.nameEn || null };
                  } catch { return item; }
                }
                return item;
              })
            );
            return { ...order, items: enrichedItems };
          } catch {
            return { ...order, items: [] };
          }
        })
      );
      
      res.json(ordersWithItems);
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
      // Include items
      const items = await storage.getOrderItems(order.id);
      const enrichedItems = await Promise.all(
        items.map(async (item: any) => {
          if (item.menuItemId && !item.itemName) {
            try {
              const menuItem = await storage.getMenuItem(item.menuItemId);
              return { ...item, itemName: menuItem?.nameAr || menuItem?.nameEn || null };
            } catch { return item; }
          }
          return item;
        })
      );
      res.json({ ...order, items: enrichedItems });
    } catch (error: any) {
      if (error?.message?.includes("not found")) return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to get order" });
    }
  });

  app.post("/api/orders", async (req, res) => {
    try {
      console.log("Received order data:", JSON.stringify(req.body, null, 2));
      
      const restaurantId = await getRestaurantId(req);
      
      // ✅ Validate customer phone if provided
      if (req.body.customerPhone) {
        const phoneValidation = validatePhoneNumber(req.body.customerPhone);
        if (!phoneValidation.valid) {
          return res.status(400).json({ error: phoneValidation.error, code: "INVALID_CUSTOMER_PHONE" });
        }
        req.body.customerPhone = normalizeMobilePhone(req.body.customerPhone);
      }
      
      // ✅ Validate order items: quantities and prices must be positive
      if (req.body.items && Array.isArray(req.body.items)) {
        for (let i = 0; i < req.body.items.length; i++) {
          const item = req.body.items[i];
          
          // Validate quantity
          const quantityValidation = validateQuantity(item.quantity);
          if (!quantityValidation.valid) {
            return res.status(400).json({ 
              error: `Item ${i + 1}: ${quantityValidation.error}`, 
              code: "INVALID_QUANTITY" 
            });
          }
          
          // Validate unitPrice
          if (item.unitPrice !== undefined) {
            const priceValidation = validatePrice(item.unitPrice);
            if (!priceValidation.valid) {
              return res.status(400).json({ 
                error: `Item ${i + 1}: ${priceValidation.error}`,
                code: "INVALID_UNIT_PRICE" 
              });
            }
          }
          
          // Validate totalPrice
          if (item.totalPrice !== undefined) {
            const totalValidation = validatePrice(item.totalPrice);
            if (!totalValidation.valid) {
              return res.status(400).json({ 
                error: `Item ${i + 1}: ${totalValidation.error}`,
                code: "INVALID_TOTAL_PRICE" 
              });
            }
          }
        }
      }
      
      // ✅ Validate order totals (no negative values)
      if (req.body.subtotal !== undefined) {
        const subtotalValidation = validatePrice(req.body.subtotal);
        if (!subtotalValidation.valid) {
          return res.status(400).json({ error: `Subtotal: ${subtotalValidation.error}`, code: "INVALID_SUBTOTAL" });
        }
      }
      if (req.body.deliveryFee !== undefined) {
        const feeValidation = validatePrice(req.body.deliveryFee);
        if (!feeValidation.valid) {
          return res.status(400).json({ error: `DeliveryFee: ${feeValidation.error}`, code: "INVALID_DELIVERY_FEE" });
        }
      }
      if (req.body.discount !== undefined) {
        const discountValidation = validatePrice(req.body.discount);
        if (!discountValidation.valid) {
          return res.status(400).json({ error: `Discount: ${discountValidation.error}`, code: "INVALID_DISCOUNT" });
        }
      }
      if (req.body.total !== undefined) {
        const totalValidation = validatePrice(req.body.total);
        if (!totalValidation.valid) {
          return res.status(400).json({ error: `Total: ${totalValidation.error}`, code: "INVALID_TOTAL" });
        }
      }
      
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
      
      // ZATCA compliance: if cancelling an order that has an invoice, auto-issue credit note
      let creditNote = null;
      if (status === "cancelled") {
        const existingInvoice = await storage.getInvoiceByOrder(req.params.id);
        if (existingInvoice && existingInvoice.invoiceType !== 'credit_note' && existingInvoice.status !== 'cancelled') {
          // Skip if credit note already exists for this invoice
          const alreadyRefunded = await storage.getCreditNoteForInvoice(existingInvoice.id);
          if (alreadyRefunded) {
            creditNote = alreadyRefunded;
          } else {
          const restaurantId = existingOrder.restaurantId;
          const restaurant = await storage.getRestaurantById(restaurantId);
          if (restaurant) {
            const reason = req.body.reason || "إلغاء الطلب - Order Cancelled";
            const orderItems = await storage.getOrderItems(req.params.id);
            const menuItemsRaw = await storage.getMenuItems(restaurantId);
            const menuItemsMap = new Map(menuItemsRaw.map(m => [m.id, m]));

            try {
              const zatcaResult = await buildZatcaInvoice(
                restaurant, existingOrder, orderItems, menuItemsMap, 'credit_note', existingInvoice, undefined, reason
              );

              creditNote = await storage.createInvoice({
                restaurantId,
                branchId: existingOrder.branchId || null,
                orderId: existingOrder.id,
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
                relatedInvoiceId: existingInvoice.id,
                status: 'issued',
                zatcaStatus: 'pending',
                cashierName: req.body.userName || null,
                refundReason: reason,
                customerName: existingInvoice.customerName,
                customerPhone: existingInvoice.customerPhone,
                paymentMethod: existingInvoice.paymentMethod,
                isPaid: existingInvoice.isPaid,
                signedXml: zatcaResult.signedXml || null,
              });

              // Return inventory items to stock
              for (const item of orderItems) {
                const menuItem = menuItemsMap.get(item.menuItemId);
                if (menuItem) {
                  const recipeItems = await storage.getRecipes(item.menuItemId);
                  for (const recipe of recipeItems) {
                    const invItem = await storage.getInventoryItem(recipe.inventoryItemId);
                    if (invItem) {
                      const returnQty = parseFloat(String(recipe.quantity)) * (item.quantity || 1);
                      await storage.updateInventoryItem(recipe.inventoryItemId, {
                        currentStock: String(parseFloat(String(invItem.currentStock)) + returnQty),
                      } as any);
                    }
                  }
                }
              }

              // Audit log for credit note
              const userIp = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
              await storage.createInvoiceAuditLog({
                restaurantId,
                invoiceId: creditNote.id,
                action: 'cancel_credit_note',
                userName: req.body.userName || 'System',
                details: JSON.stringify({
                  reason,
                  originalInvoiceId: existingInvoice.id,
                  originalInvoiceNumber: existingInvoice.invoiceNumber,
                  amount: zatcaResult.total,
                }),
                ipAddress: userIp,
              });
            } catch (e) {
              console.error("Auto credit note on cancel failed:", e);
              // Don't block the cancellation, but log the error
            }
          }
          } // end else (no existing credit note)
        }
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
      
      res.json({ ...order, creditNote });
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
                const currentStock = parseFloat(inventoryItem.currentStock || "0");
                const newStock = currentStock - deductAmount;
                
                // Record the transaction (this auto-updates stock via storage)
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

  // Invoice search - MUST be before /api/invoices/:id to avoid "search" being matched as an ID
  app.get("/api/invoices/search", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const filters: any = {};
      if (req.query.invoiceNumber) filters.invoiceNumber = req.query.invoiceNumber as string;
      if (req.query.customerPhone) filters.customerPhone = req.query.customerPhone as string;
      if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
      if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);
      if (req.query.paymentMethod) filters.paymentMethod = req.query.paymentMethod as string;
      if (req.query.status) filters.status = req.query.status as string;
      if (req.query.invoiceType) filters.invoiceType = req.query.invoiceType as string;
      
      const results = await storage.searchInvoices(restaurantId, filters);
      res.json(results);
    } catch (error) {
      res.status(500).json({ error: "Failed to search invoices" });
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
        menuItem: item.menuItemId ? menuItemsMap.get(item.menuItemId) : (item.itemName ? { nameAr: item.itemName, nameEn: item.itemName } : null),
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
      
      // Prevent duplicate invoice for the same order
      if (req.body.orderId) {
        const existingInvoice = await storage.getInvoiceByOrder(req.body.orderId);
        if (existingInvoice) {
          // Return existing invoice instead of creating duplicate
          return res.status(200).json(existingInvoice);
        }
      }
      
      const restaurant = await storage.getRestaurantById(restaurantId);
      const isTaxEnabled = restaurant?.taxEnabled !== false;
      const taxRate = isTaxEnabled ? 15 : 0;
      
      const subtotal = parseFloat(req.body.subtotal || "0");
      const discount = parseFloat(req.body.discount || "0");
      const deliveryFee = parseFloat(req.body.deliveryFee || "0");
      const taxableAmount = Math.max(0, subtotal - discount);
      const taxAmount = taxableAmount * (taxRate / 100);
      const total = taxableAmount + taxAmount + deliveryFee;
      
      // Generate ZATCA-compliant UUID and counter — use branch-level
      const uuid = generateInvoiceUuid();
      // Resolve branchId from the order or request body
      let invoiceBranchId: string | null = req.body.branchId || null;
      if (!invoiceBranchId && req.body.orderId) {
        const relatedOrder = await storage.getOrder(req.body.orderId);
        invoiceBranchId = relatedOrder?.branchId || null;
      }
      const invoiceNumber = await storage.getNextInvoiceNumber(restaurantId, invoiceBranchId);
      const { counter: prevC, lastHash: prevH } = await storage.getZatcaCounterAndHash(restaurantId, invoiceBranchId);
      const currentCounter = prevC + 1;
      const previousHash = prevH || 
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
          const lineTotal = bankersRound(unitPrice * qty);
          const lineTax = bankersRound(lineTotal * (taxRate / 100));
          return {
            id: String(idx + 1),
            nameAr: menuItem?.nameAr || menuItem?.nameEn || 'منتج',
            nameEn: menuItem?.nameEn || '',
            quantity: qty,
            unitPrice,
            discount: 0,
            taxRate,
            taxAmount: lineTax,
            totalWithTax: bankersRound(lineTotal + lineTax),
            totalWithoutTax: lineTotal,
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
          taxAmount: bankersRound(taxAmount),
          totalWithTax: bankersRound(total),
          totalWithoutTax: bankersRound(subtotal),
        }];
      }

      // Generate ZATCA XML
      const unsignedXml = generateZatcaXml({
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

      // Resolve signing credentials (branch-first, restaurant fallback)
      let privKey: string | null = null;
      let cert: string | null = null;
      if (invoiceBranchId) {
        const br = await storage.getBranch(invoiceBranchId);
        if (br && (br as any).zatcaPrivateKey) {
          privKey = (br as any).zatcaPrivateKey;
          cert = (br as any).zatcaProductionCsid || (br as any).zatcaComplianceCsid || (br as any).zatcaCertificate;
        }
      }
      if (!privKey && restaurant && (restaurant as any).zatcaPrivateKey) {
        privKey = (restaurant as any).zatcaPrivateKey;
        cert = restaurant.zatcaProductionCsid || restaurant.zatcaComplianceCsid || restaurant.zatcaCertificate;
      }

      const signResult = buildSignedInvoice(
        unsignedXml, privKey, cert,
        {
          sellerName: restaurant?.nameAr || restaurant?.nameEn || "مطعم",
          vatNumber: restaurant?.vatNumber || "",
          timestamp: now.toISOString(),
          total: total.toFixed(2),
          vatAmount: taxAmount.toFixed(2),
        },
      );

      const xmlContent = signResult.finalXml;
      const invoiceHash = signResult.invoiceHash;
      const qrData = signResult.qrData;

      // Update branch-level (and restaurant-level) counter and hash
      await storage.updateZatcaCounterAndHash(restaurantId, invoiceBranchId, currentCounter, invoiceHash);
      
      const data = insertInvoiceSchema.parse({
        ...req.body,
        restaurantId,
        branchId: invoiceBranchId,
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
        signedXml: signResult.signedXml || null,
      });
      
      const invoice = await storage.createInvoice(data);
      
      // Audit log for invoice creation
      const userIp = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
      await storage.createInvoiceAuditLog({
        restaurantId,
        invoiceId: invoice.id,
        action: 'invoice_created',
        details: JSON.stringify({ invoiceNumber, invoiceType, total: total.toFixed(2), uuid }),
        ipAddress: userIp,
      });
      
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
      
      // ZATCA compliance: After issuance, only allow ZATCA-related field updates
      if (existing.status === 'issued' || existing.status === 'reported') {
        const allowedFields = ['zatcaStatus', 'zatcaSubmissionId', 'zatcaWarnings', 'zatcaErrors', 'signedXml', 'csidToken'];
        const attemptedFields = Object.keys(req.body);
        const forbidden = attemptedFields.filter(f => !allowedFields.includes(f));
        if (forbidden.length > 0) {
          return res.status(403).json({ 
            error: "لا يمكن تعديل الفاتورة بعد إصدارها. استخدم إشعار دائن أو مدين للتصحيح",
            errorEn: "Cannot modify an issued invoice. Use a credit or debit note for corrections.",
            forbiddenFields: forbidden 
          });
        }
      }
      
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

  // ZATCA compliance: Prevent deletion of invoices
  app.delete("/api/invoices/:id", async (_req, res) => {
    return res.status(403).json({ 
      error: "لا يمكن حذف الفواتير. استخدم إشعار دائن للإلغاء",
      errorEn: "Invoices cannot be deleted. Use a credit note for cancellation." 
    });
  });

  // --- Invoice Archive / Search ---
  // --- Invoice Audit Log ---
  app.get("/api/invoice-audit-log", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const logs = await storage.getInvoiceAuditLogs(restaurantId, limit);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to get audit log" });
    }
  });

  app.get("/api/invoice-audit-log/:invoiceId", async (req, res) => {
    try {
      const logs = await storage.getInvoiceAuditLogsByInvoice(req.params.invoiceId);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to get invoice audit log" });
    }
  });

  // --- Tax Report ---
  app.get("/api/reports/tax", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();
      const branchId = req.query.branch as string | undefined;
      
      const report = await storage.getTaxReport(restaurantId, startDate, endDate, branchId);
      res.json(report);
    } catch (error) {
      console.error("Tax report error:", error);
      res.status(500).json({ error: "Failed to generate tax report" });
    }
  });

  // --- Refund with Credit Note (ZATCA-compliant) ---
  app.post("/api/invoices/:invoiceId/refund", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const restaurant = await storage.getRestaurantById(restaurantId);
      if (!restaurant) return res.status(404).json({ error: "Restaurant not found" });

      const originalInvoice = await storage.getInvoice(req.params.invoiceId);
      if (!originalInvoice) return res.status(404).json({ error: "Invoice not found" });
      if (originalInvoice.restaurantId !== restaurantId) return res.status(403).json({ error: "Unauthorized" });
      if (originalInvoice.status === 'cancelled') return res.status(400).json({ error: "Invoice already cancelled" });
      if (originalInvoice.invoiceType === 'credit_note') return res.status(400).json({ error: "Cannot refund a credit note" });

      // Prevent duplicate credit note for the same invoice
      const existingCreditNote = await storage.getCreditNoteForInvoice(originalInvoice.id);
      if (existingCreditNote) {
        return res.status(200).json(existingCreditNote);
      }

      const { reason, userName } = req.body;
      if (!reason) return res.status(400).json({ error: "سبب الاسترجاع مطلوب - Refund reason is required" });

      const order = await storage.getOrder(originalInvoice.orderId);
      if (!order) return res.status(404).json({ error: "Order not found" });

      const orderItems = await storage.getOrderItems(order.id);
      const menuItemsRaw = await storage.getMenuItems(restaurantId);
      const menuItemsMap = new Map(menuItemsRaw.map(m => [m.id, m]));

      // Build credit note via ZATCA engine
      const zatcaResult = await buildZatcaInvoice(
        restaurant, order, orderItems, menuItemsMap, 'credit_note', originalInvoice, undefined, reason
      );

      const creditNote = await storage.createInvoice({
        restaurantId,
        branchId: order.branchId || null,
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
        cashierName: userName || null,
        refundReason: reason,
        customerName: originalInvoice.customerName,
        customerPhone: originalInvoice.customerPhone,
        paymentMethod: originalInvoice.paymentMethod,
        isPaid: true,
        signedXml: zatcaResult.signedXml || null,
      });

      // Update order status to refunded
      await storage.updateOrder(order.id, { status: 'refunded' });

      // Update inventory - return items to stock
      for (const item of orderItems) {
        const menuItem = menuItemsMap.get(item.menuItemId);
        if (menuItem) {
          const recipeItems = await storage.getRecipes(item.menuItemId);
          for (const recipe of recipeItems) {
            const invItem = await storage.getInventoryItem(recipe.inventoryItemId);
            if (invItem) {
              const returnQty = parseFloat(String(recipe.quantity)) * (item.quantity || 1);
              await storage.updateInventoryItem(recipe.inventoryItemId, {
                currentStock: String(parseFloat(String(invItem.currentStock)) + returnQty),
              } as any);
            }
          }
        }
      }

      // Audit log
      const userIp = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
      await storage.createInvoiceAuditLog({
        restaurantId,
        invoiceId: creditNote.id,
        action: 'refund_issued',
        userName: userName || 'System',
        details: JSON.stringify({ 
          reason, 
          originalInvoiceId: originalInvoice.id,
          originalInvoiceNumber: originalInvoice.invoiceNumber,
          amount: zatcaResult.total,
        }),
        ipAddress: userIp,
      });

      res.status(201).json(creditNote);
    } catch (error: any) {
      console.error("Refund error:", error);
      res.status(500).json({ error: error?.message || "Failed to process refund" });
    }
  });

  // --- Debit Note ---
  app.post("/api/invoices/:invoiceId/debit-note", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const restaurant = await storage.getRestaurantById(restaurantId);
      if (!restaurant) return res.status(404).json({ error: "Restaurant not found" });

      const originalInvoice = await storage.getInvoice(req.params.invoiceId);
      if (!originalInvoice) return res.status(404).json({ error: "Invoice not found" });
      if (originalInvoice.restaurantId !== restaurantId) return res.status(403).json({ error: "Unauthorized" });

      const { reason, userName } = req.body;
      if (!reason) return res.status(400).json({ error: "سبب الإشعار المدين مطلوب - Debit note reason is required" });

      const order = await storage.getOrder(originalInvoice.orderId);
      if (!order) return res.status(404).json({ error: "Order not found" });

      const orderItems = await storage.getOrderItems(order.id);
      const menuItemsRaw = await storage.getMenuItems(restaurantId);
      const menuItemsMap = new Map(menuItemsRaw.map(m => [m.id, m]));

      const zatcaResult = await buildZatcaInvoice(
        restaurant, order, orderItems, menuItemsMap, 'debit_note', originalInvoice, undefined, reason
      );

      const debitNote = await storage.createInvoice({
        restaurantId,
        branchId: order.branchId || null,
        orderId: order.id,
        invoiceNumber: zatcaResult.invoiceNumber,
        invoiceType: 'debit_note',
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
        cashierName: userName || null,
        refundReason: reason,
        customerName: originalInvoice.customerName,
        customerPhone: originalInvoice.customerPhone,
        paymentMethod: originalInvoice.paymentMethod,
        signedXml: zatcaResult.signedXml || null,
      });

      // Audit log
      const userIp = req.ip || req.headers['x-forwarded-for'] as string || 'unknown';
      await storage.createInvoiceAuditLog({
        restaurantId,
        invoiceId: debitNote.id,
        action: 'debit_note_created',
        userName: userName || 'System',
        details: JSON.stringify({ 
          reason,
          originalInvoiceId: originalInvoice.id,
          originalInvoiceNumber: originalInvoice.invoiceNumber,
          amount: zatcaResult.total,
        }),
        ipAddress: userIp,
      });

      res.status(201).json(debitNote);
    } catch (error: any) {
      console.error("Debit note error:", error);
      res.status(500).json({ error: error?.message || "Failed to create debit note" });
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
            itemName: item.itemName || null,
            menuItem: item.menuItemId 
              ? menuItemsMap.get(item.menuItemId) 
              : (item.itemName ? { nameEn: item.itemName, nameAr: item.itemName, price: item.unitPrice, kitchenSectionId: null } as any : null),
          }));
          
          // Filter items by section if sectionId is provided (only for items with menuItem)
          if (sectionId) {
            itemsWithDetails = itemsWithDetails.filter(item => 
              !item.menuItemId || item.menuItem?.kitchenSectionId === sectionId
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
      
      // Remove orders with no items (after section filtering) — but keep delivery orders even if 0 items
      const filteredOrders = ordersWithItems.filter(order => 
        order.items.length > 0 || order.orderType === "delivery"
      );
      
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
      // ✅ Validate email format
      if (body.email) {
        const emailValidation = validateEmail(body.email);
        if (!emailValidation.valid) {
          return res.status(400).json({ error: emailValidation.error, code: "INVALID_EMAIL" });
        }
        body.email = normalizeEmail(body.email);
      }
      // ✅ Check for duplicate email before creating user
      if (body.email) {
        const existingByEmail = await storage.getUserByEmail(body.email);
        if (existingByEmail) {
          return res.status(409).json({ error: "البريد الإلكتروني مسجل بالفعل - Email already exists", code: "EMAIL_EXISTS" });
        }
      }
      // ✅ Validate phone number format (if provided)
      if (body.phone) {
        const phoneValidation = validatePhoneNumber(body.phone);
        if (!phoneValidation.valid) {
          return res.status(400).json({ error: phoneValidation.error, code: "INVALID_PHONE" });
        }
        body.phone = normalizeMobilePhone(body.phone);
      }
      // ✅ Check for duplicate phone across restaurant
      if (body.phone) {
        const restaurantId = await getRestaurantId(req);
        const existingByPhone = await storage.getUserByPhone(restaurantId, body.phone);
        if (existingByPhone) {
          return res.status( 409).json({ error: "رقم الهاتف مسجل بالفعل - Phone number already exists", code: "PHONE_EXISTS" });
        }
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
      const restaurantId = await getRestaurantId(req);
      
      // Validate branchId if provided
      let branchId = req.body.branchId || null;
      if (branchId) {
        const branches = await storage.getBranches(restaurantId);
        if (!branches.some(b => b.id === branchId)) {
          branchId = null;
        }
      }
      
      const data = insertInventoryItemSchema.parse({
        ...req.body,
        restaurantId,
        branchId,
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

  // All-branches summary — owner / platform_admin only
  app.get("/api/reports/all-branches-summary", async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (user.role !== "owner" && user.role !== "platform_admin") {
        return res.status(403).json({ error: "Owner access required" });
      }
      const restaurantId = user.restaurantId;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();

      const branches = await storage.getBranches(restaurantId);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
      const weekStart = new Date(today); weekStart.setDate(weekStart.getDate() - 7);
      const monthStart = new Date(today); monthStart.setDate(1);

      const sumSales = (data: any[]) => data.reduce((acc, row) => acc + parseFloat(row.total_sales || 0), 0);
      const sumOrders = (data: any[]) => data.reduce((acc, row) => acc + parseInt(row.order_count || 0), 0);
      const sumTax = (data: any[]) => data.reduce((acc, row) => acc + parseFloat(row.total_tax || 0), 0);
      const sumDiscount = (data: any[]) => data.reduce((acc, row) => acc + parseFloat(row.total_discount || 0), 0);

      const branchStats = await Promise.all(branches.map(async (branch) => {
        const [todayData, weekData, monthData, rangeData, topItems, ordersByType] = await Promise.all([
          storage.getSalesReport(restaurantId, today, tomorrow, branch.id),
          storage.getSalesReport(restaurantId, weekStart, tomorrow, branch.id),
          storage.getSalesReport(restaurantId, monthStart, tomorrow, branch.id),
          storage.getSalesReport(restaurantId, startDate, endDate, branch.id),
          storage.getTopSellingItems(restaurantId, 5, branch.id),
          storage.getOrdersByType(restaurantId, startDate, endDate, branch.id),
        ]);
        return {
          branchId: branch.id,
          branchName: branch.name,
          branchNameAr: (branch as any).nameAr || branch.name,
          isMain: branch.isMain,
          today: { sales: sumSales(todayData), orders: sumOrders(todayData) },
          week: { sales: sumSales(weekData), orders: sumOrders(weekData) },
          month: { sales: sumSales(monthData), orders: sumOrders(monthData), tax: sumTax(monthData), discount: sumDiscount(monthData) },
          range: { sales: sumSales(rangeData), orders: sumOrders(rangeData), tax: sumTax(rangeData), discount: sumDiscount(rangeData) },
          topItems,
          ordersByType,
        };
      }));

      // Totals across all branches
      const totals = {
        today: { sales: branchStats.reduce((s, b) => s + b.today.sales, 0), orders: branchStats.reduce((s, b) => s + b.today.orders, 0) },
        week: { sales: branchStats.reduce((s, b) => s + b.week.sales, 0), orders: branchStats.reduce((s, b) => s + b.week.orders, 0) },
        month: { sales: branchStats.reduce((s, b) => s + b.month.sales, 0), orders: branchStats.reduce((s, b) => s + b.month.orders, 0), tax: branchStats.reduce((s, b) => s + b.month.tax, 0), discount: branchStats.reduce((s, b) => s + b.month.discount, 0) },
        range: { sales: branchStats.reduce((s, b) => s + b.range.sales, 0), orders: branchStats.reduce((s, b) => s + b.range.orders, 0), tax: branchStats.reduce((s, b) => s + b.range.tax, 0), discount: branchStats.reduce((s, b) => s + b.range.discount, 0) },
      };

      res.json({ branches: branchStats, totals });
    } catch (error) {
      console.error("All branches summary error:", error);
      res.status(500).json({ error: "Failed to get all branches summary" });
    }
  });

  // Payment methods breakdown
  app.get("/api/reports/payment-methods", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const branchId = req.query.branch as string | undefined;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : new Date();

      let query;
      if (branchId) {
        query = sql`
          SELECT payment_method, COUNT(*) as count, SUM(CAST(total as DECIMAL)) as total_revenue
          FROM orders
          WHERE restaurant_id = ${restaurantId} AND branch_id = ${branchId}
            AND created_at >= ${startDate} AND created_at <= ${endDate}
            AND status NOT IN ('cancelled', 'refunded')
          GROUP BY payment_method ORDER BY total_revenue DESC
        `;
      } else {
        query = sql`
          SELECT payment_method, COUNT(*) as count, SUM(CAST(total as DECIMAL)) as total_revenue
          FROM orders
          WHERE restaurant_id = ${restaurantId}
            AND created_at >= ${startDate} AND created_at <= ${endDate}
            AND status NOT IN ('cancelled', 'refunded')
          GROUP BY payment_method ORDER BY total_revenue DESC
        `;
      }
      const result = await db.execute(query);
      res.json(result.rows);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to get payment methods report" });
    }
  });

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
      if (!req.body.email || typeof req.body.email !== 'string') {
        return res.status(400).json({ error: "Email is required" });
      }
      
      const emailLower = req.body.email.toLowerCase().trim();
      
      // Check if email already exists (case-insensitive)
      const existingUser = await storage.getUserByEmail(emailLower);
      if (existingUser) {
        return res.status(409).json({ error: "البريد الإلكتروني مسجل بالفعل - Email already exists", code: "EMAIL_EXISTS" });
      }
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

  // Platform admin: update restaurant business info (owner, CR, VAT, address, bank)
  app.patch("/api/admin/restaurant/:id/business-info", requirePlatformAdmin, async (req, res) => {
    try {
      const restaurant = await storage.getRestaurantById(req.params.id);
      if (!restaurant) return res.status(404).json({ error: "Restaurant not found" });

      const allowedFields = [
        'ownerName', 'ownerPhone', 'vatNumber', 'commercialRegistration',
        'postalCode', 'buildingNumber', 'streetName', 'district', 'city',
        'bankName', 'bankAccountHolder', 'bankAccountNumber', 'bankSwift', 'bankIban',
        'taxEnabled'
      ];

      const updateData: Record<string, any> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field];
        }
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      const updated = await storage.updateRestaurantById(req.params.id, updateData);
      res.json(updated);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update business info" });
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

  // Platform admin: update EdfaPay payment settings for a restaurant
  app.patch("/api/admin/restaurant/:id/payment-settings", requirePlatformAdmin, async (req, res) => {
    try {
      const restaurant = await storage.getRestaurantById(req.params.id);
      if (!restaurant) return res.status(404).json({ error: "Restaurant not found" });

      const allowedFields = ['edfapayMerchantId', 'edfapayPassword', 'edfapaySoftposAuthToken'];
      const updateData: Record<string, any> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updateData[field] = req.body[field] || null;
        }
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "No valid fields to update" });
      }

      const updated = await storage.updateRestaurantById(req.params.id, updateData);
      res.json({
        success: true,
        configured: !!(updated?.edfapayMerchantId && updated?.edfapayPassword),
        softposConfigured: !!updated?.edfapaySoftposAuthToken,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to update payment settings" });
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

  // Get printers by kitchen section (for kitchen display integration)
  app.get("/api/printers/kitchen-section/:sectionId", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const allPrinters = await storage.getPrinters(restaurantId);
      const sectionPrinters = allPrinters.filter(
        (p: any) => p.kitchenSectionId === req.params.sectionId && p.type === "kitchen" && p.isActive
      );
      res.json(sectionPrinters);
    } catch (error) {
      res.status(500).json({ error: "Failed to get kitchen section printers" });
    }
  });

  // Get receipt printers for reports (type = receipt, isDefault = true preferred)
  app.get("/api/printers/default/receipt", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const branchId = req.query.branch as string | undefined;
      const allPrinters = await storage.getPrinters(restaurantId, branchId);
      const receiptPrinters = allPrinters.filter((p: any) => p.type === "receipt" && p.isActive);
      const defaultPrinter = receiptPrinters.find((p: any) => p.isDefault) || receiptPrinters[0] || null;
      res.json({ defaultPrinter, allReceiptPrinters: receiptPrinters });
    } catch (error) {
      res.status(500).json({ error: "Failed to get receipt printers" });
    }
  });

  // Get order receipt data for printing (combined order + items + restaurant info)
  app.get("/api/orders/:id/receipt", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const order = await storage.getOrder(req.params.id);
      if (!order || order.restaurantId !== restaurantId) {
        return res.status(404).json({ error: "Order not found" });
      }
      const restaurant = await storage.getRestaurantById(restaurantId);
      const orderItems = await storage.getOrderItems(order.id);
      const menuItemsData = await storage.getMenuItems(restaurantId);
      const menuItemsMap = new Map(menuItemsData.map(m => [m.id, m]));
      const itemsWithDetails = orderItems.map(item => {
        const mi = item.menuItemId ? menuItemsMap.get(item.menuItemId) : null;
        return {
          ...item,
          menuItem: mi
            ? { 
                nameEn: mi.nameEn, 
                nameAr: mi.nameAr, 
                price: mi.price,
                kitchenSectionId: mi.kitchenSectionId,
              }
            : (item.itemName ? { nameAr: item.itemName, nameEn: item.itemName, price: item.unitPrice, kitchenSectionId: null } : null),
        };
      });
      const invoice = await storage.getInvoiceByOrder(order.id);
      res.json({
        order,
        items: itemsWithDetails,
        invoice: invoice || null,
        restaurant: restaurant ? {
          nameEn: restaurant.nameEn,
          nameAr: restaurant.nameAr,
          vatNumber: restaurant.vatNumber,
          commercialRegistration: restaurant.commercialRegistration,
          address: restaurant.address,
          phone: restaurant.phone,
          logo: restaurant.logo,
        } : null,
      });
    } catch (error) {
      handleRouteError(res, error, "Failed to get order receipt");
    }
  });

  // EdfaPay configuration status
  app.get("/api/edfapay/status", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const restaurant = await storage.getRestaurantById(restaurantId);
      res.json({ 
        configured: edfapay.hasCredentials(restaurant?.edfapayMerchantId, restaurant?.edfapayPassword),
        merchantId: restaurant?.edfapayMerchantId ? "***configured***" : null,
        softposConfigured: !!restaurant?.edfapaySoftposAuthToken,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get status" });
    }
  });

  // EdfaPay SoftPOS token — mobile app fetches this to init NFC SDK
  app.get("/api/edfapay/softpos-token", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const restaurant = await storage.getRestaurantById(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }
      res.json({
        authToken: restaurant.edfapaySoftposAuthToken || null,
        environment: restaurant.edfapaySoftposAuthToken ? "PRODUCTION" : "SANDBOX",
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get SoftPOS token" });
    }
  });
  
  // ===============================
  // MOYASAR REMOVED - ALL ENDPOINTS DEPRECATED
  // ===============================

  // Stub: Return 410 Gone for any legacy Moyasar endpoints
  app.use("/api/moyasar", (_req, res) => {
    res.status(410).json({ error: "Moyasar integration has been removed. Use EdfaPay instead.", deprecated: true });
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

      // Reject past reservation dates/times
      const reservationDateValue = req.body.reservationDate ? new Date(req.body.reservationDate) : new Date();
      const requestedDateTime = new Date(`${reservationDateValue.toISOString().split('T')[0]}T${req.body.reservationTime}:00`);
      if (requestedDateTime <= new Date()) {
        return res.status(400).json({ error: "pastDateTime", message: "لا يمكن الحجز في وقت سابق - Cannot book in the past" });
      }

      // Use restaurant settings for duration and deposit
      const defaultDuration = (restaurant as any)?.reservationDuration || 90;
      const depositAmount = (restaurant as any)?.reservationDepositAmount || "20.00";

      const tableId = (req.body.tableId && req.body.tableId !== 'any') ? req.body.tableId : null;
      const reservationTime = req.body.reservationTime;
      const duration = parseInt(req.body.duration) || defaultDuration;

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

      // Validate branchId if provided
      let validBranchId = req.body.branchId || null;
      if (validBranchId) {
        const branches = await storage.getBranches(restaurantId);
        if (!branches.some((b: any) => b.id === validBranchId)) {
          validBranchId = null;
        }
      }

      const reservationData: any = {
        restaurantId,
        branchId: validBranchId,
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

  // Admin: Toggle review visibility
  app.patch("/api/reviews/:id", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const { isPublic } = req.body;
      await storage.updateReviewVisibility(req.params.id, restaurantId, isPublic);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to update review" });
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
      const restaurantId = await getRestaurantId(req);
      let branchId = req.query.branch as string | undefined;
      
      // Validate branchId
      if (branchId) {
        const branches = await storage.getBranches(restaurantId);
        if (!branches.some(b => b.id === branchId)) {
          return res.status(400).json({ error: "Invalid branch" });
        }
      }
      
      // Check if there's already an open session for this branch
      const existingSession = await storage.getCurrentDaySession(restaurantId, branchId);
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
  // EDFAPAY PAYMENT GATEWAY - COMPLETE
  // ===============================

  // EdfaPay helpers
  const getRestaurantEdfapayKeys = async (restaurantId: string) => {
    const restaurant = await storage.getRestaurantById(restaurantId);
    return {
      merchantId: restaurant?.edfapayMerchantId || null,
      password: restaurant?.edfapayPassword || null,
    };
  };

  // --- Payment Session (EdfaPay) ---
  app.post("/api/payments/create-session", async (req, res) => {
    try {
      const { orderId, callbackUrl, payerFirstName, payerLastName, payerEmail, payerPhone } = req.body;
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
      const keys = await getRestaurantEdfapayKeys(order.restaurantId);
      if (!keys.merchantId || !keys.password) {
        return res.status(500).json({ error: "بوابة الدفع غير مُعدة بعد", configured: false });
      }
      
      // Get client IP
      const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() 
        || req.socket.remoteAddress 
        || "127.0.0.1";
      
      const description = `Order ${order.orderNumber || orderId}`;
      const amount = serverAmount.toFixed(2);
      
      // Build webhook notification URL from request origin
      const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
      const host = req.headers["x-forwarded-host"] || req.headers.host || "tryingpos.com";
      const notificationUrl = `${protocol}://${host}/api/payments/webhook`;

      // Initiate EdfaPay SALE
      const edfaResult = await edfapay.initiateSale({
        merchantId: keys.merchantId,
        password: keys.password,
        orderId: orderId,
        amount,
        currency: "SAR",
        description,
        payerFirstName: payerFirstName || order.customerName?.split(" ")[0] || "Customer",
        payerLastName: payerLastName || order.customerName?.split(" ").slice(1).join(" ") || "Guest",
        payerEmail: payerEmail || "customer@example.com",
        payerPhone: payerPhone || order.customerPhone || "0500000000",
        payerIp: clientIp,
        callbackUrl,
        notificationUrl,
      });
      
      if (edfaResult.result === "REDIRECT" && edfaResult.redirect_url) {
        // Customer needs to be redirected to EdfaPay checkout
        res.json({
          action: "redirect",
          redirectUrl: edfaResult.redirect_url,
          redirectMethod: edfaResult.redirect_method || "GET",
          redirectParams: edfaResult.redirect_params || {},
          transId: edfaResult.trans_id,
          orderId,
        });
      } else if (edfaResult.result === "SUCCESS") {
        // Direct success (rare - usually requires redirect)
        res.json({
          action: "success",
          transId: edfaResult.trans_id,
          status: edfaResult.status,
          orderId,
        });
      } else {
        res.status(400).json({ 
          error: "Payment initiation failed", 
          details: edfaResult.error_message || edfaResult.status 
        });
      }
    } catch (error: any) {
      console.error("Payment session error:", error);
      res.status(500).json({ error: error.message || "Failed to create payment session" });
    }
  });

  // --- Verify Payment (EdfaPay) ---
  app.get("/api/payments/verify/:paymentId", async (req, res) => {
    try {
      const orderId = req.query.orderId as string;
      const gwayPaymentId = req.params.paymentId;
      
      if (!orderId) {
        return res.status(400).json({ error: "Missing orderId" });
      }
      
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      
      const keys = await getRestaurantEdfapayKeys(order.restaurantId);
      if (!keys.merchantId || !keys.password) {
        return res.status(500).json({ error: "EdfaPay credentials not configured" });
      }
      
      const statusResult = await edfapay.getTransactionStatus({
        merchantId: keys.merchantId,
        password: keys.password,
        gwayPaymentId,
        orderId,
      });
      
      res.json({
        id: statusResult.trans_id,
        status: statusResult.status,
        result: statusResult.result,
        amount: statusResult.amount,
        currency: statusResult.currency,
        orderId: statusResult.order_id,
      });
    } catch (error) {
      console.error("Payment verify error:", error);
      res.status(500).json({ error: "Failed to verify payment" });
    }
  });

  // --- Complete Payment (EdfaPay) ---
  app.post("/api/payments/complete", async (req, res) => {
    try {
      const { orderId, transId, gwayId } = req.body;
      if (!orderId) {
        return res.status(400).json({ error: "Missing orderId" });
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
      
      // Verify via EdfaPay status API if we have transId/gwayId
      let paymentVerified = false;
      let paymentStatus = "unknown";
      
      if (transId || gwayId) {
        const keys = await getRestaurantEdfapayKeys(order.restaurantId);
        if (keys.merchantId && keys.password && gwayId) {
          try {
            const statusResult = await edfapay.getTransactionStatus({
              merchantId: keys.merchantId,
              password: keys.password,
              gwayPaymentId: gwayId,
              orderId,
            });
            paymentStatus = statusResult.status;
            paymentVerified = edfapay.isSuccessfulPayment(statusResult.status);
          } catch (e) {
            console.error("EdfaPay status check error:", e);
          }
        }
      }
      
      // Also accept if callback already confirmed (via webhook route)
      if (!paymentVerified) {
        // Check if we have a successful transaction record from callback
        const transactions = await storage.getPaymentTransactions(order.restaurantId, orderId);
        const successTx = transactions.find(t => t.type === "payment" && t.status === "paid");
        if (successTx) {
          paymentVerified = true;
        }
      }
      
      if (paymentVerified) {
        // If order was payment_pending, change to pending now that payment is verified
        const newStatus = order.status === "payment_pending" ? "pending" : order.status;
        await storage.updateOrder(orderId, { isPaid: true, paymentMethod: "edfapay_online", status: newStatus });

        if (order.tableId && order.orderType === "dine_in") {
          await storage.updateTableStatus(order.tableId, "available");
          if (newStatus !== "completed") {
            await storage.updateOrder(orderId, { isPaid: true, paymentMethod: "edfapay_online", status: "completed" });
          }
        }

        const restaurantId = order.restaurantId;
        await storage.createPaymentTransaction({
          restaurantId,
          orderId,
          edfapayTransactionId: transId || null,
          edfapayGwayId: gwayId || null,
          type: "payment",
          status: "paid",
          amount: Math.round(parseFloat(order.total || "0") * 100),
          currency: "SAR",
          paymentMethod: "edfapay_online",
        });

        // Create invoice and update day session now that payment is verified (for orders that were payment_pending)
        if (order.status === "payment_pending") {
          try {
            const restaurant = await storage.getRestaurantById(restaurantId);
            if (restaurant) {
              const isTaxEnabled = restaurant.taxEnabled !== false;
              const taxRatePercent = isTaxEnabled ? 15 : 0;
              const now = new Date();
              const uuid = generateInvoiceUuid();
              const payBranchId = order.branchId || null;
              const invoiceNumber = await storage.getNextInvoiceNumber(restaurantId, payBranchId);
              const { counter: payPrevC, lastHash: payPrevH } = await storage.getZatcaCounterAndHash(restaurantId, payBranchId);
              const currentCounter = payPrevC + 1;
              const previousHash = payPrevH ||
                Buffer.from('NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==', 'base64').toString('utf8');

              // Build itemized line items (ZATCA requires itemization)
              const payOrderItems = await storage.getOrderItems(orderId);
              const payMenuItemsRaw = await storage.getMenuItems(restaurantId);
              const payMenuItemsMap = new Map(payMenuItemsRaw.map(m => [m.id, m]));
              
              const payXmlItems: ZatcaLineItem[] = payOrderItems.map((item, idx) => {
                const menuItem = payMenuItemsMap.get(item.menuItemId);
                const unitPrice = parseFloat(item.unitPrice || menuItem?.price || "0");
                const qty = item.quantity || 1;
                const lineTotal = bankersRound(unitPrice * qty);
                const lineTax = bankersRound(lineTotal * (taxRatePercent / 100));
                return {
                  id: String(idx + 1),
                  nameAr: menuItem?.nameAr || menuItem?.nameEn || 'منتج',
                  nameEn: menuItem?.nameEn || '',
                  quantity: qty,
                  unitPrice,
                  discount: 0,
                  taxRate: taxRatePercent,
                  taxAmount: lineTax,
                  totalWithTax: bankersRound(lineTotal + lineTax),
                  totalWithoutTax: lineTotal,
                };
              });

              const paySubtotal = bankersRound(payXmlItems.reduce((sum, i) => sum + i.totalWithoutTax, 0));
              const payDiscount = parseFloat(order.discount || "0");
              const payDeliveryFee = parseFloat(order.deliveryFee || "0");
              const payTaxable = bankersRound(Math.max(0, paySubtotal - payDiscount + payDeliveryFee));
              const payVatAmount = bankersRound(payTaxable * (taxRatePercent / 100));
              const payTotal = bankersRound(payTaxable + payVatAmount);

              const unsignedPayXml = generateZatcaXml({
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
                items: payXmlItems,
                subtotal: paySubtotal,
                discount: payDiscount,
                deliveryFee: payDeliveryFee,
                taxAmount: payVatAmount,
                taxRate: taxRatePercent,
                total: payTotal,
                paymentMethod: 'edfapay_online',
                previousInvoiceHash: previousHash,
                invoiceCounter: currentCounter,
              });

              // Resolve signing credentials
              let payPrivKey: string | null = null;
              let payCert: string | null = null;
              if (payBranchId) {
                const br = await storage.getBranch(payBranchId);
                if (br && (br as any).zatcaPrivateKey) {
                  payPrivKey = (br as any).zatcaPrivateKey;
                  payCert = (br as any).zatcaProductionCsid || (br as any).zatcaComplianceCsid || (br as any).zatcaCertificate;
                }
              }
              if (!payPrivKey && (restaurant as any).zatcaPrivateKey) {
                payPrivKey = (restaurant as any).zatcaPrivateKey;
                payCert = restaurant.zatcaProductionCsid || restaurant.zatcaComplianceCsid || restaurant.zatcaCertificate;
              }

              const paySignResult = buildSignedInvoice(
                unsignedPayXml, payPrivKey, payCert,
                {
                  sellerName: restaurant.nameAr || restaurant.nameEn || "مطعم",
                  vatNumber: restaurant.vatNumber || "",
                  timestamp: now.toISOString(),
                  total: payTotal.toFixed(2),
                  vatAmount: payVatAmount.toFixed(2),
                },
              );

              const xmlContent = paySignResult.finalXml;
              const invoiceHash = paySignResult.invoiceHash;
              const qrData = paySignResult.qrData;

              await storage.createInvoice({
                restaurantId,
                branchId: payBranchId,
                orderId,
                invoiceNumber,
                invoiceType: "simplified",
                subtotal: paySubtotal.toFixed(2),
                taxRate: taxRatePercent.toFixed(2),
                taxAmount: payVatAmount.toFixed(2),
                total: payTotal.toFixed(2),
                qrCodeData: qrData,
                xmlContent,
                invoiceHash,
                previousInvoiceHash: previousHash,
                invoiceCounter: currentCounter,
                uuid,
                status: "issued",
                zatcaStatus: "pending",
                customerName: order.customerName || null,
                customerPhone: order.customerPhone || null,
                paymentMethod: 'edfapay_online',
                signedXml: paySignResult.signedXml || null,
              });

              await storage.updateZatcaCounterAndHash(restaurantId, payBranchId, currentCounter, invoiceHash);
            }
          } catch (invoiceError) {
            console.error("Invoice creation error (payment complete):", invoiceError);
          }

          // Update day session totals
          try {
            const currentSession = await storage.getCurrentDaySession(restaurantId, order.branchId || undefined);
            if (currentSession) {
              const orderTotal = parseFloat(order.total || "0");
              await storage.incrementDaySessionTotals(currentSession.id, orderTotal, "edfapay_online");
            }
          } catch (e) {
            console.error("Failed to update day session totals (payment complete):", e);
          }
        }

        const updatedOrder = await storage.getOrder(orderId);
        res.json(updatedOrder);
      } else {
        res.status(400).json({ error: `Payment not verified. Status: ${paymentStatus}` });
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

  // --- Refund Payment (EdfaPay - Full or Partial) ---
  app.post("/api/payments/refund", async (req, res) => {
    try {
      const { orderId, transId, gwayId, amount, reason } = req.body;
      if (!orderId) {
        return res.status(400).json({ error: "Missing orderId" });
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
      const keys = await getRestaurantEdfapayKeys(order.restaurantId);
      if (!keys.merchantId || !keys.password) {
        return res.status(500).json({ error: "EdfaPay credentials not configured" });
      }
      
      // Find the original payment transaction
      const existingPayments = await storage.getPaymentTransactions(order.restaurantId, orderId);
      const originalPayment = existingPayments.find(t => t.type === "payment" && t.status === "paid");
      if (!originalPayment) {
        return res.status(404).json({ error: "Original payment not found" });
      }
      
      const refundTransId = transId || originalPayment.edfapayTransactionId;
      const refundGwayId = gwayId || originalPayment.edfapayGwayId;
      
      if (!refundTransId || !refundGwayId) {
        return res.status(400).json({ error: "Missing transaction IDs for refund" });
      }
      
      const totalRefunded = existingPayments
        .filter(t => t.type === "refund")
        .reduce((sum, t) => sum + (t.refundedAmount || 0), 0);

      const refundAmount = amount 
        ? parseFloat(amount).toFixed(2) 
        : (originalPayment.amount / 100).toFixed(2);
      
      const refundAmountHalalas = Math.round(parseFloat(refundAmount) * 100);
      if (refundAmountHalalas + totalRefunded > originalPayment.amount) {
        return res.status(400).json({ error: "Refund amount exceeds remaining refundable balance" });
      }
      
      const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() 
        || req.socket.remoteAddress 
        || "127.0.0.1";
      
      const refundResult = await edfapay.refundTransaction({
        merchantId: keys.merchantId,
        password: keys.password,
        gwayId: refundGwayId,
        transId: refundTransId,
        orderId,
        amount: refundAmount,
        payerIp: clientIp,
      });
      
      if (refundResult.result === "SUCCESS") {
        await storage.createPaymentTransaction({
          restaurantId: callerRestaurantId,
          orderId,
          edfapayTransactionId: refundResult.trans_id,
          edfapayGwayId: refundGwayId,
          type: "refund",
          status: "refunded",
          amount: refundAmountHalalas,
          currency: "SAR",
          refundedAmount: refundAmountHalalas,
          refundReason: reason || "",
        });
        
        const isFullRefund = (refundAmountHalalas + totalRefunded) >= originalPayment.amount;
        if (isFullRefund) {
          await storage.updateOrder(orderId, { status: "refunded" });
        }
        
        res.json({
          success: true,
          payment: {
            id: refundResult.trans_id,
            status: refundResult.status,
            amount: refundAmount,
          },
          isFullRefund,
        });
      } else {
        res.status(400).json({ error: "Refund failed", details: refundResult.error_message });
      }
    } catch (error: any) {
      console.error("Refund error:", error);
      res.status(500).json({ error: error.message || "Failed to process refund" });
    }
  });

  // --- Payment Webhooks (EdfaPay sends callback notifications here) ---
  app.post("/api/payments/webhook", async (req, res) => {
    try {
      const payload = req.body;
      
      // Basic webhook validation
      if (!payload || typeof payload !== "object") {
        console.warn("Webhook: invalid payload received");
        return res.status(400).send("ERROR");
      }
      
      const action = payload.action;   // SALE, REFUND
      const result = payload.result;   // SUCCESS, DECLINED, REDIRECT
      const status = payload.status;   // SETTLED, DECLINED, PENDING, REFUND
      const orderId = payload.order_id;
      const transId = payload.trans_id;
      
      console.log(`EdfaPay Webhook: action=${action} result=${result} status=${status} order=${orderId} trans=${transId}`);
      
      if (!orderId || !transId) {
        return res.status(200).send("OK");
      }
      
      const order = await storage.getOrder(orderId);
      if (!order) {
        console.warn(`Webhook: order ${orderId} not found`);
        return res.status(200).send("OK");
      }
      
      // Verify webhook hash for authenticity
      if (payload.hash) {
        const keys = await getRestaurantEdfapayKeys(order.restaurantId);
        if (keys.password) {
          const isValid = edfapay.verifyCallbackHash(payload as any, keys.password);
          if (!isValid) {
            console.warn(`Webhook: hash verification FAILED for order ${orderId} trans ${transId}`);
            // Log but still process — some callbacks may have partial fields
          } else {
            console.log(`Webhook: hash verified OK for order ${orderId}`);
          }
        }
      }
      
      if (action === "SALE" && result === "SUCCESS" && edfapay.isSuccessfulPayment(status)) {
        // Payment successful
        if (!order.isPaid) {
          await storage.updateOrder(orderId, { isPaid: true, paymentMethod: "edfapay_online" });
        }
        
        // Create transaction record
        const existingTx = await storage.getPaymentTransactions(order.restaurantId, orderId);
        const hasPaidTx = existingTx.some(t => t.type === "payment" && t.status === "paid");
        if (!hasPaidTx) {
          await storage.createPaymentTransaction({
            restaurantId: order.restaurantId,
            orderId,
            edfapayTransactionId: transId,
            edfapayGwayId: payload.gway_id || null,
            type: "payment",
            status: "paid",
            amount: Math.round(parseFloat(payload.amount || order.total || "0") * 100),
            currency: payload.currency || "SAR",
            paymentMethod: "edfapay_online",
            webhookReceived: true,
          });
        }
      } else if (action === "SALE" && result === "DECLINED") {
        // Payment failed
        await storage.createPaymentTransaction({
          restaurantId: order.restaurantId,
          orderId,
          edfapayTransactionId: transId,
          type: "payment",
          status: "failed",
          amount: Math.round(parseFloat(payload.amount || order.total || "0") * 100),
          currency: payload.currency || "SAR",
          webhookReceived: true,
          metadata: { decline_reason: payload.decline_reason },
        });
      } else if (action === "REFUND" && result === "SUCCESS") {
        // Refund
        await storage.createPaymentTransaction({
          restaurantId: order.restaurantId,
          orderId,
          edfapayTransactionId: transId,
          type: "refund",
          status: "refunded",
          amount: Math.round(parseFloat(payload.amount || "0") * 100),
          currency: payload.currency || "SAR",
          refundedAmount: Math.round(parseFloat(payload.amount || "0") * 100),
          webhookReceived: true,
        });
      }
      
      // EdfaPay expects "OK" response
      res.status(200).send("OK");
    } catch (error) {
      console.error("Payment webhook error:", error);
      res.status(200).send("OK");
    }
  });

  // --- Test Cards Reference (EdfaPay Sandbox) ---
  app.get("/api/payments/test-cards", (_req, res) => {
    res.json({
      testCards: [
        { brand: "Mastercard", number: "5123450000000008", expiry: "01/39", cvc: "100", result: "Successful", note: "EdfaPay official sandbox card" },
        { brand: "Visa", number: "4111111111111111", expiry: "01/39", cvc: "100", result: "Successful" },
        { brand: "Visa", number: "4000000000000002", expiry: "01/39", cvc: "100", result: "Declined" },
        { brand: "Mastercard", number: "5111111111111118", expiry: "01/39", cvc: "100", result: "Successful" },
        { brand: "Mastercard", number: "5200000000000007", expiry: "01/39", cvc: "100", result: "Declined" },
        { brand: "Mada", number: "5043000000000003", expiry: "01/39", cvc: "100", result: "Successful" },
        { brand: "Mada", number: "5043000000000011", expiry: "01/39", cvc: "100", result: "Declined" },
      ],
      sandboxCredentials: {
        client_key: "sandbox-client-key",
        password: "sandbox-secret-password",
        payer_email: "testuser@edfapay.com",
      },
      stcPayTestOTP: "000000",
      note: "Use these cards in the EdfaPay sandbox environment only. For production, complete onboarding.",
    });
  });

  // --- Recurring Payment (EdfaPay) ---
  app.post("/api/payments/recurring", async (req, res) => {
    try {
      const { orderId, recurringToken, amount, description, payerEmail } = req.body;
      if (!orderId || !recurringToken) {
        return res.status(400).json({ error: "Missing required fields: orderId, recurringToken" });
      }
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      if (order.isPaid) {
        return res.status(400).json({ error: "Order is already paid" });
      }
      const callerRestaurantId = await getRestaurantId(req);
      if (order.restaurantId !== callerRestaurantId) {
        return res.status(403).json({ error: "Access denied" });
      }
      const keys = await getRestaurantEdfapayKeys(order.restaurantId);
      if (!keys.merchantId || !keys.password) {
        return res.status(500).json({ error: "EdfaPay credentials not configured" });
      }

      const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
        || req.socket.remoteAddress
        || "127.0.0.1";

      const serverAmount = amount ? parseFloat(amount).toFixed(2) : parseFloat(order.total || "0").toFixed(2);
      const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
      const host = req.headers["x-forwarded-host"] || req.headers.host || "tryingpos.com";
      const notificationUrl = `${protocol}://${host}/api/payments/webhook`;

      const recurringResult = await edfapay.recurringPayment({
        merchantId: keys.merchantId,
        password: keys.password,
        recurringToken,
        orderId,
        amount: serverAmount,
        currency: "SAR",
        description: description || `Recurring payment for order ${order.orderNumber || orderId}`,
        payerEmail: payerEmail || "customer@example.com",
        payerIp: clientIp,
        notificationUrl,
      });

      if (recurringResult.result === "SUCCESS" || edfapay.isSuccessfulPayment(recurringResult.status)) {
        await storage.updateOrder(orderId, { isPaid: true, paymentMethod: "edfapay_online" });
        await storage.createPaymentTransaction({
          restaurantId: callerRestaurantId,
          orderId,
          edfapayTransactionId: recurringResult.trans_id,
          type: "payment",
          status: "paid",
          amount: Math.round(parseFloat(serverAmount) * 100),
          currency: "SAR",
          paymentMethod: "edfapay_online",
          metadata: { recurring: true, recurringToken },
        });
        res.json({
          success: true,
          transId: recurringResult.trans_id,
          status: recurringResult.status,
        });
      } else if (recurringResult.result === "REDIRECT" && recurringResult.redirect_url) {
        res.json({
          action: "redirect",
          redirectUrl: recurringResult.redirect_url,
          transId: recurringResult.trans_id,
        });
      } else {
        res.status(400).json({
          error: "Recurring payment failed",
          details: recurringResult.error_message || recurringResult.status,
        });
      }
    } catch (error: any) {
      console.error("Recurring payment error:", error);
      res.status(500).json({ error: error.message || "Failed to process recurring payment" });
    }
  });

  // ==========================================
  // Apple Pay S2S Integration
  // ==========================================

  // --- Check Apple Pay availability ---
  app.get("/api/payments/apple-pay-config", async (req, res) => {
    try {
      const applePayAvailable = edfapay.hasApplePayConfig();
      const config = edfapay.getApplePayConfig();
      res.json({
        available: applePayAvailable,
        merchantId: config?.merchantId || null,
        domain: config?.domain || null,
        supportedNetworks: ["visa", "masterCard", "mada"],
        merchantCapabilities: ["supports3DS"],
        supportedCountries: ["SA"],
        currencyCode: "SAR",
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to check Apple Pay config" });
    }
  });

  // --- Apple Pay Merchant Validation Session ---
  // Frontend calls this during onvalidatemerchant event
  app.post("/api/payments/apple-pay-session", async (req, res) => {
    try {
      const { validationURL } = req.body;
      if (!validationURL) {
        return res.status(400).json({ error: "Missing validationURL" });
      }

      // Security: only allow Apple's validation URLs
      const url = new URL(validationURL);
      if (!url.hostname.endsWith(".apple.com")) {
        return res.status(400).json({ error: "Invalid validation URL — must be apple.com" });
      }

      const session = await edfapay.validateApplePaySession(validationURL);
      res.json(session);
    } catch (error: any) {
      console.error("Apple Pay session validation error:", error);
      res.status(500).json({ error: error.message || "Failed to validate Apple Pay session" });
    }
  });

  // --- Apple Pay S2S Sale — process Apple Pay token ---
  app.post("/api/payments/apple-pay-sale", async (req, res) => {
    try {
      const { orderId, callbackUrl, applePayToken, payerFirstName, payerLastName, payerEmail, payerPhone } = req.body;
      if (!orderId || !callbackUrl || !applePayToken) {
        return res.status(400).json({ error: "Missing required fields: orderId, callbackUrl, applePayToken" });
      }

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      const serverAmount = parseFloat(order.total || "0");
      if (serverAmount <= 0) {
        return res.status(400).json({ error: "Invalid order total" });
      }
      if (order.isPaid) {
        return res.status(400).json({ error: "Order is already paid" });
      }

      const keys = await getRestaurantEdfapayKeys(order.restaurantId);
      if (!keys.merchantId || !keys.password) {
        return res.status(500).json({ error: "بوابة الدفع غير مُعدة بعد", configured: false });
      }

      const clientIp = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
        || req.socket.remoteAddress
        || "127.0.0.1";

      const description = `Order ${order.orderNumber || orderId}`;
      const amount = serverAmount.toFixed(2);

      const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
      const host = req.headers["x-forwarded-host"] || req.headers.host || "tryingpos.com";
      const notificationUrl = `${protocol}://${host}/api/payments/webhook`;

      // Stringify the Apple Pay token if it's an object
      const tokenString = typeof applePayToken === "string"
        ? applePayToken
        : JSON.stringify(applePayToken);

      const edfaResult = await edfapay.applePaySale({
        merchantId: keys.merchantId,
        password: keys.password,
        orderId,
        amount,
        currency: "SAR",
        description,
        payerFirstName: payerFirstName || order.customerName?.split(" ")[0] || "Customer",
        payerLastName: payerLastName || order.customerName?.split(" ").slice(1).join(" ") || "Guest",
        payerEmail: payerEmail || "customer@example.com",
        payerPhone: payerPhone || order.customerPhone || "0500000000",
        payerIp: clientIp,
        callbackUrl,
        notificationUrl,
        applePayToken: tokenString,
      });

      if (edfaResult.result === "SUCCESS" || edfapay.isSuccessfulPayment(edfaResult.status)) {
        // Direct success — mark order as paid
        await storage.updateOrder(orderId, { isPaid: true, paymentMethod: "apple_pay" });
        await storage.createPaymentTransaction({
          restaurantId: order.restaurantId,
          orderId,
          edfapayTransactionId: edfaResult.trans_id,
          type: "payment",
          status: "paid",
          amount: Math.round(serverAmount * 100),
          currency: "SAR",
          paymentMethod: "apple_pay",
          metadata: { source: "apple_pay_s2s" },
        });
        res.json({
          action: "success",
          transId: edfaResult.trans_id,
          status: edfaResult.status,
          orderId,
        });
      } else if (edfaResult.result === "REDIRECT" && edfaResult.redirect_url) {
        // 3DS redirect required (rare for Apple Pay but possible)
        res.json({
          action: "redirect",
          redirectUrl: edfaResult.redirect_url,
          redirectMethod: edfaResult.redirect_method || "GET",
          redirectParams: edfaResult.redirect_params || {},
          transId: edfaResult.trans_id,
          orderId,
        });
      } else {
        res.status(400).json({
          error: "Apple Pay payment failed",
          details: edfaResult.error_message || edfaResult.status,
          code: edfaResult.error_code,
        });
      }
    } catch (error: any) {
      console.error("Apple Pay S2S sale error:", error);
      res.status(500).json({ error: error.message || "Failed to process Apple Pay payment" });
    }
  });

  // --- Apple Pay Domain Verification ---
  // Apple checks /.well-known/apple-developer-merchantid-domain-association
  // The file content is provided by Apple and stored in env var
  app.get("/.well-known/apple-developer-merchantid-domain-association", (_req, res) => {
    const verificationContent = process.env.APPLE_PAY_DOMAIN_VERIFICATION;
    if (!verificationContent) {
      return res.status(404).send("Not configured");
    }
    res.set("Content-Type", "text/plain");
    res.send(verificationContent);
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
          csvSafe(o.orderNumber),
          date,
          csvSafe(o.orderType),
          csvSafe(o.status),
          csvSafe(o.paymentMethod),
          o.isPaid ? "Yes" : "No",
          csvQuote(o.customerName),
          csvSafe(o.customerPhone),
          o.subtotal || "0",
          o.discount || "0",
          o.tax || "0",
          o.deliveryFee || "0",
          o.total || "0",
          csvQuote(o.notes),
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
        csvQuote(i.name),
        csvQuote(i.category),
        i.currentStock || "0",
        i.minStock || "0",
        csvSafe(i.unit),
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
        csvQuote(c.name),
        csvSafe(c.phone),
        csvSafe(c.email),
        csvQuote(c.address),
        c.totalOrders || "0",
        c.totalSpent || "0",
        csvQuote(c.notes),
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

  // Helper: resolve ZATCA credentials — branch-level first, fall back to restaurant
  async function getZatcaCredentials(restaurant: any, branchId?: string | null) {
    if (branchId) {
      const branch = await storage.getBranch(branchId);
      if (branch && (branch as any).zatcaProductionCsid) {
        return {
          environment: (branch as any).zatcaEnvironment || restaurant.zatcaEnvironment || 'sandbox',
          certificate: (branch as any).zatcaProductionCsid || (branch as any).zatcaComplianceCsid,
          secret: (branch as any).zatcaSecretKey,
          deviceId: (branch as any).zatcaDeviceId,
          complianceCsid: (branch as any).zatcaComplianceCsid,
          productionCsid: (branch as any).zatcaProductionCsid,
          certificateExpiry: (branch as any).zatcaCertificateExpiry,
          source: 'branch' as const,
          branchId,
          branchName: branch.name,
        };
      }
    }
    // Fall back to restaurant-level
    return {
      environment: restaurant.zatcaEnvironment || 'sandbox',
      certificate: restaurant.zatcaProductionCsid || restaurant.zatcaComplianceCsid,
      secret: restaurant.zatcaSecretKey,
      deviceId: restaurant.zatcaDeviceId,
      complianceCsid: restaurant.zatcaComplianceCsid,
      productionCsid: restaurant.zatcaProductionCsid,
      certificateExpiry: restaurant.zatcaCertificateExpiry,
      source: 'restaurant' as const,
      branchId: null,
      branchName: null,
    };
  }

  // Get ZATCA configuration status (supports ?branchId=xxx)
  app.get("/api/zatca/status", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const restaurant = await storage.getRestaurantById(restaurantId);
      if (!restaurant) return res.status(404).json({ error: "Restaurant not found" });

      const branchId = req.query.branchId as string || null;
      const creds = await getZatcaCredentials(restaurant, branchId);

      // Get all branches status
      const allBranches = await storage.getBranches(restaurantId);
      const branchStatuses = allBranches.map((b: any) => ({
        id: b.id,
        name: b.name,
        nameAr: b.nameAr,
        slug: b.slug,
        isMain: b.isMain,
        hasDeviceId: !!b.zatcaDeviceId,
        hasComplianceCsid: !!b.zatcaComplianceCsid,
        hasProductionCsid: !!b.zatcaProductionCsid,
        certificateExpiry: b.zatcaCertificateExpiry,
        invoiceCounter: b.zatcaInvoiceCounter || 0,
        isRegistered: !!(b.zatcaProductionCsid && b.zatcaSecretKey),
      }));

      res.json({
        environment: creds.environment,
        hasVatNumber: !!restaurant.vatNumber,
        hasCertificate: !!creds.certificate,
        hasComplianceCsid: !!creds.complianceCsid,
        hasProductionCsid: !!creds.productionCsid,
        hasDeviceId: !!creds.deviceId,
        certificateExpiry: creds.certificateExpiry,
        invoiceCounter: restaurant.zatcaInvoiceCounter || 0,
        taxEnabled: restaurant.taxEnabled !== false,
        taxRate: restaurant.taxRate || '15',
        vatNumber: restaurant.vatNumber,
        credentialSource: creds.source,
        isFullyConfigured: !!(
          restaurant.vatNumber &&
          creds.productionCsid &&
          restaurant.nameAr &&
          restaurant.streetName &&
          restaurant.buildingNumber &&
          restaurant.city &&
          restaurant.postalCode
        ),
        branches: branchStatuses,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get ZATCA status" });
    }
  });

  // Generate CSR for ZATCA device registration (standalone endpoint)
  app.post("/api/zatca/generate-csr", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const restaurant = await storage.getRestaurantById(restaurantId);
      if (!restaurant) return res.status(404).json({ error: "Restaurant not found" });

      const { branchId } = req.body;
      const branch = branchId ? await storage.getBranch(branchId) : null;
      const branchName = branch ? (branch.nameAr || branch.name || 'Main') : (restaurant.nameAr || restaurant.nameEn || 'Main');
      const egsSerial = `EGS1-${(restaurant.vatNumber || '000000000000000').replace(/\D/g, '').slice(0, 15)}-${String(branchId ? '00002' : '00001')}`;

      const result = generateZatcaCsr({
        commonName: egsSerial,
        organizationIdentifier: restaurant.vatNumber || '',
        organizationUnit: branchName,
        organizationName: restaurant.nameEn || restaurant.nameAr || 'Restaurant',
        countryCode: 'SA',
        invoiceType: '1100',
        location: restaurant.city || 'Riyadh',
        industry: 'Food',
      });

      // Store private key
      const keyData: Record<string, any> = { zatcaPrivateKey: result.privateKey };
      if (branchId) {
        await storage.updateBranch(branchId, keyData as any);
      }
      await storage.updateRestaurantById(restaurantId, keyData as any);

      res.json({ csr: result.csr, message: 'CSR generated and private key stored securely' });
    } catch (error: any) {
      console.error("CSR generation error:", error?.message);
      res.status(500).json({ error: error?.message || "Failed to generate CSR" });
    }
  });

  // Register device - Step 1: Get Compliance CSID (supports branchId in body)
  // Now auto-generates CSR if not provided, and stores the private key
  app.post("/api/zatca/compliance-csid", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const restaurant = await storage.getRestaurantById(restaurantId);
      if (!restaurant) return res.status(404).json({ error: "Restaurant not found" });

      const { otp, branchId } = req.body;
      let privateKey: string | undefined;
      let csr: string;
      if (!otp) return res.status(400).json({ error: "OTP is required" });

      // Always auto-generate CSR for reliability
      const branch = branchId ? await storage.getBranch(branchId) : null;
      const branchName = branch ? (branch.nameAr || branch.name || 'Main') : (restaurant.nameAr || restaurant.nameEn || 'Main');
      const egsSerial = `EGS1-${(restaurant.vatNumber || '000000000000000').replace(/\D/g, '').slice(0, 15)}-${String(branchId ? '00002' : '00001')}`;
      
      const csrResult = generateZatcaCsr({
        commonName: egsSerial,
        organizationIdentifier: restaurant.vatNumber || '',
        organizationUnit: branchName,
        organizationName: restaurant.nameEn || restaurant.nameAr || 'Restaurant',
        countryCode: 'SA',
        invoiceType: '1100', // simplified + standard
        location: restaurant.city || 'Riyadh',
        industry: 'Food',
      });
      csr = csrResult.csr;
      privateKey = csrResult.privateKey;

      console.log('[ZATCA] CSR generated, length:', csr.length);
      console.log('[ZATCA] VAT:', restaurant.vatNumber, 'EGS:', egsSerial);

      const environment = restaurant.zatcaEnvironment || 'sandbox';
      const baseUrl = getZatcaBaseUrl(environment);

      const result = isMockEnvironment(environment)
        ? mockGetComplianceCsid()
        : await getComplianceCsid(baseUrl, otp, csr);

      // Store compliance CSID + private key at branch or restaurant level
      const csidData: Record<string, any> = {
        zatcaComplianceCsid: result.binarySecurityToken,
        zatcaSecretKey: result.secret,
        zatcaDeviceId: result.requestID,
        zatcaCertificate: result.binarySecurityToken,
      };
      // Store private key if generated
      if (privateKey) {
        csidData.zatcaPrivateKey = privateKey;
      }

      if (branchId) {
        await storage.updateBranch(branchId, { ...csidData, zatcaEnvironment: environment } as any);
      }
      // Always update restaurant level too (backward compat)
      await storage.updateRestaurantById(restaurantId, csidData as any);

      res.json({
        success: true,
        requestId: result.requestID,
        dispositionMessage: result.dispositionMessage,
        registeredFor: branchId ? 'branch' : 'restaurant',
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

      const branchId = req.body.branchId || null;
      const creds = await getZatcaCredentials(restaurant, branchId);

      if (!creds.complianceCsid || !creds.secret) {
        return res.status(400).json({ error: "Missing compliance CSID. Complete Step 1 first." });
      }

      const baseUrl = getZatcaBaseUrl(creds.environment);

      // Fetch private key for signing (branch-level first, then restaurant)
      let privateKey: string | null = null;
      if (branchId) {
        const branch = await storage.getBranch(branchId);
        privateKey = (branch as any)?.zatcaPrivateKey || null;
      }
      if (!privateKey) {
        privateKey = (restaurant as any).zatcaPrivateKey || null;
      }

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

      // Sign the invoice with private key + compliance certificate (required by ZATCA)
      const signResult = buildSignedInvoice(
        testXml,
        privateKey,
        creds.complianceCsid!,
        {
          sellerName: restaurant.nameAr || restaurant.nameEn || 'مطعم',
          vatNumber: restaurant.vatNumber || '',
          timestamp: now.toISOString().replace('T', 'T').slice(0, 19) + 'Z',
          total: '115.00',
          vatAmount: '15.00',
        }
      );

      const xmlToSubmit = signResult.signedXml || signResult.finalXml;
      const hash = signResult.invoiceHash;

      const result = isMockEnvironment(creds.environment)
        ? mockSubmitComplianceInvoice()
        : await submitComplianceInvoice(
            baseUrl,
            creds.complianceCsid!,
            creds.secret!,
            hash,
            uuid,
            xmlToSubmit
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

      const branchId = req.body.branchId || null;
      const creds = await getZatcaCredentials(restaurant, branchId);

      if (!creds.complianceCsid || !creds.secret || !creds.deviceId) {
        return res.status(400).json({ error: "Missing compliance credentials. Complete Steps 1-2 first." });
      }

      const baseUrl = getZatcaBaseUrl(creds.environment);

      const result = isMockEnvironment(creds.environment)
        ? mockGetProductionCsid()
        : await getProductionCsid(
            baseUrl,
            creds.deviceId,
            creds.complianceCsid,
            creds.secret
          );

      // Store production CSID at branch level if branchId, else restaurant
      const prodCsidData = {
        zatcaProductionCsid: result.binarySecurityToken,
        zatcaSecretKey: result.secret,
        zatcaCertificate: result.binarySecurityToken,
      };

      if (branchId) {
        await storage.updateBranch(branchId, prodCsidData as any);
      }
      // Always update restaurant level too (backward compat)
      await storage.updateRestaurantById(restaurantId, prodCsidData as any);

      res.json({
        success: true,
        requestId: result.requestID,
        dispositionMessage: result.dispositionMessage,
        registeredFor: branchId ? 'branch' : 'restaurant',
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

      // Resolve credentials from invoice's branch, fall back to restaurant
      const creds = await getZatcaCredentials(restaurant, (invoice as any).branchId);
      if (!creds.certificate || !creds.secret) {
        return res.status(400).json({ error: "ZATCA not configured. Complete device registration first." });
      }

      if (!invoice.xmlContent && !invoice.signedXml) {
        return res.status(400).json({ error: "Invoice has no XML content to submit." });
      }

      const xmlToSubmit = invoice.signedXml || invoice.xmlContent || '';
      const hash = invoice.invoiceHash || computeInvoiceHashBase64(xmlToSubmit);
      const uuid = invoice.uuid || generateInvoiceUuid();

      const baseUrl = getZatcaBaseUrl(creds.environment);

      let result;
      if (invoice.invoiceType === 'standard') {
        // Standard invoice needs clearance
        result = isMockEnvironment(creds.environment)
          ? mockClearInvoice()
          : await clearInvoice(baseUrl, creds.certificate!, creds.secret!, hash, uuid, xmlToSubmit);
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
        result = isMockEnvironment(creds.environment)
          ? mockReportInvoice()
          : await reportInvoice(baseUrl, creds.certificate!, creds.secret!, hash, uuid, xmlToSubmit);
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

      const allInvoices = await storage.getInvoices(restaurantId);
      const pendingInvoices = allInvoices.filter(
        inv => inv.xmlContent && (!inv.zatcaStatus || inv.zatcaStatus === 'pending')
      );

      const results: Array<{ invoiceId: string; invoiceNumber: string; status: string; error?: string }> = [];

      for (const invoice of pendingInvoices) {
        try {
          // Resolve credentials per-invoice branch
          const invCreds = await getZatcaCredentials(restaurant, (invoice as any).branchId);
          if (!invCreds.certificate || !invCreds.secret) {
            results.push({ invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber || '', status: 'ERROR', error: 'No ZATCA credentials for this branch' });
            continue;
          }
          const baseUrl = getZatcaBaseUrl(invCreds.environment);

          const xmlToSubmit = invoice.signedXml || invoice.xmlContent || '';
          const hash = invoice.invoiceHash || computeInvoiceHashBase64(xmlToSubmit);
          const uuid = invoice.uuid || generateInvoiceUuid();

          if (invoice.invoiceType === 'standard') {
            const result = isMockEnvironment(invCreds.environment)
              ? mockClearInvoice()
              : await clearInvoice(baseUrl, invCreds.certificate, invCreds.secret, hash, uuid, xmlToSubmit);
            await storage.updateInvoice(invoice.id, {
              zatcaStatus: result.clearanceStatus === 'CLEARED' ? 'accepted' : 'rejected',
              zatcaSubmissionId: uuid,
              zatcaWarnings: JSON.stringify(result.validationResults?.warningMessages || []),
              zatcaErrors: JSON.stringify(result.validationResults?.errorMessages || []),
              status: result.clearanceStatus === 'CLEARED' ? 'reported' : 'issued',
            });
            results.push({ invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber || '', status: result.clearanceStatus || 'UNKNOWN' });
          } else {
            const result = isMockEnvironment(invCreds.environment)
              ? mockReportInvoice()
              : await reportInvoice(baseUrl, invCreds.certificate, invCreds.secret, hash, uuid, xmlToSubmit);
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
        branchId: order.branchId || null,
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
        signedXml: zatcaResult.signedXml || null,
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
        restaurant, order, orderItems, menuItemsMap, 'credit_note', originalInvoice, undefined, req.body.reason || 'إلغاء الفاتورة'
      );

      const creditNote = await storage.createInvoice({
        restaurantId,
        branchId: order.branchId || null,
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
        signedXml: zatcaResult.signedXml || null,
        invoiceHash: zatcaResult.invoiceHash,
        previousInvoiceHash: zatcaResult.previousInvoiceHash,
        invoiceCounter: zatcaResult.invoiceCounter,
        uuid: zatcaResult.uuid,
        relatedInvoiceId: originalInvoice.id,
        refundReason: req.body.reason || 'إلغاء الفاتورة',
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
      if (!['sandbox', 'simulation', 'production', 'mock'].includes(environment)) {
        return res.status(400).json({ error: "Invalid environment. Use: sandbox, simulation, production, or mock" });
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

  // ===============================
  // DELIVERY PLATFORM INTEGRATION ROUTES
  // ===============================

  // --- Delivery Integrations CRUD ---

  // Get all delivery integrations for the restaurant
  app.get("/api/delivery/integrations", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const branchId = req.query.branchId as string | undefined;
      const integrations = await storage.getDeliveryIntegrations(restaurantId, branchId);
      // Hide sensitive fields from response
      const safe = integrations.map(i => ({
        ...i,
        clientSecret: i.clientSecret ? "••••••••" : null,
        accessToken: undefined,
        tokenExpiresAt: undefined,
      }));
      res.json(safe);
    } catch (error: any) {
      handleRouteError(res, error, "Failed to fetch delivery integrations");
    }
  });

  // Get single delivery integration
  app.get("/api/delivery/integrations/:id", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const integration = await storage.getDeliveryIntegration(req.params.id);
      if (!integration || integration.restaurantId !== restaurantId) {
        return res.status(404).json({ error: "Integration not found" });
      }
      res.json({
        ...integration,
        clientSecret: integration.clientSecret ? "••••••••" : null,
        accessToken: undefined,
        tokenExpiresAt: undefined,
      });
    } catch (error: any) {
      handleRouteError(res, error, "Failed to fetch delivery integration");
    }
  });

  // Create delivery integration
  app.post("/api/delivery/integrations", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const data = {
        ...req.body,
        restaurantId,
      };
      const integration = await storage.createDeliveryIntegration(data);
      res.status(201).json(integration);
    } catch (error: any) {
      handleRouteError(res, error, "Failed to create delivery integration");
    }
  });

  // Update delivery integration
  app.put("/api/delivery/integrations/:id", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const existing = await storage.getDeliveryIntegration(req.params.id);
      if (!existing || existing.restaurantId !== restaurantId) {
        return res.status(404).json({ error: "Integration not found" });
      }

      // Don't overwrite secret if masked value sent
      const updateData = { ...req.body };
      if (updateData.clientSecret === "••••••••") {
        delete updateData.clientSecret;
      }

      // Clear token cache if credentials changed
      if (updateData.clientId || updateData.clientSecret) {
        hungerstation.clearTokenCache(existing.id);
        updateData.accessToken = null;
        updateData.tokenExpiresAt = null;
      }

      const updated = await storage.updateDeliveryIntegration(req.params.id, updateData);
      res.json(updated);
    } catch (error: any) {
      handleRouteError(res, error, "Failed to update delivery integration");
    }
  });

  // Delete delivery integration
  app.delete("/api/delivery/integrations/:id", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const existing = await storage.getDeliveryIntegration(req.params.id);
      if (!existing || existing.restaurantId !== restaurantId) {
        return res.status(404).json({ error: "Integration not found" });
      }
      hungerstation.clearTokenCache(existing.id);
      await storage.deleteDeliveryIntegration(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      handleRouteError(res, error, "Failed to delete delivery integration");
    }
  });

  // Test integration connection (validate credentials)
  app.post("/api/delivery/integrations/:id/test", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const integration = await storage.getDeliveryIntegration(req.params.id);
      if (!integration || integration.restaurantId !== restaurantId) {
        return res.status(404).json({ error: "Integration not found" });
      }

      if (integration.platform === "hungerstation") {
        const token = await hungerstation.getAccessToken(integration);
        res.json({ success: true, message: "Connection successful", hasToken: !!token });
      } else if (integration.platform === "jahez") {
        // Test Jahez connection by trying to register webhooks
        // This verifies the API base URL and auth token
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        try {
          await jahez.registerCreateOrderWebhook(integration, `${baseUrl}/api/webhooks/jahez`);
          await jahez.registerOrderUpdateWebhook(integration, `${baseUrl}/api/webhooks/jahez/update`);
          res.json({ success: true, message: "Jahez connection successful, webhooks registered" });
        } catch (err: any) {
          res.json({ success: false, message: `Jahez connection failed: ${err.message}` });
        }
      } else {
        res.json({ success: false, message: `Platform ${integration.platform} not yet supported` });
      }
    } catch (error: any) {
      res.json({ success: false, message: error.message || "Connection failed" });
    }
  });

  // Get outlet status from HungerStation
  app.get("/api/delivery/integrations/:id/outlet-status", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const integration = await storage.getDeliveryIntegration(req.params.id);
      if (!integration || integration.restaurantId !== restaurantId) {
        return res.status(404).json({ error: "Integration not found" });
      }

      if (integration.platform === "hungerstation") {
        const result = await hungerstation.getOutletStatus(integration);
        res.json(result);
      } else {
        res.json({ vendor_id: integration.vendorId, status: integration.outletStatus === "open" ? "OPEN" : "CLOSED" });
      }
    } catch (error: any) {
      handleRouteError(res, error, "Failed to get outlet status");
    }
  });

  // Toggle outlet status (open/close) — supports HungerStation advanced statuses
  app.put("/api/delivery/integrations/:id/status", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const integration = await storage.getDeliveryIntegration(req.params.id);
      if (!integration || integration.restaurantId !== restaurantId) {
        return res.status(404).json({ error: "Integration not found" });
      }

      const { status, closed_reason, closed_until } = req.body;
      
      // Accept both simple (open/closed) and HungerStation-specific statuses
      const validStatuses = ["open", "closed", "OPEN", "CLOSED_TODAY", "CLOSED_UNTIL", "CHECKIN"];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid status. Use: open, closed, OPEN, CLOSED_TODAY, CLOSED_UNTIL, CHECKIN" });
      }

      if (integration.platform === "hungerstation") {
        try {
          await hungerstation.updateOutletStatus(integration, status, closed_reason, closed_until);
        } catch (apiError: any) {
          console.error(`[Delivery] Failed to update HungerStation outlet status:`, apiError.message);
          // Still update locally even if API call fails
        }
      }

      // Normalize to local status
      const localStatus = (status === "open" || status === "OPEN") ? "open" : "closed";
      const updated = await storage.updateDeliveryIntegration(req.params.id, { outletStatus: localStatus } as any);
      res.json(updated);
    } catch (error: any) {
      handleRouteError(res, error, "Failed to update outlet status");
    }
  });

  // --- Delivery Orders ---

  // Get delivery orders
  app.get("/api/delivery/orders", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const branchId = req.query.branchId as string | undefined;
      const orders = await storage.getDeliveryOrders(restaurantId, branchId);
      res.json(orders);
    } catch (error: any) {
      handleRouteError(res, error, "Failed to fetch delivery orders");
    }
  });

  // Get single delivery order
  app.get("/api/delivery/orders/:id", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const order = await storage.getDeliveryOrder(req.params.id);
      if (!order || order.restaurantId !== restaurantId) {
        return res.status(404).json({ error: "Delivery order not found" });
      }
      res.json(order);
    } catch (error: any) {
      handleRouteError(res, error, "Failed to fetch delivery order");
    }
  });

  // Helper: Full delivery order acceptance — creates POS order + items + invoice + day session
  async function acceptDeliveryOrderFull(
    restaurantId: string,
    deliveryOrder: any,
    integration: any
  ): Promise<{ posOrder: any; deliveryOrderUpdated: any }> {
    const platformRaw = (deliveryOrder.platform || 'delivery').toLowerCase();
    const platformShort = platformRaw.toUpperCase().slice(0, 2) || "DL";
    const externalRef = deliveryOrder.orderCode || deliveryOrder.externalOrderId || '';
    const orderNumber = `DEL-${platformShort}-${externalRef.slice(-6) || Date.now().toString().slice(-6)}`;

    // Payment method = platform name (hungerstation, jahez, etc.)
    const paymentMethodName = platformRaw === 'hungerstation' ? 'hungerstation' :
                              platformRaw === 'jahez' ? 'jahez' : platformRaw;

    // 1. Create POS order
    const posOrder = await storage.createOrder({
      restaurantId,
      branchId: deliveryOrder.branchId,
      orderNumber,
      orderType: "delivery",
      status: "confirmed",
      customerName: deliveryOrder.customerName,
      customerPhone: deliveryOrder.customerPhone,
      customerAddress: deliveryOrder.deliveryAddress,
      notes: `[${platformRaw.toUpperCase()}] ${externalRef}`,
      subtotal: String(deliveryOrder.subtotal || "0"),
      deliveryFee: String(deliveryOrder.deliveryFee || "0"),
      discount: String(deliveryOrder.discount || "0"),
      total: String(deliveryOrder.total || "0"),
      paymentMethod: paymentMethodName,
      isPaid: true,
    });

    // 2. Create order items from delivery order items (for kitchen display + invoice)
    const deliveryItems = Array.isArray(deliveryOrder.items) ? deliveryOrder.items : [];
    for (const item of deliveryItems) {
      try {
        const qty = parseInt(String(item.quantity)) || 1;
        const unitPrice = parseFloat(String(item.unitPrice || item.unit_price || 0));
        const totalPrice = parseFloat(String(item.totalPrice || item.total_price || unitPrice * qty));
        await storage.createOrderItem({
          orderId: posOrder.id,
          menuItemId: null, // Delivery items don't map to menu items
          itemName: item.name || item.nameAr || "منتج توصيل",
          quantity: qty,
          unitPrice: unitPrice.toFixed(2),
          totalPrice: totalPrice.toFixed(2),
          notes: item.notes || null,
        });
      } catch (itemErr: any) {
        console.error(`[Delivery] Failed to create order item:`, itemErr.message);
      }
    }

    // 3. Generate ZATCA invoice
    try {
      const restaurant = await storage.getRestaurantById(restaurantId);
      if (restaurant) {
        const isTaxEnabled = restaurant.taxEnabled !== false;
        const taxRate = isTaxEnabled ? 15 : 0;
        const now = new Date();
        const orderBranchId = deliveryOrder.branchId || null;

        // Build ZATCA line items from delivery items
        const xmlItems: ZatcaLineItem[] = deliveryItems.map((item: any, idx: number) => {
          const unitPrice = parseFloat(String(item.unitPrice || item.unit_price || 0));
          const qty = parseInt(String(item.quantity)) || 1;
          const lineTotal = bankersRound(unitPrice * qty);
          const lineTax = bankersRound(lineTotal * (taxRate / 100));
          return {
            id: String(idx + 1),
            nameAr: item.nameAr || item.name || 'منتج توصيل',
            nameEn: item.name || '',
            quantity: qty,
            unitPrice,
            discount: 0,
            taxRate,
            taxAmount: lineTax,
            totalWithTax: bankersRound(lineTotal + lineTax),
            totalWithoutTax: lineTotal,
          };
        });

        // If no items, create a single line item from totals
        if (xmlItems.length === 0) {
          const total = parseFloat(String(deliveryOrder.subtotal || deliveryOrder.total || 0));
          const lineTax = bankersRound(total * (taxRate / 100));
          xmlItems.push({
            id: "1",
            nameAr: `طلب توصيل ${deliveryOrder.platform}`,
            nameEn: `${deliveryOrder.platform} delivery order`,
            quantity: 1,
            unitPrice: total,
            discount: 0,
            taxRate,
            taxAmount: lineTax,
            totalWithTax: bankersRound(total + lineTax),
            totalWithoutTax: bankersRound(total),
          });
        }

        const itemsSubtotal = bankersRound(xmlItems.reduce((sum, i) => sum + i.totalWithoutTax, 0));
        const orderDiscount = parseFloat(String(deliveryOrder.discount || 0));
        const orderDeliveryFee = parseFloat(String(deliveryOrder.deliveryFee || 0));
        const taxableAmt = bankersRound(Math.max(0, itemsSubtotal - orderDiscount + orderDeliveryFee));
        const vatAmount = bankersRound(taxableAmt * (taxRate / 100));
        const invoiceTotal = bankersRound(taxableAmt + vatAmount);

        const { counter: prevCounter, lastHash: prevHash } = await storage.getZatcaCounterAndHash(restaurantId, orderBranchId);
        const currentCounter = prevCounter + 1;
        const previousHash = prevHash ||
          Buffer.from('NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==', 'base64').toString('utf8');

        const uuid = generateInvoiceUuid();
        const invoiceNumber = await storage.getNextInvoiceNumber(restaurantId, orderBranchId);

        const unsignedDeliveryXml = generateZatcaXml({
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
          items: xmlItems,
          subtotal: itemsSubtotal,
          discount: orderDiscount,
          deliveryFee: orderDeliveryFee,
          taxAmount: vatAmount,
          taxRate,
          total: invoiceTotal,
          paymentMethod: paymentMethodName,
          previousInvoiceHash: previousHash,
          invoiceCounter: currentCounter,
        });

        // Resolve signing credentials
        let delPrivKey: string | null = null;
        let delCert: string | null = null;
        if (orderBranchId) {
          const br = await storage.getBranch(orderBranchId);
          if (br && (br as any).zatcaPrivateKey) {
            delPrivKey = (br as any).zatcaPrivateKey;
            delCert = (br as any).zatcaProductionCsid || (br as any).zatcaComplianceCsid || (br as any).zatcaCertificate;
          }
        }
        if (!delPrivKey && (restaurant as any).zatcaPrivateKey) {
          delPrivKey = (restaurant as any).zatcaPrivateKey;
          delCert = restaurant.zatcaProductionCsid || restaurant.zatcaComplianceCsid || restaurant.zatcaCertificate;
        }

        const delSignResult = buildSignedInvoice(
          unsignedDeliveryXml, delPrivKey, delCert,
          {
            sellerName: restaurant.nameAr || restaurant.nameEn || 'مطعم',
            vatNumber: restaurant.vatNumber || '',
            timestamp: now.toISOString(),
            total: invoiceTotal.toFixed(2),
            vatAmount: vatAmount.toFixed(2),
          },
        );

        const xmlContent = delSignResult.finalXml;
        const invoiceHash = delSignResult.invoiceHash;
        const qrData = delSignResult.qrData;

        await storage.createInvoice({
          restaurantId,
          branchId: orderBranchId,
          orderId: posOrder.id,
          invoiceNumber,
          invoiceType: "simplified",
          subtotal: itemsSubtotal.toFixed(2),
          taxRate: taxRate.toFixed(2),
          taxAmount: vatAmount.toFixed(2),
          total: invoiceTotal.toFixed(2),
          qrCodeData: qrData,
          xmlContent,
          invoiceHash,
          previousInvoiceHash: previousHash,
          invoiceCounter: currentCounter,
          uuid,
          status: "issued",
          zatcaStatus: "pending",
          customerName: deliveryOrder.customerName || null,
          customerPhone: deliveryOrder.customerPhone || null,
          paymentMethod: paymentMethodName,
          deliveryFee: (parseFloat(String(deliveryOrder.deliveryFee || 0))).toFixed(2),
          discount: (parseFloat(String(deliveryOrder.discount || 0))).toFixed(2),
          signedXml: delSignResult.signedXml || null,
        });

        await storage.updateZatcaCounterAndHash(restaurantId, orderBranchId, currentCounter, invoiceHash);
        console.log(`[Delivery] Invoice ${invoiceNumber} created for delivery order ${deliveryOrder.orderCode}`);
      }
    } catch (invoiceErr: any) {
      console.error(`[Delivery] Invoice creation failed:`, invoiceErr.message);
    }

    // 4. Update day session totals
    try {
      const currentSession = await storage.getCurrentDaySession(restaurantId, deliveryOrder.branchId || undefined);
      if (currentSession) {
        const orderTotal = parseFloat(posOrder.total || "0");
        await storage.incrementDaySessionTotals(currentSession.id, orderTotal, "card");
      }
    } catch (e: any) {
      console.error(`[Delivery] Day session update failed:`, e.message);
    }

    // 5. Update delivery order link
    const deliveryOrderUpdated = await storage.updateDeliveryOrder(deliveryOrder.id, {
      platformStatus: "accepted",
      orderId: posOrder.id,
      acceptedAt: new Date(),
    } as any);

    return { posOrder, deliveryOrderUpdated };
  }

  // Accept a delivery order (local status only — HungerStation has no "accept" API)
  // Per HungerStation docs: RECEIVED → process order → READY_FOR_PICKUP/DISPATCHED
  app.put("/api/delivery/orders/:id/accept", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const deliveryOrder = await storage.getDeliveryOrder(req.params.id);
      if (!deliveryOrder || deliveryOrder.restaurantId !== restaurantId) {
        return res.status(404).json({ error: "Delivery order not found" });
      }

      if (deliveryOrder.platformStatus !== "new") {
        return res.status(400).json({ error: `Cannot accept order in status: ${deliveryOrder.platformStatus}` });
      }

      const integration = await storage.getDeliveryIntegration(deliveryOrder.integrationId);
      if (!integration) {
        return res.status(400).json({ error: "Integration not found" });
      }

      // Jahez has accept: POST /webhooks/status_update with status "A"
      if (integration.platform === "jahez") {
        try {
          const jahezOrderId = parseInt(deliveryOrder.externalOrderId);
          await jahez.updateOrderStatus(integration, jahezOrderId, "A");
        } catch (apiError: any) {
          console.error(`[Delivery] Jahez accept failed:`, apiError.message);
        }
      }

      // Full acceptance: POS order + items + invoice + day session
      const { posOrder, deliveryOrderUpdated } = await acceptDeliveryOrderFull(restaurantId, deliveryOrder, integration);

      // Create notification
      await storage.createNotification({
        restaurantId,
        branchId: deliveryOrder.branchId,
        type: "order",
        title: `Delivery order accepted`,
        titleAr: `تم قبول طلب التوصيل`,
        message: `Order ${deliveryOrder.orderCode} from ${deliveryOrder.platform} has been accepted`,
        messageAr: `تم قبول الطلب ${deliveryOrder.orderCode} من ${deliveryOrder.platform}`,
        priority: "high",
        referenceType: "order",
        referenceId: posOrder.id,
        targetRole: "kitchen",
      });

      res.json({ deliveryOrder: deliveryOrderUpdated, posOrder });
    } catch (error: any) {
      handleRouteError(res, error, "Failed to accept delivery order");
    }
  });

  // Mark delivery order as ready — this is the actual fulfillment call to HungerStation
  // Docs: PUT /v2/chains/{chain_id}/orders/{order_id} with READY_FOR_PICKUP status
  app.put("/api/delivery/orders/:id/ready", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const deliveryOrder = await storage.getDeliveryOrder(req.params.id);
      if (!deliveryOrder || deliveryOrder.restaurantId !== restaurantId) {
        return res.status(404).json({ error: "Delivery order not found" });
      }

      if (!["accepted", "preparing"].includes(deliveryOrder.platformStatus)) {
        return res.status(400).json({ error: `Cannot mark ready from status: ${deliveryOrder.platformStatus}` });
      }

      const integration = await storage.getDeliveryIntegration(deliveryOrder.integrationId);
      if (integration && integration.platform === "hungerstation") {
        try {
          // Pass raw payload so we can build proper items array
          await hungerstation.markOrderReady(integration, deliveryOrder.externalOrderId, deliveryOrder.rawPayload);
        } catch (apiError: any) {
          console.error(`[Delivery] HungerStation READY_FOR_PICKUP failed:`, apiError.message);
        }
      }

      // Update POS order status too
      if (deliveryOrder.orderId) {
        await storage.updateOrderStatus(deliveryOrder.orderId, "ready");
      }

      const updated = await storage.updateDeliveryOrderStatus(req.params.id, "ready");
      res.json(updated);
    } catch (error: any) {
      handleRouteError(res, error, "Failed to mark delivery order ready");
    }
  });

  // Reject/cancel a delivery order
  // HungerStation: PUT /v2/chains/{chain_id}/orders/{order_id} with CANCELLED status — reasons: CLOSED, ITEM_UNAVAILABLE, TOO_BUSY
  // Jahez: POST /webhooks/status_update with status "R" + reason message
  app.put("/api/delivery/orders/:id/reject", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const deliveryOrder = await storage.getDeliveryOrder(req.params.id);
      if (!deliveryOrder || deliveryOrder.restaurantId !== restaurantId) {
        return res.status(404).json({ error: "Delivery order not found" });
      }

      const reasonInput = req.body.reason || "TOO_BUSY";

      const integration = await storage.getDeliveryIntegration(deliveryOrder.integrationId);
      if (integration && integration.platform === "hungerstation") {
        const validReasons = ["CLOSED", "ITEM_UNAVAILABLE", "TOO_BUSY"];
        const cancelReason = validReasons.includes(reasonInput) ? reasonInput : "TOO_BUSY";
        try {
          await hungerstation.cancelOrder(integration, deliveryOrder.externalOrderId, cancelReason as any, deliveryOrder.rawPayload);
        } catch (apiError: any) {
          console.error(`[Delivery] HungerStation cancel failed:`, apiError.message);
        }
      } else if (integration && integration.platform === "jahez") {
        try {
          const jahezOrderId = parseInt(deliveryOrder.externalOrderId);
          await jahez.updateOrderStatus(integration, jahezOrderId, "R", reasonInput);
        } catch (apiError: any) {
          console.error(`[Delivery] Jahez reject failed:`, apiError.message);
        }
      }

      // Cancel POS order if exists
      if (deliveryOrder.orderId) {
        await storage.updateOrderStatus(deliveryOrder.orderId, "cancelled");
      }

      const updated = await storage.updateDeliveryOrder(req.params.id, {
        platformStatus: "cancelled",
        cancelReason: cancelReason,
        cancelledAt: new Date(),
      } as any);

      res.json(updated);
    } catch (error: any) {
      handleRouteError(res, error, "Failed to reject delivery order");
    }
  });

  // --- Webhooks (No auth required from Express perspective) ---

  // HungerStation webhook - receives order payload directly
  // Per docs: The webhook receives the full order payload with a 'status' field
  // Statuses: RECEIVED, READY_FOR_PICKUP, DISPATCHED, CANCELLED, DELIVERED
  // The platform retries up to 5 times (10s apart) if no response within 10s
  // We must handle duplicate payloads (idempotency)
  app.post("/api/webhooks/hungerstation", async (req, res) => {
    try {
      const payload = req.body;
      console.log(`[Webhook] HungerStation: ${payload?.status || "unknown"} order=${payload?.order_id || "?"} store=${payload?.client?.store_id || "?"}`);
      
      // Per docs: webhook payload IS the order object directly
      // Key fields: order_id, status, client.store_id, client.chain_id
      const orderStatus = payload.status;
      const orderId = payload.order_id;
      
      if (!orderId) {
        console.error("[Webhook] HungerStation: No order_id in payload");
        return res.status(200).json({ received: true }); // Always 200 to prevent retries
      }

      // Find integration by store_id (or external_partner_config_id)
      // Per docs: client.store_id identifies the vendor/store
      const client = payload.client || {};
      const storeId = client.store_id || client.external_partner_config_id || client.id;
      if (!storeId) {
        console.error("[Webhook] HungerStation: No store_id in payload.client");
        return res.status(200).json({ received: true });
      }

      const integration = await storage.getDeliveryIntegrationByVendor("hungerstation", String(storeId));
      if (!integration) {
        console.error(`[Webhook] HungerStation: No integration found for store ${storeId}`);
        return res.status(200).json({ received: true });
      }

      // Validate webhook authorization (secret)
      // Per docs: Secret is configured in Partner Portal, sent as Authorization header
      const authHeader = req.headers.authorization;
      if (!hungerstation.validateWebhookAuth(authHeader as string, integration)) {
        console.error(`[Webhook] HungerStation: Invalid authorization for store ${storeId}`);
        return res.status(200).json({ received: true }); // Still 200 per best practice
      }

      // Handle based on order status (not event type)
      // Per docs: RECEIVED → READY_FOR_PICKUP → DISPATCHED → DELIVERED (or CANCELLED)
      if (orderStatus === "RECEIVED") {
        // New order received
        const parsed = hungerstation.parseHungerStationOrder(payload);

        // Idempotency check — handle duplicate webhook deliveries
        const existing = await storage.getDeliveryOrderByExternalId("hungerstation", parsed.externalOrderId);
        if (existing) {
          console.log(`[Webhook] HungerStation: Duplicate order ${parsed.externalOrderId}, skipping`);
          return res.status(200).json({ received: true });
        }

        // Create delivery order
        const deliveryOrder = await storage.createDeliveryOrder({
          restaurantId: integration.restaurantId,
          branchId: integration.branchId,
          integrationId: integration.id,
          platform: "hungerstation",
          externalOrderId: parsed.externalOrderId,
          orderCode: parsed.orderCode,
          platformStatus: "new",
          transportType: parsed.transportType,
          rawPayload: payload, // Store full payload for later use (fulfillment items)
          customerName: parsed.customerName,
          customerPhone: parsed.customerPhone,
          deliveryAddress: parsed.deliveryAddress,
          deliveryLat: parsed.deliveryLat,
          deliveryLng: parsed.deliveryLng,
          subtotal: parsed.subtotal,
          deliveryFee: parsed.deliveryFee,
          discount: parsed.discount,
          total: parsed.total,
          items: parsed.items,
          estimatedDeliveryTime: parsed.estimatedDeliveryTime,
        });

        // Create notification for new delivery order
        await storage.createNotification({
          restaurantId: integration.restaurantId,
          branchId: integration.branchId,
          type: "order",
          title: `New HungerStation Order`,
          titleAr: `طلب جديد من هنقرستيشن`,
          message: `New order ${parsed.orderCode} - ${parsed.total} SAR from ${parsed.customerName}`,
          messageAr: `طلب جديد ${parsed.orderCode} - ${parsed.total} ريال من ${parsed.customerName}`,
          priority: "urgent",
          referenceType: "order",
          referenceId: deliveryOrder.id,
          targetRole: "all",
        });

        // Auto-accept if configured — full flow with items + invoice + day session
        if (integration.autoAccept) {
          try {
            await acceptDeliveryOrderFull(integration.restaurantId, deliveryOrder, integration);
            console.log(`[Webhook] HungerStation: Order ${parsed.orderCode} auto-accepted`);
          } catch (autoErr: any) {
            console.error(`[Webhook] Auto-accept failed:`, autoErr.message);
          }
        }

        console.log(`[Webhook] HungerStation: Order ${parsed.orderCode} RECEIVED, id=${deliveryOrder.id}`);

      } else if (orderStatus === "CANCELLED") {
        // Order cancelled by customer, logistics, or platform
        const existing = await storage.getDeliveryOrderByExternalId("hungerstation", String(orderId));
        if (existing) {
          const cancellation = payload.cancellation || {};
          const cancelReason = cancellation.reason || "Cancelled by platform";
          const postPickup = cancellation.post_picked_up === true;
          
          await storage.updateDeliveryOrder(existing.id, {
            platformStatus: "cancelled",
            cancelReason: `${cancelReason}${postPickup ? " (after rider pickup)" : ""}`,
            cancelledAt: new Date(),
          } as any);
          if (existing.orderId) {
            await storage.updateOrderStatus(existing.orderId, "cancelled");
          }
          console.log(`[Webhook] HungerStation: Order ${orderId} CANCELLED (${cancelReason})${postPickup ? " [post pickup]" : ""}`);
        }

      } else if (orderStatus === "READY_FOR_PICKUP") {
        // Confirmation that order was fulfilled (our PUT was successful)
        const existing = await storage.getDeliveryOrderByExternalId("hungerstation", String(orderId));
        if (existing) {
          await storage.updateDeliveryOrderStatus(existing.id, "ready");
          console.log(`[Webhook] HungerStation: Order ${orderId} READY_FOR_PICKUP confirmed`);
        }

      } else if (orderStatus === "DISPATCHED") {
        // Rider picked up the order (Platform Delivery) or vendor dispatched (Vendor Delivery)
        const existing = await storage.getDeliveryOrderByExternalId("hungerstation", String(orderId));
        if (existing) {
          await storage.updateDeliveryOrder(existing.id, {
            platformStatus: "picked_up",
            pickedUpAt: new Date(),
          } as any);
          console.log(`[Webhook] HungerStation: Order ${orderId} DISPATCHED`);
        }

      } else if (orderStatus === "DELIVERED") {
        // Order delivered to customer (Platform Delivery flow — may have ~30min delay)
        const existing = await storage.getDeliveryOrderByExternalId("hungerstation", String(orderId));
        if (existing) {
          await storage.updateDeliveryOrderStatus(existing.id, "delivered");
          if (existing.orderId) {
            await storage.updateOrderStatus(existing.orderId, "completed");
          }
          console.log(`[Webhook] HungerStation: Order ${orderId} DELIVERED`);
        }
      } else {
        console.log(`[Webhook] HungerStation: Unhandled order status "${orderStatus}" for order ${orderId}`);
      }

      res.status(200).json({ received: true });
    } catch (error: any) {
      console.error("[Webhook] HungerStation error:", error.message);
      res.status(200).json({ received: true }); // Always 200 for webhooks
    }
  });

  // ============================================
  // Jahez webhook — CREATE ORDER
  // Jahez calls this endpoint to create a new order
  // Expected response within 2 seconds, status 200
  // ============================================
  app.post("/api/webhooks/jahez", async (req, res) => {
    try {
      console.log("[Webhook] Jahez create order incoming:", JSON.stringify(req.body).slice(0, 500));

      const payload = req.body;
      const jahezId = payload.jahez_id;
      const branchId = payload.branch_id;

      if (!jahezId) {
        console.error("[Webhook] Jahez: No jahez_id in payload");
        return res.status(200).json({ success: true });
      }

      // Find integration by branch_id (vendorId stores the Jahez branch mapping)
      // Try multiple strategies to match the integration
      let integration: DeliveryIntegration | null = null;
      
      // Strategy 1: Match by vendorId (stores the Jahez branch_id)
      if (branchId) {
        const integrations = await storage.getDeliveryIntegrations("", undefined);
        integration = integrations.find(
          (i: any) => i.platform === "jahez" && i.isActive && 
            (i.vendorId === branchId || i.branchId === branchId)
        ) || null;
      }
      
      // Strategy 2: Find any active Jahez integration
      if (!integration) {
        const integrations = await storage.getDeliveryIntegrations("", undefined);
        integration = integrations.find(
          (i: any) => i.platform === "jahez" && i.isActive
        ) || null;
      }

      if (!integration) {
        console.error(`[Webhook] Jahez: No active integration found for branch ${branchId}`);
        return res.status(200).json({ success: true });
      }

      // Validate webhook auth
      const authHeader = req.headers.authorization;
      if (!jahez.validateJahezWebhook(authHeader as string, integration)) {
        console.error(`[Webhook] Jahez: Invalid authorization`);
        return res.status(200).json({ success: true });
      }

      // Parse the order
      const parsed = jahez.parseJahezOrder(payload);

      // Check for duplicate (idempotency)
      const existing = await storage.getDeliveryOrderByExternalId("jahez", String(jahezId));
      if (existing) {
        console.log(`[Webhook] Jahez: Duplicate order ${jahezId}, skipping`);
        return res.status(200).json({ success: true });
      }

      // Try to resolve product names from our DB
      const resolvedItems = await Promise.all(
        parsed.items.map(async (item) => {
          if (item.productId) {
            try {
              const menuItems = await storage.getMenuItems(integration!.restaurantId);
              const found = menuItems.find((mi: any) => mi.id === item.productId || mi.nameEn === item.productId);
              if (found) {
                return {
                  ...item,
                  name: found.nameEn || found.nameAr || item.name,
                  nameAr: found.nameAr,
                };
              }
            } catch (e) {
              // ignore
            }
          }
          return item;
        })
      );

      // Create delivery order
      const deliveryOrder = await storage.createDeliveryOrder({
        restaurantId: integration.restaurantId,
        branchId: integration.branchId,
        integrationId: integration.id,
        platform: "jahez",
        externalOrderId: String(jahezId),
        orderCode: `JZ-${jahezId}`,
        platformStatus: "new",
        transportType: "delivery",
        rawPayload: payload,
        customerName: parsed.customerName,
        customerPhone: parsed.customerPhone,
        deliveryAddress: parsed.deliveryAddress,
        subtotal: parsed.subtotal,
        deliveryFee: parsed.deliveryFee,
        discount: parsed.discount,
        total: parsed.total,
        items: resolvedItems,
      });

      // Create notification
      await storage.createNotification({
        restaurantId: integration.restaurantId,
        branchId: integration.branchId,
        type: "order",
        title: `New Jahez Order`,
        titleAr: `طلب جديد من جاهز`,
        message: `New order JZ-${jahezId} - ${parsed.total} SAR (${parsed.paymentMethod})`,
        messageAr: `طلب جديد JZ-${jahezId} - ${parsed.total} ريال (${parsed.paymentMethod})`,
        priority: "urgent",
        referenceType: "order",
        referenceId: deliveryOrder.id,
        targetRole: "all",
      });

      // Auto-accept if configured — full flow with items + invoice + day session
      // IMPORTANT: Jahez orders must be accepted within 5 minutes
      if (integration.autoAccept) {
        try {
          await jahez.updateOrderStatus(integration, jahezId, "A");
          await acceptDeliveryOrderFull(integration.restaurantId, deliveryOrder, integration);
          console.log(`[Webhook] Jahez: Order ${jahezId} auto-accepted`);
        } catch (autoErr: any) {
          console.error(`[Webhook] Jahez auto-accept failed:`, autoErr.message);
        }
      }

      console.log(`[Webhook] Jahez: Order ${jahezId} created, id=${deliveryOrder.id}`);
      
      // MUST respond within 2 seconds with status 200
      res.status(200).json({ success: true });
    } catch (error: any) {
      console.error("[Webhook] Jahez create order error:", error.message);
      res.status(200).json({ success: true });
    }
  });

  // ============================================
  // Jahez webhook — ORDER UPDATE EVENT
  // Jahez calls this when order status changes (payment, delivery status, etc.)
  // Payload: { event, jahezOrderId, payment_method, status }
  // ============================================
  app.post("/api/webhooks/jahez/update", async (req, res) => {
    try {
      console.log("[Webhook] Jahez order update:", JSON.stringify(req.body).slice(0, 500));

      const { jahezOrderId, status, payment_method } = req.body;

      if (!jahezOrderId) {
        console.error("[Webhook] Jahez update: No jahezOrderId");
        return res.status(200).json({ success: true });
      }

      const existing = await storage.getDeliveryOrderByExternalId("jahez", String(jahezOrderId));
      if (!existing) {
        console.error(`[Webhook] Jahez update: Order ${jahezOrderId} not found`);
        return res.status(200).json({ success: true });
      }

      const newStatus = jahez.mapJahezStatus(status);

      if (status === "O") {
        // Out for delivery — rider picked up
        await storage.updateDeliveryOrder(existing.id, {
          platformStatus: "picked_up",
          pickedUpAt: new Date(),
        } as any);
        console.log(`[Webhook] Jahez: Order ${jahezOrderId} out for delivery`);

      } else if (status === "D") {
        // Delivered
        await storage.updateDeliveryOrderStatus(existing.id, "delivered");
        if (existing.orderId) {
          await storage.updateOrderStatus(existing.orderId, "completed");
        }
        console.log(`[Webhook] Jahez: Order ${jahezOrderId} delivered`);

      } else if (status === "C") {
        // Cancelled
        await storage.updateDeliveryOrder(existing.id, {
          platformStatus: "cancelled",
          cancelReason: "Cancelled by Jahez/Customer",
          cancelledAt: new Date(),
        } as any);
        if (existing.orderId) {
          await storage.updateOrderStatus(existing.orderId, "cancelled");
        }
        console.log(`[Webhook] Jahez: Order ${jahezOrderId} cancelled`);

      } else if (status === "T") {
        // Timed-out
        await storage.updateDeliveryOrder(existing.id, {
          platformStatus: "cancelled",
          cancelReason: "Timed out - not accepted within 5 minutes",
          cancelledAt: new Date(),
        } as any);
        if (existing.orderId) {
          await storage.updateOrderStatus(existing.orderId, "cancelled");
        }
        console.log(`[Webhook] Jahez: Order ${jahezOrderId} timed out`);

      } else {
        console.log(`[Webhook] Jahez: Order ${jahezOrderId} status update to "${status}" (${newStatus})`);
        if (newStatus !== existing.platformStatus) {
          await storage.updateDeliveryOrderStatus(existing.id, newStatus);
        }
      }

      // Update payment method if changed (e.g., CASH → MADA)
      if (payment_method && payment_method !== "CASH") {
        // Payment method changed — update POS order if exists
        console.log(`[Webhook] Jahez: Order ${jahezOrderId} payment changed to ${payment_method}`);
      }

      res.status(200).json({ success: true });
    } catch (error: any) {
      console.error("[Webhook] Jahez update error:", error.message);
      res.status(200).json({ success: true });
    }
  });

  // ============================================
  // ============================================
  // Menu Sync Routes (authenticated) — Jahez & HungerStation
  // ============================================

  // Sync full menu to delivery platform (Jahez: categories + products, HungerStation: update products)
  app.post("/api/delivery/integrations/:id/sync-menu", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const integration = await storage.getDeliveryIntegration(req.params.id);
      if (!integration || integration.restaurantId !== restaurantId) {
        return res.status(404).json({ error: "Integration not found" });
      }

      // Get categories and menu items
      const categories = await storage.getCategories(restaurantId);
      const menuItems = await storage.getMenuItems(restaurantId);

      if (integration.platform === "jahez") {
        // Jahez: Sync categories + products via dedicated APIs
        const jahezCategories = categories.map((cat: any, index: number) => ({
          category_id: cat.id,
          name: {
            ar: cat.nameAr || cat.name || "",
            en: cat.name || cat.nameEn || "",
          },
          index: cat.sortOrder || index + 1,
        }));

        if (jahezCategories.length > 0) {
          await jahez.syncCategoriesBulk(integration, jahezCategories);
        }

        const jahezProducts = menuItems
          .filter((item: any) => item.isAvailable !== false)
          .map((item: any, index: number) => ({
            product_id: item.id,
            product_price: parseFloat(item.price) || 0,
            category_id: item.categoryId || "",
            name: {
              ar: item.nameAr || item.nameEn || "",
              en: item.nameEn || item.nameAr || "",
            },
            description: {
              ar: item.descriptionAr || item.descriptionEn || "",
              en: item.descriptionEn || item.descriptionAr || "",
            },
            image_path: item.image || "",
            index: item.sortOrder || index + 1,
            calories: item.calories || 0,
            is_visible: item.isAvailable !== false,
          }));

        if (jahezProducts.length > 0) {
          await jahez.syncProductsBulk(integration, jahezProducts);
        }

        await storage.updateDeliveryIntegration(integration.id, {
          lastSyncAt: new Date(),
        } as any);

        res.json({
          success: true,
          platform: "jahez",
          synced: { categories: jahezCategories.length, products: jahezProducts.length },
        });

      } else if (integration.platform === "hungerstation") {
        // HungerStation: Update products via Catalog API (price + active status)
        // Uses item.id as SKU
        const hsProducts = menuItems.map((item: any) => ({
          sku: item.id,
          price: parseFloat(item.price) || 0,
          active: item.isAvailable !== false,
        }));

        let jobId = null;
        if (hsProducts.length > 0) {
          const result = await hungerstation.updateProducts(integration, hsProducts);
          jobId = result?.job_id;
        }

        await storage.updateDeliveryIntegration(integration.id, {
          lastSyncAt: new Date(),
        } as any);

        res.json({
          success: true,
          platform: "hungerstation",
          synced: { products: hsProducts.length },
          job_id: jobId,
        });

      } else {
        return res.status(400).json({ error: `Menu sync not supported for ${integration.platform}` });
      }
    } catch (error: any) {
      handleRouteError(res, error, "Failed to sync menu");
    }
  });

  // Retrieve products from HungerStation catalog
  app.get("/api/delivery/integrations/:id/catalog", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const integration = await storage.getDeliveryIntegration(req.params.id);
      if (!integration || integration.restaurantId !== restaurantId) {
        return res.status(404).json({ error: "Integration not found" });
      }

      if (integration.platform === "hungerstation") {
        const result = await hungerstation.getProducts(integration, {
          queryTerm: req.query.query as string,
          locale: req.query.locale as string || "ar_SA",
          page: req.query.page ? parseInt(req.query.page as string) : 1,
          pageSize: req.query.page_size ? parseInt(req.query.page_size as string) : 50,
          isActive: req.query.is_active !== undefined ? req.query.is_active === "true" : undefined,
        });
        res.json(result);
      } else {
        return res.status(400).json({ error: "Catalog retrieval only supported for HungerStation" });
      }
    } catch (error: any) {
      handleRouteError(res, error, "Failed to retrieve catalog");
    }
  });

  // Get HungerStation vendor categories
  app.get("/api/delivery/integrations/:id/categories", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const integration = await storage.getDeliveryIntegration(req.params.id);
      if (!integration || integration.restaurantId !== restaurantId) {
        return res.status(404).json({ error: "Integration not found" });
      }

      if (integration.platform === "hungerstation") {
        const onlyLeaves = req.query.only_leaves !== "false";
        const result = await hungerstation.getVendorCategories(integration, onlyLeaves);
        res.json(result);
      } else {
        return res.status(400).json({ error: "Category retrieval only supported for HungerStation" });
      }
    } catch (error: any) {
      handleRouteError(res, error, "Failed to retrieve categories");
    }
  });

  // Export HungerStation product catalog (async, results sent to webhook)
  app.post("/api/delivery/integrations/:id/export-catalog", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const integration = await storage.getDeliveryIntegration(req.params.id);
      if (!integration || integration.restaurantId !== restaurantId) {
        return res.status(404).json({ error: "Integration not found" });
      }

      if (integration.platform === "hungerstation") {
        const result = await hungerstation.exportProducts(integration);
        res.json({ success: true, ...result });
      } else {
        return res.status(400).json({ error: "Catalog export only supported for HungerStation" });
      }
    } catch (error: any) {
      handleRouteError(res, error, "Failed to export catalog");
    }
  });

  // Check job status for HungerStation async operations (catalog + promotion)
  app.get("/api/delivery/integrations/:id/jobs/:jobId", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const integration = await storage.getDeliveryIntegration(req.params.id);
      if (!integration || integration.restaurantId !== restaurantId) {
        return res.status(404).json({ error: "Integration not found" });
      }

      if (integration.platform === "hungerstation") {
        const result = await hungerstation.getJobStatus(integration, req.params.jobId);
        res.json(result);
      } else {
        return res.status(400).json({ error: "Job status only supported for HungerStation" });
      }
    } catch (error: any) {
      handleRouteError(res, error, "Failed to get job status");
    }
  });

  // ============================================
  // HungerStation Promotion API
  // ============================================

  // Create or update a promotion on HungerStation
  app.put("/api/delivery/integrations/:id/promotion", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const integration = await storage.getDeliveryIntegration(req.params.id);
      if (!integration || integration.restaurantId !== restaurantId) {
        return res.status(404).json({ error: "Integration not found" });
      }

      if (integration.platform !== "hungerstation") {
        return res.status(400).json({ error: "Promotions only supported for HungerStation" });
      }

      const { vendors, type, active, reason, display_name, limits, conditions, discount } = req.body;
      
      if (!vendors || !type || !conditions || !discount) {
        return res.status(400).json({ error: "Missing required fields: vendors, type, conditions, discount" });
      }

      const result = await hungerstation.managePromotion(integration, {
        vendors,
        type,
        active,
        reason,
        display_name,
        limits,
        conditions,
        discount,
      });

      res.json({ success: true, ...result });
    } catch (error: any) {
      handleRouteError(res, error, "Failed to manage promotion");
    }
  });

  // Get promotion job status from HungerStation
  app.get("/api/delivery/integrations/:id/promotion/jobs/:jobId", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const integration = await storage.getDeliveryIntegration(req.params.id);
      if (!integration || integration.restaurantId !== restaurantId) {
        return res.status(404).json({ error: "Integration not found" });
      }

      if (integration.platform !== "hungerstation") {
        return res.status(400).json({ error: "Promotion status only supported for HungerStation" });
      }

      const result = await hungerstation.getPromotionStatus(integration, req.params.jobId);
      res.json(result);
    } catch (error: any) {
      handleRouteError(res, error, "Failed to get promotion status");
    }
  });

  // ============================================
  // HungerStation Order Cart Update (item modifications)
  // ============================================

  // Update order items (UPDATE_CART) on HungerStation — for item modifications
  app.put("/api/delivery/orders/:id/update-cart", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const deliveryOrder = await storage.getDeliveryOrder(req.params.id);
      if (!deliveryOrder || deliveryOrder.restaurantId !== restaurantId) {
        return res.status(404).json({ error: "Delivery order not found" });
      }

      const integration = await storage.getDeliveryIntegration(deliveryOrder.integrationId);
      if (!integration) {
        return res.status(400).json({ error: "Integration not found" });
      }

      if (integration.platform !== "hungerstation") {
        return res.status(400).json({ error: "Cart update only supported for HungerStation" });
      }

      const { items } = req.body;
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Items array is required" });
      }

      const result = await hungerstation.updateOrderCart(
        integration,
        deliveryOrder.externalOrderId,
        items
      );

      res.json({ success: true, result });
    } catch (error: any) {
      handleRouteError(res, error, "Failed to update order cart");
    }
  });

  // Register Jahez webhooks
  app.post("/api/delivery/integrations/:id/register-webhooks", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const integration = await storage.getDeliveryIntegration(req.params.id);
      if (!integration || integration.restaurantId !== restaurantId) {
        return res.status(404).json({ error: "Integration not found" });
      }

      if (integration.platform !== "jahez") {
        return res.status(400).json({ error: "Webhook registration only for Jahez" });
      }

      const baseUrl = req.body.baseUrl || `${req.protocol}://${req.get("host")}`;
      
      await jahez.registerCreateOrderWebhook(integration, `${baseUrl}/api/webhooks/jahez`);
      await jahez.registerOrderUpdateWebhook(integration, `${baseUrl}/api/webhooks/jahez/update`);

      res.json({ success: true, message: "Webhooks registered successfully" });
    } catch (error: any) {
      handleRouteError(res, error, "Failed to register Jahez webhooks");
    }
  });

  // Day Sessions - Track daily operations
  app.get("/api/day-sessions", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const branchId = req.query.branch as string | undefined;
      const sessions = await storage.getDaySessions(restaurantId, branchId);
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ error: "Failed to get day sessions" });
    }
  });

  app.get("/api/day-sessions/current", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const branchId = req.query.branch as string | undefined;
      const session = await storage.getCurrentDaySession(restaurantId, branchId);
      res.json(session || { error: "No active session" });
    } catch (error) {
      res.status(500).json({ error: "Failed to get current day session" });
    }
  });

  app.post("/api/day-sessions", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const branchId = req.query.branch as string | undefined;
      const user = await getAuthenticatedUser(req);

      // Check if already open today
      const existing = await storage.getCurrentDaySession(restaurantId, branchId);
      if (existing && !existing.isClosed) {
        return res.status(409).json({ error: "A day session is already open today", session: existing });
      }

      const session = await storage.openDaySession({
        restaurantId,
        branchId: branchId || undefined,
        sessionDate: new Date(),
      });

      res.status(201).json(session);
    } catch (error: any) {
      res.status(400).json({ error: "Failed to open day session", details: error?.message });
    }
  });

  app.put("/api/day-sessions/:id/close", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const user = await getAuthenticatedUser(req);
      const { notes } = req.body;

      const session = await storage.getDaySession(req.params.id);
      if (!session || session.restaurantId !== restaurantId) {
        return res.status(404).json({ error: "Day session not found" });
      }

      // Archive all open orders from this session
      if (!session.isClosed) {
        const orders = await storage.getOrders(restaurantId, session.branchId);
        const today = new Date();
        const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        for (const order of orders) {
          const orderDate = new Date(order.createdAt);
          const orderDateOnly = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate());

          // Only archive orders from this day session
          if (orderDateOnly.getTime() === todayOnly.getTime()) {
            try {
              // Mark as archived in orders table
              await db
                .update(orders as any)
                .set({ isArchived: true })
                .where(eq((orders as any).id, order.id))
                .execute();
            } catch (e) {
              console.error(`Failed to archive order ${order.id}:`, e);
            }
          }
        }
      }

      const closed = await storage.closeDaySession(req.params.id, {
        closedBy: user.name || user.email,
        notes,
      });

      res.json(closed);
    } catch (error: any) {
      res.status(400).json({ error: "Failed to close day session", details: error?.message });
    }
  });

  // Generic webhook endpoint for future platforms
  app.post("/api/webhooks/:platform", async (req, res) => {
    console.log(`[Webhook] ${req.params.platform} incoming (not yet implemented)`);
    res.status(200).json({ received: true });
  });

  return httpServer;
}

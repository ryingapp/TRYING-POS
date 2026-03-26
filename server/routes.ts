import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { sql, eq, inArray, and } from "drizzle-orm";
import { 
  orders as ordersTable,
  insertLoyaltyTransactionSchema 
} from "@shared/schema";
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
import { wsManager } from "./websocket";
import {
  validatePhoneNumber,
  validateEmail,
  validatePrice,
  validateQuantity,
  normalizeMobilePhone,
  normalizeEmail,
} from "./validators";

const JWT_SECRET =
  process.env.JWT_SECRET ||
  (() => {
    console.warn(
      "⚠️  JWT_SECRET not set! Using random secret. All tokens will be invalidated on restart.",
    );
    return "change-me-in-production-" + crypto.randomBytes(32).toString("hex");
  })();
const JWT_EXPIRES_IN = "7d";

// Platform admin email - this account gets platform_admin role automatically
const PLATFORM_ADMIN_EMAIL = "cto@tryingapp.com";

function signToken(payload: { userId: string; restaurantId: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// In-memory login rate limiter (prevents brute-force attacks)
// Only counts FAILED attempts — successful logins reset the counter
const _loginAttempts = new Map<string, { count: number; firstAttempt: number }>();
const _LOGIN_RATE_LIMIT = 10; // max failed attempts per window
const _LOGIN_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

function isLoginRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = _loginAttempts.get(ip);
  if (!entry || now - entry.firstAttempt > _LOGIN_WINDOW_MS) return false;
  return entry.count >= _LOGIN_RATE_LIMIT;
}

function recordFailedLogin(ip: string): void {
  const now = Date.now();
  const entry = _loginAttempts.get(ip);
  if (!entry || now - entry.firstAttempt > _LOGIN_WINDOW_MS) {
    _loginAttempts.set(ip, { count: 1, firstAttempt: now });
  } else {
    entry.count++;
  }
}

function resetLoginAttempts(ip: string): void {
  _loginAttempts.delete(ip);
}

function verifyToken(token: string): { userId: string; restaurantId: string } {
  return jwt.verify(token, JWT_SECRET) as {
    userId: string;
    restaurantId: string;
  };
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
  customers,
  orderItems as orderItemsTable,
  menuItems as menuItemsTable,
  recipes as recipesTable,
  inventoryItems as inventoryItemsTable,
  inventoryTransactions as inventoryTransactionsTable,
  tables as tablesTable,
  orderAuditLog as orderAuditLogTable,
  invoiceAuditLog as invoiceAuditLogTable,
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
    const restaurant = await storage.getRestaurantById(user.restaurantId!);
    if (!restaurant || restaurant.isActive === false) {
      throw new Error("Restaurant subscription is inactive");
    }
  }
  return user.restaurantId!;
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

function getIdempotencyKey(req: Request): string | null {
  const header = req.headers["x-idempotency-key"];
  if (Array.isArray(header)) {
    return header[0] || null;
  }
  return typeof header === "string" && header.trim() ? header.trim() : null;
}

function buildIdempotencyFingerprint(payload: any): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload ?? {}))
    .digest("hex");
}

async function appendImmutableFinanceLedgerEntry(params: {
  restaurantId: string;
  branchId?: string | null;
  orderId?: string | null;
  invoiceId?: string | null;
  paymentTransactionId?: string | null;
  eventType: string;
  amount?: string | number | null;
  idempotencyKey?: string | null;
  payload?: any;
  createdBy?: string | null;
  createdByName?: string | null;
}) {
  try {
    const latest = await storage.getLatestFinanceLedgerEntry(params.restaurantId);
    const previousEntryHash = latest?.entryHash || "GENESIS";
    const payload = JSON.stringify(params.payload ?? {});
    const entryHash = crypto
      .createHash("sha256")
      .update(
        [
          params.restaurantId,
          params.branchId || "",
          params.orderId || "",
          params.invoiceId || "",
          params.eventType,
          params.amount ?? "",
          params.idempotencyKey || "",
          previousEntryHash,
          payload,
        ].join("|"),
      )
      .digest("hex");

    await storage.createFinanceLedgerEntry({
      restaurantId: params.restaurantId,
      branchId: params.branchId || null,
      orderId: params.orderId || null,
      invoiceId: params.invoiceId || null,
      paymentTransactionId: params.paymentTransactionId || null,
      eventType: params.eventType,
      eventSource: "server",
      amount: params.amount != null ? String(params.amount) : null,
      currency: "SAR",
      idempotencyKey: params.idempotencyKey || null,
      payload,
      previousEntryHash,
      entryHash,
      createdBy: params.createdBy || null,
      createdByName: params.createdByName || null,
    });
  } catch (error) {
    console.warn("Finance ledger append skipped:", (error as any)?.message || error);
  }
}

async function findIdempotentOrder(restaurantId: string, idempotencyKey: string) {
  const [log] = await db
    .select({
      orderId: orderAuditLogTable.orderId,
      fingerprint: orderAuditLogTable.previousValue,
    })
    .from(orderAuditLogTable)
    .where(
      and(
        eq(orderAuditLogTable.restaurantId, restaurantId),
        eq(orderAuditLogTable.field, "idempotencyKey"),
        eq(orderAuditLogTable.newValue, idempotencyKey),
      ),
    )
    .limit(1);

  if (!log?.orderId) return null;

  const order = await storage.getOrder(log.orderId);
  if (!order) return null;

  return {
    order,
    fingerprint: log.fingerprint || undefined,
  };
}

async function findIdempotentInvoice(restaurantId: string, idempotencyKey: string) {
  const [log] = await db
    .select({
      invoiceId: invoiceAuditLogTable.invoiceId,
      fingerprint: invoiceAuditLogTable.details,
    })
    .from(invoiceAuditLogTable)
    .where(
      and(
        eq(invoiceAuditLogTable.restaurantId, restaurantId),
        eq(invoiceAuditLogTable.action, `idempotency:${idempotencyKey}`),
      ),
    )
    .limit(1);

  if (!log?.invoiceId) return null;

  const invoice = await storage.getInvoice(log.invoiceId);
  if (!invoice) return null;

  return {
    invoice,
    fingerprint: log.fingerprint || undefined,
  };
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
async function verifyOwnership(
  req: Request,
  entity: { restaurantId?: string | null } | null | undefined,
  entityName = "Resource",
): Promise<void> {
  if (!entity) throw new Error(`${entityName} not found`);
  const restaurantId = await getRestaurantId(req);
  if (entity.restaurantId && entity.restaurantId !== restaurantId) {
    throw new Error(`${entityName} not found`);
  }
}

// Server-side order total recalculation using actual DB prices
async function recalculateOrderTotals(
  restaurantId: string,
  items: Array<{
    menuItemId: string;
    quantity: number;
    price?: string;
    variantPrice?: string;
    variantId?: string;
    variantName?: string;
    customizations?: Array<{
      optionId?: string;
      price?: string;
      [key: string]: any;
    }>;
  }>,
  clientDiscount: number = 0,
  clientDeliveryFee: number = 0,
): Promise<{
  subtotal: string;
  tax: string;
  total: string;
  discount: string;
  deliveryFee: string;
}> {
  const restaurant = await storage.getRestaurantById(restaurantId);
  const isTaxEnabled = restaurant?.taxEnabled !== false;
  const taxRate = isTaxEnabled ? 0.15 : 0;

  let subtotal = 0;
  for (const item of items) {
    const menuItem = await storage.getMenuItem(item.menuItemId);
    if (!menuItem || menuItem.restaurantId !== restaurantId) {
      throw new Error(
        `Menu item ${item.menuItemId} not found or does not belong to this restaurant`,
      );
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
      const matched = variants.find(
        (v) => v.nameEn === item.variantName || v.nameAr === item.variantName,
      );
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
  "status",
  "paymentMethod",
  "isPaid",
  "notes",
  "kitchenNotes",
  "customerName",
  "customerPhone",
  "customerAddress",
  "customerId",
] as const;

async function createOrderAtomicPipeline(params: {
  orderData: any;
  items: any[];
  userName?: string | null;
}) {
  const { orderData, items, userName } = params;

  return db.transaction(async (tx) => {
    const today = new Date();
    const datePrefix = `${today.getFullYear()}${String(
      today.getMonth() + 1,
    ).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
    const orderNumberPrefix = `ORD-${datePrefix}-`;

    if (orderData.orderType === "dine_in" && orderData.tableId) {
      await tx
        .update(tablesTable)
        .set({ status: "occupied" })
        .where(eq(tablesTable.id, orderData.tableId));
    }

    const [createdOrder] = await tx
      .insert(ordersTable)
      .values({
        ...orderData,
        orderNumber: sql`${orderNumberPrefix} || LPAD(
          (COALESCE(
            (SELECT MAX(SUBSTRING(${ordersTable.orderNumber} FROM LENGTH(${orderNumberPrefix}) + 1)::int)
             FROM ${ordersTable}
             WHERE ${ordersTable.restaurantId} = ${orderData.restaurantId}
             AND ${ordersTable.orderNumber} LIKE ${orderNumberPrefix + "%"}
            ), 0
          ) + 1)::text, 4, '0')`,
      })
      .returning();

    if (!createdOrder) {
      throw new Error("ORDER_CREATE_FAILED");
    }

    for (const rawItem of items || []) {
      const itemQty = Math.max(1, Math.floor(Number(rawItem?.quantity || 1)));
      const unitPrice = String(rawItem?.unitPrice ?? "0");
      const totalPrice = String(
        rawItem?.totalPrice ?? (Number(unitPrice || 0) * itemQty).toFixed(2),
      );

      let itemName = rawItem?.itemName || null;
      if (!itemName && rawItem?.menuItemId) {
        const [menuItem] = await tx
          .select({ nameAr: menuItemsTable.nameAr, nameEn: menuItemsTable.nameEn })
          .from(menuItemsTable)
          .where(eq(menuItemsTable.id, rawItem.menuItemId))
          .limit(1);
        itemName = menuItem?.nameAr || menuItem?.nameEn || null;
      }

      const [createdItem] = await tx
        .insert(orderItemsTable)
        .values({
          orderId: createdOrder.id,
          menuItemId: rawItem?.menuItemId || null,
          quantity: itemQty,
          unitPrice,
          totalPrice,
          notes: rawItem?.notes || null,
          itemName,
        })
        .returning({ id: orderItemsTable.id });

      if (rawItem?.menuItemId) {
        const itemRecipes = await tx
          .select({
            inventoryItemId: recipesTable.inventoryItemId,
            quantity: recipesTable.quantity,
          })
          .from(recipesTable)
          .where(eq(recipesTable.menuItemId, rawItem.menuItemId));

        for (const recipe of itemRecipes) {
          const deductionAmount = parseFloat(recipe.quantity || "0") * itemQty;
          if (!Number.isFinite(deductionAmount) || deductionAmount <= 0) continue;

          const locked = await tx.execute(sql`
            SELECT id, current_stock
            FROM inventory_items
            WHERE id = ${recipe.inventoryItemId}
            FOR UPDATE
          `);

          const lockedRow = (locked as any)?.rows?.[0];
          if (!lockedRow) continue;

          const currentStock = parseFloat(lockedRow.current_stock || "0");
          if (currentStock < deductionAmount) {
            throw new Error(`INSUFFICIENT_STOCK:${recipe.inventoryItemId}`);
          }

          const newStock = (currentStock - deductionAmount).toFixed(2);

          await tx
            .update(inventoryItemsTable)
            .set({ currentStock: newStock, updatedAt: new Date() })
            .where(eq(inventoryItemsTable.id, recipe.inventoryItemId));

          await tx.insert(inventoryTransactionsTable).values({
            inventoryItemId: recipe.inventoryItemId,
            branchId: createdOrder.branchId || null,
            type: "usage",
            quantity: String(deductionAmount),
            notes: `Order item: ${createdItem?.id || "unknown"}`,
            referenceId: createdOrder.id,
          });
        }
      }
    }

    let finalOrder = createdOrder;
    if (createdOrder.customerPhone) {
      const normalizedPhone = String(createdOrder.customerPhone).replace(/\s/g, "");
      const [existingCustomer] = await tx
        .select()
        .from(customers)
        .where(
          sql`${customers.restaurantId} = ${createdOrder.restaurantId} AND ${customers.phone} = ${normalizedPhone}`,
        )
        .limit(1);

      if (existingCustomer) {
        await tx
          .update(customers)
          .set({
            name: createdOrder.customerName || existingCustomer.name,
            address: createdOrder.customerAddress || existingCustomer.address,
            totalOrders: (existingCustomer.totalOrders || 0) + 1,
            totalSpent: String(
              parseFloat(existingCustomer.totalSpent || "0") +
                parseFloat(createdOrder.total || "0"),
            ),
            lastOrderAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(customers.id, existingCustomer.id));

        const [updatedOrder] = await tx
          .update(ordersTable)
          .set({ customerId: existingCustomer.id, updatedAt: new Date() })
          .where(eq(ordersTable.id, createdOrder.id))
          .returning();
        if (updatedOrder) finalOrder = updatedOrder;
      } else {
        const [newCustomer] = await tx
          .insert(customers)
          .values({
            restaurantId: createdOrder.restaurantId,
            name: createdOrder.customerName || null,
            phone: normalizedPhone,
            address: createdOrder.customerAddress || null,
            totalOrders: 1,
            totalSpent: createdOrder.total || "0",
            lastOrderAt: new Date(),
          })
          .returning();

        const [updatedOrder] = await tx
          .update(ordersTable)
          .set({ customerId: newCustomer.id, updatedAt: new Date() })
          .where(eq(ordersTable.id, createdOrder.id))
          .returning();
        if (updatedOrder) finalOrder = updatedOrder;
      }
    }

    await tx.insert(orderAuditLogTable).values({
      orderId: finalOrder.id,
      action: "created",
      newValue: JSON.stringify({
        orderType: finalOrder.orderType,
        total: finalOrder.total,
        items: (items || []).length,
      }),
      userName: userName || null,
      restaurantId: finalOrder.restaurantId,
    });

    return finalOrder;
  });
}

async function createIssuedInvoiceForOrder(params: {
  restaurantId: string;
  order: any;
  requestItems: any[];
  idempotencyKey?: string | null;
}) {
  const { restaurantId, order, requestItems, idempotencyKey } = params;

  if (!order || order.status === "payment_pending") return;

  const existingInvoice = await storage.getInvoiceByOrder(order.id);
  if (existingInvoice) return existingInvoice;

  const restaurant = await storage.getRestaurantById(restaurantId);
  if (!restaurant) return null;

  const isTaxEnabled = restaurant.taxEnabled !== false;
  const taxRatePercent = isTaxEnabled ? 15 : 0;
  const orderDiscount = parseFloat(order.discount || "0");
  const orderDeliveryFee = parseFloat(order.deliveryFee || "0");
  const now = new Date();
  const uuid = generateInvoiceUuid();
  const invoiceNumber = await storage.getNextInvoiceNumber(
    restaurantId,
    order.branchId,
  );

  const orderBranchId = order.branchId || null;
  const { counter: prevCounter, lastHash: prevHash } =
    await storage.getZatcaCounterAndHash(restaurantId, orderBranchId);
  const currentCounter = prevCounter + 1;
  const previousHash =
    prevHash ||
    Buffer.from(
      "NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==",
      "base64",
    ).toString("utf8");

  const menuItemIds = Array.from(
    new Set(
      (requestItems || [])
        .map((item) => item?.menuItemId)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const menuItemsMap = new Map<string, { nameAr: string | null; nameEn: string | null; price: any }>();
  if (menuItemIds.length > 0) {
    const rows = await db
      .select({
        id: menuItemsTable.id,
        nameAr: menuItemsTable.nameAr,
        nameEn: menuItemsTable.nameEn,
        price: menuItemsTable.price,
      })
      .from(menuItemsTable)
      .where(inArray(menuItemsTable.id, menuItemIds));

    for (const row of rows) {
      menuItemsMap.set(row.id, row);
    }
  }

  const xmlItems: ZatcaLineItem[] = (requestItems || []).map((item: any, idx: number) => {
    const menuItem = item.menuItemId ? menuItemsMap.get(item.menuItemId) : null;
    const unitPrice = parseFloat(item.unitPrice || menuItem?.price || "0");
    const qty = item.quantity || 1;
    const lineTotal = bankersRound(unitPrice * qty);
    const lineTax = bankersRound(lineTotal * (taxRatePercent / 100));
    return {
      id: String(idx + 1),
      nameAr: menuItem?.nameAr || menuItem?.nameEn || item.itemName || "منتج",
      nameEn: menuItem?.nameEn || item.itemName || "",
      quantity: qty,
      unitPrice,
      discount: 0,
      taxRate: taxRatePercent,
      taxAmount: lineTax,
      totalWithTax: bankersRound(lineTotal + lineTax),
      totalWithoutTax: lineTotal,
    };
  });

  const itemsSubtotal = bankersRound(
    xmlItems.reduce((sum, i) => sum + i.totalWithoutTax, 0),
  );
  const taxableAmt = bankersRound(
    Math.max(0, itemsSubtotal - orderDiscount + orderDeliveryFee),
  );
  const vatAmount = bankersRound(taxableAmt * (taxRatePercent / 100));
  const invoiceTotal = bankersRound(taxableAmt + vatAmount);

  const unsignedXmlContent = generateZatcaXml({
    uuid,
    invoiceNumber,
    invoiceType: "simplified",
    issueDate: now.toISOString().split("T")[0],
    issueTime: now.toTimeString().split(" ")[0],
    deliveryDate: now.toISOString().split("T")[0],
    seller: {
      nameAr: restaurant.nameAr || restaurant.nameEn || "مطعم",
      vatNumber: restaurant.vatNumber || "",
      commercialRegistration: restaurant.commercialRegistration || "",
      streetName: restaurant.streetName || "",
      buildingNumber: restaurant.buildingNumber || "",
      district: restaurant.district || "",
      city: restaurant.city || "",
      postalCode: restaurant.postalCode || "",
      country: restaurant.country || "SA",
    },
    items: xmlItems,
    subtotal: itemsSubtotal,
    discount: orderDiscount,
    deliveryFee: orderDeliveryFee,
    taxAmount: vatAmount,
    taxRate: taxRatePercent,
    total: invoiceTotal,
    paymentMethod: order.paymentMethod || "cash",
    previousInvoiceHash: previousHash,
    invoiceCounter: currentCounter,
  });

  let privKey: string | null = null;
  let cert: string | null = null;
  if (orderBranchId) {
    const br = await storage.getBranch(orderBranchId);
    if (br && (br as any).zatcaPrivateKey) {
      privKey = (br as any).zatcaPrivateKey;
      cert =
        (br as any).zatcaProductionCsid ||
        (br as any).zatcaComplianceCsid ||
        (br as any).zatcaCertificate;
    }
  }
  if (!privKey && (restaurant as any).zatcaPrivateKey) {
    privKey = (restaurant as any).zatcaPrivateKey;
    cert =
      restaurant.zatcaProductionCsid ||
      restaurant.zatcaComplianceCsid ||
      restaurant.zatcaCertificate;
  }

  const signResult = buildSignedInvoice(unsignedXmlContent, privKey, cert, {
    sellerName: restaurant.nameAr || restaurant.nameEn || "مطعم",
    vatNumber: restaurant.vatNumber || "",
    timestamp: now.toISOString(),
    total: invoiceTotal.toFixed(2),
    vatAmount: vatAmount.toFixed(2),
  });

  const invoice = await storage.createInvoice({
    restaurantId,
    branchId: orderBranchId,
    orderId: order.id,
    invoiceNumber,
    invoiceType: "simplified",
    subtotal: itemsSubtotal.toFixed(2),
    discount: orderDiscount.toFixed(2),
    deliveryFee: orderDeliveryFee.toFixed(2),
    taxRate: taxRatePercent.toFixed(2),
    taxAmount: vatAmount.toFixed(2),
    total: invoiceTotal.toFixed(2),
    qrCodeData: signResult.qrData,
    xmlContent: signResult.finalXml,
    invoiceHash: signResult.invoiceHash,
    previousInvoiceHash: previousHash,
    invoiceCounter: currentCounter,
    uuid,
    status: "issued",
    zatcaStatus: "pending",
    customerName: order.customerName || null,
    customerPhone: order.customerPhone || null,
    paymentMethod: order.paymentMethod || "cash",
    signedXml: signResult.signedXml || null,
  });

  await storage.updateZatcaCounterAndHash(
    restaurantId,
    orderBranchId,
    currentCounter,
    signResult.invoiceHash,
  );

  await appendImmutableFinanceLedgerEntry({
    restaurantId,
    branchId: orderBranchId,
    orderId: order.id,
    invoiceId: invoice.id,
    eventType: "invoice_issued",
    amount: invoice.total,
    idempotencyKey,
    payload: {
      invoiceNumber: invoice.invoiceNumber,
      invoiceType: invoice.invoiceType,
      zatcaStatus: invoice.zatcaStatus,
      previousInvoiceHash: invoice.previousInvoiceHash,
      invoiceHash: invoice.invoiceHash,
    },
  });

  return invoice;
}

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
  invoiceType:
    | "simplified"
    | "standard"
    | "credit_note"
    | "debit_note" = "simplified",
  relatedInvoice?: any,
  buyer?: {
    name?: string;
    vatNumber?: string;
    streetName?: string;
    buildingNumber?: string;
    district?: string;
    city?: string;
    postalCode?: string;
    country?: string;
  },
  noteReason?: string,
) {
  const restaurantId = restaurant.id;
  const branchId = order.branchId || null;

  // B2B validation for standard invoices (BR-KSA-46)
  if (invoiceType === "standard") {
    const buyerErrors = validateB2BBuyer(buyer);
    if (buyerErrors.length > 0) {
      throw new Error(`B2B buyer validation failed: ${buyerErrors.join("; ")}`);
    }
  }

  // Get branch-level ZATCA counter and hash (falls back to restaurant if no branch)
  const { counter: prevCounter, lastHash } =
    await storage.getZatcaCounterAndHash(restaurantId, branchId);
  const currentCounter = prevCounter + 1;

  const previousHash =
    lastHash ||
    Buffer.from(
      "NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==",
      "base64",
    ).toString("utf8");

  const uuid = generateInvoiceUuid();
  const now = new Date();
  const issueDate = now.toISOString().split("T")[0];
  const issueTime = now.toTimeString().split(" ")[0];

  // Delivery date: use order creation for dine-in/pickup, supply date for delivery
  const orderCreatedAt = order.createdAt ? new Date(order.createdAt) : now;
  const deliveryDate =
    order.orderType === "delivery"
      ? order.updatedAt
        ? new Date(order.updatedAt).toISOString().split("T")[0]
        : issueDate
      : orderCreatedAt.toISOString().split("T")[0];

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
      nameAr: menuItem?.nameAr || menuItem?.nameEn || item.itemName || "منتج",
      nameEn: menuItem?.nameEn || item.itemName || "",
      quantity,
      unitPrice,
      discount: lineDiscount,
      taxRate,
      taxAmount: lineTax,
      totalWithTax: bankersRound(lineTotal + lineTax),
      totalWithoutTax: lineTotal,
    };
  });

  const subtotal = bankersRound(
    items.reduce((sum, i) => sum + i.totalWithoutTax, 0),
  );
  const discount = bankersRound(parseFloat(order.discount || "0"));
  const deliveryFee = bankersRound(parseFloat(order.deliveryFee || "0"));
  const taxableAmount = bankersRound(
    Math.max(0, subtotal - discount + deliveryFee),
  );
  const taxAmount = bankersRound(taxableAmount * (taxRate / 100));
  const total = bankersRound(taxableAmount + taxAmount);

  const invoiceNumber = await storage.getNextInvoiceNumber(
    restaurantId,
    branchId,
  );

  const invoiceData: ZatcaInvoiceData = {
    uuid,
    invoiceNumber,
    invoiceType,
    issueDate,
    issueTime,
    deliveryDate,
    seller: {
      nameAr: restaurant.nameAr || restaurant.nameEn || "مطعم",
      nameEn: restaurant.nameEn,
      vatNumber: restaurant.vatNumber || "",
      commercialRegistration: restaurant.commercialRegistration || "",
      streetName: restaurant.streetName || "",
      buildingNumber: restaurant.buildingNumber || "",
      district: restaurant.district || "",
      city: restaurant.city || "",
      postalCode: restaurant.postalCode || "",
      country: restaurant.country || "SA",
    },
    buyer: buyer
      ? {
          name: buyer.name,
          vatNumber: buyer.vatNumber,
          streetName: buyer.streetName,
          buildingNumber: buyer.buildingNumber,
          district: buyer.district,
          city: buyer.city,
          postalCode: buyer.postalCode,
          country: buyer.country,
        }
      : undefined,
    items,
    subtotal,
    discount,
    deliveryFee,
    taxAmount,
    taxRate,
    total,
    paymentMethod: order.paymentMethod || "cash",
    previousInvoiceHash: previousHash,
    invoiceCounter: currentCounter,
    relatedInvoiceNumber: relatedInvoice?.invoiceNumber,
    relatedInvoiceIssueDate: relatedInvoice?.createdAt
      ? new Date(relatedInvoice.createdAt).toISOString().split("T")[0]
      : undefined,
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
    if (
      branch &&
      (branch as any).zatcaPrivateKey &&
      (branch as any).zatcaCertificate
    ) {
      privateKey = (branch as any).zatcaPrivateKey;
      certificate =
        (branch as any).zatcaProductionCsid ||
        (branch as any).zatcaComplianceCsid ||
        (branch as any).zatcaCertificate;
    }
  }
  // Fallback to restaurant-level
  if (
    !privateKey &&
    restaurant.zatcaPrivateKey &&
    restaurant.zatcaCertificate
  ) {
    privateKey = restaurant.zatcaPrivateKey;
    certificate =
      restaurant.zatcaProductionCsid ||
      restaurant.zatcaComplianceCsid ||
      restaurant.zatcaCertificate;
  }

  // Sign + QR pipeline
  const { finalXml, invoiceHash, qrData, signatureValue, signedXml } =
    buildSignedInvoice(unsignedXml, privateKey, certificate, {
      sellerName: restaurant.nameAr || restaurant.nameEn || "مطعم",
      vatNumber: restaurant.vatNumber || "",
      timestamp: now.toISOString(),
      total: total.toFixed(2),
      vatAmount: taxAmount.toFixed(2),
    });

  // Update branch-level (and restaurant-level) counter and hash
  await storage.updateZatcaCounterAndHash(
    restaurantId,
    branchId,
    currentCounter,
    invoiceHash,
  );

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

// Generate a unique, readable deposit code for reservations (e.g., "RES-A7X2")
function generateDepositCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Exclude confusing chars (0,O,1,I)
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `RES-${code}`;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {
  app.use("/uploads", (await import("express")).default.static(uploadDir));

  // Debug middleware to catch PUT menu-items issues
  app.use("/api/menu-items", (req, res, next) => {
    if (req.method === "PUT") {
      console.log("[DEBUG-MW] PUT /api/menu-items intercepted");
      console.log(
        "[DEBUG-MW] body type:",
        typeof req.body,
        "body keys:",
        Object.keys(req.body || {}),
      );
      console.log("[DEBUG-MW] content-type:", req.headers["content-type"]);
    }
    next();
  });

  // Health check endpoint - no auth required
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // Mobile app version check — no auth required
  // Update MIN_APP_VERSION here to force users to update the app
  app.get("/api/app-version", (_req, res) => {
    const MIN_APP_VERSION = process.env.MIN_APP_VERSION || "1.0.0";
    const LATEST_APP_VERSION = process.env.LATEST_APP_VERSION || "1.0.0";
    const STORE_URL_ANDROID = process.env.APP_STORE_URL_ANDROID || "https://play.google.com/store/apps/details?id=com.tryingpos.app";
    const STORE_URL_IOS = process.env.APP_STORE_URL_IOS || "https://apps.apple.com/app/tryingpos/id0000000000";
    res.json({
      minVersion: MIN_APP_VERSION,
      latestVersion: LATEST_APP_VERSION,
      storeUrlAndroid: STORE_URL_ANDROID,
      storeUrlIos: STORE_URL_IOS,
    });
  });

  // RBAC permission middleware for protected routes
  const ROUTE_PERMISSIONS: Array<{
    pattern: RegExp;
    module: string;
    methods?: string[];
  }> = [
    { pattern: /^\/api\/(menu-items|categories)/, module: "menu" },
    { pattern: /^\/api\/orders/, module: "orders" },
    { pattern: /^\/api\/tables/, module: "tables" },
    { pattern: /^\/api\/inventory/, module: "inventory" },
    { pattern: /^\/api\/kitchen/, module: "kitchen" },
    { pattern: /^\/api\/reports/, module: "reports" },
    {
      pattern: /^\/api\/(restaurant|settings|branches|users|zatca)/,
      module: "settings",
    },
    { pattern: /^\/api\/(promotions|coupons)/, module: "marketing" },
    { pattern: /^\/api\/qr-codes/, module: "qr" },
    { pattern: /^\/api\/printers/, module: "settings" },
    { pattern: /^\/api\/(queue|reservations)/, module: "tables" },
    { pattern: /^\/api\/delivery/, module: "settings" },
  ];

  app.use("/api/", async (req, res, next) => {
    // Skip auth check for public routes, auth routes, and webhooks
    if (
      req.path.includes("/public/") ||
      req.path.startsWith("/auth/") ||
      req.path.includes("/webhook")
    ) {
      return next();
    }

    // Find matching permission rule
    const matched = ROUTE_PERMISSIONS.find((r) => r.pattern.test(req.path));
    if (matched) {
      try {
        await requirePermission(req, matched.module);
      } catch (err: any) {
        if (err.message === "Permission denied") {
          return res.status(403).json({
            error: "You don't have permission to access this resource",
          });
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
      const menuItemsMap = new Map(menuItemsData.map((m) => [m.id, m]));
      const itemsWithDetails = orderItems.map((item) => {
        const menuItem = item.menuItemId
          ? menuItemsMap.get(item.menuItemId)
          : null;
        return {
          ...item,
          menuItem: menuItem
            ? {
                nameEn: menuItem.nameEn,
                nameAr: menuItem.nameAr,
                price: menuItem.price,
              }
            : item.itemName
              ? {
                  nameEn: item.itemName,
                  nameAr: item.itemName,
                  price: item.unitPrice,
                }
              : undefined,
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
        customerPhone: invoice.customerPhone,
        paymentMethod: invoice.paymentMethod,
        isPaid: invoice.isPaid,
        qrCodeData: invoice.qrCodeData,
        zatcaStatus: invoice.zatcaStatus,
        uuid: invoice.uuid,
        invoiceCounter: invoice.invoiceCounter,
        invoiceHash: invoice.invoiceHash,
        createdAt: invoice.createdAt,
        issuedAt: invoice.issuedAt,
        order: { ...order, items: itemsWithDetails },
        restaurant: restaurant
          ? {
              nameEn: restaurant.nameEn,
              nameAr: restaurant.nameAr,
              vatNumber: restaurant.vatNumber,
              commercialRegistration: restaurant.commercialRegistration,
              address: restaurant.address,
              phone: restaurant.phone,
              logo: restaurant.logo,
              city: restaurant.city,
              streetName: restaurant.streetName,
              district: restaurant.district,
            }
          : null,
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
      const branchParam = (req.query.branch || req.query.b) as
        | string
        | undefined;
      if (branchParam) {
        const resolvedBranchId = await storage.resolveBranchId(
          resolvedId,
          branchParam,
        );
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
      res.json(
        branchesList
          .filter((b: any) => b.isActive)
          .map((b: any) => ({
            id: b.id,
            slug: b.slug || null,
            name: b.name,
            nameAr: b.nameAr,
            isMain: b.isMain,
          })),
      );
    } catch (error) {
      res.status(500).json({ error: "Failed to get branches" });
    }
  });

  app.get("/api/public/:restaurantId/restaurant", async (req, res) => {
    try {
      const restaurant = await storage.getRestaurantById(
        res.locals.restaurantId,
      );
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
        reservationDepositAmount:
          (restaurant as any).reservationDepositAmount || "20.00",
        reservationDepositRequired:
          (restaurant as any).reservationDepositRequired !== false,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get restaurant" });
    }
  });

  app.post("/api/public/:restaurantId/customer/login", async (req, res) => {
    try {
      const { restaurantId: restaurantIdOrSlug } = req.params;
      const { phone: rawPhone, name } = req.body;

      if (!rawPhone) {
        return res.status(400).json({ error: "Phone number is required" });
      }

      const phone = rawPhone
        .toString()
        .replace(/[\s\-\(\)]/g, "")
        .trim();

      // Validate phone number format
      const phoneValidation = validatePhoneNumber(phone);
      if (!phoneValidation.valid) {
        return res.status(400).json({ error: phoneValidation.error });
      }

      // Resolve restaurant ID from slug or ID
      const restaurantId =
        await storage.resolveRestaurantId(restaurantIdOrSlug);
      if (!restaurantId) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      let customer = await storage.getCustomerByPhone(restaurantId, phone);

      if (customer) {
        if (name && name !== customer.name) {
          customer =
            (await storage.updateCustomer(customer.id, { name })) || customer;
        }
        return res.json({ customer, isNew: false });
      }

      if (!name) {
        return res
          .status(404)
          .json({ error: "Customer not found", needsRegistration: true });
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
      res.json(categories.filter((c) => c.isActive));
    } catch (error) {
      res.status(500).json({ error: "Failed to get categories" });
    }
  });

  app.get("/api/public/:restaurantId/menu-items", async (req, res) => {
    try {
      const items = await storage.getMenuItems(res.locals.restaurantId);
      res.json(items);
    } catch (error) {
      console.error(
        "Error in GET /api/public/:restaurantId/menu-items:",
        error,
      );
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
      const normalizedPhone = phone.replace(/\s/g, "");
      const reservation = await storage.findPaidDepositByPhone(
        restaurantId,
        normalizedPhone,
      );
      if (reservation) {
        res.json({
          hasDeposit: true,
          depositAmount: reservation.depositAmount,
          reservationId: reservation.id,
          customerName: reservation.customerName,
        });
      } else {
        res.json({ hasDeposit: false });
      }
    } catch (error) {
      res.json({ hasDeposit: false });
    }
  });

  // Public coupon validation (also handles reservation deposit codes)
  app.post("/api/public/:restaurantId/validate-coupon", async (req, res) => {
    try {
      const restaurantId = res.locals.restaurantId;
      const { code, orderTotal, customerPhone } = req.body;
      if (!code || orderTotal === undefined) {
        return res
          .status(400)
          .json({ valid: false, error: "Code and orderTotal are required" });
      }

      // Check if it's a reservation deposit code first (starts with "RES-")
      if (code.toUpperCase().startsWith("RES-")) {
        const reservation = await storage.getReservationByDepositCode(
          restaurantId,
          code.toUpperCase(),
        );
        if (reservation) {
          if (!reservation.depositPaid) {
            return res.json({
              valid: false,
              error: "هذا الحجز لم يُدفع عربونه بعد",
            });
          }
          if (reservation.depositAppliedToOrder) {
            return res.json({
              valid: false,
              error: "تم استخدام هذا الكود من قبل",
            });
          }
          const depositAmount = parseFloat(reservation.depositAmount || "0");
          const discount = Math.min(depositAmount, parseFloat(orderTotal));
          return res.json({
            valid: true,
            discount,
            isReservationDeposit: true,
            reservationId: reservation.id,
            discountType: "fixed",
            discountValue: depositAmount.toFixed(2),
            message: `عربون حجز ${code}`,
          });
        } else {
          return res.json({ valid: false, error: "كود الحجز غير موجود" });
        }
      }

      // Otherwise, validate as regular coupon
      const result = await storage.validateCoupon(
        restaurantId,
        code,
        parseFloat(orderTotal),
        customerPhone,
      );
      if (result.valid && result.coupon) {
        const coupon = result.coupon;
        let discount = 0;
        if (coupon.discountType === "percentage") {
          discount =
            (parseFloat(orderTotal) * parseFloat(coupon.discountValue)) / 100;
          if (coupon.maxDiscountAmount) {
            discount = Math.min(discount, parseFloat(coupon.maxDiscountAmount));
          }
        } else {
          discount = parseFloat(coupon.discountValue);
        }
        discount = Math.min(discount, parseFloat(orderTotal));
        res.json({
          valid: true,
          discount,
          couponId: coupon.id,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
        });
      } else {
        res.json({ valid: false, error: result.error });
      }
    } catch (error) {
      res
        .status(500)
        .json({ valid: false, error: "Failed to validate coupon" });
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
        const resolvedBranch = await storage.resolveBranchId(
          restaurantId,
          req.body.branchId,
        );
        validBranchId = resolvedBranch || undefined;
      }

      // Check if day session is open before accepting orders
      const currentSession = await storage.getCurrentDaySession(
        restaurantId,
        validBranchId,
      );
      if (!currentSession) {
        return res.status(400).json({
          error: "daySessionClosed",
          message: "Restaurant has not opened day session yet",
        });
      }

      // Block cash payment if restaurant has disabled it for public QR orders
      // Exception: dine_in table orders use "cash" as a placeholder — real payment
      // is collected via edfapay AFTER kitchen marks the order ready (triggered from
      // the active-order view on the QR page, not at order-placement time).
      const isTableQrOrder = req.body.orderType === "dine_in" && !!req.body.tableId;
      if (req.body.paymentMethod === "cash" && (restaurant as any).allowCashOnPublicQR === false && !isTableQrOrder) {
        return res.status(400).json({
          error: "cashNotAllowed",
          message: "Cash payment is not accepted for online orders at this restaurant",
          messageAr: "الدفع النقدي غير مقبول للطلبات الإلكترونية في هذا المطعم",
        });
      }

      // Server-side price recalculation for public orders (CRITICAL - prevents price tampering)
      let serverTotals: {
        subtotal: string;
        tax: string;
        total: string;
        discount: string;
        deliveryFee: string;
      } | null = null;
      if (
        req.body.items &&
        Array.isArray(req.body.items) &&
        req.body.items.length > 0
      ) {
        try {
          serverTotals = await recalculateOrderTotals(
            restaurantId,
            req.body.items,
            parseFloat(req.body.discount || "0"),
            parseFloat(req.body.deliveryFee || "0"),
          );
        } catch (calcErr: any) {
          console.error(
            "Server-side price calculation error (public):",
            calcErr,
          );
          return res
            .status(400)
            .json({ error: "Invalid order items: " + calcErr.message });
        }
      }

      const cleanBody = {
        ...req.body,
        restaurantId,
        orderNumber: req.body.orderNumber || `TMP-${Date.now()}`,
        tableId: req.body.tableId || undefined,
        branchId: validBranchId,
        customerName: req.body.customerName || undefined,
        customerPhone: req.body.customerPhone || undefined,
        customerAddress: req.body.customerAddress || undefined,
        notes: req.body.notes || undefined,
        kitchenNotes: req.body.kitchenNotes || undefined,
        // Override with server-calculated values for public orders
        ...(serverTotals
          ? {
              subtotal: serverTotals.subtotal,
              tax: serverTotals.tax,
              total: serverTotals.total,
              discount: serverTotals.discount,
              deliveryFee: serverTotals.deliveryFee,
            }
          : {}),
      };

      const data = insertOrderSchema.parse(cleanBody);

      // إذا كان طلب من طاولة (dine_in + tableId)، يكون status = pending حتى الكاشير يوافق
      const isDineInTableOrder = data.orderType === "dine_in" && data.tableId;
      if (isDineInTableOrder) {
        (data as any).status = "pending"; // الطلب معلق حتى موافقة الكاشير

        // منع التعارض: تحقق إذا الطاولة فيها طلب نشط
        const existingOrder = await storage.getActiveOrderByTable(
          data.tableId!,
        );
        if (existingOrder) {
          return res.status(400).json({
            error: "Table has an active order",
            errorAr: "الطاولة لديها طلب نشط",
            orderId: existingOrder.id,
            orderNumber: existingOrder.orderNumber,
          });
        }
      }

      if (data.orderType === "dine_in" && data.tableId) {
        const tbl = await storage.getTable(data.tableId);
        if (tbl && tbl.restaurantId === restaurantId) {
          await storage.updateTableStatus(data.tableId, "occupied");
        } else {
          return res
            .status(400)
            .json({ error: "Invalid table for this restaurant" });
        }
      }

      const order = await storage.createOrder(data);

      // Save order items atomically after order creation (prevents orphaned orders with no items)
      if (req.body.items && Array.isArray(req.body.items) && req.body.items.length > 0) {
        for (const rawItem of req.body.items) {
          try {
            await storage.createOrderItem({
              orderId: order.id,
              menuItemId: rawItem.menuItemId || null,
              quantity: Math.max(1, Math.floor(Number(rawItem.quantity || 1))),
              unitPrice: String(rawItem.unitPrice ?? "0"),
              totalPrice: String(rawItem.totalPrice ?? "0"),
              notes: rawItem.notes || null,
              itemName: rawItem.itemName || null,
            });
          } catch (itemErr) {
            console.error("Failed to save order item (public):", itemErr);
          }
        }
      }

      // Auto-apply deposit discount
      let depositApplied = false;

      // Check if a specific reservation deposit code was used (from validate-coupon)
      // Note: The discount is already calculated in frontend and included in order.discount/total
      // We only need to mark the reservation as applied
      if (req.body.depositReservationId) {
        try {
          const reservation = await storage.getReservation(
            req.body.depositReservationId,
          );
          if (
            reservation &&
            reservation.depositPaid &&
            !reservation.depositAppliedToOrder
          ) {
            await storage.markDepositApplied(reservation.id, order.id);
            depositApplied = true;
            (order as any).depositApplied = true;
            (order as any).depositReservationCode = reservation.depositCode;
            console.log(
              `[Order] Deposit reservation ${reservation.depositCode} applied to order ${order.id}`,
            );
          }
        } catch (e) {
          console.error("Deposit reservation apply error:", e);
        }
      }

      // Fallback: auto-apply deposit if customer has a paid reservation deposit (by phone)
      // Skip if:
      // 1. deposit was already applied via depositReservationId
      // 2. order already has a discount (customer used a coupon code - including deposit code)
      const existingDiscount = parseFloat(order.discount || "0");
      if (!depositApplied && !existingDiscount && order.customerPhone) {
        const normalizedPhone = order.customerPhone.replace(/\s/g, "");
        try {
          const depositReservation = await storage.findPaidDepositByPhone(
            restaurantId,
            normalizedPhone,
          );
          if (depositReservation && depositReservation.depositAmount) {
            const depositAmt = parseFloat(depositReservation.depositAmount);
            const orderTotal = parseFloat(order.total || "0");
            const discountAmt = Math.min(depositAmt, orderTotal); // don't exceed order total
            const newTotal = (orderTotal - discountAmt).toFixed(2);
            await storage.updateOrder(order.id, {
              discount: discountAmt.toFixed(2),
              total: newTotal,
            } as any);
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
        try {
          const normalizedPhone = order.customerPhone.replace(/\s/g, "");
          let customer = await storage.getCustomerByPhone(
            restaurantId,
            normalizedPhone,
          );
          if (customer) {
            await storage.updateCustomer(customer.id, {
              name: order.customerName || customer.name,
              address: order.customerAddress || customer.address,
              totalOrders: (customer.totalOrders || 0) + 1,
              totalSpent: String(
                parseFloat(customer.totalSpent || "0") +
                  parseFloat(order.total || "0"),
              ),
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
          if (customer?.id) {
            await storage.updateOrder(order.id, { customerId: customer.id });
          }
        } catch (customerErr) {
          console.error("Customer upsert error (non-fatal):", customerErr);
        }
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
          const invoiceNumber = await storage.getNextInvoiceNumber(
            restaurantId,
            order.branchId,
          );

          // Generate ZATCA XML for public orders too — use branch-level counter/hash
          const orderBranchId = order.branchId || null;
          const { counter: prevCounter, lastHash: prevHash } =
            await storage.getZatcaCounterAndHash(restaurantId, orderBranchId);
          const currentCounter = prevCounter + 1;
          const previousHash =
            prevHash ||
            Buffer.from(
              "NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==",
              "base64",
            ).toString("utf8");

          // Build itemized line items from request body items (not from DB, since items not yet saved)
          // req.body.items has already been validated by recalculateOrderTotals
          const pubMenuItemsRaw = await storage.getMenuItems(restaurantId);
          const pubMenuItemsMap = new Map(
            pubMenuItemsRaw.map((m) => [m.id, m]),
          );

          // Use request body items if available (items not yet saved to db at this point)
          const requestItems =
            req.body.items && Array.isArray(req.body.items)
              ? req.body.items
              : [];

          const xmlItems: ZatcaLineItem[] = requestItems.map(
            (item: any, idx: number) => {
              const menuItem = item.menuItemId
                ? pubMenuItemsMap.get(item.menuItemId)
                : null;
              const unitPrice = parseFloat(
                item.unitPrice || menuItem?.price || "0",
              );
              const qty = item.quantity || 1;
              const lineTotal = bankersRound(unitPrice * qty);
              const lineTax = bankersRound(lineTotal * (taxRatePercent / 100));
              return {
                id: String(idx + 1),
                nameAr:
                  menuItem?.nameAr ||
                  menuItem?.nameEn ||
                  item.itemName ||
                  "منتج",
                nameEn: menuItem?.nameEn || item.itemName || "",
                quantity: qty,
                unitPrice,
                discount: 0,
                taxRate: taxRatePercent,
                taxAmount: lineTax,
                totalWithTax: bankersRound(lineTotal + lineTax),
                totalWithoutTax: lineTotal,
              };
            },
          );

          // Calculate totals with banker's rounding
          const itemsSubtotal = bankersRound(
            xmlItems.reduce((sum, i) => sum + i.totalWithoutTax, 0),
          );
          const taxableAmt = bankersRound(
            Math.max(0, itemsSubtotal - orderDiscount + orderDeliveryFee),
          );
          const vatAmount = bankersRound(taxableAmt * (taxRatePercent / 100));
          const invoiceTotal = bankersRound(taxableAmt + vatAmount);

          const unsignedXmlContent = generateZatcaXml({
            uuid,
            invoiceNumber,
            invoiceType: "simplified",
            issueDate: now.toISOString().split("T")[0],
            issueTime: now.toTimeString().split(" ")[0],
            deliveryDate: now.toISOString().split("T")[0],
            seller: {
              nameAr: restaurant.nameAr || restaurant.nameEn || "مطعم",
              vatNumber: restaurant.vatNumber || "",
              commercialRegistration: restaurant.commercialRegistration || "",
              streetName: restaurant.streetName || "",
              buildingNumber: restaurant.buildingNumber || "",
              district: restaurant.district || "",
              city: restaurant.city || "",
              postalCode: restaurant.postalCode || "",
              country: restaurant.country || "SA",
            },
            items: xmlItems,
            subtotal: itemsSubtotal,
            discount: orderDiscount,
            deliveryFee: orderDeliveryFee,
            taxAmount: vatAmount,
            taxRate: taxRatePercent,
            total: invoiceTotal,
            paymentMethod: order.paymentMethod || "cash",
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
              cert =
                (br as any).zatcaProductionCsid ||
                (br as any).zatcaComplianceCsid ||
                (br as any).zatcaCertificate;
            }
          }
          if (!privKey && (restaurant as any).zatcaPrivateKey) {
            privKey = (restaurant as any).zatcaPrivateKey;
            cert =
              restaurant.zatcaProductionCsid ||
              restaurant.zatcaComplianceCsid ||
              restaurant.zatcaCertificate;
          }

          // Sign + QR pipeline
          const signResult = buildSignedInvoice(
            unsignedXmlContent,
            privKey,
            cert,
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
            discount: orderDiscount.toFixed(2),
            deliveryFee: orderDeliveryFee.toFixed(2),
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
            paymentMethod: order.paymentMethod || "cash",
            signedXml: signResult.signedXml || null,
          });

          // Update branch-level (and restaurant-level) counter and hash
          await storage.updateZatcaCounterAndHash(
            restaurantId,
            orderBranchId,
            currentCounter,
            invoiceHash,
          );
        } catch (invoiceError) {
          console.error("Invoice creation error (public order):", invoiceError);
        }

        // Update day session totals atomically for public order
        try {
          const currentSession2 = await storage.getCurrentDaySession(
            restaurantId,
            order.branchId || undefined,
          );
          if (currentSession2) {
            const orderTotal = parseFloat(order.total || "0");
            await storage.incrementDaySessionTotals(
              currentSession2.id,
              orderTotal,
              order.paymentMethod || "cash",
            );
          }
        } catch (e) {
          console.error("Failed to update day session totals (public):", e);
        }

        // Real-time notification for public QR/table orders
        try {
          wsManager.notifyNewOrder(order.restaurantId, order.branchId || "", order);
        } catch (e) {
          console.error("Failed to send WebSocket notification (public order):", e);
        }
      } // end if not payment_pending

      res.status(201).json(order);
    } catch (error) {
      console.error("Public order error:", error);
      res.status(400).json({ error: "Failed to create order" });
    }
  });

  app.post(
    "/api/public/:restaurantId/orders/:orderId/items",
    async (req, res) => {
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
        if (
          !menuItem ||
          menuItem.restaurantId !== res.locals.restaurantId ||
          !menuItem.isAvailable
        ) {
          return res
            .status(404)
            .json({ error: "Menu item not found or unavailable" });
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
    },
  );

  app.get(
    "/api/public/:restaurantId/tables/:tableId/active-order",
    async (req, res) => {
      try {
        const { restaurantId: restaurantIdOrSlug, tableId } = req.params;

        // Resolve restaurant ID from slug or ID
        const resolvedRestaurantId =
          await storage.resolveRestaurantId(restaurantIdOrSlug);
        if (!resolvedRestaurantId) {
          return res.status(404).json({ error: "Restaurant not found" });
        }

        const table = await storage.getTable(tableId);
        if (!table || table.restaurantId !== resolvedRestaurantId) {
          return res.status(404).json({ error: "Table not found" });
        }

        const order = await storage.getActiveOrderByTable(tableId);
        if (!order || order.restaurantId !== resolvedRestaurantId) {
          return res.json({ hasActiveOrder: false });
        }

        const orderItems = await storage.getOrderItems(order.id);
        const menuItems = await storage.getMenuItems(resolvedRestaurantId);
        const itemsWithDetails = orderItems.map((item: any) => {
          const menuItem = menuItems.find((m: any) => m.id === item.menuItemId);
          return {
            ...item,
            menuItem: menuItem
              ? {
                  nameEn: menuItem.nameEn,
                  nameAr: menuItem.nameAr,
                  price: menuItem.price,
                }
              : null,
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
            tableName: (table as any)?.name || null,
            tableNumber: table?.tableNumber || (table as any)?.name || null,
          },
        });
      } catch (error) {
        res.status(500).json({ error: "Failed to get active order" });
      }
    },
  );

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

  app.get(
    "/api/public/:restaurantId/orders/:orderId/items",
    async (req, res) => {
      try {
        const order = await storage.getOrder(req.params.orderId);
        if (!order || order.restaurantId !== res.locals.restaurantId) {
          return res.status(404).json({ error: "Order not found" });
        }
        const orderItemsList = await storage.getOrderItems(req.params.orderId);
        const itemsWithDetails = await Promise.all(
          orderItemsList.map(async (item: any) => {
            const menuItem = item.menuItemId
              ? await storage.getMenuItem(item.menuItemId)
              : null;
            return {
              ...item,
              menuItem: menuItem
                ? {
                    nameEn: menuItem.nameEn,
                    nameAr: menuItem.nameAr,
                    price: menuItem.price,
                  }
                : item.itemName
                  ? {
                      nameEn: item.itemName,
                      nameAr: item.itemName,
                      price: item.unitPrice,
                    }
                  : null,
            };
          }),
        );
        res.json(itemsWithDetails);
      } catch (error) {
        res.status(500).json({ error: "Failed to get order items" });
      }
    },
  );

  app.get(
    "/api/public/:restaurantId/customers/:customerId/orders",
    async (req, res) => {
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
          .sort(
            (a: any, b: any) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
        res.json(customerOrders);
      } catch (error) {
        res.status(500).json({ error: "Failed to get customer orders" });
      }
    },
  );

  // Public: Get all variants (grouped by menuItemId)
  app.get("/api/public/:restaurantId/all-variants", async (req, res) => {
    try {
      const restaurantId = res.locals.restaurantId;
      const allMenuItems = await storage.getMenuItems(restaurantId);
      const variantsMap: Record<string, any[]> = {};
      
      await Promise.all(allMenuItems.map(async (item) => {
        const variants = await storage.getMenuItemVariants(item.id);
        if (variants && variants.length > 0) {
          variantsMap[item.id] = variants;
        }
      }));
      res.json(variantsMap);
    } catch (error) {
      res.status(500).json({ error: "Failed to get variants" });
    }
  });

  // Public: Get all customizations (grouped by menuItemId)
  app.get("/api/public/:restaurantId/all-customizations", async (req, res) => {
    try {
      const restaurantId = res.locals.restaurantId;
      const allMenuItems = await storage.getMenuItems(restaurantId);
      const customizationsMap: Record<string, any[]> = {};
      
      await Promise.all(allMenuItems.map(async (item) => {
        const customizations = await storage.getMenuItemCustomizations(item.id);
        if (customizations && customizations.length > 0) {
           customizationsMap[item.id] = customizations;
        }
      }));
      res.json(customizationsMap);
    } catch (error) {
      res.status(500).json({ error: "Failed to get customizations" });
    }
  });

  // Public: Get day session status
  app.get("/api/public/:restaurantId/day-session/status", async (req, res) => {
      try {
        const restaurantId = res.locals.restaurantId;
        const branchParam = req.query.branch as string | undefined;
        let branchId = undefined;
        if (branchParam) {
           const resolvedBranch = await storage.resolveBranchId(restaurantId, branchParam);
           if (resolvedBranch) branchId = resolvedBranch;
        }
        
        const session = await storage.getCurrentDaySession(restaurantId, branchId);
        res.json({ isOpen: !!session, session: session || null });
      } catch (error) {
        res.status(500).json({ error: "Failed to get day session status" });
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
        const resolvedBranch = await storage.resolveBranchId(
          restaurantId,
          req.body.branchId,
        );
        validBranchId = resolvedBranch || undefined;
      }

      // Validate required fields
      if (
        !req.body.customerName ||
        !req.body.customerPhone ||
        !req.body.reservationDate ||
        !req.body.reservationTime
      ) {
        return res.status(400).json({
          error: "missingFields",
          message: "Name, phone, date, and time are required",
        });
      }
      if (!req.body.guestCount && !req.body.partySize) {
        return res
          .status(400)
          .json({ error: "missingFields", message: "Guest count is required" });
      }

      // Validate phone number format
      const phoneValidation = validatePhoneNumber(req.body.customerPhone);
      if (!phoneValidation.valid) {
        return res
          .status(400)
          .json({ error: "invalidPhone", message: phoneValidation.error });
      }

      // Reject past reservation dates/times
      const requestedDateTime = new Date(
        `${req.body.reservationDate.split("T")[0]}T${req.body.reservationTime}:00`,
      );
      if (requestedDateTime <= new Date()) {
        return res
          .status(400)
          .json({ error: "pastDateTime", message: "لا يمكن الحجز في الماضي" });
      }

      // Use restaurant settings for duration and deposit
      const defaultDuration = (restaurant as any).reservationDuration || 90;
      const depositAmount =
        (restaurant as any).reservationDepositAmount || "20.00";
      const depositRequired =
        (restaurant as any).reservationDepositRequired !== false;

      // Convert reservationDate string to Date object for schema validation
      const reservationDateValue = req.body.reservationDate
        ? new Date(req.body.reservationDate)
        : undefined;

      const tableId =
        req.body.tableId && req.body.tableId !== "any"
          ? req.body.tableId
          : null;
      const reservationTime = req.body.reservationTime;
      const duration = parseInt(req.body.duration) || defaultDuration;

      // Check for table conflict if a specific table is selected
      if (tableId && reservationDateValue && reservationTime) {
        const conflict = await storage.checkTableConflict(
          restaurantId,
          tableId,
          reservationDateValue,
          reservationTime,
          duration,
        );
        if (conflict) {
          return res.status(409).json({
            error: "tableConflict",
            message: `Table is already booked at this time (${conflict.reservationTime} - ${conflict.customerName})`,
            conflictWith: {
              time: conflict.reservationTime,
              customerName: conflict.customerName,
            },
          });
        }
      }

      const guestCount =
        parseInt(req.body.guestCount) || parseInt(req.body.partySize) || 2;

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
  app.post(
    "/api/public/:restaurantId/reservation-payment-session",
    async (req, res) => {
      try {
        const restaurantId = res.locals.restaurantId;
        const {
          reservationId,
          amount,
          callbackUrl,
          payerEmail,
          payerPhone,
          payerName,
        } = req.body;
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
          return res.status(500).json({
            error: "Payment gateway not configured",
            configured: false,
          });
        }

        let clientIp =
          (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
          req.socket.remoteAddress ||
          "127.0.0.1";
        if (clientIp.startsWith("::ffff:"))
          clientIp = clientIp.replace("::ffff:", "");
        if (clientIp === "::1") clientIp = "127.0.0.1";

        // Build webhook notification URL
        const protocol =
          req.headers["x-forwarded-proto"] || req.protocol || "https";
        const host =
          req.headers["x-forwarded-host"] ||
          req.headers.host ||
          "tryingpos.com";
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
          payerEmail: payerEmail || `reservation@tryingpos.com`,
          payerPhone: payerPhone || "0500000000",
          payerIp: clientIp,
          callbackUrl,
          notificationUrl,
        });

        if (edfaResult.redirect_url) {
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
    },
  );

  // Public: Complete reservation payment (EdfaPay)
  app.post(
    "/api/public/:restaurantId/reservation-payment-complete",
    async (req, res) => {
      try {
        const restaurantId = res.locals.restaurantId;
        const { reservationId, transId, gwayId } = req.body;
        if (!reservationId) {
          return res.status(400).json({ error: "Missing reservationId" });
        }

        // First check if webhook already marked the reservation as paid
        const existingReservation = await storage.getReservation(reservationId);
        if (existingReservation?.depositPaid) {
          console.log(
            `[Reservation Complete] Reservation ${reservationId} already paid (webhook handled)`,
          );
          return res.json({ success: true, reservation: existingReservation });
        }

        const restaurant = await storage.getRestaurantById(restaurantId);
        if (!restaurant) {
          return res.status(404).json({ error: "Restaurant not found" });
        }

        let paymentVerified = false;

        if (
          gwayId &&
          restaurant.edfapayMerchantId &&
          restaurant.edfapayPassword
        ) {
          try {
            const statusResult = await edfapay.getTransactionStatus({
              merchantId: restaurant.edfapayMerchantId,
              password: restaurant.edfapayPassword,
              gwayPaymentId: gwayId,
              orderId: reservationId,
            });
            console.log(
              `[Reservation Complete] EdfaPay status for ${reservationId}: ${statusResult.status}`,
            );
            paymentVerified = edfapay.isSuccessfulPayment(statusResult.status);
          } catch (e) {
            console.error("EdfaPay status check error:", e);
          }
        }

        if (paymentVerified) {
          const depositCode = generateDepositCode();
          await storage.updateReservation(reservationId, {
            depositPaid: true,
            depositCode,
          } as any);
          const reservation = await storage.getReservation(reservationId);
          console.log(
            `[Reservation Complete] Reservation ${reservationId} paid, code: ${depositCode}`,
          );
          res.json({ success: true, reservation, depositCode });
        } else {
          res.status(400).json({ error: "Payment not verified yet" });
        }
      } catch (error) {
        console.error("Reservation payment complete error:", error);
        res
          .status(500)
          .json({ error: "Failed to complete reservation payment" });
      }
    },
  );

  // Public: Join queue (customer self-service)
  app.post("/api/public/:restaurantId/queue", async (req, res) => {
    try {
      const restaurantId = res.locals.restaurantId;
      const restaurant = await storage.getRestaurantById(restaurantId);
      if (!restaurant) {
        return res.status(404).json({ error: "Restaurant not found" });
      }

      // Validate phone number
      const phone = (req.body.customerPhone || "").toString().trim();
      const phoneValidation = validatePhoneNumber(phone);
      if (!phoneValidation.valid) {
        return res.status(400).json({ error: phoneValidation.error });
      }

      let validBranchId: string | undefined = undefined;
      if (req.body.branchId) {
        const resolvedBranch = await storage.resolveBranchId(
          restaurantId,
          req.body.branchId,
        );
        validBranchId = resolvedBranch || undefined;
      }

      // Check if day session is open
      const currentSession = await storage.getCurrentDaySession(
        restaurantId,
        validBranchId,
      );
      if (!currentSession) {
        return res.status(400).json({
          error: "daySessionClosed",
          message: "Restaurant has not opened day session yet",
        });
      }

      const queueNumber = await storage.getNextQueueNumber(
        restaurantId,
        validBranchId,
      );
      const estimatedWait = await storage.getEstimatedWaitTime(
        restaurantId,
        validBranchId,
      );

      const queueData: any = {
        restaurantId,
        branchId: validBranchId || null,
        customerName: req.body.customerName,
        customerPhone: phone,
        partySize: parseInt(req.body.partySize) || 1,
        queueNumber,
        estimatedWaitMinutes: estimatedWait,
        status: "waiting",
      };

      const entry = await storage.createQueueEntry(queueData);
      res.status(201).json({
        ...entry,
        position: queueNumber,
        estimatedWaitMinutes: estimatedWait,
      });
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
      // Count both "waiting" and "notified" — notified customers are still present and waiting to be seated
      const waitingEntries = await storage.getQueueEntries(restaurantId, branchId, "waiting");
      const notifiedEntries = await storage.getQueueEntries(restaurantId, branchId, "notified");
      const estimatedWait = await storage.getEstimatedWaitTime(
        restaurantId,
        branchId,
      );
      res.json({
        waitingCount: waitingEntries.length + notifiedEntries.length,
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
      const availableTables = allTables.filter(
        (t: any) => t.status === "available",
      );
      res.json(
        availableTables.map((t: any) => ({
          id: t.id,
          tableNumber: t.tableNumber,
          capacity: t.capacity,
          location: t.location,
        })),
      );
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
      const session = await storage.getCurrentDaySession(
        restaurantId,
        branchId,
      );
      res.json({ isOpen: !!session, session: session || null });
    } catch (error) {
      res.status(500).json({ error: "Failed to get day session status" });
    }
  });

  // Public: Get menu item variants
  app.get(
    "/api/public/:restaurantId/menu-items/:menuItemId/variants",
    async (req, res) => {
      try {
        const variants = await storage.getMenuItemVariants(
          req.params.menuItemId,
        );
        res.json(variants.filter((v: any) => v.isAvailable !== false));
      } catch (error) {
        res.status(500).json({ error: "Failed to get variants" });
      }
    },
  );

  // Public: Get all variants for all menu items (batch)
  app.get("/api/public/:restaurantId/all-variants", async (req, res) => {
    try {
      const items = await storage.getMenuItems(res.locals.restaurantId);
      const allVariants: Record<string, any[]> = {};
      for (const item of items) {
        const variants = await storage.getMenuItemVariants(item.id);
        if (variants.length > 0) {
          allVariants[item.id] = variants.filter(
            (v: any) => v.isAvailable !== false,
          );
        }
      }
      res.json(allVariants);
    } catch (error) {
      res.status(500).json({ error: "Failed to get variants" });
    }
  });

  // Public: Get customization groups for a menu item
  app.get(
    "/api/public/:restaurantId/menu-items/:menuItemId/customizations",
    async (req, res) => {
      try {
        const menuItemId = req.params.menuItemId;
        const links = await storage.getMenuItemCustomizations(menuItemId);
        const groups = [];
        for (const link of links) {
          const group = await storage.getCustomizationGroup(
            link.customizationGroupId,
          );
          if (group) {
            const options = await storage.getCustomizationOptions(group.id);
            groups.push({
              ...group,
              options: options.filter((o: any) => o.isAvailable !== false),
            });
          }
        }
        res.json(groups);
      } catch (error) {
        res.status(500).json({ error: "Failed to get customizations" });
      }
    },
  );

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
            const group = await storage.getCustomizationGroup(
              link.customizationGroupId,
            );
            if (group) {
              const options = await storage.getCustomizationOptions(group.id);
              groups.push({
                ...group,
                options: options.filter((o: any) => o.isAvailable !== false),
              });
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

  // Invoice Audit Log — accessible to any authenticated user of the restaurant
  app.get("/api/invoice-audit-log", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      if (req.query.limit && isNaN(Number(req.query.limit))) {
        return res.status(400).json({ error: "Invalid limit" });
      }
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const logs = await storage.getInvoiceAuditLogs(restaurantId, limit);
      res.json(logs);
    } catch (error: any) {
       handleRouteError(res, error, "Failed to get audit logs");
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
      const { edfapayPassword, edfapaySoftposAuthToken, ...safeRestaurant } =
        restaurant as any;
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
      .replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+/g, "") // strip Arabic
      .replace(/[^a-z0-9\s-]/g, "") // keep only English letters, numbers, spaces, hyphens
      .replace(/[\s_]+/g, "-") // Replace spaces/underscores with hyphens
      .replace(/-+/g, "-") // Collapse multiple hyphens
      .replace(/^-|-$/g, ""); // Trim hyphens from start/end
  }

  app.put("/api/restaurant", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const caller = await getAuthenticatedUser(req);

      // ✅ Validate email format if provided
      if (req.body.email) {
        const emailValidation = validateEmail(req.body.email);
        if (!emailValidation.valid) {
          return res
            .status(400)
            .json({ error: emailValidation.error, code: "INVALID_EMAIL" });
        }
        req.body.email = normalizeEmail(req.body.email);
      }

      // ✅ Validate phone format if provided
      if (req.body.phone) {
        const phoneValidation = validatePhoneNumber(req.body.phone);
        if (!phoneValidation.valid) {
          return res
            .status(400)
            .json({ error: phoneValidation.error, code: "INVALID_PHONE" });
        }
        req.body.phone = normalizeMobilePhone(req.body.phone);
      }

      // ✅ Validate ownerPhone format if provided
      if (req.body.ownerPhone) {
        const phoneValidation = validatePhoneNumber(req.body.ownerPhone);
        if (!phoneValidation.valid) {
          return res.status(400).json({
            error: `Owner Phone: ${phoneValidation.error}`,
            code: "INVALID_OWNER_PHONE",
          });
        }
        req.body.ownerPhone = normalizeMobilePhone(req.body.ownerPhone);
      }

      const data = insertRestaurantSchema.partial().parse(req.body);

      // Protect business fields - once saved, only platform_admin can modify
      const lockedFields = [
        "vatNumber",
        "commercialRegistration",
        "ownerName",
        "ownerPhone",
        "postalCode",
        "buildingNumber",
        "streetName",
        "district",
        "city",
        "bankName",
        "bankAccountHolder",
        "bankAccountNumber",
        "bankSwift",
        "bankIban",
      ] as const;
      const current = await storage.getRestaurantById(restaurantId);
      if (current && caller.role !== "platform_admin") {
        for (const field of lockedFields) {
          const currentValue = (current as any)[field];
          const newValue = (data as any)[field];
          // If field already has a value and user is trying to change it, only allow platform_admin
          if (
            currentValue &&
            String(currentValue).trim() !== "" &&
            newValue !== undefined &&
            newValue !== currentValue
          ) {
            return res.status(403).json({
              error: `لا يمكن تعديل ${field} - هذا الحقل مقفل. تواصل مع إدارة المنصة للتعديل`,
              code: "LOCKED_FIELD",
            });
          }
        }
      }

      // Only platform_admin can set/change SoftPOS auth token
      if (caller.role !== "platform_admin") {
        delete (data as any).edfapaySoftposAuthToken;
      }

      // Auto-generate slug from English name if slug not set
      if (
        current &&
        !(current as any).slug &&
        (data.nameEn || current.nameEn)
      ) {
        (data as any).slug = generateSlug(data.nameEn || current.nameEn);
      }

      const restaurant = await storage.updateRestaurantById(restaurantId, data);

      // Audit log if tax settings changed
      if (
        data.taxEnabled !== undefined ||
        (data as any).vatNumber !== undefined
      ) {
        const userIp =
          req.ip || (req.headers["x-forwarded-for"] as string) || "unknown";
        await storage.createInvoiceAuditLog({
          restaurantId,
          action: "tax_settings_changed",
          userName: caller.name || caller.email || "Unknown",
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

      try {
        wsManager.notifyDataChanged(restaurantId, "restaurant", "updated");
      } catch {}
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
      const restaurant = await storage.updateRestaurantById(restaurantId, {
        slug: cleanSlug,
      } as any);
      res.json(restaurant);
    } catch (error) {
      handleRouteError(res, error, "Failed to update slug");
    }
  });

  // Categories
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getCategories(
        await getRestaurantId(req),
      );
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
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
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
      try {
        wsManager.notifyDataChanged(data.restaurantId, "categories", "created");
      } catch {}
      res.status(201).json(category);
    } catch (error) {
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.put("/api/categories/:id", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const data = insertCategorySchema.parse({
        ...req.body,
        restaurantId,
      });
      const category = await storage.updateCategory(req.params.id, data);
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      try {
        wsManager.notifyDataChanged(restaurantId, "categories", "updated");
      } catch {}
      res.json(category);
    } catch (error) {
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.delete("/api/categories/:id", async (req, res) => {
    try {
      const category = await storage.getCategory(req.params.id);
      if (!category)
        return res.status(404).json({ error: "Category not found" });
      await verifyOwnership(req, category, "Category");
      await storage.deleteCategory(req.params.id);
      try {
        wsManager.notifyDataChanged(
          category.restaurantId,
          "categories",
          "deleted",
        );
      } catch {}
      res.status(204).send();
    } catch (error: any) {
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
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
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
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
      try {
        wsManager.notifyDataChanged(
          restaurantId,
          "kitchen-sections",
          "created",
        );
      } catch {}
      res.status(201).json(section);
    } catch (error) {
      console.error("Error in POST /api/kitchen-sections:", error);
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.put("/api/kitchen-sections/:id", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const data = insertKitchenSectionSchema.parse({
        ...req.body,
        restaurantId,
      });
      const section = await storage.updateKitchenSection(req.params.id, data);
      if (!section) {
        return res.status(404).json({ error: "Kitchen section not found" });
      }
      try {
        wsManager.notifyDataChanged(
          restaurantId,
          "kitchen-sections",
          "updated",
        );
      } catch {}
      res.json(section);
    } catch (error) {
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.delete("/api/kitchen-sections/:id", async (req, res) => {
    try {
      const section = await storage.getKitchenSection(req.params.id);
      if (!section)
        return res.status(404).json({ error: "Kitchen section not found" });
      await verifyOwnership(req, section, "Kitchen section");
      await storage.deleteKitchenSection(req.params.id);
      try {
        wsManager.notifyDataChanged(
          section.restaurantId,
          "kitchen-sections",
          "deleted",
        );
      } catch {}
      res.status(204).send();
    } catch (error: any) {
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
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
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to get menu item" });
    }
  });

  app.post("/api/menu-items", async (req, res) => {
    try {
      const body = { ...req.body };
      if (body.kitchenSectionId === "" || body.kitchenSectionId === "__none__")
        body.kitchenSectionId = null;
      const parsedPrice = parseFloat(body.price);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({ error: "السعر يجب أن يكون رقماً موجباً / Price must be a positive number" });
      }
      const data = insertMenuItemSchema.parse({
        ...body,
        restaurantId: await getRestaurantId(req),
      });
      const item = await storage.createMenuItem(data);
      try {
        wsManager.notifyDataChanged(data.restaurantId, "menu-items", "created");
      } catch {}
      res.status(201).json(item);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.put("/api/menu-items/:id", async (req, res) => {
    try {
      console.log(
        "[PUT /api/menu-items/:id] Body keys:",
        Object.keys(req.body || {}),
      );
      console.log(
        "[PUT /api/menu-items/:id] Body:",
        JSON.stringify(req.body).substring(0, 500),
      );
      const body = { ...req.body };
      if (body.kitchenSectionId === "" || body.kitchenSectionId === "__none__")
        body.kitchenSectionId = null;
      const restaurantId = await getRestaurantId(req);
      console.log("[PUT /api/menu-items/:id] restaurantId:", restaurantId);

      // Build update data - accept all fields flexibly
      const data: any = {
        restaurantId,
        nameEn: body.nameEn,
        nameAr: body.nameAr,
        categoryId: body.categoryId,
        price: String(body.price),
        kitchenSectionId: body.kitchenSectionId || null,
        descriptionEn: body.descriptionEn || null,
        descriptionAr: body.descriptionAr || null,
        image: body.image || null,
        isAvailable: body.isAvailable ?? true,
        sortOrder: body.sortOrder != null ? Number(body.sortOrder) : 0,
        prepTime:
          body.prepTime != null && body.prepTime !== ""
            ? Number(body.prepTime)
            : null,
        calories:
          body.calories != null && body.calories !== ""
            ? Number(body.calories)
            : null,
        sugar:
          body.sugar != null && body.sugar !== "" ? String(body.sugar) : null,
        fat: body.fat != null && body.fat !== "" ? String(body.fat) : null,
        saturatedFat:
          body.saturatedFat != null && body.saturatedFat !== ""
            ? String(body.saturatedFat)
            : null,
        sodium:
          body.sodium != null && body.sodium !== ""
            ? String(body.sodium)
            : null,
        protein:
          body.protein != null && body.protein !== ""
            ? String(body.protein)
            : null,
        carbs:
          body.carbs != null && body.carbs !== "" ? String(body.carbs) : null,
        fiber:
          body.fiber != null && body.fiber !== "" ? String(body.fiber) : null,
        caffeine:
          body.caffeine != null && body.caffeine !== ""
            ? String(body.caffeine)
            : null,
        allergens: body.allergens || [],
        isHighSodium: body.isHighSodium ?? false,
        isSpicy: body.isSpicy ?? false,
        isVegetarian: body.isVegetarian ?? false,
        isVegan: body.isVegan ?? false,
        isGlutenFree: body.isGlutenFree ?? false,
        isNew: body.isNew ?? false,
        isBestseller: body.isBestseller ?? false,
        walkingMinutes:
          body.walkingMinutes != null && body.walkingMinutes !== ""
            ? Number(body.walkingMinutes)
            : null,
        runningMinutes:
          body.runningMinutes != null && body.runningMinutes !== ""
            ? Number(body.runningMinutes)
            : null,
      };

      if (!data.nameEn || !data.nameAr || !data.categoryId || !data.price) {
        console.log(
          "[PUT /api/menu-items/:id] Missing fields - nameEn:",
          data.nameEn,
          "nameAr:",
          data.nameAr,
          "categoryId:",
          data.categoryId,
          "price:",
          data.price,
        );
        return res.status(400).json({
          error: "Missing required fields: nameEn, nameAr, categoryId, price",
        });
      }

      const parsedPrice = parseFloat(data.price);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({ error: "السعر يجب أن يكون رقماً موجباً / Price must be a positive number" });
      }

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
            const integrations =
              await storage.getDeliveryIntegrations(restaurantId);
            for (const integration of integrations) {
              if (!integration.isActive) continue;

              if (integration.platform === "jahez") {
                // Jahez: update product visibility via API
                try {
                  await jahez.updateProductVisibility(
                    integration,
                    item.id,
                    item.isAvailable ?? false,
                  );
                  console.log(
                    `[Menu Sync] Jahez: Product ${item.id} visibility → ${item.isAvailable}`,
                  );
                } catch (err: any) {
                  console.error(
                    `[Menu Sync] Jahez visibility update failed for ${item.id}:`,
                    err.message,
                  );
                }
              } else if (integration.platform === "hungerstation") {
                // HungerStation: update product active status via Catalog API
                // Uses item.id as SKU identifier
                try {
                  const result = await hungerstation.updateProductAvailability(
                    integration,
                    item.id, // SKU = our menu item ID
                    item.isAvailable ?? false,
                  );
                  console.log(
                    `[Menu Sync] HungerStation: Product ${item.id} active → ${item.isAvailable}, job_id: ${result?.job_id}`,
                  );
                } catch (err: any) {
                  console.error(
                    `[Menu Sync] HungerStation availability update failed for ${item.id}:`,
                    err.message,
                  );
                }
              }
            }
          } catch (err: any) {
            console.error(
              "[Menu Sync] Error syncing availability:",
              err.message,
            );
          }
        })();
      }

      // Sync price change to delivery platforms (async, non-blocking)
      if (oldItem && oldItem.price !== item.price) {
        (async () => {
          try {
            const integrations =
              await storage.getDeliveryIntegrations(restaurantId);
            for (const integration of integrations) {
              if (!integration.isActive) continue;

              if (integration.platform === "hungerstation") {
                try {
                  const result = await hungerstation.updateProductPrice(
                    integration,
                    item.id,
                    parseFloat(item.price),
                    item.isAvailable ?? true,
                  );
                  console.log(
                    `[Menu Sync] HungerStation: Product ${item.id} price → ${item.price}, job_id: ${result?.job_id}`,
                  );
                } catch (err: any) {
                  console.error(
                    `[Menu Sync] HungerStation price update failed for ${item.id}:`,
                    err.message,
                  );
                }
              } else if (integration.platform === "jahez") {
                // Jahez: sync the full product to update price
                try {
                  await jahez.syncProduct(integration, {
                    product_id: item.id,
                    product_price: parseFloat(item.price),
                    category_id: item.categoryId || "",
                    name: { ar: item.nameAr || "", en: item.nameEn || "" },
                    description: {
                      ar: item.descriptionAr || "",
                      en: item.descriptionEn || "",
                    },
                    image_path: item.image || "",
                    calories: item.calories || 0,
                    is_visible: item.isAvailable !== false,
                  });
                  console.log(
                    `[Menu Sync] Jahez: Product ${item.id} price → ${item.price}`,
                  );
                } catch (err: any) {
                  console.error(
                    `[Menu Sync] Jahez price update failed for ${item.id}:`,
                    err.message,
                  );
                }
              }
            }
          } catch (err: any) {
            console.error("[Menu Sync] Error syncing price:", err.message);
          }
        })();
      }

      try {
        wsManager.notifyDataChanged(restaurantId, "menu-items", "updated");
      } catch {}
      res.json(item);
    } catch (error: any) {
      console.error(
        "[PUT /api/menu-items/:id] Error:",
        error?.message || error,
      );
      res.status(400).json({ error: error?.message || "Invalid request body" });
    }
  });

  app.delete("/api/menu-items/:id", async (req, res) => {
    try {
      const item = await storage.getMenuItem(req.params.id);
      if (!item) return res.status(404).json({ error: "Menu item not found" });
      await verifyOwnership(req, item, "Menu item");
      await storage.deleteMenuItem(req.params.id);
      try {
        wsManager.notifyDataChanged(item.restaurantId, "menu-items", "deleted");
      } catch {}

      // Sync deletion to delivery platforms (async, non-blocking)
      (async () => {
        try {
          const integrations = await storage.getDeliveryIntegrations(
            item.restaurantId,
          );
          for (const integration of integrations) {
            if (!integration.isActive) continue;
            if (integration.platform === "jahez") {
              try {
                await jahez.deleteProduct(integration, item.id);
                console.log(`[Menu Sync] Jahez: Product ${item.id} deleted`);
              } catch (err: any) {
                console.error(
                  `[Menu Sync] Jahez delete failed for ${item.id}:`,
                  err.message,
                );
              }
            }
          }
        } catch (err: any) {
          console.error("[Menu Sync] Error syncing deletion:", err.message);
        }
      })();

      res.status(204).send();
    } catch (error: any) {
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to delete menu item" });
    }
  });

  // Tables
  app.get("/api/tables", async (req, res) => {
    try {
      const authUser = await getAuthenticatedUser(req);
      const restaurantId = authUser.restaurantId!;
      const isLockedEmployee = ["cashier", "waiter", "kitchen", "delivery"].includes(authUser.role || "");
      let branchId: string | undefined;
      if (isLockedEmployee && authUser.branchId) {
        branchId = authUser.branchId;
      } else {
        branchId = req.query.branch as string | undefined;
      }
      const tables = await storage.getTables(restaurantId, branchId);
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
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
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
        if (!branches.some((b) => b.id === branchId)) {
          return res.status(400).json({ error: "Invalid branch" });
        }
      }

      const data = insertTableSchema.parse({
        ...req.body,
        restaurantId,
        branchId,
      });
      const table = await storage.createTable(data);
      try {
        wsManager.notifyDataChanged(restaurantId, "tables", "created");
      } catch {}
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
        if (!branches.some((b) => b.id === branchId)) {
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
      try {
        wsManager.notifyDataChanged(restaurantId, "tables", "updated");
      } catch {}
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
      try {
        wsManager.notifyDataChanged(existing.restaurantId, "tables", "updated");
      } catch {}
      res.json(table);
    } catch (error: any) {
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to update table status" });
    }
  });

  app.delete("/api/tables/:id", async (req, res) => {
    try {
      const table = await storage.getTable(req.params.id);
      if (!table) return res.status(404).json({ error: "Table not found" });
      await verifyOwnership(req, table, "Table");
      await storage.deleteTable(req.params.id);
      try {
        wsManager.notifyDataChanged(table.restaurantId, "tables", "deleted");
      } catch {}
      res.status(204).send();
    } catch (error: any) {
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
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
      const itemsWithNames = await Promise.all(
        items.map(async (item) => {
          const menuItem = item.menuItemId
            ? await storage.getMenuItem(item.menuItemId)
            : null;
          return {
            ...item,
            nameEn: menuItem?.nameEn || "",
            nameAr: menuItem?.nameAr || "",
          };
        }),
      );
      res.json({ ...order, items: itemsWithNames });
    } catch (error) {
      res.status(500).json({ error: "Failed to get active order" });
    }
  });

  app.post("/api/tables/:id/settle", async (req, res) => {
    try {
      const { paymentMethod, splitCashAmount, splitCardAmount } = req.body;
      const tableEntity = await storage.getTable(req.params.id);
      if (!tableEntity)
        return res.status(404).json({ error: "Table not found" });
      await verifyOwnership(req, tableEntity, "Table");
      const order = await storage.getActiveOrderByTable(req.params.id);
      if (!order) {
        return res
          .status(404)
          .json({ error: "No active order found for this table" });
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
      const orderInvoice = invoicesList.find((inv) => inv.orderId === order.id);
      if (orderInvoice) {
        await storage.updateInvoice(orderInvoice.id, {
          paymentMethod,
          isPaid: true,
        });
      }

      await storage.updateTableStatus(req.params.id, "available");

      const updatedOrder = await storage.getOrder(order.id);
      try {
        wsManager.notifyDataChanged(order.restaurantId, "tables", "updated");
        wsManager.notifyDataChanged(order.restaurantId, "orders", "updated");
        wsManager.notifyDataChanged(order.restaurantId, "invoices", "updated");
      } catch {}
      res.json(updatedOrder);
    } catch (error) {
      console.error("Table settle error:", error);
      res.status(500).json({ error: "Failed to settle table" });
    }
  });

  // Orders
  app.get("/api/orders", async (req, res) => {
    try {
      const authUser = await getAuthenticatedUser(req);
      const restaurantId = authUser.restaurantId!;
      const isOwnerLike = authUser.role === "owner" || authUser.role === "platform_admin" || authUser.role === "admin";
      // Branch isolation:
      // - Employees (cashier/waiter/kitchen/delivery) are LOCKED to their assigned branch
      // - Owners, admins, branch_managers can pick any branch via ?branch= query param
      const isLockedEmployee = ["cashier", "waiter", "kitchen", "delivery"].includes(authUser.role || "");
      let branchId: string | undefined;
      if (isLockedEmployee && authUser.branchId) {
        // Employee forced to their assigned branch
        branchId = authUser.branchId;
      } else {
        // Owner/admin/manager: use ?branch= from app branch picker (or no filter if not set)
        branchId = req.query.branch as string | undefined;
      }
      const period = (req.query.period as string) || "today"; // today, week, archived, all

      let orders = await storage.getOrders(
        restaurantId,
        branchId,
      );
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Filter by period
      switch (period) {
        case "today": {
          orders = orders.filter((o) => {
            if (!o.createdAt) return false;
            const orderDate = new Date(o.createdAt);
            const orderDateOnly = new Date(
              orderDate.getFullYear(),
              orderDate.getMonth(),
              orderDate.getDate(),
            );
            return orderDateOnly.getTime() === today.getTime();
          });
          break;
        }
        case "week": {
          orders = orders.filter((o) => {
            if (!o.createdAt) return false;
            const orderDate = new Date(o.createdAt);
            const orderDateOnly = new Date(
              orderDate.getFullYear(),
              orderDate.getMonth(),
              orderDate.getDate(),
            );
            return (
              orderDateOnly.getTime() >= weekAgo.getTime() &&
              orderDateOnly.getTime() < today.getTime()
            );
          });
          break;
        }
        case "archived": {
          orders = orders.filter((o) => (o as any).isArchived === true);
          break;
        }
        case "all":
        default:
          // No filter
          break;
      }

      if (orders.length === 0) {
        return res.json([]);
      }

      const orderIds = orders.map((order) => order.id);
      const allItems = await db
        .select()
        .from(orderItemsTable)
        .where(inArray(orderItemsTable.orderId, orderIds));

      const menuItemIds = Array.from(
        new Set(
          allItems
            .filter((item: any) => item.menuItemId && !item.itemName)
            .map((item: any) => item.menuItemId as string),
        ),
      );

      const menuItemNameMap = new Map<string, string | null>();
      if (menuItemIds.length > 0) {
        const menuRows = await db
          .select({
            id: menuItemsTable.id,
            nameAr: menuItemsTable.nameAr,
            nameEn: menuItemsTable.nameEn,
          })
          .from(menuItemsTable)
          .where(inArray(menuItemsTable.id, menuItemIds));

        for (const row of menuRows) {
          menuItemNameMap.set(row.id, row.nameAr || row.nameEn || null);
        }
      }

      const itemsByOrderId = new Map<string, any[]>();
      for (const item of allItems as any[]) {
        const list = itemsByOrderId.get(item.orderId) || [];
        list.push({
          ...item,
          itemName:
            item.itemName ||
            (item.menuItemId ? menuItemNameMap.get(item.menuItemId) : null) ||
            null,
        });
        itemsByOrderId.set(item.orderId, list);
      }

      const ordersWithItems = orders.map((order) => ({
        ...order,
        items: itemsByOrderId.get(order.id) || [],
      }));

      res.json(ordersWithItems);
    } catch (error) {
      handleRouteError(res, error, "Failed to get orders");
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
      const missingMenuIds = Array.from(
        new Set(
          items
            .filter((item: any) => item.menuItemId && !item.itemName)
            .map((item: any) => item.menuItemId as string),
        ),
      );

      const menuItemNameMap = new Map<string, string | null>();
      if (missingMenuIds.length > 0) {
        const menuRows = await db
          .select({
            id: menuItemsTable.id,
            nameAr: menuItemsTable.nameAr,
            nameEn: menuItemsTable.nameEn,
          })
          .from(menuItemsTable)
          .where(inArray(menuItemsTable.id, missingMenuIds));

        for (const row of menuRows) {
          menuItemNameMap.set(row.id, row.nameAr || row.nameEn || null);
        }
      }

      const enrichedItems = items.map((item: any) => ({
        ...item,
        itemName:
          item.itemName ||
          (item.menuItemId ? menuItemNameMap.get(item.menuItemId) : null) ||
          null,
      }));
      res.json({ ...order, items: enrichedItems });
    } catch (error: any) {
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to get order" });
    }
  });

  app.post("/api/orders", async (req, res) => {
    try {
      console.log("Received order data:", JSON.stringify(req.body, null, 2));

      const restaurantId = await getRestaurantId(req);

      // ✅ Normalize + validate customer phone if provided
      if (req.body.customerPhone) {
        const normalizedPhone = normalizeMobilePhone(String(req.body.customerPhone));
        const phoneValidation = validatePhoneNumber(normalizedPhone);
        if (!phoneValidation.valid) {
          return res.status(400).json({
            error: phoneValidation.error,
            code: "INVALID_CUSTOMER_PHONE",
          });
        }
        req.body.customerPhone = normalizedPhone;
      }

      // Utility to normalize prices (handle floating point precision issues from clients like React Native)
      const normalizePrice = (val: any) => {
        if (typeof val === 'number') return Number(val.toFixed(2));
        // If string but looks like a float with too many decimals
        if (typeof val === 'string' && !isNaN(parseFloat(val))) {
          return Number(parseFloat(val).toFixed(2));
        }
        return val;
      };

      // ✅ Normalize item prices before validation
      if (req.body.items && Array.isArray(req.body.items)) {
        for (let i = 0; i < req.body.items.length; i++) {
          const item = req.body.items[i];
          if (item.unitPrice !== undefined) item.unitPrice = normalizePrice(item.unitPrice);
          if (item.totalPrice !== undefined) item.totalPrice = normalizePrice(item.totalPrice);

          // Validate quantity
          const quantityValidation = validateQuantity(item.quantity);
          if (!quantityValidation.valid) {
            return res.status(400).json({
              error: `Item ${i + 1}: ${quantityValidation.error}`,
              code: "INVALID_QUANTITY",
            });
          }

          // Validate unitPrice
          if (item.unitPrice !== undefined) {
            const priceValidation = validatePrice(item.unitPrice);
            if (!priceValidation.valid) {
              return res.status(400).json({
                error: `Item ${i + 1}: ${priceValidation.error}`,
                code: "INVALID_UNIT_PRICE",
              });
            }
          }

          // Validate totalPrice
          if (item.totalPrice !== undefined) {
            const totalValidation = validatePrice(item.totalPrice);
            if (!totalValidation.valid) {
              return res.status(400).json({
                error: `Item ${i + 1}: ${totalValidation.error}`,
                code: "INVALID_TOTAL_PRICE",
              });
            }
          }
        }
      }

      // ✅ Normalize order totals before validation
      if (req.body.subtotal !== undefined) req.body.subtotal = normalizePrice(req.body.subtotal);
      if (req.body.deliveryFee !== undefined) req.body.deliveryFee = normalizePrice(req.body.deliveryFee);
      if (req.body.discount !== undefined) req.body.discount = normalizePrice(req.body.discount);
      if (req.body.tax !== undefined) req.body.tax = normalizePrice(req.body.tax);
      if (req.body.taxAmount !== undefined) req.body.taxAmount = normalizePrice(req.body.taxAmount);
      if (req.body.total !== undefined) req.body.total = normalizePrice(req.body.total);

      // ✅ Validate order totals (no negative values)
      if (req.body.subtotal !== undefined) {
        const subtotalValidation = validatePrice(req.body.subtotal);
        if (!subtotalValidation.valid) {
          return res.status(400).json({
            error: `Subtotal: ${subtotalValidation.error}`,
            code: "INVALID_SUBTOTAL",
          });
        }
      }
      if (req.body.deliveryFee !== undefined) {
        const feeValidation = validatePrice(req.body.deliveryFee);
        if (!feeValidation.valid) {
          return res.status(400).json({
            error: `DeliveryFee: ${feeValidation.error}`,
            code: "INVALID_DELIVERY_FEE",
          });
        }
      }
      if (req.body.discount !== undefined) {
        const discountValidation = validatePrice(req.body.discount);
        if (!discountValidation.valid) {
          return res.status(400).json({
            error: `Discount: ${discountValidation.error}`,
            code: "INVALID_DISCOUNT",
          });
        }
      }
      if (req.body.total !== undefined) {
        const totalValidation = validatePrice(req.body.total);
        if (!totalValidation.valid) {
          return res.status(400).json({
            error: `Total: ${totalValidation.error}`,
            code: "INVALID_TOTAL",
          });
        }
      }

      // Validate branchId exists if provided.
      // If not provided, fall back to the authenticated user's assigned branchId.
      let validBranchId: string | undefined = undefined;
      if (req.body.branchId) {
        const branchList = await storage.getBranches(restaurantId);
        const branchExists = branchList.some((b) => b.id === req.body.branchId);
        validBranchId = branchExists ? req.body.branchId : undefined;
      }
      // Auto-assign user's branchId when the request doesn't specify one
      if (!validBranchId) {
        try {
          const authUser = await getAuthenticatedUser(req);
          if (authUser.branchId) validBranchId = authUser.branchId;
        } catch {
          // Public/unauthenticated orders — branchId stays undefined
        }
      }

      // Server-side price recalculation if items are provided
      let serverTotals: {
        subtotal: string;
        tax: string;
        total: string;
        discount: string;
        deliveryFee: string;
      } | null = null;
      if (
        req.body.items &&
        Array.isArray(req.body.items) &&
        req.body.items.length > 0
      ) {
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
        orderNumber: req.body.orderNumber || `TMP-${Date.now()}`,
        tableId: req.body.tableId || undefined,
        branchId: validBranchId,
        customerName: req.body.customerName || undefined,
        customerPhone: req.body.customerPhone || undefined,
        customerAddress: req.body.customerAddress || undefined,
        notes: req.body.notes || undefined,
        kitchenNotes: req.body.kitchenNotes || undefined,
        tax:
          req.body.tax !== undefined && req.body.tax !== null
            ? String(req.body.tax)
            : req.body.taxAmount !== undefined && req.body.taxAmount !== null
              ? String(req.body.taxAmount)
              : "0",
        subtotal:
          req.body.subtotal !== undefined && req.body.subtotal !== null
            ? String(req.body.subtotal)
            : undefined,
        discount:
          req.body.discount !== undefined && req.body.discount !== null
            ? String(req.body.discount)
            : undefined,
        deliveryFee:
          req.body.deliveryFee !== undefined && req.body.deliveryFee !== null
            ? String(req.body.deliveryFee)
            : undefined,
        total:
          req.body.total !== undefined && req.body.total !== null
            ? String(req.body.total)
            : undefined,
        // Override with server-calculated values when available
        ...(serverTotals
          ? {
              subtotal: serverTotals.subtotal,
              tax: serverTotals.tax,
              total: serverTotals.total,
              discount: serverTotals.discount,
              deliveryFee: serverTotals.deliveryFee,
            }
          : {}),
      };

      const data = insertOrderSchema.parse(cleanBody);
      const idempotencyKey = getIdempotencyKey(req);
      const idempotencyComparableBody = {
        ...cleanBody,
        orderNumber: req.body.orderNumber || null,
        items: Array.isArray(req.body.items) ? req.body.items : [],
      };
      const idempotencyFingerprint = buildIdempotencyFingerprint(
        idempotencyComparableBody,
      );

      if (idempotencyKey) {
        const existingRequest = await findIdempotentOrder(
          restaurantId,
          idempotencyKey,
        );

        if (existingRequest) {
          if (
            existingRequest.fingerprint &&
            existingRequest.fingerprint !== idempotencyFingerprint
          ) {
            return res.status(409).json({
              error: "Idempotency key reuse with different payload",
              code: "IDEMPOTENCY_KEY_REUSED",
            });
          }

          return res.status(200).json(existingRequest.order);
        }
      }

      // Server-side payment enforcement: edfapay_online orders MUST start as payment_pending + isPaid=false
      if (data.paymentMethod === "edfapay_online") {
        (data as any).status = "payment_pending";
        (data as any).isPaid = false;
      }

      const order = await createOrderAtomicPipeline({
        orderData: data,
        items: Array.isArray(req.body.items) ? req.body.items : [],
        userName: req.body.userName || null,
      });

      await appendImmutableFinanceLedgerEntry({
        restaurantId,
        branchId: order.branchId,
        orderId: order.id,
        eventType: "order_created",
        amount: order.total,
        idempotencyKey,
        createdByName: req.body.userName || null,
        payload: {
          orderNumber: order.orderNumber,
          orderType: order.orderType,
          paymentMethod: order.paymentMethod,
          total: order.total,
          status: order.status,
          itemsCount: Array.isArray(req.body.items) ? req.body.items.length : 0,
        },
      });

      if (idempotencyKey) {
        await storage.createOrderAuditLog({
          restaurantId,
          orderId: order.id,
          action: "idempotent_created",
          previousValue: idempotencyFingerprint,
          newValue: idempotencyKey,
          field: "idempotencyKey",
          userName: req.body.userName || null,
          notes: "Idempotent order request recorded",
        });
      }

      if (order.status !== "payment_pending") {
        try {
          await createIssuedInvoiceForOrder({
            restaurantId,
            order,
            requestItems: Array.isArray(req.body.items) ? req.body.items : [],
            idempotencyKey,
          });
        } catch (invoiceError) {
          console.error("Invoice creation error (cashier order):", invoiceError);
        }
      }

      // Skip day session and invoice for payment_pending orders (will be created after payment verification)
      if (order.status !== "payment_pending") {
        // Update day session totals atomically when a new order is created
        try {
          const currentSession = await storage.getCurrentDaySession(
            order.restaurantId,
            order.branchId || undefined,
          );
          if (currentSession) {
            const orderTotal = parseFloat(order.total || "0");
            await storage.incrementDaySessionTotals(
              currentSession.id,
              orderTotal,
              order.paymentMethod || "cash",
            );
          }
        } catch (e) {
          console.error("Failed to update day session totals:", e);
        }
      }

      // Send real-time notification for new order (skip for payment_pending - will notify after payment)
      if (order.status !== "payment_pending") {
        try {
          wsManager.notifyNewOrder(
            order.restaurantId,
            order.branchId || "",
            order,
          );
        } catch (e) {
          console.error("Failed to send WebSocket notification:", e);
        }
      }

      res.status(201).json(order);
    } catch (error: any) {
      console.error("Order creation error:", error);
      
      // Handle known operational errors
      if (String(error?.message || "").startsWith("INSUFFICIENT_STOCK:")) {
        const inventoryItemId = String(error.message).split(":")[1];
        return res.status(409).json({
          error: "Insufficient stock for one or more items",
          code: "INSUFFICIENT_STOCK",
          inventoryItemId,
        });
      }

      // Return explicit error for debugging
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // If it's a Zod validation error, return 400
      if (errorMessage.includes("validation") || errorMessage.includes("parse")) {
        return res.status(400).json({
          error: "Validation failed",
          details: errorMessage,
          code: "VALIDATION_ERROR"
        });
      }

      // For other errors, return 500 with details to help debug
      res.status(500).json({
        error: "Failed to create order",
        details: errorMessage,
        code: "INTERNAL_SERVER_ERROR"
      });
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

      // Send real-time notification if status was changed
      if (safeData.status && safeData.status !== existingOrder.status) {
        try {
          wsManager.notifyOrderStatusChange(
            order.restaurantId,
            order.branchId || "",
            order.id,
            safeData.status,
            order,
          );
        } catch (e) {
          console.error("Failed to send WebSocket notification:", e);
        }
      }

      res.json(order);
    } catch (error: any) {
      console.error("Order update error:", error);
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
      if (error?.name === "ZodError" || error?.issues) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: error.issues,
          code: "VALIDATION_ERROR"
        });
      }
      res.status(400).json({ 
        error: error.message || "Invalid request body",
        code: "ORDER_UPDATE_FAILED"
      });
    }
  });

  app.put("/api/orders/:id/status", async (req, res) => {
    try {
      const { status } = req.body;
      console.log(
        `[Order Status] Updating order ${req.params.id} to status: ${status}`,
      );

      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }
      const validStatuses = [
        "created",
        "pending",
        "confirmed",
        "preparing",
        "ready",
        "completed",
        "delivered",
        "cancelled",
      ];
      if (!validStatuses.includes(status)) {
        console.error(`[Order Status] Invalid status: ${status}`);
        return res.status(400).json({
          error: `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
        });
      }

      const existingOrder = await storage.getOrder(req.params.id);
      if (!existingOrder) {
        return res.status(404).json({ error: "Order not found" });
      }
      await verifyOwnership(req, existingOrder, "Order");

      // Block advancing unpaid edfapay orders past payment_pending (except cancellation)
      if (
        existingOrder.status === "payment_pending" &&
        !existingOrder.isPaid &&
        status !== "cancelled"
      ) {
        return res.status(400).json({
          error: "Payment not verified",
          errorAr: "لم يتم التحقق من الدفع بعد",
          message: "Cannot advance order until payment is verified",
        });
      }

      if (
        (status === "delivered" || status === "completed") &&
        existingOrder.tableId
      ) {
        await storage.updateTableStatus(existingOrder.tableId, "available");
      }

      const order = await storage.updateOrderStatus(req.params.id, status);

      try {
        await storage.createOrderAuditLog({
          orderId: req.params.id,
          action: "status_change",
          field: "status",
          previousValue: existingOrder.status,
          newValue: status,
          userName: req.body.userName || null,
          notes: req.body.reason || null,
          restaurantId: existingOrder.restaurantId,
        });
      } catch (e) {}

      // Send real-time notification for order status change
      try {
        wsManager.notifyOrderStatusChange(
          order!.restaurantId,
          order!.branchId || "",
          order!.id,
          status,
          order,
        );
      } catch (e) {
        console.error("Failed to send WebSocket notification:", e);
      }

      console.log(
        `[Order Status] Successfully updated order ${req.params.id} to ${status}`,
      );
      res.json(order);
    } catch (error) {
      console.error(
        `[Order Status] Error updating order ${req.params.id}:`,
        error,
      );
      res.status(500).json({ error: "Failed to update order status" });
    }
  });

  app.delete("/api/orders/:id", async (req, res) => {
    try {
      const order = await storage.getOrder(req.params.id);
      if (!order) return res.status(404).json({ error: "Order not found" });
      await verifyOwnership(req, order, "Order");
      await storage.deleteOrder(req.params.id);
      try {
        wsManager.notifyDataChanged(order.restaurantId, "orders", "deleted");
      } catch {}
      res.status(204).send();
    } catch (error: any) {
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
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
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to get order audit log" });
    }
  });

  app.get("/api/orders/:orderId/finance-ledger", async (req, res) => {
    try {
      const order = await storage.getOrder(req.params.orderId);
      if (!order) return res.status(404).json({ error: "Order not found" });
      await verifyOwnership(req, order, "Order");
      const ledger = await storage.getFinanceLedgerByOrder(req.params.orderId);
      res.json(ledger);
    } catch (error: any) {
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to get finance ledger" });
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
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
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

      const rawItem = req.body;
      const itemQty = Math.max(1, Math.floor(Number(rawItem?.quantity || 1)));
      const unitPrice = String(rawItem?.unitPrice ?? "0");
      const totalPrice = String(rawItem?.totalPrice ?? (Number(unitPrice || 0) * itemQty).toFixed(2));

      // Construct safe payload for schema validation
      const safeItem = {
        ...rawItem,
        orderId: req.params.orderId,
        quantity: itemQty,
        unitPrice,
        totalPrice,
        notes: rawItem.notes || null,
        itemName: rawItem.itemName || null,
      };

      const data = insertOrderItemSchema.parse(safeItem);
      const item = await storage.createOrderItem(data);

      // Auto-deduct inventory based on recipe
      if (data.menuItemId) {
        const recipes = await storage.getRecipes(data.menuItemId);
        if (recipes && recipes.length > 0) {
          const quantity = data.quantity || 1;
          const deductionResults: {
            success: boolean;
            itemId: string;
            error?: string;
          }[] = [];

          for (const recipe of recipes) {
            try {
              const deductAmount = parseFloat(recipe.quantity) * quantity;
              const inventoryItem = await storage.getInventoryItem(
                recipe.inventoryItemId,
              );

              if (inventoryItem) {
                const currentStock = parseFloat(
                  inventoryItem.currentStock || "0",
                );
                const newStock = currentStock - deductAmount;

                // Record the transaction (this auto-updates stock via storage)
                await storage.createInventoryTransaction({
                  inventoryItemId: recipe.inventoryItemId,
                  type: "usage",
                  quantity: String(deductAmount),
                  notes: `Order item: ${item.id}`,
                });

                deductionResults.push({
                  success: true,
                  itemId: recipe.inventoryItemId,
                });

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
                    console.error(
                      "Failed to create low stock notification:",
                      notifError,
                    );
                  }
                }
              } else {
                deductionResults.push({
                  success: false,
                  itemId: recipe.inventoryItemId,
                  error: "Inventory item not found",
                });
              }
            } catch (deductError) {
              console.error(
                `Failed to deduct inventory for item ${recipe.inventoryItemId}:`,
                deductError,
              );
              deductionResults.push({
                success: false,
                itemId: recipe.inventoryItemId,
                error: String(deductError),
              });
            }
          }

          const failures = deductionResults.filter((r) => !r.success);
          if (failures.length > 0) {
            console.warn(
              `Partial inventory deduction: ${failures.length}/${recipes.length} failed`,
              failures,
            );
          }
          // Notify inventory changed after recipe deductions
          try {
            wsManager.notifyDataChanged(
              order.restaurantId,
              "inventory",
              "updated",
            );
          } catch {}
        }
      }

      res.status(201).json(item);
    } catch (error: any) {
      console.error("Order item creation error:", error);
      if (error?.name === "ZodError" || error?.issues) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: error.issues,
          code: "VALIDATION_ERROR"
        });
      }
      res.status(400).json({ 
        error: error.message || "Invalid request body",
        code: "ORDER_ITEM_CREATION_FAILED"
      });
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
      if (error?.message === "Authentication required")
        return res.status(401).json({ error: error.message });
      res.status(500).json({ error: "Failed to delete order item" });
    }
  });

  // Invoices
  app.get("/api/invoices", async (req, res) => {
    try {
      const authUser = await getAuthenticatedUser(req);
      const restaurantId = authUser.restaurantId!;
      const isLockedEmployee = ["cashier", "waiter", "kitchen", "delivery"].includes(authUser.role || "");
      let branchId: string | undefined;
      if (isLockedEmployee && authUser.branchId) {
        branchId = authUser.branchId;
      } else {
        branchId = req.query.branch as string | undefined;
      }
      const invoices = await storage.getInvoices(restaurantId);
      const result = branchId
        ? invoices.filter(inv => inv.branchId === branchId)
        : invoices;
      res.json(result);
    } catch (error: any) {
      console.error("[API] /api/invoices error:", error?.message || error);
      if (error?.message === "Authentication required") {
        return res.status(401).json({ error: error.message });
      }
      res.status(500).json({ error: "Failed to get invoices" });
    }
  });

  // Invoice search - MUST be before /api/invoices/:id to avoid "search" being matched as an ID
  app.get("/api/invoices/search", async (req, res) => {
    try {
      const authUser = await getAuthenticatedUser(req);
      const restaurantId = authUser.restaurantId!;
      const isLockedEmployee = ["cashier", "waiter", "kitchen", "delivery"].includes(authUser.role || "");
      let branchId: string | undefined;
      if (isLockedEmployee && authUser.branchId) {
        branchId = authUser.branchId;
      } else {
        branchId = req.query.branch as string | undefined;
      }
      const filters: any = {};
      if (req.query.invoiceNumber)
        filters.invoiceNumber = req.query.invoiceNumber as string;
      if (req.query.customerPhone)
        filters.customerPhone = req.query.customerPhone as string;
      if (req.query.startDate)
        filters.startDate = new Date(req.query.startDate as string);
      if (req.query.endDate)
        filters.endDate = new Date(req.query.endDate as string);
      if (req.query.paymentMethod)
        filters.paymentMethod = req.query.paymentMethod as string;
      if (req.query.status) filters.status = req.query.status as string;
      if (req.query.invoiceType)
        filters.invoiceType = req.query.invoiceType as string;

      const results = await storage.searchInvoices(restaurantId, filters);
      const filtered = branchId ? results.filter((inv: any) => inv.branchId === branchId) : results;
      res.json(filtered);
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
      const menuItemsData = await storage.getMenuItems(
        await getRestaurantId(req),
      );
      const menuItemsMap = new Map(menuItemsData.map((m) => [m.id, m]));
      const itemsWithDetails = items.map((item) => ({
        ...item,
        menuItem: item.menuItemId
          ? menuItemsMap.get(item.menuItemId)
          : item.itemName
            ? { nameAr: item.itemName, nameEn: item.itemName }
            : null,
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
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
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
      const menuItemsMap = new Map(menuItemsData.map((m) => [m.id, m]));
      const itemsWithDetails = items.map((item) => ({
        ...item,
        menuItem: item.menuItemId ? menuItemsMap.get(item.menuItemId) : null,
      }));
      const restaurant = await storage.getRestaurantById(restaurantId);

      res.json({
        ...invoice,
        order: { ...order, items: itemsWithDetails },
        restaurant,
      });
    } catch (error: any) {
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to get invoice" });
    }
  });

  app.post("/api/invoices", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const idempotencyKey = getIdempotencyKey(req);
      const idempotencyFingerprint = buildIdempotencyFingerprint(req.body);

      if (idempotencyKey) {
        const existingRequest = await findIdempotentInvoice(
          restaurantId,
          idempotencyKey,
        );

        if (existingRequest) {
          if (
            existingRequest.fingerprint &&
            existingRequest.fingerprint !== idempotencyFingerprint
          ) {
            return res.status(409).json({
              error: "Idempotency key reuse with different payload",
              code: "IDEMPOTENCY_KEY_REUSED",
            });
          }

          return res.status(200).json(existingRequest.invoice);
        }
      }

      // Prevent duplicate invoice for the same order
      if (req.body.orderId) {
        const existingInvoice = await storage.getInvoiceByOrder(
          req.body.orderId,
        );
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
      const invoiceNumber = await storage.getNextInvoiceNumber(
        restaurantId,
        invoiceBranchId,
      );
      const { counter: prevC, lastHash: prevH } =
        await storage.getZatcaCounterAndHash(restaurantId, invoiceBranchId);
      const currentCounter = prevC + 1;
      const previousHash =
        prevH ||
        Buffer.from(
          "NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==",
          "base64",
        ).toString("utf8");

      const now = new Date();
      const invoiceType = req.body.invoiceType || "simplified";

      // Build line items from order if available
      let xmlItems: ZatcaLineItem[] = [];
      if (req.body.orderId) {
        const orderItems = await storage.getOrderItems(req.body.orderId);
        const menuItemsRaw = await storage.getMenuItems(restaurantId);
        const menuItemsMap = new Map(menuItemsRaw.map((m) => [m.id, m]));
        xmlItems = orderItems.map((item, idx) => {
          const menuItem = item.menuItemId
            ? menuItemsMap.get(item.menuItemId)
            : null;
          const unitPrice = parseFloat(
            item.unitPrice || menuItem?.price || "0",
          );
          const qty = item.quantity || 1;
          const lineTotal = bankersRound(unitPrice * qty);
          const lineTax = bankersRound(lineTotal * (taxRate / 100));
          return {
            id: String(idx + 1),
            nameAr: menuItem?.nameAr || menuItem?.nameEn || "منتج",
            nameEn: menuItem?.nameEn || "",
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
        xmlItems = [
          {
            id: "1",
            nameAr: "فاتورة",
            quantity: 1,
            unitPrice: subtotal,
            discount: 0,
            taxRate,
            taxAmount: bankersRound(taxAmount),
            totalWithTax: bankersRound(total),
            totalWithoutTax: bankersRound(subtotal),
          },
        ];
      }

      // Generate ZATCA XML
      const unsignedXml = generateZatcaXml({
        uuid,
        invoiceNumber,
        invoiceType,
        issueDate: now.toISOString().split("T")[0],
        issueTime: now.toTimeString().split(" ")[0],
        deliveryDate: now.toISOString().split("T")[0],
        seller: {
          nameAr: restaurant?.nameAr || restaurant?.nameEn || "مطعم",
          vatNumber: restaurant?.vatNumber || "",
          commercialRegistration: restaurant?.commercialRegistration || "",
          streetName: restaurant?.streetName || "",
          buildingNumber: restaurant?.buildingNumber || "",
          district: restaurant?.district || "",
          city: restaurant?.city || "",
          postalCode: restaurant?.postalCode || "",
          country: restaurant?.country || "SA",
        },
        items: xmlItems,
        subtotal,
        discount,
        deliveryFee,
        taxAmount,
        taxRate,
        total,
        paymentMethod: req.body.paymentMethod || "cash",
        previousInvoiceHash: previousHash,
        invoiceCounter: currentCounter,
      });

      // Resolve signing credentials (device → branch → restaurant fallback)
      let privKey: string | null = null;
      let cert: string | null = null;
      const reqEgsDeviceId = req.body.egsDeviceId || null;

      // 1) Try device-level credentials first
      if (reqEgsDeviceId) {
        const device = await storage.getZatcaDevice(reqEgsDeviceId);
        if (device && device.zatcaPrivateKey) {
          privKey = device.zatcaPrivateKey;
          cert =
            device.zatcaProductionCsid || device.zatcaComplianceCsid || null;
        }
      }
      // 1b) If no explicit device, try active device for branch
      if (!privKey && invoiceBranchId) {
        const activeDevice =
          await storage.getActiveZatcaDevice(invoiceBranchId);
        if (activeDevice && activeDevice.zatcaPrivateKey) {
          privKey = activeDevice.zatcaPrivateKey;
          cert =
            activeDevice.zatcaProductionCsid ||
            activeDevice.zatcaComplianceCsid ||
            null;
        }
      }
      // 2) Branch-level fallback
      if (!privKey && invoiceBranchId) {
        const br = await storage.getBranch(invoiceBranchId);
        if (br && (br as any).zatcaPrivateKey) {
          privKey = (br as any).zatcaPrivateKey;
          cert =
            (br as any).zatcaProductionCsid ||
            (br as any).zatcaComplianceCsid ||
            (br as any).zatcaCertificate;
        }
      }
      // 3) Restaurant-level fallback
      if (!privKey && restaurant && (restaurant as any).zatcaPrivateKey) {
        privKey = (restaurant as any).zatcaPrivateKey;
        cert =
          restaurant.zatcaProductionCsid ||
          restaurant.zatcaComplianceCsid ||
          restaurant.zatcaCertificate;
      }

      const signResult = buildSignedInvoice(unsignedXml, privKey, cert, {
        sellerName: restaurant?.nameAr || restaurant?.nameEn || "مطعم",
        vatNumber: restaurant?.vatNumber || "",
        timestamp: now.toISOString(),
        total: total.toFixed(2),
        vatAmount: taxAmount.toFixed(2),
      });

      const xmlContent = signResult.finalXml;
      const invoiceHash = signResult.invoiceHash;
      const qrData = signResult.qrData;

      // Update branch-level (and restaurant-level) counter and hash
      await storage.updateZatcaCounterAndHash(
        restaurantId,
        invoiceBranchId,
        currentCounter,
        invoiceHash,
      );

      // Clean request body - remove values that are explicitly null
      const cleanBody = Object.fromEntries(Object.entries(req.body).filter(([_, v]) => v !== null));

      const data = insertInvoiceSchema.parse({
        ...cleanBody,
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
        zatcaStatus: "pending",
        signedXml: signResult.signedXml || null,
      });

      const invoice = await storage.createInvoice(data);

      // Audit log for invoice creation
      const userIp =
        req.ip || (req.headers["x-forwarded-for"] as string) || "unknown";
      await storage.createInvoiceAuditLog({
        restaurantId,
        invoiceId: invoice.id,
        action: "invoice_created",
        details: JSON.stringify({
          invoiceNumber,
          invoiceType,
          total: total.toFixed(2),
          uuid,
        }),
        ipAddress: userIp,
      });

      if (idempotencyKey) {
        await storage.createInvoiceAuditLog({
          restaurantId,
          invoiceId: invoice.id,
          action: `idempotency:${idempotencyKey}`,
          details: idempotencyFingerprint,
          ipAddress: userIp,
        });
      }

      await appendImmutableFinanceLedgerEntry({
        restaurantId,
        branchId: invoiceBranchId,
        orderId: invoice.orderId,
        invoiceId: invoice.id,
        eventType: "invoice_issued",
        amount: invoice.total,
        idempotencyKey,
        payload: {
          invoiceNumber: invoice.invoiceNumber,
          invoiceType: invoice.invoiceType,
          total: invoice.total,
          zatcaStatus: invoice.zatcaStatus,
          invoiceHash: invoice.invoiceHash,
          previousInvoiceHash: invoice.previousInvoiceHash,
        },
      });

      try {
        wsManager.notifyDataChanged(restaurantId, "invoices", "created");
      } catch {}
      res.status(201).json(invoice);
    } catch (error: any) {
      console.error("Invoice creation error:", error);
      if (error?.name === "ZodError" || error?.issues) {
        return res.status(400).json({ error: "Validation failed", details: error.issues });
      }
      res.status(400).json({ error: error.message || "Invalid request body" });
    }
  });

  app.put("/api/invoices/:id", async (req, res) => {
    try {
      const existing = await storage.getInvoice(req.params.id);
      if (!existing)
        return res.status(404).json({ error: "Invoice not found" });
      await verifyOwnership(req, existing, "Invoice");

      // ZATCA compliance: After issuance, only allow ZATCA-related field updates
      if (existing.status === "issued" || existing.status === "reported") {
        const allowedFields = [
          "zatcaStatus",
          "zatcaSubmissionId",
          "zatcaWarnings",
          "zatcaErrors",
          "signedXml",
          "csidToken",
        ];
        const attemptedFields = Object.keys(req.body);
        const forbidden = attemptedFields.filter(
          (f) => !allowedFields.includes(f),
        );
        if (forbidden.length > 0) {
          return res.status(403).json({
            error:
              "لا يمكن تعديل الفاتورة بعد إصدارها. استخدم إشعار دائن أو مدين للتصحيح",
            errorEn:
              "Cannot modify an issued invoice. Use a credit or debit note for corrections.",
            forbiddenFields: forbidden,
          });
        }
      }

      const invoice = await storage.updateInvoice(req.params.id, req.body);
      if (!invoice) {
        return res.status(404).json({ error: "Invoice not found" });
      }
      res.json(invoice);
    } catch (error: any) {
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  // ZATCA compliance: Prevent deletion of invoices
  app.delete("/api/invoices/:id", async (_req, res) => {
    return res.status(403).json({
      error: "لا يمكن حذف الفواتير. استخدم إشعار دائن للإلغاء",
      errorEn:
        "Invoices cannot be deleted. Use a credit note for cancellation.",
    });
  });

  // --- Invoice Archive / Search ---
  // --- Invoice Audit Log ---
  app.get("/api/invoice-audit-log", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const limit = req.query.limit
        ? parseInt(req.query.limit as string)
        : undefined;
      const logs = await storage.getInvoiceAuditLogs(restaurantId, limit);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to get audit log" });
    }
  });

  app.get("/api/invoice-audit-log/:invoiceId", async (req, res) => {
    try {
      const logs = await storage.getInvoiceAuditLogsByInvoice(
        req.params.invoiceId,
      );
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to get invoice audit log" });
    }
  });

  // --- Tax Report ---
  app.get("/api/reports/tax", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const startDate = req.query.startDate
        ? new Date(req.query.startDate as string)
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const endDate = req.query.endDate
        ? new Date(req.query.endDate as string)
        : new Date();
      const branchId = req.query.branch as string | undefined;

      const report = await storage.getTaxReport(
        restaurantId,
        startDate,
        endDate,
        branchId,
      );
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
      if (!restaurant)
        return res.status(404).json({ error: "Restaurant not found" });

      const originalInvoice = await storage.getInvoice(req.params.invoiceId);
      if (!originalInvoice)
        return res.status(404).json({ error: "Invoice not found" });
      if (originalInvoice.restaurantId !== restaurantId)
        return res.status(403).json({ error: "Unauthorized" });
      if (originalInvoice.status === "cancelled")
        return res.status(400).json({ error: "Invoice already cancelled" });
      if (originalInvoice.invoiceType === "credit_note")
        return res.status(400).json({ error: "Cannot refund a credit note" });

      // Prevent duplicate credit note for the same invoice
      const existingCreditNote = await storage.getCreditNoteForInvoice(
        originalInvoice.id,
      );
      if (existingCreditNote) {
        return res.status(200).json(existingCreditNote);
      }

      const { reason, userName, items: requestedItems } = req.body;
      if (!reason)
        return res
          .status(400)
          .json({ error: "سبب الاسترجاع مطلوب - Refund reason is required" });

      const order = await storage.getOrder(originalInvoice.orderId);
      if (!order) return res.status(404).json({ error: "Order not found" });

      const orderItems = await storage.getOrderItems(order.id);
      const menuItemsRaw = await storage.getMenuItems(restaurantId);
      const menuItemsMap = new Map(menuItemsRaw.map((m) => [m.id, m]));

      let itemsToRefund = orderItems;
      let orderForZatca = order;

      // Handle Partial Refund
      if (requestedItems && Array.isArray(requestedItems) && requestedItems.length > 0) {
        itemsToRefund = requestedItems.map((reqItem: any) => {
          // Find original item by ID or MenuItemID
          const original = orderItems.find(oi => 
            (reqItem.id && oi.id === reqItem.id) || 
            (reqItem.menuItemId && oi.menuItemId === reqItem.menuItemId)
          );
          
          if (!original) return null;

          return {
            ...original,
            quantity: Number(reqItem.quantity) || 1,
            // Recalculate line total if needed, but buildZatcaInvoice does it based on unitPrice * quantity
          };
        }).filter((i): i is typeof orderItems[0] => Boolean(i));

        if (itemsToRefund.length === 0) {
           return res.status(400).json({ error: "No valid items found to refund" });
        }

        // zero out global fees for partial refund unless we implement advanced logic
        orderForZatca = {
          ...order,
          discount: "0",
          deliveryFee: "0"
        };
      }

      // Build credit note via ZATCA engine
      const zatcaResult = await buildZatcaInvoice(
        restaurant,
        orderForZatca,
        itemsToRefund,
        menuItemsMap,
        "credit_note",
        originalInvoice,
        undefined,
        reason,
      );

      const creditNote = await storage.createInvoice({
        restaurantId,
        branchId: order.branchId || null,
        orderId: order.id,
        invoiceNumber: zatcaResult.invoiceNumber,
        invoiceType: "credit_note",
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
        status: "issued",
        zatcaStatus: "pending",
        cashierName: userName || null,
        refundReason: reason,
        customerName: originalInvoice.customerName,
        customerPhone: originalInvoice.customerPhone,
        paymentMethod: originalInvoice.paymentMethod,
        isPaid: true,
        signedXml: zatcaResult.signedXml || null,
      });

      // Update order status to refunded or partial_refunded
      const isPartial = itemsToRefund.length < orderItems.length || itemsToRefund.some(ri => {
         const orig = orderItems.find(oi => oi.id === ri.id);
         return orig && orig.quantity > ri.quantity;
      });
      
      await storage.updateOrder(order.id, { status: isPartial ? "partially_refunded" : "refunded" });

      // Update inventory - return items to stock
      for (const item of itemsToRefund) {

        const menuItem = item.menuItemId
          ? menuItemsMap.get(item.menuItemId)
          : null;
        if (menuItem && item.menuItemId) {
          const recipeItems = await storage.getRecipes(item.menuItemId);
          for (const recipe of recipeItems) {
            const invItem = await storage.getInventoryItem(
              recipe.inventoryItemId,
            );
            if (invItem) {
              const returnQty =
                parseFloat(String(recipe.quantity)) * (item.quantity || 1);
              await storage.updateInventoryItem(recipe.inventoryItemId, {
                currentStock: String(
                  parseFloat(String(invItem.currentStock)) + returnQty,
                ),
              } as any);
            }
          }
        }
      }

      // Audit log
      const userIp =
        req.ip || (req.headers["x-forwarded-for"] as string) || "unknown";
      await storage.createInvoiceAuditLog({
        restaurantId,
        invoiceId: creditNote.id,
        action: "refund_issued",
        userName: userName || "System",
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
      res
        .status(500)
        .json({ error: error?.message || "Failed to process refund" });
    }
  });

  // --- Debit Note ---
  app.post("/api/invoices/:invoiceId/debit-note", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const restaurant = await storage.getRestaurantById(restaurantId);
      if (!restaurant)
        return res.status(404).json({ error: "Restaurant not found" });

      const originalInvoice = await storage.getInvoice(req.params.invoiceId);
      if (!originalInvoice)
        return res.status(404).json({ error: "Invoice not found" });
      if (originalInvoice.restaurantId !== restaurantId)
        return res.status(403).json({ error: "Unauthorized" });

      const { reason, userName } = req.body;
      if (!reason)
        return res.status(400).json({
          error: "سبب الإشعار المدين مطلوب - Debit note reason is required",
        });

      const order = await storage.getOrder(originalInvoice.orderId);
      if (!order) return res.status(404).json({ error: "Order not found" });

      const orderItems = await storage.getOrderItems(order.id);
      const menuItemsRaw = await storage.getMenuItems(restaurantId);
      const menuItemsMap = new Map(menuItemsRaw.map((m) => [m.id, m]));

      const zatcaResult = await buildZatcaInvoice(
        restaurant,
        order,
        orderItems,
        menuItemsMap,
        "debit_note",
        originalInvoice,
        undefined,
        reason,
      );

      const debitNote = await storage.createInvoice({
        restaurantId,
        branchId: order.branchId || null,
        orderId: order.id,
        invoiceNumber: zatcaResult.invoiceNumber,
        invoiceType: "debit_note",
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
        status: "issued",
        zatcaStatus: "pending",
        cashierName: userName || null,
        refundReason: reason,
        customerName: originalInvoice.customerName,
        customerPhone: originalInvoice.customerPhone,
        paymentMethod: originalInvoice.paymentMethod,
        signedXml: zatcaResult.signedXml || null,
      });

      // Audit log
      const userIp =
        req.ip || (req.headers["x-forwarded-for"] as string) || "unknown";
      await storage.createInvoiceAuditLog({
        restaurantId,
        invoiceId: debitNote.id,
        action: "debit_note_created",
        userName: userName || "System",
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
      res
        .status(500)
        .json({ error: error?.message || "Failed to create debit note" });
    }
  });

  // Kitchen orders - get orders for kitchen display (pending, confirmed, preparing) with items
  app.get("/api/kitchen/orders", async (req, res) => {
    try {
      const authUser = await getAuthenticatedUser(req);
      const restaurantId = authUser.restaurantId!;
      // Branch isolation: same logic as GET /api/orders
      const isLockedEmployee = ["cashier", "waiter", "kitchen", "delivery"].includes(authUser.role || "");
      let branchId: string | undefined;
      if (isLockedEmployee && authUser.branchId) {
        branchId = authUser.branchId;
      } else {
        branchId = req.query.branch as string | undefined;
      }
      const sectionId = req.query.section as string | undefined;
      const allOrders = await storage.getOrders(restaurantId, branchId);

      console.log(
        `[Kitchen] Fetching orders for restaurant ${restaurantId}, branch ${branchId || "all"}, section ${sectionId || "all"}`,
      );
      console.log(`[Kitchen] Total orders: ${allOrders.length}`);

      // Log all order statuses for debugging
      const statusCounts: Record<string, number> = {};
      for (const o of allOrders) {
        statusCounts[o.status || "null"] =
          (statusCounts[o.status || "null"] || 0) + 1;
      }
      console.log(`[Kitchen] Order statuses:`, JSON.stringify(statusCounts));

      // Auto-timeout: orders that are "created"/"pending" for 60+ minutes become "ready" automatically
      const now = new Date();
      const sixtyMinsAgo = new Date(now.getTime() - 60 * 60000);

      for (const order of allOrders) {
        if (
          (order.status === "created" || order.status === "pending") &&
          order.createdAt &&
          new Date(order.createdAt) < sixtyMinsAgo
        ) {
          await storage.updateOrderStatus(order.id, "ready");
        }
      }

      // Re-fetch after auto-updates
      const updatedOrders = await storage.getOrders(restaurantId, branchId);
      const kitchenOrders = updatedOrders.filter((o) => {
        const validStatuses = ["created", "pending", "confirmed", "preparing", "ready"];
        const status = o.status || "";
        
        if (!validStatuses.includes(status)) return false;

        // If it's a dine-in table order (QR or Waiter), it must be 'confirmed' by cashier to show in kitchen
        // This restores the "Cashier Approval" workflow
        if (o.orderType === 'dine_in' && o.tableId && (status === 'created' || status === 'pending')) {
          return false;
        }

        // Exclude POS held orders — they are paused by cashier, not for kitchen
        if (String(o.notes || '').includes('[HELD]')) return false;

        return true;
      });

      console.log(
        `[Kitchen] Kitchen orders (active): ${kitchenOrders.length}, statuses: ${kitchenOrders.map((o) => o.status).join(", ")}`,
      );

      const menuItemsData = await storage.getMenuItems(restaurantId);
      const menuItemsMap = new Map(menuItemsData.map((m) => [m.id, m]));

      const tablesData = await storage.getTables(restaurantId, branchId);
      const tablesMap = new Map(tablesData.map((t) => [t.id, t]));

      const ordersWithItems = await Promise.all(
        kitchenOrders.map(async (order) => {
          const items = await storage.getOrderItems(order.id);
          let itemsWithDetails = items.map((item) => ({
            ...item,
            itemName: item.itemName || null,
            menuItem: item.menuItemId
              ? menuItemsMap.get(item.menuItemId)
              : item.itemName
                ? ({
                    nameEn: item.itemName,
                    nameAr: item.itemName,
                    price: item.unitPrice,
                    kitchenSectionId: null,
                  } as any)
                : null,
          }));

          // Filter items by section if sectionId is provided
          if (sectionId) {
            itemsWithDetails = itemsWithDetails.filter((item) => {
              // Include items without menuItemId (manual items)
              if (!item.menuItemId) return true;
              // Include items with matching section
              if (item.menuItem?.kitchenSectionId === sectionId) return true;
              // Include items without section assignment
              if (!item.menuItem?.kitchenSectionId) return true;
              return false;
            });
          }

          const table = order.tableId ? tablesMap.get(order.tableId) : null;
          return {
            ...order,
            items: itemsWithDetails,
            table: table
              ? { tableNumber: table.tableNumber, location: table.location }
              : null,
          };
        }),
      );

      // Remove orders with no items ONLY if section filter is active
      const filteredOrders = sectionId
        ? ordersWithItems.filter((order) => order.items.length > 0)
        : ordersWithItems;

      console.log(`[Kitchen] Final orders returned: ${filteredOrders.length}`);

      res.json(filteredOrders);
    } catch (error) {
      console.error("[Kitchen] Error fetching orders:", error);
      handleRouteError(res, error, "Failed to get kitchen orders");
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
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
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
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
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
          return res
            .status(400)
            .json({ error: emailValidation.error, code: "INVALID_EMAIL" });
        }
        body.email = normalizeEmail(body.email);
      }
      // ✅ Check for duplicate email before creating user
      if (body.email) {
        const existingByEmail = await storage.getUserByEmail(body.email);
        if (existingByEmail) {
          return res.status(409).json({
            error: "البريد الإلكتروني مسجل بالفعل - Email already exists",
            code: "EMAIL_EXISTS",
          });
        }
      }
      // ✅ Validate phone number format (if provided)
      if (body.phone) {
        const phoneValidation = validatePhoneNumber(body.phone);
        if (!phoneValidation.valid) {
          return res
            .status(400)
            .json({ error: phoneValidation.error, code: "INVALID_PHONE" });
        }
        body.phone = normalizeMobilePhone(body.phone);
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
      const allowedFields = [
        "name",
        "email",
        "phone",
        "password",
        "isActive",
        "permDashboard",
        "permPos",
        "permOrders",
        "permMenu",
        "permKitchen",
        "permInventory",
        "permReviews",
        "permMarketing",
        "permQr",
        "permReports",
        "permSettings",
        "permTables",
        "role",
      ];
      const updateData: Record<string, any> = {};
      for (const key of allowedFields) {
        if (req.body[key] !== undefined) updateData[key] = req.body[key];
      }
      // Prevent non-owners from changing roles
      const caller = await getAuthenticatedUser(req);
      if (
        updateData.role &&
        caller.role !== "owner" &&
        caller.role !== "platform_admin"
      ) {
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
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
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
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
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
      const customer = await storage.getCustomerByPhone(
        restaurantId,
        req.params.phone,
      );
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

  // Loyalty Routes
  app.get("/api/loyalty/transactions", async (req, res) => {
    try {
      const customerId = req.query.customerId as string;
      if (!customerId) return res.status(400).json({ error: "Missing customerId" });
      const transactions = await storage.getLoyaltyTransactions(customerId);
      res.json(transactions);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to fetch loyalty transactions" });
    }
  });

  app.post("/api/loyalty/transactions", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const data = insertLoyaltyTransactionSchema.parse({
        ...req.body,
        restaurantId
      });
      const transaction = await storage.createLoyaltyTransaction(data);
      res.json(transaction);
    } catch (error: any) {
      console.error(error);
      res.status(400).json({ error: error.message || "Invalid loyalty transaction data" });
    }
  });

  app.get("/api/loyalty/points/:customerId", async (req, res) => {
    try {
      const points = await storage.getCustomerPoints(req.params.customerId);
      res.json({ points });
    } catch (error) {
       console.error(error);
      res.status(500).json({ error: "Failed to fetch customer points" });
    }
  });

  // Inventory Items
  app.get("/api/inventory", async (req, res) => {
    try {
      const branchId = req.query.branch as string | undefined;
      const items = await storage.getInventoryItems(
        await getRestaurantId(req),
        branchId,
      );
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
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
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
        if (!branches.some((b) => b.id === branchId)) {
          branchId = null;
        }
      }

      const data = insertInventoryItemSchema.parse({
        ...req.body,
        restaurantId,
        branchId,
      });
      const item = await storage.createInventoryItem(data);
      try {
        wsManager.notifyDataChanged(restaurantId, "inventory", "created");
      } catch {}
      res.status(201).json(item);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.put("/api/inventory/:id", async (req, res) => {
    try {
      const existing = await storage.getInventoryItem(req.params.id);
      if (!existing)
        return res.status(404).json({ error: "Inventory item not found" });
      await verifyOwnership(req, existing, "Inventory item");
      const item = await storage.updateInventoryItem(req.params.id, req.body);
      if (!item) {
        return res.status(404).json({ error: "Inventory item not found" });
      }
      try {
        wsManager.notifyDataChanged(
          existing.restaurantId,
          "inventory",
          "updated",
        );
      } catch {}
      res.json(item);
    } catch (error: any) {
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.delete("/api/inventory/:id", async (req, res) => {
    try {
      const existing = await storage.getInventoryItem(req.params.id);
      if (!existing)
        return res.status(404).json({ error: "Inventory item not found" });
      await verifyOwnership(req, existing, "Inventory item");
      await storage.deleteInventoryItem(req.params.id);
      try {
        wsManager.notifyDataChanged(
          existing.restaurantId,
          "inventory",
          "deleted",
        );
      } catch {}
      res.status(204).send();
    } catch (error: any) {
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to delete inventory item" });
    }
  });

  // Inventory Transactions
  app.get("/api/inventory/:itemId/transactions", async (req, res) => {
    try {
      const transactions = await storage.getInventoryTransactions(
        req.params.itemId,
      );
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
      try {
        const invItem = await storage.getInventoryItem(req.params.itemId);
        if (invItem)
          wsManager.notifyDataChanged(
            invItem.restaurantId,
            "inventory",
            "updated",
          );
      } catch {}
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
      const restaurantId = user.restaurantId!;
      if (!restaurantId) {
        return res.status(400).json({ error: "Restaurant ID required" });
      }
      const startDate = req.query.startDate
        ? new Date(req.query.startDate as string)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = req.query.endDate
        ? new Date(req.query.endDate as string)
        : new Date();

      const branches = await storage.getBranches(restaurantId);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - 7);
      const monthStart = new Date(today);
      monthStart.setDate(1);

      const sumSales = (data: any[]) =>
        data.reduce((acc, row) => acc + parseFloat(row.total_sales || 0), 0);
      const sumOrders = (data: any[]) =>
        data.reduce((acc, row) => acc + parseInt(row.order_count || 0), 0);
      const sumTax = (data: any[]) =>
        data.reduce((acc, row) => acc + parseFloat(row.total_tax || 0), 0);
      const sumDiscount = (data: any[]) =>
        data.reduce((acc, row) => acc + parseFloat(row.total_discount || 0), 0);

      const branchStats = await Promise.all(
        branches.map(async (branch) => {
          const [
            todayData,
            weekData,
            monthData,
            rangeData,
            topItems,
            ordersByType,
          ] = await Promise.all([
            storage.getSalesReport(restaurantId, today, tomorrow, branch.id),
            storage.getSalesReport(
              restaurantId,
              weekStart,
              tomorrow,
              branch.id,
            ),
            storage.getSalesReport(
              restaurantId,
              monthStart,
              tomorrow,
              branch.id,
            ),
            storage.getSalesReport(restaurantId, startDate, endDate, branch.id),
            storage.getTopSellingItems(restaurantId, 5, branch.id),
            storage.getOrdersByType(
              restaurantId,
              startDate,
              endDate,
              branch.id,
            ),
          ]);
          return {
            branchId: branch.id,
            branchName: branch.name,
            branchNameAr: (branch as any).nameAr || branch.name,
            isMain: branch.isMain,
            today: { sales: sumSales(todayData), orders: sumOrders(todayData) },
            week: { sales: sumSales(weekData), orders: sumOrders(weekData) },
            month: {
              sales: sumSales(monthData),
              orders: sumOrders(monthData),
              tax: sumTax(monthData),
              discount: sumDiscount(monthData),
            },
            range: {
              sales: sumSales(rangeData),
              orders: sumOrders(rangeData),
              tax: sumTax(rangeData),
              discount: sumDiscount(rangeData),
            },
            topItems,
            ordersByType,
          };
        }),
      );

      // Totals across all branches
      const totals = {
        today: {
          sales: branchStats.reduce((s, b) => s + b.today.sales, 0),
          orders: branchStats.reduce((s, b) => s + b.today.orders, 0),
        },
        week: {
          sales: branchStats.reduce((s, b) => s + b.week.sales, 0),
          orders: branchStats.reduce((s, b) => s + b.week.orders, 0),
        },
        month: {
          sales: branchStats.reduce((s, b) => s + b.month.sales, 0),
          orders: branchStats.reduce((s, b) => s + b.month.orders, 0),
          tax: branchStats.reduce((s, b) => s + b.month.tax, 0),
          discount: branchStats.reduce((s, b) => s + b.month.discount, 0),
        },
        range: {
          sales: branchStats.reduce((s, b) => s + b.range.sales, 0),
          orders: branchStats.reduce((s, b) => s + b.range.orders, 0),
          tax: branchStats.reduce((s, b) => s + b.range.tax, 0),
          discount: branchStats.reduce((s, b) => s + b.range.discount, 0),
        },
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
      const startDate = req.query.startDate
        ? new Date(req.query.startDate as string)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = req.query.endDate
        ? new Date(req.query.endDate as string)
        : new Date();

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
      const startDate = req.query.startDate
        ? new Date(req.query.startDate as string)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = req.query.endDate
        ? new Date(req.query.endDate as string)
        : new Date();

      const report = await storage.getSalesReport(
        await getRestaurantId(req),
        startDate,
        endDate,
        branchId,
      );
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

      const report = await storage.getTopSellingItems(
        await getRestaurantId(req),
        limit,
        branchId,
      );
      res.json(report);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to get top items report" });
    }
  });

  app.get("/api/reports/orders-by-type", async (req, res) => {
    try {
      const branchId = req.query.branch as string | undefined;
      const startDate = req.query.startDate
        ? new Date(req.query.startDate as string)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = req.query.endDate
        ? new Date(req.query.endDate as string)
        : new Date();

      const report = await storage.getOrdersByType(
        await getRestaurantId(req),
        startDate,
        endDate,
        branchId,
      );
      res.json(report);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to get orders by type report" });
    }
  });

  app.get("/api/reports/hourly-stats", async (req, res) => {
    try {
      const branchId = req.query.branch as string | undefined;
      const date = req.query.date
        ? new Date(req.query.date as string)
        : new Date();

      const report = await storage.getHourlyOrderStats(
        await getRestaurantId(req),
        date,
        branchId,
      );
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

      const [todaySales, weekSales, monthSales, topItems, ordersByType] =
        await Promise.all([
          storage.getSalesReport(
            await getRestaurantId(req),
            today,
            tomorrow,
            branchId,
          ),
          storage.getSalesReport(
            await getRestaurantId(req),
            weekStart,
            tomorrow,
            branchId,
          ),
          storage.getSalesReport(
            await getRestaurantId(req),
            monthStart,
            tomorrow,
            branchId,
          ),
          storage.getTopSellingItems(await getRestaurantId(req), 5, branchId),
          storage.getOrdersByType(
            await getRestaurantId(req),
            monthStart,
            tomorrow,
            branchId,
          ),
        ]);

      const sumSales = (data: any[]) =>
        data.reduce((acc, row) => acc + parseFloat(row.total_sales || 0), 0);
      const sumOrders = (data: any[]) =>
        data.reduce((acc, row) => acc + parseInt(row.order_count || 0), 0);

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

  app.get("/api/reports/advanced", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const branchId = req.query.branch as string | undefined;
      const startDate = req.query.startDate
        ? new Date(req.query.startDate as string)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const endDate = req.query.endDate
        ? new Date(req.query.endDate as string)
        : new Date();

      const branchOrderFilter = branchId
        ? sql`AND o.branch_id = ${branchId}`
        : sql``;
      const branchInventoryFilter = branchId
        ? sql`AND it.branch_id = ${branchId}`
        : sql``;

      const [
        peakHours,
        lowestSellingItems,
        averageTicketRows,
        tableTurnover,
        wasteRows,
        branchComparison,
        waiterPerformance,
      ] = await Promise.all([
        db.execute(sql`
          SELECT
            EXTRACT(HOUR FROM o.created_at)::int AS hour,
            COUNT(*)::int AS order_count,
            COALESCE(SUM(CAST(o.total AS DECIMAL)), 0) AS total_sales
          FROM orders o
          WHERE o.restaurant_id = ${restaurantId}
            AND o.created_at >= ${startDate}
            AND o.created_at <= ${endDate}
            AND o.status NOT IN ('cancelled', 'refunded')
            ${branchOrderFilter}
          GROUP BY EXTRACT(HOUR FROM o.created_at)
          ORDER BY order_count DESC
          LIMIT 6
        `),
        db.execute(sql`
          SELECT
            mi.id,
            COALESCE(mi.name_ar, mi.name_en) AS name,
            COALESCE(SUM(oi.quantity), 0)::int AS total_quantity,
            COALESCE(SUM(CAST(oi.total_price AS DECIMAL)), 0) AS total_revenue
          FROM order_items oi
          JOIN menu_items mi ON mi.id = oi.menu_item_id
          JOIN orders o ON o.id = oi.order_id
          WHERE o.restaurant_id = ${restaurantId}
            AND o.created_at >= ${startDate}
            AND o.created_at <= ${endDate}
            AND o.status NOT IN ('cancelled', 'refunded')
            ${branchOrderFilter}
          GROUP BY mi.id, mi.name_ar, mi.name_en
          ORDER BY total_quantity ASC, total_revenue ASC
          LIMIT 10
        `),
        db.execute(sql`
          SELECT
            COALESCE(AVG(CAST(o.total AS DECIMAL)), 0) AS avg_ticket,
            COUNT(*)::int AS orders_count,
            COALESCE(SUM(CAST(o.total AS DECIMAL)), 0) AS total_sales
          FROM orders o
          WHERE o.restaurant_id = ${restaurantId}
            AND o.created_at >= ${startDate}
            AND o.created_at <= ${endDate}
            AND o.status NOT IN ('cancelled', 'refunded')
            ${branchOrderFilter}
        `),
        db.execute(sql`
          SELECT
            o.table_id,
            COALESCE(t.table_number, 'N/A') AS table_number,
            COUNT(*)::int AS order_count,
            COALESCE(SUM(CAST(o.total AS DECIMAL)), 0) AS total_sales
          FROM orders o
          LEFT JOIN tables t ON t.id = o.table_id
          WHERE o.restaurant_id = ${restaurantId}
            AND o.created_at >= ${startDate}
            AND o.created_at <= ${endDate}
            AND o.order_type = 'dine_in'
            AND o.table_id IS NOT NULL
            AND o.status NOT IN ('cancelled', 'refunded')
            ${branchOrderFilter}
          GROUP BY o.table_id, t.table_number
          ORDER BY order_count DESC
          LIMIT 10
        `),
        db.execute(sql`
          SELECT
            COALESCE(SUM(CASE WHEN it.type = 'waste' THEN CAST(it.quantity AS DECIMAL) ELSE 0 END), 0) AS waste_qty,
            COALESCE(SUM(CASE WHEN it.type = 'usage' THEN CAST(it.quantity AS DECIMAL) ELSE 0 END), 0) AS usage_qty
          FROM inventory_transactions it
          JOIN inventory_items ii ON ii.id = it.inventory_item_id
          WHERE ii.restaurant_id = ${restaurantId}
            AND it.created_at >= ${startDate}
            AND it.created_at <= ${endDate}
            ${branchInventoryFilter}
        `),
        db.execute(sql`
          SELECT
            b.id,
            b.name,
            COALESCE(COUNT(o.id), 0)::int AS order_count,
            COALESCE(SUM(CAST(o.total AS DECIMAL)), 0) AS total_sales
          FROM branches b
          LEFT JOIN orders o ON o.branch_id = b.id
            AND o.created_at >= ${startDate}
            AND o.created_at <= ${endDate}
            AND o.status NOT IN ('cancelled', 'refunded')
          WHERE b.restaurant_id = ${restaurantId}
          GROUP BY b.id, b.name
          ORDER BY total_sales DESC
        `),
        db.execute(sql`
          SELECT
            COALESCE(oal.user_name, 'Unknown') AS user_name,
            COUNT(*)::int AS order_count,
            COALESCE(SUM(CAST(o.total AS DECIMAL)), 0) AS total_sales
          FROM order_audit_log oal
          JOIN orders o ON o.id = oal.order_id
          WHERE o.restaurant_id = ${restaurantId}
            AND oal.action = 'created'
            AND o.created_at >= ${startDate}
            AND o.created_at <= ${endDate}
            AND o.status NOT IN ('cancelled', 'refunded')
            ${branchOrderFilter}
          GROUP BY oal.user_name
          ORDER BY order_count DESC
          LIMIT 10
        `),
      ]);

      const avgRow = (averageTicketRows as any)?.rows?.[0] || {};
      const wasteRow = (wasteRows as any)?.rows?.[0] || {};
      const wasteQty = parseFloat(wasteRow.waste_qty || "0");
      const usageQty = parseFloat(wasteRow.usage_qty || "0");
      const wastePercent =
        wasteQty + usageQty > 0 ? (wasteQty / (wasteQty + usageQty)) * 100 : 0;

      res.json({
        range: {
          startDate,
          endDate,
          branchId: branchId || null,
        },
        averageTicket: parseFloat(avgRow.avg_ticket || "0"),
        totalSales: parseFloat(avgRow.total_sales || "0"),
        orderCount: parseInt(avgRow.orders_count || "0", 10),
        waste: {
          quantity: wasteQty,
          usageQuantity: usageQty,
          percent: Number(wastePercent.toFixed(2)),
        },
        peakHours: (peakHours as any)?.rows || [],
        lowestSellingItems: (lowestSellingItems as any)?.rows || [],
        tableTurnover: (tableTurnover as any)?.rows || [],
        waiterPerformance: (waiterPerformance as any)?.rows || [],
        branchComparison: (branchComparison as any)?.rows || [],
      });
    } catch (error) {
      console.error("Advanced reports error:", error);
      res.status(500).json({ error: "Failed to get advanced reports" });
    }
  });

  // ===============================
  // DAY SESSIONS REPORTS - تقارير الشفتات
  // ===============================

  // تقرير جميع الشفتات المغلقة
  app.get("/api/reports/day-sessions", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const branchId = req.query.branch as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const status = (req.query.status as string) || "closed"; // closed, open, all

      // جلب الشفتات
      let sessions = await storage.getDaySessions(restaurantId, branchId);

      // فلترة حسب الحالة
      if (status !== "all") {
        sessions = sessions.filter((s: any) => s.status === status);
      }

      // فلترة حسب التاريخ
      if (startDate) {
        sessions = sessions.filter((s: any) => s.date >= startDate);
      }
      if (endDate) {
        sessions = sessions.filter((s: any) => s.date <= endDate);
      }

      // حساب الإجماليات
      const totals = sessions.reduce(
        (acc: any, s: any) => ({
          totalSales: acc.totalSales + parseFloat(s.totalSales || 0),
          totalOrders: acc.totalOrders + parseInt(s.totalOrders || 0),
          cashSales: acc.cashSales + parseFloat(s.cashSales || 0),
          cardSales: acc.cardSales + parseFloat(s.cardSales || 0),
          totalDifference: acc.totalDifference + parseFloat(s.difference || 0),
          sessionsCount: acc.sessionsCount + 1,
        }),
        {
          totalSales: 0,
          totalOrders: 0,
          cashSales: 0,
          cardSales: 0,
          totalDifference: 0,
          sessionsCount: 0,
        },
      );

      res.json({
        sessions,
        totals,
      });
    } catch (error) {
      console.error("Day sessions report error:", error);
      res.status(500).json({ error: "Failed to get day sessions report" });
    }
  });

  // ملخص الشفتات الشهري
  app.get("/api/reports/day-sessions/monthly-summary", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const branchId = req.query.branch as string | undefined;
      const year =
        parseInt(req.query.year as string) || new Date().getFullYear();
      const month =
        parseInt(req.query.month as string) || new Date().getMonth() + 1;

      // جلب الشفتات لهذا الشهر
      const startDate = `${year}-${month.toString().padStart(2, "0")}-01`;
      const endDate = `${year}-${month.toString().padStart(2, "0")}-31`;

      let sessions = await storage.getDaySessions(restaurantId, branchId);
      sessions = sessions.filter(
        (s: any) =>
          s.date >= startDate && s.date <= endDate && s.status === "closed",
      );

      // تجميع حسب اليوم
      const dailyData = sessions.map((s: any) => ({
        date: s.date,
        totalSales: parseFloat(s.totalSales || 0),
        totalOrders: parseInt(s.totalOrders || 0),
        cashSales: parseFloat(s.cashSales || 0),
        cardSales: parseFloat(s.cardSales || 0),
        difference: parseFloat(s.difference || 0),
        openingBalance: parseFloat(s.openingBalance || 0),
        closingBalance: parseFloat(s.closingBalance || 0),
      }));

      // الإجمالي
      const summary = {
        year,
        month,
        daysWorked: sessions.length,
        totalSales: dailyData.reduce((sum, d) => sum + d.totalSales, 0),
        totalOrders: dailyData.reduce((sum, d) => sum + d.totalOrders, 0),
        cashSales: dailyData.reduce((sum, d) => sum + d.cashSales, 0),
        cardSales: dailyData.reduce((sum, d) => sum + d.cardSales, 0),
        totalDifference: dailyData.reduce((sum, d) => sum + d.difference, 0),
        averageDailySales:
          sessions.length > 0
            ? dailyData.reduce((sum, d) => sum + d.totalSales, 0) /
              sessions.length
            : 0,
        averageDailyOrders:
          sessions.length > 0
            ? Math.round(
                dailyData.reduce((sum, d) => sum + d.totalOrders, 0) /
                  sessions.length,
              )
            : 0,
      };

      res.json({
        summary,
        dailyData,
      });
    } catch (error) {
      console.error("Monthly summary error:", error);
      res.status(500).json({ error: "Failed to get monthly summary" });
    }
  });

  // تفاصيل شفت واحد مع التحويلات
  app.get("/api/reports/day-sessions/:id/details", async (req, res) => {
    try {
      const session = await storage.getDaySession(req.params.id);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }
      await verifyOwnership(req, session, "Day session");

      // جلب التحويلات النقدية
      const transactions = await storage.getCashTransactions(req.params.id);

      // جلب الطلبات لهذا اليوم
      const restaurantId = await getRestaurantId(req);
      const sessionDate = new Date(session.date);
      const nextDay = new Date(sessionDate);
      nextDay.setDate(nextDay.getDate() + 1);

      const orders = await storage.getOrders(
        restaurantId,
        session.branchId || undefined,
      );
      const sessionOrders = orders.filter((o: any) => {
        const orderDate = new Date(o.createdAt);
        return orderDate >= sessionDate && orderDate < nextDay;
      });

      // تفصيل طرق الدفع
      const paymentBreakdown = sessionOrders.reduce((acc: any, o: any) => {
        const method = o.paymentMethod || "cash";
        if (!acc[method]) {
          acc[method] = { count: 0, total: 0 };
        }
        acc[method].count += 1;
        acc[method].total += parseFloat(o.total || 0);
        return acc;
      }, {});

      res.json({
        session,
        transactions,
        ordersCount: sessionOrders.length,
        paymentBreakdown,
      });
    } catch (error: any) {
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
      console.error("Session details error:", error);
      res.status(500).json({ error: "Failed to get session details" });
    }
  });

  // Authentication
  app.get("/api/auth/me", async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (user.role !== "platform_admin") {
        const restaurant = await storage.getRestaurantById(user.restaurantId!);
        if (!restaurant || restaurant.isActive === false) {
          return res
            .status(403)
            .json({ error: "Restaurant subscription is inactive" });
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
      const clientIp = ((req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()) || req.ip || "unknown";
      if (isLoginRateLimited(clientIp)) {
        console.warn(`[AUTH] Rate limit exceeded for IP: ${clientIp}`);
        return res.status(429).json({
          error: "Too many login attempts. Please try again in 10 minutes.",
          errorAr: "محاولات دخول كثيرة. حاول مرة أخرى بعد 10 دقائق.",
        });
      }

      const { email, password } = req.body;
      if (!email || !password) {
        return res
          .status(400)
          .json({ error: "Email and password are required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user) {
        recordFailedLogin(clientIp);
        console.warn(`[AUTH] Failed login - email not found: ${email} from IP: ${clientIp}`);
        return res.status(401).json({ error: "Invalid credentials" });
      }

      if (!user.isActive) {
        recordFailedLogin(clientIp);
        console.warn(`[AUTH] Failed login - account disabled: ${email} from IP: ${clientIp}`);
        return res.status(401).json({ error: "Account is disabled" });
      }

      if (user.role !== "platform_admin") {
        const restaurant = await storage.getRestaurantById(user.restaurantId!);
        if (!restaurant || restaurant.isActive === false) {
          return res.status(403).json({
            error:
              "Restaurant subscription is inactive. Please contact the platform administrator.",
          });
        }
      }

      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        recordFailedLogin(clientIp);
        console.warn(`[AUTH] Failed login - wrong password for: ${email} from IP: ${clientIp} at ${new Date().toISOString()}`);
        return res.status(401).json({ error: "Invalid credentials" });
      }

      // Successful login — reset failed attempts counter
      resetLoginAttempts(clientIp);
      await storage.updateUserLastLogin(user.id);

      // Generate JWT token
      const token = signToken({
        userId: user.id,
        restaurantId: user.restaurantId || "",
      });

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
      if (!req.body.email || typeof req.body.email !== "string") {
        return res.status(400).json({ error: "Email is required" });
      }

      const emailLower = req.body.email.toLowerCase().trim();

      // Check if email already exists (case-insensitive)
      const existingUser = await storage.getUserByEmail(emailLower);
      if (existingUser) {
        return res.status(409).json({
          error: "البريد الإلكتروني مسجل بالفعل - Email already exists",
          code: "EMAIL_EXISTS",
        });
      }
      const isPlatformAdmin = emailLower === PLATFORM_ADMIN_EMAIL;

      const restaurantName =
        req.body.restaurantName?.trim() || req.body.name || "My Restaurant";

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
        role: isPlatformAdmin ? "platform_admin" : req.body.role || "owner",
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
      const token = signToken({
        userId: user.id,
        restaurantId: user.restaurantId || "",
      });

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
        return res
          .status(403)
          .json({ error: "Platform admin access required" });
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
        allBranches.push(
          ...branches.map((b) => ({ ...b, restaurantId: r.id })),
        );
      }

      const restaurantsWithDetails = [];
      for (const r of allRestaurants.filter((r) => r.id !== "platform")) {
        const owner = allUsers.find(
          (u) => u.restaurantId === r.id && u.role === "owner",
        );
        const restaurantUsers = allUsers.filter((u) => u.restaurantId === r.id);
        const restaurantBranches = allBranches.filter(
          (b) => b.restaurantId === r.id,
        );
        const orders = await storage.getOrdersByRestaurant(r.id);
        const menuItemsList = await storage.getMenuItems(r.id);

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayOrders = orders.filter(
          (o) => new Date(o.createdAt!) >= todayStart,
        );
        const revenue = orders.reduce(
          (sum, o) => sum + parseFloat(o.total || "0"),
          0,
        );
        const todayRevenue = todayOrders.reduce(
          (sum, o) => sum + parseFloat(o.total || "0"),
          0,
        );
        const avgOrderValue = orders.length > 0 ? revenue / orders.length : 0;

        const recentOrders = orders
          .sort(
            (a, b) =>
              new Date(b.createdAt!).getTime() -
              new Date(a.createdAt!).getTime(),
          )
          .slice(0, 10)
          .map((o) => ({
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
          users: restaurantUsers.map((u) => {
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
      const restaurants = allRestaurants.filter((r) => r.id !== "platform");
      const nonAdminUsers = allUsers.filter((u) => u.role !== "platform_admin");

      let totalOrders = 0;
      let totalRevenue = 0;
      let totalMenuItems = 0;
      let todayOrders = 0;
      let todayRevenue = 0;
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const ordersByStatus: Record<string, number> = {};
      const ordersByType: Record<string, number> = {};
      const revenueByRestaurant: Array<{
        name: string;
        revenue: number;
        orders: number;
      }> = [];

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
        revenueByRestaurant.push({
          name: r.nameEn,
          revenue: rRevenue,
          orders: orders.length,
        });
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
        activeRestaurants: restaurants.filter((r) => r.isActive !== false)
          .length,
        inactiveRestaurants: restaurants.filter((r) => r.isActive === false)
          .length,
        todayOrders,
        todayRevenue: todayRevenue.toFixed(2),
        ordersByStatus,
        ordersByType,
        planCounts,
        roleCounts,
        revenueByRestaurant: revenueByRestaurant.sort(
          (a, b) => b.revenue - a.revenue,
        ),
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Failed to get stats" });
    }
  });

  app.get(
    "/api/admin/restaurant/:id",
    requirePlatformAdmin,
    async (req, res) => {
      try {
        const restaurant = await storage.getRestaurantById(req.params.id);
        if (!restaurant)
          return res.status(404).json({ error: "Restaurant not found" });
        const users = await storage.getUsers(req.params.id);
        const branches = await storage.getBranches(req.params.id);
        const orders = await storage.getOrdersByRestaurant(req.params.id);

        res.json({
          ...restaurant,
          users: users.map((u) => {
            const { password: _, ...rest } = u;
            return rest;
          }),
          branches,
          ordersCount: orders.length,
          totalRevenue: orders
            .reduce((sum, o) => sum + parseFloat(o.total || "0"), 0)
            .toFixed(2),
        });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to get restaurant details" });
      }
    },
  );

  app.patch(
    "/api/admin/restaurant/:id/subscription",
    requirePlatformAdmin,
    async (req, res) => {
      try {
        const {
          subscriptionStart,
          subscriptionEnd,
          subscriptionPlan,
          subscriptionNotes,
        } = req.body;
        const restaurant = await storage.getRestaurantById(req.params.id);
        if (!restaurant)
          return res.status(404).json({ error: "Restaurant not found" });

        const validPlans = ["trial", "basic", "pro", "enterprise"];
        if (subscriptionPlan && !validPlans.includes(subscriptionPlan)) {
          return res.status(400).json({ error: "Invalid subscription plan" });
        }

        const startDate = subscriptionStart
          ? new Date(subscriptionStart)
          : null;
        const endDate = subscriptionEnd ? new Date(subscriptionEnd) : null;

        if (startDate && isNaN(startDate.getTime())) {
          return res.status(400).json({ error: "Invalid start date" });
        }
        if (endDate && isNaN(endDate.getTime())) {
          return res.status(400).json({ error: "Invalid end date" });
        }
        if (startDate && endDate && endDate < startDate) {
          return res
            .status(400)
            .json({ error: "End date must be after start date" });
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
    },
  );

  // Platform admin: update restaurant business info (owner, CR, VAT, address, bank)
  app.patch(
    "/api/admin/restaurant/:id/business-info",
    requirePlatformAdmin,
    async (req, res) => {
      try {
        const restaurant = await storage.getRestaurantById(req.params.id);
        if (!restaurant)
          return res.status(404).json({ error: "Restaurant not found" });

        const allowedFields = [
          "ownerName",
          "ownerPhone",
          "vatNumber",
          "commercialRegistration",
          "postalCode",
          "buildingNumber",
          "streetName",
          "district",
          "city",
          "bankName",
          "bankAccountHolder",
          "bankAccountNumber",
          "bankSwift",
          "bankIban",
          "taxEnabled",
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

        const updated = await storage.updateRestaurantById(
          req.params.id,
          updateData,
        );
        res.json(updated);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to update business info" });
      }
    },
  );

  app.post(
    "/api/admin/notifications/send",
    requirePlatformAdmin,
    async (req, res) => {
      try {
        const {
          title,
          titleAr,
          message,
          messageAr,
          priority,
          targetRestaurantIds,
        } = req.body;

        if (!title || !message) {
          return res
            .status(400)
            .json({ error: "Title and message are required" });
        }

        const validPriorities = ["low", "normal", "high", "urgent"];
        if (priority && !validPriorities.includes(priority)) {
          return res.status(400).json({ error: "Invalid priority" });
        }

        const allRestaurants = await storage.getAllRestaurants();
        const targets =
          targetRestaurantIds && targetRestaurantIds.length > 0
            ? allRestaurants.filter(
                (r) =>
                  r.id !== "platform" && targetRestaurantIds.includes(r.id),
              )
            : allRestaurants.filter((r) => r.id !== "platform");

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
    },
  );

  // Platform admin: update EdfaPay payment settings for a restaurant
  app.patch(
    "/api/admin/restaurant/:id/payment-settings",
    requirePlatformAdmin,
    async (req, res) => {
      try {
        const restaurant = await storage.getRestaurantById(req.params.id);
        if (!restaurant)
          return res.status(404).json({ error: "Restaurant not found" });

        const allowedFields = [
          "edfapayMerchantId",
          "edfapayPassword",
          "edfapaySoftposAuthToken",
        ];
        const updateData: Record<string, any> = {};
        for (const field of allowedFields) {
          if (req.body[field] !== undefined) {
            updateData[field] = req.body[field] || null;
          }
        }

        if (Object.keys(updateData).length === 0) {
          return res.status(400).json({ error: "No valid fields to update" });
        }

        const updated = await storage.updateRestaurantById(
          req.params.id,
          updateData,
        );
        res.json({
          success: true,
          configured: !!(
            updated?.edfapayMerchantId && updated?.edfapayPassword
          ),
          softposConfigured: !!updated?.edfapaySoftposAuthToken,
        });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to update payment settings" });
      }
    },
  );

  app.patch(
    "/api/admin/restaurant/:id/toggle-active",
    requirePlatformAdmin,
    async (req, res) => {
      try {
        const restaurant = await storage.getRestaurantById(req.params.id);
        if (!restaurant)
          return res.status(404).json({ error: "Restaurant not found" });

        const updated = await storage.updateRestaurantById(req.params.id, {
          isActive: !restaurant.isActive,
        });
        res.json(updated);
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to toggle restaurant status" });
      }
    },
  );

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
      const recipes = await storage.getRecipesByRestaurant(
        await getRestaurantId(req),
      );
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
      try {
        wsManager.notifyDataChanged(data.restaurantId, "recipes", "created");
      } catch {}
      res.json(recipe);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.put("/api/recipes/:id", async (req, res) => {
    try {
      await getRestaurantId(req); // require auth
      const data = insertRecipeSchema.partial().parse(req.body);
      const recipe = await storage.updateRecipe(req.params.id, data);
      if (!recipe) {
        return res.status(404).json({ error: "Recipe not found" });
      }
      try {
        const rid = await getRestaurantId(req);
        wsManager.notifyDataChanged(rid, "recipes", "updated");
      } catch {}
      res.json(recipe);
    } catch (error: any) {
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.delete("/api/recipes/:id", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      await storage.deleteRecipe(req.params.id);
      try {
        wsManager.notifyDataChanged(restaurantId, "recipes", "deleted");
      } catch {}
      res.json({ success: true });
    } catch (error: any) {
      if (error?.message === "Authentication required")
        return res.status(401).json({ error: error.message });
      res.status(500).json({ error: "Failed to delete recipe" });
    }
  });

  app.delete("/api/menu-items/:menuItemId/recipes", async (req, res) => {
    try {
      const menuItem = await storage.getMenuItem(req.params.menuItemId);
      if (!menuItem)
        return res.status(404).json({ error: "Menu item not found" });
      await verifyOwnership(req, menuItem, "Menu item");
      await storage.deleteRecipesByMenuItem(req.params.menuItemId);
      try {
        wsManager.notifyDataChanged(
          menuItem.restaurantId,
          "recipes",
          "deleted",
        );
      } catch {}
      res.json({ success: true });
    } catch (error: any) {
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to delete recipes" });
    }
  });

  // Printers
  app.get("/api/printers", async (req, res) => {
    try {
      const branchId = req.query.branch as string | undefined;
      const printers = await storage.getPrinters(
        await getRestaurantId(req),
        branchId,
      );
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
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
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
      if (!existing)
        return res.status(404).json({ error: "Printer not found" });
      await verifyOwnership(req, existing, "Printer");
      const data = insertPrinterSchema.partial().parse(req.body);
      const printer = await storage.updatePrinter(req.params.id, data);
      if (!printer) {
        return res.status(404).json({ error: "Printer not found" });
      }
      res.json(printer);
    } catch (error: any) {
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.delete("/api/printers/:id", async (req, res) => {
    try {
      const existing = await storage.getPrinter(req.params.id);
      if (!existing)
        return res.status(404).json({ error: "Printer not found" });
      await verifyOwnership(req, existing, "Printer");
      await storage.deletePrinter(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to delete printer" });
    }
  });

  // Get printers by kitchen section (for kitchen display integration)
  app.get("/api/printers/kitchen-section/:sectionId", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const allPrinters = await storage.getPrinters(restaurantId);
      const sectionPrinters = allPrinters.filter(
        (p: any) =>
          p.kitchenSectionId === req.params.sectionId &&
          p.type === "kitchen" &&
          p.isActive,
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
      const receiptPrinters = allPrinters.filter(
        (p: any) => p.type === "receipt" && p.isActive,
      );
      const defaultPrinter =
        receiptPrinters.find((p: any) => p.isDefault) ||
        receiptPrinters[0] ||
        null;
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
      const menuItemsMap = new Map(menuItemsData.map((m) => [m.id, m]));
      const itemsWithDetails = orderItems.map((item) => {
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
            : item.itemName
              ? {
                  nameAr: item.itemName,
                  nameEn: item.itemName,
                  price: item.unitPrice,
                  kitchenSectionId: null,
                }
              : null,
        };
      });
      const invoice = await storage.getInvoiceByOrder(order.id);
      res.json({
        order,
        items: itemsWithDetails,
        invoice: invoice || null,
        restaurant: restaurant
          ? {
              nameEn: restaurant.nameEn,
              nameAr: restaurant.nameAr,
              vatNumber: restaurant.vatNumber,
              commercialRegistration: restaurant.commercialRegistration,
              address: restaurant.address,
              phone: restaurant.phone,
              logo: restaurant.logo,
            }
          : null,
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
        configured: edfapay.hasCredentials(
          restaurant?.edfapayMerchantId,
          restaurant?.edfapayPassword,
        ),
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
        environment: restaurant.edfapaySoftposAuthToken
          ? "PRODUCTION"
          : "SANDBOX",
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
    res.status(410).json({
      error: "Moyasar integration has been removed. Use EdfaPay instead.",
      deprecated: true,
    });
  });

  // ===============================
  // 1. RESERVATIONS - نظام الحجوزات
  // ===============================
  app.get("/api/reservations", async (req, res) => {
    try {
      const authUser = await getAuthenticatedUser(req);
      const restaurantId = authUser.restaurantId!;
      const isLockedEmployee = ["cashier", "waiter", "kitchen", "delivery"].includes(authUser.role || "");
      const branchId = (isLockedEmployee && authUser.branchId)
        ? authUser.branchId
        : req.query.branch as string | undefined;
      const dateStr = req.query.date as string | undefined;
      const date = dateStr ? new Date(dateStr) : undefined;
      const reservations = await storage.getReservations(restaurantId, branchId, date);
      res.json(reservations);
    } catch (error) {
      console.error(error);
      handleRouteError(res, error, "Failed to get reservations");
    }
  });

  app.get("/api/reservations/check-deposit", async (req, res) => {
    try {
      const phone = req.query.phone as string;
      if (!phone) {
        return res.status(400).json({ error: "Phone number is required" });
      }
      const restaurantId = await getRestaurantId(req);
      const reservation = await storage.findPaidDepositByPhone(
        restaurantId,
        phone,
      );
      if (reservation) {
        res.json({
          hasDeposit: true,
          depositAmount: reservation.depositAmount,
          reservationId: reservation.id,
          customerName: reservation.customerName,
        });
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
      const slots = await storage.getAvailableTimeSlots(
        await getRestaurantId(req),
        branchId,
        date,
      );
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
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to get reservation" });
    }
  });

  app.post("/api/reservations", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const restaurant = await storage.getRestaurantById(restaurantId);

      // Validate required fields
      if (
        !req.body.customerName ||
        !req.body.customerPhone ||
        !req.body.reservationTime
      ) {
        return res.status(400).json({
          error: "missingFields",
          message: "Name, phone, and time are required",
        });
      }

      // Reject past reservation dates/times
      const reservationDateValue = req.body.reservationDate
        ? new Date(req.body.reservationDate)
        : new Date();
      const requestedDateTime = new Date(
        `${reservationDateValue.toISOString().split("T")[0]}T${req.body.reservationTime}:00`,
      );
      if (requestedDateTime <= new Date()) {
        return res.status(400).json({
          error: "pastDateTime",
          message: "لا يمكن الحجز في وقت سابق - Cannot book in the past",
        });
      }

      // Use restaurant settings for duration and deposit
      const defaultDuration = (restaurant as any)?.reservationDuration || 90;
      const depositAmount =
        (restaurant as any)?.reservationDepositAmount || "20.00";

      const tableId =
        req.body.tableId && req.body.tableId !== "any"
          ? req.body.tableId
          : null;
      const reservationTime = req.body.reservationTime;
      const duration = parseInt(req.body.duration) || defaultDuration;

      // Check for table conflict if a specific table is selected
      if (tableId && reservationTime) {
        const conflict = await storage.checkTableConflict(
          restaurantId,
          tableId,
          reservationDateValue,
          reservationTime,
          duration,
        );
        if (conflict) {
          return res.status(409).json({
            error: "tableConflict",
            message: `الطاولة محجوزة في هذا الوقت (${conflict.reservationTime} - ${conflict.customerName})`,
            conflictWith: {
              time: conflict.reservationTime,
              customerName: conflict.customerName,
            },
          });
        }
      }

      const guestCount =
        parseInt(req.body.guestCount) || parseInt(req.body.partySize) || 2;

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

      // Send WebSocket notification
      wsManager.notifyDataChanged(restaurantId, "reservations", "created");

      res.status(201).json(reservation);
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.put("/api/reservations/:id", async (req, res) => {
    try {
      const existing = await storage.getReservation(req.params.id);
      if (!existing)
        return res.status(404).json({ error: "Reservation not found" });
      await verifyOwnership(req, existing, "Reservation");
      const reservation = await storage.updateReservation(
        req.params.id,
        req.body,
      );
      if (!reservation) {
        return res.status(404).json({ error: "Reservation not found" });
      }
      
      // Send WebSocket notification
      wsManager.notifyDataChanged(existing.restaurantId, "reservations", "updated");
      
      res.json(reservation);
    } catch (error: any) {
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
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
      if (!existing)
        return res.status(404).json({ error: "Reservation not found" });
      await verifyOwnership(req, existing, "Reservation");
      const reservation = await storage.updateReservationStatus(
        req.params.id,
        status,
      );
      if (!reservation) {
        return res.status(404).json({ error: "Reservation not found" });
      }
      // If seated, update table status
      if (status === "seated" && reservation.tableId) {
        await storage.updateTableStatus(reservation.tableId, "occupied");
      }
      
      // Send WebSocket notification
      wsManager.notifyDataChanged(existing.restaurantId, "reservations", "updated");
      
      res.json(reservation);
    } catch (error) {
      res.status(500).json({ error: "Failed to update reservation status" });
    }
  });

  app.delete("/api/reservations/:id", async (req, res) => {
    try {
      const existing = await storage.getReservation(req.params.id);
      if (!existing)
        return res.status(404).json({ error: "Reservation not found" });
      await verifyOwnership(req, existing, "Reservation");
      await storage.deleteReservation(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to delete reservation" });
    }
  });

  app.put("/api/reservations/:id/deposit", async (req, res) => {
    try {
      const existing = await storage.getReservation(req.params.id);
      if (!existing)
        return res.status(404).json({ error: "Reservation not found" });
      await verifyOwnership(req, existing, "Reservation");
      const depositCode = existing.depositCode || generateDepositCode();
      const updated = await storage.updateReservation(req.params.id, {
        depositPaid: true,
        depositCode,
      } as any);
      if (!updated) {
        return res.status(404).json({ error: "Reservation not found" });
      }
      res.json(updated);
    } catch (error: any) {
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to update deposit status" });
    }
  });

  app.put("/api/reservations/:id/deposit-applied", async (req, res) => {
    try {
      const existing = await storage.getReservation(req.params.id);
      if (!existing)
        return res.status(404).json({ error: "Reservation not found" });
      await verifyOwnership(req, existing, "Reservation");
      const { orderId } = req.body;
      await storage.markDepositApplied(req.params.id, orderId);
      res.json({ success: true });
    } catch (error: any) {
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
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
      const promotions = await storage.getPromotions(
        await getRestaurantId(req),
        activeOnly,
        branchId,
      );
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
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
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
      if (!existing)
        return res.status(404).json({ error: "Promotion not found" });
      await verifyOwnership(req, existing, "Promotion");
      const promotion = await storage.updatePromotion(req.params.id, req.body);
      if (!promotion) {
        return res.status(404).json({ error: "Promotion not found" });
      }
      res.json(promotion);
    } catch (error: any) {
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.delete("/api/promotions/:id", async (req, res) => {
    try {
      const existing = await storage.getPromotion(req.params.id);
      if (!existing)
        return res.status(404).json({ error: "Promotion not found" });
      await verifyOwnership(req, existing, "Promotion");
      await storage.deletePromotion(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
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
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
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
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
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
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to delete coupon" });
    }
  });

  // Validate coupon
  app.post("/api/coupons/validate", async (req, res) => {
    try {
      const { code, orderTotal, customerPhone } = req.body;
      if (!code || orderTotal === undefined) {
        return res
          .status(400)
          .json({ error: "Code and orderTotal are required" });
      }
      const result = await storage.validateCoupon(
        await getRestaurantId(req),
        code,
        orderTotal,
        customerPhone,
      );
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
      const { orderId, customerName, customerPhone, rating, comment } =
        req.body;

      if (!rating || rating < 1 || rating > 5) {
        return res
          .status(400)
          .json({ error: "Rating must be between 1 and 5" });
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
      const publicReviews = allReviews.filter((r) => r.isPublic);
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
  app.get(
    "/api/public/:restaurantId/reviews/order/:orderId",
    async (req, res) => {
      try {
        const review = await storage.getReviewByOrder(req.params.orderId);
        res.json({ reviewed: !!review, review: review || null });
      } catch (error) {
        res.status(500).json({ error: "Failed to check review" });
      }
    },
  );

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
      await storage.updateReviewVisibility(
        req.params.id,
        restaurantId,
        isPublic,
      );
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
      if (!existing)
        return res.status(404).json({ error: "Variant not found" });
      const menuItem = await storage.getMenuItem(existing.menuItemId);
      await verifyOwnership(req, menuItem, "Menu item");
      const variant = await storage.updateMenuItemVariant(
        req.params.id,
        req.body,
      );
      if (!variant) {
        return res.status(404).json({ error: "Variant not found" });
      }
      res.json(variant);
    } catch (error: any) {
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.delete("/api/variants/:id", async (req, res) => {
    try {
      const existing = await storage.getMenuItemVariant(req.params.id);
      if (!existing)
        return res.status(404).json({ error: "Variant not found" });
      const menuItem = await storage.getMenuItem(existing.menuItemId);
      await verifyOwnership(req, menuItem, "Menu item");
      await storage.deleteMenuItemVariant(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to delete variant" });
    }
  });

  // ===============================
  // 3. CUSTOMIZATION GROUPS - مجموعات التخصيص
  // ===============================
  app.get("/api/customization-groups", async (req, res) => {
    try {
      const groups = await storage.getCustomizationGroups(
        await getRestaurantId(req),
      );
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
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
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
      const group = await storage.updateCustomizationGroup(
        req.params.id,
        req.body,
      );
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }
      res.json(group);
    } catch (error: any) {
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
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
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
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
      const option = await storage.updateCustomizationOption(
        req.params.id,
        req.body,
      );
      if (!option) {
        return res.status(404).json({ error: "Option not found" });
      }
      res.json(option);
    } catch (error: any) {
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
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
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to delete option" });
    }
  });

  // Link/Unlink customizations to menu items
  app.get("/api/menu-items/:menuItemId/customizations", async (req, res) => {
    try {
      const customizations = await storage.getMenuItemCustomizations(
        req.params.menuItemId,
      );
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

  app.delete(
    "/api/menu-items/:menuItemId/customizations/:groupId",
    async (req, res) => {
      try {
        await storage.unlinkMenuItemCustomization(
          req.params.menuItemId,
          req.params.groupId,
        );
        res.status(204).send();
      } catch (error) {
        res.status(500).json({ error: "Failed to unlink customization" });
      }
    },
  );

  // ===============================
  // 4. QUEUE MANAGEMENT - نظام الطابور
  // ===============================
  app.get("/api/queue", async (req, res) => {
    try {
      const authUser = await getAuthenticatedUser(req);
      const restaurantId = authUser.restaurantId!;
      const isLockedEmployee = ["cashier", "waiter", "kitchen", "delivery"].includes(authUser.role || "");
      const branchId = (isLockedEmployee && authUser.branchId)
        ? authUser.branchId
        : req.query.branch as string | undefined;
      const status = req.query.status as string | undefined;
      const entries = await storage.getQueueEntries(restaurantId, branchId, status);
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: "Failed to get queue entries" });
    }
  });

  app.get("/api/queue/stats", async (req, res) => {
    try {
      const authUser = await getAuthenticatedUser(req);
      const restaurantId = authUser.restaurantId!;
      const isLockedEmployee = ["cashier", "waiter", "kitchen", "delivery"].includes(authUser.role || "");
      const branchId = (isLockedEmployee && authUser.branchId)
        ? authUser.branchId
        : req.query.branch as string | undefined;
      // Count both "waiting" and "notified" so stats match what the app/web show
      const waitingEntries = await storage.getQueueEntries(restaurantId, branchId, "waiting");
      const notifiedEntries = await storage.getQueueEntries(restaurantId, branchId, "notified");
      const estimatedWait = await storage.getEstimatedWaitTime(
        restaurantId,
        branchId,
      );
      res.json({
        waitingCount: waitingEntries.length + notifiedEntries.length,
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
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to get queue entry" });
    }
  });

  app.post("/api/queue", async (req, res) => {
    try {
      // Validate phone number if provided
      if (req.body.customerPhone) {
        const phone = req.body.customerPhone.toString().trim();
        const phoneValidation = validatePhoneNumber(phone);
        if (!phoneValidation.valid) {
          return res.status(400).json({ error: phoneValidation.error });
        }
        req.body.customerPhone = phone;
      }

      const branchId = req.body.branchId as string | undefined;
      const queueNumber = await storage.getNextQueueNumber(
        await getRestaurantId(req),
        branchId,
      );
      const estimatedWait = await storage.getEstimatedWaitTime(
        await getRestaurantId(req),
        branchId,
      );

      const data = insertQueueEntrySchema.parse({
        ...req.body,
        restaurantId: await getRestaurantId(req),
        queueNumber,
        estimatedWaitMinutes: estimatedWait,
      });
      const entry = await storage.createQueueEntry(data);
      
      // Send WebSocket notification
      wsManager.notifyDataChanged(data.restaurantId, "queue", "created");
      
      res.status(201).json({ ...entry, position: queueNumber });
    } catch (error) {
      console.error(error);
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.put("/api/queue/:id", async (req, res) => {
    try {
      const existing = await storage.getQueueEntry(req.params.id);
      if (!existing)
        return res.status(404).json({ error: "Queue entry not found" });
      await verifyOwnership(req, existing, "Queue entry");
      const entry = await storage.updateQueueEntry(req.params.id, req.body);
      if (!entry) {
        return res.status(404).json({ error: "Queue entry not found" });
      }
      
      // Send WebSocket notification
      wsManager.notifyDataChanged(existing.restaurantId, "queue", "updated");
      
      res.json(entry);
    } catch (error: any) {
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
      res.status(400).json({ error: "Invalid request body" });
    }
  });

  app.put("/api/queue/:id/status", async (req, res) => {
    try {
      const { status, tableId } = req.body;
      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }

      // Get existing entry to get restaurantId for WebSocket
      const existing = await storage.getQueueEntry(req.params.id);
      if (!existing) {
        return res.status(404).json({ error: "Queue entry not found" });
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
      
      // Send WebSocket notification
      wsManager.notifyDataChanged(existing.restaurantId, "queue", "updated");
      
      res.json(entry);
    } catch (error) {
      res.status(500).json({ error: "Failed to update queue status" });
    }
  });

  app.delete("/api/queue/:id", async (req, res) => {
    try {
      const existing = await storage.getQueueEntry(req.params.id);
      if (!existing)
        return res.status(404).json({ error: "Queue entry not found" });
      await verifyOwnership(req, existing, "Queue entry");
      await storage.deleteQueueEntry(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to delete queue entry" });
    }
  });

  // Customer-facing: Check queue position by phone
  app.get("/api/queue/check/:phone", async (req, res) => {
    try {
      const branchId = req.query.branch as string | undefined;
      const entries = await storage.getQueueEntries(
        await getRestaurantId(req),
        branchId,
        "waiting",
      );
      const customerEntry = entries.find(
        (e) => e.customerPhone === req.params.phone,
      );

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
      const authUser = await getAuthenticatedUser(req);
      const restaurantId = authUser.restaurantId!;
      const isLockedEmployee = ["cashier", "waiter", "kitchen", "delivery"].includes(authUser.role || "");
      const branchId = (isLockedEmployee && authUser.branchId)
        ? authUser.branchId
        : req.query.branch as string | undefined;
      const sessions = await storage.getDaySessions(restaurantId, branchId);
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ error: "Failed to get day sessions" });
    }
  });

  app.get("/api/day-sessions/current", async (req, res) => {
    try {
      const authUser = await getAuthenticatedUser(req);
      const restaurantId = authUser.restaurantId!;
      const isLockedEmployee = ["cashier", "waiter", "kitchen", "delivery"].includes(authUser.role || "");
      const branchId = (isLockedEmployee && authUser.branchId)
        ? authUser.branchId
        : req.query.branch as string | undefined;
      const session = await storage.getCurrentDaySession(restaurantId, branchId);
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
      if (error?.message?.includes("not found"))
        return res.status(404).json({ error: error.message });
      res.status(500).json({ error: "Failed to get session" });
    }
  });

  app.post("/api/day-sessions/open", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const authUser = await getAuthenticatedUser(req);
      const isLockedEmployee = ["cashier", "waiter", "kitchen", "delivery"].includes(authUser.role || "");
      let branchId = (isLockedEmployee && authUser.branchId)
        ? authUser.branchId
        : req.query.branch as string | undefined;

      // Validate branchId
      if (branchId) {
        const branches = await storage.getBranches(restaurantId);
        if (!branches.some((b) => b.id === branchId)) {
          return res.status(400).json({ error: "Invalid branch" });
        }
      }

      // Check if there's already an open session for this branch
      const existingSession = await storage.getCurrentDaySession(
        restaurantId,
        branchId,
      );
      if (existingSession) {
        // Return the existing open session so the client can resume it
        return res.status(200).json(existingSession);
      }

      const today = new Date().toISOString().split('T')[0];
      // Build insert data manually to avoid Zod decimal type coercion issues
      // (client sends openingBalance as number, Zod expects string for decimal columns)
      const sessionData: any = {
        restaurantId,
        branchId: branchId || undefined,
        date: today,
        status: "open",
        openingBalance: String(parseFloat(req.body.openingBalance) || 0),
        notes: req.body.notes || undefined,
      };

      const session = await storage.openDaySession(sessionData);

      // Create notification
      await storage.createNotification({
        restaurantId: await getRestaurantId(req),
        branchId: branchId || undefined,
        type: "system",
        title: "Day Opened",
        titleAr: "تم فتح اليوم",
        message: `Day session opened with opening balance: ${req.body.openingBalance || 0} SAR`,
        messageAr: `تم فتح اليوم برصيد افتتاحي: ${req.body.openingBalance || 0} ر.س`,
        priority: "normal",
      });

      res.status(201).json(session);
    } catch (error: any) {
      res
        .status(400)
        .json({ error: error?.message || "Failed to open day session" });
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
        messageAr: `تم إغلاق اليوم. الفرق: ${session.difference} ر.س`,
        priority:
          parseFloat(session.difference || "0") !== 0 ? "high" : "normal",
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
        return res
          .status(400)
          .json({ error: "لا يمكن إضافة تحويلات ليوم مغلق" });
      }

      const data = insertCashTransactionSchema.parse({
        ...req.body,
        restaurantId: await getRestaurantId(req),
        sessionId: req.params.id,
      });

      const transaction = await storage.createCashTransaction(data);
      res.status(201).json(transaction);
    } catch (error: any) {
      res
        .status(400)
        .json({ error: error?.message || "Failed to create transaction" });
    }
  });

  // ===============================
  // NOTIFICATIONS - الإشعارات
  // ===============================
  app.get("/api/notifications", async (req, res) => {
    try {
      const branchId = req.query.branch as string | undefined;
      const unreadOnly = req.query.unread === "true";
      const notifications = await storage.getNotifications(
        await getRestaurantId(req),
        branchId,
        unreadOnly,
      );
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: "Failed to get notifications" });
    }
  });

  app.get("/api/notifications/unread-count", async (req, res) => {
    try {
      const branchId = req.query.branch as string | undefined;
      const notifications = await storage.getNotifications(
        await getRestaurantId(req),
        branchId,
        true,
      );
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
      const notification = await storage.markNotificationAsRead(
        req.params.id,
        req.body.readBy,
      );
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
      await storage.markAllNotificationsAsRead(
        await getRestaurantId(req),
        branchId,
      );
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
      if (error?.message === "Authentication required")
        return res.status(401).json({ error: error.message });
      res.status(500).json({ error: "Failed to delete notification" });
    }
  });

  // Notification Settings
  app.get("/api/notification-settings", async (req, res) => {
    try {
      const branchId = req.query.branch as string | undefined;
      let settings = await storage.getNotificationSettings(
        await getRestaurantId(req),
        branchId,
      );
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
      const settings = await storage.updateNotificationSettings(
        await getRestaurantId(req),
        branchId,
        req.body,
      );
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

  // --- Pending Payment Sessions (order data stored temporarily until payment completes) ---
  interface PendingPaymentSession {
    orderData: any;
    items: any[];
    restaurantId: string;
    branchId: string | null;
    createdAt: Date;
    isCreating?: boolean;
    createdOrderId?: string;
  }
  const pendingPaymentSessions = new Map<string, PendingPaymentSession>();
  const sessionToOrderMap = new Map<string, string>(); // sessionId → orderId

  // Cleanup stale sessions every 5 minutes (expire after 30 min)
  setInterval(
    () => {
      const now = Date.now();
      Array.from(pendingPaymentSessions.entries()).forEach(([id, session]) => {
        if (now - session.createdAt.getTime() > 30 * 60 * 1000) {
          pendingPaymentSessions.delete(id);
        }
      });
      Array.from(sessionToOrderMap.keys()).forEach((id) => {
        // Keep mappings for 1 hour then clean up
        // (no timestamp stored, so we just limit size)
        if (sessionToOrderMap.size > 1000) {
          sessionToOrderMap.delete(id);
        }
      });
    },
    5 * 60 * 1000,
  );

  // Helper: Create a real order from pending session data after payment is confirmed
  async function createOrderFromPendingSession(
    sessionId: string,
    paymentInfo: { transId?: string; gwayId?: string; webhookPayload?: any },
  ) {
    // Check if already created
    const existingOrderId = sessionToOrderMap.get(sessionId);
    if (existingOrderId) {
      const existingOrder = await storage.getOrder(existingOrderId);
      if (existingOrder) return existingOrder;
    }

    const session = pendingPaymentSessions.get(sessionId);
    if (!session) return null;

    // Primitive async lock
    if (session.isCreating) {
      await new Promise((r) => setTimeout(r, 2000));
      if (session.createdOrderId)
        return storage.getOrder(session.createdOrderId);
      return null;
    }
    session.isCreating = true;

    try {
      const { orderData, items, restaurantId, branchId } = session;

      // Create the actual order - directly as "pending" + isPaid: true
      const orderPayload = {
        ...orderData,
        restaurantId,
        branchId: branchId || null,
        status: "pending",
        isPaid: true,
        paymentMethod: "edfapay_online",
      };

      const data = insertOrderSchema.parse(orderPayload);

      const order = await createOrderAtomicPipeline({
        orderData: data,
        items: Array.isArray(items) ? items : [],
        userName: "online_payment",
      });

      // Create payment transaction
      await storage.createPaymentTransaction({
        restaurantId,
        orderId: order.id,
        edfapayTransactionId: paymentInfo.transId || null,
        edfapayGwayId: paymentInfo.gwayId || null,
        type: "payment",
        status: "paid",
        amount: Math.round(parseFloat(order.total || "0") * 100),
        currency: "SAR",
        paymentMethod: "edfapay_online",
        webhookReceived: !!paymentInfo.webhookPayload,
      });

      // Create ZATCA invoice
      try {
        const restaurant = await storage.getRestaurantById(restaurantId);
        if (restaurant) {
          const isTaxEnabled = restaurant.taxEnabled !== false;
          const taxRatePercent = isTaxEnabled ? 15 : 0;
          const now = new Date();
          const uuid = generateInvoiceUuid();
          const payBranchId = order.branchId || null;
          const invoiceNumber = await storage.getNextInvoiceNumber(
            restaurantId,
            payBranchId,
          );
          const { counter: payPrevC, lastHash: payPrevH } =
            await storage.getZatcaCounterAndHash(restaurantId, payBranchId);
          const currentCounter = payPrevC + 1;
          const previousHash =
            payPrevH ||
            Buffer.from(
              "NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==",
              "base64",
            ).toString("utf8");

          const payOrderItems = await storage.getOrderItems(order.id);
          const payMenuItemsRaw = await storage.getMenuItems(restaurantId);
          const payMenuItemsMap = new Map(
            payMenuItemsRaw.map((m) => [m.id, m]),
          );

          const payXmlItems: ZatcaLineItem[] = payOrderItems.map(
            (item, idx) => {
              const menuItem = item.menuItemId
                ? payMenuItemsMap.get(item.menuItemId)
                : null;
              const unitPrice = parseFloat(
                item.unitPrice || menuItem?.price || "0",
              );
              const qty = item.quantity || 1;
              const lineTotal = bankersRound(unitPrice * qty);
              const lineTax = bankersRound(lineTotal * (taxRatePercent / 100));
              return {
                id: String(idx + 1),
                nameAr: menuItem?.nameAr || menuItem?.nameEn || "منتج",
                nameEn: menuItem?.nameEn || "",
                quantity: qty,
                unitPrice,
                discount: 0,
                taxRate: taxRatePercent,
                taxAmount: lineTax,
                totalWithTax: bankersRound(lineTotal + lineTax),
                totalWithoutTax: lineTotal,
              };
            },
          );

          const paySubtotal = bankersRound(
            payXmlItems.reduce((sum, i) => sum + i.totalWithoutTax, 0),
          );
          const payDiscount = parseFloat(order.discount || "0");
          const payDeliveryFee = parseFloat(order.deliveryFee || "0");
          const payTaxable = bankersRound(
            Math.max(0, paySubtotal - payDiscount + payDeliveryFee),
          );
          const payVatAmount = bankersRound(
            payTaxable * (taxRatePercent / 100),
          );
          const payTotal = bankersRound(payTaxable + payVatAmount);

          const unsignedPayXml = generateZatcaXml({
            uuid,
            invoiceNumber,
            invoiceType: "simplified",
            issueDate: now.toISOString().split("T")[0],
            issueTime: now.toTimeString().split(" ")[0],
            deliveryDate: now.toISOString().split("T")[0],
            seller: {
              nameAr: restaurant.nameAr || restaurant.nameEn || "مطعم",
              vatNumber: restaurant.vatNumber || "",
              commercialRegistration: restaurant.commercialRegistration || "",
              streetName: restaurant.streetName || "",
              buildingNumber: restaurant.buildingNumber || "",
              district: restaurant.district || "",
              city: restaurant.city || "",
              postalCode: restaurant.postalCode || "",
              country: restaurant.country || "SA",
            },
            items: payXmlItems,
            subtotal: paySubtotal,
            discount: payDiscount,
            deliveryFee: payDeliveryFee,
            taxAmount: payVatAmount,
            taxRate: taxRatePercent,
            total: payTotal,
            paymentMethod: "edfapay_online",
            previousInvoiceHash: previousHash,
            invoiceCounter: currentCounter,
          });

          let payPrivKey: string | null = null;
          let payCert: string | null = null;
          if (payBranchId) {
            const br = await storage.getBranch(payBranchId);
            if (br && (br as any).zatcaPrivateKey) {
              payPrivKey = (br as any).zatcaPrivateKey;
              payCert =
                (br as any).zatcaProductionCsid ||
                (br as any).zatcaComplianceCsid ||
                (br as any).zatcaCertificate;
            }
          }
          if (!payPrivKey && (restaurant as any).zatcaPrivateKey) {
            payPrivKey = (restaurant as any).zatcaPrivateKey;
            payCert =
              restaurant.zatcaProductionCsid ||
              restaurant.zatcaComplianceCsid ||
              restaurant.zatcaCertificate;
          }

          const paySignResult = buildSignedInvoice(
            unsignedPayXml,
            payPrivKey,
            payCert,
            {
              sellerName: restaurant.nameAr || restaurant.nameEn || "مطعم",
              vatNumber: restaurant.vatNumber || "",
              timestamp: now.toISOString(),
              total: payTotal.toFixed(2),
              vatAmount: payVatAmount.toFixed(2),
            },
          );

          await storage.createInvoice({
            restaurantId,
            branchId: payBranchId,
            orderId: order.id,
            invoiceNumber,
            invoiceType: "simplified",
            subtotal: paySubtotal.toFixed(2),
            discount: payDiscount.toFixed(2),
            deliveryFee: payDeliveryFee.toFixed(2),
            taxRate: taxRatePercent.toFixed(2),
            taxAmount: payVatAmount.toFixed(2),
            total: payTotal.toFixed(2),
            qrCodeData: paySignResult.qrData,
            xmlContent: paySignResult.finalXml,
            invoiceHash: paySignResult.invoiceHash,
            previousInvoiceHash: previousHash,
            invoiceCounter: currentCounter,
            uuid,
            status: "issued",
            zatcaStatus: "pending",
            customerName: order.customerName || null,
            customerPhone: order.customerPhone || null,
            paymentMethod: "edfapay_online",
            signedXml: paySignResult.signedXml || null,
          });

          await storage.updateZatcaCounterAndHash(
            restaurantId,
            payBranchId,
            currentCounter,
            paySignResult.invoiceHash,
          );
        }
      } catch (invoiceError) {
        console.error(
          "Invoice creation error (payment session):",
          invoiceError,
        );
      }

      // Update day session totals
      try {
        const currentSession = await storage.getCurrentDaySession(
          restaurantId,
          order.branchId || undefined,
        );
        if (currentSession) {
          const orderTotal = parseFloat(order.total || "0");
          await storage.incrementDaySessionTotals(
            currentSession.id,
            orderTotal,
            "edfapay_online",
          );
        }
      } catch (e) {
        console.error(
          "Failed to update day session totals (payment session):",
          e,
        );
      }

      // Notify kitchen
      try {
        wsManager.notifyNewOrder(
          order.restaurantId,
          order.branchId || "",
          order,
        );
      } catch (e) {
        console.error("Failed to send WebSocket notification:", e);
      }

      // Store mapping and clean up
      session.createdOrderId = order.id;
      sessionToOrderMap.set(sessionId, order.id);

      // Create audit log
      try {
        await storage.createOrderAuditLog({
          orderId: order.id,
          action: "created",
          newValue: JSON.stringify({
            orderType: order.orderType,
            total: order.total,
            paymentMethod: "edfapay_online",
            paidBeforeCreation: true,
          }),
          userName: "EdfaPay",
          restaurantId: order.restaurantId,
        });
      } catch (e) {}

      return order;
    } catch (e) {
      session.isCreating = false;
      throw e;
    }
  }

  // --- Payment Session (EdfaPay) ---
  app.post("/api/payments/create-session", async (req, res) => {
    try {
      const {
        orderData,
        items,
        callbackUrl,
        orderId: legacyOrderId,
      } = req.body;
      console.log(
        `[create-session] orderData=${!!orderData} items=${Array.isArray(items) ? items.length : "none"} callbackUrl=${!!callbackUrl} legacyOrderId=${legacyOrderId || "none"}`,
      );

      // NEW FLOW: orderData + items (no order created yet)
      if (orderData && items) {
        if (!callbackUrl) {
          console.log(`[create-session] ERROR: Missing callbackUrl`);
          return res.status(400).json({ error: "Missing callbackUrl" });
        }
        const rawRestaurantId = orderData.restaurantId;
        console.log(`[create-session] rawRestaurantId=${rawRestaurantId}`);
        if (!rawRestaurantId) {
          console.log(
            `[create-session] ERROR: Missing restaurantId in orderData:`,
            JSON.stringify(orderData).slice(0, 200),
          );
          return res.status(400).json({ error: "Missing restaurantId" });
        }

        // Resolve slug to UUID if needed
        const restaurantId = await storage.resolveRestaurantId(rawRestaurantId);
        if (!restaurantId) {
          console.log(
            `[create-session] ERROR: Restaurant not found: ${rawRestaurantId}`,
          );
          return res.status(400).json({ error: "Restaurant not found" });
        }
        console.log(`[create-session] Resolved restaurantId=${restaurantId}`);

        // Update orderData with resolved ID
        orderData.restaurantId = restaurantId;

        // Server-side price verification: recalculate totals from menu items
        let serverTotal = 0;
        const menuItemsRaw = await storage.getMenuItems(restaurantId);
        const menuItemsMap = new Map(menuItemsRaw.map((m) => [m.id, m]));
        console.log(
          `[create-session] Found ${menuItemsRaw.length} menu items for restaurant`,
        );

        for (const item of items) {
          const menuItem = menuItemsMap.get(item.menuItemId);
          if (!menuItem || !menuItem.isAvailable) {
            console.log(
              `[create-session] ERROR: Menu item not available: ${item.menuItemId}, found=${!!menuItem}, available=${menuItem?.isAvailable}`,
            );
            return res
              .status(400)
              .json({ error: `Menu item not available: ${item.menuItemId}` });
          }
          const verifiedPrice = parseFloat(menuItem.price);
          const qty = item.quantity || 1;
          serverTotal += verifiedPrice * qty;
        }

        // Apply discount
        const discount = parseFloat(orderData.discount || "0");
        const discountedSubtotal = Math.max(0, serverTotal - discount);

        // Get restaurant tax rate
        const restaurant = await storage.getRestaurantById(restaurantId);
        const isTaxEnabled = restaurant?.taxEnabled !== false;
        const taxRate = isTaxEnabled ? 15 : 0;
        const tax = discountedSubtotal * (taxRate / 100);
        const total = discountedSubtotal + tax;

        // Update orderData with server-verified totals
        orderData.subtotal = serverTotal.toFixed(2);
        orderData.tax = tax.toFixed(2);
        orderData.total = total.toFixed(2);

        // Update item prices from server
        for (const item of items) {
          const menuItem = menuItemsMap.get(item.menuItemId);
          if (menuItem) {
            item.unitPrice = parseFloat(menuItem.price).toFixed(2);
            item.totalPrice = (
              parseFloat(menuItem.price) * (item.quantity || 1)
            ).toFixed(2);
          }
        }

        if (total < 0.1) {
          console.log(
            `[create-session] ERROR: Total ${total} is below minimum 0.10`,
          );
          return res.status(400).json({
            error: "الحد الأدنى للدفع الإلكتروني 0.10 ريال",
            errorEn: "Minimum amount for online payment is 0.10 SAR",
            code: "MIN_AMOUNT",
          });
        }

        console.log(`[create-session] Total verified: ${total.toFixed(2)}`);

        const keys = await getRestaurantEdfapayKeys(restaurantId);
        if (!keys.merchantId || !keys.password) {
          console.log(
            `[create-session] ERROR: EdfaPay not configured for restaurant`,
          );
          return res
            .status(500)
            .json({ error: "بوابة الدفع غير مُعدة بعد", configured: false });
        }

        // Generate session ID
        const sessionId = crypto.randomUUID();

        // Fix callback URL to use server's sessionId (replace any existing UUID)
        // Frontend may have sent a placeholder sessionId in the URL
        const fixedCallbackUrl = callbackUrl.replace(
          /\/payment-callback\/[a-f0-9-]+/i,
          `/payment-callback/${sessionId}?session=true`,
        );
        console.log(
          `[create-session] sessionId=${sessionId}, callbackUrl fixed to: ${fixedCallbackUrl.slice(0, 100)}`,
        );

        // Store pending session
        pendingPaymentSessions.set(sessionId, {
          orderData: {
            ...orderData,
            paymentMethod: "edfapay_online",
          },
          items,
          restaurantId,
          branchId: orderData.branchId || null,
          createdAt: new Date(),
        });

        // Get client IP
        let clientIp =
          (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
          req.socket.remoteAddress ||
          "127.0.0.1";
        if (clientIp.startsWith("::ffff:"))
          clientIp = clientIp.replace("::ffff:", "");
        if (clientIp === "::1") clientIp = "127.0.0.1";

        // Build description with item names
        const itemDescriptions = items.map((item: any) => {
          const menuItem = menuItemsMap.get(item.menuItemId);
          const name = menuItem?.nameAr || menuItem?.nameEn || "Item";
          const qty = item.quantity || 1;
          return qty > 1 ? `${name} x${qty}` : name;
        });
        const itemsText = itemDescriptions.join(", ");
        const description = `${itemsText}`.substring(0, 1000);
        const amount = total.toFixed(2);

        const protocol =
          req.headers["x-forwarded-proto"] || req.protocol || "https";
        const host =
          req.headers["x-forwarded-host"] ||
          req.headers.host ||
          "tryingpos.com";
        const notificationUrl = `${protocol}://${host}/api/payments/webhook`;

        const customerName = orderData.customerName || "";
        const edfaResult = await edfapay.initiateSale({
          merchantId: keys.merchantId,
          password: keys.password,
          orderId: sessionId,
          amount,
          currency: "SAR",
          description,
          payerFirstName:
            customerName && !/^\d+$/.test(customerName.trim())
              ? customerName.split(" ")[0]
              : "Customer",
          payerLastName:
            customerName && !/^\d+$/.test(customerName.trim())
              ? customerName.split(" ").slice(1).join(" ") || "Guest"
              : "Guest",
          payerEmail: `order_${orderData.orderNumber || "0"}@tryingpos.com`,
          payerPhone: orderData.customerPhone || "0500000000",
          payerIp: clientIp,
          callbackUrl: fixedCallbackUrl,
          notificationUrl,
        });

        console.log(
          "[EdfaPay] initiateSale result (new flow):",
          JSON.stringify(edfaResult).slice(0, 500),
        );

        if (edfaResult.redirect_url) {
          res.json({
            action: "redirect",
            redirectUrl: edfaResult.redirect_url,
            sessionId,
          });
        } else if (edfaResult.result === "SUCCESS") {
          // Direct success (rare) - create order immediately
          const order = await createOrderFromPendingSession(sessionId, {
            transId: edfaResult.trans_id,
          });
          res.json({ action: "success", sessionId, orderId: order?.id });
        } else {
          // Clean up session on failure
          pendingPaymentSessions.delete(sessionId);
          res.status(400).json({
            error: "Payment initiation failed",
            details: edfaResult.error_message || edfaResult.status,
          });
        }
        return;
      }

      // LEGACY FLOW: orderId already exists (backward compat)
      const orderId = legacyOrderId || req.body.orderId;
      const legacyCallbackUrl = callbackUrl || req.body.callbackUrl;
      const { payerFirstName, payerLastName, payerEmail, payerPhone } =
        req.body;
      if (!orderId || !legacyCallbackUrl) {
        return res.status(400).json({
          error:
            "Missing required fields: orderId or orderData+items, callbackUrl",
        });
      }
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      const serverAmount = parseFloat(order.total || "0");
      if (serverAmount <= 0) {
        return res.status(400).json({ error: "Invalid order total" });
      }
      if (serverAmount < 0.1) {
        return res.status(400).json({
          error: "الحد الأدنى للدفع الإلكتروني 0.10 ريال",
          errorEn: "Minimum amount for online payment is 0.10 SAR",
          code: "MIN_AMOUNT",
        });
      }
      if (order.isPaid) {
        return res.status(400).json({ error: "Order is already paid" });
      }
      const keys = await getRestaurantEdfapayKeys(order.restaurantId);
      if (!keys.merchantId || !keys.password) {
        return res
          .status(500)
          .json({ error: "بوابة الدفع غير مُعدة بعد", configured: false });
      }

      let clientIp =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        req.socket.remoteAddress ||
        "127.0.0.1";
      if (clientIp.startsWith("::ffff:"))
        clientIp = clientIp.replace("::ffff:", "");
      if (clientIp === "::1") clientIp = "127.0.0.1";

      const description = `Order ${order.orderNumber || orderId}`;
      const amount = serverAmount.toFixed(2);

      const protocol =
        req.headers["x-forwarded-proto"] || req.protocol || "https";
      const host =
        req.headers["x-forwarded-host"] || req.headers.host || "tryingpos.com";
      const notificationUrl = `${protocol}://${host}/api/payments/webhook`;

      const edfaResult = await edfapay.initiateSale({
        merchantId: keys.merchantId,
        password: keys.password,
        orderId: orderId,
        amount,
        currency: "SAR",
        description,
        payerFirstName:
          payerFirstName ||
          (order.customerName && !/^\d+$/.test(order.customerName.trim())
            ? order.customerName.split(" ")[0]
            : "Customer"),
        payerLastName:
          payerLastName ||
          (order.customerName && !/^\d+$/.test(order.customerName.trim())
            ? order.customerName.split(" ").slice(1).join(" ") || "Guest"
            : "Guest"),
        payerEmail:
          payerEmail || `order_${order.orderNumber || "0"}@tryingpos.com`,
        payerPhone: payerPhone || order.customerPhone || "0500000000",
        payerIp: clientIp,
        callbackUrl: legacyCallbackUrl,
        notificationUrl,
      });

      console.log(
        "[EdfaPay] initiateSale result (legacy):",
        JSON.stringify(edfaResult).slice(0, 500),
      );

      if (edfaResult.redirect_url) {
        res.json({
          action: "redirect",
          redirectUrl: edfaResult.redirect_url,
          redirectMethod: edfaResult.redirect_method || "GET",
          redirectParams: edfaResult.redirect_params || {},
          transId: edfaResult.trans_id,
          orderId,
        });
      } else if (edfaResult.result === "SUCCESS") {
        res.json({
          action: "success",
          transId: edfaResult.trans_id,
          status: edfaResult.status,
          orderId,
        });
      } else {
        res.status(400).json({
          error: "Payment initiation failed",
          details: edfaResult.error_message || edfaResult.status,
        });
      }
    } catch (error: any) {
      console.error("Payment session error:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to create payment session" });
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
        return res
          .status(500)
          .json({ error: "EdfaPay credentials not configured" });
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
      const { orderId, sessionId, transId, gwayId } = req.body;
      console.log(
        `[Payment Complete] orderId=${orderId || "none"} sessionId=${sessionId || "none"} transId=${transId || "none"} gwayId=${gwayId || "none"}`,
      );

      // NEW FLOW: sessionId (no order exists yet, create after verification)
      if (sessionId) {
        // Check if order was already created from this session (by webhook)
        const existingOrderId = sessionToOrderMap.get(sessionId);
        if (existingOrderId) {
          const existingOrder = await storage.getOrder(existingOrderId);
          if (existingOrder) {
            console.log(
              `[Payment Complete] Session ${sessionId} already has order ${existingOrderId}`,
            );
            return res.json(existingOrder);
          }
        }

        // Get pending session to find restaurantId for verification
        const session = pendingPaymentSessions.get(sessionId);
        if (!session && !existingOrderId) {
          return res
            .status(404)
            .json({ error: "Payment session not found or expired" });
        }

        const restaurantId = session?.restaurantId || "";

        // Try to verify payment via EdfaPay status API
        let paymentVerified = false;
        let paymentStatus = "unknown";

        if (gwayId && restaurantId) {
          const keys = await getRestaurantEdfapayKeys(restaurantId);
          if (keys.merchantId && keys.password) {
            try {
              const statusResult = await edfapay.getTransactionStatus({
                merchantId: keys.merchantId,
                password: keys.password,
                gwayPaymentId: gwayId,
                orderId: sessionId,
              });
              console.log(
                `[Payment Complete] EdfaPay status: ${JSON.stringify(statusResult).slice(0, 300)}`,
              );
              paymentStatus = statusResult.status;
              paymentVerified = edfapay.isSuccessfulPayment(
                statusResult.status,
              );
            } catch (e) {
              console.error("EdfaPay status check error:", e);
            }
          }
        }

        // If not verified via API, wait for webhook
        if (!paymentVerified) {
          console.log(
            `[Payment Complete] Waiting 3s for webhook (session ${sessionId})...`,
          );
          await new Promise((resolve) => setTimeout(resolve, 3000));
          // Re-check if webhook created the order during our wait
          const newOrderId = sessionToOrderMap.get(sessionId);
          if (newOrderId) {
            const newOrder = await storage.getOrder(newOrderId);
            if (newOrder) {
              console.log(
                `[Payment Complete] Webhook created order ${newOrderId} during wait`,
              );
              return res.json(newOrder);
            }
          }
          // Check session's createdOrderId
          const updatedSession = pendingPaymentSessions.get(sessionId);
          if (updatedSession?.createdOrderId) {
            const createdOrder = await storage.getOrder(
              updatedSession.createdOrderId,
            );
            if (createdOrder) return res.json(createdOrder);
          }
        }

        if (paymentVerified && session) {
          // Payment confirmed - create the order now
          console.log(
            `[Payment Complete] Payment verified for session ${sessionId}, creating order...`,
          );
          const order = await createOrderFromPendingSession(sessionId, {
            transId,
            gwayId,
          });
          if (order) {
            return res.json(order);
          } else {
            return res
              .status(500)
              .json({ error: "Failed to create order after payment" });
          }
        }

        return res
          .status(400)
          .json({ error: `Payment not verified. Status: ${paymentStatus}` });
      }

      // LEGACY FLOW: orderId (order already exists)
      if (!orderId) {
        return res.status(400).json({ error: "Missing orderId or sessionId" });
      }
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ error: "Order not found" });
      }
      // Idempotency check
      if (order.isPaid) {
        return res.json(order);
      }

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

      if (!paymentVerified) {
        const transactions = await storage.getPaymentTransactions(
          order.restaurantId,
          orderId,
        );
        const successTx = transactions.find(
          (t) => t.type === "payment" && t.status === "paid",
        );
        if (successTx) {
          paymentVerified = true;
        }
      }

      if (!paymentVerified && !gwayId) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        const transactions2 = await storage.getPaymentTransactions(
          order.restaurantId,
          orderId,
        );
        const successTx2 = transactions2.find(
          (t) => t.type === "payment" && t.status === "paid",
        );
        if (successTx2) paymentVerified = true;
        if (!paymentVerified) {
          const refreshedOrder = await storage.getOrder(orderId);
          if (refreshedOrder?.isPaid) return res.json(refreshedOrder);
        }
      }

      if (paymentVerified) {
        const wasPaymentPending = order.status === "payment_pending";
        const wasReady = order.status === "ready";
        const newStatus = wasPaymentPending ? "pending" : wasReady ? "completed" : order.status;
        await storage.updateOrder(orderId, {
          isPaid: true,
          paymentMethod: "edfapay_online",
          status: newStatus,
        });

        // Free the table if the customer paid electronically from the table QR
        if (wasReady && order.tableId) {
          try {
            await storage.updateTableStatus(order.tableId, "available");
            wsManager.notifyDataChanged(order.restaurantId, "tables", "updated");
            wsManager.notifyDataChanged(order.restaurantId, "orders", "updated");
          } catch (e) {
            console.error("Table status update after electronic payment error:", e);
          }
        }

        if (wasPaymentPending) {
          try {
            const updatedOrder = await storage.getOrder(orderId);
            if (updatedOrder)
              wsManager.notifyNewOrder(
                updatedOrder.restaurantId,
                updatedOrder.branchId || "",
                updatedOrder,
              );
          } catch (e) {
            console.error("WS notification error:", e);
          }
        }

        await storage.createPaymentTransaction({
          restaurantId: order.restaurantId,
          orderId,
          edfapayTransactionId: transId || null,
          edfapayGwayId: gwayId || null,
          type: "payment",
          status: "paid",
          amount: Math.round(parseFloat(order.total || "0") * 100),
          currency: "SAR",
          paymentMethod: "edfapay_online",
        });

        const updatedOrder = await storage.getOrder(orderId);
        res.json(updatedOrder);
      } else {
        res
          .status(400)
          .json({ error: `Payment not verified. Status: ${paymentStatus}` });
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
      const transactions = await storage.getPaymentTransactions(
        await getRestaurantId(req),
        orderId,
      );
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
        return res
          .status(500)
          .json({ error: "EdfaPay credentials not configured" });
      }

      // Find the original payment transaction
      const existingPayments = await storage.getPaymentTransactions(
        order.restaurantId,
        orderId,
      );
      const originalPayment = existingPayments.find(
        (t) => t.type === "payment" && t.status === "paid",
      );
      if (!originalPayment) {
        return res.status(404).json({ error: "Original payment not found" });
      }

      const refundTransId = transId || originalPayment.edfapayTransactionId;
      const refundGwayId = gwayId || originalPayment.edfapayGwayId;

      if (!refundTransId || !refundGwayId) {
        return res
          .status(400)
          .json({ error: "Missing transaction IDs for refund" });
      }

      const totalRefunded = existingPayments
        .filter((t) => t.type === "refund")
        .reduce((sum, t) => sum + (t.refundedAmount || 0), 0);

      const refundAmount = amount
        ? parseFloat(amount).toFixed(2)
        : (originalPayment.amount / 100).toFixed(2);

      const refundAmountHalalas = Math.round(parseFloat(refundAmount) * 100);
      if (refundAmountHalalas + totalRefunded > originalPayment.amount) {
        return res.status(400).json({
          error: "Refund amount exceeds remaining refundable balance",
        });
      }

      const clientIp =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        req.socket.remoteAddress ||
        "127.0.0.1";

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

        const isFullRefund =
          refundAmountHalalas + totalRefunded >= originalPayment.amount;
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
        res.status(400).json({
          error: "Refund failed",
          details: refundResult.error_message,
        });
      }
    } catch (error: any) {
      console.error("Refund error:", error);
      res
        .status(500)
        .json({ error: error.message || "Failed to process refund" });
    }
  });

  // --- EdfaPay 3DS POST redirect handler ---
  // EdfaPay redirects the user back via POST (from 3DS form) to the term_url_3ds.
  // Since our frontend is an SPA and can't read POST body, we extract the params
  // and redirect the user via GET with query params so the SPA can read them.
  app.post("/payment-callback/:sessionOrOrderId", (req, res) => {
    const { sessionOrOrderId } = req.params;
    const transId = req.body?.trans_id || req.body?.order_id || "";
    const status = req.body?.status || "";
    const result = req.body?.result || "";
    const gwayId = req.body?.gway_id || req.body?.trans_id || "";
    const params = new URLSearchParams();
    if (transId) params.set("trans_id", transId);
    if (gwayId && gwayId !== transId) params.set("gway_id", gwayId);
    if (status) params.set("status", status);
    if (result) params.set("result", result);
    // Mark as session if it's a pending payment session
    if (
      pendingPaymentSessions.has(sessionOrOrderId) ||
      sessionToOrderMap.has(sessionOrOrderId)
    ) {
      params.set("session", "true");
    }
    const qs = params.toString();
    console.log(
      `[EdfaPay 3DS] POST redirect for ${sessionOrOrderId}: body keys=${Object.keys(req.body || {}).join(",")} trans_id=${transId} gway_id=${gwayId} status=${status} result=${result}`,
    );
    res.redirect(`/payment-callback/${sessionOrOrderId}${qs ? "?" + qs : ""}`);
  });

  // --- Payment Webhooks (EdfaPay sends callback notifications here) ---
  app.post("/api/payments/webhook", async (req, res) => {
    try {
      const payload = req.body;

      if (!payload || typeof payload !== "object") {
        console.warn("Webhook: invalid payload received");
        return res.status(400).send("ERROR");
      }

      const action = payload.action;
      const result = payload.result;
      const status = payload.status;
      const orderId = payload.order_id; // This could be a sessionId (new flow) or actual orderId (legacy)
      const transId = payload.trans_id;

      console.log(
        `EdfaPay Webhook: action=${action} result=${result} status=${status} order=${orderId} trans=${transId}`,
      );

      if (!orderId || !transId) {
        return res.status(200).send("OK");
      }

      // NEW FLOW: Check if orderId is actually a pending payment session
      const pendingSession = pendingPaymentSessions.get(orderId);
      if (pendingSession) {
        console.log(`[Webhook] Found pending session for ${orderId}`);

        // Verify hash if possible
        if (payload.hash) {
          const keys = await getRestaurantEdfapayKeys(
            pendingSession.restaurantId,
          );
          if (keys.password) {
            const isValid = edfapay.verifyCallbackHash(
              payload as any,
              keys.password,
            );
            if (!isValid) {
              console.warn(
                `Webhook: hash verification FAILED for session ${orderId}`,
              );
            } else {
              console.log(`Webhook: hash verified OK for session ${orderId}`);
            }
          }
        }

        if (
          action === "SALE" &&
          result === "SUCCESS" &&
          edfapay.isSuccessfulPayment(status)
        ) {
          // Payment successful - create the order now
          console.log(
            `[Webhook] Payment successful for session ${orderId}, creating order...`,
          );
          try {
            const order = await createOrderFromPendingSession(orderId, {
              transId,
              gwayId: payload.gway_id || null,
              webhookPayload: payload,
            });
            if (order) {
              console.log(
                `[Webhook] Order ${order.id} created from session ${orderId}`,
              );
            }
          } catch (e) {
            console.error(
              `[Webhook] Failed to create order from session ${orderId}:`,
              e,
            );
          }
        } else if (action === "SALE" && result === "DECLINED") {
          console.log(`[Webhook] Payment declined for session ${orderId}`);
          // Clean up the session
          pendingPaymentSessions.delete(orderId);
        }

        return res.status(200).send("OK");
      }

      // RESERVATION FLOW: Check if orderId is a reservation ID
      const reservation = await storage.getReservation(orderId);
      if (reservation) {
        console.log(`[Webhook] Found reservation ${orderId}`);

        if (
          action === "SALE" &&
          result === "SUCCESS" &&
          edfapay.isSuccessfulPayment(status)
        ) {
          // Payment successful - mark reservation as deposit paid and generate code
          console.log(
            `[Webhook] Payment successful for reservation ${orderId}, marking deposit paid...`,
          );
          try {
            const depositCode =
              reservation.depositCode || generateDepositCode();
            await storage.updateReservation(orderId, {
              depositPaid: true,
              depositCode,
            } as any);
            console.log(
              `[Webhook] Reservation ${orderId} deposit marked as paid, code: ${depositCode}`,
            );
          } catch (e) {
            console.error(
              `[Webhook] Failed to update reservation ${orderId}:`,
              e,
            );
          }
        } else if (action === "SALE" && result === "DECLINED") {
          console.log(`[Webhook] Payment declined for reservation ${orderId}`);
        }

        return res.status(200).send("OK");
      }

      // LEGACY FLOW: orderId is an actual order
      const order = await storage.getOrder(orderId);
      if (!order) {
        console.warn(`Webhook: order/session ${orderId} not found`);
        return res.status(200).send("OK");
      }

      if (payload.hash) {
        const keys = await getRestaurantEdfapayKeys(order.restaurantId);
        if (keys.password) {
          const isValid = edfapay.verifyCallbackHash(
            payload as any,
            keys.password,
          );
          if (!isValid) {
            console.warn(
              `Webhook: hash verification FAILED for order ${orderId} trans ${transId}`,
            );
          } else {
            console.log(`Webhook: hash verified OK for order ${orderId}`);
          }
        }
      }

      if (
        action === "SALE" &&
        result === "SUCCESS" &&
        edfapay.isSuccessfulPayment(status)
      ) {
        if (!order.isPaid) {
          const newStatus =
            order.status === "payment_pending" ? "pending" : order.status;
          await storage.updateOrder(orderId, {
            isPaid: true,
            paymentMethod: "edfapay_online",
            status: newStatus,
          });
          if (order.status === "payment_pending") {
            try {
              const updatedOrder = await storage.getOrder(orderId);
              if (updatedOrder)
                wsManager.notifyNewOrder(
                  updatedOrder.restaurantId,
                  updatedOrder.branchId || "",
                  updatedOrder,
                );
            } catch (e) {
              console.error("WS notification error:", e);
            }
          }
        }

        const existingTx = await storage.getPaymentTransactions(
          order.restaurantId,
          orderId,
        );
        const hasPaidTx = existingTx.some(
          (t) => t.type === "payment" && t.status === "paid",
        );
        if (!hasPaidTx) {
          await storage.createPaymentTransaction({
            restaurantId: order.restaurantId,
            orderId,
            edfapayTransactionId: transId,
            edfapayGwayId: payload.gway_id || null,
            type: "payment",
            status: "paid",
            amount: Math.round(
              parseFloat(payload.amount || order.total || "0") * 100,
            ),
            currency: payload.currency || "SAR",
            paymentMethod: "edfapay_online",
            webhookReceived: true,
          });
        }
      } else if (action === "SALE" && result === "DECLINED") {
        await storage.createPaymentTransaction({
          restaurantId: order.restaurantId,
          orderId,
          edfapayTransactionId: transId,
          type: "payment",
          status: "failed",
          amount: Math.round(
            parseFloat(payload.amount || order.total || "0") * 100,
          ),
          currency: payload.currency || "SAR",
          webhookReceived: true,
          metadata: { decline_reason: payload.decline_reason },
        });
      } else if (action === "REFUND" && result === "SUCCESS") {
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
        {
          brand: "Mastercard",
          number: "5123450000000008",
          expiry: "01/39",
          cvc: "100",
          result: "Successful",
          note: "EdfaPay official sandbox card",
        },
        {
          brand: "Visa",
          number: "4111111111111111",
          expiry: "01/39",
          cvc: "100",
          result: "Successful",
        },
        {
          brand: "Visa",
          number: "4000000000000002",
          expiry: "01/39",
          cvc: "100",
          result: "Declined",
        },
        {
          brand: "Mastercard",
          number: "5111111111111118",
          expiry: "01/39",
          cvc: "100",
          result: "Successful",
        },
        {
          brand: "Mastercard",
          number: "5200000000000007",
          expiry: "01/39",
          cvc: "100",
          result: "Declined",
        },
        {
          brand: "Mada",
          number: "5043000000000003",
          expiry: "01/39",
          cvc: "100",
          result: "Successful",
        },
        {
          brand: "Mada",
          number: "5043000000000011",
          expiry: "01/39",
          cvc: "100",
          result: "Declined",
        },
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
      const { orderId, recurringToken, amount, description, payerEmail } =
        req.body;
      if (!orderId || !recurringToken) {
        return res
          .status(400)
          .json({ error: "Missing required fields: orderId, recurringToken" });
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
        return res
          .status(500)
          .json({ error: "EdfaPay credentials not configured" });
      }

      const clientIp =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        req.socket.remoteAddress ||
        "127.0.0.1";

      const serverAmount = amount
        ? parseFloat(amount).toFixed(2)
        : parseFloat(order.total || "0").toFixed(2);
      const protocol =
        req.headers["x-forwarded-proto"] || req.protocol || "https";
      const host =
        req.headers["x-forwarded-host"] || req.headers.host || "tryingpos.com";
      const notificationUrl = `${protocol}://${host}/api/payments/webhook`;

      const recurringResult = await edfapay.recurringPayment({
        merchantId: keys.merchantId,
        password: keys.password,
        recurringToken,
        orderId,
        amount: serverAmount,
        currency: "SAR",
        description:
          description ||
          `Recurring payment for order ${order.orderNumber || orderId}`,
        payerEmail: payerEmail || "customer@example.com",
        payerIp: clientIp,
        notificationUrl,
      });

      if (
        recurringResult.result === "SUCCESS" ||
        edfapay.isSuccessfulPayment(recurringResult.status)
      ) {
        await storage.updateOrder(orderId, {
          isPaid: true,
          paymentMethod: "edfapay_online",
        });
        await storage.createPaymentTransaction({
          restaurantId: callerRestaurantId,
          orderId,
          edfapayTransactionId: recurringResult.trans_id,
          type: "payment",
          status: "paid",
          amount: Math.round(parseFloat(serverAmount) * 100),
          currency: "SAR",
          paymentMethod: "edfapay_online",
          metadata: { recurring: true, recurringToken } as any,
        });
        res.json({
          success: true,
          transId: recurringResult.trans_id,
          status: recurringResult.status,
        });
      } else if (
        recurringResult.result === "REDIRECT" &&
        recurringResult.redirect_url
      ) {
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
      res.status(500).json({
        error: error.message || "Failed to process recurring payment",
      });
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
        return res
          .status(400)
          .json({ error: "Invalid validation URL — must be apple.com" });
      }

      const session = await edfapay.validateApplePaySession(validationURL);
      res.json(session);
    } catch (error: any) {
      console.error("Apple Pay session validation error:", error);
      res.status(500).json({
        error: error.message || "Failed to validate Apple Pay session",
      });
    }
  });

  // --- Apple Pay S2S Sale — process Apple Pay token ---
  app.post("/api/payments/apple-pay-sale", async (req, res) => {
    try {
      const {
        orderId,
        callbackUrl,
        applePayToken,
        payerFirstName,
        payerLastName,
        payerEmail,
        payerPhone,
      } = req.body;
      if (!orderId || !callbackUrl || !applePayToken) {
        return res.status(400).json({
          error: "Missing required fields: orderId, callbackUrl, applePayToken",
        });
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
        return res
          .status(500)
          .json({ error: "بوابة الدفع غير مُعدة بعد", configured: false });
      }

      const clientIp =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        req.socket.remoteAddress ||
        "127.0.0.1";

      const description = `Order ${order.orderNumber || orderId}`;
      const amount = serverAmount.toFixed(2);

      const protocol =
        req.headers["x-forwarded-proto"] || req.protocol || "https";
      const host =
        req.headers["x-forwarded-host"] || req.headers.host || "tryingpos.com";
      const notificationUrl = `${protocol}://${host}/api/payments/webhook`;

      // Stringify the Apple Pay token if it's an object
      const tokenString =
        typeof applePayToken === "string"
          ? applePayToken
          : JSON.stringify(applePayToken);

      const edfaResult = await edfapay.applePaySale({
        merchantId: keys.merchantId,
        password: keys.password,
        orderId,
        amount,
        currency: "SAR",
        description,
        payerFirstName:
          payerFirstName || order.customerName?.split(" ")[0] || "Customer",
        payerLastName:
          payerLastName ||
          order.customerName?.split(" ").slice(1).join(" ") ||
          "Guest",
        payerEmail: payerEmail || "customer@example.com",
        payerPhone: payerPhone || order.customerPhone || "0500000000",
        payerIp: clientIp,
        callbackUrl,
        notificationUrl,
        applePayToken: tokenString,
      });

      if (
        edfaResult.result === "SUCCESS" ||
        edfapay.isSuccessfulPayment(edfaResult.status)
      ) {
        // Direct success — mark order as paid
        await storage.updateOrder(orderId, {
          isPaid: true,
          paymentMethod: "apple_pay",
        });
        await storage.createPaymentTransaction({
          restaurantId: order.restaurantId,
          orderId,
          edfapayTransactionId: edfaResult.trans_id,
          type: "payment",
          status: "paid",
          amount: Math.round(serverAmount * 100),
          currency: "SAR",
          paymentMethod: "apple_pay",
          metadata: { source: "apple_pay_s2s" } as any,
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
      res.status(500).json({
        error: error.message || "Failed to process Apple Pay payment",
      });
    }
  });

  // --- Apple Pay Domain Verification ---
  // Apple checks /.well-known/apple-developer-merchantid-domain-association
  // The file content is provided by Apple and stored in env var
  app.get(
    "/.well-known/apple-developer-merchantid-domain-association",
    (_req, res) => {
      const verificationContent = process.env.APPLE_PAY_DOMAIN_VERIFICATION;
      if (!verificationContent) {
        return res.status(404).send("Not configured");
      }
      res.set("Content-Type", "text/plain");
      res.send(verificationContent);
    },
  );

  app.get("/api/export/orders", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const branchId = req.query.branchId as string | undefined;
      const startDate = req.query.startDate as string | undefined;
      const endDate = req.query.endDate as string | undefined;
      const orders = await storage.getOrders(restaurantId, branchId);

      let filtered = orders;
      if (startDate) {
        filtered = filtered.filter(
          (o) => new Date(o.createdAt!) >= new Date(startDate),
        );
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filtered = filtered.filter((o) => new Date(o.createdAt!) <= end);
      }

      const header =
        "Order Number,Date,Type,Status,Payment Method,Paid,Customer Name,Customer Phone,Subtotal,Discount,Tax,Delivery Fee,Total,Notes\n";
      const rows = filtered
        .map((o) => {
          const date = o.createdAt
            ? new Date(o.createdAt).toISOString().split("T")[0]
            : "";
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
        })
        .join("\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=orders_${new Date().toISOString().split("T")[0]}.csv`,
      );
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

      const header =
        "Name,Category,Current Stock,Min Stock,Unit,Cost,Supplier\n";
      const rows = items
        .map((i) =>
          [
            csvQuote(i.name),
            csvQuote(i.category),
            i.currentStock || "0",
            i.minStock || "0",
            csvSafe(i.unit),
            i.costPerUnit || "0",
            `""`,
          ].join(","),
        )
        .join("\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=inventory_${new Date().toISOString().split("T")[0]}.csv`,
      );
      res.send("\uFEFF" + header + rows);
    } catch (error) {
      res.status(500).json({ error: "Failed to export inventory" });
    }
  });

  app.get("/api/export/customers", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const customers = await storage.getCustomers(restaurantId);

      const header =
        "Name,Phone,Email,Address,Total Orders,Total Spent,Notes\n";
      const rows = customers
        .map((c) =>
          [
            csvQuote(c.name),
            csvSafe(c.phone),
            csvSafe(c.email),
            csvQuote(c.address),
            c.totalOrders || "0",
            c.totalSpent || "0",
            csvQuote(c.notes),
          ].join(","),
        )
        .join("\n");

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=customers_${new Date().toISOString().split("T")[0]}.csv`,
      );
      res.send("\uFEFF" + header + rows);
    } catch (error) {
      res.status(500).json({ error: "Failed to export customers" });
    }
  });

  // =====================================================
  // ZATCA E-Invoicing Routes
  // =====================================================

  // Helper: resolve ZATCA credentials — device first → branch → restaurant
  async function getZatcaCredentials(
    restaurant: any,
    branchId?: string | null,
    egsDeviceId?: string | null,
  ) {
    // 1. Check specific device
    if (egsDeviceId) {
      const device = await storage.getZatcaDevice(egsDeviceId);
      if (
        device &&
        (device.zatcaProductionCsid || device.zatcaComplianceCsid)
      ) {
        return {
          environment:
            device.zatcaEnvironment || restaurant.zatcaEnvironment || "sandbox",
          certificate: device.zatcaProductionCsid || device.zatcaComplianceCsid,
          secret: device.zatcaSecretKey,
          deviceId: device.zatcaRequestId,
          complianceCsid: device.zatcaComplianceCsid,
          productionCsid: device.zatcaProductionCsid,
          certificateExpiry: device.zatcaCertificateExpiry,
          privateKey: device.zatcaPrivateKey,
          invoiceCounter: device.zatcaInvoiceCounter || 0,
          lastInvoiceHash: device.zatcaLastInvoiceHash,
          source: "device" as const,
          egsDeviceId: device.id,
          branchId: device.branchId,
          branchName: device.name,
        };
      }
    }
    // 2. Check active device for branch
    if (branchId) {
      const device = await storage.getActiveZatcaDevice(branchId);
      if (
        device &&
        (device.zatcaProductionCsid || device.zatcaComplianceCsid)
      ) {
        return {
          environment:
            device.zatcaEnvironment || restaurant.zatcaEnvironment || "sandbox",
          certificate: device.zatcaProductionCsid || device.zatcaComplianceCsid,
          secret: device.zatcaSecretKey,
          deviceId: device.zatcaRequestId,
          complianceCsid: device.zatcaComplianceCsid,
          productionCsid: device.zatcaProductionCsid,
          certificateExpiry: device.zatcaCertificateExpiry,
          privateKey: device.zatcaPrivateKey,
          invoiceCounter: device.zatcaInvoiceCounter || 0,
          lastInvoiceHash: device.zatcaLastInvoiceHash,
          source: "device" as const,
          egsDeviceId: device.id,
          branchId: device.branchId,
          branchName: device.name,
        };
      }
      // 3. Legacy: Check branch-level credentials
      const branch = await storage.getBranch(branchId);
      if (branch && (branch as any).zatcaProductionCsid) {
        return {
          environment:
            (branch as any).zatcaEnvironment ||
            restaurant.zatcaEnvironment ||
            "sandbox",
          certificate:
            (branch as any).zatcaProductionCsid ||
            (branch as any).zatcaComplianceCsid,
          secret: (branch as any).zatcaSecretKey,
          deviceId: (branch as any).zatcaDeviceId,
          complianceCsid: (branch as any).zatcaComplianceCsid,
          productionCsid: (branch as any).zatcaProductionCsid,
          certificateExpiry: (branch as any).zatcaCertificateExpiry,
          privateKey: (branch as any).zatcaPrivateKey,
          invoiceCounter: (branch as any).zatcaInvoiceCounter || 0,
          lastInvoiceHash: (branch as any).zatcaLastInvoiceHash,
          source: "branch" as const,
          egsDeviceId: null,
          branchId,
          branchName: branch.name,
        };
      }
    }
    // 4. Fall back to restaurant-level
    return {
      environment: restaurant.zatcaEnvironment || "sandbox",
      certificate:
        restaurant.zatcaProductionCsid || restaurant.zatcaComplianceCsid,
      secret: restaurant.zatcaSecretKey,
      deviceId: restaurant.zatcaDeviceId,
      complianceCsid: restaurant.zatcaComplianceCsid,
      productionCsid: restaurant.zatcaProductionCsid,
      certificateExpiry: restaurant.zatcaCertificateExpiry,
      privateKey: (restaurant as any).zatcaPrivateKey,
      invoiceCounter: restaurant.zatcaInvoiceCounter || 0,
      lastInvoiceHash: restaurant.zatcaLastInvoiceHash,
      source: "restaurant" as const,
      egsDeviceId: null,
      branchId: null,
      branchName: null,
    };
  }

  // Get ZATCA configuration status (supports ?branchId=xxx)
  app.get("/api/zatca/status", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const restaurant = await storage.getRestaurantById(restaurantId);
      if (!restaurant)
        return res.status(404).json({ error: "Restaurant not found" });

      const branchId = (req.query.branchId as string) || null;
      const creds = await getZatcaCredentials(restaurant, branchId);

      // Get all branches status + devices per branch
      const allBranches = await storage.getBranches(restaurantId);
      const branchStatuses = await Promise.all(
        allBranches.map(async (b: any) => {
          const devices = await storage.getZatcaDevices(b.id);
          return {
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
            devices: devices.map((d: any) => ({
              id: d.id,
              name: d.name,
              nameAr: d.nameAr,
              serialNumber: d.serialNumber,
              isActive: d.isActive,
              registrationStep: d.registrationStep || 0,
              hasComplianceCsid: !!d.zatcaComplianceCsid,
              hasProductionCsid: !!d.zatcaProductionCsid,
              certificateExpiry: d.zatcaCertificateExpiry,
              invoiceCounter: d.zatcaInvoiceCounter || 0,
              environment: d.zatcaEnvironment,
            })),
          };
        }),
      );

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
        taxRate: restaurant.taxRate || "15",
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
      if (!restaurant)
        return res.status(404).json({ error: "Restaurant not found" });

      const { branchId } = req.body;
      const branch = branchId ? await storage.getBranch(branchId) : null;
      const branchName = branch
        ? branch.nameAr || branch.name || "Main"
        : restaurant.nameAr || restaurant.nameEn || "Main";
      const egsSerial = `EGS1-${(restaurant.vatNumber || "000000000000000").replace(/\D/g, "").slice(0, 15)}-${String(branchId ? "00002" : "00001")}`;

      const result = await generateZatcaCsr({
        commonName: crypto.randomUUID().replace(/-/g, "").substring(0, 16),
        organizationIdentifier: restaurant.vatNumber || "",
        organizationUnit: branchName,
        organizationName:
          restaurant.nameAr || restaurant.nameEn || "Restaurant",
        countryCode: "SA",
        invoiceType: "1100",
        location: restaurant.city || "Riyadh",
        industry: "Food",
      });

      // Store private key
      const keyData: Record<string, any> = {
        zatcaPrivateKey: result.privateKey,
      };
      if (branchId) {
        await storage.updateBranch(branchId, keyData as any);
      }
      await storage.updateRestaurantById(restaurantId, keyData as any);

      res.json({
        csr: result.csr,
        message: "CSR generated and private key stored securely",
      });
    } catch (error: any) {
      console.error("CSR generation error:", error?.message);
      res
        .status(500)
        .json({ error: error?.message || "Failed to generate CSR" });
    }
  });

  // Register device - Step 1: Get Compliance CSID (supports branchId + egsDeviceId in body)
  // Now auto-generates CSR if not provided, and stores the private key
  app.post("/api/zatca/compliance-csid", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const restaurant = await storage.getRestaurantById(restaurantId);
      if (!restaurant)
        return res.status(404).json({ error: "Restaurant not found" });

      const { otp, branchId, egsDeviceId } = req.body;
      let privateKey: string | undefined;
      let csr: string;
      if (!otp) return res.status(400).json({ error: "OTP is required" });

      // Validate VAT number before proceeding
      const vatNumber = restaurant.vatNumber?.replace(/\D/g, "") || "";
      if (!vatNumber || vatNumber.length !== 15) {
        return res.status(400).json({
          error:
            "VAT number is required and must be 15 digits. Please update your restaurant settings first.",
          errorAr:
            "الرقم الضريبي مطلوب ويجب أن يكون 15 رقم. يرجى تحديث إعدادات المطعم أولاً.",
        });
      }
      if (!vatNumber.startsWith("3") || !vatNumber.endsWith("3")) {
        return res.status(400).json({
          error:
            "Invalid VAT number format. Saudi VAT numbers must start and end with 3.",
          errorAr:
            "صيغة الرقم الضريبي غير صحيحة. الأرقام الضريبية السعودية يجب أن تبدأ وتنتهي بـ 3.",
        });
      }

      // Always auto-generate CSR for reliability
      const branch = branchId ? await storage.getBranch(branchId) : null;
      const branchName = branch
        ? branch.nameAr || branch.name || "Main"
        : restaurant.nameAr || restaurant.nameEn || "Main";

      // Generate unique EGS serial per device
      let deviceSeqNum = "00001";
      if (branchId) {
        const existingDevices = await storage.getZatcaDevices(branchId);
        deviceSeqNum = String(existingDevices.length + 1).padStart(5, "0");
      }
      const egsSerial = `EGS1-${vatNumber}-${deviceSeqNum}`;

      // Use environment from request OR from restaurant (restaurant is fetched fresh at start of request)
      const environment = restaurant.zatcaEnvironment || "sandbox";
      console.log("[ZATCA] Using environment:", environment);

      // Use optima_zatca field mapping:
      // OU = commercial registration name (اسم السجل التجاري)
      // O = company name in Arabic
      // CN = random hash (to match optima pattern)
      // registeredAddress = short address (العنوان المختصر)
      // businessCategory = industry type
      const orgUnit =
        (restaurant as any).commercialRegistrationName || branchName;
      const orgName = restaurant.nameAr || restaurant.nameEn || "Restaurant";
      const shortAddr =
        (restaurant as any).shortAddress || restaurant.city || "Riyadh";
      const industryType = (restaurant as any).industry || "Food";
      const invoiceType = (restaurant as any).invoiceType || "1100";
      const registrationType = (restaurant as any).registrationType || "CRN";

      const csrResult = await generateZatcaCsr({
        commonName: crypto.randomUUID().replace(/-/g, "").substring(0, 16),
        organizationIdentifier: vatNumber,
        organizationUnit: orgUnit,
        organizationName: orgName,
        countryCode: "SA",
        invoiceType: invoiceType,
        location: shortAddr,
        industry: industryType,
        environment: environment,
      });
      csr = csrResult.csr;
      privateKey = csrResult.privateKey;

      console.log(
        "[ZATCA] CSR generated, length:",
        csr.length,
        "Environment:",
        environment,
      );
      console.log("[ZATCA] VAT:", vatNumber, "EGS:", egsSerial);

      const baseUrl = getZatcaBaseUrl(environment);

      // Only sandbox uses fixed OTP 123456; simulation & production need real OTP from ZATCA portal
      const effectiveOtp = environment === "sandbox" ? "123456" : otp;

      const result = isMockEnvironment(environment)
        ? mockGetComplianceCsid()
        : await getComplianceCsid(baseUrl, effectiveOtp, csr);

      // Log FULL ZATCA response to debug saving issue
      console.log("[ZATCA] Full compliance result keys:", Object.keys(result));
      console.log("[ZATCA] result.requestID:", result.requestID);
      console.log(
        "[ZATCA] result.binarySecurityToken length:",
        result.binarySecurityToken?.length,
      );
      console.log("[ZATCA] result.secret length:", result.secret?.length);
      console.log("[ZATCA] result.tokenType:", result.tokenType);
      console.log(
        "[ZATCA] result.dispositionMessage:",
        result.dispositionMessage,
      );

      // CRITICAL: ZATCA returns binarySecurityToken as base64(base64(DER_cert))
      // We need to decode it once to get the actual base64 certificate for PEM use
      // This matches optima_zatca: base64.b64decode(binarySecurityToken).decode()
      const decodedCert = Buffer.from(
        result.binarySecurityToken,
        "base64",
      ).toString();
      console.log(
        "[ZATCA] Decoded cert starts with:",
        decodedCert.substring(0, 20),
      );
      console.log("[ZATCA] Decoded cert length:", decodedCert.length);

      // Store compliance CSID + private key at branch or restaurant level
      const csidData: Record<string, any> = {
        zatcaComplianceCsid: decodedCert,
        zatcaSecretKey: result.secret,
        zatcaDeviceId: result.requestID,
        zatcaCertificate: decodedCert,
      };
      // Store private key if generated
      if (privateKey) {
        csidData.zatcaPrivateKey = privateKey;
      }

      console.log(
        "[ZATCA] csidData to save:",
        JSON.stringify({
          hasComplianceCsid: !!csidData.zatcaComplianceCsid,
          csidLength: csidData.zatcaComplianceCsid?.length,
          hasSecret: !!csidData.zatcaSecretKey,
          secretLength: csidData.zatcaSecretKey?.length,
          deviceId: csidData.zatcaDeviceId,
          hasPrivateKey: !!csidData.zatcaPrivateKey,
        }),
      );
      console.log("[ZATCA] Saving to restaurantId:", restaurantId);

      if (branchId) {
        await storage.updateBranch(branchId, {
          ...csidData,
          zatcaEnvironment: environment,
        } as any);
        console.log("[ZATCA] Branch update done for branchId:", branchId);
      }
      // Always update restaurant level too (backward compat)
      const updatedRestaurant = await storage.updateRestaurantById(
        restaurantId,
        csidData as any,
      );
      console.log(
        "[ZATCA] Restaurant update result:",
        updatedRestaurant ? "success" : "FAILED/null",
      );
      console.log(
        "[ZATCA] Updated zatcaComplianceCsid length:",
        updatedRestaurant?.zatcaComplianceCsid?.length,
      );
      console.log(
        "[ZATCA] Updated zatcaDeviceId:",
        updatedRestaurant?.zatcaDeviceId,
      );

      // Save to zatca_devices table if egsDeviceId or create new device
      let savedDeviceId = egsDeviceId;
      if (branchId) {
        if (egsDeviceId) {
          // Update existing device
          await storage.updateZatcaDevice(egsDeviceId, {
            zatcaComplianceCsid: decodedCert,
            zatcaSecretKey: result.secret,
            zatcaRequestId: result.requestID,
            zatcaCertificate: decodedCert,
            zatcaPrivateKey: privateKey || undefined,
            zatcaEnvironment: environment,
            serialNumber: egsSerial,
            registrationStep: 1,
          } as any);
          console.log("[ZATCA] Device updated:", egsDeviceId);
        } else {
          // Auto-create device for this branch
          const newDevice = await storage.createZatcaDevice({
            restaurantId,
            branchId,
            name: `كاشير ${egsSerial.split("-").pop()}`,
            serialNumber: egsSerial,
            isActive: true,
            zatcaComplianceCsid: decodedCert,
            zatcaSecretKey: result.secret,
            zatcaRequestId: result.requestID,
            zatcaCertificate: decodedCert,
            zatcaPrivateKey: privateKey || undefined,
            zatcaEnvironment: environment,
            registrationStep: 1,
          } as any);
          savedDeviceId = newDevice.id;
          console.log(
            "[ZATCA] New device created:",
            newDevice.id,
            newDevice.name,
          );
        }
      }

      res.json({
        success: true,
        requestId: result.requestID,
        dispositionMessage: result.dispositionMessage,
        registeredFor: branchId ? "branch" : "restaurant",
        egsDeviceId: savedDeviceId || null,
      });
    } catch (error: any) {
      console.error("ZATCA Compliance CSID error:", error?.message);
      res
        .status(500)
        .json({ error: error?.message || "Failed to get compliance CSID" });
    }
  });

  // Register device - Step 2: Run compliance checks
  app.post("/api/zatca/compliance-check", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const restaurant = await storage.getRestaurantById(restaurantId);
      if (!restaurant)
        return res.status(404).json({ error: "Restaurant not found" });

      const branchId = req.body?.branchId || null;
      const egsDeviceId = req.body?.egsDeviceId || null;
      const creds = await getZatcaCredentials(
        restaurant,
        branchId,
        egsDeviceId,
      );

      if (!creds.complianceCsid || !creds.secret) {
        return res
          .status(400)
          .json({ error: "Missing compliance CSID. Complete Step 1 first." });
      }

      const baseUrl = getZatcaBaseUrl(creds.environment);

      // Fetch private key for signing (device → branch → restaurant)
      let privateKey: string | null = creds.privateKey || null;
      if (!privateKey && branchId) {
        const branch = await storage.getBranch(branchId);
        privateKey = (branch as any)?.zatcaPrivateKey || null;
      }
      if (!privateKey) {
        privateKey = (restaurant as any).zatcaPrivateKey || null;
      }

      // Generate & submit all 6 compliance invoice types required by ZATCA:
      // 1. Standard Invoice (0100000), 2. Simplified Invoice (0200000)
      // 3. Standard Credit Note, 4. Simplified Credit Note
      // 5. Standard Debit Note, 6. Simplified Debit Note
      const now = new Date();
      let currentHash =
        restaurant.zatcaLastInvoiceHash ||
        Buffer.from(
          "NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==",
          "base64",
        ).toString("utf8");

      const seller = {
        nameAr: restaurant.nameAr || restaurant.nameEn || "مطعم",
        vatNumber: restaurant.vatNumber || "",
        commercialRegistration: restaurant.commercialRegistration || "",
        streetName: restaurant.streetName || "",
        buildingNumber: restaurant.buildingNumber || "",
        district: restaurant.district || "",
        city: restaurant.city || "",
        postalCode: restaurant.postalCode || "",
        country: "SA" as const,
      };

      // Standard buyer info (required for standard/0100000 invoices)
      const standardBuyer = {
        name: "شركة اختبار",
        vatNumber: "399999999900003",
        streetName: "شارع الملك فهد",
        buildingNumber: "1234",
        district: "حي الملقا",
        city: "الرياض",
        postalCode: "12345",
        country: "SA",
      };

      const complianceInvoiceTypes: Array<{
        type: "simplified" | "standard" | "credit_note" | "debit_note";
        label: string;
        num: string;
        isStandard: boolean;
        relatedInvoice?: string;
      }> = [
        {
          type: "standard",
          label: "Standard Invoice",
          num: "COMP-STD-001",
          isStandard: true,
        },
        {
          type: "simplified",
          label: "Simplified Invoice",
          num: "COMP-SMP-001",
          isStandard: false,
        },
        {
          type: "credit_note",
          label: "Standard Credit Note",
          num: "COMP-SCN-001",
          isStandard: true,
          relatedInvoice: "COMP-STD-001",
        },
        {
          type: "credit_note",
          label: "Simplified Credit Note",
          num: "COMP-MCN-001",
          isStandard: false,
          relatedInvoice: "COMP-SMP-001",
        },
        {
          type: "debit_note",
          label: "Standard Debit Note",
          num: "COMP-SDN-001",
          isStandard: true,
          relatedInvoice: "COMP-STD-001",
        },
        {
          type: "debit_note",
          label: "Simplified Debit Note",
          num: "COMP-MDN-001",
          isStandard: false,
          relatedInvoice: "COMP-SMP-001",
        },
      ];

      const allResults: Array<{
        label: string;
        invoiceNumber: string;
        passed: boolean;
        validationResults: any;
        reportingStatus?: string;
      }> = [];
      let allPassed = true;
      let invoiceCounter = 1;

      for (const invType of complianceInvoiceTypes) {
        const uuid = generateInvoiceUuid();
        const testXml = generateZatcaXml({
          uuid,
          invoiceNumber: invType.num,
          invoiceType: invType.type,
          issueDate: now.toISOString().split("T")[0],
          issueTime: now.toTimeString().split(" ")[0],
          deliveryDate: now.toISOString().split("T")[0],
          seller,
          buyer: invType.isStandard ? standardBuyer : undefined,
          items: [
            {
              id: "1",
              nameAr: "منتج تجريبي",
              quantity: 1,
              unitPrice: 100,
              discount: 0,
              taxRate: 15,
              taxAmount: 15,
              totalWithTax: 115,
              totalWithoutTax: 100,
            },
          ],
          subtotal: 100,
          discount: 0,
          deliveryFee: 0,
          taxAmount: 15,
          taxRate: 15,
          total: 115,
          previousInvoiceHash: currentHash,
          invoiceCounter,
          relatedInvoiceNumber: invType.relatedInvoice,
          relatedInvoiceIssueDate: invType.relatedInvoice
            ? now.toISOString().split("T")[0]
            : undefined,
          noteReason:
            invType.type === "credit_note" || invType.type === "debit_note"
              ? "اختبار المطابقة"
              : undefined,
        });

        const signResult = buildSignedInvoice(
          testXml,
          privateKey,
          creds.complianceCsid!,
          {
            sellerName: seller.nameAr,
            vatNumber: seller.vatNumber,
            timestamp: now.toISOString().replace("T", "T").slice(0, 19) + "Z",
            total: "115.00",
            vatAmount: "15.00",
          },
        );

        const xmlToSubmit = signResult.signedXml || signResult.finalXml;
        const hash = signResult.invoiceHash;
        currentHash = hash; // chain next invoice hash

        const result = isMockEnvironment(creds.environment)
          ? mockSubmitComplianceInvoice()
          : await submitComplianceInvoice(
              baseUrl,
              creds.complianceCsid!,
              creds.secret!,
              hash,
              uuid,
              xmlToSubmit,
            );

        const passed = result.validationResults?.status === "PASS";
        if (!passed) allPassed = false;

        allResults.push({
          label: invType.label,
          invoiceNumber: invType.num,
          passed,
          validationResults: result.validationResults,
          reportingStatus: result.reportingStatus,
        });

        console.log(
          `[ZATCA] Compliance ${invType.label} (${invType.num}): ${passed ? "PASS" : "FAIL"}`,
        );
        invoiceCounter++;
      }

      // Update device registration step only if ALL 6 invoices passed
      if (allPassed && (egsDeviceId || creds.egsDeviceId)) {
        const deviceToUpdate = egsDeviceId || creds.egsDeviceId;
        await storage.updateZatcaDevice(deviceToUpdate!, {
          registrationStep: 2,
        } as any);
        console.log(
          "[ZATCA] Device all 6 compliance checks passed, step updated to 2:",
          deviceToUpdate,
        );
      }

      res.json({
        success: allPassed,
        results: allResults,
        summary: {
          total: allResults.length,
          passed: allResults.filter((r) => r.passed).length,
          failed: allResults.filter((r) => !r.passed).length,
        },
        // Backward compat: return last result's validationResults
        validationResults: allResults[allResults.length - 1]?.validationResults,
        reportingStatus: allResults[allResults.length - 1]?.reportingStatus,
      });
    } catch (error: any) {
      console.error("ZATCA Compliance check error:", error?.message);
      console.error("ZATCA Compliance check stack:", error?.stack);
      res
        .status(500)
        .json({ error: error?.message || "Compliance check failed" });
    }
  });

  // Register device - Step 3: Get Production CSID
  app.post("/api/zatca/production-csid", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const restaurant = await storage.getRestaurantById(restaurantId);
      if (!restaurant)
        return res.status(404).json({ error: "Restaurant not found" });

      const branchId = req.body.branchId || null;
      const egsDeviceId = req.body.egsDeviceId || null;
      const creds = await getZatcaCredentials(
        restaurant,
        branchId,
        egsDeviceId,
      );

      if (!creds.complianceCsid || !creds.secret || !creds.deviceId) {
        return res.status(400).json({
          error: "Missing compliance credentials. Complete Steps 1-2 first.",
        });
      }

      const baseUrl = getZatcaBaseUrl(creds.environment);

      const result = isMockEnvironment(creds.environment)
        ? mockGetProductionCsid()
        : await getProductionCsid(
            baseUrl,
            creds.deviceId,
            creds.complianceCsid,
            creds.secret,
          );

      // CRITICAL: Decode binarySecurityToken (same as step 1)
      const decodedProdCert = Buffer.from(
        result.binarySecurityToken,
        "base64",
      ).toString();

      // Store production CSID at branch level if branchId, else restaurant
      const prodCsidData = {
        zatcaProductionCsid: decodedProdCert,
        zatcaSecretKey: result.secret,
        zatcaCertificate: decodedProdCert,
      };

      if (branchId) {
        await storage.updateBranch(branchId, prodCsidData as any);
      }
      // Always update restaurant level too (backward compat)
      await storage.updateRestaurantById(restaurantId, prodCsidData as any);

      // Save to device record
      const deviceToUpdate = egsDeviceId || creds.egsDeviceId;
      if (deviceToUpdate) {
        await storage.updateZatcaDevice(deviceToUpdate, {
          zatcaProductionCsid: decodedProdCert,
          zatcaSecretKey: result.secret,
          zatcaCertificate: decodedProdCert,
          registrationStep: 3,
        } as any);
        console.log(
          "[ZATCA] Device production CSID saved, step=3:",
          deviceToUpdate,
        );
      }

      res.json({
        success: true,
        requestId: result.requestID,
        dispositionMessage: result.dispositionMessage,
        registeredFor: branchId ? "branch" : "restaurant",
        egsDeviceId: deviceToUpdate || null,
      });
    } catch (error: any) {
      console.error("ZATCA Production CSID error:", error?.message);
      res
        .status(500)
        .json({ error: error?.message || "Failed to get production CSID" });
    }
  });

  // =====================================================
  // ZATCA Device (EGS) Management Routes
  // =====================================================

  // List devices for a branch
  app.get("/api/zatca/devices", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const branchId = req.query.branchId as string;
      if (!branchId)
        return res.status(400).json({ error: "branchId is required" });

      const branch = await storage.getBranch(branchId);
      if (!branch || branch.restaurantId !== restaurantId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const devices = await storage.getZatcaDevices(branchId);
      res.json(
        devices.map((d: any) => ({
          id: d.id,
          name: d.name,
          nameAr: d.nameAr,
          serialNumber: d.serialNumber,
          isActive: d.isActive,
          registrationStep: d.registrationStep || 0,
          hasComplianceCsid: !!d.zatcaComplianceCsid,
          hasProductionCsid: !!d.zatcaProductionCsid,
          certificateExpiry: d.zatcaCertificateExpiry,
          invoiceCounter: d.zatcaInvoiceCounter || 0,
          environment: d.zatcaEnvironment,
          createdAt: d.createdAt,
        })),
      );
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error?.message || "Failed to list devices" });
    }
  });

  // Create a new device (cashier) for a branch
  app.post("/api/zatca/devices", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const { branchId, name, nameAr } = req.body;
      if (!branchId || !name)
        return res
          .status(400)
          .json({ error: "branchId and name are required" });

      const branch = await storage.getBranch(branchId);
      if (!branch || branch.restaurantId !== restaurantId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const restaurant = await storage.getRestaurantById(restaurantId);
      const vatNumber =
        restaurant?.vatNumber?.replace(/\D/g, "") || "000000000000000";
      const existingDevices = await storage.getZatcaDevices(branchId);
      const seqNum = String(existingDevices.length + 1).padStart(5, "0");

      const device = await storage.createZatcaDevice({
        restaurantId,
        branchId,
        name,
        nameAr: nameAr || name,
        serialNumber: `EGS1-${vatNumber}-${seqNum}`,
        isActive: true,
        zatcaEnvironment: restaurant?.zatcaEnvironment || "sandbox",
      } as any);

      res.json(device);
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error?.message || "Failed to create device" });
    }
  });

  // Update a device
  app.patch("/api/zatca/devices/:id", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const device = await storage.getZatcaDevice(req.params.id);
      if (!device || device.restaurantId !== restaurantId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const { name, nameAr, isActive } = req.body;
      const updated = await storage.updateZatcaDevice(req.params.id, {
        ...(name !== undefined && { name }),
        ...(nameAr !== undefined && { nameAr }),
        ...(isActive !== undefined && { isActive }),
      } as any);

      res.json(updated);
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error?.message || "Failed to update device" });
    }
  });

  // Delete a device
  app.delete("/api/zatca/devices/:id", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const device = await storage.getZatcaDevice(req.params.id);
      if (!device || device.restaurantId !== restaurantId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      await storage.deleteZatcaDevice(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error?.message || "Failed to delete device" });
    }
  });

  // Submit invoice to ZATCA (report simplified / clear standard)
  app.post("/api/zatca/submit/:invoiceId", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const restaurant = await storage.getRestaurantById(restaurantId);
      if (!restaurant)
        return res.status(404).json({ error: "Restaurant not found" });

      const invoice = await storage.getInvoice(req.params.invoiceId);
      if (!invoice) return res.status(404).json({ error: "Invoice not found" });
      if (invoice.restaurantId !== restaurantId)
        return res.status(403).json({ error: "Unauthorized" });

      // Resolve credentials from invoice's branch, fall back to restaurant
      const creds = await getZatcaCredentials(
        restaurant,
        (invoice as any).branchId,
      );
      if (!creds.certificate || !creds.secret) {
        return res.status(400).json({
          error: "ZATCA not configured. Complete device registration first.",
        });
      }

      if (!invoice.xmlContent && !invoice.signedXml) {
        return res
          .status(400)
          .json({ error: "Invoice has no XML content to submit." });
      }

      const xmlToSubmit = invoice.signedXml || invoice.xmlContent || "";
      const hash = invoice.invoiceHash || computeInvoiceHashBase64(xmlToSubmit);
      const uuid = invoice.uuid || generateInvoiceUuid();

      const baseUrl = getZatcaBaseUrl(creds.environment);

      let result;
      if (invoice.invoiceType === "standard") {
        // Standard invoice needs clearance
        result = isMockEnvironment(creds.environment)
          ? mockClearInvoice()
          : await clearInvoice(
              baseUrl,
              creds.certificate!,
              creds.secret!,
              hash,
              uuid,
              xmlToSubmit,
            );
        await storage.updateInvoice(invoice.id, {
          zatcaStatus:
            result.clearanceStatus === "CLEARED" ? "accepted" : "rejected",
          zatcaSubmissionId: uuid,
          zatcaWarnings: JSON.stringify(
            result.validationResults?.warningMessages || [],
          ),
          zatcaErrors: JSON.stringify(
            result.validationResults?.errorMessages || [],
          ),
          signedXml: result.clearedInvoice
            ? Buffer.from(result.clearedInvoice, "base64").toString("utf8")
            : xmlToSubmit,
          status: result.clearanceStatus === "CLEARED" ? "reported" : "issued",
        });
      } else {
        // Simplified invoice needs reporting
        result = isMockEnvironment(creds.environment)
          ? mockReportInvoice()
          : await reportInvoice(
              baseUrl,
              creds.certificate!,
              creds.secret!,
              hash,
              uuid,
              xmlToSubmit,
            );
        await storage.updateInvoice(invoice.id, {
          zatcaStatus:
            result.reportingStatus === "REPORTED"
              ? "accepted"
              : result.reportingStatus === "NOT_REPORTED"
                ? "rejected"
                : "submitted",
          zatcaSubmissionId: uuid,
          zatcaWarnings: JSON.stringify(
            result.validationResults?.warningMessages || [],
          ),
          zatcaErrors: JSON.stringify(
            result.validationResults?.errorMessages || [],
          ),
          status: result.reportingStatus === "REPORTED" ? "reported" : "issued",
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
          zatcaStatus: "rejected",
          zatcaErrors: JSON.stringify([
            { message: error?.message || "Unknown error" },
          ]),
        });
      } catch {}

      res
        .status(500)
        .json({ error: error?.message || "Failed to submit invoice to ZATCA" });
    }
  });

  // Batch submit pending invoices to ZATCA
  app.post("/api/zatca/submit-batch", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const restaurant = await storage.getRestaurantById(restaurantId);
      if (!restaurant)
        return res.status(404).json({ error: "Restaurant not found" });

      const allInvoices = await storage.getInvoices(restaurantId);
      const pendingInvoices = allInvoices.filter(
        (inv) =>
          inv.xmlContent && (!inv.zatcaStatus || inv.zatcaStatus === "pending"),
      );

      const results: Array<{
        invoiceId: string;
        invoiceNumber: string;
        status: string;
        error?: string;
      }> = [];

      for (const invoice of pendingInvoices) {
        try {
          // Resolve credentials per-invoice branch
          const invCreds = await getZatcaCredentials(
            restaurant,
            (invoice as any).branchId,
          );
          if (!invCreds.certificate || !invCreds.secret) {
            results.push({
              invoiceId: invoice.id,
              invoiceNumber: invoice.invoiceNumber || "",
              status: "ERROR",
              error: "No ZATCA credentials for this branch",
            });
            continue;
          }
          const baseUrl = getZatcaBaseUrl(invCreds.environment);

          const xmlToSubmit = invoice.signedXml || invoice.xmlContent || "";
          const hash =
            invoice.invoiceHash || computeInvoiceHashBase64(xmlToSubmit);
          const uuid = invoice.uuid || generateInvoiceUuid();

          if (invoice.invoiceType === "standard") {
            const result = isMockEnvironment(invCreds.environment)
              ? mockClearInvoice()
              : await clearInvoice(
                  baseUrl,
                  invCreds.certificate,
                  invCreds.secret,
                  hash,
                  uuid,
                  xmlToSubmit,
                );
            await storage.updateInvoice(invoice.id, {
              zatcaStatus:
                result.clearanceStatus === "CLEARED" ? "accepted" : "rejected",
              zatcaSubmissionId: uuid,
              zatcaWarnings: JSON.stringify(
                result.validationResults?.warningMessages || [],
              ),
              zatcaErrors: JSON.stringify(
                result.validationResults?.errorMessages || [],
              ),
              status:
                result.clearanceStatus === "CLEARED" ? "reported" : "issued",
            });
            results.push({
              invoiceId: invoice.id,
              invoiceNumber: invoice.invoiceNumber || "",
              status: result.clearanceStatus || "UNKNOWN",
            });
          } else {
            const result = isMockEnvironment(invCreds.environment)
              ? mockReportInvoice()
              : await reportInvoice(
                  baseUrl,
                  invCreds.certificate,
                  invCreds.secret,
                  hash,
                  uuid,
                  xmlToSubmit,
                );
            await storage.updateInvoice(invoice.id, {
              zatcaStatus:
                result.reportingStatus === "REPORTED" ? "accepted" : "rejected",
              zatcaSubmissionId: uuid,
              zatcaWarnings: JSON.stringify(
                result.validationResults?.warningMessages || [],
              ),
              zatcaErrors: JSON.stringify(
                result.validationResults?.errorMessages || [],
              ),
              status:
                result.reportingStatus === "REPORTED" ? "reported" : "issued",
            });
            results.push({
              invoiceId: invoice.id,
              invoiceNumber: invoice.invoiceNumber || "",
              status: result.reportingStatus || "UNKNOWN",
            });
          }
        } catch (err: any) {
          results.push({
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber || "",
            status: "ERROR",
            error: err?.message,
          });
        }
      }

      res.json({
        total: pendingInvoices.length,
        results,
        accepted: results.filter(
          (r) => r.status === "REPORTED" || r.status === "CLEARED",
        ).length,
        rejected: results.filter(
          (r) => r.status === "NOT_REPORTED" || r.status === "NOT_CLEARED",
        ).length,
        errors: results.filter((r) => r.status === "ERROR").length,
      });
    } catch (error: any) {
      res
        .status(500)
        .json({ error: error?.message || "Batch submission failed" });
    }
  });

  // Generate ZATCA invoice for an existing order (with full XML + hash chain)
  app.post("/api/zatca/generate/:orderId", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const restaurant = await storage.getRestaurantById(restaurantId);
      if (!restaurant)
        return res.status(404).json({ error: "Restaurant not found" });

      const order = await storage.getOrder(req.params.orderId);
      if (!order) return res.status(404).json({ error: "Order not found" });
      if (order.restaurantId !== restaurantId)
        return res.status(403).json({ error: "Unauthorized" });

      // Check if invoice already exists for this order
      const existingInvoice = await storage.getInvoiceByOrder(order.id);
      if (existingInvoice) {
        return res.status(409).json({
          error: "Invoice already exists for this order",
          invoice: existingInvoice,
        });
      }

      const orderItems = await storage.getOrderItems(order.id);
      const menuItemsRaw = await storage.getMenuItems(restaurantId);
      const menuItemsMap = new Map(menuItemsRaw.map((m) => [m.id, m]));

      const invoiceType =
        (req.body.invoiceType as "simplified" | "standard") || "simplified";
      const buyer = req.body.buyer;

      const zatcaResult = await buildZatcaInvoice(
        restaurant,
        order,
        orderItems,
        menuItemsMap,
        invoiceType,
        undefined,
        buyer,
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
        status: "issued",
        zatcaStatus: "pending",
      });

      res.status(201).json(invoice);
    } catch (error: any) {
      console.error("ZATCA generate error:", error);
      res
        .status(500)
        .json({ error: error?.message || "Failed to generate ZATCA invoice" });
    }
  });

  // Create credit note for an existing invoice
  app.post("/api/zatca/credit-note/:invoiceId", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const restaurant = await storage.getRestaurantById(restaurantId);
      if (!restaurant)
        return res.status(404).json({ error: "Restaurant not found" });

      const originalInvoice = await storage.getInvoice(req.params.invoiceId);
      if (!originalInvoice)
        return res.status(404).json({ error: "Original invoice not found" });
      if (originalInvoice.restaurantId !== restaurantId)
        return res.status(403).json({ error: "Unauthorized" });

      const order = await storage.getOrder(originalInvoice.orderId);
      if (!order) return res.status(404).json({ error: "Order not found" });

      const orderItems = await storage.getOrderItems(order.id);
      const menuItemsRaw = await storage.getMenuItems(restaurantId);
      const menuItemsMap = new Map(menuItemsRaw.map((m) => [m.id, m]));

      const zatcaResult = await buildZatcaInvoice(
        restaurant,
        order,
        orderItems,
        menuItemsMap,
        "credit_note",
        originalInvoice,
        undefined,
        req.body.reason || "إلغاء الفاتورة",
      );

      const creditNote = await storage.createInvoice({
        restaurantId,
        branchId: order.branchId || null,
        orderId: order.id,
        invoiceNumber: zatcaResult.invoiceNumber,
        invoiceType: "credit_note",
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
        refundReason: req.body.reason || "إلغاء الفاتورة",
        status: "issued",
        zatcaStatus: "pending",
      });

      // Cancel original invoice
      await storage.updateInvoice(originalInvoice.id, { status: "cancelled" });

      res.status(201).json(creditNote);
    } catch (error: any) {
      console.error("ZATCA credit note error:", error);
      res
        .status(500)
        .json({ error: error?.message || "Failed to create credit note" });
    }
  });

  // Get ZATCA dashboard stats
  app.get("/api/zatca/dashboard", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const invoices = await storage.getInvoices(restaurantId);

      const stats = {
        total: invoices.length,
        pending: invoices.filter(
          (i) => i.zatcaStatus === "pending" || !i.zatcaStatus,
        ).length,
        submitted: invoices.filter((i) => i.zatcaStatus === "submitted").length,
        accepted: invoices.filter((i) => i.zatcaStatus === "accepted").length,
        rejected: invoices.filter((i) => i.zatcaStatus === "rejected").length,
        withXml: invoices.filter((i) => !!i.xmlContent).length,
        withoutXml: invoices.filter((i) => !i.xmlContent).length,
        creditNotes: invoices.filter((i) => i.invoiceType === "credit_note")
          .length,
        debitNotes: invoices.filter((i) => i.invoiceType === "debit_note")
          .length,
        simplified: invoices.filter((i) => i.invoiceType === "simplified")
          .length,
        standard: invoices.filter((i) => i.invoiceType === "standard").length,
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
      if (
        !["sandbox", "simulation", "production", "mock"].includes(environment)
      ) {
        return res.status(400).json({
          error:
            "Invalid environment. Use: sandbox, simulation, production, or mock",
        });
      }
      await storage.updateRestaurantById(restaurantId, {
        zatcaEnvironment: environment,
      } as any);
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
      if (invoice.restaurantId !== restaurantId)
        return res.status(403).json({ error: "Unauthorized" });

      const xml = invoice.signedXml || invoice.xmlContent;
      if (!xml)
        return res.status(404).json({ error: "No XML content available" });

      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=invoice_${invoice.invoiceNumber || invoice.id}.xml`,
      );
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
      const integrations = await storage.getDeliveryIntegrations(
        restaurantId,
        branchId,
      );
      // Hide sensitive fields from response
      const safe = integrations.map((i) => ({
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

      const updated = await storage.updateDeliveryIntegration(
        req.params.id,
        updateData,
      );
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
        res.json({
          success: true,
          message: "Connection successful",
          hasToken: !!token,
        });
      } else if (integration.platform === "jahez") {
        // Test Jahez connection by trying to register webhooks
        // This verifies the API base URL and auth token
        const baseUrl = `${req.protocol}://${req.get("host")}`;
        try {
          await jahez.registerCreateOrderWebhook(
            integration,
            `${baseUrl}/api/webhooks/jahez`,
          );
          await jahez.registerOrderUpdateWebhook(
            integration,
            `${baseUrl}/api/webhooks/jahez/update`,
          );
          res.json({
            success: true,
            message: "Jahez connection successful, webhooks registered",
          });
        } catch (err: any) {
          res.json({
            success: false,
            message: `Jahez connection failed: ${err.message}`,
          });
        }
      } else {
        res.json({
          success: false,
          message: `Platform ${integration.platform} not yet supported`,
        });
      }
    } catch (error: any) {
      res.json({
        success: false,
        message: error.message || "Connection failed",
      });
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
        res.json({
          vendor_id: integration.vendorId,
          status: integration.outletStatus === "open" ? "OPEN" : "CLOSED",
        });
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
      const validStatuses = [
        "open",
        "closed",
        "OPEN",
        "CLOSED_TODAY",
        "CLOSED_UNTIL",
        "CHECKIN",
      ];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          error:
            "Invalid status. Use: open, closed, OPEN, CLOSED_TODAY, CLOSED_UNTIL, CHECKIN",
        });
      }

      if (integration.platform === "hungerstation") {
        try {
          await hungerstation.updateOutletStatus(
            integration,
            status,
            closed_reason,
            closed_until,
          );
        } catch (apiError: any) {
          console.error(
            `[Delivery] Failed to update HungerStation outlet status:`,
            apiError.message,
          );
          // Still update locally even if API call fails
        }
      }

      // Normalize to local status
      const localStatus =
        status === "open" || status === "OPEN" ? "open" : "closed";
      const updated = await storage.updateDeliveryIntegration(req.params.id, {
        outletStatus: localStatus,
      } as any);
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
    integration: any,
  ): Promise<{ posOrder: any; deliveryOrderUpdated: any }> {
    const platformRaw = (deliveryOrder.platform || "delivery").toLowerCase();
    const platformShort = platformRaw.toUpperCase().slice(0, 2) || "DL";
    const externalRef =
      deliveryOrder.orderCode || deliveryOrder.externalOrderId || "";
    const orderNumber = `DEL-${platformShort}-${externalRef.slice(-6) || Date.now().toString().slice(-6)}`;

    // Payment method = platform name (hungerstation, jahez, etc.)
    const paymentMethodName =
      platformRaw === "hungerstation"
        ? "hungerstation"
        : platformRaw === "jahez"
          ? "jahez"
          : platformRaw;

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
    const deliveryItems = Array.isArray(deliveryOrder.items)
      ? deliveryOrder.items
      : [];
    for (const item of deliveryItems) {
      try {
        const qty = parseInt(String(item.quantity)) || 1;
        const unitPrice = parseFloat(
          String(item.unitPrice || item.unit_price || 0),
        );
        const totalPrice = parseFloat(
          String(item.totalPrice || item.total_price || unitPrice * qty),
        );
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
        console.error(
          `[Delivery] Failed to create order item:`,
          itemErr.message,
        );
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
        const xmlItems: ZatcaLineItem[] = deliveryItems.map(
          (item: any, idx: number) => {
            const unitPrice = parseFloat(
              String(item.unitPrice || item.unit_price || 0),
            );
            const qty = parseInt(String(item.quantity)) || 1;
            const lineTotal = bankersRound(unitPrice * qty);
            const lineTax = bankersRound(lineTotal * (taxRate / 100));
            return {
              id: String(idx + 1),
              nameAr: item.nameAr || item.name || "منتج توصيل",
              nameEn: item.name || "",
              quantity: qty,
              unitPrice,
              discount: 0,
              taxRate,
              taxAmount: lineTax,
              totalWithTax: bankersRound(lineTotal + lineTax),
              totalWithoutTax: lineTotal,
            };
          },
        );

        // If no items, create a single line item from totals
        if (xmlItems.length === 0) {
          const total = parseFloat(
            String(deliveryOrder.subtotal || deliveryOrder.total || 0),
          );
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

        const itemsSubtotal = bankersRound(
          xmlItems.reduce((sum, i) => sum + i.totalWithoutTax, 0),
        );
        const orderDiscount = parseFloat(String(deliveryOrder.discount || 0));
        const orderDeliveryFee = parseFloat(
          String(deliveryOrder.deliveryFee || 0),
        );
        const taxableAmt = bankersRound(
          Math.max(0, itemsSubtotal - orderDiscount + orderDeliveryFee),
        );
        const vatAmount = bankersRound(taxableAmt * (taxRate / 100));
        const invoiceTotal = bankersRound(taxableAmt + vatAmount);

        const { counter: prevCounter, lastHash: prevHash } =
          await storage.getZatcaCounterAndHash(restaurantId, orderBranchId);
        const currentCounter = prevCounter + 1;
        const previousHash =
          prevHash ||
          Buffer.from(
            "NWZlY2ViNjZmZmM4NmYzOGQ5NTI3ODZjNmQ2OTZjNzljMmRiYzIzOWRkNGU5MWI0NjcyOWQ3M2EyN2ZiNTdlOQ==",
            "base64",
          ).toString("utf8");

        const uuid = generateInvoiceUuid();
        const invoiceNumber = await storage.getNextInvoiceNumber(
          restaurantId,
          orderBranchId,
        );

        const unsignedDeliveryXml = generateZatcaXml({
          uuid,
          invoiceNumber,
          invoiceType: "simplified",
          issueDate: now.toISOString().split("T")[0],
          issueTime: now.toTimeString().split(" ")[0],
          deliveryDate: now.toISOString().split("T")[0],
          seller: {
            nameAr: restaurant.nameAr || restaurant.nameEn || "مطعم",
            vatNumber: restaurant.vatNumber || "",
            commercialRegistration: restaurant.commercialRegistration || "",
            streetName: restaurant.streetName || "",
            buildingNumber: restaurant.buildingNumber || "",
            district: restaurant.district || "",
            city: restaurant.city || "",
            postalCode: restaurant.postalCode || "",
            country: restaurant.country || "SA",
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
            delCert =
              (br as any).zatcaProductionCsid ||
              (br as any).zatcaComplianceCsid ||
              (br as any).zatcaCertificate;
          }
        }
        if (!delPrivKey && (restaurant as any).zatcaPrivateKey) {
          delPrivKey = (restaurant as any).zatcaPrivateKey;
          delCert =
            restaurant.zatcaProductionCsid ||
            restaurant.zatcaComplianceCsid ||
            restaurant.zatcaCertificate;
        }

        const delSignResult = buildSignedInvoice(
          unsignedDeliveryXml,
          delPrivKey,
          delCert,
          {
            sellerName: restaurant.nameAr || restaurant.nameEn || "مطعم",
            vatNumber: restaurant.vatNumber || "",
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
          deliveryFee: parseFloat(
            String(deliveryOrder.deliveryFee || 0),
          ).toFixed(2),
          discount: parseFloat(String(deliveryOrder.discount || 0)).toFixed(2),
          signedXml: delSignResult.signedXml || null,
        });

        await storage.updateZatcaCounterAndHash(
          restaurantId,
          orderBranchId,
          currentCounter,
          invoiceHash,
        );
        console.log(
          `[Delivery] Invoice ${invoiceNumber} created for delivery order ${deliveryOrder.orderCode}`,
        );
      }
    } catch (invoiceErr: any) {
      console.error(`[Delivery] Invoice creation failed:`, invoiceErr.message);
    }

    // 4. Update day session totals
    try {
      const currentSession = await storage.getCurrentDaySession(
        restaurantId,
        deliveryOrder.branchId || undefined,
      );
      if (currentSession) {
        const orderTotal = parseFloat(posOrder.total || "0");
        await storage.incrementDaySessionTotals(
          currentSession.id,
          orderTotal,
          "card",
        );
      }
    } catch (e: any) {
      console.error(`[Delivery] Day session update failed:`, e.message);
    }

    // 5. Update delivery order link
    const deliveryOrderUpdated = await storage.updateDeliveryOrder(
      deliveryOrder.id,
      {
        platformStatus: "accepted",
        orderId: posOrder.id,
        acceptedAt: new Date(),
      } as any,
    );

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
        return res.status(400).json({
          error: `Cannot accept order in status: ${deliveryOrder.platformStatus}`,
        });
      }

      const integration = await storage.getDeliveryIntegration(
        deliveryOrder.integrationId,
      );
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
      const { posOrder, deliveryOrderUpdated } = await acceptDeliveryOrderFull(
        restaurantId,
        deliveryOrder,
        integration,
      );

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
        return res.status(400).json({
          error: `Cannot mark ready from status: ${deliveryOrder.platformStatus}`,
        });
      }

      const integration = await storage.getDeliveryIntegration(
        deliveryOrder.integrationId,
      );
      if (integration && integration.platform === "hungerstation") {
        try {
          // Pass raw payload so we can build proper items array
          await hungerstation.markOrderReady(
            integration,
            deliveryOrder.externalOrderId,
            deliveryOrder.rawPayload,
          );
        } catch (apiError: any) {
          console.error(
            `[Delivery] HungerStation READY_FOR_PICKUP failed:`,
            apiError.message,
          );
        }
      }

      // Update POS order status too
      if (deliveryOrder.orderId) {
        await storage.updateOrderStatus(deliveryOrder.orderId, "ready");
      }

      const updated = await storage.updateDeliveryOrderStatus(
        req.params.id,
        "ready",
      );
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

      const integration = await storage.getDeliveryIntegration(
        deliveryOrder.integrationId,
      );
      if (integration && integration.platform === "hungerstation") {
        const validReasons = ["CLOSED", "ITEM_UNAVAILABLE", "TOO_BUSY"];
        const cancelReason = validReasons.includes(reasonInput)
          ? reasonInput
          : "TOO_BUSY";
        try {
          await hungerstation.cancelOrder(
            integration,
            deliveryOrder.externalOrderId,
            cancelReason as any,
            deliveryOrder.rawPayload,
          );
        } catch (apiError: any) {
          console.error(
            `[Delivery] HungerStation cancel failed:`,
            apiError.message,
          );
        }
      } else if (integration && integration.platform === "jahez") {
        try {
          const jahezOrderId = parseInt(deliveryOrder.externalOrderId);
          await jahez.updateOrderStatus(
            integration,
            jahezOrderId,
            "R",
            reasonInput,
          );
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
        cancelReason: reasonInput,
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
      console.log(
        `[Webhook] HungerStation: ${payload?.status || "unknown"} order=${payload?.order_id || "?"} store=${payload?.client?.store_id || "?"}`,
      );

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
      const storeId =
        client.store_id || client.external_partner_config_id || client.id;
      if (!storeId) {
        console.error("[Webhook] HungerStation: No store_id in payload.client");
        return res.status(200).json({ received: true });
      }

      const integration = await storage.getDeliveryIntegrationByVendor(
        "hungerstation",
        String(storeId),
      );
      if (!integration) {
        console.error(
          `[Webhook] HungerStation: No integration found for store ${storeId}`,
        );
        return res.status(200).json({ received: true });
      }

      // Validate webhook authorization (secret)
      // Per docs: Secret is configured in Partner Portal, sent as Authorization header
      const authHeader = req.headers.authorization;
      if (
        !hungerstation.validateWebhookAuth(authHeader as string, integration)
      ) {
        console.error(
          `[Webhook] HungerStation: Invalid authorization for store ${storeId}`,
        );
        return res.status(200).json({ received: true }); // Still 200 per best practice
      }

      // Handle based on order status (not event type)
      // Per docs: RECEIVED → READY_FOR_PICKUP → DISPATCHED → DELIVERED (or CANCELLED)
      if (orderStatus === "RECEIVED") {
        // New order received
        const parsed = hungerstation.parseHungerStationOrder(payload);

        // Idempotency check — handle duplicate webhook deliveries
        const existing = await storage.getDeliveryOrderByExternalId(
          "hungerstation",
          parsed.externalOrderId,
        );
        if (existing) {
          console.log(
            `[Webhook] HungerStation: Duplicate order ${parsed.externalOrderId}, skipping`,
          );
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
          messageAr: `طلب جديد ${parsed.orderCode} - ${parsed.total} ر.س من ${parsed.customerName}`,
          priority: "urgent",
          referenceType: "order",
          referenceId: deliveryOrder.id,
          targetRole: "all",
        });

        // Auto-accept if configured — full flow with items + invoice + day session
        if (integration.autoAccept) {
          try {
            await acceptDeliveryOrderFull(
              integration.restaurantId,
              deliveryOrder,
              integration,
            );
            console.log(
              `[Webhook] HungerStation: Order ${parsed.orderCode} auto-accepted`,
            );
          } catch (autoErr: any) {
            console.error(`[Webhook] Auto-accept failed:`, autoErr.message);
          }
        }

        console.log(
          `[Webhook] HungerStation: Order ${parsed.orderCode} RECEIVED, id=${deliveryOrder.id}`,
        );
      } else if (orderStatus === "CANCELLED") {
        // Order cancelled by customer, logistics, or platform
        const existing = await storage.getDeliveryOrderByExternalId(
          "hungerstation",
          String(orderId),
        );
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
          console.log(
            `[Webhook] HungerStation: Order ${orderId} CANCELLED (${cancelReason})${postPickup ? " [post pickup]" : ""}`,
          );
        }
      } else if (orderStatus === "READY_FOR_PICKUP") {
        // Confirmation that order was fulfilled (our PUT was successful)
        const existing = await storage.getDeliveryOrderByExternalId(
          "hungerstation",
          String(orderId),
        );
        if (existing) {
          await storage.updateDeliveryOrderStatus(existing.id, "ready");
          console.log(
            `[Webhook] HungerStation: Order ${orderId} READY_FOR_PICKUP confirmed`,
          );
        }
      } else if (orderStatus === "DISPATCHED") {
        // Rider picked up the order (Platform Delivery) or vendor dispatched (Vendor Delivery)
        const existing = await storage.getDeliveryOrderByExternalId(
          "hungerstation",
          String(orderId),
        );
        if (existing) {
          await storage.updateDeliveryOrder(existing.id, {
            platformStatus: "picked_up",
            pickedUpAt: new Date(),
          } as any);
          console.log(`[Webhook] HungerStation: Order ${orderId} DISPATCHED`);
        }
      } else if (orderStatus === "DELIVERED") {
        // Order delivered to customer (Platform Delivery flow — may have ~30min delay)
        const existing = await storage.getDeliveryOrderByExternalId(
          "hungerstation",
          String(orderId),
        );
        if (existing) {
          await storage.updateDeliveryOrderStatus(existing.id, "delivered");
          if (existing.orderId) {
            await storage.updateOrderStatus(existing.orderId, "completed");
          }
          console.log(`[Webhook] HungerStation: Order ${orderId} DELIVERED`);
        }
      } else {
        console.log(
          `[Webhook] HungerStation: Unhandled order status "${orderStatus}" for order ${orderId}`,
        );
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
      console.log(
        "[Webhook] Jahez create order incoming:",
        JSON.stringify(req.body).slice(0, 500),
      );

      const payload = req.body;
      const jahezId = payload.jahez_id;
      const branchId = payload.branch_id;

      if (!jahezId) {
        console.error("[Webhook] Jahez: No jahez_id in payload");
        return res.status(200).json({ success: true });
      }

      // Find integration by branch_id (vendorId stores the Jahez branch mapping)
      // Try multiple strategies to match the integration
      let integration: any = null;

      // Strategy 1: Match by vendorId (stores the Jahez branch_id)
      if (branchId) {
        const integrations = await storage.getDeliveryIntegrations(
          "",
          undefined,
        );
        integration =
          integrations.find(
            (i: any) =>
              i.platform === "jahez" &&
              i.isActive &&
              (i.vendorId === branchId || i.branchId === branchId),
          ) || null;
      }

      // Strategy 2: Find any active Jahez integration
      if (!integration) {
        const integrations = await storage.getDeliveryIntegrations(
          "",
          undefined,
        );
        integration =
          integrations.find((i: any) => i.platform === "jahez" && i.isActive) ||
          null;
      }

      if (!integration) {
        console.error(
          `[Webhook] Jahez: No active integration found for branch ${branchId}`,
        );
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
      const existing = await storage.getDeliveryOrderByExternalId(
        "jahez",
        String(jahezId),
      );
      if (existing) {
        console.log(`[Webhook] Jahez: Duplicate order ${jahezId}, skipping`);
        return res.status(200).json({ success: true });
      }

      // Try to resolve product names from our DB
      const resolvedItems = await Promise.all(
        parsed.items.map(async (item) => {
          if (item.productId) {
            try {
              const menuItems = await storage.getMenuItems(
                integration!.restaurantId,
              );
              const found = menuItems.find(
                (mi: any) =>
                  mi.id === item.productId || mi.nameEn === item.productId,
              );
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
        }),
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
        messageAr: `طلب جديد JZ-${jahezId} - ${parsed.total} ر.س (${parsed.paymentMethod})`,
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
          await acceptDeliveryOrderFull(
            integration.restaurantId,
            deliveryOrder,
            integration,
          );
          console.log(`[Webhook] Jahez: Order ${jahezId} auto-accepted`);
        } catch (autoErr: any) {
          console.error(`[Webhook] Jahez auto-accept failed:`, autoErr.message);
        }
      }

      console.log(
        `[Webhook] Jahez: Order ${jahezId} created, id=${deliveryOrder.id}`,
      );

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
      console.log(
        "[Webhook] Jahez order update:",
        JSON.stringify(req.body).slice(0, 500),
      );

      const { jahezOrderId, status, payment_method } = req.body;

      if (!jahezOrderId) {
        console.error("[Webhook] Jahez update: No jahezOrderId");
        return res.status(200).json({ success: true });
      }

      const existing = await storage.getDeliveryOrderByExternalId(
        "jahez",
        String(jahezOrderId),
      );
      if (!existing) {
        console.error(
          `[Webhook] Jahez update: Order ${jahezOrderId} not found`,
        );
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
        console.log(
          `[Webhook] Jahez: Order ${jahezOrderId} status update to "${status}" (${newStatus})`,
        );
        if (newStatus !== existing.platformStatus) {
          await storage.updateDeliveryOrderStatus(existing.id, newStatus);
        }
      }

      // Update payment method if changed (e.g., CASH → MADA)
      if (payment_method && payment_method !== "CASH") {
        // Payment method changed — update POS order if exists
        console.log(
          `[Webhook] Jahez: Order ${jahezOrderId} payment changed to ${payment_method}`,
        );
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
          synced: {
            categories: jahezCategories.length,
            products: jahezProducts.length,
          },
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
          const result = await hungerstation.updateProducts(
            integration,
            hsProducts,
          );
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
        return res.status(400).json({
          error: `Menu sync not supported for ${integration.platform}`,
        });
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
          locale: (req.query.locale as string) || "ar_SA",
          page: req.query.page ? parseInt(req.query.page as string) : 1,
          pageSize: req.query.page_size
            ? parseInt(req.query.page_size as string)
            : 50,
          isActive:
            req.query.is_active !== undefined
              ? req.query.is_active === "true"
              : undefined,
        });
        res.json(result);
      } else {
        return res.status(400).json({
          error: "Catalog retrieval only supported for HungerStation",
        });
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
        const result = await hungerstation.getVendorCategories(
          integration,
          onlyLeaves,
        );
        res.json(result);
      } else {
        return res.status(400).json({
          error: "Category retrieval only supported for HungerStation",
        });
      }
    } catch (error: any) {
      handleRouteError(res, error, "Failed to retrieve categories");
    }
  });

  // Export HungerStation product catalog (async, results sent to webhook)
  app.post(
    "/api/delivery/integrations/:id/export-catalog",
    async (req, res) => {
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
          return res
            .status(400)
            .json({ error: "Catalog export only supported for HungerStation" });
        }
      } catch (error: any) {
        handleRouteError(res, error, "Failed to export catalog");
      }
    },
  );

  // Check job status for HungerStation async operations (catalog + promotion)
  app.get("/api/delivery/integrations/:id/jobs/:jobId", async (req, res) => {
    try {
      const restaurantId = await getRestaurantId(req);
      const integration = await storage.getDeliveryIntegration(req.params.id);
      if (!integration || integration.restaurantId !== restaurantId) {
        return res.status(404).json({ error: "Integration not found" });
      }

      if (integration.platform === "hungerstation") {
        const result = await hungerstation.getJobStatus(
          integration,
          req.params.jobId,
        );
        res.json(result);
      } else {
        return res
          .status(400)
          .json({ error: "Job status only supported for HungerStation" });
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
        return res
          .status(400)
          .json({ error: "Promotions only supported for HungerStation" });
      }

      const {
        vendors,
        type,
        active,
        reason,
        display_name,
        limits,
        conditions,
        discount,
      } = req.body;

      if (!vendors || !type || !conditions || !discount) {
        return res.status(400).json({
          error: "Missing required fields: vendors, type, conditions, discount",
        });
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
  app.get(
    "/api/delivery/integrations/:id/promotion/jobs/:jobId",
    async (req, res) => {
      try {
        const restaurantId = await getRestaurantId(req);
        const integration = await storage.getDeliveryIntegration(req.params.id);
        if (!integration || integration.restaurantId !== restaurantId) {
          return res.status(404).json({ error: "Integration not found" });
        }

        if (integration.platform !== "hungerstation") {
          return res.status(400).json({
            error: "Promotion status only supported for HungerStation",
          });
        }

        const result = await hungerstation.getPromotionStatus(
          integration,
          req.params.jobId,
        );
        res.json(result);
      } catch (error: any) {
        handleRouteError(res, error, "Failed to get promotion status");
      }
    },
  );

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

      const integration = await storage.getDeliveryIntegration(
        deliveryOrder.integrationId,
      );
      if (!integration) {
        return res.status(400).json({ error: "Integration not found" });
      }

      if (integration.platform !== "hungerstation") {
        return res
          .status(400)
          .json({ error: "Cart update only supported for HungerStation" });
      }

      const { items } = req.body;
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Items array is required" });
      }

      const result = await hungerstation.updateOrderCart(
        integration,
        deliveryOrder.externalOrderId,
        items,
      );

      res.json({ success: true, result });
    } catch (error: any) {
      handleRouteError(res, error, "Failed to update order cart");
    }
  });

  // Register Jahez webhooks
  app.post(
    "/api/delivery/integrations/:id/register-webhooks",
    async (req, res) => {
      try {
        const restaurantId = await getRestaurantId(req);
        const integration = await storage.getDeliveryIntegration(req.params.id);
        if (!integration || integration.restaurantId !== restaurantId) {
          return res.status(404).json({ error: "Integration not found" });
        }

        if (integration.platform !== "jahez") {
          return res
            .status(400)
            .json({ error: "Webhook registration only for Jahez" });
        }

        const baseUrl =
          req.body.baseUrl || `${req.protocol}://${req.get("host")}`;

        await jahez.registerCreateOrderWebhook(
          integration,
          `${baseUrl}/api/webhooks/jahez`,
        );
        await jahez.registerOrderUpdateWebhook(
          integration,
          `${baseUrl}/api/webhooks/jahez/update`,
        );

        res.json({
          success: true,
          message: "Webhooks registered successfully",
        });
      } catch (error: any) {
        handleRouteError(res, error, "Failed to register Jahez webhooks");
      }
    },
  );

  // Day Sessions - Track daily operations
  app.get("/api/day-sessions", async (req, res) => {
    try {
      const authUser = await getAuthenticatedUser(req);
      const restaurantId = authUser.restaurantId!;
      const isLockedEmployee = ["cashier", "waiter", "kitchen", "delivery"].includes(authUser.role || "");
      const branchId = (isLockedEmployee && authUser.branchId)
        ? authUser.branchId
        : req.query.branch as string | undefined;
      const sessions = await storage.getDaySessions(restaurantId, branchId);
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ error: "Failed to get day sessions" });
    }
  });

  app.get("/api/day-sessions/current", async (req, res) => {
    try {
      const authUser = await getAuthenticatedUser(req);
      const restaurantId = authUser.restaurantId!;
      const isLockedEmployee = ["cashier", "waiter", "kitchen", "delivery"].includes(authUser.role || "");
      const branchId = (isLockedEmployee && authUser.branchId)
        ? authUser.branchId
        : req.query.branch as string | undefined;
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
      const existing = await storage.getCurrentDaySession(
        restaurantId,
        branchId,
      );
      if (existing && existing.status !== "closed") {
        return res.status(409).json({
          error: "A day session is already open today",
          session: existing,
        });
      }

      const session = await storage.openDaySession({
        restaurantId,
        branchId: branchId || undefined,
        date: new Date().toISOString().split("T")[0],
      });

      res.status(201).json(session);
    } catch (error: any) {
      res
        .status(400)
        .json({ error: "Failed to open day session", details: error?.message });
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
      if (session.status !== "closed") {
        const orders = await storage.getOrders(
          restaurantId,
          session.branchId || undefined,
        );
        const today = new Date();
        const todayOnly = new Date(
          today.getFullYear(),
          today.getMonth(),
          today.getDate(),
        );

        for (const order of orders) {
          const orderDate = order.createdAt
            ? new Date(order.createdAt)
            : new Date();
          const orderDateOnly = new Date(
            orderDate.getFullYear(),
            orderDate.getMonth(),
            orderDate.getDate(),
          );

          // Only archive orders from this day session
          if (orderDateOnly.getTime() === todayOnly.getTime()) {
            try {
              // Mark as archived in orders table
              await db
                .update(ordersTable)
                .set({ isArchived: true })
                .where(eq(ordersTable.id, order.id))
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
      res.status(400).json({
        error: "Failed to close day session",
        details: error?.message,
      });
    }
  });

  // Delete restaurant (Platform Admin Only)
  app.delete("/api/restaurants/:restaurantId", async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);

      // Only platform admin can delete restaurants
      if (user.role !== "platform_admin") {
        return res.status(403).json({
          error: "Only platform administrators can delete restaurants",
        });
      }

      const restaurantId = req.params.restaurantId;
      if (!restaurantId) {
        return res.status(400).json({ error: "Restaurant ID required" });
      }

      // Helper function to safely execute delete (ignores table/column not found errors)
      const safeDelete = async (query: any) => {
        try {
          await db.execute(query);
        } catch (err: any) {
          // Ignore "relation does not exist" (42P01) and "column does not exist" (42703) errors
          if (err?.code !== "42P01" && err?.code !== "42703") {
            throw err;
          }
        }
      };

      // Delete restaurant and cascade delete all related data (sequential deletes)
      await safeDelete(
        sql`DELETE FROM order_audit_logs WHERE restaurant_id = ${restaurantId}`,
      );
      await safeDelete(
        sql`DELETE FROM invoice_audit_logs WHERE restaurant_id = ${restaurantId}`,
      );
      await safeDelete(
        sql`DELETE FROM invoices WHERE order_id IN (SELECT id FROM orders WHERE restaurant_id = ${restaurantId})`,
      );
      await safeDelete(
        sql`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE restaurant_id = ${restaurantId})`,
      );
      await safeDelete(
        sql`DELETE FROM order_item_customizations WHERE order_item_id IN (SELECT oi.id FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE o.restaurant_id = ${restaurantId})`,
      );
      await safeDelete(
        sql`DELETE FROM orders WHERE restaurant_id = ${restaurantId}`,
      );
      await safeDelete(
        sql`DELETE FROM recipes WHERE menu_item_id IN (SELECT id FROM menu_items WHERE restaurant_id = ${restaurantId})`,
      );
      await safeDelete(
        sql`DELETE FROM menu_item_customizations WHERE menu_item_id IN (SELECT id FROM menu_items WHERE restaurant_id = ${restaurantId})`,
      );
      await safeDelete(
        sql`DELETE FROM menu_item_variants WHERE menu_item_id IN (SELECT id FROM menu_items WHERE restaurant_id = ${restaurantId})`,
      );
      await safeDelete(
        sql`DELETE FROM menu_items WHERE restaurant_id = ${restaurantId}`,
      );
      await safeDelete(
        sql`DELETE FROM customization_options WHERE group_id IN (SELECT id FROM customization_groups WHERE restaurant_id = ${restaurantId})`,
      );
      await safeDelete(
        sql`DELETE FROM customization_groups WHERE restaurant_id = ${restaurantId}`,
      );
      await safeDelete(
        sql`DELETE FROM categories WHERE restaurant_id = ${restaurantId}`,
      );
      await safeDelete(
        sql`DELETE FROM kitchen_sections WHERE restaurant_id = ${restaurantId}`,
      );
      await safeDelete(
        sql`DELETE FROM tables WHERE restaurant_id = ${restaurantId}`,
      );
      await safeDelete(
        sql`DELETE FROM day_sessions WHERE restaurant_id = ${restaurantId}`,
      );
      await safeDelete(
        sql`DELETE FROM cash_transactions WHERE restaurant_id = ${restaurantId}`,
      );
      await safeDelete(
        sql`DELETE FROM printers WHERE restaurant_id = ${restaurantId}`,
      );
      await safeDelete(
        sql`DELETE FROM inventory_transactions WHERE restaurant_id = ${restaurantId}`,
      );
      await safeDelete(
        sql`DELETE FROM inventory_items WHERE restaurant_id = ${restaurantId}`,
      );
      await safeDelete(
        sql`DELETE FROM promotions WHERE restaurant_id = ${restaurantId}`,
      );
      await safeDelete(
        sql`DELETE FROM coupon_usage WHERE coupon_id IN (SELECT id FROM coupons WHERE restaurant_id = ${restaurantId})`,
      );
      await safeDelete(
        sql`DELETE FROM coupons WHERE restaurant_id = ${restaurantId}`,
      );
      await safeDelete(
        sql`DELETE FROM reviews WHERE restaurant_id = ${restaurantId}`,
      );
      await safeDelete(
        sql`DELETE FROM queue_entries WHERE restaurant_id = ${restaurantId}`,
      );
      await safeDelete(
        sql`DELETE FROM queue_counters WHERE restaurant_id = ${restaurantId}`,
      );
      await safeDelete(
        sql`DELETE FROM customers WHERE restaurant_id = ${restaurantId}`,
      );
      await safeDelete(
        sql`DELETE FROM notifications WHERE restaurant_id = ${restaurantId}`,
      );
      await safeDelete(
        sql`DELETE FROM notification_settings WHERE restaurant_id = ${restaurantId}`,
      );
      await safeDelete(
        sql`DELETE FROM delivery_orders WHERE restaurant_id = ${restaurantId}`,
      );
      await safeDelete(
        sql`DELETE FROM delivery_integrations WHERE restaurant_id = ${restaurantId}`,
      );
      await safeDelete(
        sql`DELETE FROM reservations WHERE branch_id IN (SELECT id FROM branches WHERE restaurant_id = ${restaurantId})`,
      );
      await safeDelete(
        sql`DELETE FROM users WHERE restaurant_id = ${restaurantId} AND role != 'platform_admin'`,
      );
      await safeDelete(
        sql`DELETE FROM branches WHERE restaurant_id = ${restaurantId}`,
      );
      await safeDelete(sql`DELETE FROM restaurants WHERE id = ${restaurantId}`);

      res.json({ success: true, message: "Restaurant deleted" });
    } catch (error: any) {
      console.error("Failed to delete restaurant:", error);
      res.status(500).json({ error: "Failed to delete restaurant" });
    }
  });

  // Generic webhook endpoint for future platforms
  app.post("/api/webhooks/:platform", async (req, res) => {
    console.log(
      `[Webhook] ${req.params.platform} incoming (not yet implemented)`,
    );
    res.status(200).json({ received: true });
  });

  return httpServer;
}

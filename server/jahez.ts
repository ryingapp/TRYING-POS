/**
 * Jahez Delivery Platform Integration
 * Based on official Jahez Partner API documentation
 * 
 * Architecture:
 * - Menu sync (outbound): We push products/categories/branches to Jahez API
 * - Order webhook (inbound): Jahez calls our webhook to create orders
 * - Status update (outbound): We send accept/reject to Jahez API
 * - Order update (inbound): Jahez notifies us of order status changes
 * 
 * Key differences from HungerStation:
 * - No OAuth — uses API key/token auth
 * - We manage the menu on Jahez via API (products, categories, branches)
 * - Orders have jahez_id (integer) as the platform order ID
 * - Status: A (Accepted), R (Rejected) — must respond within 5 minutes
 * - Order statuses: N (New), A (Accepted), O (Out for delivery), D (Delivered), C (Cancelled), R (Rejected), T (Timed-out)
 * - Payment methods: CASH, CREDITCARD, POS, POS-MADA, POS-CREDIT-CARD, APPLE-PAY-MADA, APPLE-PAY-CREDIT-CARD, PAYFORT-CREDIT-CARD
 */

import { storage } from "./storage";
import type { DeliveryIntegration } from "@shared/schema";

/**
 * Jahez order status codes
 */
export const JAHEZ_ORDER_STATUSES: Record<string, { label: string; labelAr: string }> = {
  N: { label: "New", labelAr: "جديد" },
  A: { label: "Accepted", labelAr: "مقبول" },
  O: { label: "Out for delivery", labelAr: "في الطريق" },
  D: { label: "Delivered", labelAr: "تم التوصيل" },
  C: { label: "Cancelled", labelAr: "ملغي" },
  R: { label: "Rejected", labelAr: "مرفوض" },
  T: { label: "Timed-out", labelAr: "انتهت المهلة" },
};

/**
 * Map Jahez status code to our internal platformStatus
 */
export function mapJahezStatus(jahezStatus: string): string {
  const map: Record<string, string> = {
    N: "new",
    A: "accepted",
    O: "picked_up",
    D: "delivered",
    C: "cancelled",
    R: "rejected",
    T: "cancelled",
  };
  return map[jahezStatus] || "new";
}

/**
 * Make an authenticated API call to Jahez
 * Uses the integration's clientId as base URL and clientSecret as auth token
 */
export async function jahezApiCall(
  integration: DeliveryIntegration,
  method: string,
  path: string,
  body?: any
): Promise<any> {
  const baseUrl = integration.clientId; // Jahez API base URL stored in clientId field
  const apiToken = integration.clientSecret; // Jahez auth token stored in clientSecret field

  if (!baseUrl || !apiToken) {
    throw new Error("Missing Jahez API base URL or auth token");
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiToken}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  console.log(`[Jahez] ${method} ${url}`);

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Jahez] API error (${response.status}) ${method} ${path}:`, errorText);
    throw new Error(`Jahez API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

// ==========================================
// MENU SYNC — Push our menu to Jahez
// ==========================================

/**
 * Sync a single product to Jahez
 * POST /products/product
 */
export async function syncProduct(
  integration: DeliveryIntegration,
  product: {
    product_id: string;
    product_price: number;
    category_id: string;
    name: { ar: string; en: string };
    description?: { ar: string; en: string };
    image_path?: string;
    index?: number;
    calories?: number;
    is_visible?: boolean;
    modifiers?: any[];
    exclude_branches?: string[];
  }
): Promise<any> {
  return jahezApiCall(integration, "POST", "/products/product", product);
}

/**
 * Bulk sync products to Jahez
 * POST /products/products_upload
 */
export async function syncProductsBulk(
  integration: DeliveryIntegration,
  products: any[]
): Promise<any> {
  return jahezApiCall(integration, "POST", "/products/products_upload", { products });
}

/**
 * Get product from Jahez
 * GET /products/product?productId={product_id}
 */
export async function getProduct(
  integration: DeliveryIntegration,
  productId: string
): Promise<any> {
  return jahezApiCall(integration, "GET", `/products/product?productId=${encodeURIComponent(productId)}`);
}

/**
 * Delete product from Jahez
 * DELETE /products/product?productId={product_id}
 */
export async function deleteProduct(
  integration: DeliveryIntegration,
  productId: string
): Promise<any> {
  return jahezApiCall(integration, "DELETE", `/products/product?productId=${encodeURIComponent(productId)}`);
}

/**
 * Update product visibility on Jahez
 * DELETE /products/product?productId={product_id} (with body)
 */
export async function updateProductVisibility(
  integration: DeliveryIntegration,
  productId: string,
  isVisible: boolean,
  excludeBranches?: string[]
): Promise<any> {
  return jahezApiCall(integration, "DELETE", `/products/product?productId=${encodeURIComponent(productId)}`, {
    is_visible: isVisible,
    exclude_branches: excludeBranches || [],
  });
}

/**
 * Hide all products on Jahez
 * POST /products/hide_all?branchId={branch_id}
 */
export async function hideAllProducts(
  integration: DeliveryIntegration,
  branchId?: string
): Promise<any> {
  const path = branchId
    ? `/products/hide_all?branchId=${encodeURIComponent(branchId)}`
    : "/products/hide_all";
  return jahezApiCall(integration, "POST", path, {});
}

/**
 * Sync a single category to Jahez
 * POST /categories/category
 */
export async function syncCategory(
  integration: DeliveryIntegration,
  category: {
    category_id: string;
    name: { ar: string; en: string };
    index?: number;
    exclude_branches?: string[];
  }
): Promise<any> {
  return jahezApiCall(integration, "POST", "/categories/category", category);
}

/**
 * Bulk sync categories to Jahez
 * POST /categories/categories_upload
 */
export async function syncCategoriesBulk(
  integration: DeliveryIntegration,
  categories: any[]
): Promise<any> {
  return jahezApiCall(integration, "POST", "/categories/categories_upload", { categories });
}

/**
 * Delete category from Jahez
 * DELETE /categories/category?categoryId={category_id}
 */
export async function deleteCategory(
  integration: DeliveryIntegration,
  categoryId: string
): Promise<any> {
  return jahezApiCall(integration, "DELETE", `/categories/category?categoryId=${encodeURIComponent(categoryId)}`);
}

/**
 * Sync a branch to Jahez
 * POST /branches/branch
 */
export async function syncBranch(
  integration: DeliveryIntegration,
  branch: {
    branch_id: string;
    name: { ar: string; en: string };
    address: string;
    coordination: [number, number]; // [lat, lng]
  }
): Promise<any> {
  return jahezApiCall(integration, "POST", "/branches/branch", branch);
}

/**
 * Update branch visibility on Jahez
 * POST /branches/visibility
 */
export async function updateBranchVisibility(
  integration: DeliveryIntegration,
  branchId: string,
  isVisible: boolean
): Promise<any> {
  return jahezApiCall(integration, "POST", "/branches/visibility", {
    branch_id: branchId,
    is_visible: isVisible,
  });
}

// ==========================================
// WEBHOOK REGISTRATION
// ==========================================

/**
 * Register the create order webhook URL with Jahez
 * POST /webhooks/jahez_create_endpoint
 */
export async function registerCreateOrderWebhook(
  integration: DeliveryIntegration,
  webhookUrl: string
): Promise<any> {
  return jahezApiCall(integration, "POST", "/webhooks/jahez_create_endpoint", {
    url: webhookUrl,
  });
}

/**
 * Register the order update webhook URL with Jahez
 * POST /webhooks/order_update_endpoint
 */
export async function registerOrderUpdateWebhook(
  integration: DeliveryIntegration,
  webhookUrl: string
): Promise<any> {
  return jahezApiCall(integration, "POST", "/webhooks/order_update_endpoint", {
    url: webhookUrl,
  });
}

// ==========================================
// ORDER STATUS — Accept / Reject
// ==========================================

/**
 * Accept or reject an order on Jahez
 * POST /webhooks/status_update
 * 
 * IMPORTANT: Orders exceeding 5 minutes from creation will NOT be accepted
 * Status: "A" (Accepted), "R" (Rejected)
 */
export async function updateOrderStatus(
  integration: DeliveryIntegration,
  jahezOrderId: number,
  status: "A" | "R",
  reason?: string
): Promise<any> {
  const body: any = {
    jahezOrderId,
    status,
  };

  if (status === "R" && reason) {
    body.reason = reason;
  }

  return jahezApiCall(integration, "POST", "/webhooks/status_update", body);
}

// ==========================================
// WEBHOOK PAYLOAD PARSER
// ==========================================

/**
 * Parse a Jahez webhook order creation payload into our delivery order format
 * 
 * Jahez order payload fields:
 * - jahez_id: integer (platform order ID)
 * - branch_id: string (your branch ID)
 * - products[]: { product_id, quantity, original_price, final_price, modifiers[], notes }
 * - final_price: total order price
 * - price: total order price
 * - payment_method: CASH, CREDITCARD, POS, etc.
 * - notes: customer order note
 * - offer: { amount, type } (optional discount)
 */
export function parseJahezOrder(payload: any): {
  jahezOrderId: number;
  branchId: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  subtotal: string;
  deliveryFee: string;
  discount: string;
  total: string;
  paymentMethod: string;
  notes: string;
  items: Array<{
    name: string;
    nameAr?: string;
    quantity: number;
    unitPrice: string;
    totalPrice: string;
    notes?: string;
    productId?: string;
    modifiers?: any[];
  }>;
} {
  const jahezOrderId = payload.jahez_id;
  const branchId = payload.branch_id || "";
  const paymentMethod = payload.payment_method || "CASH";
  const notes = payload.notes || "";

  // Calculate discount from offer
  const offerAmount = payload.offer?.amount || 0;

  // Parse products
  const items = (payload.products || []).map((product: any) => {
    // Build modifier description
    const modifiers = (product.modifiers || []).map((mod: any) => ({
      modifier_id: mod.modifier_id,
      options: (mod.options || []).map((opt: any) => ({
        id: opt.id,
        quantity: opt.quantity || 1,
        price: opt.final_price || opt.original_price || 0,
      })),
    }));

    return {
      name: product.product_id, // We'll map product_id to actual name from our DB later
      quantity: product.quantity || 1,
      unitPrice: String(product.original_price || 0),
      totalPrice: String(product.final_price || 0),
      notes: product.notes || "",
      productId: product.product_id,
      modifiers,
    };
  });

  return {
    jahezOrderId,
    branchId,
    customerName: "", // Jahez doesn't send customer name in order webhook
    customerPhone: "", // Jahez doesn't send customer phone in order webhook
    deliveryAddress: "", // Jahez handles delivery — no address shared
    subtotal: String(payload.price || payload.final_price || 0),
    deliveryFee: "0", // Delivery fee handled by Jahez
    discount: String(offerAmount),
    total: String(payload.final_price || payload.price || 0),
    paymentMethod,
    notes,
    items,
  };
}

/**
 * Validate incoming Jahez webhook request
 */
export function validateJahezWebhook(
  authHeader: string | undefined,
  integration: DeliveryIntegration
): boolean {
  if (!integration.webhookSecret) return true; // No secret = skip validation
  if (!authHeader) return false;
  
  // Check Bearer token match
  if (authHeader.startsWith("Bearer ")) {
    return authHeader === `Bearer ${integration.webhookSecret}`;
  }
  
  // Direct match
  return authHeader === integration.webhookSecret;
}

/**
 * Map Jahez payment method to our payment method
 */
export function mapJahezPaymentMethod(jahezMethod: string): string {
  const map: Record<string, string> = {
    CASH: "cash",
    CREDITCARD: "card",
    POS: "card",
    "POS-MADA": "card",
    "POS-CREDIT-CARD": "card",
    "APPLE-PAY-MADA": "card",
    "APPLE-PAY-CREDIT-CARD": "card",
    "PAYFORT-CREDIT-CARD": "card",
    MADA: "card",
  };
  return map[jahezMethod] || "card";
}

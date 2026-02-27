/**
 * HungerStation Partner API Integration (Partner Picking + Catalog)
 * Based on official documentation: https://developer.hungerstation.com/en/documentation/pos-partner-picking-overview
 * OpenAPI spec v2.0.2 from Hungerstation Partner API
 * 
 * Key concepts from docs:
 * - OAuth token: POST /v2/oauth/token (expires in 2 hours)
 * - Orders: PUT /v2/chains/{chain_id}/orders/{order_id}
 * - GET orders: GET /v2/chains/{chain_id}/orders/{order_id}
 *   or GET /v2/chains/{chain_id}/vendors/{vendor_id}/orders?start_time=&end_time=
 * - Order statuses: RECEIVED → READY_FOR_PICKUP → DISPATCHED → DELIVERED (or CANCELLED)
 * - No "accept" concept — partner processes RECEIVED order and sends READY_FOR_PICKUP or DISPATCHED
 * - Cancel reasons: CLOSED, ITEM_UNAVAILABLE, TOO_BUSY
 * - Item statuses: IN_CART, NOT_FOUND, NOT_PROCESSED, REPLACED, ADDITION
 * - Webhook receives full order payload with status field (not event-based wrapping)
 * - Webhook auth: Secret or Basic auth in Authorization header
 * - Rate limit: max 60 requests per minute
 * 
 * Catalog API:
 * - POST /v2/chains/{chain_id}/catalog — Add Products (BETA, async, returns job_id)
 * - GET /v2/chains/{chain_id}/catalog/jobs/{job_id} — Product Addition Status
 * - GET /v2/chains/{chain_id}/vendors/{vendor_id}/catalog — Retrieve Products (paginated)
 * - PUT /v2/chains/{chain_id}/vendors/{vendor_id}/catalog — Update Products (async, sku+active/price/quantity)
 * - POST /v2/chains/{chain_id}/vendors/{vendor_id}/catalog/export — Export Product Catalog (async)
 * - GET /v2/chains/{chain_id}/vendors/{vendor_id}/categories — Vendor Categories
 * 
 * Promotion API:
 * - PUT /v2/chains/{chain_id}/promotion — Manage Promotion (create/update, async)
 * - GET /v2/chains/{chain_id}/promotion/jobs/{job_id} — Promotion Status
 * 
 * Outlet Management API:
 * - GET /v2/chains/{chain_id}/vendors/{vendor_id}/status — Get Outlet Status
 * - PUT /v2/chains/{chain_id}/vendors/{vendor_id}/status — Manage Outlet (OPEN/CLOSED_TODAY/CLOSED_UNTIL/CHECKIN)
 *   Statuses: OPEN, CLOSED_TODAY, CLOSED_UNTIL, CHECKIN
 *   Close reasons: TOO_BUSY_NO_DRIVERS, TOO_BUSY_KITCHEN, UPDATES_IN_MENU, TECHNICAL_PROBLEM, CLOSED, OTHER, BAD_WEATHER, HOLIDAY_SPECIAL_DAY
 */

import { storage } from "./storage";
import type { DeliveryIntegration } from "@shared/schema";

const HS_BASE_URL = "https://hungerstation.partner.deliveryhero.io";

// Valid cancellation reasons per API docs
export const VALID_CANCEL_REASONS = ["CLOSED", "ITEM_UNAVAILABLE", "TOO_BUSY"] as const;
export type CancelReason = typeof VALID_CANCEL_REASONS[number];

// Valid outlet statuses per API docs
export const VALID_OUTLET_STATUSES = ["OPEN", "CLOSED_TODAY", "CLOSED_UNTIL", "CHECKIN"] as const;
export type OutletStatus = typeof VALID_OUTLET_STATUSES[number];

// Valid closure reasons per API docs
export const VALID_CLOSE_REASONS = [
  "TOO_BUSY_NO_DRIVERS", "TOO_BUSY_KITCHEN", "UPDATES_IN_MENU",
  "TECHNICAL_PROBLEM", "CLOSED", "OTHER", "BAD_WEATHER", "HOLIDAY_SPECIAL_DAY"
] as const;
export type CloseReason = typeof VALID_CLOSE_REASONS[number];

// Promotion types per API docs
export const VALID_PROMO_TYPES = ["STRIKETHROUGH", "SAME_ITEM_BUNDLE"] as const;
export type PromoType = typeof VALID_PROMO_TYPES[number];

// Promotion reasons per API docs
export const VALID_PROMO_REASONS = [
  "OVERSTOCK", "DELISTING", "COMPETITIVENESS", "EXPIRING_SOON", "NMR", "TRADING"
] as const;
export type PromoReason = typeof VALID_PROMO_REASONS[number];

// In-memory token cache to avoid DB reads on every API call
const tokenCache = new Map<string, { token: string; expiresAt: Date }>();

/**
 * Get a valid access token for a HungerStation integration
 * Handles caching and automatic refresh
 */
export async function getAccessToken(integration: DeliveryIntegration): Promise<string> {
  // Check in-memory cache first
  const cached = tokenCache.get(integration.id);
  if (cached && cached.expiresAt > new Date(Date.now() + 60000)) { // 1 min buffer
    return cached.token;
  }

  // Check DB cache
  if (integration.accessToken && integration.tokenExpiresAt) {
    const expiresAt = new Date(integration.tokenExpiresAt);
    if (expiresAt > new Date(Date.now() + 60000)) {
      tokenCache.set(integration.id, { token: integration.accessToken, expiresAt });
      return integration.accessToken;
    }
  }

  // Token expired or doesn't exist — refresh
  return refreshToken(integration);
}

/**
 * Request a new OAuth access token from HungerStation
 * Docs: POST https://hungerstation.partner.deliveryhero.io/v2/oauth/token
 * Token is valid for 2 hours
 */
async function refreshToken(integration: DeliveryIntegration): Promise<string> {
  if (!integration.clientId || !integration.clientSecret) {
    throw new Error("Missing HungerStation client credentials");
  }

  const response = await fetch(`${HS_BASE_URL}/v2/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: integration.clientId,
      client_secret: integration.clientSecret,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[HungerStation] OAuth token error (${response.status}):`, errorText);
    throw new Error(`HungerStation OAuth failed: ${response.status}`);
  }

  const data = await response.json() as { access_token: string; expires_in: number; token_type: string };
  const expiresAt = new Date(Date.now() + (data.expires_in - 60) * 1000); // 60s buffer

  // Save to DB
  await storage.updateDeliveryIntegration(integration.id, {
    accessToken: data.access_token,
    tokenExpiresAt: expiresAt,
  } as any);

  // Save to memory cache
  tokenCache.set(integration.id, { token: data.access_token, expiresAt });

  console.log(`[HungerStation] Token refreshed for integration ${integration.id}, expires at ${expiresAt.toISOString()}`);
  return data.access_token;
}

/**
 * Make an authenticated API call to HungerStation
 * Auth: Bearer token in Authorization header
 */
export async function hsApiCall(
  integration: DeliveryIntegration,
  method: string,
  path: string,
  body?: any
): Promise<any> {
  const token = await getAccessToken(integration);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  const response = await fetch(`${HS_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[HungerStation] API error (${response.status}) ${method} ${path}:`, errorText);
    throw new Error(`HungerStation API error: ${response.status} - ${errorText}`);
  }

  // Some endpoints return 204 No Content
  if (response.status === 204) return null;

  return response.json();
}

/**
 * Get outlet (vendor) status from HungerStation
 * Endpoint: GET /v2/chains/{chain_id}/vendors/{vendor_id}/status
 * 
 * Response statuses: OPEN, CLOSED_TODAY, CLOSED_UNTIL, CLOSED
 */
export async function getOutletStatus(
  integration: DeliveryIntegration
): Promise<{
  vendor_id: string;
  status: string;
  closed_reason?: string;
  closed_until?: string;
  checkin_interval?: { start_time: string; end_time: string };
}> {
  if (!integration.chainId || !integration.vendorId) {
    throw new Error("Missing chain_id or vendor_id for outlet status check");
  }

  return hsApiCall(
    integration,
    "GET",
    `/v2/chains/${integration.chainId}/vendors/${integration.vendorId}/status`
  );
}

/**
 * Update outlet (vendor) status on HungerStation
 * Endpoint: PUT /v2/chains/{chain_id}/vendors/{vendor_id}/status
 * 
 * Valid statuses:
 * - OPEN: open the vendor (must be within opening hours)
 * - CLOSED_TODAY: close till end of day
 * - CLOSED_UNTIL: close till specific datetime (requires closed_until)
 * - CHECKIN: acknowledge check-in (only if feature enabled)
 * 
 * Close reasons: TOO_BUSY_NO_DRIVERS, TOO_BUSY_KITCHEN, UPDATES_IN_MENU,
 *   TECHNICAL_PROBLEM, CLOSED, OTHER, BAD_WEATHER, HOLIDAY_SPECIAL_DAY
 */
export async function updateOutletStatus(
  integration: DeliveryIntegration,
  status: string,
  closedReason?: string,
  closedUntil?: string
): Promise<{
  vendor_id: string;
  status: string;
  closed_reason?: string;
  closed_until?: string;
}> {
  if (!integration.chainId || !integration.vendorId) {
    throw new Error("Missing chain_id or vendor_id for outlet status update");
  }

  // Map simple open/closed to proper API values for backward compatibility
  let apiStatus = status;
  if (status === "open") apiStatus = "OPEN";
  else if (status === "closed") apiStatus = "CLOSED_TODAY";

  const body: any = { status: apiStatus };
  if (closedReason && apiStatus !== "OPEN") body.closed_reason = closedReason;
  if (closedUntil && apiStatus === "CLOSED_UNTIL") body.closed_until = closedUntil;

  const result = await hsApiCall(
    integration,
    "PUT",
    `/v2/chains/${integration.chainId}/vendors/${integration.vendorId}/status`,
    body
  );

  // Store normalized status locally
  const localStatus = apiStatus === "OPEN" ? "open" : "closed";
  await storage.updateDeliveryIntegration(integration.id, {
    outletStatus: localStatus,
    lastSyncAt: new Date(),
  } as any);

  console.log(`[HungerStation] Outlet ${integration.vendorId} set to ${apiStatus}`);
  return result;
}

/**
 * Fulfill an order — mark as READY_FOR_PICKUP (Platform Delivery) or DISPATCHED (Vendor Delivery)
 * Docs: PUT /v2/chains/{chain_id}/orders/{order_id}
 * 
 * NOTE: HungerStation has NO "accept" concept. When you receive an order (RECEIVED),
 * you process it and send READY_FOR_PICKUP or DISPATCHED to fulfill.
 * 
 * The items array with statuses is required in the body.
 */
export async function fulfillOrder(
  integration: DeliveryIntegration,
  externalOrderId: string,
  items: Array<{ sku: string; status: string; pricing: any; _id?: string }>,
  deliveryFlow: "platform" | "vendor" = "platform"
): Promise<any> {
  if (!integration.chainId) {
    throw new Error("Missing chain_id");
  }

  const status = deliveryFlow === "vendor" ? "DISPATCHED" : "READY_FOR_PICKUP";

  return hsApiCall(
    integration,
    "PUT",
    `/v2/chains/${integration.chainId}/orders/${externalOrderId}`,
    {
      order_id: externalOrderId,
      items,
      status,
    }
  );
}

/**
 * Mark an order as READY_FOR_PICKUP on HungerStation (Platform Delivery flow)
 * Docs: PUT /v2/chains/{chain_id}/orders/{order_id}
 * 
 * This is the fulfillment action for Platform Delivery flow.
 * Must include all items with their statuses.
 */
export async function markOrderReady(
  integration: DeliveryIntegration,
  externalOrderId: string,
  rawPayload?: any
): Promise<any> {
  if (!integration.chainId) {
    throw new Error("Missing chain_id");
  }

  // Build items array from raw payload if available
  const items = buildItemsForFulfillment(rawPayload);

  return hsApiCall(
    integration,
    "PUT",
    `/v2/chains/${integration.chainId}/orders/${externalOrderId}`,
    {
      order_id: externalOrderId,
      items,
      status: "READY_FOR_PICKUP",
    }
  );
}

/**
 * Cancel an order on HungerStation
 * Docs: PUT /v2/chains/{chain_id}/orders/{order_id}
 * 
 * Valid cancellation reasons: CLOSED, ITEM_UNAVAILABLE, TOO_BUSY
 * All items must have status NOT_FOUND when cancelling
 */
export async function cancelOrder(
  integration: DeliveryIntegration,
  externalOrderId: string,
  reason: CancelReason = "TOO_BUSY",
  rawPayload?: any
): Promise<any> {
  if (!integration.chainId) {
    throw new Error("Missing chain_id");
  }

  // Build items array — all items must be NOT_FOUND for cancellation
  const items = buildItemsForCancellation(rawPayload);

  return hsApiCall(
    integration,
    "PUT",
    `/v2/chains/${integration.chainId}/orders/${externalOrderId}`,
    {
      order_id: externalOrderId,
      items,
      cancellation: {
        reason,
        cancelled_by: "VENDOR",
      },
      status: "CANCELLED",
    }
  );
}

/**
 * Get order details from HungerStation
 * Docs: GET /v2/chains/{chain_id}/orders/{order_id}
 * order_id must be UUID format. Only orders from last 60 days.
 */
export async function getOrderDetails(
  integration: DeliveryIntegration,
  externalOrderId: string
): Promise<any> {
  if (!integration.chainId) {
    throw new Error("Missing chain_id");
  }

  return hsApiCall(
    integration,
    "GET",
    `/v2/chains/${integration.chainId}/orders/${externalOrderId}`
  );
}

/**
 * Get orders history for a vendor
 * Docs: GET /v2/chains/{chain_id}/vendors/{vendor_id}/orders?start_time=&end_time=&page_size=&page=
 * Only orders from last 60 days. Times in UTC.
 */
export async function getVendorOrders(
  integration: DeliveryIntegration,
  startTime: string,
  endTime: string,
  pageSize: number = 20,
  page: number = 1
): Promise<any> {
  if (!integration.chainId || !integration.vendorId) {
    throw new Error("Missing chain_id or vendor_id");
  }

  const params = new URLSearchParams({
    start_time: startTime,
    end_time: endTime,
    page_size: String(pageSize),
    page: String(page),
  });

  return hsApiCall(
    integration,
    "GET",
    `/v2/chains/${integration.chainId}/vendors/${integration.vendorId}/orders?${params.toString()}`
  );
}

/**
 * Clear token cache for an integration (e.g., when credentials change)
 */
export function clearTokenCache(integrationId: string): void {
  tokenCache.delete(integrationId);
}

/**
 * Build items array for fulfillment (READY_FOR_PICKUP / DISPATCHED)
 * All items get IN_CART status
 */
function buildItemsForFulfillment(rawPayload?: any): any[] {
  if (!rawPayload) return [];
  
  const orderItems = rawPayload?.items || [];
  return orderItems.map((item: any) => ({
    _id: item._id,
    sku: item.sku,
    pricing: item.pricing || item.original_pricing,
    status: "IN_CART",
  }));
}

/**
 * Build items array for cancellation
 * All items get NOT_FOUND status
 */
function buildItemsForCancellation(rawPayload?: any): any[] {
  if (!rawPayload) return [];
  
  const orderItems = rawPayload?.items || [];
  return orderItems.map((item: any) => ({
    _id: item._id,
    sku: item.sku,
    pricing: item.pricing || item.original_pricing,
    status: "NOT_FOUND",
  }));
}

/**
 * Validate webhook authorization
 * HungerStation sends the webhook secret as Authorization header
 * Supports plain string or Basic auth
 */
export function validateWebhookAuth(authHeader: string | undefined, integration: DeliveryIntegration): boolean {
  if (!integration.webhookSecret) return true; // No secret configured = skip validation
  if (!authHeader) return false;

  // Direct match (plain string secret)
  if (authHeader === integration.webhookSecret) return true;
  
  // Basic auth match
  if (authHeader.startsWith("Basic ") && integration.webhookSecret.startsWith("Basic ")) {
    return authHeader === integration.webhookSecret;
  }

  return false;
}

/**
 * Parse a HungerStation webhook order payload into our delivery order format
 * 
 * Webhook payload fields per official docs:
 * - order_id: UUID (used for API calls)
 * - external_order_id: platform visible ID (for reconciliation)
 * - order_code: short incremental code (used by riders)
 * - client: { id, chain_id, name, country_code, store_id, external_partner_config_id }
 * - customer: { _id, first_name, last_name, phone_number, delivery_address: { latitude, longitude, street, city, country } }
 * - items[]: { _id, sku, name, pricing: { pricing_type, unit_price, quantity, total_price, weight, min_quantity, max_quantity }, status }
 * - payment: { sub_total, order_total, delivery_fee, service_fee, difference_to_minimum }
 * - transport_type: "LOGISTICS_DELIVERY" | etc
 * - order_type: "DELIVERY"
 * - status: "RECEIVED" | "READY_FOR_PICKUP" | "DISPATCHED" | "CANCELLED" | "DELIVERED"
 */
export function parseHungerStationOrder(payload: any): {
  externalOrderId: string;
  orderCode: string;
  transportType: string;
  storeId: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryLat: string;
  deliveryLng: string;
  subtotal: string;
  deliveryFee: string;
  discount: string;
  total: string;
  items: Array<{ name: string; nameAr?: string; quantity: number; unitPrice: string; totalPrice: string; notes?: string; sku?: string }>;
  estimatedDeliveryTime: Date | null;
  orderType: string; // DELIVERY or PICKUP
  isPreorder: boolean;
  promotionStatus: string | null; // AVAILABLE or UNAVAILABLE
  promisedFor: Date | null;
  acceptedFor: Date | null;
} {
  // Webhook sends the order payload directly (no wrapping)
  const order = payload;

  // Parse items from the documented structure
  const items = (order.items || []).map((item: any) => {
    const pricing = item.pricing || {};
    return {
      name: item.name || "Unknown Item",
      nameAr: item.name_ar,
      quantity: pricing.pricing_type === "KG" ? (pricing.weight || 1) : (pricing.quantity || 1),
      unitPrice: String(pricing.unit_price || 0),
      totalPrice: String(pricing.total_price || (pricing.unit_price || 0) * (pricing.quantity || 1)),
      notes: item.instructions || "",
      sku: item.sku,
    };
  });

  // Customer info from documented structure
  const customer = order.customer || {};
  const deliveryAddress = customer.delivery_address || {};
  const payment = order.payment || {};
  const client = order.client || {};

  return {
    // order_id is the UUID used for API calls
    externalOrderId: String(order.order_id || ""),
    orderCode: String(order.order_code || order.external_order_id || ""),
    transportType: order.transport_type || "LOGISTICS_DELIVERY",
    storeId: client.store_id || client.external_partner_config_id || "",
    customerName: [customer.first_name, customer.last_name].filter(Boolean).join(" ") || "",
    customerPhone: customer.phone_number || "",
    deliveryAddress: [deliveryAddress.street, deliveryAddress.city, deliveryAddress.country].filter(Boolean).join(", ") || "",
    deliveryLat: String(deliveryAddress.latitude || ""),
    deliveryLng: String(deliveryAddress.longitude || ""),
    subtotal: String(payment.sub_total || 0),
    deliveryFee: String(payment.delivery_fee || 0),
    discount: String(payment.discount || 0),
    total: String(payment.order_total || 0),
    items,
    estimatedDeliveryTime: order.estimated_delivery_time
      ? new Date(order.estimated_delivery_time)
      : null,
    // Additional webhook fields
    orderType: order.order_type || "DELIVERY", // DELIVERY or PICKUP
    isPreorder: order.isPreorder || false,
    promotionStatus: order.promotion_status || null, // AVAILABLE or UNAVAILABLE
    promisedFor: order.promised_for ? new Date(order.promised_for) : null,
    acceptedFor: order.accepted_for ? new Date(order.accepted_for) : null,
  };
}

// ============================================
// ORDER MANAGEMENT — UPDATE_CART
// ============================================

/**
 * Update order cart (item modifications)
 * PUT /v2/chains/{chain_id}/orders/{order_id} with status = UPDATE_CART
 * 
 * This allows modifying order items (quantities, replacements, additions, removals)
 * Can be called multiple times. Item statuses:
 * - IN_CART: item is confirmed
 * - NOT_FOUND: item not available
 * - REPLACED: item is being replaced (set replaced_id to the replacement item)
 * - ADDITION: new item added to the order
 */
export async function updateOrderCart(
  integration: DeliveryIntegration,
  externalOrderId: string,
  items: Array<{
    _id?: string;
    sku?: string;
    status: "IN_CART" | "NOT_FOUND" | "REPLACED" | "ADDITION";
    pricing: {
      pricing_type: "UNIT" | "KG";
      quantity: number;
      unit_price: number;
      weight?: number;
    };
    replaced_id?: string;
  }>
): Promise<any> {
  if (!integration.chainId) {
    throw new Error("Missing chain_id");
  }

  return hsApiCall(
    integration,
    "PUT",
    `/v2/chains/${integration.chainId}/orders/${externalOrderId}`,
    {
      order_id: externalOrderId,
      items,
      status: "UPDATE_CART",
    }
  );
}

// ============================================
// CATALOG API — Product Management
// ============================================

/**
 * Update products on HungerStation (price, active status, quantity)
 * PUT /v2/chains/{chain_id}/vendors/{vendor_id}/catalog
 * 
 * Async endpoint — returns 202 with job_id.
 * sku is required, plus at least one of: price, active, quantity
 * 
 * Product activation logic:
 * - active=false → Inactive (regardless of quantity)
 * - active=true + quantity > sales_buffer → Active
 * - active=true + quantity <= sales_buffer → Inactive
 */
export async function updateProducts(
  integration: DeliveryIntegration,
  products: Array<{
    sku: string;
    active?: boolean;
    price?: number;
    quantity?: number;
    barcode?: string;
    maximum_sales_quantity?: number;
  }>
): Promise<{ job_id: string; job_status: string }> {
  if (!integration.chainId || !integration.vendorId) {
    throw new Error("Missing chain_id or vendor_id for catalog update");
  }

  return hsApiCall(
    integration,
    "PUT",
    `/v2/chains/${integration.chainId}/vendors/${integration.vendorId}/catalog`,
    { products }
  );
}

/**
 * Update a single product's active status on HungerStation
 * Convenience wrapper around updateProducts for availability toggling
 */
export async function updateProductAvailability(
  integration: DeliveryIntegration,
  sku: string,
  isActive: boolean
): Promise<{ job_id: string; job_status: string }> {
  return updateProducts(integration, [{ sku, active: isActive }]);
}

/**
 * Update a single product's price on HungerStation
 */
export async function updateProductPrice(
  integration: DeliveryIntegration,
  sku: string,
  price: number,
  active?: boolean
): Promise<{ job_id: string; job_status: string }> {
  const product: any = { sku, price };
  if (active !== undefined) product.active = active;
  return updateProducts(integration, [product]);
}

/**
 * Retrieve products from HungerStation catalog
 * GET /v2/chains/{chain_id}/vendors/{vendor_id}/catalog
 * 
 * Supports pagination, search, category filtering, and active status filter
 */
export async function getProducts(
  integration: DeliveryIntegration,
  options?: {
    queryTerm?: string;
    locale?: string;
    page?: number;
    pageSize?: number;
    categoryIds?: string;
    isActive?: boolean;
  }
): Promise<{
  page_number: number;
  total_pages: number;
  page_size: number;
  products: any[];
}> {
  if (!integration.chainId || !integration.vendorId) {
    throw new Error("Missing chain_id or vendor_id");
  }

  const params = new URLSearchParams();
  if (options?.queryTerm) params.set("query_term", options.queryTerm);
  if (options?.locale) params.set("locale", options.locale);
  if (options?.page) params.set("page", String(options.page));
  if (options?.pageSize) params.set("page_size", String(options.pageSize));
  if (options?.categoryIds) params.set("category_global_ids", options.categoryIds);
  if (options?.isActive !== undefined) params.set("is_active", String(options.isActive));

  const queryString = params.toString();
  const path = `/v2/chains/${integration.chainId}/vendors/${integration.vendorId}/catalog${queryString ? `?${queryString}` : ""}`;

  return hsApiCall(integration, "GET", path);
}

/**
 * Add products to HungerStation catalog (BETA)
 * POST /v2/chains/{chain_id}/catalog
 * 
 * Async endpoint — returns 202 with job_id.
 * NOTE: This is a BETA feature, contact account manager to enable.
 */
export async function addProducts(
  integration: DeliveryIntegration,
  vendors: string[],
  products: any[]
): Promise<{ job_id: string; job_status: string; duplicated_products?: string[] }> {
  if (!integration.chainId) {
    throw new Error("Missing chain_id");
  }

  return hsApiCall(
    integration,
    "POST",
    `/v2/chains/${integration.chainId}/catalog`,
    { vendors, products }
  );
}

/**
 * Check product addition job status
 * GET /v2/chains/{chain_id}/catalog/jobs/{job_id}
 */
export async function getJobStatus(
  integration: DeliveryIntegration,
  jobId: string
): Promise<{ job_id: string; job_status: string; result?: any }> {
  if (!integration.chainId) {
    throw new Error("Missing chain_id");
  }

  return hsApiCall(
    integration,
    "GET",
    `/v2/chains/${integration.chainId}/catalog/jobs/${jobId}`
  );
}

/**
 * Export product catalog for a vendor
 * POST /v2/chains/{chain_id}/vendors/{vendor_id}/catalog/export
 * 
 * Async — initiates export job. Results sent to webhook in Partner Portal.
 */
export async function exportProducts(
  integration: DeliveryIntegration
): Promise<{ job_id: string; job_status: string }> {
  if (!integration.chainId || !integration.vendorId) {
    throw new Error("Missing chain_id or vendor_id");
  }

  return hsApiCall(
    integration,
    "POST",
    `/v2/chains/${integration.chainId}/vendors/${integration.vendorId}/catalog/export`
  );
}

/**
 * Retrieve vendor categories from HungerStation
 * GET /v2/chains/{chain_id}/vendors/{vendor_id}/categories
 * 
 * @param onlyLeaves - If true, returns only leaf categories (no parent categories). Default: true
 */
export async function getVendorCategories(
  integration: DeliveryIntegration,
  onlyLeaves: boolean = true
): Promise<{ categories: any[] }> {
  if (!integration.chainId || !integration.vendorId) {
    throw new Error("Missing chain_id or vendor_id");
  }

  return hsApiCall(
    integration,
    "GET",
    `/v2/chains/${integration.chainId}/vendors/${integration.vendorId}/categories?only_leaves=${onlyLeaves}`
  );
}

// ============================================
// PROMOTION API
// ============================================

/**
 * Create or update a promotion on HungerStation
 * PUT /v2/chains/{chain_id}/promotion
 * 
 * Upsert based on unique combo of: name + vendors + condition.start_time + condition.end_time
 * 
 * Types:
 * - STRIKETHROUGH: price strike-through discount
 * - SAME_ITEM_BUNDLE: buy X get Y at discount (WIP by HungerStation)
 * 
 * Discount subtypes:
 * - PERCENTAGE: percentage off (1-100)
 * - ABSOLUTE: fixed amount off
 * - FINAL_PRICE: set final price
 * 
 * Returns 202 with job_id (async)
 */
export async function managePromotion(
  integration: DeliveryIntegration,
  promotion: {
    vendors: string[];
    type: string; // STRIKETHROUGH | SAME_ITEM_BUNDLE
    active?: boolean;
    reason?: string; // OVERSTOCK | DELISTING | COMPETITIVENESS | EXPIRING_SOON | NMR | TRADING
    display_name?: Record<string, string>; // locale → name, e.g. {"en_GB": "Sale", "ar_SA": "عرض"}
    limits?: {
      max_discount_per_order?: number;
      max_items_per_order?: number;
    };
    conditions: {
      start_time: string; // ISO 8601
      end_time: string; // ISO 8601
      purchased_quantity?: number; // For SAME_ITEM_BUNDLE
      discounted_quantity?: number; // For SAME_ITEM_BUNDLE
    };
    discount: Array<{
      sku: string[];
      discount_subtype?: string; // PERCENTAGE | ABSOLUTE | FINAL_PRICE
      discount_value?: number;
      active?: boolean; // true = add SKUs, false = remove SKUs
      max_quantity?: number;
    }>;
  }
): Promise<{ job_id: string; job_status: string }> {
  if (!integration.chainId) {
    throw new Error("Missing chain_id for promotion management");
  }

  return hsApiCall(
    integration,
    "PUT",
    `/v2/chains/${integration.chainId}/promotion`,
    promotion
  );
}

/**
 * Get promotion job status from HungerStation
 * GET /v2/chains/{chain_id}/promotion/jobs/{job_id}
 * 
 * Statuses: QUEUED, COMPLETED, FAILED, DUPLICATE
 */
export async function getPromotionStatus(
  integration: DeliveryIntegration,
  jobId: string
): Promise<{
  job_id: string;
  job_status: string;
  created_at?: string;
  updated_at?: string;
  result?: {
    invalid_vendors?: string[];
    missing_skus?: Record<string, string[]>;
    invalid_discounted_skus?: Record<string, string[]>;
  };
}> {
  if (!integration.chainId) {
    throw new Error("Missing chain_id");
  }

  return hsApiCall(
    integration,
    "GET",
    `/v2/chains/${integration.chainId}/promotion/jobs/${jobId}`
  );
}

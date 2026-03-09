/**
 * EdfaPay Payment Gateway Integration
 * API Docs: https://sandbox.edfapay.com/pgapi/EdfapayCheckout_Developer-API.html
 * 
 * Endpoints:
 * - Initiate (SALE):    POST https://api.edfapay.com/payment/initiate
 * - Status:             POST https://api.edfapay.com/payment/status
 * - Refund:             POST https://api.edfapay.com/payment/refund
 * - Recurring:          POST https://api.edfapay.com/payment/recurring
 * - Apple Pay S2S SALE: POST https://api.edfapay.com/payment/initiate  (with apple_pay_token)
 */

import crypto from "crypto";
import https from "https";

// Use sandbox for testing, production for live
const EDFAPAY_BASE_URL = process.env.EDFAPAY_BASE_URL || "https://api.edfapay.com";

// ==========================================
// Hash / Signature Utilities
// ==========================================

/**
 * Initiate Signature:
 * sha1(md5(UPPERCASE(order_id + order_amount + order_currency + order_description + PASSWORD)))
 */
export function generateInitiateHash(
  orderId: string,
  orderAmount: string,
  orderCurrency: string,
  orderDescription: string,
  password: string
): string {
  const raw = `${orderId}${orderAmount}${orderCurrency}${orderDescription}${password}`;
  const md5Hash = crypto.createHash("md5").update(raw.toUpperCase()).digest("hex");
  const sha1Hash = crypto.createHash("sha1").update(md5Hash).digest("hex");
  return sha1Hash;
}

/**
 * Refund Signature:
 * sha1(md5(UPPERCASE(payment_id + amount + PASSWORD)))
 */
export function generateRefundHash(
  paymentId: string,
  amount: string,
  password: string
): string {
  const raw = `${paymentId}${amount}${password}`;
  const md5Hash = crypto.createHash("md5").update(raw.toUpperCase()).digest("hex");
  const sha1Hash = crypto.createHash("sha1").update(md5Hash).digest("hex");
  return sha1Hash;
}

/**
 * Status Signature:
 * sha1(md5(UPPERCASE(payment_id + PASSWORD)))
 */
export function generateStatusHash(
  paymentId: string,
  password: string
): string {
  const raw = `${paymentId}${password}`;
  const md5Hash = crypto.createHash("md5").update(raw.toUpperCase()).digest("hex");
  const sha1Hash = crypto.createHash("sha1").update(md5Hash).digest("hex");
  return sha1Hash;
}

/**
 * Callback hash verification:
 * sha1(md5(UPPERCASE(payment_public_id + order.number + order.amount + order.currency + order.description + merchant.pass)))
 */
export function generateCallbackHash(
  paymentPublicId: string,
  orderNumber: string,
  orderAmount: string,
  orderCurrency: string,
  orderDescription: string,
  password: string
): string {
  const raw = `${paymentPublicId}${orderNumber}${orderAmount}${orderCurrency}${orderDescription}${password}`;
  const md5Hash = crypto.createHash("md5").update(raw.toUpperCase()).digest("hex");
  const sha1Hash = crypto.createHash("sha1").update(md5Hash).digest("hex");
  return sha1Hash;
}

// ==========================================
// Request Interfaces
// ==========================================

export interface EdfaPayInitiateRequest {
  action: "SALE" | "AUTH";
  edfa_merchant_id: string;
  order_id: string;
  order_amount: string;      // Format: XX.XX
  order_currency: string;     // 3-letter code, e.g. "SAR"
  order_description: string;  // Up to 1024 chars
  req_token?: "Y" | "N";
  payer_first_name: string;
  payer_last_name: string;
  payer_middle_name?: string;
  payer_birth_date?: string;
  payer_address: string;
  payer_address2?: string;
  payer_country: string;      // 2-letter code
  payer_state?: string;
  payer_city: string;
  payer_zip: string;
  payer_email: string;
  payer_phone: string;
  payer_ip: string;
  term_url_3ds: string;
  recurring_init?: "Y" | "N";
  auth?: "Y" | "N";
  hash: string;
  card_token?: string;
}

export interface EdfaPayInitiateResponse {
  action: string;
  result: "SUCCESS" | "DECLINED" | "REDIRECT" | "ACCEPTED" | "ERROR";
  status: string;
  order_id: string;
  trans_id: string;
  trans_date?: string;
  descriptor?: string;
  amount?: string;
  currency?: string;
  redirect_url?: string;
  redirect_params?: Record<string, string>;
  redirect_method?: "POST" | "GET";
  error_message?: string;
  error_code?: string;
  // On success:
  recurring_token?: string;
  card_token?: string;
  card?: string;
}

export interface EdfaPayRefundRequest {
  edfapay_merchant_id: string;
  gwayId: string;      // Public transaction ID
  trans_id: string;     // Transaction ID in Payment Platform
  order_id: string;
  hash: string;
  payer_ip: string;
  amount: string;       // XX.XX format
}

export interface EdfaPayRefundResponse {
  action: string;
  result: "SUCCESS" | "DECLINED" | "ERROR";
  status: string;
  order_id: string;
  trans_id: string;
  amount?: string;
  error_message?: string;
  error_code?: string;
}

export interface EdfaPayStatusRequest {
  merchant_id: string;
  gway_Payment_Id: string;
  order_id: string;
  hash: string;
}

export interface EdfaPayStatusResponse {
  action: string;
  result: string;
  status: string;      // 3DS, REDIRECT, SETTLED, REFUND, DECLINED, PENDING
  order_id: string;
  trans_id: string;
  trans_date?: string;
  amount?: string;
  currency?: string;
  error_message?: string;
}

// Callback from EdfaPay (sent as form-data POST)
export interface EdfaPayCallback {
  action: string;       // SALE, REFUND
  result: string;       // SUCCESS, DECLINED, REDIRECT
  status: string;       // SETTLED, DECLINED, PENDING, REFUND, 3DS, REDIRECT
  order_id: string;
  trans_id: string;
  trans_date?: string;
  descriptor?: string;
  amount?: string;
  currency?: string;
  hash?: string;
  card?: string;
  card_expiration_date?: string;
  decline_reason?: string;
  recurring_token?: string;
  card_token?: string;
  redirect_url?: string;
  redirect_method?: string;
  redirect_params?: string;
}

// Apple Pay callback format
export interface EdfaPayApplePayCallback {
  id: string;
  order_number: string;
  order_amount: string;
  order_currency: string;
  order_description: string;
  hash: string;
  type: "sale" | "refund";
  status: "success" | "fail";
}

// ==========================================
// API Functions
// ==========================================

/**
 * Initiate a SALE transaction.
 * EdfaPay requires form-data for initiate requests.
 */
export async function initiateSale(params: {
  merchantId: string;
  password: string;
  orderId: string;
  amount: string;        // e.g. "125.50"
  currency?: string;     // default "SAR"
  description: string;
  payerFirstName: string;
  payerLastName: string;
  payerEmail: string;
  payerPhone: string;
  payerAddress?: string;
  payerCity?: string;
  payerCountry?: string;
  payerZip?: string;
  payerIp: string;
  callbackUrl: string;   // term_url_3ds - where customer returns after 3DS
  notificationUrl?: string; // Server-to-server webhook URL
  recurringInit?: boolean;  // Initialize recurring token
}): Promise<EdfaPayInitiateResponse> {
  const currency = params.currency || "SAR";
  const description = params.description.substring(0, 1024);
  
  const hash = generateInitiateHash(
    params.orderId,
    params.amount,
    currency,
    description,
    params.password
  );

  const formData = new URLSearchParams();
  formData.append("action", "SALE");
  formData.append("edfa_merchant_id", params.merchantId);
  formData.append("order_id", params.orderId);
  formData.append("order_amount", params.amount);
  formData.append("order_currency", currency);
  formData.append("order_description", description);
  formData.append("payer_first_name", params.payerFirstName || "Customer");
  formData.append("payer_last_name", params.payerLastName || "Guest");
  formData.append("payer_address", params.payerAddress || "Saudi Arabia");
  formData.append("payer_country", params.payerCountry || "SA");
  formData.append("payer_city", params.payerCity || "Riyadh");
  formData.append("payer_zip", params.payerZip || "12345");
  formData.append("payer_email", params.payerEmail || "customer@example.com");
  formData.append("payer_phone", params.payerPhone || "0500000000");
  formData.append("payer_ip", params.payerIp);
  formData.append("term_url_3ds", params.callbackUrl);
  if (params.notificationUrl) {
    formData.append("notification_url", params.notificationUrl);
  }
  if (params.recurringInit) {
    formData.append("recurring_init", "Y");
    formData.append("req_token", "Y");
  }
  formData.append("auth", "N");
  formData.append("hash", hash);

  // Debug logging - capture exact request data
  const formDataObj: Record<string, string> = {};
  formData.forEach((value, key) => {
    formDataObj[key] = key === 'hash' ? value.substring(0, 10) + '...' : value;
  });
  console.log('[EdfaPay] initiateSale request data:', JSON.stringify(formDataObj));

  const url = `${EDFAPAY_BASE_URL}/payment/initiate`;
  
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  const body = await res.text();
  console.log('[EdfaPay] initiateSale raw response:', body.substring(0, 1000));
  let parsed: any;
  try {
    parsed = JSON.parse(body);
  } catch {
    // Sometimes response isn't JSON
    throw new Error(`EdfaPay API error: Invalid response format: ${body.substring(0, 500)}`);
  }

  if (parsed.result === "ERROR") {
    // Include specific field validation errors if available
    const fieldErrors = parsed.errors?.map((e: any) => e.error_message).join('; ') || '';
    throw new Error(`EdfaPay API error (${parsed.error_code}): ${parsed.error_message}${fieldErrors ? ' [' + fieldErrors + ']' : ''}`);
  }

  return parsed as EdfaPayInitiateResponse;
}

/**
 * Check transaction status
 */
export async function getTransactionStatus(params: {
  merchantId: string;
  password: string;
  gwayPaymentId: string;
  orderId: string;
}): Promise<EdfaPayStatusResponse> {
  const hash = generateStatusHash(params.gwayPaymentId, params.password);

  const body = JSON.stringify({
    merchant_id: params.merchantId,
    gway_Payment_Id: params.gwayPaymentId,
    order_id: params.orderId,
    hash,
  });

  const url = `${EDFAPAY_BASE_URL}/payment/status`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  const text = await res.text();
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`EdfaPay status error: Invalid response: ${text.substring(0, 500)}`);
  }

  return parsed as EdfaPayStatusResponse;
}

/**
 * Refund a transaction (full or partial)
 */
export async function refundTransaction(params: {
  merchantId: string;
  password: string;
  gwayId: string;       // Public transaction ID
  transId: string;      // Transaction ID in EdfaPay
  orderId: string;
  amount: string;       // Amount to refund in XX.XX
  payerIp: string;
}): Promise<EdfaPayRefundResponse> {
  const hash = generateRefundHash(params.gwayId, params.amount, params.password);

  const body = JSON.stringify({
    edfapay_merchant_id: params.merchantId,
    gwayId: params.gwayId,
    trans_id: params.transId,
    order_id: params.orderId,
    hash,
    payer_ip: params.payerIp,
    amount: params.amount,
  });

  const url = `${EDFAPAY_BASE_URL}/payment/refund`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });

  const text = await res.text();
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`EdfaPay refund error: Invalid response: ${text.substring(0, 500)}`);
  }

  if (parsed.result === "ERROR") {
    throw new Error(`EdfaPay refund error (${parsed.error_code}): ${parsed.error_message}`);
  }

  return parsed as EdfaPayRefundResponse;
}

/**
 * Recurring Hash:
 * sha1(md5(UPPERCASE(recurring_token + order_id + order_amount + order_currency + order_description + PASSWORD)))
 */
export function generateRecurringHash(
  recurringToken: string,
  orderId: string,
  orderAmount: string,
  orderCurrency: string,
  orderDescription: string,
  password: string
): string {
  const raw = `${recurringToken}${orderId}${orderAmount}${orderCurrency}${orderDescription}${password}`;
  const md5Hash = crypto.createHash("md5").update(raw.toUpperCase()).digest("hex");
  const sha1Hash = crypto.createHash("sha1").update(md5Hash).digest("hex");
  return sha1Hash;
}

/**
 * Charge a recurring payment using a saved card token.
 * POST /payment/recurring
 */
export async function recurringPayment(params: {
  merchantId: string;
  password: string;
  recurringToken: string;
  orderId: string;
  amount: string;
  currency?: string;
  description: string;
  payerEmail: string;
  payerIp: string;
  notificationUrl?: string;
}): Promise<EdfaPayInitiateResponse> {
  const currency = params.currency || "SAR";
  const description = params.description.substring(0, 1024);

  const hash = generateRecurringHash(
    params.recurringToken,
    params.orderId,
    params.amount,
    currency,
    description,
    params.password
  );

  const formData = new URLSearchParams();
  formData.append("action", "SALE");
  formData.append("auth", "N");
  formData.append("edfa_merchant_id", params.merchantId);
  formData.append("order_id", params.orderId);
  formData.append("order_amount", params.amount);
  formData.append("order_currency", currency);
  formData.append("order_description", description);
  formData.append("recurring_token", params.recurringToken);
  formData.append("payer_email", params.payerEmail);
  formData.append("payer_ip", params.payerIp);
  formData.append("hash", hash);
  if (params.notificationUrl) {
    formData.append("notification_url", params.notificationUrl);
  }

  const url = `${EDFAPAY_BASE_URL}/payment/recurring`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  const body = await res.text();
  let parsed: any;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error(`EdfaPay recurring error: Invalid response format: ${body.substring(0, 500)}`);
  }

  if (parsed.result === "ERROR") {
    throw new Error(`EdfaPay recurring error (${parsed.error_code}): ${parsed.error_message}`);
  }

  return parsed as EdfaPayInitiateResponse;
}

/**
 * Verify callback hash from EdfaPay
 */
export function verifyCallbackHash(
  callback: EdfaPayCallback,
  password: string
): boolean {
  if (!callback.hash) return false;
  
  const expectedHash = generateCallbackHash(
    callback.trans_id,
    callback.order_id,
    callback.amount || "",
    callback.currency || "SAR",
    "", // description not always in callback
    password
  );
  
  return expectedHash === callback.hash;
}

/**
 * Check if EdfaPay credentials are configured for a restaurant
 */
export function hasCredentials(merchantId?: string | null, password?: string | null): boolean {
  return !!(merchantId && password);
}

/**
 * EdfaPay transaction status mapping
 */
export function isSuccessfulPayment(status: string): boolean {
  return status === "SETTLED" || status === "PENDING";
}

export function isFailedPayment(result: string, status: string): boolean {
  return result === "DECLINED" || status === "DECLINED";
}

export function needsRedirect(result: string): boolean {
  return result === "REDIRECT";
}

// ==========================================
// Apple Pay S2S Integration
// ==========================================

/**
 * Apple Pay S2S configuration — loaded from environment variables.
 * These are platform-level (one Apple Developer account for TryingPOS).
 *
 * Required env vars:
 *   APPLE_PAY_MERCHANT_ID      – e.g. "merchant.com.tryingpos"
 *   APPLE_PAY_DISPLAY_NAME     – e.g. "TryingPOS"
 *   APPLE_PAY_MERCHANT_CERT    – PEM certificate content (or base64-encoded)
 *   APPLE_PAY_MERCHANT_KEY     – Private key content (or base64-encoded)
 *   APPLE_PAY_DOMAIN           – "tryingpos.com"
 */

export interface ApplePayConfig {
  merchantId: string;
  displayName: string;
  domain: string;
  certPem: string;   // Merchant Identity Certificate PEM
  keyPem: string;    // Merchant Identity Certificate private key
}

/**
 * Load Apple Pay configuration from env, returns null if not configured.
 */
export function getApplePayConfig(): ApplePayConfig | null {
  const merchantId = process.env.APPLE_PAY_MERCHANT_ID;
  const displayName = process.env.APPLE_PAY_DISPLAY_NAME || "TryingPOS";
  const domain = process.env.APPLE_PAY_DOMAIN || "tryingpos.com";
  const certPem = process.env.APPLE_PAY_MERCHANT_CERT;
  const keyPem = process.env.APPLE_PAY_MERCHANT_KEY;

  if (!merchantId || !certPem || !keyPem) return null;

  // Handle base64-encoded certs (single-line env vars)
  const decodeCert = (val: string) =>
    val.includes("-----BEGIN") ? val : Buffer.from(val, "base64").toString("utf-8");

  return {
    merchantId,
    displayName,
    domain,
    certPem: decodeCert(certPem),
    keyPem: decodeCert(keyPem),
  };
}

/**
 * Check if Apple Pay S2S is configured
 */
export function hasApplePayConfig(): boolean {
  return getApplePayConfig() !== null;
}

/**
 * Validate merchant session with Apple Pay servers.
 * Called during onvalidatemerchant event from Apple Pay JS.
 *
 * @param validationURL – URL received in onvalidatemerchant event
 * @returns Apple Pay session object to pass to completeMerchantValidation()
 */
export async function validateApplePaySession(validationURL: string): Promise<any> {
  const config = getApplePayConfig();
  if (!config) throw new Error("Apple Pay not configured");

  const body = JSON.stringify({
    merchantIdentifier: config.merchantId,
    displayName: config.displayName,
    initiative: "web",
    initiativeContext: config.domain,
  });

  // Apple requires mutual TLS with the Merchant Identity Certificate
  return new Promise((resolve, reject) => {
    const url = new URL(validationURL);
    const options: https.RequestOptions = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname,
      method: "POST",
      cert: config.certPem,
      key: config.keyPem,
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`Apple Pay validation failed (${res.statusCode}): ${data}`));
          } else {
            resolve(parsed);
          }
        } catch {
          reject(new Error(`Apple Pay validation response parse error: ${data.substring(0, 500)}`));
        }
      });
    });

    req.on("error", (err) => reject(new Error(`Apple Pay validation request failed: ${err.message}`)));
    req.write(body);
    req.end();
  });
}

/**
 * Apple Pay S2S Sale – send the Apple Pay payment token to EdfaPay.
 *
 * Flow: Frontend captures Apple Pay token → sends to our backend →
 * we POST to EdfaPay with the token in parameters/source field.
 *
 * The hash is the same initiate hash formula:
 *   sha1(md5(UPPERCASE(order_id + amount + currency + description + PASSWORD)))
 */
export async function applePaySale(params: {
  merchantId: string;        // EdfaPay merchant/client_key
  password: string;          // EdfaPay password
  orderId: string;
  amount: string;            // "125.50"
  currency?: string;
  description: string;
  payerFirstName: string;
  payerLastName: string;
  payerEmail: string;
  payerPhone: string;
  payerAddress?: string;
  payerCity?: string;
  payerCountry?: string;
  payerZip?: string;
  payerIp: string;
  callbackUrl: string;       // term_url_3ds
  notificationUrl?: string;
  applePayToken: string;     // JSON-stringified Apple Pay payment token
}): Promise<EdfaPayInitiateResponse> {
  const currency = params.currency || "SAR";
  const description = params.description.substring(0, 1024);

  const hash = generateInitiateHash(
    params.orderId,
    params.amount,
    currency,
    description,
    params.password
  );

  const formData = new URLSearchParams();
  formData.append("action", "SALE");
  formData.append("auth", "N");
  formData.append("edfa_merchant_id", params.merchantId);
  formData.append("order_id", params.orderId);
  formData.append("order_amount", params.amount);
  formData.append("order_currency", currency);
  formData.append("order_description", description);
  formData.append("payer_first_name", params.payerFirstName || "Customer");
  formData.append("payer_last_name", params.payerLastName || "Guest");
  formData.append("payer_address", params.payerAddress || "Saudi Arabia");
  formData.append("payer_country", params.payerCountry || "SA");
  formData.append("payer_city", params.payerCity || "Riyadh");
  formData.append("payer_zip", params.payerZip || "12345");
  formData.append("payer_email", params.payerEmail || "customer@example.com");
  formData.append("payer_phone", params.payerPhone || "0500000000");
  formData.append("payer_ip", params.payerIp);
  formData.append("term_url_3ds", params.callbackUrl);
  if (params.notificationUrl) {
    formData.append("notification_url", params.notificationUrl);
  }
  // Apple Pay token – EdfaPay S2S expects this in the "parameters" field
  formData.append("parameters", params.applePayToken);
  formData.append("hash", hash);

  const url = `${EDFAPAY_BASE_URL}/payment/initiate`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData.toString(),
  });

  const resBody = await res.text();
  let parsed: any;
  try {
    parsed = JSON.parse(resBody);
  } catch {
    throw new Error(`EdfaPay Apple Pay API error: Invalid response: ${resBody.substring(0, 500)}`);
  }

  if (parsed.result === "ERROR") {
    throw new Error(`EdfaPay Apple Pay error (${parsed.error_code}): ${parsed.error_message}`);
  }

  return parsed as EdfaPayInitiateResponse;
}

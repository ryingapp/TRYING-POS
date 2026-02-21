const MOYASAR_PLATFORM_BASE = "https://apimig.moyasar.com/v1";

function getAuthHeader(): string {
  const key = process.env.MOYASAR_PLATFORM_KEY;
  const secret = process.env.MOYASAR_PLATFORM_SECRET;
  if (!key || !secret) {
    throw new Error("MOYASAR_PLATFORM_KEY and MOYASAR_PLATFORM_SECRET are required");
  }
  return "Basic " + Buffer.from(`${key}:${secret}`).toString("base64");
}

async function platformFetch(path: string, options: RequestInit = {}): Promise<any> {
  const url = `${MOYASAR_PLATFORM_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": getAuthHeader(),
      ...options.headers,
    },
  });

  const body = await res.text();
  let parsed: any;
  try {
    parsed = JSON.parse(body);
  } catch {
    parsed = body;
  }

  if (!res.ok) {
    const errorMsg = typeof parsed === "object" ? JSON.stringify(parsed) : parsed;
    throw new Error(`Moyasar API error (${res.status}): ${errorMsg}`);
  }

  return parsed;
}

export interface MoyasarCreateMerchantPayload {
  type: string;
  name: string;
  public_name: string;
  country: string;
  time_zone: string;
  website: string;
  email: string;
  admin_email: string;
  owners_count: number;
  signatory: string;
  signatory_count?: number;
  activity_license_required: boolean;
  enabled_schemes: string[];
  statement_descriptor?: string;
  fees: {
    tax_inclusive: boolean;
    mada_charge_rate: number;
    mada_charge_fixed: number;
    mada_refund_rate: number;
    mada_refund_fixed: number;
    cc_charge_rate: number;
    cc_charge_fixed: number;
    cc_refund_rate: number;
    cc_refund_fixed: number;
  };
}

export interface MoyasarMerchantResponse {
  id: string;
  entity_id: string;
  type: string;
  name: string;
  public_name: string;
  country: string;
  time_zone: string;
  website: string;
  email: string;
  admin_email: string;
  owners_count: number;
  signatory: string;
  signatory_count: number;
  activity_license_required: boolean;
  enabled_schemes: string[];
  status: string;
  reasons: string[];
  api_keys: {
    live: {
      publishable_key: string;
      secret_key: string;
    };
    test: {
      publishable_key: string;
      secret_key: string;
    };
  };
  signature: {
    status: string;
    url: string | null;
  };
  required_documents: string[];
  fees: any;
  created_at: string;
  updated_at: string;
}

export interface MoyasarDocumentPayload {
  type: string;
  info: Record<string, any>;
  file?: string;
}

export async function createMerchant(payload: MoyasarCreateMerchantPayload): Promise<MoyasarMerchantResponse> {
  return platformFetch("/merchants", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getMerchant(merchantId: string): Promise<MoyasarMerchantResponse> {
  return platformFetch(`/merchants/${merchantId}`);
}

export async function updateMerchant(merchantId: string, payload: Partial<MoyasarCreateMerchantPayload>): Promise<MoyasarMerchantResponse> {
  return platformFetch(`/merchants/${merchantId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function uploadDocument(merchantId: string, payload: MoyasarDocumentPayload): Promise<any> {
  return platformFetch(`/merchants/${merchantId}/documents`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function deleteDocument(merchantId: string, documentId: string): Promise<any> {
  return platformFetch(`/merchants/${merchantId}/documents/${documentId}`, {
    method: "DELETE",
  });
}

export async function submitForReview(merchantId: string): Promise<MoyasarMerchantResponse> {
  return platformFetch(`/merchants/${merchantId}/review`, {
    method: "POST",
  });
}

export function hasPlatformCredentials(): boolean {
  return !!(process.env.MOYASAR_PLATFORM_KEY && process.env.MOYASAR_PLATFORM_SECRET);
}

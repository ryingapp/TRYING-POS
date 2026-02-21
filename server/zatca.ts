/**
 * ZATCA E-Invoice XML Generator (UBL 2.1)
 * Generates ZATCA-compliant XML for Saudi Arabia e-invoicing
 * Supports: Simplified Tax Invoice (B2C), Standard Tax Invoice (B2B)
 * References: ZATCA E-Invoice Phase 2 Technical Requirements
 */
import crypto from 'crypto';

// ===========================================
// Types & Interfaces
// ===========================================
export interface ZatcaInvoiceData {
  uuid: string;
  invoiceNumber: string;
  invoiceType: 'simplified' | 'standard' | 'credit_note' | 'debit_note';
  issueDate: string; // YYYY-MM-DD
  issueTime: string; // HH:mm:ss
  deliveryDate?: string;
  // Seller
  seller: {
    nameAr: string;
    nameEn?: string;
    vatNumber: string;
    commercialRegistration?: string;
    streetName?: string;
    buildingNumber?: string;
    district?: string;
    city?: string;
    postalCode?: string;
    country: string;
  };
  // Buyer (for standard invoices)
  buyer?: {
    name?: string;
    vatNumber?: string;
    streetName?: string;
    buildingNumber?: string;
    district?: string;
    city?: string;
    postalCode?: string;
    country?: string;
  };
  // Items
  items: ZatcaLineItem[];
  // Totals
  subtotal: number;
  discount: number;
  deliveryFee: number;
  taxAmount: number;
  taxRate: number;
  total: number;
  // Payment
  paymentMethod?: string;
  // Hash chain
  previousInvoiceHash: string;
  invoiceCounter: number;
  // Related invoice (for credit/debit notes)
  relatedInvoiceNumber?: string;
  relatedInvoiceIssueDate?: string;
}

export interface ZatcaLineItem {
  id: string;
  nameAr: string;
  nameEn?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  totalWithTax: number;
  totalWithoutTax: number;
}

// ===========================================
// Invoice Type Codes (ZATCA)
// ===========================================
const INVOICE_TYPE_CODES: Record<string, string> = {
  'simplified': '0200000', // Simplified Tax Invoice (B2C)
  'standard': '0100000',   // Standard Tax Invoice (B2B)
  'credit_note': '0200000', // Credit Note
  'debit_note': '0200000',  // Debit Note
};

const INVOICE_TYPE_NAME: Record<string, string> = {
  'simplified': '388',  // Invoice
  'standard': '388',    // Invoice
  'credit_note': '381', // Credit Note
  'debit_note': '383',  // Debit Note
};

// Payment method mapping to ZATCA codes
const PAYMENT_CODES: Record<string, string> = {
  'cash': '10',
  'card': '48',
  'mada': '48',
  'stc_pay': '48',
  'apple_pay': '48',
  'bank_transfer': '42',
  'tap_to_pay': '48',
  'split': '1', // Instrument not defined
};

// ===========================================
// XML Generator
// ===========================================
export function generateZatcaXml(data: ZatcaInvoiceData): string {
  const invoiceTypeCode = INVOICE_TYPE_NAME[data.invoiceType] || '388';
  const subTypeCode = INVOICE_TYPE_CODES[data.invoiceType] || '0200000';
  const paymentCode = PAYMENT_CODES[data.paymentMethod || 'cash'] || '10';

  const isCredit = data.invoiceType === 'credit_note';
  const isDebit = data.invoiceType === 'debit_note';

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"
         xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
  <cbc:ID>${escapeXml(data.invoiceNumber)}</cbc:ID>
  <cbc:UUID>${data.uuid}</cbc:UUID>
  <cbc:IssueDate>${data.issueDate}</cbc:IssueDate>
  <cbc:IssueTime>${data.issueTime}</cbc:IssueTime>
  <cbc:InvoiceTypeCode name="${subTypeCode}">${invoiceTypeCode}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>
  <cbc:TaxCurrencyCode>SAR</cbc:TaxCurrencyCode>`;

  // Billing reference (for credit/debit notes)
  if ((isCredit || isDebit) && data.relatedInvoiceNumber) {
    xml += `
  <cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>${escapeXml(data.relatedInvoiceNumber)}</cbc:ID>
      ${data.relatedInvoiceIssueDate ? `<cbc:IssueDate>${data.relatedInvoiceIssueDate}</cbc:IssueDate>` : ''}
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>`;
  }

  // Additional Document Reference - Invoice Counter Value (ICV)
  xml += `
  <cac:AdditionalDocumentReference>
    <cbc:ID>ICV</cbc:ID>
    <cbc:UUID>${data.invoiceCounter}</cbc:UUID>
  </cac:AdditionalDocumentReference>`;

  // Additional Document Reference - Previous Invoice Hash (PIH)
  xml += `
  <cac:AdditionalDocumentReference>
    <cbc:ID>PIH</cbc:ID>
    <cac:Attachment>
      <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${data.previousInvoiceHash}</cbc:EmbeddedDocumentBinaryObject>
    </cac:Attachment>
  </cac:AdditionalDocumentReference>`;

  // Signature (placeholder - will be filled by signing process)
  xml += `
  <cac:Signature>
    <cbc:ID>urn:oasis:names:specification:ubl:signature:Invoice</cbc:ID>
    <cbc:SignatureMethod>urn:oasis:names:specification:ubl:dsig:enveloped:xades</cbc:SignatureMethod>
  </cac:Signature>`;

  // Supplier (Seller) Party
  xml += `
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyIdentification>
        <cbc:ID schemeID="CRN">${escapeXml(data.seller.commercialRegistration || '')}</cbc:ID>
      </cac:PartyIdentification>
      <cac:PostalAddress>
        <cbc:StreetName>${escapeXml(data.seller.streetName || '')}</cbc:StreetName>
        <cbc:BuildingNumber>${escapeXml(data.seller.buildingNumber || '')}</cbc:BuildingNumber>
        <cbc:CitySubdivisionName>${escapeXml(data.seller.district || '')}</cbc:CitySubdivisionName>
        <cbc:CityName>${escapeXml(data.seller.city || '')}</cbc:CityName>
        <cbc:PostalZone>${escapeXml(data.seller.postalCode || '')}</cbc:PostalZone>
        <cac:Country>
          <cbc:IdentificationCode>${escapeXml(data.seller.country)}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${escapeXml(data.seller.vatNumber)}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(data.seller.nameAr)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>`;

  // Customer (Buyer) Party
  xml += `
  <cac:AccountingCustomerParty>
    <cac:Party>`;

  if (data.buyer?.vatNumber) {
    xml += `
      <cac:PartyIdentification>
        <cbc:ID schemeID="VAT">${escapeXml(data.buyer.vatNumber)}</cbc:ID>
      </cac:PartyIdentification>`;
  }

  if (data.buyer?.streetName || data.buyer?.city) {
    xml += `
      <cac:PostalAddress>
        <cbc:StreetName>${escapeXml(data.buyer.streetName || '')}</cbc:StreetName>
        ${data.buyer.buildingNumber ? `<cbc:BuildingNumber>${escapeXml(data.buyer.buildingNumber)}</cbc:BuildingNumber>` : ''}
        ${data.buyer.district ? `<cbc:CitySubdivisionName>${escapeXml(data.buyer.district)}</cbc:CitySubdivisionName>` : ''}
        <cbc:CityName>${escapeXml(data.buyer.city || '')}</cbc:CityName>
        ${data.buyer.postalCode ? `<cbc:PostalZone>${escapeXml(data.buyer.postalCode)}</cbc:PostalZone>` : ''}
        <cac:Country>
          <cbc:IdentificationCode>${escapeXml(data.buyer.country || 'SA')}</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>`;
  }

  if (data.buyer?.vatNumber) {
    xml += `
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${escapeXml(data.buyer.vatNumber)}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>`;
  }

  if (data.buyer?.name) {
    xml += `
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(data.buyer.name)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>`;
  }

  xml += `
    </cac:Party>
  </cac:AccountingCustomerParty>`;

  // Delivery date
  if (data.deliveryDate) {
    xml += `
  <cac:Delivery>
    <cbc:ActualDeliveryDate>${data.deliveryDate}</cbc:ActualDeliveryDate>
  </cac:Delivery>`;
  }

  // Payment means
  xml += `
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>${paymentCode}</cbc:PaymentMeansCode>
  </cac:PaymentMeans>`;

  // Document-level discount (if any)
  if (data.discount > 0) {
    xml += `
  <cac:AllowanceCharge>
    <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
    <cbc:AllowanceChargeReason>Discount</cbc:AllowanceChargeReason>
    <cbc:Amount currencyID="SAR">${data.discount.toFixed(2)}</cbc:Amount>
    <cac:TaxCategory>
      <cbc:ID>S</cbc:ID>
      <cbc:Percent>${data.taxRate.toFixed(2)}</cbc:Percent>
      <cac:TaxScheme>
        <cbc:ID>VAT</cbc:ID>
      </cac:TaxScheme>
    </cac:TaxCategory>
  </cac:AllowanceCharge>`;
  }

  // Delivery fee as charge (if any)
  if (data.deliveryFee > 0) {
    xml += `
  <cac:AllowanceCharge>
    <cbc:ChargeIndicator>true</cbc:ChargeIndicator>
    <cbc:AllowanceChargeReason>Delivery Fee</cbc:AllowanceChargeReason>
    <cbc:Amount currencyID="SAR">${data.deliveryFee.toFixed(2)}</cbc:Amount>
    <cac:TaxCategory>
      <cbc:ID>S</cbc:ID>
      <cbc:Percent>${data.taxRate.toFixed(2)}</cbc:Percent>
      <cac:TaxScheme>
        <cbc:ID>VAT</cbc:ID>
      </cac:TaxScheme>
    </cac:TaxCategory>
  </cac:AllowanceCharge>`;
  }

  // Tax total
  xml += `
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="SAR">${data.taxAmount.toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="SAR">${(data.subtotal - data.discount).toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="SAR">${data.taxAmount.toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>${data.taxRate > 0 ? 'S' : 'Z'}</cbc:ID>
        <cbc:Percent>${data.taxRate.toFixed(2)}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="SAR">${data.taxAmount.toFixed(2)}</cbc:TaxAmount>
  </cac:TaxTotal>`;

  // Legal monetary total
  const lineExtensionAmount = data.subtotal;
  const taxExclusiveAmount = data.subtotal - data.discount + data.deliveryFee;
  const taxInclusiveAmount = data.total;
  const prepaidAmount = 0;
  const payableAmount = data.total;

  xml += `
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="SAR">${lineExtensionAmount.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="SAR">${taxExclusiveAmount.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="SAR">${taxInclusiveAmount.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:AllowanceTotalAmount currencyID="SAR">${data.discount.toFixed(2)}</cbc:AllowanceTotalAmount>
    <cbc:ChargeTotalAmount currencyID="SAR">${data.deliveryFee.toFixed(2)}</cbc:ChargeTotalAmount>
    <cbc:PrepaidAmount currencyID="SAR">${prepaidAmount.toFixed(2)}</cbc:PrepaidAmount>
    <cbc:PayableAmount currencyID="SAR">${payableAmount.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>`;

  // Invoice lines
  data.items.forEach((item, index) => {
    xml += `
  <cac:InvoiceLine>
    <cbc:ID>${index + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="PCE">${item.quantity}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="SAR">${item.totalWithoutTax.toFixed(2)}</cbc:LineExtensionAmount>
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="SAR">${item.taxAmount.toFixed(2)}</cbc:TaxAmount>
      <cbc:RoundingAmount currencyID="SAR">${item.totalWithTax.toFixed(2)}</cbc:RoundingAmount>
    </cac:TaxTotal>
    <cac:Item>
      <cbc:Name>${escapeXml(item.nameAr || item.nameEn || 'Item')}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>${item.taxRate > 0 ? 'S' : 'Z'}</cbc:ID>
        <cbc:Percent>${item.taxRate.toFixed(2)}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="SAR">${item.unitPrice.toFixed(2)}</cbc:PriceAmount>
    </cac:Price>`;

    if (item.discount > 0) {
      xml += `
    <cac:AllowanceCharge>
      <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
      <cbc:AllowanceChargeReason>Discount</cbc:AllowanceChargeReason>
      <cbc:Amount currencyID="SAR">${item.discount.toFixed(2)}</cbc:Amount>
    </cac:AllowanceCharge>`;
    }

    xml += `
  </cac:InvoiceLine>`;
  });

  xml += `
</Invoice>`;

  return xml;
}

// ===========================================
// QR Code TLV Encoder (Phase 1 & 2)
// ===========================================
export function generateZatcaTlvQrCode(data: {
  sellerName: string;
  vatNumber: string;
  timestamp: string;
  total: string;
  vatAmount: string;
  // Phase 2 additional fields
  invoiceHash?: string;
  digitalSignature?: string;
  publicKey?: string;
  csidStamp?: string;
}): string {
  const tlvEncode = (tag: number, value: string | Buffer): Buffer => {
    const valueBuffer = typeof value === 'string' ? Buffer.from(value, 'utf8') : value;
    // For lengths > 127, use multi-byte length
    if (valueBuffer.length > 127) {
      const lenBuf = Buffer.alloc(3);
      lenBuf[0] = 0x82;
      lenBuf.writeUInt16BE(valueBuffer.length, 1);
      return Buffer.concat([Buffer.from([tag]), lenBuf, valueBuffer]);
    }
    return Buffer.concat([
      Buffer.from([tag]),
      Buffer.from([valueBuffer.length]),
      valueBuffer,
    ]);
  };

  const parts: Buffer[] = [
    tlvEncode(1, data.sellerName),
    tlvEncode(2, data.vatNumber),
    tlvEncode(3, data.timestamp),
    tlvEncode(4, data.total),
    tlvEncode(5, data.vatAmount),
  ];

  // Phase 2 additional tags
  if (data.invoiceHash) {
    parts.push(tlvEncode(6, Buffer.from(data.invoiceHash, 'hex')));
  }
  if (data.digitalSignature) {
    parts.push(tlvEncode(7, Buffer.from(data.digitalSignature, 'base64')));
  }
  if (data.publicKey) {
    parts.push(tlvEncode(8, Buffer.from(data.publicKey, 'base64')));
  }
  if (data.csidStamp) {
    parts.push(tlvEncode(9, Buffer.from(data.csidStamp, 'base64')));
  }

  return Buffer.concat(parts).toString('base64');
}

// ===========================================
// Invoice Hash Generator (SHA-256)
// ===========================================
export function computeInvoiceHash(xmlContent: string): string {
  return crypto.createHash('sha256').update(xmlContent, 'utf8').digest('hex');
}

export function computeInvoiceHashBase64(xmlContent: string): string {
  return crypto.createHash('sha256').update(xmlContent, 'utf8').digest('base64');
}

// ===========================================
// UUID Generator
// ===========================================
export function generateInvoiceUuid(): string {
  return crypto.randomUUID();
}

// ===========================================
// XML Escaping
// ===========================================
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ===========================================
// ZATCA API Client
// ===========================================
export interface ZatcaApiConfig {
  baseUrl: string;
  certificate: string;
  secretKey: string;
}

const ZATCA_SANDBOX_URL = 'https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal';
const ZATCA_SIMULATION_URL = 'https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation';
const ZATCA_PRODUCTION_URL = 'https://gw-fatoora.zatca.gov.sa/e-invoicing/core';

export function getZatcaBaseUrl(environment: string): string {
  switch (environment) {
    case 'sandbox': return ZATCA_SANDBOX_URL;
    case 'simulation': return ZATCA_SIMULATION_URL;
    case 'production': return ZATCA_PRODUCTION_URL;
    default: return ZATCA_SANDBOX_URL;
  }
}

/**
 * Generate CSR (Certificate Signing Request) for ZATCA device registration
 */
export function generateZatcaCsr(data: {
  commonName: string;
  organizationIdentifier: string;
  organizationUnit: string;
  organizationName: string;
  countryCode: string;
  invoiceType: string;
  location: string;
  industry: string;
}): { csr: string; privateKey: string } {
  // Generate ECDSA key pair (secp256k1)
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'secp256k1',
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  // CSR generation would typically use a library like node-forge
  // For now, we return the keys and build CSR manually
  const csrTemplate = `-----BEGIN CERTIFICATE REQUEST-----
[CSR_CONTENT]
-----END CERTIFICATE REQUEST-----`;

  return {
    csr: csrTemplate,
    privateKey: privateKey,
  };
}

/**
 * Get Compliance CSID from ZATCA
 */
export async function getComplianceCsid(
  baseUrl: string,
  otp: string,
  csr: string
): Promise<{
  requestId: string;
  binarySecurityToken: string;
  secret: string;
  tokenType: string;
  dispositionMessage: string;
}> {
  const response = await fetch(`${baseUrl}/compliance`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'OTP': otp,
      'Accept-Version': 'V2',
      'Accept-Language': 'en',
    },
    body: JSON.stringify({ csr }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ZATCA Compliance CSID failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Submit invoice for compliance check
 */
export async function submitComplianceInvoice(
  baseUrl: string,
  certificate: string,
  secret: string,
  invoiceHash: string,
  uuid: string,
  signedXml: string
): Promise<{
  validationResults: {
    status: string;
    infoMessages: Array<{ type: string; code: string; category: string; message: string; status: string }>;
    warningMessages: Array<{ type: string; code: string; category: string; message: string; status: string }>;
    errorMessages: Array<{ type: string; code: string; category: string; message: string; status: string }>;
  };
  reportingStatus?: string;
  clearanceStatus?: string;
}> {
  const authToken = Buffer.from(`${certificate}:${secret}`).toString('base64');

  const response = await fetch(`${baseUrl}/compliance/invoices`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Version': 'V2',
      'Accept-Language': 'en',
      'Authorization': `Basic ${authToken}`,
    },
    body: JSON.stringify({
      invoiceHash,
      uuid,
      invoice: Buffer.from(signedXml, 'utf8').toString('base64'),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ZATCA Compliance check failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Get Production CSID from ZATCA
 */
export async function getProductionCsid(
  baseUrl: string,
  complianceRequestId: string,
  certificate: string,
  secret: string
): Promise<{
  requestId: string;
  binarySecurityToken: string;
  secret: string;
  tokenType: string;
  dispositionMessage: string;
}> {
  const authToken = Buffer.from(`${certificate}:${secret}`).toString('base64');

  const response = await fetch(`${baseUrl}/production/csids`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Version': 'V2',
      'Accept-Language': 'en',
      'Authorization': `Basic ${authToken}`,
    },
    body: JSON.stringify({ compliance_request_id: complianceRequestId }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ZATCA Production CSID failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Report simplified invoice to ZATCA
 */
export async function reportInvoice(
  baseUrl: string,
  certificate: string,
  secret: string,
  invoiceHash: string,
  uuid: string,
  signedXml: string
): Promise<{
  validationResults: {
    status: string;
    infoMessages: any[];
    warningMessages: any[];
    errorMessages: any[];
  };
  reportingStatus: string;
}> {
  const authToken = Buffer.from(`${certificate}:${secret}`).toString('base64');

  const response = await fetch(`${baseUrl}/invoices/reporting/single`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Version': 'V2',
      'Accept-Language': 'en',
      'Clearance-Status': '0',
      'Authorization': `Basic ${authToken}`,
    },
    body: JSON.stringify({
      invoiceHash,
      uuid,
      invoice: Buffer.from(signedXml, 'utf8').toString('base64'),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ZATCA Reporting failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * Submit standard invoice for clearance to ZATCA
 */
export async function clearInvoice(
  baseUrl: string,
  certificate: string,
  secret: string,
  invoiceHash: string,
  uuid: string,
  signedXml: string
): Promise<{
  validationResults: {
    status: string;
    infoMessages: any[];
    warningMessages: any[];
    errorMessages: any[];
  };
  clearanceStatus: string;
  clearedInvoice?: string;
}> {
  const authToken = Buffer.from(`${certificate}:${secret}`).toString('base64');

  const response = await fetch(`${baseUrl}/invoices/clearance/single`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Accept-Version': 'V2',
      'Accept-Language': 'en',
      'Clearance-Status': '1',
      'Authorization': `Basic ${authToken}`,
    },
    body: JSON.stringify({
      invoiceHash,
      uuid,
      invoice: Buffer.from(signedXml, 'utf8').toString('base64'),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ZATCA Clearance failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * ZATCA E-Invoice Generator — Phase 2 Full Compliance
 * 
 * Implements:
 * - UBL 2.1 XML generation (simplified B2C + standard B2B)
 * - ECDSA secp256k1 CSR generation with ZATCA-specific OID extensions
 * - XAdES-BES enveloped digital signatures (ds:Signature)
 * - SHA-256 hash chain (ICV + PIH)
 * - Phase 2 QR TLV encoding (9 tags incl. signature, pubkey, CSID)
 * - ZATCA API client (compliance CSID, production CSID, reporting, clearance)
 * - Banker's rounding (ZATCA-mandated)
 * - Tax exemption reason codes (BR-KSA-73, BR-O-02)
 * 
 * References:
 * - ZATCA E-Invoice Phase 2 Technical Requirements v3.3.3
 * - UBL 2.1 OASIS Standard
 * - XAdES-BES (ETSI EN 319 132-1)
 * - ZATCA Developer Portal Manual v3
 */
import crypto from 'crypto';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Import zatca-xml-js for CSR generation
let ZatcaEGS: any = null;
try {
  const zatcaLib = require('zatca-xml-js');
  ZatcaEGS = zatcaLib.EGS || zatcaLib.default?.EGS || zatcaLib;
} catch (e) {
  console.log('[ZATCA] zatca-xml-js not available, using custom CSR generation');
}

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
  // Credit/debit note reason (KSA-10, BR-KSA-17)
  noteReason?: string;
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
  // Tax exemption (BR-KSA-73, BR-O-02)
  taxExemptionReasonCode?: string;
  taxExemptionReason?: string;
}

// ===========================================
// Invoice Type Codes (ZATCA)
// ===========================================
const INVOICE_TYPE_CODES: Record<string, string> = {
  'simplified': '0200000', // Simplified Tax Invoice (B2C)
  'standard': '0100000',   // Standard Tax Invoice (B2B)
  'credit_note': '0200000', // default simplified — overridden if buyer present
  'debit_note': '0200000',  // default simplified — overridden if buyer present
};

const INVOICE_TYPE_NAME: Record<string, string> = {
  'simplified': '388',  // Invoice
  'standard': '388',    // Invoice
  'credit_note': '381', // Credit Note
  'debit_note': '383',  // Debit Note
};

// Payment method mapping to ZATCA codes (UN/ECE 4461)
const PAYMENT_CODES: Record<string, string> = {
  'cash': '10',
  'card': '48',
  'mada': '48',
  'stc_pay': '48',
  'apple_pay': '48',
  'bank_transfer': '42',
  'tap_to_pay': '48',
  'edfapay_online': '48',
  'mobile_pay': '48',
  'credit': '30',
  'split': '1',
};

// Tax category codes per ZATCA
const TAX_CATEGORIES = {
  STANDARD: 'S',
  ZERO_RATED: 'Z',
  EXEMPT: 'E',
  NOT_SUBJECT: 'O',
};

// Tax exemption reason codes (BR-KSA-73)
const TAX_EXEMPTION_REASONS: Record<string, string> = {
  'VATEX-SA-29': 'Financial services mentioned in Article 29 of the VAT Regulations',
  'VATEX-SA-29-7': 'Life insurance services mentioned in Article 29 of the VAT Regulations',
  'VATEX-SA-30': 'Real estate transactions mentioned in Article 30 of the VAT Regulations',
  'VATEX-SA-32': 'Export of goods',
  'VATEX-SA-33': 'Export of services',
  'VATEX-SA-34-1': 'The international transport of Goods',
  'VATEX-SA-34-2': 'International transport of passengers',
  'VATEX-SA-34-3': 'Services directly connected and incidental to a Supply of international passenger transport',
  'VATEX-SA-34-4': 'Supply of a qualifying means of transport',
  'VATEX-SA-34-5': 'Any services relating to Goods or passenger transportation',
  'VATEX-SA-35': 'Medicines and medical equipment',
  'VATEX-SA-36': 'Qualifying metals',
  'VATEX-SA-EDU': 'Private education to citizen',
  'VATEX-SA-HEA': 'Private healthcare to citizen',
  'VATEX-SA-MLTRY': 'Supply of qualified military goods',
  'VATEX-SA-OOS': 'Reason is free text - not subject to tax',
};

// ===========================================
// Banker's Rounding (ZATCA-mandated)
// ===========================================
export function bankersRound(value: number, decimals: number = 2): number {
  const factor = Math.pow(10, decimals);
  const shifted = value * factor;
  const floored = Math.floor(shifted);
  const diff = shifted - floored;

  if (Math.abs(diff - 0.5) < 1e-10) {
    return (floored % 2 === 0 ? floored : floored + 1) / factor;
  }
  return Math.round(shifted) / factor;
}

// ===========================================
// XML Generator — UBL 2.1 Invoice
// ===========================================
export function generateZatcaXml(data: ZatcaInvoiceData): string {
  const invoiceTypeCode = INVOICE_TYPE_NAME[data.invoiceType] || '388';
  // credit/debit notes: use standard prefix (0100000) when buyer info is present
  const isNote = data.invoiceType === 'credit_note' || data.invoiceType === 'debit_note';
  const subTypeCode = isNote && data.buyer?.vatNumber
    ? '0100000'
    : (INVOICE_TYPE_CODES[data.invoiceType] || '0200000');
  const paymentCode = PAYMENT_CODES[data.paymentMethod || 'cash'] || '10';

  const isCredit = data.invoiceType === 'credit_note';
  const isDebit = data.invoiceType === 'debit_note';
  const taxCategoryId = data.taxRate > 0 ? TAX_CATEGORIES.STANDARD : TAX_CATEGORIES.ZERO_RATED;

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

  // Instruction note for credit/debit notes (KSA-10, BR-KSA-17)
  if ((isCredit || isDebit) && data.noteReason) {
    xml += `
  <cbc:InstructionNote>${escapeXml(data.noteReason)}</cbc:InstructionNote>`;
  }

  // Billing reference for credit/debit notes (BR-KSA-56)
  if ((isCredit || isDebit) && data.relatedInvoiceNumber) {
    xml += `
  <cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>${escapeXml(data.relatedInvoiceNumber)}</cbc:ID>
      ${data.relatedInvoiceIssueDate ? `<cbc:IssueDate>${data.relatedInvoiceIssueDate}</cbc:IssueDate>` : ''}
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>`;
  }

  // ICV — Invoice Counter Value (KSA-16)
  xml += `
  <cac:AdditionalDocumentReference>
    <cbc:ID>ICV</cbc:ID>
    <cbc:UUID>${data.invoiceCounter}</cbc:UUID>
  </cac:AdditionalDocumentReference>`;

  // PIH — Previous Invoice Hash (KSA-13)
  xml += `
  <cac:AdditionalDocumentReference>
    <cbc:ID>PIH</cbc:ID>
    <cac:Attachment>
      <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">${data.previousInvoiceHash}</cbc:EmbeddedDocumentBinaryObject>
    </cac:Attachment>
  </cac:AdditionalDocumentReference>`;

  // QR placeholder (KSA-14, BR-KSA-27) — populated after hash + signing
  xml += `
  <cac:AdditionalDocumentReference>
    <cbc:ID>QR</cbc:ID>
    <cac:Attachment>
      <cbc:EmbeddedDocumentBinaryObject mimeCode="text/plain">__QR_PLACEHOLDER__</cbc:EmbeddedDocumentBinaryObject>
    </cac:Attachment>
  </cac:AdditionalDocumentReference>`;

  // Signature reference (KSA-15) — enveloped XAdES-BES
  xml += `
  <cac:Signature>
    <cbc:ID>urn:oasis:names:specification:ubl:signature:Invoice</cbc:ID>
    <cbc:SignatureMethod>urn:oasis:names:specification:ubl:dsig:enveloped:xades</cbc:SignatureMethod>
  </cac:Signature>`;

  // ========== Supplier (Seller) Party ==========
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

  // ========== Customer (Buyer) Party ==========
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
        <cbc:StreetName>${escapeXml(data.buyer?.streetName || '')}</cbc:StreetName>
        ${data.buyer?.buildingNumber ? `<cbc:BuildingNumber>${escapeXml(data.buyer.buildingNumber)}</cbc:BuildingNumber>` : ''}
        ${data.buyer?.district ? `<cbc:CitySubdivisionName>${escapeXml(data.buyer.district)}</cbc:CitySubdivisionName>` : ''}
        <cbc:CityName>${escapeXml(data.buyer?.city || '')}</cbc:CityName>
        ${data.buyer?.postalCode ? `<cbc:PostalZone>${escapeXml(data.buyer.postalCode)}</cbc:PostalZone>` : ''}
        <cac:Country>
          <cbc:IdentificationCode>${escapeXml(data.buyer?.country || 'SA')}</cbc:IdentificationCode>
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

  // ========== Delivery ==========
  if (data.deliveryDate) {
    xml += `
  <cac:Delivery>
    <cbc:ActualDeliveryDate>${data.deliveryDate}</cbc:ActualDeliveryDate>
  </cac:Delivery>`;
  }

  // ========== Payment Means ==========
  xml += `
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>${paymentCode}</cbc:PaymentMeansCode>
  </cac:PaymentMeans>`;

  // ========== Document-Level Discount ==========
  if (data.discount > 0) {
    xml += `
  <cac:AllowanceCharge>
    <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
    <cbc:AllowanceChargeReason>Discount</cbc:AllowanceChargeReason>
    <cbc:Amount currencyID="SAR">${bankersRound(data.discount).toFixed(2)}</cbc:Amount>
    <cac:TaxCategory>
      <cbc:ID schemeID="UN/ECE 5305" schemeAgencyID="6">${taxCategoryId}</cbc:ID>
      <cbc:Percent>${bankersRound(data.taxRate).toFixed(2)}</cbc:Percent>
      <cac:TaxScheme>
        <cbc:ID schemeID="UN/ECE 5153" schemeAgencyID="6">VAT</cbc:ID>
      </cac:TaxScheme>
    </cac:TaxCategory>
  </cac:AllowanceCharge>`;
  }

  // ========== Delivery Fee as Charge ==========
  if (data.deliveryFee > 0) {
    xml += `
  <cac:AllowanceCharge>
    <cbc:ChargeIndicator>true</cbc:ChargeIndicator>
    <cbc:AllowanceChargeReason>Delivery Fee</cbc:AllowanceChargeReason>
    <cbc:Amount currencyID="SAR">${bankersRound(data.deliveryFee).toFixed(2)}</cbc:Amount>
    <cac:TaxCategory>
      <cbc:ID schemeID="UN/ECE 5305" schemeAgencyID="6">${taxCategoryId}</cbc:ID>
      <cbc:Percent>${bankersRound(data.taxRate).toFixed(2)}</cbc:Percent>
      <cac:TaxScheme>
        <cbc:ID schemeID="UN/ECE 5153" schemeAgencyID="6">VAT</cbc:ID>
      </cac:TaxScheme>
    </cac:TaxCategory>
  </cac:AllowanceCharge>`;
  }

  // ========== Tax Total (two blocks per ZATCA spec) ==========
  // ZATCA requires: first block = TaxAmount only, second block = TaxAmount + TaxSubtotal
  const taxableAmount = bankersRound(data.subtotal - data.discount + data.deliveryFee);
  xml += `
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="SAR">${bankersRound(data.taxAmount).toFixed(2)}</cbc:TaxAmount>
  </cac:TaxTotal>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="SAR">${bankersRound(data.taxAmount).toFixed(2)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="SAR">${taxableAmount.toFixed(2)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="SAR">${bankersRound(data.taxAmount).toFixed(2)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID schemeID="UN/ECE 5305" schemeAgencyID="6">${taxCategoryId}</cbc:ID>
        <cbc:Percent>${bankersRound(data.taxRate).toFixed(2)}</cbc:Percent>`;

  // Tax exemption reason (required for Z, E, O categories)
  if (taxCategoryId !== TAX_CATEGORIES.STANDARD) {
    xml += `
        <cbc:TaxExemptionReasonCode>VATEX-SA-OOS</cbc:TaxExemptionReasonCode>
        <cbc:TaxExemptionReason>Not subject to VAT</cbc:TaxExemptionReason>`;
  }

  xml += `
        <cac:TaxScheme>
          <cbc:ID schemeID="UN/ECE 5153" schemeAgencyID="6">VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>`;

  // ========== Legal Monetary Total ==========
  const lineExtensionAmount = bankersRound(data.subtotal);
  const taxInclusiveAmount = bankersRound(data.total);
  const payableAmount = bankersRound(data.total);

  xml += `
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="SAR">${lineExtensionAmount.toFixed(2)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="SAR">${taxableAmount.toFixed(2)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="SAR">${taxInclusiveAmount.toFixed(2)}</cbc:TaxInclusiveAmount>
    <cbc:AllowanceTotalAmount currencyID="SAR">${bankersRound(data.discount).toFixed(2)}</cbc:AllowanceTotalAmount>
    <cbc:ChargeTotalAmount currencyID="SAR">${bankersRound(data.deliveryFee).toFixed(2)}</cbc:ChargeTotalAmount>
    <cbc:PrepaidAmount currencyID="SAR">0.00</cbc:PrepaidAmount>
    <cbc:PayableAmount currencyID="SAR">${payableAmount.toFixed(2)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>`;

  // ========== Invoice Lines ==========
  data.items.forEach((item, index) => {
    const lineTaxCat = item.taxRate > 0 ? TAX_CATEGORIES.STANDARD : TAX_CATEGORIES.ZERO_RATED;

    xml += `
  <cac:InvoiceLine>
    <cbc:ID>${index + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="PCE">${item.quantity}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="SAR">${bankersRound(item.totalWithoutTax).toFixed(2)}</cbc:LineExtensionAmount>`;

    if (item.discount > 0) {
      xml += `
    <cac:AllowanceCharge>
      <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
      <cbc:AllowanceChargeReason>Discount</cbc:AllowanceChargeReason>
      <cbc:Amount currencyID="SAR">${bankersRound(item.discount).toFixed(2)}</cbc:Amount>
      <cac:TaxCategory>
        <cbc:ID>${lineTaxCat}</cbc:ID>
        <cbc:Percent>${bankersRound(item.taxRate).toFixed(2)}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:AllowanceCharge>`;
    }

    xml += `
    <cac:TaxTotal>
      <cbc:TaxAmount currencyID="SAR">${bankersRound(item.taxAmount).toFixed(2)}</cbc:TaxAmount>
      <cbc:RoundingAmount currencyID="SAR">${bankersRound(item.totalWithTax).toFixed(2)}</cbc:RoundingAmount>
    </cac:TaxTotal>
    <cac:Item>
      <cbc:Name>${escapeXml(item.nameAr || item.nameEn || 'Item')}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID schemeID="UN/ECE 5305" schemeAgencyID="6">${lineTaxCat}</cbc:ID>
        <cbc:Percent>${bankersRound(item.taxRate).toFixed(2)}</cbc:Percent>`;

    // Tax exemption at line level (BR-KSA-73)
    if (lineTaxCat !== TAX_CATEGORIES.STANDARD) {
      const exemptionCode = item.taxExemptionReasonCode || 'VATEX-SA-OOS';
      const exemptionReason = item.taxExemptionReason ||
        TAX_EXEMPTION_REASONS[exemptionCode] || 'Not subject to VAT';
      xml += `
        <cbc:TaxExemptionReasonCode>${exemptionCode}</cbc:TaxExemptionReasonCode>
        <cbc:TaxExemptionReason>${escapeXml(exemptionReason)}</cbc:TaxExemptionReason>`;
    }

    xml += `
        <cac:TaxScheme>
          <cbc:ID schemeID="UN/ECE 5153" schemeAgencyID="6">VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="SAR">${bankersRound(item.unitPrice).toFixed(2)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`;
  });

  xml += `
</Invoice>`;

  return xml;
}

// ===========================================
// QR Code TLV Encoder — Phase 2 (9 Tags)
// ===========================================
export function generateZatcaTlvQrCode(data: {
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
  const tlvEncode = (tag: number, value: string | Buffer): Buffer => {
    const valueBuffer = typeof value === 'string' ? Buffer.from(value, 'utf8') : value;
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
// Invoice Hash (SHA-256)
// Excludes: QR, Signature, UBLExtensions (per ZATCA §6.6)
// ===========================================
function stripHashExclusions(xml: string): string {
  let stripped = xml.replace(
    /<cac:AdditionalDocumentReference>\s*<cbc:ID>QR<\/cbc:ID>[\s\S]*?<\/cac:AdditionalDocumentReference>/g,
    ''
  );
  stripped = stripped.replace(
    /<cac:Signature>[\s\S]*?<\/cac:Signature>/g,
    ''
  );
  stripped = stripped.replace(
    /<ext:UBLExtensions>[\s\S]*?<\/ext:UBLExtensions>/g,
    ''
  );
  return stripped;
}

export function computeInvoiceHash(xmlContent: string): string {
  const hashInput = stripHashExclusions(xmlContent);
  return crypto.createHash('sha256').update(hashInput, 'utf8').digest('hex');
}

export function computeInvoiceHashBase64(xmlContent: string): string {
  const hashInput = stripHashExclusions(xmlContent);
  return crypto.createHash('sha256').update(hashInput, 'utf8').digest('base64');
}

export function injectQrCodeIntoXml(xmlContent: string, qrBase64: string): string {
  return xmlContent.replace('__QR_PLACEHOLDER__', qrBase64);
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


// ╔══════════════════════════════════════════════════════════════════╗
// ║  ASN.1 DER ENCODER — Minimal for CSR generation                ║
// ╚══════════════════════════════════════════════════════════════════╝

function derLength(length: number): Buffer {
  if (length < 0x80) return Buffer.from([length]);
  if (length < 0x100) return Buffer.from([0x81, length]);
  if (length < 0x10000) {
    const buf = Buffer.alloc(3);
    buf[0] = 0x82;
    buf.writeUInt16BE(length, 1);
    return buf;
  }
  const buf = Buffer.alloc(4);
  buf[0] = 0x83;
  buf[1] = (length >> 16) & 0xff;
  buf[2] = (length >> 8) & 0xff;
  buf[3] = length & 0xff;
  return buf;
}

function derWrap(tag: number, content: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), derLength(content.length), content]);
}

function derSequence(...items: Buffer[]): Buffer {
  return derWrap(0x30, Buffer.concat(items));
}

function derSet(...items: Buffer[]): Buffer {
  return derWrap(0x31, Buffer.concat(items));
}

function derInteger(value: number): Buffer {
  if (value === 0) return derWrap(0x02, Buffer.from([0x00]));
  const bytes: number[] = [];
  let v = value;
  while (v > 0) { bytes.unshift(v & 0xff); v >>= 8; }
  if (bytes[0] & 0x80) bytes.unshift(0x00);
  return derWrap(0x02, Buffer.from(bytes));
}

function derOid(oid: string): Buffer {
  const parts = oid.split('.').map(Number);
  const bytes: number[] = [parts[0] * 40 + parts[1]];
  for (let i = 2; i < parts.length; i++) {
    let val = parts[i];
    if (val < 128) { bytes.push(val); }
    else {
      const enc: number[] = [];
      enc.push(val & 0x7f); val >>= 7;
      while (val > 0) { enc.push((val & 0x7f) | 0x80); val >>= 7; }
      enc.reverse();
      bytes.push(...enc);
    }
  }
  return derWrap(0x06, Buffer.from(bytes));
}

function derUtf8String(value: string): Buffer {
  return derWrap(0x0c, Buffer.from(value, 'utf8'));
}

function derPrintableString(value: string): Buffer {
  return derWrap(0x13, Buffer.from(value, 'ascii'));
}

function derBmpString(value: string): Buffer {
  // BMPString is UCS-2 Big Endian (each character is 2 bytes)
  const buf = Buffer.alloc(value.length * 2);
  for (let i = 0; i < value.length; i++) {
    buf.writeUInt16BE(value.charCodeAt(i), i * 2);
  }
  return derWrap(0x1e, buf);
}

function derBitString(content: Buffer): Buffer {
  return derWrap(0x03, Buffer.concat([Buffer.from([0x00]), content]));
}

function derOctetString(content: Buffer): Buffer {
  return derWrap(0x04, content);
}

function derBoolean(value: boolean): Buffer {
  return derWrap(0x01, Buffer.from([value ? 0xff : 0x00]));
}

function derContextConstructed(tag: number, content: Buffer): Buffer {
  return derWrap(0xa0 | tag, content);
}

// Well-known OIDs
const OID = {
  countryName: '2.5.4.6',
  organization: '2.5.4.10',
  organizationalUnit: '2.5.4.11',
  commonName: '2.5.4.3',
  organizationIdentifier: '2.5.4.97',
  serialNumber: '2.5.4.5',
  ecPublicKey: '1.2.840.10045.2.1',
  secp256k1: '1.3.132.0.10',
  ecdsaWithSHA256: '1.2.840.10045.4.3.2',
  extensionRequest: '1.2.840.113549.1.9.14',
  subjectAltName: '2.5.29.17',
  certificateTemplateName: '1.3.6.1.4.1.311.20.2',
  surname: '2.5.4.4',
  userId: '0.9.2342.19200300.100.1.1',
  title: '2.5.4.12',
  registeredAddress: '2.5.4.26',
  businessCategory: '2.5.4.15',
};

function buildRdn(oidStr: string, value: string, useUtf8 = true): Buffer {
  const attrValue = useUtf8 ? derUtf8String(value) : derPrintableString(value);
  return derSet(derSequence(derOid(oidStr), attrValue));
}


// ===========================================
// CSR Generation — Using OpenSSL directly (matches zatca-xml-js SDK exactly)
// ===========================================

/**
 * Generate a PKCS#10 CSR for ZATCA device registration.
 * Uses OpenSSL directly which is the same method used by zatca-xml-js SDK.
 */
export async function generateZatcaCsr(data: {
  commonName: string;
  organizationIdentifier: string;
  organizationUnit: string;
  organizationName: string;
  countryCode: string;
  invoiceType: string;
  location: string;
  industry: string;
  environment?: string; // 'sandbox' | 'simulation' | 'production'
}): Promise<{ csr: string; privateKey: string }> {
  const env = data.environment || 'sandbox';
  const isProduction = (env === 'production');
  console.log('[ZATCA CSR] Environment:', env, '| Production:', isProduction);
  
  // Try using zatca-xml-js library first (most reliable)
  if (ZatcaEGS && ZatcaEGS.EGS) {
    try {
      console.log('[ZATCA CSR] Using zatca-xml-js EGS library');
      const vatNumber = data.organizationIdentifier.replace('VATSA-', '');
      const uuid = crypto.randomUUID();
      
      // Sanitize fields to ASCII only
      const sanitize = (s: string) => s.replace(/[^\x00-\x7F]/g, '').trim() || 'Default';
      
      const egsInfo = {
        uuid: uuid,
        custom_id: `EGS1-${vatNumber}-00001`,
        model: '1.0',
        VAT_name: sanitize(data.organizationName) || 'Restaurant',
        VAT_number: vatNumber,
        branch_name: sanitize(data.organizationUnit) || 'Branch',
        branch_industry: sanitize(data.industry) || 'Food',
        location: {
          building: '1',
          street: sanitize(data.location) || 'Riyadh',
          city: sanitize(data.location) || 'Riyadh',
        }
      };
      
      const egs = new ZatcaEGS.EGS(egsInfo);
      await egs.generateNewKeysAndCSR(isProduction, 'TryingPOS');
      
      const egsData = egs.get();
      console.log('[ZATCA CSR] Generated with zatca-xml-js, CSR length:', egsData.csr?.length);
      
      if (!egsData.csr || !egsData.private_key) {
        throw new Error('EGS library failed to generate CSR');
      }
      
      return { csr: egsData.csr, privateKey: egsData.private_key };
    } catch (egsError: any) {
      console.error('[ZATCA CSR] zatca-xml-js failed:', egsError.message);
      // Fall through to OpenSSL
    }
  }
  
  // Fallback to OpenSSL
  console.log('[ZATCA CSR] Using OpenSSL fallback');
  
  // Extract VAT number
  const vatNumber = data.organizationIdentifier.replace('VATSA-', '');
  const uuid = crypto.randomUUID();
  // Match optima_zatca serial format: 1-{key}uy|2-{solution_name}nt|3-{key}pu
  const keyPart = uuid.replace(/-/g, '').substring(0, 12);
  const egsSerial = `1-${keyPart}uy|2-TryingPOSnt|3-${keyPart}pu`;
  // Template names per optima_zatca: sandbox=TESTZATCA, simulation=PREZATCA, production=ZATCA
  const templateName = env === 'production' ? 'ZATCA-Code-Signing' : (env === 'simulation' ? 'PREZATCA-Code-Signing' : 'TESTZATCA-Code-Signing');
  
  // Sanitize fields
  const sanitize = (s: string) => s.replace(/[^\x00-\x7F]/g, '').trim() || 'Default';
  const orgUnit = sanitize(data.organizationUnit) || 'Branch';
  const orgName = sanitize(data.organizationName) || 'Restaurant';
  const location = sanitize(data.location) || 'Riyadh';
  const industry = sanitize(data.industry) || 'Food';
  
  console.log('[ZATCA CSR] EGS Serial:', egsSerial.substring(0, 40));
  console.log('[ZATCA CSR] Template:', templateName);
  
  // Create OpenSSL config matching optima_zatca (keys.py) exactly
  const configContent = `oid_section = OIDs
[ OIDs ]
certificateTemplateName = 1.3.6.1.4.1.311.20.2

[req]
default_bits = 2048
emailAddress = test@zatca.com
req_extensions = v3_req
x509_extensions = v3_ca
prompt = no
default_md = sha256
req_extensions = req_ext
distinguished_name = dn
utf8 = yes

[ dn ]
C = SA
OU = ${orgUnit}
O = ${orgName}
CN = ${data.commonName}

[ v3_req ]
basicConstraints = CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment

[req_ext]
certificateTemplateName = ASN1:PRINTABLESTRING:${templateName}
subjectAltName = dirName:alt_names

[alt_names]
SN = ${egsSerial}
UID = ${vatNumber}
title = ${data.invoiceType || '1100'}
registeredAddress = ${location}
businessCategory = ${industry}
`;

  const configFile = `/tmp/zatca_csr_${uuid}.cnf`;
  const keyFile = `/tmp/zatca_key_${uuid}.pem`;
  const csrFile = `/tmp/zatca_csr_${uuid}.pem`;
  
  try {
    // Write config
    fs.writeFileSync(configFile, configContent);
    
    // Generate key
    execSync(`openssl ecparam -name secp256k1 -genkey -noout -out ${keyFile}`, { encoding: 'utf-8' });
    
    // Generate CSR with v3_req extensions (matching optima_zatca)
    execSync(`openssl req -new -sha256 -key ${keyFile} -extensions v3_req -config ${configFile} -out ${csrFile}`, { encoding: 'utf-8' });
    
    // Read results
    const privateKey = fs.readFileSync(keyFile, 'utf-8');
    const csr = fs.readFileSync(csrFile, 'utf-8');
    
    // Cleanup
    try {
      fs.unlinkSync(configFile);
      fs.unlinkSync(keyFile);
      fs.unlinkSync(csrFile);
    } catch {}
    
    console.log('[ZATCA CSR] Generated with OpenSSL, CSR length:', csr.length);
    
    return { csr, privateKey };
  } catch (error: any) {
    console.error('[ZATCA CSR] OpenSSL failed:', error.message);
    
    // Cleanup on error
    try {
      fs.unlinkSync(configFile);
      fs.unlinkSync(keyFile);
      fs.unlinkSync(csrFile);
    } catch {}
    
    throw new Error(`CSR generation failed: ${error.message}`);
  }
}


// ╔══════════════════════════════════════════════════════════════════╗
// ║  XAdES-BES DIGITAL SIGNATURE                                    ║
// ╚══════════════════════════════════════════════════════════════════╝

/**
 * Parse X.509 certificate info from ZATCA BinarySecurityToken
 */
export function parseCertificateInfo(certBase64: string): {
  issuerName: string;
  serialNumber: string;
  publicKeyBase64: string;
  certHashBase64: string;
} {
  try {
    const certDer = Buffer.from(certBase64, 'base64');
    const certPem = `-----BEGIN CERTIFICATE-----\n${certBase64}\n-----END CERTIFICATE-----`;
    const x509 = new crypto.X509Certificate(certPem);

    const issuerName = x509.issuer;
    const serialNumber = BigInt('0x' + x509.serialNumber).toString(10);
    const pubKeyDer = x509.publicKey.export({ type: 'spki', format: 'der' });
    const publicKeyBase64 = Buffer.from(pubKeyDer).toString('base64');
    const certHash = crypto.createHash('sha256').update(certDer).digest('base64');

    return { issuerName, serialNumber, publicKeyBase64, certHashBase64: certHash };
  } catch (err: any) {
    console.error('Certificate parsing error:', err?.message);
    return {
      issuerName: 'CN=Unknown',
      serialNumber: '0',
      publicKeyBase64: '',
      certHashBase64: crypto.createHash('sha256').update(Buffer.from(certBase64, 'base64')).digest('base64'),
    };
  }
}

/**
 * Build XAdES-BES SignedProperties XML
 */
function buildSignedProperties(
  signingTime: string,
  certHashBase64: string,
  issuerName: string,
  serialNumber: string,
): string {
  return `<xades:SignedProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="xadesSignedProperties">
                  <xades:SignedSignatureProperties>
                    <xades:SigningTime>${signingTime}</xades:SigningTime>
                    <xades:SigningCertificate>
                      <xades:Cert>
                        <xades:CertDigest>
                          <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                          <ds:DigestValue>${certHashBase64}</ds:DigestValue>
                        </xades:CertDigest>
                        <xades:IssuerSerial>
                          <ds:X509IssuerName>${escapeXml(issuerName)}</ds:X509IssuerName>
                          <ds:X509SerialNumber>${serialNumber}</ds:X509SerialNumber>
                        </xades:IssuerSerial>
                      </xades:Cert>
                    </xades:SigningCertificate>
                  </xades:SignedSignatureProperties>
                </xades:SignedProperties>`;
}

/**
 * Build ds:SignedInfo with invoice hash + signed properties hash
 */
function buildSignedInfo(
  invoiceHashBase64: string,
  signedPropsHashBase64: string,
): string {
  return `<ds:SignedInfo>
              <ds:CanonicalizationMethod Algorithm="http://www.w3.org/2006/12/xml-c14n11"/>
              <ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#ecdsa-sha256"/>
              <ds:Reference Id="invoiceSignedData" URI="">
                <ds:Transforms>
                  <ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">
                    <ds:XPath>not(//ancestor-or-self::ext:UBLExtensions)</ds:XPath>
                  </ds:Transform>
                  <ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">
                    <ds:XPath>not(//ancestor-or-self::cac:Signature)</ds:XPath>
                  </ds:Transform>
                  <ds:Transform Algorithm="http://www.w3.org/TR/1999/REC-xpath-19991116">
                    <ds:XPath>not(//ancestor-or-self::cac:AdditionalDocumentReference[cbc:ID='QR'])</ds:XPath>
                  </ds:Transform>
                  <ds:Transform Algorithm="http://www.w3.org/2006/12/xml-c14n11"/>
                </ds:Transforms>
                <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                <ds:DigestValue>${invoiceHashBase64}</ds:DigestValue>
              </ds:Reference>
              <ds:Reference Type="http://www.w3.org/2000/09/xmldsig#SignatureProperties" URI="#xadesSignedProperties">
                <ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
                <ds:DigestValue>${signedPropsHashBase64}</ds:DigestValue>
              </ds:Reference>
            </ds:SignedInfo>`;
}

/**
 * Sign invoice XML with XAdES-BES digital signature.
 * Adds ext:UBLExtensions block with full ds:Signature.
 */
export function signInvoiceXml(
  unsignedXml: string,
  privateKeyPem: string,
  certificateBase64: string,
): {
  signedXml: string;
  signatureValue: string;
  publicKeyBase64: string;
} {
  // 1. Compute invoice hash
  const invoiceHashBase64 = computeInvoiceHashBase64(unsignedXml);

  // 2. Parse certificate
  const certInfo = parseCertificateInfo(certificateBase64);
  const signingTime = new Date().toISOString();

  // 3. Build SignedProperties
  const signedPropsXml = buildSignedProperties(
    signingTime, certInfo.certHashBase64, certInfo.issuerName, certInfo.serialNumber,
  );

  // 4. Hash SignedProperties
  const signedPropsHash = crypto.createHash('sha256').update(signedPropsXml, 'utf8').digest('base64');

  // 5. Build SignedInfo
  const signedInfoXml = buildSignedInfo(invoiceHashBase64, signedPropsHash);

  // 6. Sign SignedInfo (ECDSA-SHA256)
  const signer = crypto.createSign('SHA256');
  signer.update(signedInfoXml, 'utf8');
  const signatureBytes = signer.sign({ key: privateKeyPem, dsaEncoding: 'der' });
  const signatureValue = signatureBytes.toString('base64');

  // 7. Build UBLExtensions
  const ublExtensions = `<ext:UBLExtensions>
    <ext:UBLExtension>
      <ext:ExtensionURI>urn:oasis:names:specification:ubl:dsig:enveloped:xades</ext:ExtensionURI>
      <ext:ExtensionContent>
        <sig:UBLDocumentSignatures xmlns:sig="urn:oasis:names:specification:ubl:schema:xsd:CommonSignatureComponents-2"
                                   xmlns:sac="urn:oasis:names:specification:ubl:schema:xsd:SignatureAggregateComponents-2"
                                   xmlns:sbc="urn:oasis:names:specification:ubl:schema:xsd:SignatureBasicComponents-2">
          <sac:SignatureInformation>
            <cbc:ID>urn:oasis:names:specification:ubl:signature:1</cbc:ID>
            <sbc:ReferencedSignatureID>urn:oasis:names:specification:ubl:signature:Invoice</sbc:ReferencedSignatureID>
            <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="signature">
            ${signedInfoXml}
            <ds:SignatureValue>${signatureValue}</ds:SignatureValue>
            <ds:KeyInfo>
              <ds:X509Data>
                <ds:X509Certificate>${certificateBase64}</ds:X509Certificate>
              </ds:X509Data>
            </ds:KeyInfo>
            <ds:Object>
              <xades:QualifyingProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Target="signature">
                ${signedPropsXml}
              </xades:QualifyingProperties>
            </ds:Object>
            </ds:Signature>
          </sac:SignatureInformation>
        </sig:UBLDocumentSignatures>
      </ext:ExtensionContent>
    </ext:UBLExtension>
  </ext:UBLExtensions>`;

  // 8. Insert UBLExtensions after opening <Invoice> tag
  const signedXml = unsignedXml.replace(
    /(<Invoice[^>]*>)/,
    `$1\n  ${ublExtensions}`,
  );

  return { signedXml, signatureValue, publicKeyBase64: certInfo.publicKeyBase64 };
}


// ===========================================
// Full Signing + QR Pipeline
// ===========================================
/**
 * Complete pipeline:
 * 1. Sign XML with XAdES-BES (if credentials available)
 * 2. Generate Phase 2 QR code (with signature + pubkey + CSID)
 * 3. Inject QR into final XML
 */
export function buildSignedInvoice(
  unsignedXml: string,
  privateKeyPem: string | null,
  certificateBase64: string | null,
  qrBaseData: {
    sellerName: string;
    vatNumber: string;
    timestamp: string;
    total: string;
    vatAmount: string;
  },
): {
  finalXml: string;
  invoiceHash: string;
  qrData: string;
  signatureValue: string | null;
  signedXml: string | null;
} {
  const invoiceHash = computeInvoiceHash(unsignedXml);
  const invoiceHashBase64 = computeInvoiceHashBase64(unsignedXml);

  let xmlToProcess = unsignedXml;
  let signatureValue: string | null = null;
  let signedXml: string | null = null;
  let publicKeyBase64 = '';
  let csidStamp = '';

  if (privateKeyPem && certificateBase64) {
    try {
      const signed = signInvoiceXml(unsignedXml, privateKeyPem, certificateBase64);
      xmlToProcess = signed.signedXml;
      signatureValue = signed.signatureValue;
      signedXml = signed.signedXml;
      publicKeyBase64 = signed.publicKeyBase64;
      csidStamp = certificateBase64; // CSID token is tag 9
    } catch (err: any) {
      console.error('Invoice signing failed, submitting unsigned:', err?.message);
    }
  }

  const qrData = generateZatcaTlvQrCode({
    ...qrBaseData,
    invoiceHash,
    digitalSignature: signatureValue || undefined,
    publicKey: publicKeyBase64 || undefined,
    csidStamp: csidStamp || undefined,
  });

  const finalXml = injectQrCodeIntoXml(xmlToProcess, qrData);

  return { finalXml, invoiceHash: invoiceHashBase64, qrData, signatureValue, signedXml };
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

// ─── Mock Mode (local testing without a ZATCA account) ──────────────────────

export function isMockEnvironment(environment: string): boolean {
  return environment === 'mock';
}

export function mockGetComplianceCsid(): {
  requestID: string; binarySecurityToken: string; secret: string;
  tokenType: string; dispositionMessage: string;
} {
  return {
    requestID: `MOCK-COMP-${Date.now()}`,
    binarySecurityToken: Buffer.from('MOCK_COMPLIANCE_CERTIFICATE_FOR_TESTING').toString('base64'),
    secret: 'mock-compliance-secret',
    tokenType: 'urn:ietf:params:oauth:token-type:jwt',
    dispositionMessage: 'ISSUED (MOCK)',
  };
}

export function mockSubmitComplianceInvoice(): {
  validationResults: { status: string; infoMessages: any[]; warningMessages: any[]; errorMessages: any[] };
  reportingStatus: string;
} {
  return {
    validationResults: { status: 'PASS', infoMessages: [], warningMessages: [], errorMessages: [] },
    reportingStatus: 'REPORTED',
  };
}

export function mockGetProductionCsid(): {
  requestID: string; binarySecurityToken: string; secret: string;
  tokenType: string; dispositionMessage: string;
} {
  return {
    requestID: `MOCK-PROD-${Date.now()}`,
    binarySecurityToken: Buffer.from('MOCK_PRODUCTION_CERTIFICATE_FOR_TESTING').toString('base64'),
    secret: 'mock-production-secret',
    tokenType: 'urn:ietf:params:oauth:token-type:jwt',
    dispositionMessage: 'ISSUED (MOCK)',
  };
}

export function mockReportInvoice(): {
  validationResults: { status: string; infoMessages: any[]; warningMessages: any[]; errorMessages: any[] };
  reportingStatus: string;
} {
  return {
    validationResults: { status: 'PASS', infoMessages: [], warningMessages: [], errorMessages: [] },
    reportingStatus: 'REPORTED',
  };
}

export function mockClearInvoice(): {
  validationResults: { status: string; infoMessages: any[]; warningMessages: any[]; errorMessages: any[] };
  clearanceStatus: string;
  clearedInvoice?: string;
} {
  return {
    validationResults: { status: 'PASS', infoMessages: [], warningMessages: [], errorMessages: [] },
    clearanceStatus: 'CLEARED',
  };
}

/**
 * Get Compliance CSID from ZATCA (Step 1)
 */
export async function getComplianceCsid(
  baseUrl: string,
  otp: string,
  csr: string
): Promise<{
  requestID: string;
  binarySecurityToken: string;
  secret: string;
  tokenType: string;
  dispositionMessage: string;
}> {
  // Encode the FULL PEM CSR content as base64 (matching optima_zatca approach)
  // optima_zatca does: base64.b64encode(csr_pem_content.encode()).decode()
  // This means the entire PEM file (with BEGIN/END headers) is base64-encoded
  const csrClean = Buffer.from(csr.trim()).toString('base64');
  
  console.log(`[ZATCA] Sending compliance request to ${baseUrl}/compliance`);
  console.log(`[ZATCA] OTP: ${otp}, CSR base64 length: ${csrClean.length}`);
  console.log(`[ZATCA] CSR first 60 chars: ${csrClean.substring(0, 60)}...`);

  const response = await fetch(`${baseUrl}/compliance`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'OTP': otp,
      'Accept-Version': 'V2',
      'Accept-Language': 'en',
    },
    body: JSON.stringify({ csr: csrClean }),
  });
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[ZATCA] Compliance failed: ${response.status}`, errorText);
    
    // Try to parse error details and extract meaningful message
    let errorMessage = `ZATCA Compliance CSID failed: ${response.status}`;
    let errorDetails = '';
    try {
      const errorJson = JSON.parse(errorText);
      console.error(`[ZATCA] Error details:`, JSON.stringify(errorJson, null, 2));
      if (errorJson.message) errorDetails = errorJson.message;
      if (errorJson.errors && Array.isArray(errorJson.errors)) {
        errorDetails = errorJson.errors.map((e: any) => e.message || e.code || JSON.stringify(e)).join('; ');
      }
      if (errorJson.validationResults?.errorMessages?.length > 0) {
        errorDetails = errorJson.validationResults.errorMessages.map((e: any) => e.message).join('; ');
      }
    } catch {}
    
    // Common error handling
    if (response.status === 400) {
      if (errorText.includes('OTP') || errorText.includes('expired')) {
        errorMessage = 'OTP code expired or invalid. Please generate a new OTP from ZATCA portal.';
      } else if (errorText.includes('CSR') || errorText.includes('certificate')) {
        errorMessage = 'CSR format is invalid. Please check your VAT number and try again.';
      } else {
        errorMessage = `ZATCA rejected the request: ${errorDetails || errorText || 'Invalid Request'}`;
      }
    }
    
    throw new Error(errorMessage);
  }
  return response.json();
}

/**
 * Submit invoice for compliance check (Step 2)
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
  const responseText = await response.text();
  let body: any = null;
  try { body = JSON.parse(responseText); } catch { /* non-JSON response */ }
  if (!response.ok) {
    // ZATCA returns structured validationResults on 400 — preserve them
    if (response.status === 400 && body?.validationResults) {
      return body;
    }
    const msg = body?.message || body?.error || (body ? JSON.stringify(body) : responseText.slice(0, 200)) || `HTTP ${response.status}`;
    throw new Error(`ZATCA Compliance check failed: ${response.status} - ${msg}`);
  }
  if (!body) throw new Error('ZATCA Compliance check: empty or invalid JSON response');
  return body;
}

/**
 * Get Production CSID from ZATCA (Step 3)
 */
export async function getProductionCsid(
  baseUrl: string,
  complianceRequestId: string,
  certificate: string,
  secret: string
): Promise<{
  requestID: string;
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
  const responseText = await response.text();
  let body: any = null;
  try { body = JSON.parse(responseText); } catch { /* non-JSON response */ }
  if (!response.ok) {
    const msg = body?.message || body?.error || (body ? JSON.stringify(body) : responseText.slice(0, 200)) || `HTTP ${response.status}`;
    throw new Error(`ZATCA Production CSID failed: ${response.status} - ${msg}`);
  }
  if (!body) throw new Error('ZATCA Production CSID: empty or invalid JSON response');
  return body;
}

/**
 * Report simplified invoice to ZATCA (Clearance-Status: 0)
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
  const responseText = await response.text();
  let body: any = null;
  try { body = JSON.parse(responseText); } catch { /* non-JSON response */ }
  if (!response.ok) {
    // ZATCA returns structured validationResults on 400 — preserve them
    if (response.status === 400 && body?.validationResults) {
      return body;
    }
    const msg = body?.message || body?.error || (body ? JSON.stringify(body) : responseText.slice(0, 200)) || `HTTP ${response.status}`;
    throw new Error(`ZATCA Reporting failed: ${response.status} - ${msg}`);
  }
  if (!body) throw new Error('ZATCA Reporting: empty or invalid JSON response');
  return body;
}

/**
 * Submit standard invoice for clearance (Clearance-Status: 1)
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
  const responseText = await response.text();
  let body: any = null;
  try { body = JSON.parse(responseText); } catch { /* non-JSON response */ }
  if (!response.ok) {
    if (response.status === 400 && body?.validationResults) {
      return body;
    }
    const msg = body?.message || body?.error || (body ? JSON.stringify(body) : responseText.slice(0, 200)) || `HTTP ${response.status}`;
    throw new Error(`ZATCA Clearance failed: ${response.status} - ${msg}`);
  }
  if (!body) throw new Error('ZATCA Clearance: empty or invalid JSON response');
  return body;
}

/**
 * B2B buyer validation — ZATCA requires full buyer info for standard invoices
 */
export function validateB2BBuyer(buyer?: ZatcaInvoiceData['buyer']): string[] {
  const errors: string[] = [];
  if (!buyer) {
    errors.push('Buyer information is required for standard (B2B) invoices');
    return errors;
  }
  if (!buyer.name?.trim()) {
    errors.push('Buyer name (RegistrationName) is required for B2B invoices (BR-KSA-46)');
  }
  if (!buyer.vatNumber?.trim()) {
    errors.push('Buyer VAT number is required for B2B invoices (BR-KSA-46)');
  }
  if (buyer.vatNumber && !/^\d{15}$/.test(buyer.vatNumber.trim())) {
    errors.push('Buyer VAT number must be exactly 15 digits (BR-KSA-46)');
  }
  if (!buyer.streetName) errors.push('Buyer street name is required for B2B invoices (BR-KSA-09)');
  if (!buyer.city) errors.push('Buyer city is required for B2B invoices (BR-KSA-10)');
  if (!buyer.postalCode) errors.push('Buyer postal code is required for B2B invoices');
  if (!buyer.buildingNumber) errors.push('Buyer building number is required for B2B invoices (BR-KSA-63)');
  return errors;
}

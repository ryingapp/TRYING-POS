import { useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/lib/i18n";
import { QRCodeSVG } from "qrcode.react";
import type { Restaurant, Order, OrderItem, MenuItem } from "@shared/schema";

interface InvoiceData {
  id: string;
  invoiceNumber: string;
  invoiceType: string | null;
  status: string | null;
  subtotal: string;
  taxAmount: string;
  taxRate: string | null;
  discount: string | null;
  deliveryFee: string | null;
  total: string;
  customerName: string | null;
  customerPhone: string | null;
  paymentMethod: string | null;
  isPaid: boolean | null;
  qrCodeData: string | null;
  xmlContent: string | null;
  zatcaStatus: string | null;
  zatcaSubmissionId: string | null;
  invoiceHash: string | null;
  uuid: string | null;
  invoiceCounter: number | null;
  createdAt: Date | null;
  issuedAt: Date | null;
  order: Order & { items: (OrderItem & { menuItem?: MenuItem })[] };
  restaurant: Restaurant;
}

interface InvoiceModalProps {
  open: boolean;
  onClose: () => void;
  invoiceId?: string;
  orderId?: string;
  autoPrint?: boolean;
  onAutoPrintDone?: () => void;
}

// Thermal receipt CSS for print window
const receiptCSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Courier New', 'Segoe UI', Tahoma, monospace;
    padding: 4px;
    background: #fff;
    color: #000;
    font-size: 12px;
    line-height: 1.4;
  }
  .receipt {
    max-width: 80mm;
    margin: 0 auto;
    padding: 8px 4px;
  }
  .receipt-center { text-align: center; }
  .receipt-logo { max-width: 80px; max-height: 80px; margin: 0 auto 6px; display: block; object-fit: contain; }
  .receipt-name { font-size: 16px; font-weight: bold; margin-bottom: 2px; }
  .receipt-info { font-size: 11px; color: #333; margin-bottom: 1px; }
  .receipt-divider { border: none; border-top: 1px dashed #000; margin: 8px 0; }
  .receipt-thick-divider { border: none; border-top: 2px solid #000; margin: 8px 0; }
  .receipt-title { font-size: 14px; font-weight: bold; text-align: center; margin: 4px 0; }
  .receipt-order-box {
    border: 2px solid #000;
    text-align: center;
    padding: 6px;
    margin: 8px 0;
    font-size: 22px;
    font-weight: bold;
  }
  .receipt-row { display: flex; justify-content: space-between; margin-bottom: 2px; font-size: 12px; }
  .receipt-row-bold { display: flex; justify-content: space-between; margin-bottom: 2px; font-size: 13px; font-weight: bold; }
  .receipt-label { flex-shrink: 0; }
  .receipt-value { flex-shrink: 0; text-align: end; }
  .receipt-item { margin-bottom: 6px; }
  .receipt-item-row { display: flex; justify-content: space-between; font-size: 12px; }
  .receipt-item-name { font-weight: bold; flex: 1; }
  .receipt-item-price { flex-shrink: 0; font-weight: bold; }
  .receipt-item-detail { font-size: 10px; color: #555; margin-top: 1px; }
  .receipt-total-section { margin-top: 4px; }
  .receipt-grand-total { display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; padding: 4px 0; }
  .receipt-payment-box { border: 1px solid #000; padding: 4px 8px; margin: 6px 0; }
  .receipt-qr { text-align: center; margin-top: 8px; }
  .receipt-qr svg { margin: 0 auto; }
  .receipt-footer { text-align: center; font-size: 10px; color: #555; margin-top: 8px; }
  .receipt-badge { display: inline-block; padding: 2px 8px; border: 1px solid #000; font-size: 11px; font-weight: bold; margin: 4px 0; }
  @media print {
    body { padding: 0; }
    .no-print { display: none !important; }
  }
`;

export function InvoiceModal({ open, onClose, invoiceId, orderId, autoPrint, onAutoPrintDone }: InvoiceModalProps) {
  const { t, language, getLocalizedName } = useLanguage();
  const printRef = useRef<HTMLDivElement>(null);
  const autoPrintDoneRef = useRef(false);

  const { data: invoice, isLoading } = useQuery<InvoiceData>({
    queryKey: orderId ? ["/api/orders", orderId, "invoice"] : ["/api/invoices", invoiceId],
    enabled: open && (!!invoiceId || !!orderId),
  });

  const direction = language === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    if (autoPrint && invoice && !autoPrintDoneRef.current && printRef.current) {
      autoPrintDoneRef.current = true;
      setTimeout(() => {
        handlePrint();
        onAutoPrintDone?.();
      }, 500);
    }
    if (!open) {
      autoPrintDoneRef.current = false;
    }
  }, [autoPrint, invoice, open]);

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const content = printRef.current.innerHTML;
    printWindow.document.write(`
      <html>
        <head>
          <title>${t("invoice")} - ${invoice?.invoiceNumber}</title>
          <style>${receiptCSS}</style>
        </head>
        <body>
          <div class="receipt" dir="${direction}">
            ${content}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "";
    return new Date(date).toLocaleString("en-SA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  const getPaymentMethodLabel = (method: string | null) => {
    if (!method) return "";
    if (method === "split") return t("splitPayment");
    if (method === "stc_pay") return t("stcPay");
    if (method === "hungerstation") return "Hungerstation";
    if (method === "jahez") return "Jahez";
    return t(method);
  };

  const getItemCount = () => {
    return invoice?.order?.items?.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0) || 0;
  };

  // Extract external order number from notes (e.g. "[HUNGERSTATION] HS12345" or "[JAHEZ] JH12345")
  const getExternalOrderInfo = () => {
    if (invoice?.order?.orderType !== "delivery" || !invoice?.order?.notes) return null;
    const notes = invoice.order.notes;
    const match = notes.match(/\[(HUNGERSTATION|JAHEZ)\]\s*(.*)/i);
    if (match) {
      return { platform: match[1], orderNumber: match[2] };
    }
    return { platform: null, orderNumber: notes };
  };

  // Build restaurant address line
  const getRestaurantAddress = () => {
    const r = invoice?.restaurant;
    if (!r) return "";
    const parts = [];
    if (r.city) parts.push(r.city);
    if (r.streetName) parts.push(r.streetName);
    if (r.district) parts.push(r.district);
    if (parts.length === 0 && r.address) return r.address;
    return parts.join(" - ");
  };

  if (isLoading || !invoice) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const externalInfo = getExternalOrderInfo();
  const restaurantAddress = getRestaurantAddress();
  const restaurantName = getLocalizedName(invoice.restaurant?.nameEn, invoice.restaurant?.nameAr);
  const itemCount = getItemCount();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{invoice.invoiceNumber}</span>
            <Button size="sm" variant="outline" onClick={handlePrint} data-testid="button-print-invoice">
              <Printer className="h-4 w-4 me-1" />
              {t("printInvoice")}
            </Button>
          </DialogTitle>
        </DialogHeader>

        {/* ===== RECEIPT CONTENT (Dank-style thermal receipt) ===== */}
        <div ref={printRef} className="bg-white text-black rounded-lg border font-mono text-xs leading-relaxed" dir={direction} style={{ maxWidth: '80mm', margin: '0 auto', padding: '12px 8px' }}>

          {/* === HEADER: Logo + Restaurant Info === */}
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            {invoice.restaurant?.logo && (
              <img
                src={invoice.restaurant.logo}
                alt="logo"
                crossOrigin="anonymous"
                referrerPolicy="no-referrer"
                style={{ maxWidth: '80px', maxHeight: '80px', margin: '0 auto 6px', display: 'block', objectFit: 'contain', borderRadius: '8px' }}
              />
            )}
            {/* Bilingual restaurant name */}
            {invoice.restaurant?.nameAr && (
              <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '1px' }}>
                {invoice.restaurant.nameAr}
              </div>
            )}
            {invoice.restaurant?.nameEn && (
              <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '4px', color: '#333' }}>
                {invoice.restaurant.nameEn}
              </div>
            )}
            {restaurantAddress && (
              <div style={{ fontSize: '10px', color: '#333' }}>
                {restaurantAddress}
              </div>
            )}
            {invoice.restaurant?.vatNumber && (
              <div style={{ fontSize: '10px', color: '#333', marginTop: '2px' }}>
                الرقم الضريبي / VAT: {invoice.restaurant.vatNumber}
              </div>
            )}
            {invoice.restaurant?.commercialRegistration && (
              <div style={{ fontSize: '10px', color: '#333', marginTop: '1px' }}>
                س.ت / CR: {invoice.restaurant.commercialRegistration}
              </div>
            )}
            {invoice.restaurant?.phone && (
              <div style={{ fontSize: '10px', color: '#333', marginTop: '1px' }}>
                خدمة العملاء / Customer Service: {invoice.restaurant.phone}
              </div>
            )}
          </div>

          {/* === Divider === */}
          <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '8px 0' }} />

          {/* === SIMPLIFIED TAX INVOICE Title === */}
          <div style={{ textAlign: 'center', margin: '4px 0' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>فاتورة ضريبية مبسطة</div>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#333' }}>Simplified Tax Invoice</div>
          </div>

          {/* === Divider === */}
          <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '8px 0' }} />

          {/* === ORDER NUMBER (Big box) === */}
          <div style={{ border: '2px solid #000', textAlign: 'center', padding: '6px', margin: '8px 0' }}>
            <div style={{ fontSize: '13px', fontWeight: 'bold' }}>الطلب #{invoice.order?.orderNumber || invoice.invoiceCounter || '—'}</div>
          </div>

          {/* === Invoice Details - bilingual separate lines === */}
          <div style={{ marginBottom: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1px', fontSize: '11px' }}>
              <span>رقم الفاتورة</span>
              <span style={{ fontWeight: 'bold' }}>{invoice.invoiceNumber}</span>
            </div>
            <div style={{ fontSize: '10px', color: '#555', marginBottom: '4px' }}>Invoice #</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1px', fontSize: '11px' }}>
              <span>التاريخ</span>
              <span>{formatDate(invoice.issuedAt)}</span>
            </div>
            <div style={{ fontSize: '10px', color: '#555', marginBottom: '2px' }}>Date</div>
          </div>

          {/* === Divider === */}
          <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '8px 0' }} />

          {/* === Order Type + Delivery Info - bilingual === */}
          <div style={{ marginBottom: '6px' }}>
            {invoice.order?.orderType && (
              <>
                <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '1px' }}>
                  {invoice.order.orderType === 'delivery' ? 'توصيل' : invoice.order.orderType === 'dine_in' ? 'داخل المطعم' : 'استلام'}
                </div>
                <div style={{ fontSize: '10px', color: '#555', marginBottom: '4px' }}>
                  {invoice.order.orderType === 'delivery' ? 'Delivery' : invoice.order.orderType === 'dine_in' ? 'Dine In' : 'Pickup'}
                </div>
              </>
            )}

            {/* Customer Info */}
            {invoice.customerName && (
              <div style={{ fontSize: '11px', marginBottom: '2px' }}>
                العميل : {invoice.customerName}
              </div>
            )}
            {invoice.customerPhone && (
              <div style={{ fontSize: '11px', marginBottom: '2px' }}>
                الجوال : {invoice.customerPhone}
              </div>
            )}

            {/* External Order (Delivery Platform) */}
            {externalInfo && (
              <div style={{ fontSize: '11px', marginBottom: '2px' }}>
                الرقم الخارجي: {externalInfo.platform ? `${externalInfo.platform}: ` : ''}{externalInfo.orderNumber}
              </div>
            )}
          </div>

          {/* === Divider === */}
          <hr style={{ border: 'none', borderTop: '2px solid #000', margin: '8px 0' }} />

          {/* === ITEMS TABLE === */}
          <div style={{ marginBottom: '4px' }}>
            {/* Header row - Arabic line then English line */}
            <div style={{ fontSize: '10px', fontWeight: 'bold', marginBottom: '2px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ width: '30px' }}>الكمية</span>
              <span style={{ flex: 1, textAlign: 'center' }}>المنتج</span>
              <span style={{ width: '65px', textAlign: 'end' }}>السعر</span>
            </div>
            <div style={{ fontSize: '9px', fontWeight: 'bold', marginBottom: '6px', borderBottom: '1px solid #000', paddingBottom: '4px', display: 'flex', justifyContent: 'space-between', color: '#555' }}>
              <span style={{ width: '30px' }}>Qty</span>
              <span style={{ flex: 1, textAlign: 'center' }}>Item</span>
              <span style={{ width: '65px', textAlign: 'end' }}>Price</span>
            </div>

            {/* Item rows - show both Arabic and English names on separate lines */}
            {invoice.order?.items?.map((item: any) => {
              const nameEn = item.menuItem?.nameEn || item.itemName || '';
              const nameAr = item.menuItem?.nameAr || '';

              return (
                <div key={item.id} style={{ marginBottom: '8px' }}>
                  {/* Main line: qty + English name + price */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ width: '30px' }}>{item.quantity}</span>
                    <span style={{ flex: 1, fontWeight: 'bold', paddingInline: '4px' }}>
                      {nameEn}
                    </span>
                    <span style={{ width: '65px', textAlign: 'end', fontWeight: 'bold' }}>
                      {item.totalPrice} ر.س
                    </span>
                  </div>
                  {/* Arabic name */}
                  {nameAr && nameAr !== nameEn && (
                    <div style={{ fontSize: '10px', color: '#333', paddingInlineStart: '34px', marginTop: '1px' }}>
                      {nameAr}
                    </div>
                  )}
                  {/* Notes / customizations */}
                  {item.notes && (
                    <div style={{ fontSize: '9px', color: '#555', paddingInlineStart: '34px', marginTop: '1px' }}>
                      {item.notes}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* === Divider === */}
          <hr style={{ border: 'none', borderTop: '2px solid #000', margin: '8px 0' }} />

          {/* === TOTALS - bilingual separate lines === */}
          <div style={{ marginBottom: '4px' }}>
            {/* Subtotal */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1px', fontSize: '12px' }}>
              <span>المجموع الفرعي</span>
              <span>{invoice.subtotal} ر.س</span>
            </div>
            <div style={{ fontSize: '10px', color: '#555', marginBottom: '4px' }}>Subtotal</div>

            {parseFloat(invoice.discount || "0") > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1px', fontSize: '12px', color: '#16a34a' }}>
                  <span>الخصم</span>
                  <span>-{invoice.discount} ر.س</span>
                </div>
                <div style={{ fontSize: '10px', color: '#16a34a', marginBottom: '4px' }}>Discount</div>
              </>
            )}

            {parseFloat(invoice.deliveryFee || "0") > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1px', fontSize: '12px' }}>
                  <span>رسوم التوصيل</span>
                  <span>{invoice.deliveryFee} ر.س</span>
                </div>
                <div style={{ fontSize: '10px', color: '#555', marginBottom: '4px' }}>Delivery Fee</div>
              </>
            )}

            {/* VAT */}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1px', fontSize: '12px' }}>
              <span>VAT {invoice.taxRate || '15'}%({invoice.taxRate || '15'}.0%)</span>
              <span>{invoice.taxAmount} ر.س</span>
            </div>
            <div style={{ fontSize: '10px', color: '#555', marginBottom: '4px' }}>({invoice.taxRate || '15'}.0%) ضريبة القيمة المضافة {invoice.taxRate || '15'}%</div>

            <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '6px 0' }} />

            {/* Grand Total */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 'bold', marginBottom: '1px' }}>
              <span>الإجمالي</span>
              <span>{invoice.total} ر.س</span>
            </div>
            <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#555', marginBottom: '2px' }}>Total</div>
          </div>

          {/* === Divider === */}
          <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '8px 0' }} />

          {/* === PAYMENT METHOD - bilingual separate lines === */}
          {invoice.paymentMethod && (
            <div style={{ margin: '6px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1px', fontSize: '12px', fontWeight: 'bold' }}>
                <span>الدفع - {getPaymentMethodLabel(invoice.paymentMethod)}</span>
                <span>{invoice.total} ر.س</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#555', marginBottom: '4px' }}>
                <span>Payment - {getPaymentMethodLabel(invoice.paymentMethod)}</span>
                <span>{invoice.total} ر.س</span>
              </div>
            </div>
          )}

          {/* === Product Count === */}
          <div style={{ fontSize: '11px', margin: '6px 0' }}>
            عدد المنتجات {itemCount}
          </div>

          {/* === Divider === */}
          <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '8px 0' }} />

          {/* === QR Code === */}
          {invoice.qrCodeData && (
            <div style={{ textAlign: 'center', margin: '8px 0' }}>
              <QRCodeSVG
                value={invoice.qrCodeData}
                size={130}
                level="M"
                style={{ margin: '0 auto' }}
              />
            </div>
          )}

          {/* === Footer === */}
          <div style={{ textAlign: 'center', fontSize: '10px', color: '#555', marginTop: '8px' }}>
            <p>شكراً لزيارتكم</p>
            <p style={{ marginTop: '1px' }}>Thank you for your visit</p>
          </div>

          {/* === Powered by Trying === */}
          <div style={{ textAlign: 'center', fontSize: '9px', color: '#999', marginTop: '10px', borderTop: '1px dotted #ccc', paddingTop: '6px' }}>
            <span>Powered by </span>
            <span style={{ fontWeight: 'bold', color: '#666' }}>Trying</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

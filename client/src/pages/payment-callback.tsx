import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, Globe, Printer, Download, ShoppingBag } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { apiRequest } from "@/lib/queryClient";
import { QRCodeSVG } from "qrcode.react";

interface InvoiceItem {
  id: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  notes?: string | null;
  itemName?: string | null;
  menuItem?: { nameEn: string; nameAr: string; price: string };
}

interface PublicInvoice {
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
  zatcaStatus: string | null;
  uuid: string | null;
  invoiceCounter: number | null;
  invoiceHash: string | null;
  createdAt: string | null;
  issuedAt: string | null;
  order: {
    id: string;
    orderNumber: string;
    orderType: string;
    total: string;
    notes?: string | null;
    items: InvoiceItem[];
  };
  restaurant: {
    nameEn: string;
    nameAr: string;
    vatNumber: string | null;
    commercialRegistration: string | null;
    address: string | null;
    phone: string | null;
    logo: string | null;
    city: string | null;
    streetName: string | null;
    district: string | null;
  } | null;
}

// Thermal receipt CSS for print window — identical to cashier invoice
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

export default function PaymentCallbackPage() {
  const { orderId } = useParams<{ orderId: string }>(); // This could be sessionId or orderId
  const [, setLocation] = useLocation();
  const { language, setLanguage, direction, t, getLocalizedName } = useLanguage();
  const [status, setStatus] = useState<"loading" | "success" | "failed">("loading");
  const [message, setMessage] = useState("");
  const [invoice, setInvoice] = useState<PublicInvoice | null>(null);
  const [realOrderId, setRealOrderId] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const toggleLanguage = () => {
    setLanguage(language === "ar" ? "en" : "ar");
  };

  useEffect(() => {
    let completed = false;
    const verifyPayment = async () => {
      if (completed) return;
      completed = true;
      try {
        const urlParams = new URLSearchParams(window.location.search);

        const transId = urlParams.get("trans_id") || urlParams.get("order_id");
        const paymentStatus = urlParams.get("status");
        const gwayId = urlParams.get("trans_id") || urlParams.get("gway_id");
        const legacyId = urlParams.get("id");
        const isSession = urlParams.get("session") === "true";

        if (paymentStatus === "fail" || paymentStatus === "failed" || paymentStatus === "declined") {
          setStatus("failed");
          setMessage(language === "ar" ? "لم يتم إكمال الدفع" : "Payment was not completed");
          return;
        }

        // Try to complete payment with retries (webhook may arrive with slight delay)
        const maxRetries = 3;
        let lastError = "";
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          if (attempt > 0) {
            await new Promise(r => setTimeout(r, 2000 * attempt));
          }
          
          // Build request body - use sessionId for new flow, orderId for legacy
          const body: any = {
            transId: transId || legacyId || undefined,
            gwayId: gwayId || transId || legacyId || undefined,
          };
          if (isSession) {
            body.sessionId = orderId; // The URL param is actually a sessionId
          } else {
            body.orderId = orderId;
          }

          const completeRes = await apiRequest("POST", "/api/payments/complete", body);

          if (completeRes.ok) {
            const orderData = await completeRes.json();
            setStatus("success");
            setMessage(language === "ar" ? "تم الدفع بنجاح" : "Payment successful");
            
            // Store real orderId for invoice display
            const actualOrderId = orderData?.id || orderId;
            setRealOrderId(actualOrderId);

            try {
              const invoiceRes = await fetch(`/api/public/orders/${actualOrderId}/invoice`);
              if (invoiceRes.ok) {
                const invoiceData = await invoiceRes.json();
                setInvoice(invoiceData);
              }
            } catch {
              // Invoice display is optional
            }
            return;
          } else {
            const errorData = await completeRes.json().catch(() => ({}));
            lastError = errorData.error || "";
            console.log(`Payment verification attempt ${attempt + 1}/${maxRetries} failed: ${lastError}`);
            if (lastError && !lastError.includes("unknown") && !lastError.includes("expired")) {
              break;
            }
          }
        }
        
        setStatus("failed");
        setMessage(lastError || (language === "ar" ? "فشل الدفع" : "Payment failed"));
      } catch (err) {
        console.error("Payment verification error:", err);
        setStatus("failed");
        setMessage(language === "ar" ? "حدث خطأ أثناء التحقق من الدفع" : "Error verifying payment");
      }
    };

    verifyPayment();
  }, [orderId]);

  const formatDate = (date: string | null) => {
    if (!date) return "";
    return new Date(date).toLocaleString("en-GB", {
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
    if (method === "edfapay_online") return "دفع إلكتروني / Online Payment";
    if (method === "split") return t("splitPayment");
    if (method === "stc_pay") return t("stcPay");
    if (method === "hungerstation") return "Hungerstation";
    if (method === "jahez") return "Jahez";
    return t(method);
  };

  const getItemCount = () => {
    return invoice?.order?.items?.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0) || 0;
  };

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

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const content = printRef.current.innerHTML;
    printWindow.document.write(`
      <html>
        <head>
          <title>فاتورة ضريبية - ${invoice?.invoiceNumber || ""}</title>
          <style>${receiptCSS}</style>
        </head>
        <body>
          <div class="receipt" dir="rtl">
            ${content}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
  };

  const restaurantAddress = invoice ? getRestaurantAddress() : "";
  const itemCount = getItemCount();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4" dir={direction}>
      <div className="w-full max-w-lg">
        <div className="flex justify-end mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleLanguage}
            className="gap-2"
            data-testid="button-callback-toggle-language"
          >
            <Globe className="h-4 w-4" />
            {language === "ar" ? "EN" : "عربي"}
          </Button>
        </div>

        {/* Loading State */}
        {status === "loading" && (
          <Card data-testid="card-payment-result">
            <CardContent className="p-8 text-center space-y-6">
              <Loader2 className="h-16 w-16 animate-spin text-orange-600 dark:text-orange-400 mx-auto" />
              <div>
                <h2 className="text-xl font-bold mb-2">
                  {language === "ar" ? "جاري التحقق من الدفع..." : "Verifying payment..."}
                </h2>
                <p className="text-muted-foreground">
                  {language === "ar" ? "يرجى الانتظار" : "Please wait"}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Failed State */}
        {status === "failed" && (
          <Card data-testid="card-payment-result">
            <CardContent className="p-8 text-center space-y-6">
              <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
                <XCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold mb-2" data-testid="text-payment-failed">
                  {language === "ar" ? "فشل الدفع" : "Payment Failed"}
                </h2>
                <p className="text-muted-foreground">{message}</p>
              </div>
              <div className="space-y-2">
                <Button
                  onClick={() => setLocation(`/payment/${orderId}`)}
                  className="w-full"
                  data-testid="button-retry-payment"
                >
                  {language === "ar" ? "إعادة المحاولة" : "Try Again"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setLocation(`/order-status/${orderId}`)}
                  className="w-full"
                  data-testid="button-view-order-failed"
                >
                  {language === "ar" ? "عرض حالة الطلب" : "View Order Status"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Success State with Invoice */}
        {status === "success" && (
          <div className="space-y-4">
            {/* Success Banner */}
            <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
              <CardContent className="p-6 text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-lg font-bold text-green-800 dark:text-green-200" data-testid="text-payment-success">
                  {language === "ar" ? "تم الدفع بنجاح!" : "Payment Successful!"}
                </h2>
                <p className="text-sm text-green-700 dark:text-green-300">{message}</p>
              </CardContent>
            </Card>

            {/* Invoice Display - Matches Cashier Thermal Receipt */}
            {invoice && (
              <Card>
                <CardContent className="p-0">
                  {/* Invoice Actions */}
                  <div className="flex gap-2 p-4 border-b">
                    <Button size="sm" variant="outline" onClick={handlePrint} className="flex-1">
                      <Printer className="h-4 w-4 me-1" />
                      {language === "ar" ? "طباعة" : "Print"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={handlePrint} className="flex-1">
                      <Download className="h-4 w-4 me-1" />
                      PDF
                    </Button>
                  </div>

                  {/* ===== RECEIPT CONTENT (Same as cashier thermal receipt) ===== */}
                  <div ref={printRef} className="bg-white text-black rounded-lg border font-mono text-xs leading-relaxed" dir="rtl" style={{ maxWidth: '80mm', margin: '0 auto', padding: '12px 8px' }}>

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

                    {/* === PAID Badge === */}
                    <div style={{ textAlign: 'center', margin: '6px 0' }}>
                      <span style={{ display: 'inline-block', padding: '3px 12px', border: '2px solid #16a34a', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', color: '#16a34a' }}>
                        ✓ مدفوعة / PAID
                      </span>
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
                        <span>{formatDate(invoice.issuedAt || invoice.createdAt)}</span>
                      </div>
                      <div style={{ fontSize: '10px', color: '#555', marginBottom: '2px' }}>Date</div>
                    </div>

                    {/* === Divider === */}
                    <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '8px 0' }} />

                    {/* === Order Type + Customer Info - bilingual === */}
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

                      {/* Item rows - show both Arabic and English names */}
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

                    {/* === PAYMENT METHOD - bilingual === */}
                    {invoice.paymentMethod && (
                      <div style={{ margin: '6px 0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1px', fontSize: '12px', fontWeight: 'bold' }}>
                          <span>الدفع - {getPaymentMethodLabel(invoice.paymentMethod)}</span>
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
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            <Button
              onClick={() => setLocation(`/order-status/${orderId}`)}
              className="w-full"
              size="lg"
              data-testid="button-view-order-status"
            >
              <ShoppingBag className="h-4 w-4 me-2" />
              {language === "ar" ? "تتبع الطلب" : "Track Order"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

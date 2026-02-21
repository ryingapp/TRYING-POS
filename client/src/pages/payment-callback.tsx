import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Loader2, Globe, Printer, Download, Receipt, MapPin, ShoppingBag } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { apiRequest } from "@/lib/queryClient";
import { QRCodeSVG } from "qrcode.react";

interface InvoiceItem {
  id: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
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
  paymentMethod: string | null;
  isPaid: boolean | null;
  qrCodeData: string | null;
  zatcaStatus: string | null;
  uuid: string | null;
  invoiceCounter: number | null;
  createdAt: string | null;
  issuedAt: string | null;
  order: {
    id: string;
    orderNumber: string;
    orderType: string;
    total: string;
    items: InvoiceItem[];
  };
  restaurant: {
    nameEn: string;
    nameAr: string;
    vatNumber: string | null;
    commercialRegistration: string | null;
    address: string | null;
    phone: string | null;
    city: string | null;
    logoUrl: string | null;
  } | null;
}

export default function PaymentCallbackPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [, setLocation] = useLocation();
  const { language, setLanguage, direction, t, getLocalizedName } = useLanguage();
  const [status, setStatus] = useState<"loading" | "success" | "failed">("loading");
  const [message, setMessage] = useState("");
  const [invoice, setInvoice] = useState<PublicInvoice | null>(null);
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
        const paymentId = urlParams.get("id");
        const paymentStatus = urlParams.get("status");

        if (!paymentId) {
          setStatus("failed");
          setMessage(language === "ar" ? "معرّف الدفع غير موجود" : "Payment ID not found");
          return;
        }

        // Check if Moyasar reported a failed payment
        if (paymentStatus === "failed") {
          setStatus("failed");
          setMessage(language === "ar" ? "لم يتم إكمال الدفع" : "Payment was not completed");
          return;
        }

        const completeRes = await apiRequest("POST", "/api/payments/complete", {
          orderId,
          paymentId,
        });

        if (completeRes.ok) {
          setStatus("success");
          setMessage(language === "ar" ? "تم الدفع بنجاح" : "Payment successful");

          // Fetch invoice
          try {
            const invoiceRes = await fetch(`/api/public/orders/${orderId}/invoice`);
            if (invoiceRes.ok) {
              const invoiceData = await invoiceRes.json();
              setInvoice(invoiceData);
            }
          } catch {
            // Invoice display is optional — don't block success
          }
        } else {
          const errorData = await completeRes.json();
          setStatus("failed");
          setMessage(errorData.error || (language === "ar" ? "فشل الدفع" : "Payment failed"));
        }
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
    return new Date(date).toLocaleString(language === "ar" ? "ar-SA" : "en-SA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    const content = printRef.current.innerHTML;
    printWindow.document.write(`
      <html>
        <head>
          <title>${language === "ar" ? "فاتورة ضريبية" : "Tax Invoice"} - ${invoice?.invoiceNumber || ""}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Segoe UI', Tahoma, sans-serif;
              padding: 16px;
              direction: ${direction};
              background: #fff;
              color: #000;
            }
            .invoice-print { max-width: 80mm; margin: 0 auto; }
            .text-center { text-align: center; }
            .text-lg { font-size: 18px; }
            .text-sm { font-size: 13px; }
            .text-xs { font-size: 11px; }
            .font-bold { font-weight: bold; }
            .font-medium { font-weight: 500; }
            .font-semibold { font-weight: 600; }
            .text-gray-500 { color: #888; }
            .text-gray-600 { color: #666; }
            .text-green-600 { color: #16a34a; }
            .mb-4 { margin-bottom: 16px; }
            .mb-3 { margin-bottom: 12px; }
            .mb-2 { margin-bottom: 8px; }
            .mb-1 { margin-bottom: 4px; }
            .mt-4 { margin-top: 16px; }
            .mt-1 { margin-top: 4px; }
            .my-3 { margin-top: 12px; margin-bottom: 12px; }
            .mx-auto { margin-left: auto; margin-right: auto; }
            .space-y-1 > * + * { margin-top: 4px; }
            .space-y-2 > * + * { margin-top: 8px; }
            .flex { display: flex; }
            .justify-between { justify-content: space-between; }
            .items-center { align-items: center; }
            .gap-1 { gap: 4px; }
            .gap-2 { gap: 8px; }
            .p-4 { padding: 16px; }
            .separator { border: none; border-top: 1px dashed #ccc; margin: 12px 0; }
            .paid-badge {
              display: inline-flex; align-items: center; gap: 4px;
              padding: 4px 12px; border-radius: 9999px; font-size: 13px; font-weight: 600;
              background: #dcfce7; color: #16a34a; border: 1px solid #bbf7d0;
            }
            [data-orientation="horizontal"] { border: none; border-top: 1px dashed #ccc; margin: 12px 0; height: 0; }
            @media print { body { padding: 0; } .no-print { display: none !important; } }
          </style>
        </head>
        <body><div class="invoice-print">${content}</div></body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
  };

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

            {/* Invoice Display */}
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

                  {/* Printable Invoice Content */}
                  <div ref={printRef} className="bg-white text-black p-5" dir={direction}>
                    {/* Restaurant Header */}
                    <div className="text-center mb-4">
                      {invoice.restaurant?.logoUrl && (
                        <img 
                          src={invoice.restaurant.logoUrl} 
                          alt="" 
                          className="h-12 w-12 rounded-full mx-auto mb-2 object-cover"
                        />
                      )}
                      <h2 className="text-lg font-bold">
                        {getLocalizedName(invoice.restaurant?.nameEn, invoice.restaurant?.nameAr)}
                      </h2>
                      {invoice.restaurant?.vatNumber && (
                        <p className="text-xs text-gray-600">
                          {language === "ar" ? "الرقم الضريبي" : "VAT No"}: {invoice.restaurant.vatNumber}
                        </p>
                      )}
                      {invoice.restaurant?.commercialRegistration && (
                        <p className="text-xs text-gray-600">
                          {language === "ar" ? "السجل التجاري" : "CR"}: {invoice.restaurant.commercialRegistration}
                        </p>
                      )}
                      {invoice.restaurant?.address && (
                        <p className="text-xs text-gray-500">{invoice.restaurant.address}</p>
                      )}
                      {invoice.restaurant?.phone && (
                        <p className="text-xs text-gray-500">{invoice.restaurant.phone}</p>
                      )}
                    </div>

                    {/* Invoice Title + Paid Badge */}
                    <div className="text-center mb-3">
                      <h3 className="font-semibold text-sm mb-1">
                        {language === "ar" ? "فاتورة ضريبية مبسطة" : "Simplified Tax Invoice"}
                      </h3>
                      <span className="paid-badge inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-700 border border-green-300">
                        &#10003; {language === "ar" ? "مدفوعة" : "PAID"}
                      </span>
                    </div>

                    <Separator className="my-3" />

                    {/* Invoice Meta */}
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-gray-600">{language === "ar" ? "رقم الفاتورة" : "Invoice #"}:</span>
                        <span className="font-medium">{invoice.invoiceNumber}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">{language === "ar" ? "رقم الطلب" : "Order #"}:</span>
                        <span className="font-medium">{invoice.order?.orderNumber || "-"}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">{language === "ar" ? "التاريخ" : "Date"}:</span>
                        <span>{formatDate(invoice.issuedAt || invoice.createdAt)}</span>
                      </div>
                      {invoice.customerName && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">{language === "ar" ? "العميل" : "Customer"}:</span>
                          <span>{invoice.customerName}</span>
                        </div>
                      )}
                      {invoice.paymentMethod && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">{language === "ar" ? "طريقة الدفع" : "Payment"}:</span>
                          <span>{invoice.paymentMethod === "moyasar_online" ? (language === "ar" ? "دفع إلكتروني" : "Online") : invoice.paymentMethod}</span>
                        </div>
                      )}
                    </div>

                    <Separator className="my-3" />

                    {/* Order Items */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {language === "ar" ? "تفاصيل الطلب" : "Order Details"}
                      </h4>
                      {invoice.order?.items?.map((item) => (
                        <div key={item.id} className="text-sm">
                          <div className="flex justify-between">
                            <span>
                              {getLocalizedName(item.menuItem?.nameEn, item.menuItem?.nameAr)} × {item.quantity}
                            </span>
                            <span className="font-medium">{item.totalPrice} {language === "ar" ? "ريال" : "SAR"}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <Separator className="my-3" />

                    {/* Totals */}
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span>{language === "ar" ? "المجموع الفرعي" : "Subtotal"}:</span>
                        <span>{invoice.subtotal} {language === "ar" ? "ريال" : "SAR"}</span>
                      </div>
                      {parseFloat(invoice.discount || "0") > 0 && (
                        <div className="flex justify-between text-green-600">
                          <span>{language === "ar" ? "الخصم" : "Discount"}:</span>
                          <span>-{invoice.discount} {language === "ar" ? "ريال" : "SAR"}</span>
                        </div>
                      )}
                      {parseFloat(invoice.deliveryFee || "0") > 0 && (
                        <div className="flex justify-between">
                          <span>{language === "ar" ? "رسوم التوصيل" : "Delivery Fee"}:</span>
                          <span>{invoice.deliveryFee} {language === "ar" ? "ريال" : "SAR"}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>{language === "ar" ? "ضريبة القيمة المضافة" : "VAT"} ({invoice.taxRate || "15"}%):</span>
                        <span>{invoice.taxAmount} {language === "ar" ? "ريال" : "SAR"}</span>
                      </div>
                      <Separator className="my-2" />
                      <div className="flex justify-between font-bold text-base">
                        <span>{language === "ar" ? "الإجمالي" : "Total"}:</span>
                        <span>{invoice.total} {language === "ar" ? "ريال" : "SAR"}</span>
                      </div>
                    </div>

                    {/* QR Code */}
                    {invoice.qrCodeData && (
                      <div className="text-center mt-4">
                        <QRCodeSVG
                          value={invoice.qrCodeData}
                          size={120}
                          level="M"
                          className="mx-auto"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          {language === "ar" ? "متوافق مع زاتكا" : "ZATCA Compliant"}
                        </p>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="text-center mt-4 text-xs text-gray-500">
                      <p>شكراً لزيارتكم - Thank you for your visit</p>
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

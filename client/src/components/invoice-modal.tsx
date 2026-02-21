import { useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer, Download, MessageCircle, CheckCircle, FileText, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
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

export function InvoiceModal({ open, onClose, invoiceId, orderId, autoPrint, onAutoPrintDone }: InvoiceModalProps) {
  const { t, language, getLocalizedName } = useLanguage();
  const printRef = useRef<HTMLDivElement>(null);
  const autoPrintDoneRef = useRef(false);

  const { data: invoice, isLoading } = useQuery<InvoiceData>({
    queryKey: orderId ? ["/api/orders", orderId, "invoice"] : ["/api/invoices", invoiceId],
    enabled: open && (!!invoiceId || !!orderId),
  });

  const direction = language === "ar" ? "rtl" : "ltr";
  const isPaid = invoice?.isPaid === true;

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
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Segoe UI', Tahoma, sans-serif;
              padding: 16px;
              direction: ${direction};
              background: #fff;
              color: #000;
            }
            .invoice-print-content {
              max-width: 80mm;
              margin: 0 auto;
            }
            .text-center { text-align: center; }
            .text-lg { font-size: 18px; }
            .text-sm { font-size: 13px; }
            .text-xs { font-size: 11px; }
            .font-bold { font-weight: bold; }
            .font-medium { font-weight: 500; }
            .text-gray-600 { color: #666; }
            .text-gray-500 { color: #888; }
            .text-green-600 { color: #16a34a; }
            .text-red-600 { color: #dc2626; }
            .mb-4 { margin-bottom: 16px; }
            .mb-3 { margin-bottom: 12px; }
            .mb-2 { margin-bottom: 8px; }
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
            .px-3 { padding-left: 12px; padding-right: 12px; }
            .py-1 { padding-top: 4px; padding-bottom: 4px; }
            .my-2 { margin-top: 8px; margin-bottom: 8px; }
            .me-1 { margin-inline-end: 4px; }
            .rounded-lg { border-radius: 8px; }
            .rounded-full { border-radius: 9999px; }
            .border { border: 1px solid #e5e7eb; }
            .border-green-300 { border-color: #86efac; }
            .border-red-300 { border-color: #fca5a5; }
            .bg-white { background: #fff; }
            .bg-green-100 { background: #dcfce7; }
            .bg-red-100 { background: #fef2f2; }
            .text-black { color: #000; }
            .text-green-700 { color: #15803d; }
            .text-red-700 { color: #b91c1c; }
            .text-base { font-size: 16px; }
            .font-semibold { font-weight: 600; }
            .inline-flex { display: inline-flex; }
            .w-28 { width: 112px; }
            .h-28 { height: 112px; }
            .separator { border: none; border-top: 1px dashed #ccc; margin: 12px 0; }
            .paid-badge {
              display: inline-flex;
              align-items: center;
              gap: 4px;
              padding: 4px 12px;
              border-radius: 9999px;
              font-size: 13px;
              font-weight: 600;
              background: #dcfce7;
              color: #16a34a;
              border: 1px solid #bbf7d0;
            }
            .unpaid-badge {
              display: inline-flex;
              align-items: center;
              gap: 4px;
              padding: 4px 12px;
              border-radius: 9999px;
              font-size: 13px;
              font-weight: 600;
              background: #fef2f2;
              color: #dc2626;
              border: 1px solid #fecaca;
            }
            .qr-img { width: 120px; height: 120px; }
            .zatca-badge {
              display: inline-flex;
              align-items: center;
              gap: 4px;
              padding: 2px 8px;
              border: 1px solid #16a34a;
              color: #16a34a;
              border-radius: 4px;
              font-size: 11px;
            }
            [data-orientation="horizontal"] {
              border: none;
              border-top: 1px dashed #ccc;
              margin: 12px 0;
              height: 0;
            }
            @media print {
              body { padding: 0; }
              .no-print { display: none !important; }
            }
          </style>
        </head>
        <body>
          <div class="invoice-print-content">
            ${content}
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
  };

  const handleDownloadPDF = () => {
    handlePrint();
  };

  const handleSendWhatsApp = () => {
    if (invoice?.customerPhone) {
      const phone = invoice.customerPhone.replace(/[^0-9]/g, "");
      const message = encodeURIComponent(
        `${t("invoice")} #${invoice.invoiceNumber}\n` +
        `${t("total")}: ${invoice.total} ${t("sar")}\n` +
        `${t("taxAmount")}: ${invoice.taxAmount} ${t("sar")}\n` +
        `${isPaid ? t("paid") : t("unpaid")}`
      );
      window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "";
    return new Date(date).toLocaleString(language === "ar" ? "ar-SA" : "en-SA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // No longer needed — using qrcode.react component directly

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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {t("taxInvoice")}
            <Badge variant="outline" className="text-green-600 border-green-600">
              <CheckCircle className="h-3 w-3 me-1" />
              {t("zatcaCompliant")}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 mb-4">
          <Button size="sm" variant="outline" onClick={handlePrint} data-testid="button-print-invoice">
            <Printer className="h-4 w-4 me-1" />
            {t("printInvoice")}
          </Button>
          <Button size="sm" variant="outline" onClick={handleDownloadPDF} data-testid="button-download-pdf">
            <Download className="h-4 w-4 me-1" />
            PDF
          </Button>
          {invoice.customerPhone && (
            <Button size="sm" variant="outline" onClick={handleSendWhatsApp} data-testid="button-send-whatsapp">
              <MessageCircle className="h-4 w-4 me-1" />
              WhatsApp
            </Button>
          )}
          {invoice.xmlContent && (
            <Button size="sm" variant="outline" onClick={() => {
              window.open(`/api/zatca/xml/${invoice.id}`, '_blank');
            }}>
              <FileText className="h-4 w-4 me-1" />
              XML
            </Button>
          )}
          {invoice.xmlContent && (!invoice.zatcaStatus || invoice.zatcaStatus === 'pending') && (
            <Button size="sm" variant="default" onClick={async () => {
              try {
                const res = await fetch(`/api/zatca/submit/${invoice.id}`, {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' },
                });
                const data = await res.json();
                if (res.ok) {
                  alert(language === 'ar' ? 'تم الإرسال بنجاح' : 'Submitted successfully');
                } else {
                  alert(data.error || 'Submission failed');
                }
              } catch (err: any) {
                alert(err.message);
              }
            }}>
              <Send className="h-4 w-4 me-1" />
              {language === 'ar' ? 'إرسال ZATCA' : 'Submit ZATCA'}
            </Button>
          )}
        </div>

        <div ref={printRef} className="bg-white text-black p-4 rounded-lg border" dir={direction}>
          <div className="text-center mb-4">
            <h2 className="text-lg font-bold">
              {getLocalizedName(invoice.restaurant?.nameEn, invoice.restaurant?.nameAr)}
            </h2>
            {invoice.restaurant?.vatNumber && (
              <p className="text-xs text-gray-600">
                {t("vatNumber")}: {invoice.restaurant.vatNumber}
              </p>
            )}
            {invoice.restaurant?.commercialRegistration && (
              <p className="text-xs text-gray-600">
                {t("commercialReg")}: {invoice.restaurant.commercialRegistration}
              </p>
            )}
            {invoice.restaurant?.address && (
              <p className="text-xs text-gray-600">{invoice.restaurant.address}</p>
            )}
            {invoice.restaurant?.phone && (
              <p className="text-xs text-gray-600">{invoice.restaurant.phone}</p>
            )}
          </div>

          <div className="text-center mb-3">
            {isPaid ? (
              <span className={`paid-badge inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-green-100 text-green-700 border border-green-300`}>
                &#10003; {t("paid")}
              </span>
            ) : (
              <span className={`unpaid-badge inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold bg-red-100 text-red-700 border border-red-300`}>
                &#9888; {t("unpaid")}
              </span>
            )}
          </div>

          <Separator className="my-3" />

          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span>{t("invoiceNumber")}:</span>
              <span className="font-medium">{invoice.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span>{t("invoiceDate")}:</span>
              <span>{formatDate(invoice.issuedAt)}</span>
            </div>
            {invoice.customerName && (
              <div className="flex justify-between">
                <span>{t("customer")}:</span>
                <span>{invoice.customerName}</span>
              </div>
            )}
            {invoice.paymentMethod && (
              <div className="flex justify-between">
                <span>{t("paymentMethod")}:</span>
                <span>{invoice.paymentMethod === "split" ? t("splitPayment") : t(invoice.paymentMethod === "stc_pay" ? "stcPay" : invoice.paymentMethod)}</span>
              </div>
            )}
          </div>

          <Separator className="my-3" />

          <div className="space-y-2">
            {invoice.order?.items?.map((item) => (
              <div key={item.id} className="text-sm">
                <div className="flex justify-between">
                  <span>
                    {getLocalizedName(item.menuItem?.nameEn, item.menuItem?.nameAr)} x{item.quantity}
                  </span>
                  <span>{item.totalPrice} {t("sar")}</span>
                </div>
              </div>
            ))}
          </div>

          <Separator className="my-3" />

          <div className="text-sm space-y-1">
            <div className="flex justify-between">
              <span>{t("subtotal")}:</span>
              <span>{invoice.subtotal} {t("sar")}</span>
            </div>
            {parseFloat(invoice.discount || "0") > 0 && (
              <div className="flex justify-between text-green-600">
                <span>{t("discount")}:</span>
                <span>-{invoice.discount} {t("sar")}</span>
              </div>
            )}
            {parseFloat(invoice.deliveryFee || "0") > 0 && (
              <div className="flex justify-between">
                <span>{t("deliveryFee")}:</span>
                <span>{invoice.deliveryFee} {t("sar")}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>{t("tax")} ({invoice.taxRate}%):</span>
              <span>{invoice.taxAmount} {t("sar")}</span>
            </div>
            <Separator className="my-2" />
            <div className="flex justify-between font-bold text-base">
              <span>{t("grandTotal")}:</span>
              <span>{invoice.total} {t("sar")}</span>
            </div>
          </div>

          {invoice.qrCodeData && (
            <div className="text-center mt-4">
              <QRCodeSVG
                value={invoice.qrCodeData}
                size={120}
                level="M"
                className="mx-auto"
              />
              <p className="text-xs text-gray-500 mt-1">{t("zatcaCompliant")}</p>
              {invoice.zatcaStatus && (
                <Badge 
                  variant={
                    invoice.zatcaStatus === 'accepted' ? 'default' :
                    invoice.zatcaStatus === 'rejected' ? 'destructive' :
                    invoice.zatcaStatus === 'submitted' ? 'secondary' :
                    'outline'
                  }
                  className="mt-1 text-[10px]"
                >
                  {invoice.zatcaStatus === 'accepted' ? '✓ ZATCA Accepted' :
                   invoice.zatcaStatus === 'rejected' ? '✗ ZATCA Rejected' :
                   invoice.zatcaStatus === 'submitted' ? '⏳ Submitted' :
                   '⏳ Pending'}
                </Badge>
              )}
            </div>
          )}

          <div className="text-center mt-4 text-xs text-gray-500">
            <p>شكراً لزيارتكم - Thank you for your visit</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

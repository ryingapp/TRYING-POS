import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Search, FileText, Download, RefreshCw, Eye, ArrowLeftRight, AlertTriangle, Clock, CheckCircle, XCircle, Receipt, Filter, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { InvoiceModal } from "@/components/invoice-modal";
import { useBranch } from "@/lib/branch";
import type { Invoice, Restaurant } from "@shared/schema";

export default function InvoiceArchivePage() {
  const { language, direction } = useLanguage();
  const { toast } = useToast();
  const isRtl = direction === "rtl";
  const { selectedBranchId } = useBranch();

  // Filters
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [activeTab, setActiveTab] = useState("archive");

  // Modals
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  const [showDebitNoteDialog, setShowDebitNoteDialog] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [debitReason, setDebitReason] = useState("");
  const [refundItems, setRefundItems] = useState<any[]>([]);

  // Refund details fetch
  const { data: invoiceDetails, isLoading: isLoadingDetails } = useQuery<any>({
    queryKey: ["/api/orders", selectedInvoice?.orderId, "invoice"],
    enabled: !!selectedInvoice?.orderId && showRefundDialog,
  });

  // Populate refund items when data loads
  const [refundItemsPopulated, setRefundItemsPopulated] = useState(false);
  if (invoiceDetails?.order?.items && !refundItemsPopulated && showRefundDialog) {
     setRefundItems(invoiceDetails.order.items.map((i: any) => ({ ...i, refundQty: i.quantity, selected: false })));
     setRefundItemsPopulated(true);
  }
  // Reset flag when dialog closes
  if (!showRefundDialog && refundItemsPopulated) {
     setRefundItemsPopulated(false);
     setRefundItems([]);
  }

  const { data: restaurant } = useQuery<Restaurant>({
    queryKey: ["/api/restaurant"],
  });

  // Build search params
  const buildSearchParams = () => {
    const params = new URLSearchParams();
    if (selectedBranchId) params.set("branch", selectedBranchId);
    if (invoiceNumber) params.set("invoiceNumber", invoiceNumber);
    if (customerPhone) params.set("customerPhone", customerPhone);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (paymentMethod && paymentMethod !== "all") params.set("paymentMethod", paymentMethod);
    if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
    if (typeFilter && typeFilter !== "all") params.set("invoiceType", typeFilter);
    return params.toString();
  };

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices/search", selectedBranchId, invoiceNumber, customerPhone, startDate, endDate, paymentMethod, statusFilter, typeFilter],
    queryFn: async () => {
      const params = buildSearchParams();
      const res = await apiRequest("GET", `/api/invoices/search?${params}`);
      return res.json();
    },
  });

  const { data: auditLogs = [] } = useQuery({
    queryKey: ["/api/invoice-audit-log"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/invoice-audit-log?limit=100");
      return res.json();
    },
    enabled: activeTab === "audit",
  });

  const { data: taxReport } = useQuery({
    queryKey: ["/api/reports/tax", startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const res = await apiRequest("GET", `/api/reports/tax?${params}`);
      return res.json();
    },
    enabled: activeTab === "tax",
  });

  // Refund mutation
  const refundMutation = useMutation({
    mutationFn: async ({ invoiceId, reason, items }: { invoiceId: string; reason: string; items?: any[] }) => {
       const payloadItems = items?.filter(i => i.selected).map(i => ({
          id: i.id,
          menuItemId: i.menuItemId,
          quantity: Number(i.refundQty)
       }));
       if (payloadItems && payloadItems.length === 0) {
          // If items array was passed but nothing selected, maybe user expects full refund? 
          // But our UI will enforce selection. If items is undefined, it's full refund.
       }
       // If no items are selected in the list but the list is present, we should probably warn or send empty?
       // The backend treats "undefined" items as Full Refund. 
       // If we send empty array, backend might return error "No valid items found".
       const finalItems = (payloadItems && payloadItems.length > 0) ? payloadItems : undefined;
      return apiRequest("POST", `/api/invoices/${invoiceId}/refund`, { reason, items: finalItems });
    },
    onSuccess: () => {
      toast({ title: isRtl ? "تم الاسترجاع بنجاح" : "Refund processed successfully" });
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/invoices") });
      setShowRefundDialog(false);
      setRefundReason("");
      setRefundItems([]);
      setRefundItemsPopulated(false);
    },
    onError: (error: any) => {
      toast({ title: isRtl ? "خطأ في الاسترجاع" : "Refund failed", description: error.message, variant: "destructive" });
    },
  });

  // Debit note mutation
  const debitNoteMutation = useMutation({
    mutationFn: async ({ invoiceId, reason }: { invoiceId: string; reason: string }) => {
      return apiRequest("POST", `/api/invoices/${invoiceId}/debit-note`, { reason });
    },
    onSuccess: () => {
      toast({ title: isRtl ? "تم إنشاء إشعار مدين" : "Debit note created" });
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.startsWith("/api/invoices") });
      setShowDebitNoteDialog(false);
      setDebitReason("");
    },
    onError: (error: any) => {
      toast({ title: isRtl ? "خطأ" : "Error", description: error.message, variant: "destructive" });
    },
  });

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case "issued": return <Badge className="bg-green-500">{isRtl ? "مصدرة" : "Issued"}</Badge>;
      case "cancelled": return <Badge variant="destructive">{isRtl ? "ملغاة" : "Cancelled"}</Badge>;
      case "reported": return <Badge className="bg-blue-500">{isRtl ? "مبلغة" : "Reported"}</Badge>;
      case "draft": return <Badge variant="secondary">{isRtl ? "مسودة" : "Draft"}</Badge>;
      default: return <Badge variant="outline">{status || "-"}</Badge>;
    }
  };

  const getTypeBadge = (type: string | null) => {
    switch (type) {
      case "simplified": return <Badge variant="outline">{isRtl ? "مبسطة" : "Simplified"}</Badge>;
      case "standard": return <Badge className="bg-indigo-500">{isRtl ? "قياسية" : "Standard"}</Badge>;
      case "credit_note": return <Badge className="bg-orange-500">{isRtl ? "إشعار دائن" : "Credit Note"}</Badge>;
      case "debit_note": return <Badge className="bg-purple-500">{isRtl ? "إشعار مدين" : "Debit Note"}</Badge>;
      default: return <Badge variant="outline">{type || "-"}</Badge>;
    }
  };

  const getZatcaStatusIcon = (status: string | null) => {
    switch (status) {
      case "accepted": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "rejected": return <XCircle className="h-4 w-4 text-red-500" />;
      case "submitted": return <Clock className="h-4 w-4 text-blue-500" />;
      default: return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, { ar: string; en: string }> = {
      invoice_created: { ar: "إنشاء فاتورة", en: "Invoice Created" },
      credit_note_created: { ar: "إنشاء إشعار دائن", en: "Credit Note Created" },
      debit_note_created: { ar: "إنشاء إشعار مدين", en: "Debit Note Created" },
      invoice_cancelled: { ar: "إلغاء فاتورة", en: "Invoice Cancelled" },
      refund_issued: { ar: "استرجاع", en: "Refund Issued" },
      tax_settings_changed: { ar: "تغيير إعدادات الضريبة", en: "Tax Settings Changed" },
      invoice_submitted_zatca: { ar: "إرسال للهيئة", en: "ZATCA Submission" },
    };
    return labels[action]?.[isRtl ? "ar" : "en"] || action;
  };

  const formatCurrency = (amount: string | number | null) => {
    const num = parseFloat(String(amount || "0"));
    return `${num.toFixed(2)} ${isRtl ? "ر.س" : "SAR"}`;
  };

  return (
    <div className="p-4 md:p-6 space-y-4" dir={direction}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            {isRtl ? "الفواتير" : "Invoices"}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isRtl ? "إدارة الفواتير والإشعارات" : "Manage invoices and credit notes"}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="archive">{isRtl ? "الفواتير" : "Invoices"}</TabsTrigger>
          <TabsTrigger value="tax">{isRtl ? "تقرير الضريبة" : "Tax Report"}</TabsTrigger>
          <TabsTrigger value="audit">{isRtl ? "سجل العمليات" : "Audit Log"}</TabsTrigger>
        </TabsList>

        {/* === Invoices Tab === */}
        <TabsContent value="archive" className="space-y-4">
          {/* Search Filters */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4" />
                {isRtl ? "البحث والفلترة" : "Search & Filter"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs">{isRtl ? "رقم الفاتورة" : "Invoice Number"}</Label>
                  <Input
                    placeholder={isRtl ? "INV-2026-..." : "INV-2026-..."}
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">{isRtl ? "رقم الجوال" : "Phone Number"}</Label>
                  <Input
                    placeholder="05XXXXXXXX"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">{isRtl ? "من تاريخ" : "Start Date"}</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">{isRtl ? "إلى تاريخ" : "End Date"}</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                <div>
                  <Label className="text-xs">{isRtl ? "طريقة الدفع" : "Payment Method"}</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{isRtl ? "الكل" : "All"}</SelectItem>
                      <SelectItem value="cash">{isRtl ? "نقدي" : "Cash"}</SelectItem>
                      <SelectItem value="card">{isRtl ? "بطاقة" : "Card"}</SelectItem>
                      <SelectItem value="mada">{isRtl ? "مدى" : "Mada"}</SelectItem>
                      <SelectItem value="stc_pay">STC Pay</SelectItem>
                      <SelectItem value="apple_pay">Apple Pay</SelectItem>
                      <SelectItem value="bank_transfer">{isRtl ? "تحويل بنكي" : "Bank Transfer"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">{isRtl ? "حالة الفاتورة" : "Status"}</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{isRtl ? "الكل" : "All"}</SelectItem>
                      <SelectItem value="issued">{isRtl ? "مصدرة" : "Issued"}</SelectItem>
                      <SelectItem value="cancelled">{isRtl ? "ملغاة" : "Cancelled"}</SelectItem>
                      <SelectItem value="reported">{isRtl ? "مبلغة" : "Reported"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">{isRtl ? "نوع الفاتورة" : "Invoice Type"}</Label>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{isRtl ? "الكل" : "All"}</SelectItem>
                      <SelectItem value="simplified">{isRtl ? "مبسطة" : "Simplified"}</SelectItem>
                      <SelectItem value="standard">{isRtl ? "قياسية" : "Standard"}</SelectItem>
                      <SelectItem value="credit_note">{isRtl ? "إشعار دائن" : "Credit Note"}</SelectItem>
                      <SelectItem value="debit_note">{isRtl ? "إشعار مدين" : "Debit Note"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="text-sm text-muted-foreground">{isRtl ? "إجمالي الفواتير" : "Total Invoices"}</div>
                <div className="text-2xl font-bold">{invoices.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="text-sm text-muted-foreground">{isRtl ? "مصدرة" : "Issued"}</div>
                <div className="text-2xl font-bold text-green-600">{invoices.filter(i => i.status === "issued").length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="text-sm text-muted-foreground">{isRtl ? "إشعارات دائن" : "Credit Notes"}</div>
                <div className="text-2xl font-bold text-orange-600">{invoices.filter(i => i.invoiceType === "credit_note").length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="text-sm text-muted-foreground">{isRtl ? "إجمالي المبلغ" : "Total Amount"}</div>
                <div className="text-2xl font-bold">{formatCurrency(invoices.filter(i => i.status !== "cancelled" && i.invoiceType !== "credit_note").reduce((sum, i) => sum + parseFloat(String(i.total || 0)), 0))}</div>
              </CardContent>
            </Card>
          </div>

          {/* Invoices Table */}
          {isLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{isRtl ? "رقم الفاتورة" : "Invoice #"}</TableHead>
                        <TableHead>{isRtl ? "النوع" : "Type"}</TableHead>
                        <TableHead>{isRtl ? "الحالة" : "Status"}</TableHead>
                        <TableHead>{isRtl ? "التاريخ" : "Date"}</TableHead>
                        <TableHead>{isRtl ? "العميل" : "Customer"}</TableHead>
                        <TableHead>{isRtl ? "الدفع" : "Payment"}</TableHead>
                        <TableHead>{isRtl ? "المبلغ" : "Amount"}</TableHead>
                        <TableHead>{isRtl ? "الضريبة" : "Tax"}</TableHead>
                        <TableHead>ZATCA</TableHead>
                        <TableHead>{isRtl ? "إجراءات" : "Actions"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                            {isRtl ? "لا توجد فواتير" : "No invoices found"}
                          </TableCell>
                        </TableRow>
                      ) : (
                        invoices.map((invoice) => (
                          <TableRow key={invoice.id} className="cursor-pointer hover:bg-muted/50">
                            <TableCell className="font-mono text-xs">{invoice.invoiceNumber}</TableCell>
                            <TableCell>{getTypeBadge(invoice.invoiceType)}</TableCell>
                            <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                            <TableCell className="text-xs">
                              {invoice.createdAt ? new Date(invoice.createdAt).toLocaleDateString(isRtl ? "ar-SA" : "en-US") : "-"}
                              <br />
                              <span className="text-muted-foreground">
                                {invoice.createdAt ? new Date(invoice.createdAt).toLocaleTimeString(isRtl ? "ar-SA" : "en-US", { hour: "2-digit", minute: "2-digit" }) : ""}
                              </span>
                            </TableCell>
                            <TableCell className="text-xs">
                              {invoice.customerName || "-"}
                              {invoice.customerPhone && <div className="text-muted-foreground">{invoice.customerPhone}</div>}
                            </TableCell>
                            <TableCell className="text-xs">{invoice.paymentMethod || "-"}</TableCell>
                            <TableCell className="font-medium">{formatCurrency(invoice.total)}</TableCell>
                            <TableCell className="text-xs">{formatCurrency(invoice.taxAmount)}</TableCell>
                            <TableCell>{getZatcaStatusIcon(invoice.zatcaStatus)}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7"
                                  onClick={() => { setSelectedInvoice(invoice); setShowInvoiceModal(true); }}
                                  title={isRtl ? "عرض" : "View"}
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                {invoice.status === "issued" && invoice.invoiceType !== "credit_note" && invoice.invoiceType !== "debit_note" && (
                                  <>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 text-orange-600"
                                      onClick={() => { setSelectedInvoice(invoice); setShowRefundDialog(true); }}
                                      title={isRtl ? "استرجاع" : "Refund"}
                                    >
                                      <RefreshCw className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      className="h-7 w-7 text-purple-600"
                                      onClick={() => { setSelectedInvoice(invoice); setShowDebitNoteDialog(true); }}
                                      title={isRtl ? "إشعار مدين" : "Debit Note"}
                                    >
                                      <ArrowLeftRight className="h-3.5 w-3.5" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* === Tax Report Tab === */}
        <TabsContent value="tax" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                {isRtl ? "تقرير ضريبة القيمة المضافة" : "VAT Tax Report"}
              </CardTitle>
              <CardDescription>
                {isRtl ? "ملخص الضريبة المحصلة والمسترجعة" : "Summary of collected and refunded tax"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                <div>
                  <Label className="text-xs">{isRtl ? "من تاريخ" : "Start Date"}</Label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">{isRtl ? "إلى تاريخ" : "End Date"}</Label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1" />
                </div>
              </div>

              {restaurant?.taxEnabled === false ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-yellow-500" />
                  <p>{isRtl ? "المنشأة غير مسجلة في ضريبة القيمة المضافة" : "Business is not VAT registered"}</p>
                  <p className="text-xs mt-1">{isRtl ? "تقرير المبيعات فقط متاح" : "Only sales report is available"}</p>
                </div>
              ) : taxReport ? (
                <div className="space-y-6">
                  {/* Sales */}
                  <div>
                    <h3 className="font-semibold mb-3 border-b pb-2">{isRtl ? "المبيعات" : "Sales"}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <Card><CardContent className="pt-3 pb-2">
                        <div className="text-xs text-muted-foreground">{isRtl ? "عدد الفواتير" : "Invoice Count"}</div>
                        <div className="text-xl font-bold">{taxReport.sales.count}</div>
                      </CardContent></Card>
                      <Card><CardContent className="pt-3 pb-2">
                        <div className="text-xs text-muted-foreground">{isRtl ? "قبل الضريبة" : "Before Tax"}</div>
                        <div className="text-xl font-bold">{formatCurrency(taxReport.sales.subtotal)}</div>
                      </CardContent></Card>
                      <Card><CardContent className="pt-3 pb-2">
                        <div className="text-xs text-muted-foreground">{isRtl ? "ضريبة القيمة المضافة" : "VAT Amount"}</div>
                        <div className="text-xl font-bold text-blue-600">{formatCurrency(taxReport.sales.taxAmount)}</div>
                      </CardContent></Card>
                      <Card><CardContent className="pt-3 pb-2">
                        <div className="text-xs text-muted-foreground">{isRtl ? "الإجمالي" : "Total"}</div>
                        <div className="text-xl font-bold text-green-600">{formatCurrency(taxReport.sales.total)}</div>
                      </CardContent></Card>
                    </div>
                  </div>

                  {/* Credit Notes */}
                  <div>
                    <h3 className="font-semibold mb-3 border-b pb-2">{isRtl ? "إشعارات الدائن (المسترجعات)" : "Credit Notes (Refunds)"}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <Card><CardContent className="pt-3 pb-2">
                        <div className="text-xs text-muted-foreground">{isRtl ? "العدد" : "Count"}</div>
                        <div className="text-xl font-bold">{taxReport.creditNotes.count}</div>
                      </CardContent></Card>
                      <Card><CardContent className="pt-3 pb-2">
                        <div className="text-xs text-muted-foreground">{isRtl ? "قبل الضريبة" : "Before Tax"}</div>
                        <div className="text-xl font-bold text-orange-600">-{formatCurrency(taxReport.creditNotes.subtotal)}</div>
                      </CardContent></Card>
                      <Card><CardContent className="pt-3 pb-2">
                        <div className="text-xs text-muted-foreground">{isRtl ? "ضريبة مسترجعة" : "Refunded Tax"}</div>
                        <div className="text-xl font-bold text-orange-600">-{formatCurrency(taxReport.creditNotes.taxAmount)}</div>
                      </CardContent></Card>
                      <Card><CardContent className="pt-3 pb-2">
                        <div className="text-xs text-muted-foreground">{isRtl ? "الإجمالي" : "Total"}</div>
                        <div className="text-xl font-bold text-orange-600">-{formatCurrency(taxReport.creditNotes.total)}</div>
                      </CardContent></Card>
                    </div>
                  </div>

                  {/* Debit Notes */}
                  {taxReport.debitNotes.count > 0 && (
                    <div>
                      <h3 className="font-semibold mb-3 border-b pb-2">{isRtl ? "إشعارات المدين" : "Debit Notes"}</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Card><CardContent className="pt-3 pb-2">
                          <div className="text-xs text-muted-foreground">{isRtl ? "العدد" : "Count"}</div>
                          <div className="text-xl font-bold">{taxReport.debitNotes.count}</div>
                        </CardContent></Card>
                        <Card><CardContent className="pt-3 pb-2">
                          <div className="text-xs text-muted-foreground">{isRtl ? "مبلغ الضريبة" : "Tax Amount"}</div>
                          <div className="text-xl font-bold text-purple-600">{formatCurrency(taxReport.debitNotes.taxAmount)}</div>
                        </CardContent></Card>
                      </div>
                    </div>
                  )}

                  {/* Net Tax */}
                  <Card className="border-2 border-primary">
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium">{isRtl ? "صافي الضريبة المستحقة" : "Net Tax Payable"}</div>
                          <div className="text-xs text-muted-foreground">{isRtl ? "المبيعات - المسترجعات + الإشعارات المدينة" : "Sales - Refunds + Debit Notes"}</div>
                        </div>
                        <div className="text-3xl font-bold text-primary">{formatCurrency(taxReport.netTax)}</div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-muted/50">
                    <CardContent className="pt-4 pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium">{isRtl ? "صافي المبيعات" : "Net Sales"}</div>
                        </div>
                        <div className="text-2xl font-bold">{formatCurrency(taxReport.netSales)}</div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* === Audit Log Tab === */}
        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                {isRtl ? "سجل عمليات الفواتير" : "Invoice Audit Log"}
              </CardTitle>
              <CardDescription>
                {isRtl ? "جميع العمليات المسجلة على الفواتير - غير قابل للحذف" : "All recorded invoice operations - cannot be deleted"}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{isRtl ? "التاريخ" : "Date"}</TableHead>
                      <TableHead>{isRtl ? "العملية" : "Action"}</TableHead>
                      <TableHead>{isRtl ? "المستخدم" : "User"}</TableHead>
                      <TableHead>{isRtl ? "التفاصيل" : "Details"}</TableHead>
                      <TableHead>IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          {isRtl ? "لا توجد عمليات مسجلة" : "No audit logs found"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      auditLogs.map((log: any) => {
                        let details: any = {};
                        try { details = JSON.parse(log.details || "{}"); } catch {}
                        return (
                          <TableRow key={log.id}>
                            <TableCell className="text-xs whitespace-nowrap">
                              {log.createdAt ? new Date(log.createdAt).toLocaleString(isRtl ? "ar-SA" : "en-US") : "-"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{getActionLabel(log.action)}</Badge>
                            </TableCell>
                            <TableCell className="text-sm">{log.userName || "-"}</TableCell>
                            <TableCell className="text-xs max-w-[300px] truncate">
                              {details.invoiceNumber && <span className="font-mono">{details.invoiceNumber}</span>}
                              {details.reason && <span className="block text-muted-foreground">{details.reason}</span>}
                              {details.amount && <span className="block">{formatCurrency(details.amount)}</span>}
                            </TableCell>
                            <TableCell className="text-xs font-mono">{log.ipAddress || "-"}</TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Invoice View Modal */}
      {selectedInvoice && (
        <InvoiceModal
          open={showInvoiceModal}
          invoiceId={selectedInvoice.id}
          orderId={selectedInvoice.orderId}
          onClose={() => { setShowInvoiceModal(false); setSelectedInvoice(null); }}
        />
      )}

      {/* Refund Dialog */}
      <Dialog open={showRefundDialog} onOpenChange={setShowRefundDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isRtl ? "إصدار استرجاع (إشعار دائن)" : "Issue Refund (Credit Note)"}</DialogTitle>
            <DialogDescription>
              {isRtl 
                ? `سيتم إنشاء إشعار دائن مرتبط بالفاتورة ${selectedInvoice?.invoiceNumber}`
                : `A credit note will be created linked to invoice ${selectedInvoice?.invoiceNumber}`
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
            {refundItems.length > 0 && (
              <div className="border rounded-md">
                 <Table>
                    <TableHeader>
                       <TableRow>
                          <TableHead className="w-[50px]">
                            <input type="checkbox" 
                               checked={refundItems.length > 0 && refundItems.every(i => i.selected)}
                               onChange={(e) => {
                                  const checked = e.target.checked;
                                  setRefundItems(refundItems.map(i => ({ ...i, selected: checked })));
                               }}
                               className="accent-primary h-4 w-4"
                            />
                          </TableHead>
                          <TableHead className="text-right">{isRtl ? "المنتج" : "Item"}</TableHead>
                          <TableHead className="w-[100px] text-center">{isRtl ? "الكمية" : "Qty"}</TableHead>
                          <TableHead className="text-right">{isRtl ? "السعر" : "Price"}</TableHead>
                       </TableRow>
                    </TableHeader>
                    <TableBody>
                       {refundItems.map((item, idx) => (
                          <TableRow key={idx}>
                             <TableCell>
                                <input type="checkbox" 
                                   checked={item.selected}
                                   onChange={(e) => {
                                      const newItems = [...refundItems];
                                      newItems[idx].selected = e.target.checked;
                                      setRefundItems(newItems);
                                   }}
                                   className="accent-primary h-4 w-4"
                                />
                             </TableCell>
                             <TableCell>{isRtl ? item.itemName || "منتج" : item.itemName || "Item"}</TableCell>
                             <TableCell>
                                <div className="flex items-center gap-2 justify-center">
                                   <Button variant="outline" size="icon" className="h-6 w-6" 
                                      onClick={() => {
                                         const newItems = [...refundItems];
                                         if (newItems[idx].refundQty > 1) newItems[idx].refundQty--;
                                         setRefundItems(newItems);
                                      }}
                                      disabled={!item.selected}
                                   >-</Button>
                                   <span className="w-8 text-center">{item.refundQty}</span>
                                   <Button variant="outline" size="icon" className="h-6 w-6"
                                      onClick={() => {
                                         const newItems = [...refundItems];
                                         if (newItems[idx].refundQty < item.quantity) newItems[idx].refundQty++;
                                         setRefundItems(newItems);
                                      }}
                                      disabled={!item.selected}
                                   >+</Button>
                                </div>
                             </TableCell>
                             <TableCell>{formatCurrency(Number(item.unitPrice) * item.refundQty)}</TableCell>
                          </TableRow>
                       ))}
                    </TableBody>
                 </Table>
              </div>
            )}

            <div>
              <Label>{isRtl ? "سبب الاسترجاع *" : "Refund Reason *"}</Label>
              <Textarea
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder={isRtl ? "اكتب سبب الاسترجاع..." : "Enter refund reason..."}
                rows={2}
              />
            </div>
            
            <div className="text-sm text-muted-foreground p-2 bg-muted rounded">
               {refundItems.some(i => i.selected) 
                  ? (isRtl ? `سيتم استرجاع ${refundItems.filter(i => i.selected).length} عناصر` : `Refunding ${refundItems.filter(i => i.selected).length} items`)
                  : (isRtl ? "استرجاع كامل الفاتورة" : "Full Refund (All items)")
               }
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRefundDialog(false)}>
              {isRtl ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                 if (selectedInvoice) {
                    const hasSelection = refundItems.some(i => i.selected);
                    // If selection exists, pass items. Else pass undefined for full refund.
                    refundMutation.mutate({ 
                       invoiceId: selectedInvoice.id, 
                       reason: refundReason, 
                       items: hasSelection ? refundItems : undefined 
                    });
                 }
              }}
              disabled={!refundReason.trim() || refundMutation.isPending}
            >
              {refundMutation.isPending ? (isRtl ? "جاري المعالجة..." : "Processing...") : (isRtl ? "تأكيد الاسترجاع" : "Confirm Refund")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Debit Note Dialog */}
      <Dialog open={showDebitNoteDialog} onOpenChange={setShowDebitNoteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{isRtl ? "إصدار إشعار مدين" : "Issue Debit Note"}</DialogTitle>
            <DialogDescription>
              {isRtl
                ? `سيتم إنشاء إشعار مدين مرتبط بالفاتورة ${selectedInvoice?.invoiceNumber}`
                : `A debit note will be created linked to invoice ${selectedInvoice?.invoiceNumber}`
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{isRtl ? "السبب *" : "Reason *"}</Label>
              <Textarea
                value={debitReason}
                onChange={(e) => setDebitReason(e.target.value)}
                placeholder={isRtl ? "اكتب سبب الإشعار المدين..." : "Enter debit note reason..."}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDebitNoteDialog(false)}>
              {isRtl ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={() => selectedInvoice && debitNoteMutation.mutate({ invoiceId: selectedInvoice.id, reason: debitReason })}
              disabled={!debitReason.trim() || debitNoteMutation.isPending}
            >
              {debitNoteMutation.isPending ? (isRtl ? "جاري المعالجة..." : "Processing...") : (isRtl ? "إنشاء إشعار مدين" : "Create Debit Note")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

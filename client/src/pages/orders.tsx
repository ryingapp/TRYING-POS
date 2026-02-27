import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, Clock, ChefHat, CheckCircle, XCircle, ShoppingCart, Printer, Maximize2, Minimize2, LayoutGrid, RotateCcw, Truck, Package, Phone, MapPin, User, ChevronDown, ChevronUp, RefreshCw, AlertTriangle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";
import { useBranch } from "@/lib/branch";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { InvoiceModal } from "@/components/invoice-modal";
import type { Order, Table, MenuItem, InsertOrder, DeliveryOrder } from "@shared/schema";
import { orderTypes, orderStatuses } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const PLATFORM_LABELS: Record<string, { name: string; nameAr: string; color: string }> = {
  hungerstation: { name: "HungerStation", nameAr: "هنقرستيشن", color: "bg-orange-500" },
  jahez: { name: "Jahez", nameAr: "جاهز", color: "bg-purple-500" },
  keeta: { name: "Keeta", nameAr: "كيتا", color: "bg-green-500" },
  ninja: { name: "Ninja", nameAr: "نينجا", color: "bg-red-500" },
};

type UnifiedOrder = {
  type: "pos";
  data: Order;
} | {
  type: "delivery";
  data: DeliveryOrder;
};

const orderFormSchema = z.object({
  orderType: z.enum(["dine_in", "pickup", "delivery"]),
  tableId: z.string().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  notes: z.string().optional(),
});

function OrderStatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  
  const statusConfig: Record<string, { color: string; icon: React.ElementType }> = {
    pending: { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", icon: Clock },
    confirmed: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", icon: CheckCircle },
    preparing: { color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200", icon: ChefHat },
    ready: { color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", icon: CheckCircle },
    completed: { color: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200", icon: CheckCircle },
    cancelled: { color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", icon: XCircle },
  };

  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;

  return (
    <Badge className={`${config.color} border-0 gap-1`}>
      <Icon className="h-3 w-3" />
      {t(status)}
    </Badge>
  );
}

function OrderTypeBadge({ type }: { type: string }) {
  const { t } = useLanguage();
  
  const typeLabels: Record<string, string> = {
    dine_in: "dineIn",
    pickup: "pickup",
    delivery: "delivery",
  };

  return (
    <Badge variant="outline">
      {t(typeLabels[type] || type)}
    </Badge>
  );
}

function OrderForm({ 
  tables,
  onSuccess,
  branchId
}: { 
  tables: Table[];
  onSuccess: () => void;
  branchId: string | null;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof orderFormSchema>>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      orderType: "dine_in",
      tableId: "",
      customerName: "",
      customerPhone: "",
      notes: "",
    },
  });

  const orderType = form.watch("orderType");

  const createMutation = useMutation({
    mutationFn: (data: InsertOrder) => apiRequest("POST", "/api/orders", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/orders") });
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/tables") });
      toast({ title: t("orderCreated") });
      onSuccess();
    },
    onError: () => {
      toast({ title: t("orderCreateFailed"), variant: "destructive" });
    },
  });

  const onSubmit = (data: z.infer<typeof orderFormSchema>) => {
    const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;
    const payload: InsertOrder = {
      ...data,
      orderNumber,
      restaurantId: "default",
      branchId: branchId || null,
      status: "pending",
      subtotal: "0",
      tax: "0",
      total: "0",
    };
    createMutation.mutate(payload);
  };

  const availableTables = tables.filter((t) => t.status === "available");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="orderType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("orderType")}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-order-type">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="dine_in">{t("dineIn")}</SelectItem>
                  <SelectItem value="pickup">{t("pickup")}</SelectItem>
                  <SelectItem value="delivery">{t("delivery")}</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        {orderType === "dine_in" && (
          <FormField
            control={form.control}
            name="tableId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("tableNumber")}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-order-table">
                      <SelectValue placeholder={t("selectCategory")} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {availableTables.map((table) => (
                      <SelectItem key={table.id} value={table.id}>
                        {table.tableNumber} ({table.capacity} {t("guests")})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <FormField
          control={form.control}
          name="customerName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("customer")}</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-order-customer" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="customerPhone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("phone")}</FormLabel>
              <FormControl>
                <Input {...field} type="tel" data-testid="input-order-phone" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("notes")}</FormLabel>
              <FormControl>
                <Textarea {...field} rows={2} data-testid="input-order-notes" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button 
          type="submit" 
          className="w-full" 
          disabled={createMutation.isPending}
          data-testid="button-create-order"
        >
          {createMutation.isPending ? "..." : t("save")}
        </Button>
      </form>
    </Form>
  );
}

export default function OrdersPage() {
  const { t, language, direction } = useLanguage();
  const { toast } = useToast();
  const { selectedBranchId } = useBranch();
  const isRtl = direction === "rtl";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cardSize, setCardSize] = useState<"normal" | "compact" | "large">("normal");
  const [printOrderId, setPrintOrderId] = useState<string | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [autoPrintTriggered, setAutoPrintTriggered] = useState(false);
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundOrderId, setRefundOrderId] = useState<string | null>(null);
  const [refundReason, setRefundReason] = useState("");
  const [expandedDeliveryOrders, setExpandedDeliveryOrders] = useState<Set<string>>(new Set());
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  const { data: orders, isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders", { branch: selectedBranchId }],
    queryFn: async () => {
      const url = selectedBranchId ? `/api/orders?branch=${selectedBranchId}` : "/api/orders";
      const res = await apiRequest("GET", url);
      return res.json();
    },
  });

  const { data: tables } = useQuery<Table[]>({
    queryKey: ["/api/tables", { branch: selectedBranchId }],
    queryFn: async () => {
      const url = selectedBranchId ? `/api/tables?branch=${selectedBranchId}` : "/api/tables";
      const res = await apiRequest("GET", url);
      return res.json();
    },
  });

  // Fetch delivery orders with auto-refresh
  const { data: deliveryOrders = [] } = useQuery<DeliveryOrder[]>({
    queryKey: ["/api/delivery/orders", { branch: selectedBranchId }],
    queryFn: async () => {
      const url = selectedBranchId
        ? `/api/delivery/orders?branchId=${selectedBranchId}`
        : "/api/delivery/orders";
      const res = await apiRequest("GET", url);
      return res.json();
    },
    refetchInterval: 10000,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: string; reason?: string }) =>
      apiRequest("PUT", `/api/orders/${id}/status`, { status, reason }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/orders") });
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/tables") });
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/kitchen") });
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/invoices") });
      if (variables.status === "cancelled") {
        toast({ title: language === "ar" ? "تم إلغاء الطلب وإصدار إشعار دائن" : "Order cancelled and credit note issued" });
        setCancelDialogOpen(false);
        setCancelReason("");
        setCancelOrderId(null);
      } else {
        toast({ title: t("statusUpdated") });
      }
    },
    onError: () => {
      toast({ title: t("statusUpdateFailed"), variant: "destructive" });
    },
  });

  // Refund mutation - finds the invoice for the order and refunds it
  const refundMutation = useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason: string }) => {
      // First get the invoice for this order
      const res = await apiRequest("GET", `/api/orders/${orderId}/invoice`);
      const invoice = await res.json();
      if (!invoice || !invoice.id) throw new Error(language === "ar" ? "لم يتم العثور على فاتورة لهذا الطلب" : "No invoice found for this order");
      // Then refund the invoice
      return apiRequest("POST", `/api/invoices/${invoice.id}/refund`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/orders") });
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/invoices") });
      toast({ title: language === "ar" ? "تم الاسترجاع بنجاح" : "Refund processed successfully" });
      setRefundDialogOpen(false);
      setRefundReason("");
      setRefundOrderId(null);
    },
    onError: (error: any) => {
      toast({ title: language === "ar" ? "خطأ في الاسترجاع" : "Refund failed", description: error.message, variant: "destructive" });
    },
  });

  // Delivery order mutations
  const acceptDeliveryMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PUT", `/api/delivery/orders/${id}/accept`, { prepTime: 20 });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/delivery/orders") });
      toast({ title: isRtl ? "تم قبول الطلب ✅" : "Order accepted ✅" });
    },
    onError: (e: Error) => {
      toast({ title: isRtl ? "خطأ" : "Error", description: e.message, variant: "destructive" });
    },
  });

  const readyDeliveryMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PUT", `/api/delivery/orders/${id}/ready`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/delivery/orders") });
      toast({ title: isRtl ? "تم تجهيز الطلب 📦" : "Order marked as ready 📦" });
    },
    onError: (e: Error) => {
      toast({ title: isRtl ? "خطأ" : "Error", description: e.message, variant: "destructive" });
    },
  });

  const rejectDeliveryMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await apiRequest("PUT", `/api/delivery/orders/${id}/reject`, { reason });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/delivery/orders") });
      setRejectId(null);
      setRejectReason("");
      toast({ title: isRtl ? "تم رفض الطلب" : "Order rejected" });
    },
    onError: (e: Error) => {
      toast({ title: isRtl ? "خطأ" : "Error", description: e.message, variant: "destructive" });
    },
  });

  const toggleDeliveryExpand = (id: string) => {
    setExpandedDeliveryOrders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const timeSinceCreated = (date: string | Date | null) => {
    if (!date) return "";
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return isRtl ? "الآن" : "just now";
    if (mins < 60) return isRtl ? `منذ ${mins} دقيقة` : `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    return isRtl ? `منذ ${hours} ساعة` : `${hours}h ago`;
  };

  const getNextStatus = (current: string): string | null => {
    const flow: Record<string, string> = {
      pending: "preparing",
      confirmed: "preparing",
      preparing: "ready",
      ready: "completed",
    };
    return flow[current] || null;
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      pending: language === "ar" ? "جديد" : "New",
      preparing: language === "ar" ? "قيد التنفيذ" : "In Progress",
      ready: language === "ar" ? "جاهز" : "Ready",
      completed: language === "ar" ? "مكتمل" : "Completed",
      cancelled: language === "ar" ? "ملغي" : "Cancelled",
      delivered: language === "ar" ? "تم التوصيل" : "Delivered",
      payment_pending: language === "ar" ? "بانتظار الدفع" : "Payment Pending",
    };
    return labels[status] || t(status);
  };

  const handlePrintOrder = (orderId: string) => {
    setPrintOrderId(orderId);
    setAutoPrintTriggered(true);
    setShowInvoiceModal(true);
  };

  const gridClass = cardSize === "compact" 
    ? "grid gap-3 md:grid-cols-3 lg:grid-cols-4"
    : cardSize === "large"
    ? "grid gap-6 md:grid-cols-1 lg:grid-cols-2"
    : "grid gap-4 md:grid-cols-2 lg:grid-cols-3";

  // Filter POS orders
  const filteredPosOrders = orders?.filter((order) => {
    const matchesSearch =
      order.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      order.customerName?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? !(order.status === "completed" || order.status === "cancelled") : order.status === statusFilter);
    const matchesSource = sourceFilter === "all" || sourceFilter === "pos";
    return matchesSearch && matchesStatus && matchesSource;
  }) || [];

  // Filter delivery orders  
  const filteredDeliveryOrders = deliveryOrders.filter((order) => {
    const matchesSearch =
      (order.orderCode || order.externalOrderId || "").toLowerCase().includes(search.toLowerCase()) ||
      (order.customerName || "").toLowerCase().includes(search.toLowerCase());
    // Map delivery statuses to POS-like statuses for filtering
    const deliveryStatusMap: Record<string, string> = {
      new: "pending", accepted: "preparing", preparing: "preparing",
      ready: "ready", picked_up: "completed", delivered: "completed",
      cancelled: "cancelled", rejected: "cancelled",
    };
    const mappedStatus = deliveryStatusMap[order.platformStatus] || order.platformStatus;
    const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? !(mappedStatus === "completed" || mappedStatus === "cancelled") : mappedStatus === statusFilter);
    const matchesSource = sourceFilter === "all" || sourceFilter === order.platform;
    return matchesSearch && matchesStatus && matchesSource;
  });

  // Exclude POS orders that are linked to delivery orders (to avoid duplicates)
  const linkedPosOrderIds = new Set(deliveryOrders.map(o => o.orderId).filter(Boolean));
  const independentPosOrders = filteredPosOrders.filter(o => !linkedPosOrderIds.has(o.id));

  // Build unified ordered list (newest first, delivery new orders on top)
  const unifiedOrders: UnifiedOrder[] = [
    ...filteredDeliveryOrders
      .filter(o => o.platformStatus === "new")
      .map(o => ({ type: "delivery" as const, data: o })),
    ...[
      ...independentPosOrders.map(o => ({ type: "pos" as const, data: o, time: new Date(o.createdAt!).getTime() })),
      ...filteredDeliveryOrders
        .filter(o => o.platformStatus !== "new")
        .map(o => ({ type: "delivery" as const, data: o, time: new Date(o.createdAt!).getTime() })),
    ].sort((a, b) => b.time - a.time).map(({ type, data }) => ({ type, data } as UnifiedOrder)),
  ];

  const activeDeliveryCount = deliveryOrders.filter(o => ["new", "accepted", "preparing", "ready"].includes(o.platformStatus)).length;

  const independentPosOrdersList = orders?.filter(o => !linkedPosOrderIds.has(o.id)) || [];
  const ordersByStatus = {
    active: (independentPosOrdersList.filter((o) => ["pending", "confirmed", "preparing", "ready"].includes(o.status || ""))).length + activeDeliveryCount,
    completed: independentPosOrdersList.filter((o) => o.status === "completed"),
    cancelled: independentPosOrdersList.filter((o) => o.status === "cancelled"),
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{t("orders")}</h2>
          <p className="text-muted-foreground">
            {ordersByStatus.active} {t("activeOrders")}
            {activeDeliveryCount > 0 && (
              <span className="text-orange-500 ms-2">
                ({activeDeliveryCount} {isRtl ? "توصيل" : "delivery"})
              </span>
            )}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-new-order">
              <Plus className="h-4 w-4 me-2" />
              {t("newOrder")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("newOrder")}</DialogTitle>
            </DialogHeader>
            <OrderForm 
              tables={tables || []}
              onSuccess={() => setDialogOpen(false)}
              branchId={selectedBranchId}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("search")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="ps-9"
            data-testid="input-search-orders"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-filter-status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">{isRtl ? "الطلبات النشطة" : "Active Orders"}</SelectItem>
            <SelectItem value="all">{t("status")}: {t("all")}</SelectItem>
            {orderStatuses.map((status) => (
              <SelectItem key={status} value={status}>
                {getStatusLabel(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{isRtl ? "المصدر: الكل" : "Source: All"}</SelectItem>
            <SelectItem value="pos">{isRtl ? "نقطة البيع" : "POS"}</SelectItem>
            <SelectItem value="hungerstation">{isRtl ? "هنقرستيشن" : "HungerStation"}</SelectItem>
            <SelectItem value="jahez">{isRtl ? "جاهز" : "Jahez"}</SelectItem>
            <SelectItem value="keeta">{isRtl ? "كيتا" : "Keeta"}</SelectItem>
            <SelectItem value="ninja">{isRtl ? "نينجا" : "Ninja"}</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-1 border rounded-md p-1">
          <Button 
            variant={cardSize === "compact" ? "secondary" : "ghost"} 
            size="icon" 
            className="h-8 w-8"
            onClick={() => setCardSize("compact")}
            title={language === "ar" ? "عرض مصغر" : "Compact view"}
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button 
            variant={cardSize === "normal" ? "secondary" : "ghost"} 
            size="icon" 
            className="h-8 w-8"
            onClick={() => setCardSize("normal")}
            title={language === "ar" ? "عرض عادي" : "Normal view"}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button 
            variant={cardSize === "large" ? "secondary" : "ghost"} 
            size="icon" 
            className="h-8 w-8"
            onClick={() => setCardSize("large")}
            title={language === "ar" ? "عرض كبير" : "Large view"}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {ordersLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : unifiedOrders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <ShoppingCart className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <p className="text-lg text-muted-foreground">{t("noOrders")}</p>
            <Button 
              className="mt-4" 
              onClick={() => setDialogOpen(true)}
              data-testid="button-create-first-order"
            >
              <Plus className="h-4 w-4 me-2" />
              {t("newOrder")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className={gridClass}>
          {unifiedOrders.map((unified) => {
            if (unified.type === "pos") {
              const order = unified.data;
              const table = tables?.find((t) => t.id === order.tableId);
              const nextStatus = getNextStatus(order.status || "");
              
              return (
                <Card key={`pos-${order.id}`} className="hover-elevate" data-testid={`order-card-${order.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <CardTitle className={cardSize === "compact" ? "text-sm" : "text-lg"}>
                        {t("orderNumber")}{order.orderNumber}
                      </CardTitle>
                      <OrderStatusBadge status={order.status || "pending"} />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <OrderTypeBadge type={order.orderType} />
                      {table && (
                        <Badge variant="secondary">
                          {t("tableNumber")}: {table.tableNumber}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {order.customerName && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{t("customer")}:</span>
                          <span>{order.customerName}</span>
                        </div>
                      )}
                      {order.customerPhone && cardSize !== "compact" && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{t("phone")}:</span>
                          <span dir="ltr">{order.customerPhone}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t("created")}:</span>
                        <span>{new Date(order.createdAt!).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between font-semibold pt-2 border-t">
                        <span>{t("total")}:</span>
                        <span className="text-primary">
                          {parseFloat(order.total?.toString() || "0").toFixed(2)} {t("sar")}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-4">
                      {nextStatus && order.status !== "cancelled" && (
                        <Button
                          className="flex-1"
                          variant="outline"
                          size={cardSize === "compact" ? "sm" : "default"}
                          onClick={() => updateStatusMutation.mutate({ id: order.id, status: nextStatus })}
                          disabled={updateStatusMutation.isPending}
                          data-testid={`button-advance-order-${order.id}`}
                        >
                          {getStatusLabel(nextStatus)}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size={cardSize === "compact" ? "sm" : "default"}
                        onClick={() => handlePrintOrder(order.id)}
                        title={language === "ar" ? "طباعة" : "Print"}
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                    </div>
                    {order.status !== "cancelled" && order.status !== "completed" && (
                      <Button
                        className="w-full mt-2"
                        variant="ghost"
                        size={cardSize === "compact" ? "sm" : "default"}
                        onClick={() => { setCancelOrderId(order.id); setCancelDialogOpen(true); }}
                        disabled={updateStatusMutation.isPending}
                        data-testid={`button-cancel-order-${order.id}`}
                      >
                        <XCircle className="h-4 w-4 me-2 text-destructive" />
                        {language === "ar" ? "إلغاء" : "Cancel"}
                      </Button>
                    )}
                    {(order.status === "completed" || order.isPaid) && order.status !== "cancelled" && order.status !== "refunded" && (
                      <Button
                        className="w-full mt-2"
                        variant="outline"
                        size={cardSize === "compact" ? "sm" : "default"}
                        onClick={() => { setRefundOrderId(order.id); setRefundDialogOpen(true); }}
                      >
                        <RotateCcw className="h-4 w-4 me-2 text-orange-500" />
                        {language === "ar" ? "استرجاع" : "Refund"}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            } else {
              // Delivery order card
              const order = unified.data;
              const platform = PLATFORM_LABELS[order.platform] || { name: order.platform, nameAr: order.platform, color: "bg-gray-500" };
              const isExpanded = expandedDeliveryOrders.has(order.id);
              const items = (order.items as any[]) || [];
              const isNew = order.platformStatus === "new";

              const deliveryStatusConfig: Record<string, { label: string; labelAr: string; color: string }> = {
                new: { label: "New", labelAr: "جديد", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
                accepted: { label: "Accepted", labelAr: "مقبول", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
                preparing: { label: "Preparing", labelAr: "قيد التحضير", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
                ready: { label: "Ready", labelAr: "جاهز", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
                picked_up: { label: "Picked Up", labelAr: "تم الاستلام", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200" },
                delivered: { label: "Delivered", labelAr: "تم التوصيل", color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" },
                cancelled: { label: "Cancelled", labelAr: "ملغي", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
                rejected: { label: "Rejected", labelAr: "مرفوض", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
              };
              const statusCfg = deliveryStatusConfig[order.platformStatus] || deliveryStatusConfig.new;

              return (
                <Card
                  key={`delivery-${order.id}`}
                  className={`hover-elevate ${isNew ? "border-blue-400 shadow-md ring-1 ring-blue-200 dark:ring-blue-800" : ""}`}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <CardTitle className={cardSize === "compact" ? "text-sm" : "text-lg"}>
                        {order.orderCode || order.externalOrderId}
                      </CardTitle>
                      <Badge className={`${statusCfg.color} border-0`}>
                        {isRtl ? statusCfg.labelAr : statusCfg.label}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`${platform.color} text-white border-0`}>
                        <Truck className="h-3 w-3 me-1" />
                        {isRtl ? platform.nameAr : platform.name}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{timeSinceCreated(order.createdAt)}</span>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {order.customerName && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <User className="h-3.5 w-3.5" />
                          <span>{order.customerName}</span>
                        </div>
                      )}
                      {order.customerPhone && cardSize !== "compact" && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Phone className="h-3.5 w-3.5" />
                          <span dir="ltr">{order.customerPhone}</span>
                        </div>
                      )}
                      {order.deliveryAddress && cardSize !== "compact" && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          <span className="truncate">{order.deliveryAddress}</span>
                        </div>
                      )}
                      {order.driverName && cardSize !== "compact" && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Truck className="h-3.5 w-3.5" />
                          <span>{isRtl ? "السائق:" : "Driver:"} {order.driverName}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-semibold pt-2 border-t">
                        <span>{t("total")}:</span>
                        <span className="text-primary">
                          {parseFloat(String(order.total || 0)).toFixed(2)} {t("sar")}
                        </span>
                      </div>
                    </div>

                    {/* Expandable items */}
                    {items.length > 0 && cardSize !== "compact" && (
                      <div className="mt-2">
                        <button
                          onClick={() => toggleDeliveryExpand(order.id)}
                          className="flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          {isRtl ? `${items.length} عناصر` : `${items.length} items`}
                        </button>
                        {isExpanded && (
                          <div className="mt-2 bg-muted/50 rounded-md p-3 space-y-1">
                            {items.map((item: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="text-muted-foreground">{item.quantity}x</span>
                                  <span>{item.name}</span>
                                </div>
                                <span className="font-mono text-xs">{parseFloat(item.totalPrice || 0).toFixed(2)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Cancel reason */}
                    {order.cancelReason && (
                      <div className="mt-2 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300 text-xs px-2 py-1 rounded">
                        {isRtl ? "السبب:" : "Reason:"} {order.cancelReason}
                      </div>
                    )}

                    {/* Delivery action buttons */}
                    {order.platformStatus === "new" && (
                      <div className="flex gap-2 mt-4">
                        <Button
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                          size={cardSize === "compact" ? "sm" : "default"}
                          onClick={() => acceptDeliveryMutation.mutate(order.id)}
                          disabled={acceptDeliveryMutation.isPending}
                        >
                          <CheckCircle className="h-4 w-4 me-1" />
                          {isRtl ? "قبول" : "Accept"}
                        </Button>
                        <Button
                          variant="destructive"
                          size={cardSize === "compact" ? "sm" : "default"}
                          onClick={() => { setRejectId(order.id); setRejectReason(""); }}
                        >
                          <XCircle className="h-4 w-4 me-1" />
                          {isRtl ? "رفض" : "Reject"}
                        </Button>
                      </div>
                    )}

                    {(order.platformStatus === "accepted" || order.platformStatus === "preparing") && (
                      <div className="flex gap-2 mt-4">
                        <Button
                          className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
                          size={cardSize === "compact" ? "sm" : "default"}
                          onClick={() => readyDeliveryMutation.mutate(order.id)}
                          disabled={readyDeliveryMutation.isPending}
                        >
                          <Package className="h-4 w-4 me-1" />
                          {isRtl ? "جاهز" : "Ready"}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => { setRejectId(order.id); setRejectReason(""); }}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            }
          })}
        </div>
      )}

      {/* Invoice Print Modal */}
      {printOrderId && (
        <InvoiceModal
          open={showInvoiceModal}
          onClose={() => { setShowInvoiceModal(false); setPrintOrderId(null); setAutoPrintTriggered(false); }}
          orderId={printOrderId}
          autoPrint={autoPrintTriggered}
          onAutoPrintDone={() => setAutoPrintTriggered(false)}
        />
      )}

      {/* Refund Dialog */}
      <Dialog open={refundDialogOpen} onOpenChange={(open) => { setRefundDialogOpen(open); if (!open) { setRefundReason(""); setRefundOrderId(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "استرجاع الطلب" : "Refund Order"}</DialogTitle>
            <DialogDescription>
              {language === "ar" 
                ? "سيتم إنشاء إشعار دائن (Credit Note) وإرجاع المخزون تلقائياً"
                : "A credit note will be created and inventory will be returned automatically"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{language === "ar" ? "سبب الاسترجاع" : "Refund Reason"}</Label>
              <Textarea
                placeholder={language === "ar" ? "أدخل سبب الاسترجاع..." : "Enter refund reason..."}
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialogOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => refundOrderId && refundMutation.mutate({ orderId: refundOrderId, reason: refundReason })}
              disabled={refundMutation.isPending || !refundReason}
            >
              {refundMutation.isPending 
                ? (language === "ar" ? "جاري الاسترجاع..." : "Processing...") 
                : (language === "ar" ? "تأكيد الاسترجاع" : "Confirm Refund")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Order Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={(open) => { setCancelDialogOpen(open); if (!open) { setCancelReason(""); setCancelOrderId(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              {language === "ar" ? "إلغاء الطلب" : "Cancel Order"}
            </DialogTitle>
            <DialogDescription>
              {language === "ar"
                ? "سيتم إلغاء الطلب وإصدار إشعار دائن (Credit Note) تلقائياً حسب متطلبات هيئة الزكاة والضريبة (ZATCA)"
                : "The order will be cancelled and a credit note will be automatically issued per ZATCA requirements"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{language === "ar" ? "سبب الإلغاء" : "Cancellation Reason"}</Label>
              <Textarea
                placeholder={language === "ar" ? "أدخل سبب إلغاء الطلب..." : "Enter cancellation reason..."}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-md text-sm border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <p className="text-amber-700 dark:text-amber-400">
                {language === "ar"
                  ? "لا يمكن التراجع عن هذا الإجراء. سيتم إصدار إشعار دائن بقيمة الفاتورة"
                  : "This action cannot be undone. A credit note for the invoice amount will be issued"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              {language === "ar" ? "تراجع" : "Go Back"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelOrderId && updateStatusMutation.mutate({ id: cancelOrderId, status: "cancelled", reason: cancelReason })}
              disabled={updateStatusMutation.isPending || !cancelReason}
            >
              {updateStatusMutation.isPending
                ? (language === "ar" ? "جاري الإلغاء..." : "Cancelling...")
                : (language === "ar" ? "تأكيد الإلغاء" : "Confirm Cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delivery Reject Dialog */}
      <AlertDialog open={!!rejectId} onOpenChange={() => setRejectId(null)}>
        <AlertDialogContent dir={direction}>
          <AlertDialogHeader>
            <AlertDialogTitle>{isRtl ? "إلغاء الطلب" : "Cancel Order"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isRtl
                ? "سيتم إبلاغ المنصة بإلغاء هذا الطلب. يرجى اختيار السبب."
                : "The platform will be notified about this cancellation. Please select a reason."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {(() => {
            const rejectOrder = deliveryOrders.find(o => o.id === rejectId);
            const isJahez = rejectOrder?.platform === "jahez";
            
            if (isJahez) {
              return (
                <div className="space-y-2 mt-2">
                  <div className="flex flex-col gap-2">
                    {[
                      { value: "مشغولون حالياً", label: "Too Busy", labelAr: "مشغولون حالياً" },
                      { value: "المنتج غير متوفر", label: "Item Unavailable", labelAr: "المنتج غير متوفر" },
                      { value: "المتجر مغلق", label: "Store Closed", labelAr: "المتجر مغلق" },
                    ].map((r) => (
                      <Button
                        key={r.value}
                        variant={rejectReason === r.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => setRejectReason(r.value)}
                      >
                        {isRtl ? r.labelAr : r.label}
                      </Button>
                    ))}
                  </div>
                  <Input
                    value={!["مشغولون حالياً", "المنتج غير متوفر", "المتجر مغلق"].includes(rejectReason) ? rejectReason : ""}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder={isRtl ? "أو اكتب سبب آخر..." : "Or type a custom reason..."}
                  />
                </div>
              );
            }
            
            return (
              <div className="flex flex-col gap-2 mt-2">
                {[
                  { value: "TOO_BUSY", label: "Too Busy", labelAr: "مشغولون جداً" },
                  { value: "ITEM_UNAVAILABLE", label: "Item Unavailable", labelAr: "المنتج غير متوفر" },
                  { value: "CLOSED", label: "Store Closed", labelAr: "المتجر مغلق" },
                ].map((r) => (
                  <Button
                    key={r.value}
                    variant={rejectReason === r.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setRejectReason(r.value)}
                  >
                    {isRtl ? r.labelAr : r.label}
                  </Button>
                ))}
              </div>
            );
          })()}
          <AlertDialogFooter>
            <AlertDialogCancel>{isRtl ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              disabled={!rejectReason}
              onClick={() => rejectId && rejectDeliveryMutation.mutate({ id: rejectId, reason: rejectReason || "TOO_BUSY" })}
            >
              {isRtl ? "تأكيد الإلغاء" : "Confirm Cancel"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

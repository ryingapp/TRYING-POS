import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Truck, CheckCircle2, XCircle, Clock, Package, ChefHat, 
  MapPin, Phone, User, RefreshCw, Eye, ChevronDown, ChevronUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";
import { useBranch } from "@/lib/branch";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { DeliveryOrder } from "@shared/schema";

const PLATFORM_LABELS: Record<string, { name: string; nameAr: string; emoji: string }> = {
  hungerstation: { name: "HungerStation", nameAr: "هنقرستيشن", emoji: "🟠" },
  jahez: { name: "Jahez", nameAr: "جاهز", emoji: "🟣" },
  keeta: { name: "Keeta", nameAr: "كيتا", emoji: "🟢" },
  ninja: { name: "Ninja", nameAr: "نينجا", emoji: "🔴" },
};

const STATUS_CONFIG: Record<string, { label: string; labelAr: string; color: string; icon: any }> = {
  new: { label: "New", labelAr: "جديد", color: "bg-blue-500", icon: Clock },
  accepted: { label: "Accepted", labelAr: "مقبول", color: "bg-green-500", icon: CheckCircle2 },
  preparing: { label: "Preparing", labelAr: "قيد التحضير", color: "bg-yellow-500", icon: ChefHat },
  ready: { label: "Ready", labelAr: "جاهز", color: "bg-purple-500", icon: Package },
  picked_up: { label: "Picked Up", labelAr: "تم الاستلام", color: "bg-indigo-500", icon: Truck },
  delivered: { label: "Delivered", labelAr: "تم التوصيل", color: "bg-emerald-500", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", labelAr: "ملغي", color: "bg-red-500", icon: XCircle },
  rejected: { label: "Rejected", labelAr: "مرفوض", color: "bg-red-600", icon: XCircle },
};

export default function DeliveryOrdersPage() {
  const { toast } = useToast();
  const { direction } = useLanguage();
  const { selectedBranch } = useBranch();
  const isRtl = direction === "rtl";

  const [activeTab, setActiveTab] = useState("active");
  const [selectedOrder, setSelectedOrder] = useState<DeliveryOrder | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  const selectedBranchId = selectedBranch?.id;

  // Fetch delivery orders with auto-refresh — filtered by branch
  const { data: allOrders = [], isLoading } = useQuery<DeliveryOrder[]>({
    queryKey: ["/api/delivery/orders", { branch: selectedBranchId }],
    queryFn: async () => {
      const url = selectedBranchId
        ? `/api/delivery/orders?branchId=${selectedBranchId}`
        : "/api/delivery/orders";
      const res = await apiRequest("GET", url);
      return res.json();
    },
    refetchInterval: 10000, // Poll every 10 seconds for new orders
  });

  // Filter orders by tab
  const activeOrders = allOrders.filter(o => ["new", "accepted", "preparing", "ready"].includes(o.platformStatus));
  const completedOrders = allOrders.filter(o => ["picked_up", "delivered"].includes(o.platformStatus));
  const cancelledOrders = allOrders.filter(o => ["cancelled", "rejected"].includes(o.platformStatus));

  const displayOrders = activeTab === "active" ? activeOrders
    : activeTab === "completed" ? completedOrders
    : cancelledOrders;

  // Accept mutation
  const acceptMutation = useMutation({
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

  // Ready mutation
  const readyMutation = useMutation({
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

  // Reject mutation
  const rejectMutation = useMutation({
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

  const toggleExpand = (id: string) => {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const formatTime = (date: string | Date | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("ar-SA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
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

  return (
    <div className="p-6 space-y-6" dir={direction}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {isRtl ? "طلبات التوصيل" : "Delivery Orders"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isRtl
              ? `${activeOrders.length} طلب نشط • يتم التحديث تلقائياً`
              : `${activeOrders.length} active orders • Auto-refreshing`}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/delivery/orders") })}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          {isRtl ? "تحديث" : "Refresh"}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              <div>
                <div className="text-2xl font-bold">{allOrders.filter(o => o.platformStatus === "new").length}</div>
                <div className="text-xs text-muted-foreground">{isRtl ? "جديد" : "New"}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <ChefHat className="h-5 w-5 text-yellow-500" />
              <div>
                <div className="text-2xl font-bold">{allOrders.filter(o => ["accepted", "preparing"].includes(o.platformStatus)).length}</div>
                <div className="text-xs text-muted-foreground">{isRtl ? "قيد التحضير" : "Preparing"}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-purple-500" />
              <div>
                <div className="text-2xl font-bold">{allOrders.filter(o => o.platformStatus === "ready").length}</div>
                <div className="text-xs text-muted-foreground">{isRtl ? "جاهز" : "Ready"}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              <div>
                <div className="text-2xl font-bold">{completedOrders.length}</div>
                <div className="text-xs text-muted-foreground">{isRtl ? "مكتمل" : "Completed"}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="active">
            {isRtl ? "نشط" : "Active"} ({activeOrders.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            {isRtl ? "مكتمل" : "Completed"} ({completedOrders.length})
          </TabsTrigger>
          <TabsTrigger value="cancelled">
            {isRtl ? "ملغي" : "Cancelled"} ({cancelledOrders.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="py-6"><div className="h-20 bg-muted rounded" /></CardContent>
                </Card>
              ))}
            </div>
          ) : displayOrders.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Truck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium">
                  {activeTab === "active"
                    ? (isRtl ? "لا توجد طلبات نشطة" : "No active orders")
                    : activeTab === "completed"
                    ? (isRtl ? "لا توجد طلبات مكتملة" : "No completed orders")
                    : (isRtl ? "لا توجد طلبات ملغية" : "No cancelled orders")}
                </h3>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {displayOrders.map((order) => {
                const platform = PLATFORM_LABELS[order.platform] || { name: order.platform, nameAr: order.platform, emoji: "⚪" };
                const statusCfg = STATUS_CONFIG[order.platformStatus] || STATUS_CONFIG.new;
                const StatusIcon = statusCfg.icon;
                const isExpanded = expandedOrders.has(order.id);
                const items = (order.items as any[]) || [];

                return (
                  <Card
                    key={order.id}
                    className={`transition-all ${order.platformStatus === "new" ? "border-blue-400 shadow-md ring-1 ring-blue-200 dark:ring-blue-800" : ""}`}
                  >
                    <CardContent className="pt-4 pb-3">
                      {/* Order Header */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{platform.emoji}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-lg">{order.orderCode || order.externalOrderId}</span>
                              <Badge className={`${statusCfg.color} text-white text-xs`}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {isRtl ? statusCfg.labelAr : statusCfg.label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-0.5">
                              <span>{isRtl ? platform.nameAr : platform.name}</span>
                              <span>•</span>
                              <span>{timeSinceCreated(order.createdAt)}</span>
                              {order.transportType && (
                                <>
                                  <span>•</span>
                                  <span>{order.transportType === "pickup" ? (isRtl ? "استلام" : "Pickup") : (isRtl ? "توصيل" : "Delivery")}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-lg font-bold">{parseFloat(String(order.total || 0)).toFixed(2)} <span className="text-xs">{isRtl ? "ريال" : "SAR"}</span></div>
                          <div className="text-xs text-muted-foreground">{formatTime(order.createdAt)}</div>
                        </div>
                      </div>

                      {/* Customer & Delivery Info */}
                      <div className="flex flex-wrap gap-4 mt-3 text-sm">
                        {order.customerName && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <User className="h-3.5 w-3.5" />
                            <span>{order.customerName}</span>
                          </div>
                        )}
                        {order.customerPhone && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Phone className="h-3.5 w-3.5" />
                            <span dir="ltr">{order.customerPhone}</span>
                          </div>
                        )}
                        {order.deliveryAddress && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5" />
                            <span className="truncate max-w-[200px]">{order.deliveryAddress}</span>
                          </div>
                        )}
                      </div>

                      {/* Driver info */}
                      {order.driverName && (
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <Truck className="h-3.5 w-3.5" />
                          <span>{isRtl ? "السائق:" : "Driver:"} {order.driverName}</span>
                          {order.driverPhone && <span dir="ltr">{order.driverPhone}</span>}
                        </div>
                      )}

                      {/* Expandable Items */}
                      {items.length > 0 && (
                        <div className="mt-3">
                          <button
                            onClick={() => toggleExpand(order.id)}
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
                                    {item.notes && <span className="text-xs text-muted-foreground">({item.notes})</span>}
                                  </div>
                                  <span className="font-mono text-xs">{parseFloat(item.totalPrice || 0).toFixed(2)}</span>
                                </div>
                              ))}
                              <div className="border-t pt-1 mt-1 flex justify-between text-sm font-medium">
                                <span>{isRtl ? "المجموع" : "Total"}</span>
                                <span>{parseFloat(String(order.total || 0)).toFixed(2)} {isRtl ? "ريال" : "SAR"}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Cancel reason */}
                      {order.cancelReason && (
                        <div className="mt-2 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300 text-sm px-3 py-2 rounded">
                          {isRtl ? "سبب الإلغاء:" : "Reason:"} {order.cancelReason}
                        </div>
                      )}

                      {/* Action Buttons */}
                      {order.platformStatus === "new" && (
                        <div className="flex gap-2 mt-4 pt-3 border-t">
                          <Button
                            className="flex-1 bg-green-600 hover:bg-green-700"
                            onClick={() => acceptMutation.mutate(order.id)}
                            disabled={acceptMutation.isPending}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                            {isRtl ? "قبول الطلب" : "Accept Order"}
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={() => { setRejectId(order.id); setRejectReason(""); }}
                          >
                            <XCircle className="h-4 w-4 mr-2" />
                            {isRtl ? "رفض" : "Reject"}
                          </Button>
                        </div>
                      )}

                      {(order.platformStatus === "accepted" || order.platformStatus === "preparing") && (
                        <div className="flex gap-2 mt-4 pt-3 border-t">
                          <Button
                            className="flex-1 bg-purple-600 hover:bg-purple-700"
                            onClick={() => readyMutation.mutate(order.id)}
                            disabled={readyMutation.isPending}
                          >
                            <Package className="h-4 w-4 mr-2" />
                            {isRtl ? "جاهز للاستلام" : "Mark Ready"}
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => { setRejectId(order.id); setRejectReason(""); }}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            {isRtl ? "إلغاء" : "Cancel"}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Reject Dialog — supports HungerStation fixed reasons and Jahez free text */}
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
            const rejectOrder = allOrders.find(o => o.id === rejectId);
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
              onClick={() => rejectId && rejectMutation.mutate({ id: rejectId, reason: rejectReason || "TOO_BUSY" })}
            >
              {isRtl ? "تأكيد الإلغاء" : "Confirm Cancel"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

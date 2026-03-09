import { useEffect, useRef, useCallback, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLanguage } from "@/lib/i18n";
import { useBranch } from "@/lib/branch";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  ChefHat, Clock, UtensilsCrossed, Car, Bike, 
  Play, CheckCircle, Volume2, MapPin, Printer,
  Settings, Plus, Edit2, Trash2, GripVertical
} from "lucide-react";
import type { Order, OrderItem, MenuItem, KitchenSection } from "@shared/schema";

type OrderWithDetails = Order & { 
  items?: (OrderItem & { menuItem?: MenuItem })[];
  table?: { tableNumber: string; location?: string | null } | null;
};

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(800, ctx.currentTime);
    oscillator.frequency.setValueAtTime(1000, ctx.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(800, ctx.currentTime + 0.2);
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.5);

    setTimeout(() => {
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1000, ctx.currentTime);
      osc2.frequency.setValueAtTime(1200, ctx.currentTime + 0.1);
      gain2.gain.setValueAtTime(0.3, ctx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc2.start(ctx.currentTime);
      osc2.stop(ctx.currentTime + 0.4);
    }, 300);
  } catch (e) {}
}

export default function KitchenPage() {
  const { t, language, getLocalizedName, direction } = useLanguage();
  const { toast } = useToast();
  const { selectedBranchId } = useBranch();
  const prevOrderCountRef = useRef<number | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showSectionDialog, setShowSectionDialog] = useState(false);
  const [editingSection, setEditingSection] = useState<KitchenSection | null>(null);
  const [autoPrint, setAutoPrint] = useState(() => localStorage.getItem("kitchen-auto-print") === "true");
  const [sectionForm, setSectionForm] = useState({
    nameEn: "",
    nameAr: "",
    icon: "",
    color: "#8B1A1A",
    sortOrder: 0,
  });
  const autoPrintedOrdersRef = useRef<Set<string>>(new Set());

  const branchParam = selectedBranchId ? `?branch=${selectedBranchId}` : "";
  const sectionParam = selectedSectionId ? `&section=${selectedSectionId}` : "";
  const queryParams = selectedBranchId || selectedSectionId 
    ? `?${selectedBranchId ? `branch=${selectedBranchId}` : ''}${selectedSectionId ? `${selectedBranchId ? '&' : ''}section=${selectedSectionId}` : ''}`
    : "";

  const { data: kitchenSections } = useQuery<KitchenSection[]>({
    queryKey: [`/api/kitchen-sections${branchParam}`],
    refetchInterval: 30000,
  });

  const { data: orders, isLoading, refetch } = useQuery<OrderWithDetails[]>({
    queryKey: [`/api/kitchen/orders${queryParams}`],
    refetchInterval: 8000,
    staleTime: 5000,
  });

  useEffect(() => {
    console.log('[Kitchen] Orders received:', orders?.length || 0, orders);
    if (orders) {
      const newCount = orders.filter(o => ["created", "pending"].includes(o.status || "")).length;
      console.log('[Kitchen] New orders:', newCount);
      if (prevOrderCountRef.current !== null && newCount > prevOrderCountRef.current) {
        playNotificationSound();
        toast({
          title: language === "ar" ? "طلب جديد!" : "New Order!",
          description: language === "ar" ? `يوجد ${newCount} طلب جديد` : `${newCount} new order(s)`,
        });
      }
      prevOrderCountRef.current = newCount;
    }
  }, [orders]);

  const getKitchenNextStatus = (current: string | null): string => {
    const flow: Record<string, string> = {
      pending: "preparing",
      created: "preparing",
      confirmed: "preparing",
      preparing: "ready",
      ready: "completed",
    };
    return flow[current || 'pending'] || 'preparing';
  };

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      console.log('[Kitchen] Updating order status:', orderId, 'to', status);
      return apiRequest("PUT", `/api/orders/${orderId}/status`, { status });
    },
    onSuccess: (data) => {
      console.log('[Kitchen] Status updated successfully:', data);
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/kitchen") });
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/orders") });
      toast({
        title: t("updateStatus"),
        description: language === "ar" ? "تم تحديث حالة الطلب" : "Order status updated",
      });
    },
    onError: (error) => {
      console.error('[Kitchen] Status update failed:', error);
      toast({
        title: t("error"),
        description: error instanceof Error ? error.message : (language === "ar" ? "فشل في تحديث حالة الطلب" : "Failed to update order status"),
        variant: "destructive",
      });
    },
  });

  // Kitchen section CRUD mutations
  const createSectionMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/kitchen-sections", { ...data, branchId: selectedBranchId || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/kitchen-sections") });
      toast({ title: language === "ar" ? "تم الإضافة" : "Section Added" });
      handleCloseSectionDialog();
    },
  });

  const updateSectionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => apiRequest("PUT", `/api/kitchen-sections/${id}`, { ...data, branchId: selectedBranchId || null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/kitchen-sections") });
      toast({ title: language === "ar" ? "تم التحديث" : "Section Updated" });
      handleCloseSectionDialog();
    },
  });

  const deleteSectionMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/kitchen-sections/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/kitchen-sections") });
      toast({ title: language === "ar" ? "تم الحذف" : "Section Deleted" });
    },
  });

  const handleOpenSectionDialog = (section?: KitchenSection) => {
    if (section) {
      setEditingSection(section);
      setSectionForm({ nameEn: section.nameEn, nameAr: section.nameAr, icon: section.icon || "", color: section.color || "#8B1A1A", sortOrder: section.sortOrder || 0 });
    } else {
      setEditingSection(null);
      setSectionForm({ nameEn: "", nameAr: "", icon: "", color: "#8B1A1A", sortOrder: (kitchenSections?.length || 0) + 1 });
    }
    setShowSectionDialog(true);
  };

  const handleCloseSectionDialog = () => {
    setShowSectionDialog(false);
    setEditingSection(null);
    setSectionForm({ nameEn: "", nameAr: "", icon: "", color: "#8B1A1A", sortOrder: 0 });
  };

  const handleSectionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSection) {
      updateSectionMutation.mutate({ id: editingSection.id, data: sectionForm });
    } else {
      createSectionMutation.mutate(sectionForm);
    }
  };

  const handleToggleAutoPrint = (checked: boolean) => {
    setAutoPrint(checked);
    localStorage.setItem("kitchen-auto-print", String(checked));
  };

  // Auto-print new orders and change status to ready
  useEffect(() => {
    if (!autoPrint || !orders) return;
    const newOrders = orders.filter(o => ["created", "pending"].includes(o.status || ""));
    for (const order of newOrders) {
      if (!autoPrintedOrdersRef.current.has(order.id)) {
        autoPrintedOrdersRef.current.add(order.id);
        handlePrintOrder(order);
        // Auto-change status to preparing after printing
        updateStatusMutation.mutate({ orderId: order.id, status: "preparing" });
      }
    }
  }, [orders, autoPrint]);

  const getTimeSince = (date: Date | string) => {
    const now = new Date();
    const orderDate = new Date(date);
    const diffMins = Math.floor((now.getTime() - orderDate.getTime()) / 60000);
    return `${diffMins} ${t("mins")} ${t("ago")}`;
  };

  const getOrderTypeIcon = (type: string) => {
    switch (type) {
      case "dine_in": return UtensilsCrossed;
      case "pickup": return Car;
      case "delivery": return Bike;
      default: return UtensilsCrossed;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "created": return "bg-yellow-500";
      case "ready": return "bg-green-500";
      case "delivered": return "bg-gray-500";
      default: return "bg-gray-500";
    }
  };

  const handlePrintOrder = useCallback((order: OrderWithDetails) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const dir = language === "ar" ? "rtl" : "ltr";
    const itemsHtml = (order.items || []).map(item => {
      const name = item.menuItem ? getLocalizedName(item.menuItem.nameEn, item.menuItem.nameAr) : (item.itemName || "Item");
      return `
        <div class="item-row">
          <span class="item-name">${name}</span>
          <span class="item-qty">${item.quantity}x</span>
        </div>
      `;
    }).join("");

    printWindow.document.write(`
      <html>
        <head>
          <title>${language === "ar" ? "طلب مطبخ" : "Kitchen Order"} - ${order.orderNumber}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Segoe UI', Tahoma, sans-serif;
              padding: 16px;
              direction: ${dir};
              max-width: 80mm;
              margin: 0 auto;
            }
            .header {
              text-align: center;
              font-size: 20px;
              font-weight: bold;
              margin-bottom: 8px;
              padding-bottom: 8px;
              border-bottom: 2px dashed #000;
            }
            .order-type {
              text-align: center;
              font-size: 16px;
              font-weight: 600;
              margin-bottom: 8px;
              text-transform: uppercase;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              font-size: 13px;
              margin: 4px 0;
            }
            .divider {
              border-top: 1px dashed #000;
              margin: 10px 0;
            }
            .item-row {
              display: flex;
              justify-content: space-between;
              font-size: 15px;
              font-weight: 500;
              padding: 6px 0;
              border-bottom: 1px dotted #ccc;
            }
            .item-qty {
              font-weight: bold;
              font-size: 16px;
              min-width: 40px;
              text-align: center;
            }
            .notes {
              margin-top: 10px;
              padding: 8px;
              border: 1px dashed #000;
              font-size: 13px;
              font-weight: 600;
            }
            .table-badge {
              text-align: center;
              font-size: 18px;
              font-weight: bold;
              background: #000;
              color: #fff;
              padding: 6px 16px;
              border-radius: 8px;
              margin: 8px 0;
              display: inline-block;
            }
            .time {
              text-align: center;
              font-size: 11px;
              color: #666;
              margin-top: 12px;
            }
            @media print { body { padding: 0; } }
          </style>
        </head>
        <body>
          <div class="header">${order.orderNumber}</div>
          <div class="order-type">${t(order.orderType)}</div>
          ${order.table && order.orderType === "dine_in" ? `<div style="text-align:center"><span class="table-badge">${t("tableNumber")} ${order.table.tableNumber}</span></div>` : ""}
          ${order.customerName ? `<div class="info-row"><span>${t("customer")}:</span><span>${order.customerName}</span></div>` : ""}
          <div class="divider"></div>
          ${itemsHtml}
          ${order.kitchenNotes ? `<div class="notes">⚠ ${t("kitchenNotes")}: ${order.kitchenNotes}</div>` : ""}
          <div class="time">${new Date(order.createdAt || "").toLocaleString(language === "ar" ? "ar-SA" : "en-SA")}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 250);
  }, [language, t, getLocalizedName]);

  const createdOrders = orders?.filter(o => ["created", "pending", "confirmed"].includes(o.status || "")) || [];
  const preparingOrders = orders?.filter(o => o.status === "preparing") || [];
  const readyOrders = orders?.filter(o => o.status === "ready") || [];

  if (isLoading) {
    return (
      <div className="p-6 space-y-6" dir={direction}>
        <div className="flex items-center gap-3">
          <ChefHat className="h-8 w-8 text-orange-600 dark:text-orange-400" />
          <h1 className="text-2xl font-bold">{t("kitchenDisplay")}</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  const noOrders = createdOrders.length === 0 && preparingOrders.length === 0 && readyOrders.length === 0;

  return (
    <div className="h-full flex flex-col p-6" dir={direction}>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-center gap-3">
          <ChefHat className="h-8 w-8 text-orange-600 dark:text-orange-400" />
          <h1 className="text-2xl font-bold">{t("kitchenDisplay")}</h1>
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <Badge variant="outline" className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
            {language === "ar" ? "جديدة" : "New"}: {createdOrders.length}
          </Badge>
          <Badge variant="outline" className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            {language === "ar" ? "قيد التحضير" : "Preparing"}: {preparingOrders.length}
          </Badge>
          <Badge variant="outline" className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            {language === "ar" ? "جاهزة" : "Ready"}: {readyOrders.length}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <Volume2 className="h-4 w-4 me-2" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowSettings(true)}>
            <Settings className="h-4 w-4 me-2" />
            {language === "ar" ? "الإعدادات" : "Settings"}
          </Button>
        </div>
      </div>

      {/* Kitchen Sections Tabs */}
      {kitchenSections && kitchenSections.length > 0 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          <Button
            variant={selectedSectionId === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedSectionId(null)}
            className="flex items-center gap-2 whitespace-nowrap"
          >
            <UtensilsCrossed className="h-4 w-4" />
            {language === "ar" ? "جميع الأقسام" : "All Sections"}
          </Button>
          {kitchenSections.filter(s => s.isActive).map((section) => (
            <Button
              key={section.id}
              variant={selectedSectionId === section.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedSectionId(section.id)}
              className="flex items-center gap-2 whitespace-nowrap"
              style={selectedSectionId === section.id ? { backgroundColor: section.color || '#8B1A1A', borderColor: section.color || '#8B1A1A' } : {}}
            >
              {section.icon && <span className="text-base">{section.icon}</span>}
              <span>{getLocalizedName(section.nameEn, section.nameAr)}</span>
            </Button>
          ))}
        </div>
      )}

      {noOrders ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <ChefHat className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">{t("noKitchenOrders")}</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-auto">
          {/* New Orders Column */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              {language === "ar" ? "طلبات جديدة" : "New Orders"} ({createdOrders.length})
            </h2>
            <div className="space-y-4">
              {createdOrders.map((order) => {
                const OrderTypeIcon = getOrderTypeIcon(order.orderType);
                return (
                  <Card 
                    key={order.id} 
                    data-testid={`card-kitchen-order-${order.id}`}
                    className="bg-yellow-50 dark:bg-yellow-950/20"
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <OrderTypeIcon className="h-5 w-5" />
                          {order.orderNumber}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handlePrintOrder(order)}
                            title={t("printOrder")}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                          <Badge className={getStatusColor(order.status || "created")}>
                            {language === "ar" ? "جديد" : "New"}
                          </Badge>
                        </div>
                      </div>
                      {order.table && order.orderType === "dine_in" && (
                        <Badge className="bg-blue-500 text-white text-base px-3 py-1 mt-1">
                          <MapPin className="h-4 w-4 me-1" />
                          {t("tableNumber")} {order.table.tableNumber}
                        </Badge>
                      )}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {order.createdAt && getTimeSince(order.createdAt)}
                        </span>
                        {order.customerName && <span>{order.customerName}</span>}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {order.items && order.items.length > 0 ? (
                        <div className="space-y-2">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="p-2 bg-muted/50 rounded-md">
                              <div className="flex justify-between items-center">
                                <span className="font-semibold text-sm">
                                  {item.menuItem ? getLocalizedName(item.menuItem.nameEn, item.menuItem.nameAr) : (item.itemName || (language === "ar" ? "صنف غير محدد" : "Unknown Item"))}
                                </span>
                                <Badge variant="secondary" className="text-base font-bold px-3">{item.quantity}x</Badge>
                              </div>
                              {item.notes && (
                                <div className="mt-2 p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded text-sm flex items-start gap-2">
                                  <span className="text-yellow-600 dark:text-yellow-400">⚠</span>
                                  <span className="text-yellow-800 dark:text-yellow-200">{item.notes}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-3 bg-muted/30 rounded-md text-center text-muted-foreground text-sm">
                          {language === "ar" ? "لا توجد أصناف" : "No items"}
                        </div>
                      )}

                      {order.kitchenNotes && (
                        <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-md text-sm">
                          <strong>{t("kitchenNotes")}:</strong> {order.kitchenNotes}
                        </div>
                      )}
                      
                      {order.notes && (
                        <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-md text-sm border border-red-200 dark:border-red-800">
                          <strong className="text-red-600 dark:text-red-400">📝 {language === "ar" ? "ملاحظات:" : "Notes:"}</strong> {order.notes}
                        </div>
                      )}

                      <div className="text-sm text-muted-foreground">
                        {t("total")}: {parseFloat(order.total || "0").toFixed(2)} {t("sar")}
                      </div>

                      <Button
                        data-testid={`button-start-cooking-${order.id}`}
                        className="w-full"
                        onClick={() => updateStatusMutation.mutate({ 
                          orderId: order.id, 
                          status: getKitchenNextStatus(order.status) 
                        })}
                        disabled={updateStatusMutation.isPending}
                      >
                        <Play className="h-4 w-4 me-2" />
                        {order.status === "preparing" 
                          ? (language === "ar" ? "جاهز" : "Mark Ready")
                          : (language === "ar" ? "ابدأ التحضير" : "Start Preparing")}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Preparing Orders Column */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500 animate-pulse" />
              {language === "ar" ? "قيد التحضير" : "Preparing"} ({preparingOrders.length})
            </h2>
            <div className="space-y-4">
              {preparingOrders.map((order) => {
                const OrderTypeIcon = getOrderTypeIcon(order.orderType);
                return (
                  <Card 
                    key={order.id} 
                    className="bg-orange-50 dark:bg-orange-950/20 border-orange-200"
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <OrderTypeIcon className="h-5 w-5" />
                          {order.orderNumber}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handlePrintOrder(order)}
                            title={t("printOrder")}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                          <Badge className="bg-orange-500 text-white">
                            {language === "ar" ? "قيد التحضير" : "Preparing"}
                          </Badge>
                        </div>
                      </div>
                      {order.table && order.orderType === "dine_in" && (
                        <Badge className="bg-blue-500 text-white text-base px-3 py-1 mt-1">
                          <MapPin className="h-4 w-4 me-1" />
                          {t("tableNumber")} {order.table.tableNumber}
                        </Badge>
                      )}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {order.createdAt && getTimeSince(order.createdAt)}
                        </span>
                        {order.customerName && <span>{order.customerName}</span>}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {order.items && order.items.length > 0 ? (
                        <div className="space-y-2">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="p-2 bg-muted/50 rounded-md">
                              <div className="flex justify-between items-center">
                                <span className="font-semibold text-sm">
                                  {item.menuItem ? getLocalizedName(item.menuItem.nameEn, item.menuItem.nameAr) : (item.itemName || (language === "ar" ? "صنف غير محدد" : "Unknown Item"))}
                                </span>
                                <Badge variant="secondary" className="text-base font-bold px-3">{item.quantity}x</Badge>
                              </div>
                              {item.notes && (
                                <div className="mt-2 p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded text-sm flex items-start gap-2">
                                  <span className="text-yellow-600 dark:text-yellow-400">⚠</span>
                                  <span className="text-yellow-800 dark:text-yellow-200">{item.notes}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-3 bg-muted/30 rounded-md text-center text-muted-foreground text-sm">
                          {language === "ar" ? "لا توجد أصناف" : "No items"}
                        </div>
                      )}

                      {order.kitchenNotes && (
                        <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-md text-sm">
                          <strong>{t("kitchenNotes")}:</strong> {order.kitchenNotes}
                        </div>
                      )}

                      {order.notes && (
                        <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-md text-sm border border-red-200 dark:border-red-800">
                          <strong className="text-red-600 dark:text-red-400">📝 {language === "ar" ? "ملاحظات:" : "Notes:"}</strong> {order.notes}
                        </div>
                      )}

                      <Button
                        className="w-full bg-green-600 hover:bg-green-700"
                        onClick={() => updateStatusMutation.mutate({ 
                          orderId: order.id, 
                          status: "ready" 
                        })}
                        disabled={updateStatusMutation.isPending}
                      >
                        <CheckCircle className="h-4 w-4 me-2" />
                        {language === "ar" ? "جاهز" : "Mark Ready"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Ready Orders Column */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
              {language === "ar" ? "جاهزة للتسليم" : "Ready"} ({readyOrders.length})
            </h2>
            <div className="space-y-4">
              {readyOrders.map((order) => {
                const OrderTypeIcon = getOrderTypeIcon(order.orderType);
                return (
                  <Card 
                    key={order.id}
                    data-testid={`card-kitchen-ready-${order.id}`}
                    className="bg-green-50 dark:bg-green-950/20"
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <OrderTypeIcon className="h-5 w-5" />
                          {order.orderNumber}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handlePrintOrder(order)}
                            title={t("printOrder")}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                          <Badge className={getStatusColor(order.status || "ready")}>
                            {language === "ar" ? "جاهز" : "Ready"}
                          </Badge>
                        </div>
                      </div>
                      {order.table && order.orderType === "dine_in" && (
                        <Badge className="bg-blue-500 text-white text-base px-3 py-1 mt-1">
                          <MapPin className="h-4 w-4 me-1" />
                          {t("tableNumber")} {order.table.tableNumber}
                        </Badge>
                      )}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {order.createdAt && getTimeSince(order.createdAt)}
                        </span>
                        {order.customerName && <span>{order.customerName}</span>}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {order.items && order.items.length > 0 ? (
                        <div className="space-y-2">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="p-2 bg-muted/50 rounded-md">
                              <div className="flex justify-between items-center">
                                <span className="font-semibold text-sm">
                                  {item.menuItem ? getLocalizedName(item.menuItem.nameEn, item.menuItem.nameAr) : (item.itemName || (language === "ar" ? "صنف غير محدد" : "Unknown Item"))}
                                </span>
                                <Badge variant="secondary" className="text-base font-bold px-3">{item.quantity}x</Badge>
                              </div>
                              {item.notes && (
                                <div className="mt-2 p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded text-sm flex items-start gap-2">
                                  <span className="text-yellow-600 dark:text-yellow-400">⚠</span>
                                  <span className="text-yellow-800 dark:text-yellow-200">{item.notes}</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-3 bg-muted/30 rounded-md text-center text-muted-foreground text-sm">
                          {language === "ar" ? "لا توجد أصناف" : "No items"}
                        </div>
                      )}

                      {order.kitchenNotes && (
                        <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-md text-sm">
                          <strong>{t("kitchenNotes")}:</strong> {order.kitchenNotes}
                        </div>
                      )}

                      {order.notes && (
                        <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-md text-sm border border-red-200 dark:border-red-800">
                          <strong className="text-red-600 dark:text-red-400">📝 {language === "ar" ? "ملاحظات:" : "Notes:"}</strong> {order.notes}
                        </div>
                      )}

                      <div className="text-sm text-muted-foreground">
                        {t("total")}: {parseFloat(order.total || "0").toFixed(2)} {t("sar")}
                      </div>

                      <Button
                        data-testid={`button-mark-delivered-${order.id}`}
                        className="w-full"
                        variant="default"
                        onClick={() => updateStatusMutation.mutate({ 
                          orderId: order.id, 
                          status: "completed" 
                        })}
                        disabled={updateStatusMutation.isPending}
                      >
                        <CheckCircle className="h-4 w-4 me-2" />
                        {language === "ar" ? "تم التسليم" : "Completed"}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent dir={direction} className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              {language === "ar" ? "إعدادات المطبخ" : "Kitchen Settings"}
            </DialogTitle>
          </DialogHeader>

          {/* Auto Print Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex items-center gap-3">
              <Printer className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{language === "ar" ? "الطباعة التلقائية" : "Auto Print"}</p>
                <p className="text-sm text-muted-foreground">
                  {language === "ar" ? "طباعة الطلبات الجديدة تلقائياً" : "Automatically print new orders"}
                </p>
              </div>
            </div>
            <Switch checked={autoPrint} onCheckedChange={handleToggleAutoPrint} />
          </div>

          {/* Kitchen Sections Management */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <ChefHat className="h-5 w-5" />
                {language === "ar" ? "أقسام المطبخ" : "Kitchen Sections"}
              </h3>
              <Button size="sm" onClick={() => handleOpenSectionDialog()}>
                <Plus className="h-4 w-4 me-1" />
                {language === "ar" ? "إضافة قسم" : "Add Section"}
              </Button>
            </div>

            {!kitchenSections || kitchenSections.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground border rounded-lg">
                <ChefHat className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>{language === "ar" ? "لا توجد أقسام مطبخ بعد" : "No kitchen sections yet"}</p>
                <p className="text-sm mt-1">
                  {language === "ar" ? "أضف أقسام لتنظيم المطبخ" : "Add sections to organize your kitchen"}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead className="w-16">{language === "ar" ? "أيقونة" : "Icon"}</TableHead>
                    <TableHead>{language === "ar" ? "الاسم" : "Name"}</TableHead>
                    <TableHead className="w-24">{language === "ar" ? "اللون" : "Color"}</TableHead>
                    <TableHead className="w-24">{language === "ar" ? "الحالة" : "Status"}</TableHead>
                    <TableHead className="w-32 text-end">{language === "ar" ? "إجراءات" : "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kitchenSections.map((section) => (
                    <TableRow key={section.id}>
                      <TableCell><GripVertical className="h-4 w-4 text-muted-foreground" /></TableCell>
                      <TableCell><span className="text-2xl">{section.icon || "🍽️"}</span></TableCell>
                      <TableCell className="font-medium">{getLocalizedName(section.nameEn, section.nameAr)}</TableCell>
                      <TableCell>
                        <div className="w-6 h-6 rounded border" style={{ backgroundColor: section.color || '#8B1A1A' }} />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={section.isActive ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-700 border-gray-200"}>
                          {section.isActive ? (language === "ar" ? "نشط" : "Active") : (language === "ar" ? "غير نشط" : "Inactive")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-end">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenSectionDialog(section)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            onClick={() => { if (confirm(language === "ar" ? "هل تريد حذف هذا القسم؟" : "Delete this section?")) deleteSectionMutation.mutate(section.id); }}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Section Add/Edit Dialog */}
      <Dialog open={showSectionDialog} onOpenChange={setShowSectionDialog}>
        <DialogContent dir={direction}>
          <DialogHeader>
            <DialogTitle>
              {editingSection
                ? (language === "ar" ? "تعديل القسم" : "Edit Section")
                : (language === "ar" ? "إضافة قسم جديد" : "Add New Section")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSectionSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>{language === "ar" ? "الاسم بالإنجليزية" : "Name (English)"}</Label>
              <Input value={sectionForm.nameEn} onChange={(e) => setSectionForm({ ...sectionForm, nameEn: e.target.value })} placeholder="Appetizers" required />
            </div>
            <div className="space-y-2">
              <Label>{language === "ar" ? "الاسم بالعربية" : "Name (Arabic)"}</Label>
              <Input value={sectionForm.nameAr} onChange={(e) => setSectionForm({ ...sectionForm, nameAr: e.target.value })} placeholder="المقبلات" required />
            </div>
            <div className="space-y-2">
              <Label>{language === "ar" ? "الأيقونة" : "Icon"}</Label>
              <div className="flex gap-2 flex-wrap">
                {["🥗", "🍖", "🍕", "🍰", "🚚", "🍜", "🍔", "🍣", "🥘", "☕"].map((icon) => (
                  <button key={icon} type="button"
                    className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center text-xl hover:border-primary transition-colors ${sectionForm.icon === icon ? 'border-primary bg-primary/10' : 'border-border'}`}
                    onClick={() => setSectionForm({ ...sectionForm, icon })}
                  >{icon}</button>
                ))}
              </div>
              <Input value={sectionForm.icon} onChange={(e) => setSectionForm({ ...sectionForm, icon: e.target.value })} placeholder="🍽️" className="text-center text-2xl h-12" />
            </div>
            <div className="space-y-2">
              <Label>{language === "ar" ? "اللون" : "Color"}</Label>
              <div className="flex gap-2">
                <Input type="color" value={sectionForm.color} onChange={(e) => setSectionForm({ ...sectionForm, color: e.target.value })} className="w-20 h-10" />
                <Input value={sectionForm.color} onChange={(e) => setSectionForm({ ...sectionForm, color: e.target.value })} placeholder="#8B1A1A" className="flex-1" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{language === "ar" ? "ترتيب العرض" : "Sort Order"}</Label>
              <Input type="number" value={sectionForm.sortOrder} onChange={(e) => setSectionForm({ ...sectionForm, sortOrder: parseInt(e.target.value) || 0 })} min="0" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseSectionDialog}>{t("cancel")}</Button>
              <Button type="submit" disabled={createSectionMutation.isPending || updateSectionMutation.isPending}>
                {editingSection ? t("save") : (language === "ar" ? "إضافة" : "Add")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

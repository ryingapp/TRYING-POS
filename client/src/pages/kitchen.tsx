import { useEffect, useRef, useCallback, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLanguage } from "@/lib/i18n";
import { useBranch } from "@/lib/branch";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  ChefHat, Clock, UtensilsCrossed, Car, Bike, 
  Play, CheckCircle, Volume2, MapPin, Printer
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

  const branchParam = selectedBranchId ? `?branch=${selectedBranchId}` : "";
  const sectionParam = selectedSectionId ? `&section=${selectedSectionId}` : "";
  const queryParams = selectedBranchId || selectedSectionId 
    ? `?${selectedBranchId ? `branch=${selectedBranchId}` : ''}${selectedSectionId ? `${selectedBranchId ? '&' : ''}section=${selectedSectionId}` : ''}`
    : "";

  const { data: kitchenSections } = useQuery<KitchenSection[]>({
    queryKey: [`/api/kitchen-sections${branchParam}`],
  });

  const { data: orders, isLoading, refetch } = useQuery<OrderWithDetails[]>({
    queryKey: [`/api/kitchen/orders${queryParams}`],
    refetchInterval: 5000,
  });

  useEffect(() => {
    if (orders) {
      const pendingCount = orders.filter(o => o.status === "pending").length;
      if (prevOrderCountRef.current !== null && pendingCount > prevOrderCountRef.current) {
        playNotificationSound();
        toast({
          title: language === "ar" ? "طلب جديد!" : "New Order!",
          description: language === "ar" ? `يوجد ${pendingCount} طلب جديد` : `${pendingCount} new order(s)`,
        });
      }
      prevOrderCountRef.current = pendingCount;
    }
  }, [orders]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      return apiRequest("PUT", `/api/orders/${orderId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/kitchen") });
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/orders") });
      toast({
        title: t("updateStatus"),
        description: language === "ar" ? "تم تحديث حالة الطلب" : "Order status updated",
      });
    },
    onError: (error) => {
      toast({
        title: t("error"),
        description: error instanceof Error ? error.message : (language === "ar" ? "فشل في تحديث حالة الطلب" : "Failed to update order status"),
        variant: "destructive",
      });
    },
  });

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
      case "pending": return "bg-yellow-500";
      case "confirmed": return "bg-blue-500";
      case "preparing": return "bg-orange-500";
      case "ready": return "bg-green-500";
      default: return "bg-gray-500";
    }
  };

  const handlePrintOrder = useCallback((order: OrderWithDetails) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const dir = language === "ar" ? "rtl" : "ltr";
    const itemsHtml = (order.items || []).map(item => {
      const name = item.menuItem ? getLocalizedName(item.menuItem.nameEn, item.menuItem.nameAr) : "Item";
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

  const pendingOrders = orders?.filter(o => o.status === "pending" || o.status === "confirmed") || [];
  const preparingOrders = orders?.filter(o => o.status === "preparing") || [];

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

  const noOrders = pendingOrders.length === 0 && preparingOrders.length === 0;

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
            {t("newOrders")}: {pendingOrders.length}
          </Badge>
          <Badge variant="outline" className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            {t("inProgress")}: {preparingOrders.length}
          </Badge>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <Volume2 className="h-4 w-4 me-2" />
            Refresh
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
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-auto">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-500" />
              {t("newOrders")} ({pendingOrders.length})
            </h2>
            <div className="space-y-4">
              {pendingOrders.map((order) => {
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
                          <Badge className={getStatusColor(order.status || "pending")}>
                            {t(order.status || "pending")}
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
                      {order.items && order.items.length > 0 && (
                        <div className="space-y-1">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center text-sm p-1 bg-muted/50 rounded">
                              <span className="font-medium">
                                {item.menuItem ? getLocalizedName(item.menuItem.nameEn, item.menuItem.nameAr) : "Item"}
                              </span>
                              <Badge variant="secondary">{item.quantity}x</Badge>
                            </div>
                          ))}
                        </div>
                      )}

                      {order.kitchenNotes && (
                        <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-md text-sm">
                          <strong>{t("kitchenNotes")}:</strong> {order.kitchenNotes}
                        </div>
                      )}
                      
                      <div className="text-sm text-muted-foreground">
                        {t("total")}: {parseFloat(order.total || "0").toFixed(2)} {t("sar")}
                      </div>

                      <Button
                        data-testid={`button-start-preparing-${order.id}`}
                        className="w-full"
                        onClick={() => updateStatusMutation.mutate({ 
                          orderId: order.id, 
                          status: "preparing" 
                        })}
                        disabled={updateStatusMutation.isPending}
                      >
                        <Play className="h-4 w-4 me-2" />
                        {t("markPreparing")}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-500 animate-pulse" />
              {t("inProgress")} ({preparingOrders.length})
            </h2>
            <div className="space-y-4">
              {preparingOrders.map((order) => {
                const OrderTypeIcon = getOrderTypeIcon(order.orderType);
                return (
                  <Card 
                    key={order.id}
                    data-testid={`card-kitchen-preparing-${order.id}`}
                    className="bg-orange-50 dark:bg-orange-950/20"
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
                          <Badge className={getStatusColor(order.status || "preparing")}>
                            {t(order.status || "preparing")}
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
                      {order.items && order.items.length > 0 && (
                        <div className="space-y-1">
                          {order.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center text-sm p-1 bg-muted/50 rounded">
                              <span className="font-medium">
                                {item.menuItem ? getLocalizedName(item.menuItem.nameEn, item.menuItem.nameAr) : "Item"}
                              </span>
                              <Badge variant="secondary">{item.quantity}x</Badge>
                            </div>
                          ))}
                        </div>
                      )}

                      {order.kitchenNotes && (
                        <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-md text-sm">
                          <strong>{t("kitchenNotes")}:</strong> {order.kitchenNotes}
                        </div>
                      )}

                      <div className="text-sm text-muted-foreground">
                        {t("total")}: {parseFloat(order.total || "0").toFixed(2)} {t("sar")}
                      </div>

                      <Button
                        data-testid={`button-mark-ready-${order.id}`}
                        className="w-full"
                        variant="default"
                        onClick={() => updateStatusMutation.mutate({ 
                          orderId: order.id, 
                          status: "ready" 
                        })}
                        disabled={updateStatusMutation.isPending}
                      >
                        <CheckCircle className="h-4 w-4 me-2" />
                        {t("markReady")}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

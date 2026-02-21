import { useQuery } from "@tanstack/react-query";
import { DollarSign, ShoppingCart, Clock, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/lib/i18n";
import { useBranch } from "@/lib/branch";
import type { Order, MenuItem, Table } from "@shared/schema";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  description?: string;
  isLoading?: boolean;
}

function StatCard({ title, value, icon: Icon, description, isLoading }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function OrderStatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();
  
  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    confirmed: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    preparing: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
    ready: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    completed: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
    cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  };

  return (
    <Badge className={`${statusColors[status] || statusColors.pending} border-0`}>
      {t(status)}
    </Badge>
  );
}

export default function Dashboard() {
  const { t, getLocalizedName } = useLanguage();
  const { selectedBranchId } = useBranch();

  const branchParam = selectedBranchId ? `?branch=${selectedBranchId}` : "";

  const { data: orders, isLoading: ordersLoading } = useQuery<Order[]>({
    queryKey: [`/api/orders${branchParam}`],
  });

  const { data: menuItems, isLoading: itemsLoading } = useQuery<MenuItem[]>({
    queryKey: ["/api/menu-items"],
  });

  const { data: tables, isLoading: tablesLoading } = useQuery<Table[]>({
    queryKey: [`/api/tables${branchParam}`],
  });

  const isLoading = ordersLoading || itemsLoading || tablesLoading;

  const todayOrders = orders?.filter((order) => {
    const today = new Date();
    const orderDate = new Date(order.createdAt!);
    return orderDate.toDateString() === today.toDateString();
  }) || [];

  const todaySales = todayOrders.reduce(
    (sum, order) => sum + parseFloat(order.total?.toString() || "0"),
    0
  );

  const activeOrders = orders?.filter((order) =>
    ["pending", "confirmed", "preparing", "ready"].includes(order.status || "")
  ) || [];

  const occupiedTables = tables?.filter((table) => table.status === "occupied") || [];

  const recentOrders = orders?.slice(0, 5) || [];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">{t("welcome")}</h2>
        <p className="text-muted-foreground">{t("overview")}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t("todaySales")}
          value={`${todaySales.toFixed(2)} ${t("sar")}`}
          icon={DollarSign}
          isLoading={isLoading}
        />
        <StatCard
          title={t("totalOrders")}
          value={todayOrders.length}
          icon={ShoppingCart}
          isLoading={isLoading}
        />
        <StatCard
          title={t("activeOrders")}
          value={activeOrders.length}
          icon={Clock}
          isLoading={isLoading}
        />
        <StatCard
          title={t("tablesOccupied")}
          value={`${occupiedTables.length}/${tables?.length || 0}`}
          icon={Users}
          isLoading={isLoading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <span>{t("recentOrders")}</span>
              <Badge variant="secondary" className="text-xs">
                {activeOrders.length} {t("active")}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ordersLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : recentOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <ShoppingCart className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">{t("noOrders")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between gap-4 rounded-md border p-3 hover-elevate"
                    data-testid={`order-item-${order.id}`}
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {t("orderNumber")}{order.orderNumber}
                        </span>
                        <OrderStatusBadge status={order.status || "pending"} />
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {order.customerName || t("customer")} • {t(order.orderType || "dineIn")}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">
                        {parseFloat(order.total?.toString() || "0").toFixed(2)} {t("sar")}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(order.createdAt!).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("popularItems")}</CardTitle>
          </CardHeader>
          <CardContent>
            {itemsLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : !menuItems || menuItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <ShoppingCart className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">{t("noItems")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {menuItems.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-4 rounded-md border p-3 hover-elevate"
                    data-testid={`menu-item-${item.id}`}
                  >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={getLocalizedName(item.nameEn, item.nameAr)}
                        className="h-12 w-12 rounded-md object-cover"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-muted">
                        <ShoppingCart className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="font-medium">
                        {getLocalizedName(item.nameEn, item.nameAr)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {parseFloat(item.price?.toString() || "0").toFixed(2)} {t("sar")}
                      </div>
                    </div>
                    <Badge variant={item.isAvailable ? "default" : "secondary"}>
                      {item.isAvailable ? t("available") : t("unavailable")}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, Clock, ChefHat, CheckCircle, XCircle, ShoppingCart } from "lucide-react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
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
import type { Order, Table, MenuItem, InsertOrder } from "@shared/schema";
import { orderTypes, orderStatuses } from "@shared/schema";

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
  const { t } = useLanguage();
  const { toast } = useToast();
  const { selectedBranchId } = useBranch();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

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

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PUT", `/api/orders/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/orders") });
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/tables") });
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/kitchen") });
      toast({ title: t("statusUpdated") });
    },
    onError: () => {
      toast({ title: t("statusUpdateFailed"), variant: "destructive" });
    },
  });

  const getNextStatus = (current: string): string | null => {
    const flow: Record<string, string> = {
      pending: "confirmed",
      confirmed: "preparing",
      preparing: "ready",
      ready: "completed",
    };
    return flow[current] || null;
  };

  const filteredOrders = orders?.filter((order) => {
    const matchesSearch =
      order.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      order.customerName?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const ordersByStatus = {
    active: orders?.filter((o) => ["pending", "confirmed", "preparing", "ready"].includes(o.status || "")) || [],
    completed: orders?.filter((o) => o.status === "completed") || [],
    cancelled: orders?.filter((o) => o.status === "cancelled") || [],
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{t("orders")}</h2>
          <p className="text-muted-foreground">
            {ordersByStatus.active.length} {t("activeOrders")}
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
            <SelectItem value="all">{t("status")}: {t("all")}</SelectItem>
            {orderStatuses.map((status) => (
              <SelectItem key={status} value={status}>
                {t(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {ordersLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : !filteredOrders || filteredOrders.length === 0 ? (
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredOrders.map((order) => {
            const table = tables?.find((t) => t.id === order.tableId);
            const nextStatus = getNextStatus(order.status || "");
            
            return (
              <Card key={order.id} className="hover-elevate" data-testid={`order-card-${order.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <CardTitle className="text-lg">
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
                    {order.customerPhone && (
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
                  {nextStatus && order.status !== "cancelled" && (
                    <Button
                      className="w-full mt-4"
                      variant="outline"
                      onClick={() => updateStatusMutation.mutate({ id: order.id, status: nextStatus })}
                      disabled={updateStatusMutation.isPending}
                      data-testid={`button-advance-order-${order.id}`}
                    >
                      {t("updateStatus")}: {t(nextStatus)}
                    </Button>
                  )}
                  {order.status !== "cancelled" && order.status !== "completed" && (
                    <Button
                      className="w-full mt-2"
                      variant="ghost"
                      onClick={() => updateStatusMutation.mutate({ id: order.id, status: "cancelled" })}
                      disabled={updateStatusMutation.isPending}
                      data-testid={`button-cancel-order-${order.id}`}
                    >
                      <XCircle className="h-4 w-4 me-2 text-destructive" />
                      {t("cancelled")}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

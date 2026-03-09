import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Plus,
  Users,
  Edit2,
  Trash2,
  MapPin,
  CalendarDays,
  Clock,
  Phone,
  CheckCircle,
  XCircle,
  Bell,
  MessageCircle,
  UserPlus,
  LayoutGrid,
  BookOpen,
  ListOrdered,
  ChevronDown,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";
import { useBranch } from "@/lib/branch";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Table as TableType, InsertTable } from "@shared/schema";
import { tableStatuses } from "@shared/schema";

interface Reservation {
  id: string;
  restaurantId: string;
  branchId: string | null;
  tableId: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  guestCount: number;
  reservationDate: string;
  reservationTime: string;
  duration: number;
  status: string;
  notes: string | null;
  specialRequests: string | null;
  source: string | null;
  depositAmount: string | null;
  depositPaid: boolean;
  depositAppliedToOrder: string | null;
  createdAt: string;
}

interface QueueEntry {
  id: string;
  restaurantId: string;
  branchId: string | null;
  queueNumber: number;
  customerName: string;
  customerPhone: string;
  partySize: number;
  status: string;
  estimatedWaitMinutes: number | null;
  notes: string | null;
  notifiedAt: Date | null;
  seatedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
}

interface QueueStats {
  totalWaiting: number;
  averageWaitTime: number;
  nextQueueNumber: number;
}

interface TableData {
  id: string;
  tableNumber: string;
  capacity: number;
  status: string;
}

const tableFormSchema = z.object({
  tableNumber: z.string().min(1, "Required"),
  capacity: z.string().min(1, "Required"),
  location: z.string().optional(),
  status: z.string().default("available"),
});

function TableStatusBadge({ status }: { status: string }) {
  const { t } = useLanguage();

  const statusColors: Record<string, string> = {
    available: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    occupied: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    reserved: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    maintenance: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  };

  return (
    <Badge className={`${statusColors[status] || statusColors.available} border-0`}>
      {t(status)}
    </Badge>
  );
}

function TableForm({
  table,
  onSuccess,
  branchId,
}: {
  table?: TableType;
  onSuccess: () => void;
  branchId: string | null;
}) {
  const { t, language } = useLanguage();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof tableFormSchema>>({
    resolver: zodResolver(tableFormSchema),
    defaultValues: {
      tableNumber: table?.tableNumber || "",
      capacity: table?.capacity?.toString() || "",
      location: table?.location || "",
      status: table?.status || "available",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertTable) => apiRequest("POST", "/api/tables", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/tables") });
      toast({ title: t("tableCreated") });
      onSuccess();
    },
    onError: () => {
      toast({ title: t("tableCreateFailed"), variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: InsertTable) =>
      apiRequest("PUT", `/api/tables/${table?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/tables") });
      toast({ title: t("tableUpdated") });
      onSuccess();
    },
    onError: () => {
      toast({ title: t("tableUpdateFailed"), variant: "destructive" });
    },
  });

  const onSubmit = (data: z.infer<typeof tableFormSchema>) => {
    const payload: InsertTable = {
      ...data,
      capacity: parseInt(data.capacity),
      restaurantId: "default",
      branchId: branchId || null,
    };
    if (table) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="tableNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("tableNumber")}</FormLabel>
              <FormControl>
                <Input {...field} placeholder={language === "ar" ? "مثال: T1, A1" : "e.g. T1, A1"} data-testid="input-table-number" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="capacity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("capacity")}</FormLabel>
              <FormControl>
                <Input {...field} type="number" min="1" data-testid="input-table-capacity" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("location")}</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Indoor, Outdoor, etc." data-testid="input-table-location" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("status")}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-table-status">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {tableStatuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {t(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          type="submit"
          className="w-full"
          disabled={isPending}
          data-testid="button-save-table"
        >
          {isPending ? "..." : t("save")}
        </Button>
      </form>
    </Form>
  );
}

function TablesTab({
  tables,
  isLoading,
  branchId,
  language,
}: {
  tables: TableType[] | undefined;
  isLoading: boolean;
  branchId: string | null;
  language: string;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TableType | undefined>();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/tables/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/tables") });
      toast({ title: language === "ar" ? "تم حذف الطاولة" : "Table deleted" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PUT", `/api/tables/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/tables") });
    },
  });

  const openEdit = (table: TableType) => {
    setEditingTable(table);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingTable(undefined);
  };

  const filteredTables = tables?.filter((table) => {
    if (statusFilter === "all") return true;
    return table.status === statusFilter;
  });

  const stats = {
    total: tables?.length || 0,
    available: tables?.filter((t) => t.status === "available").length || 0,
    occupied: tables?.filter((t) => t.status === "occupied").length || 0,
    reserved: tables?.filter((t) => t.status === "reserved").length || 0,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div />
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          if (!open) closeDialog();
          else setDialogOpen(true);
        }}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-table">
              <Plus className="h-4 w-4 me-2" />
              {t("addTable")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingTable ? t("edit") : t("addTable")}
              </DialogTitle>
            </DialogHeader>
            <TableForm
              table={editingTable}
              onSuccess={closeDialog}
              branchId={branchId}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card
          className={`cursor-pointer transition-all ${statusFilter === "all" ? "ring-2 ring-primary" : ""}`}
          onClick={() => setStatusFilter("all")}
          data-testid="filter-all"
        >
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-muted-foreground">{t("tables")}</div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all ${statusFilter === "available" ? "ring-2 ring-green-500" : ""}`}
          onClick={() => setStatusFilter("available")}
          data-testid="filter-available"
        >
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-600">{stats.available}</div>
            <div className="text-sm text-muted-foreground">{t("available")}</div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all ${statusFilter === "occupied" ? "ring-2 ring-red-500" : ""}`}
          onClick={() => setStatusFilter("occupied")}
          data-testid="filter-occupied"
        >
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{stats.occupied}</div>
            <div className="text-sm text-muted-foreground">{t("occupied")}</div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all ${statusFilter === "reserved" ? "ring-2 ring-blue-500" : ""}`}
          onClick={() => setStatusFilter("reserved")}
          data-testid="filter-reserved"
        >
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-600">{stats.reserved}</div>
            <div className="text-sm text-muted-foreground">{t("reserved")}</div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : !filteredTables || filteredTables.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Users className="h-16 w-16 text-muted-foreground/50 mb-4" />
            <p className="text-lg text-muted-foreground">{t("noTables")}</p>
            <Button
              className="mt-4"
              onClick={() => setDialogOpen(true)}
              data-testid="button-add-first-table"
            >
              <Plus className="h-4 w-4 me-2" />
              {t("addTable")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredTables.map((table) => (
            <Card
              key={table.id}
              className="hover-elevate"
              data-testid={`table-card-${table.id}`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2 mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-lg text-lg font-bold ${
                      table.status === "available"
                        ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                        : table.status === "occupied"
                        ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                        : table.status === "reserved"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                        : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                    }`}>
                      {table.tableNumber}
                    </div>
                    <div>
                      <div className="font-semibold">{t("tableNumber")} {table.tableNumber}</div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Users className="h-3 w-3" />
                        {table.capacity} {t("guests")}
                      </div>
                    </div>
                  </div>
                  <TableStatusBadge status={table.status || "available"} />
                </div>
                {table.location && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mb-3">
                    <MapPin className="h-3 w-3" />
                    {table.location}
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 pt-3 border-t">
                  <Select
                    value={table.status || "available"}
                    onValueChange={(status) => updateStatusMutation.mutate({ id: table.id, status })}
                  >
                    <SelectTrigger className="flex-1" data-testid={`select-status-${table.id}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {tableStatuses.map((status) => (
                        <SelectItem key={status} value={status}>
                          {t(status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEdit(table)}
                    data-testid={`button-edit-table-${table.id}`}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => { if (window.confirm('هل أنت متأكد من حذف هذه الطاولة؟')) deleteMutation.mutate(table.id); }}
                    data-testid={`button-delete-table-${table.id}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function ReservationsTab({ language, branchId }: { language: string; branchId: string | null }) {
  const { toast } = useToast();
  const branchParam = branchId ? `&branch=${branchId}` : "";
  const branchParamFirst = branchId ? `?branch=${branchId}` : "";
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Fetch restaurant settings for reservation config
  const { data: restaurant } = useQuery<any>({
    queryKey: ["/api/restaurant"],
  });
  const [resDuration, setResDuration] = useState(90);
  const [resDepositAmount, setResDepositAmount] = useState("20.00");
  const [resDepositRequired, setResDepositRequired] = useState(true);

  // Sync from restaurant data
  useEffect(() => {
    if (restaurant) {
      setResDuration(restaurant.reservationDuration ?? 90);
      setResDepositAmount(restaurant.reservationDepositAmount ?? "20.00");
      setResDepositRequired(restaurant.reservationDepositRequired ?? true);
    }
  }, [restaurant]);

  // Save reservation settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("PUT", "/api/restaurant", {
        reservationDuration: resDuration,
        reservationDepositAmount: resDepositAmount,
        reservationDepositRequired: resDepositRequired,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant"] });
      toast({
        title: language === "ar" ? "تم الحفظ" : "Saved",
        description: language === "ar" ? "تم حفظ إعدادات الحجز" : "Reservation settings saved",
      });
      setSettingsOpen(false);
    },
  });
  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    partySize: 2,
    guestCount: 2,
    reservationDate: format(new Date(), "yyyy-MM-dd"),
    reservationTime: "19:00",
    duration: 90,
    tableId: "",
    notes: "",
    depositPaid: false,
  });

  const { data: reservations = [], isLoading } = useQuery<Reservation[]>({
    queryKey: ["/api/reservations", { date: format(selectedDate, "yyyy-MM-dd"), branch: branchId }],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/reservations?date=${format(selectedDate, "yyyy-MM-dd")}${branchParam}`);
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: tablesData = [] } = useQuery<TableData[]>({
    queryKey: [`/api/tables${branchParamFirst}`],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiRequest("POST", "/api/reservations", {
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail || undefined,
        guestCount: data.guestCount,
        reservationDate: `${data.reservationDate}T${data.reservationTime}`,
        reservationTime: data.reservationTime,
        duration: data.duration,
        tableId: data.tableId || undefined,
        notes: data.notes || undefined,
        depositPaid: data.depositPaid,
        source: "phone",
        branchId: branchId || null,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
      setIsAddDialogOpen(false);
      resetForm();
      toast({
        title: language === "ar" ? "تم الحفظ" : "Saved",
        description: language === "ar" ? "تم إنشاء الحجز بنجاح" : "Reservation created successfully",
      });
    },
    onError: (error: any) => {
      const msg = error?.message || "";
      if (msg.includes("409")) {
        toast({
          title: language === "ar" ? "تعارض في الحجز" : "Booking Conflict",
          description: language === "ar" ? "الطاولة محجوزة في هذا الوقت. اختر وقت أو طاولة أخرى." : "This table is already booked at this time. Choose a different time or table.",
          variant: "destructive",
        });
      } else {
        toast({
          title: language === "ar" ? "خطأ" : "Error",
          description: language === "ar" ? "فشل في إنشاء الحجز" : "Failed to create reservation",
          variant: "destructive",
        });
      }
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await apiRequest("PUT", `/api/reservations/${id}/status`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
      toast({
        title: language === "ar" ? "تم التحديث" : "Updated",
        description: language === "ar" ? "تم تحديث حالة الحجز" : "Reservation status updated",
      });
    },
  });

  const markDepositPaidMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("PUT", `/api/reservations/${id}/deposit`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
      toast({
        title: language === "ar" ? "تم التحديث" : "Updated",
        description: language === "ar" ? "تم تسجيل دفع رسوم الحجز" : "Booking fee marked as paid",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", `/api/reservations/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
      toast({
        title: language === "ar" ? "تم الحذف" : "Deleted",
        description: language === "ar" ? "تم حذف الحجز" : "Reservation deleted",
      });
    },
  });

  const resetForm = () => {
    setFormData({
      customerName: "",
      customerPhone: "",
      customerEmail: "",
      partySize: 2,
      guestCount: 2,
      reservationDate: format(new Date(), "yyyy-MM-dd"),
      reservationTime: "19:00",
      duration: 90,
      tableId: "",
      notes: "",
      depositPaid: false,
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      pending: { label: language === "ar" ? "قيد الانتظار" : "Pending", variant: "secondary" },
      confirmed: { label: language === "ar" ? "مؤكد" : "Confirmed", variant: "default" },
      seated: { label: language === "ar" ? "تم الجلوس" : "Seated", variant: "outline" },
      completed: { label: language === "ar" ? "مكتمل" : "Completed", variant: "outline" },
      cancelled: { label: language === "ar" ? "ملغي" : "Cancelled", variant: "destructive" },
      no_show: { label: language === "ar" ? "لم يحضر" : "No Show", variant: "destructive" },
    };
    const config = statusConfig[status] || statusConfig.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getDepositBadge = (reservation: Reservation) => {
    if (reservation.depositPaid) {
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border-0">
          <CheckCircle className="h-3 w-3 me-1" />
          {language === "ar" ? "مدفوع" : "Paid"}
        </Badge>
      );
    }
    return (
      <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border-0">
        <XCircle className="h-3 w-3 me-1" />
        {language === "ar" ? "غير مدفوع" : "Unpaid"}
      </Badge>
    );
  };

  const allTimeSlots = [
    "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
    "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00",
  ];

  const todayStr = new Date().toISOString().split("T")[0];
  const nowHour = new Date().getHours();
  const nowMinute = new Date().getMinutes();
  const isFormToday = formData.reservationDate === todayStr;
  const timeSlots = allTimeSlots.filter((slot) => {
    if (!isFormToday) return true;
    const [h, m] = slot.split(":").map(Number);
    return h > nowHour || (h === nowHour && m > nowMinute);
  });

  const todayReservations = reservations.filter(r => r.status !== "cancelled" && r.status !== "no_show");
  const confirmedCount = reservations.filter(r => r.status === "confirmed").length;
  const pendingCount = reservations.filter(r => r.status === "pending").length;

  return (
    <div className="flex flex-col gap-6">
      {/* Reservation Settings Card */}
      <Card>
        <CardHeader className="cursor-pointer pb-3" onClick={() => setSettingsOpen(!settingsOpen)}>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              {language === "ar" ? "إعدادات الحجز" : "Reservation Settings"}
            </CardTitle>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{language === "ar" ? `المدة: ${restaurant?.reservationDuration ?? 90} دقيقة` : `Duration: ${restaurant?.reservationDuration ?? 90} min`}</span>
              <span>·</span>
              <span>{language === "ar" ? `الرسوم: ${restaurant?.reservationDepositAmount ?? "20.00"} ر.س` : `Fee: ${restaurant?.reservationDepositAmount ?? "20.00"} SAR`}</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${settingsOpen ? "rotate-180" : ""}`} />
            </div>
          </div>
        </CardHeader>
        {settingsOpen && (
          <CardContent className="pt-0 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{language === "ar" ? "مدة الحجز (دقيقة)" : "Reservation Duration (min)"}</Label>
                <Input
                  type="number"
                  min={15}
                  max={480}
                  step={15}
                  value={resDuration}
                  onChange={(e) => setResDuration(parseInt(e.target.value) || 90)}
                />
              </div>
              <div className="space-y-2">
                <Label>{language === "ar" ? "رسوم الحجز (ر.س)" : "Booking Fee (SAR)"}</Label>
                <Input
                  type="number"
                  min={0}
                  step={5}
                  value={resDepositAmount}
                  onChange={(e) => setResDepositAmount(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 pt-7">
                <Switch checked={resDepositRequired} onCheckedChange={setResDepositRequired} />
                <Label>{language === "ar" ? "رسوم الحجز مطلوبة" : "Booking Fee Required"}</Label>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {language === "ar"
                ? "رسوم الحجز تُدفع عند الحجز وتُخصم من الفاتورة النهائية عند الحضور"
                : "Booking fee is paid at reservation and deducted from the final bill upon arrival"}
            </p>
            <Button
              size="sm"
              onClick={() => saveSettingsMutation.mutate()}
              disabled={saveSettingsMutation.isPending}
            >
              {saveSettingsMutation.isPending ? "..." : (language === "ar" ? "حفظ الإعدادات" : "Save Settings")}
            </Button>
          </CardContent>
        )}
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div />
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm} data-testid="button-add-reservation">
              <Plus className="h-4 w-4 me-2" />
              {language === "ar" ? "حجز جديد" : "New Reservation"}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {language === "ar" ? "حجز جديد" : "New Reservation"}
              </DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate(formData);
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === "ar" ? "اسم العميل" : "Customer Name"}</Label>
                  <Input
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    required
                    data-testid="input-reservation-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === "ar" ? "رقم الجوال" : "Phone"} *</Label>
                  <Input
                    value={formData.customerPhone}
                    onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                    required
                    data-testid="input-reservation-phone"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{language === "ar" ? "البريد الإلكتروني" : "Email"}</Label>
                <Input
                  type="email"
                  value={formData.customerEmail}
                  onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                  data-testid="input-reservation-email"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === "ar" ? "التاريخ" : "Date"}</Label>
                  <Input
                    type="date"
                    value={formData.reservationDate}
                    onChange={(e) => {
                      setFormData({ ...formData, reservationDate: e.target.value });
                      // Reset time if switching to today and selected time is past
                      if (e.target.value === todayStr && formData.reservationTime) {
                        const [h, m] = formData.reservationTime.split(":").map(Number);
                        if (h < nowHour || (h === nowHour && m <= nowMinute)) {
                          setFormData(prev => ({ ...prev, reservationDate: e.target.value, reservationTime: "" }));
                        }
                      }
                    }}
                    min={todayStr}
                    required
                    data-testid="input-reservation-date"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === "ar" ? "الوقت" : "Time"}</Label>
                  <Select
                    value={formData.reservationTime}
                    onValueChange={(value) => setFormData({ ...formData, reservationTime: value })}
                  >
                    <SelectTrigger data-testid="select-reservation-time">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.map((time) => (
                        <SelectItem key={time} value={time}>{time}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === "ar" ? "عدد الأشخاص" : "Party Size"}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.guestCount}
                    onChange={(e) => setFormData({ ...formData, guestCount: parseInt(e.target.value) || 1 })}
                    required
                    data-testid="input-reservation-party-size"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === "ar" ? "الطاولة" : "Table"}</Label>
                  <Select
                    value={formData.tableId}
                    onValueChange={(value) => setFormData({ ...formData, tableId: value })}
                  >
                    <SelectTrigger data-testid="select-reservation-table">
                      <SelectValue placeholder={language === "ar" ? "اختر طاولة" : "Select table"} />
                    </SelectTrigger>
                    <SelectContent>
                      {tablesData.map((table) => (
                        <SelectItem key={table.id} value={table.id}>
                          {table.tableNumber} ({table.capacity} {language === "ar" ? "أشخاص" : "seats"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{language === "ar" ? "ملاحظات" : "Notes"}</Label>
                <Input
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  data-testid="input-reservation-notes"
                />
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-amber-900 dark:text-amber-100">
                    {language === "ar" ? "رسوم الحجز" : "Booking Fee"}
                  </span>
                  <span className="text-lg font-bold text-amber-900 dark:text-amber-100">
                    20.00 {language === "ar" ? "ر.س" : "SAR"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="depositPaid"
                    checked={formData.depositPaid}
                    onCheckedChange={(checked) => setFormData({ ...formData, depositPaid: checked === true })}
                    data-testid="checkbox-deposit-paid"
                  />
                  <Label htmlFor="depositPaid" className="text-sm text-amber-800 dark:text-amber-200 cursor-pointer">
                    {language === "ar" ? "تم استلام رسوم الحجز من العميل" : "Booking fee collected from customer"}
                  </Label>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-save-reservation">
                {createMutation.isPending
                  ? (language === "ar" ? "جاري الحفظ..." : "Saving...")
                  : (language === "ar" ? "حفظ الحجز" : "Save Reservation")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "ar" ? "حجوزات اليوم" : "Today's Reservations"}
            </CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-reservations-today">{todayReservations.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "ar" ? "مؤكدة" : "Confirmed"}
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-reservations-confirmed">{confirmedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "ar" ? "قيد الانتظار" : "Pending"}
            </CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600" data-testid="text-reservations-pending">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "ar" ? "إجمالي الضيوف" : "Total Guests"}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-reservations-guests">
              {todayReservations.reduce((sum, r) => sum + (r.guestCount || 0), 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>{language === "ar" ? "التقويم" : "Calendar"}</CardTitle>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md border"
              data-testid="calendar-reservations"
            />
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>
              {language === "ar" ? "حجوزات" : "Reservations for"} {format(selectedDate, "yyyy-MM-dd")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                {language === "ar" ? "جاري التحميل..." : "Loading..."}
              </div>
            ) : reservations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CalendarDays className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
                {language === "ar" ? "لا توجد حجوزات لهذا اليوم" : "No reservations for this date"}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{language === "ar" ? "الوقت" : "Time"}</TableHead>
                      <TableHead>{language === "ar" ? "العميل" : "Customer"}</TableHead>
                      <TableHead>{language === "ar" ? "الأشخاص" : "Party"}</TableHead>
                      <TableHead>{language === "ar" ? "الطاولة" : "Table"}</TableHead>
                      <TableHead>{language === "ar" ? "رسوم الحجز" : "Fee"}</TableHead>
                      <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                      <TableHead>{language === "ar" ? "إجراءات" : "Actions"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reservations.map((reservation) => (
                      <TableRow key={reservation.id} data-testid={`reservation-row-${reservation.id}`}>
                        <TableCell className="font-mono">{reservation.reservationTime}</TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{reservation.customerName}</div>
                            <div className="text-sm text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {reservation.customerPhone}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3 text-muted-foreground" />
                            {reservation.guestCount}
                          </div>
                        </TableCell>
                        <TableCell>
                          {tablesData.find(t => t.id === reservation.tableId)?.tableNumber || "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {getDepositBadge(reservation)}
                            <span className="text-xs text-muted-foreground">
                              {reservation.depositAmount || "20.00"} {language === "ar" ? "ر.س" : "SAR"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(reservation.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {!reservation.depositPaid && reservation.status !== "cancelled" && reservation.status !== "no_show" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-amber-600 border-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950"
                                onClick={() => markDepositPaidMutation.mutate(reservation.id)}
                                data-testid={`button-deposit-paid-${reservation.id}`}
                              >
                                <CheckCircle className="h-3 w-3 me-1" />
                                {language === "ar" ? "رسوم" : "Fee"}
                              </Button>
                            )}
                            {reservation.status === "pending" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateStatusMutation.mutate({ id: reservation.id, status: "confirmed" })}
                                data-testid={`button-confirm-reservation-${reservation.id}`}
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                            {reservation.status === "confirmed" && (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => updateStatusMutation.mutate({ id: reservation.id, status: "seated" })}
                                data-testid={`button-seat-reservation-${reservation.id}`}
                              >
                                {language === "ar" ? "جلوس" : "Seat"}
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => updateStatusMutation.mutate({ id: reservation.id, status: "cancelled" })}
                              data-testid={`button-cancel-reservation-${reservation.id}`}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QueueTab({ language, branchId }: { language: string; branchId: string | null }) {
  const { toast } = useToast();
  const branchParam = branchId ? `?branch=${branchId}` : "";
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchPhone, setSearchPhone] = useState("");
  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    partySize: 2,
    notes: "",
  });

  const { data: queueEntries = [], isLoading } = useQuery<QueueEntry[]>({
    queryKey: [`/api/queue${branchParam}`],
  });

  const { data: stats } = useQuery<QueueStats>({
    queryKey: [`/api/queue/stats${branchParam}`],
  });

  // Fetch restaurant info for WhatsApp message
  const { data: restaurant } = useQuery<any>({
    queryKey: ["/api/restaurant"],
  });

  const addToQueueMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          restaurantId: "default",
        }),
      });
      if (!response.ok) throw new Error("Failed to add to queue");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/queue") });
      setIsAddDialogOpen(false);
      setFormData({ customerName: "", customerPhone: "", partySize: 2, notes: "" });
      toast({
        title: language === "ar" ? "تمت الإضافة" : "Added",
        description: language === "ar" ? "تمت إضافة العميل للطابور" : "Customer added to queue",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const response = await fetch(`/api/queue/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error("Failed to update status");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/queue") });
    },
  });

  // WhatsApp notify - opens directly on click
  const handleNotify = (entry: QueueEntry) => {
    const phone = entry.customerPhone.replace(/\D/g, "");
    const intlPhone = phone.startsWith("0") ? "966" + phone.slice(1) : "966" + phone;
    const rNameAr = restaurant?.nameAr || "المطعم";
    const rNameEn = restaurant?.nameEn || "Restaurant";
    const rPhone = restaurant?.phone || "";
    const rAddress = restaurant?.address || "";
    const lines = [
      `مرحباً ${entry.customerName} 👋`,
      ``,
      `دورك جاء! رقمك في الطابور: *#${entry.queueNumber}*`,
      `يرجى التوجه للمطعم الآن 🏃`,
      ``,
      `─────────────`,
      ``,
      `Hello ${entry.customerName} 👋`,
      ``,
      `It's your turn! Queue number: *#${entry.queueNumber}*`,
      `Please come to the restaurant now 🏃`,
      ``,
      `─────────────`,
      `🍽️ *${rNameAr}* | *${rNameEn}*`,
    ];
    if (rPhone) lines.push(`📞 ${rPhone}`);
    if (rAddress) lines.push(`📍 ${rAddress}`);
    const msg = lines.join("\n");
    window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`, "_blank");
    // Update status in background
    fetch(`/api/queue/${entry.id}/notify`, { method: "POST" })
      .then(() => queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/queue") }))
      .catch(() => {});
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      waiting: { label: language === "ar" ? "في الانتظار" : "Waiting", variant: "secondary" },
      notified: { label: language === "ar" ? "تم الإشعار" : "Notified", variant: "default" },
      seated: { label: language === "ar" ? "تم الجلوس" : "Seated", variant: "outline" },
      cancelled: { label: language === "ar" ? "ملغي" : "Cancelled", variant: "destructive" },
      no_show: { label: language === "ar" ? "لم يحضر" : "No Show", variant: "destructive" },
    };
    const config = statusConfig[status] || statusConfig.waiting;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getWaitingMinutes = (createdAt: Date) => {
    const now = new Date();
    const created = new Date(createdAt);
    return Math.max(0, Math.floor((now.getTime() - created.getTime()) / 60000));
  };

  const waitingEntries = queueEntries.filter((e) => e.status === "waiting" || e.status === "notified");
  const completedEntries = queueEntries.filter((e) => e.status === "seated" || e.status === "cancelled" || e.status === "no_show");

  const filteredWaitingEntries = waitingEntries.filter(
    (e) => !searchPhone || e.customerPhone.includes(searchPhone) || e.customerName.toLowerCase().includes(searchPhone.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div />
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-queue">
              <UserPlus className="h-4 w-4 me-2" />
              {language === "ar" ? "إضافة للطابور" : "Add to Queue"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {language === "ar" ? "إضافة عميل جديد" : "Add New Customer"}
              </DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addToQueueMutation.mutate(formData);
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>{language === "ar" ? "اسم العميل" : "Customer Name"}</Label>
                <Input
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  required
                  data-testid="input-queue-name"
                />
              </div>
              <div className="space-y-2">
                <Label>{language === "ar" ? "رقم الجوال" : "Phone Number"}</Label>
                <Input
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                  required
                  data-testid="input-queue-phone"
                />
              </div>
              <div className="space-y-2">
                <Label>{language === "ar" ? "عدد الأشخاص" : "Party Size"}</Label>
                <Input
                  type="number"
                  min={1}
                  value={formData.partySize}
                  onChange={(e) => setFormData({ ...formData, partySize: parseInt(e.target.value) })}
                  required
                  data-testid="input-queue-party-size"
                />
              </div>
              <div className="space-y-2">
                <Label>{language === "ar" ? "ملاحظات" : "Notes"}</Label>
                <Input
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  data-testid="input-queue-notes"
                />
              </div>
              <Button type="submit" className="w-full" disabled={addToQueueMutation.isPending} data-testid="button-save-queue">
                {addToQueueMutation.isPending
                  ? (language === "ar" ? "جاري الإضافة..." : "Adding...")
                  : (language === "ar" ? "إضافة" : "Add")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "ar" ? "في الانتظار" : "Waiting"}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-queue-waiting">{stats?.totalWaiting || waitingEntries.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "ar" ? "متوسط الانتظار" : "Avg Wait Time"}
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-queue-avg-wait">
              {stats?.averageWaitTime || 0} {language === "ar" ? "دقيقة" : "min"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-1 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "ar" ? "الرقم التالي" : "Next Number"}
            </CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-queue-next">#{stats?.nextQueueNumber || 1}</div>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <div className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-sm">
          <Phone className="h-5 w-5 text-muted-foreground shrink-0" />
          <Input
            placeholder={language === "ar" ? "البحث بالاسم أو رقم الجوال..." : "Search by name or phone..."}
            value={searchPhone}
            onChange={(e) => setSearchPhone(e.target.value)}
            className="border-0 shadow-none focus-visible:ring-0 text-base"
            data-testid="input-queue-search"
          />
          {searchPhone && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchPhone("")}
              className="shrink-0"
            >
              <XCircle className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : filteredWaitingEntries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted mb-4">
              <ListOrdered className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <p className="text-lg font-medium text-muted-foreground mb-1">
              {language === "ar" ? "لا يوجد عملاء في الانتظار" : "No customers waiting"}
            </p>
            <p className="text-sm text-muted-foreground/70 mb-4">
              {language === "ar"
                ? "أضف عملاء جدد لقائمة الانتظار"
                : "Add new customers to the waiting list"}
            </p>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(true)}>
              <UserPlus className="h-4 w-4 me-2" />
              {language === "ar" ? "إضافة للطابور" : "Add to Queue"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredWaitingEntries.map((entry, index) => {
            const waitMinutes = getWaitingMinutes(entry.createdAt);
            const estimatedWait = (index + 1) * 10;
            const waitProgress = Math.min(100, (waitMinutes / Math.max(estimatedWait, 1)) * 100);

            return (
              <Card
                key={entry.id}
                className="overflow-hidden transition-all hover:shadow-md"
                data-testid={`queue-entry-${entry.id}`}
              >
                <CardContent className="p-0">
                  <div className="flex items-start gap-4 p-4 pb-3">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-xl shadow-sm">
                      #{entry.queueNumber}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h4 className="font-semibold text-base truncate">{entry.customerName}</h4>
                        {getStatusBadge(entry.status)}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
                        <Phone className="h-3 w-3 shrink-0" />
                        <span className="truncate">{entry.customerPhone}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {entry.partySize} {language === "ar" ? "أشخاص" : "people"}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          ~{estimatedWait} {language === "ar" ? "د" : "min"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="px-4 pb-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>
                        {language === "ar" ? "مدة الانتظار" : "Waiting"}: {waitMinutes} {language === "ar" ? "د" : "min"}
                      </span>
                      <span>
                        {language === "ar" ? "المتوقع" : "Est"}: {estimatedWait} {language === "ar" ? "د" : "min"}
                      </span>
                    </div>
                    <Progress
                      value={waitProgress}
                      className={`h-2 ${waitProgress >= 100 ? "[&>div]:bg-red-500" : waitProgress >= 70 ? "[&>div]:bg-amber-500" : ""}`}
                    />
                  </div>

                  <div className="flex items-center gap-2 border-t p-3 bg-muted/30">
                    {(entry.status === "waiting" || entry.status === "notified") && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        style={{ backgroundColor: '#16a34a', borderColor: '#16a34a', color: '#fff' }}
                        onClick={() => handleNotify(entry)}
                        data-testid={`button-notify-${entry.id}`}
                      >
                        <MessageCircle className="h-4 w-4 me-1" />
                        {language === "ar" ? "نادِه" : "Notify"}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="default"
                      className="flex-1"
                      onClick={() => updateStatusMutation.mutate({ id: entry.id, status: "seated" })}
                      data-testid={`button-seat-queue-${entry.id}`}
                    >
                      <CheckCircle className="h-4 w-4 me-1" />
                      {language === "ar" ? "جلوس" : "Seat"}
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => updateStatusMutation.mutate({ id: entry.id, status: "cancelled" })}
                      data-testid={`button-cancel-queue-${entry.id}`}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {completedEntries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{language === "ar" ? "المكتملة اليوم" : "Completed Today"}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {completedEntries.slice(0, 10).map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 border rounded-md opacity-60"
                  data-testid={`queue-completed-${entry.id}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono">#{entry.queueNumber}</span>
                    <span>{entry.customerName}</span>
                  </div>
                  {getStatusBadge(entry.status)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function TablesPage() {
  const { t, language } = useLanguage();
  const { selectedBranchId } = useBranch();
  const [activeTab, setActiveTab] = useState("tables");

  const branchParam = selectedBranchId ? `?branch=${selectedBranchId}` : "";

  const { data: tables, isLoading: tablesLoading } = useQuery<TableType[]>({
    queryKey: [`/api/tables${branchParam}`],
    refetchInterval: 10000,
    staleTime: 5000,
  });

  const tableStats = {
    total: tables?.length || 0,
    available: tables?.filter((t) => t.status === "available").length || 0,
    occupied: tables?.filter((t) => t.status === "occupied").length || 0,
    reserved: tables?.filter((t) => t.status === "reserved").length || 0,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
            {language === "ar" ? "إدارة الطاولات" : "Table Management"}
          </h2>
          <p className="text-muted-foreground" data-testid="text-page-subtitle">
            {tableStats.available}/{tableStats.total} {t("available")} &middot;{" "}
            {tableStats.occupied} {t("occupied")} &middot;{" "}
            {tableStats.reserved} {t("reserved")}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="tables" className="flex items-center gap-2" data-testid="tab-tables">
            <LayoutGrid className="h-4 w-4" />
            {language === "ar" ? "الطاولات" : "Tables"}
          </TabsTrigger>
          <TabsTrigger value="reservations" className="flex items-center gap-2" data-testid="tab-reservations">
            <BookOpen className="h-4 w-4" />
            {language === "ar" ? "الحجوزات" : "Reservations"}
          </TabsTrigger>
          <TabsTrigger value="queue" className="flex items-center gap-2" data-testid="tab-queue">
            <ListOrdered className="h-4 w-4" />
            {language === "ar" ? "الطابور" : "Queue"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tables" className="mt-6">
          <TablesTab
            tables={tables}
            isLoading={tablesLoading}
            branchId={selectedBranchId}
            language={language}
          />
        </TabsContent>

        <TabsContent value="reservations" className="mt-6">
          <ReservationsTab language={language} branchId={selectedBranchId} />
        </TabsContent>

        <TabsContent value="queue" className="mt-6">
          <QueueTab language={language} branchId={selectedBranchId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

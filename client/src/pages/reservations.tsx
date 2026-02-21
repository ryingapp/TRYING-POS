import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";
import { useBranch } from "@/lib/branch";
import { apiRequest } from "@/lib/queryClient";
import { CalendarDays, Clock, Users, Phone, Plus, CheckCircle, XCircle, Edit } from "lucide-react";
import { format } from "date-fns";

interface Reservation {
  id: string;
  restaurantId: string;
  branchId: string | null;
  reservationNumber: string | null;
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
  createdAt: string;
}

interface TableData {
  id: string;
  tableNumber: string;
  capacity: number;
  status: string;
}

export default function ReservationsPage() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedBranchId } = useBranch();
  const branchParam = selectedBranchId ? `&branch=${selectedBranchId}` : "";
  const branchParamFirst = selectedBranchId ? `?branch=${selectedBranchId}` : "";
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    guestCount: 2,
    reservationDate: format(new Date(), "yyyy-MM-dd"),
    reservationTime: "19:00",
    duration: 90,
    tableId: "",
    notes: "",
  });

  // Fetch reservations
  const { data: reservations = [], isLoading } = useQuery<Reservation[]>({
    queryKey: ["/api/reservations", { date: format(selectedDate, "yyyy-MM-dd"), branch: selectedBranchId }],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/reservations?date=${format(selectedDate, "yyyy-MM-dd")}${branchParam}`);
      return response.json();
    },
  });

  // Fetch tables
  const { data: tables = [] } = useQuery<TableData[]>({
    queryKey: [`/api/tables${branchParamFirst}`],
  });

  // Create reservation
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
        source: "phone",
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
          description: language === "ar" ? "الطاولة محجوزة في هذا الوقت. اختر وقت أو طاولة أخرى." : "This table is already booked at this time.",
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

  // Update reservation status
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

  // Delete reservation
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
      guestCount: 2,
      reservationDate: format(new Date(), "yyyy-MM-dd"),
      reservationTime: "19:00",
      duration: 90,
      tableId: "",
      notes: "",
    });
    setEditingReservation(null);
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

  const timeSlots = [
    "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
    "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00"
  ];

  const todayReservations = reservations.filter(r => r.status !== "cancelled" && r.status !== "no_show");
  const confirmedCount = reservations.filter(r => r.status === "confirmed").length;
  const pendingCount = reservations.filter(r => r.status === "pending").length;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {language === "ar" ? "الحجوزات" : "Reservations"}
          </h1>
          <p className="text-muted-foreground">
            {language === "ar" ? "إدارة حجوزات الطاولات" : "Manage table reservations"}
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
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
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === "ar" ? "رقم الجوال" : "Phone"}</Label>
                  <Input
                    value={formData.customerPhone}
                    onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{language === "ar" ? "البريد الإلكتروني" : "Email"}</Label>
                <Input
                  type="email"
                  value={formData.customerEmail}
                  onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{language === "ar" ? "التاريخ" : "Date"}</Label>
                  <Input
                    type="date"
                    value={formData.reservationDate}
                    onChange={(e) => setFormData({ ...formData, reservationDate: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === "ar" ? "الوقت" : "Time"}</Label>
                  <Select
                    value={formData.reservationTime}
                    onValueChange={(value) => setFormData({ ...formData, reservationTime: value })}
                  >
                    <SelectTrigger>
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
                  />
                </div>
                <div className="space-y-2">
                  <Label>{language === "ar" ? "الطاولة" : "Table"}</Label>
                  <Select
                    value={formData.tableId}
                    onValueChange={(value) => setFormData({ ...formData, tableId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={language === "ar" ? "اختر طاولة" : "Select table"} />
                    </SelectTrigger>
                    <SelectContent>
                      {tables.map((table) => (
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
                />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending
                  ? (language === "ar" ? "جاري الحفظ..." : "Saving...")
                  : (language === "ar" ? "حفظ الحجز" : "Save Reservation")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "ar" ? "حجوزات اليوم" : "Today's Reservations"}
            </CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayReservations.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "ar" ? "مؤكدة" : "Confirmed"}
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{confirmedCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "ar" ? "قيد الانتظار" : "Pending"}
            </CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "ar" ? "إجمالي الضيوف" : "Total Guests"}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {todayReservations.reduce((sum, r) => sum + (r.guestCount || 0), 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar */}
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
            />
          </CardContent>
        </Card>

        {/* Reservations Table */}
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
                {language === "ar" ? "لا توجد حجوزات لهذا اليوم" : "No reservations for this date"}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{language === "ar" ? "رقم الحجز" : "Res #"}</TableHead>
                    <TableHead>{language === "ar" ? "التاريخ والوقت" : "Date & Time"}</TableHead>
                    <TableHead>{language === "ar" ? "العميل" : "Customer"}</TableHead>
                    <TableHead>{language === "ar" ? "الأشخاص" : "Party"}</TableHead>
                    <TableHead>{language === "ar" ? "الطاولة" : "Table"}</TableHead>
                    <TableHead>{language === "ar" ? "العربون" : "Deposit"}</TableHead>
                    <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                    <TableHead>{language === "ar" ? "إجراءات" : "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reservations.map((reservation) => (
                    <TableRow key={reservation.id}>
                      <TableCell className="font-mono text-sm font-bold text-primary">
                        {reservation.reservationNumber || "-"}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {new Date(reservation.reservationDate).toLocaleDateString(
                              language === "ar" ? "ar-SA" : "en-US",
                              { year: "numeric", month: "short", day: "numeric" }
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground font-mono">{reservation.reservationTime}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{reservation.customerName}</div>
                          <div className="text-sm text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {reservation.customerPhone}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{reservation.guestCount}</TableCell>
                      <TableCell>
                        {tables.find(t => t.id === reservation.tableId)?.tableNumber || "-"}
                      </TableCell>
                      <TableCell>
                        {reservation.depositPaid ? (
                          <Badge variant="default" className="bg-green-600">
                            {language === "ar" ? "مدفوع" : "Paid"} ({parseFloat(reservation.depositAmount || "0").toFixed(0)} {language === "ar" ? "ريال" : "SAR"})
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            {language === "ar" ? "غير مدفوع" : "Unpaid"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(reservation.status)}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {reservation.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateStatusMutation.mutate({ id: reservation.id, status: "confirmed" })}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                          {reservation.status === "confirmed" && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => updateStatusMutation.mutate({ id: reservation.id, status: "seated" })}
                            >
                              {language === "ar" ? "جلوس" : "Seat"}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => updateStatusMutation.mutate({ id: reservation.id, status: "cancelled" })}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

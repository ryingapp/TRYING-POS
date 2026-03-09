import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";
import { useBranch } from "@/lib/branch";
import { PhoneInput } from "@/components/phone-input";
import { Users, Clock, Phone, UserPlus, CheckCircle, XCircle, Bell, MessageCircle, AlertCircle } from "lucide-react";

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

export default function QueuePage() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedBranchId } = useBranch();
  const branchParam = selectedBranchId ? `?branch=${selectedBranchId}` : "";
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [searchPhone, setSearchPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    partySize: 2,
    notes: "",
  });

  // Validate Saudi phone number
  const validatePhone = (phone: string): string => {
    const clean = phone.replace(/\D/g, "");
    if (!clean) return language === "ar" ? "رقم الجوال مطلوب" : "Phone number required";
    if (clean.length !== 10) return language === "ar" ? "يجب أن يكون الرقم 10 أرقام بالضبط" : "Must be exactly 10 digits";
    if (!clean.startsWith("05")) return language === "ar" ? "يجب أن يبدأ الرقم بـ 05" : "Must start with 05";
    return "";
  };

  // Handle phone input - reject letters
  const handlePhoneChange = (value: string) => {
    const onlyDigits = value.replace(/\D/g, "").slice(0, 10);
    setFormData({ ...formData, customerPhone: onlyDigits });
    if (onlyDigits.length > 0) {
      setPhoneError(validatePhone(onlyDigits));
    } else {
      setPhoneError("");
    }
  };

  // Fetch queue entries
  const { data: queueEntries = [], isLoading } = useQuery<QueueEntry[]>({
    queryKey: [`/api/queue${branchParam}`],
    refetchInterval: 10000,
    staleTime: 5000,
  });

  // Fetch queue stats
  const { data: stats } = useQuery<QueueStats>({
    queryKey: [`/api/queue/stats${branchParam}`],
    refetchInterval: 10000,
    staleTime: 5000,
  });

  // Add to queue mutation
  const addToQueueMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // Validate phone before submit
      const phoneErr = validatePhone(data.customerPhone);
      if (phoneErr) throw new Error(phoneErr);

      const response = await fetch("/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          restaurantId: "default",
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Failed to add to queue");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/queue") });
      setIsAddDialogOpen(false);
      setFormData({ customerName: "", customerPhone: "", partySize: 2, notes: "" });
      setPhoneError("");
      toast({
        title: language === "ar" ? "تمت الإضافة" : "Added",
        description: language === "ar" ? "تمت إضافة العميل للطابور" : "Customer added to queue",
      });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

  // Update status mutation
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

  // Notify customer via WhatsApp - open immediately on click
  const handleNotify = (entry: QueueEntry) => {
    // 1. Open WhatsApp immediately (must be direct user event)
    const phone = entry.customerPhone.replace(/\D/g, "");
    const intlPhone = phone.startsWith("0") ? "966" + phone.slice(1) : "966" + phone;
    const msg = language === "ar"
      ? `مرحباً ${entry.customerName}، دورك جاء! رقمك في الطابور: #${entry.queueNumber}. يرجى التوجه للمطعم الآن.`
      : `Hello ${entry.customerName}, it's your turn! Queue number: #${entry.queueNumber}. Please come to the restaurant now.`;
    window.open(`https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`, "_blank");
    // 2. Update status in background
    fetch(`/api/queue/${entry.id}/notify`, { method: "POST" })
      .then(() => queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/queue") }))
      .catch(() => {});
  };

  const notifyMutation = { isPending: false };

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

  const waitingEntries = queueEntries.filter((e) => e.status === "waiting" || e.status === "notified");
  const completedEntries = queueEntries.filter((e) => e.status === "seated" || e.status === "cancelled" || e.status === "no_show");

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">
            {language === "ar" ? "نظام الطابور" : "Queue Management"}
          </h1>
          <p className="text-muted-foreground">
            {language === "ar" ? "إدارة قائمة الانتظار" : "Manage waiting list"}
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
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
                const err = validatePhone(formData.customerPhone);
                if (err) { setPhoneError(err); return; }
                addToQueueMutation.mutate(formData);
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>{language === "ar" ? "اسم العميل" : "Customer Name"} *</Label>
                <Input
                  value={formData.customerName}
                  onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                  placeholder={language === "ar" ? "أدخل اسم العميل" : "Enter customer name"}
                  required
                />
              </div>

              {/* Phone with full validation */}
              <div className="space-y-1">
                <Label>{language === "ar" ? "رقم الجوال" : "Phone Number"} *</Label>
                <Input
                  dir="ltr"
                  inputMode="numeric"
                  value={formData.customerPhone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  placeholder="05xxxxxxxx"
                  maxLength={10}
                  className={phoneError ? "border-red-500 focus-visible:ring-red-500" : formData.customerPhone.length === 10 ? "border-green-500 focus-visible:ring-green-500" : ""}
                />
                {phoneError ? (
                  <p className="text-red-500 text-sm flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5" />
                    {phoneError}
                  </p>
                ) : formData.customerPhone.length === 10 ? (
                  <p className="text-green-600 text-sm">✓ {language === "ar" ? "رقم صحيح" : "Valid number"}</p>
                ) : formData.customerPhone.length > 0 ? (
                  <p className="text-muted-foreground text-sm">
                    {formData.customerPhone.length}/10 {language === "ar" ? "أرقام" : "digits"}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>{language === "ar" ? "عدد الأشخاص" : "Party Size"}</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={formData.partySize}
                  onChange={(e) => setFormData({ ...formData, partySize: parseInt(e.target.value) || 1 })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{language === "ar" ? "ملاحظات" : "Notes"}</Label>
                <Input
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder={language === "ar" ? "أي ملاحظات إضافية..." : "Any additional notes..."}
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={addToQueueMutation.isPending || !!phoneError || formData.customerPhone.length !== 10}
              >
                {addToQueueMutation.isPending
                  ? (language === "ar" ? "جاري الإضافة..." : "Adding...")
                  : (language === "ar" ? "إضافة للطابور" : "Add to Queue")}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "ar" ? "في الانتظار" : "Waiting"}
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalWaiting || waitingEntries.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "ar" ? "متوسط الانتظار" : "Avg Wait Time"}
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.averageWaitTime || 0} {language === "ar" ? "دقيقة" : "min"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "ar" ? "الرقم التالي" : "Next Number"}
            </CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">#{stats?.nextQueueNumber || 1}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search by Phone */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder={language === "ar" ? "البحث برقم الجوال..." : "Search by phone..."}
                value={searchPhone}
                onChange={(e) => setSearchPhone(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Waiting Queue */}
      <Card>
        <CardHeader>
          <CardTitle>{language === "ar" ? "قائمة الانتظار" : "Waiting List"}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              {language === "ar" ? "جاري التحميل..." : "Loading..."}
            </div>
          ) : waitingEntries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {language === "ar" ? "لا يوجد عملاء في الانتظار" : "No customers waiting"}
            </div>
          ) : (
            <div className="space-y-3">
              {waitingEntries
                .filter((e) => !searchPhone || e.customerPhone.includes(searchPhone))
                .map((entry) => (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${
                      entry.status === "notified"
                        ? "border-green-400 bg-green-50 dark:bg-green-900/20"
                        : "border-border"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-full font-bold text-lg ${
                        entry.status === "notified"
                          ? "bg-green-600 text-white"
                          : "bg-primary text-primary-foreground"
                      }`}>
                        #{entry.queueNumber}
                      </div>
                      <div>
                        <div className="font-semibold">{entry.customerName}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1.5 font-mono" dir="ltr">
                          <Phone className="h-3 w-3" />
                          {entry.customerPhone}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-sm text-muted-foreground">
                            <Users className="h-3 w-3 inline mr-1" />
                            {entry.partySize} {language === "ar" ? "أشخاص" : "pax"}
                          </span>
                          {entry.estimatedWaitMinutes && entry.status === "waiting" && (
                            <span className="text-xs text-muted-foreground">
                              <Clock className="h-3 w-3 inline mr-0.5" />
                              ~{entry.estimatedWaitMinutes} {language === "ar" ? "د" : "min"}
                            </span>
                          )}
                        </div>
                        {entry.notes && (
                          <div className="text-xs text-amber-600 mt-0.5">📝 {entry.notes}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {getStatusBadge(entry.status)}

                      {/* WhatsApp Notify Button - appears for waiting customers */}
                      {(entry.status === "waiting" || entry.status === "notified") && (
                        <Button
                          size="sm"
                          variant="outline"
                          style={{ backgroundColor: '#16a34a', borderColor: '#16a34a', color: '#ffffff' }}
                          onClick={() => handleNotify(entry)}
                          disabled={false}
                          title={language === "ar" ? "إشعار العميل عبر واتساب" : "Notify via WhatsApp"}
                        >
                          <MessageCircle className="h-4 w-4" />
                          <span className="text-xs ms-1">
                            {language === "ar" ? "نادِه" : "Notify"}
                          </span>
                        </Button>
                      )}

                      {/* Seat button */}
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => updateStatusMutation.mutate({ id: entry.id, status: "seated" })}
                        title={language === "ar" ? "تم الجلوس" : "Mark Seated"}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>

                      {/* Cancel button */}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => updateStatusMutation.mutate({ id: entry.id, status: "cancelled" })}
                        title={language === "ar" ? "إلغاء" : "Cancel"}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Completed Today */}
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
                  className="flex items-center justify-between p-3 border rounded-lg opacity-60"
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

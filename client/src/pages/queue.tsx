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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";
import { useBranch } from "@/lib/branch";
import { Users, Clock, Phone, UserPlus, CheckCircle, XCircle, Bell } from "lucide-react";

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
  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    partySize: 2,
    notes: "",
  });

  // Fetch queue entries
  const { data: queueEntries = [], isLoading } = useQuery<QueueEntry[]>({
    queryKey: [`/api/queue${branchParam}`],
  });

  // Fetch queue stats
  const { data: stats } = useQuery<QueueStats>({
    queryKey: [`/api/queue/stats${branchParam}`],
  });

  // Add to queue mutation
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
      queryClient.invalidateQueries({ queryKey: ["/api/queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/queue/stats"] });
      setIsAddDialogOpen(false);
      setFormData({ customerName: "", customerPhone: "", partySize: 2, notes: "" });
      toast({
        title: language === "ar" ? "تمت الإضافة" : "Added",
        description: language === "ar" ? "تمت إضافة العميل للطابور" : "Customer added to queue",
      });
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
      queryClient.invalidateQueries({ queryKey: ["/api/queue"] });
      queryClient.invalidateQueries({ queryKey: ["/api/queue/stats"] });
    },
  });

  // Notify customer mutation
  const notifyMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/queue/${id}/notify`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to notify");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/queue"] });
      toast({
        title: language === "ar" ? "تم الإشعار" : "Notified",
        description: language === "ar" ? "تم إشعار العميل" : "Customer notified",
      });
    },
  });

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
                />
              </div>
              <div className="space-y-2">
                <Label>{language === "ar" ? "رقم الجوال" : "Phone Number"}</Label>
                <Input
                  value={formData.customerPhone}
                  onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                  required
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
                />
              </div>
              <div className="space-y-2">
                <Label>{language === "ar" ? "ملاحظات" : "Notes"}</Label>
                <Input
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full" disabled={addToQueueMutation.isPending}>
                {addToQueueMutation.isPending
                  ? (language === "ar" ? "جاري الإضافة..." : "Adding...")
                  : (language === "ar" ? "إضافة" : "Add")}
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
            <div className="space-y-4">
              {waitingEntries
                .filter((e) => !searchPhone || e.customerPhone.includes(searchPhone))
                .map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-lg">
                        #{entry.queueNumber}
                      </div>
                      <div>
                        <div className="font-semibold">{entry.customerName}</div>
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                          <Phone className="h-3 w-3" />
                          {entry.customerPhone}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {entry.partySize} {language === "ar" ? "أشخاص" : "people"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(entry.status)}
                      {entry.status === "waiting" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => notifyMutation.mutate(entry.id)}
                        >
                          <Bell className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => updateStatusMutation.mutate({ id: entry.id, status: "seated" })}
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => updateStatusMutation.mutate({ id: entry.id, status: "cancelled" })}
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

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Calendar, Clock, DollarSign, TrendingUp, TrendingDown, 
  ArrowUpCircle, ArrowDownCircle, Settings, Play, Square,
  Wallet, CreditCard, Receipt, AlertTriangle, CheckCircle, Plus, History,
  Truck, Store, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";
import { useBranch } from "@/lib/branch";
import { apiRequest } from "@/lib/queryClient";
import type { DaySession, CashTransaction, Order } from "@shared/schema";

export default function DaySessionPage() {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedBranchId } = useBranch();
  
  const branchParam = selectedBranchId ? `?branch=${selectedBranchId}` : "";
  
  const [openDialogOpen, setOpenDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [openingBalance, setOpeningBalance] = useState("");
  const [closingBalance, setClosingBalance] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [transactionType, setTransactionType] = useState<"deposit" | "withdrawal">("deposit");
  const [transactionAmount, setTransactionAmount] = useState("");
  const [transactionReason, setTransactionReason] = useState("");
  const [platformToggles, setPlatformToggles] = useState<Record<string, boolean>>({});
  const [togglingPlatform, setTogglingPlatform] = useState<string | null>(null);

  // Get current session
  const { data: currentSession, isLoading: sessionLoading } = useQuery<DaySession | null>({
    queryKey: [`/api/day-sessions/current${branchParam}`],
  });

  // Get session history
  const { data: sessionHistory, isLoading: historyLoading } = useQuery<DaySession[]>({
    queryKey: [`/api/day-sessions${branchParam}`],
  });

  // Get transactions for current session
  const { data: transactions } = useQuery<CashTransaction[]>({
    queryKey: ["/api/day-sessions", currentSession?.id, "transactions"],
    enabled: !!currentSession?.id,
    queryFn: () => fetch(`/api/day-sessions/${currentSession?.id}/transactions`).then(r => r.json()),
  });

  // Get today's orders for summary
  const { data: orders } = useQuery<Order[]>({
    queryKey: [`/api/orders${branchParam}`],
  });

  // Get delivery integrations
  const branchIntParam = selectedBranchId ? `?branchId=${selectedBranchId}` : "";
  const { data: deliveryIntegrations } = useQuery<any[]>({
    queryKey: [`/api/delivery/integrations${branchIntParam}`],
  });

  // Get delivery orders for today
  const { data: deliveryOrders } = useQuery<any[]>({
    queryKey: [`/api/delivery/orders${branchIntParam}`],
  });

  const todayDeliveryOrders = deliveryOrders?.filter(o => {
    const orderDate = new Date(o.createdAt!).toDateString();
    const today = new Date().toDateString();
    return orderDate === today;
  }) || [];

  // Compute delivery stats by platform
  const deliveryStats = (() => {
    const stats: Record<string, { count: number; total: number; accepted: number; cancelled: number }> = {};
    todayDeliveryOrders.forEach(o => {
      const platform = o.platform || 'unknown';
      if (!stats[platform]) stats[platform] = { count: 0, total: 0, accepted: 0, cancelled: 0 };
      stats[platform].count++;
      stats[platform].total += parseFloat(o.total || "0");
      if (o.platformStatus === 'accepted' || o.platformStatus === 'preparing' || o.platformStatus === 'ready' || o.platformStatus === 'picked_up' || o.platformStatus === 'delivered') {
        stats[platform].accepted++;
      }
      if (o.platformStatus === 'cancelled' || o.platformStatus === 'rejected') {
        stats[platform].cancelled++;
      }
    });
    return stats;
  })();

  const totalDeliveryCount = todayDeliveryOrders.length;
  const totalDeliveryAmount = todayDeliveryOrders.reduce((sum, o) => sum + parseFloat(o.total || "0"), 0);

  // Platform display names and colors
  const platformInfo: Record<string, { name: string; nameAr: string; color: string; bgColor: string; logo: string }> = {
    hungerstation: { name: 'HungerStation', nameAr: 'هنقرستيشن', color: '#FF5A00', bgColor: '#FF5A00', logo: '/platforms/hungerstation.png' },
    jahez: { name: 'Jahez', nameAr: 'جاهز', color: '#8BC34A', bgColor: '#8BC34A', logo: '/platforms/jahez.png' },
    keeta: { name: 'Keeta', nameAr: 'كيتا', color: '#FFD600', bgColor: '#FFD600', logo: '/platforms/keeta.png' },
    ninja: { name: 'Ninja', nameAr: 'نينجا', color: '#E91E63', bgColor: '#E91E63', logo: '/platforms/ninja.png' },
  };

  // Platform logo component - uses actual app icon with fallback to styled letter
  const PlatformLogo = ({ platform, size = 36 }: { platform: string; size?: number }) => {
    const info = platformInfo[platform];
    const radius = size > 24 ? 10 : 6;
    const [imgError, setImgError] = useState(false);
    if (!info) return <div style={{ width: size, height: size, borderRadius: radius, background: '#999', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: size * 0.45 }}>?</div>;
    
    if (imgError) {
      return (
        <div style={{
          width: size,
          height: size,
          borderRadius: radius,
          background: info.bgColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: 'bold',
          fontSize: size * 0.45,
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
          flexShrink: 0,
        }}>
          {info.name.charAt(0)}
        </div>
      );
    }
    
    return (
      <img
        src={info.logo}
        alt={info.name}
        onError={() => setImgError(true)}
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          objectFit: 'cover',
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
          flexShrink: 0,
        }}
      />
    );
  };

  // Toggle outlet status for a delivery platform
  const togglePlatformStatus = async (integrationId: string, platform: string, newStatus: string) => {
    setTogglingPlatform(integrationId);
    try {
      await apiRequest("PUT", `/api/delivery/integrations/${integrationId}/status`, { status: newStatus });
      queryClient.invalidateQueries({ queryKey: [`/api/delivery/integrations${branchIntParam}`] });
      toast({
        title: language === "ar" 
          ? `تم ${newStatus === 'open' ? 'فتح' : 'إغلاق'} ${platformInfo[platform]?.nameAr || platform}`
          : `${platformInfo[platform]?.name || platform} ${newStatus === 'open' ? 'opened' : 'closed'}`,
      });
    } catch (error: any) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: error?.message || "Failed",
        variant: "destructive",
      });
    }
    setTogglingPlatform(null);
  };

  const todayOrders = orders?.filter(o => {
    const orderDate = new Date(o.createdAt!).toDateString();
    const today = new Date().toDateString();
    return orderDate === today && o.status !== "cancelled";
  }) || [];

  const todaySales = todayOrders.reduce((sum, o) => sum + parseFloat(o.total || "0"), 0);
  const cashSales = todayOrders.filter(o => o.paymentMethod === "cash").reduce((sum, o) => sum + parseFloat(o.total || "0"), 0);
  const cardSales = todayOrders.filter(o => o.paymentMethod !== "cash").reduce((sum, o) => sum + parseFloat(o.total || "0"), 0);

  const openSessionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/day-sessions/open${branchParam}`, {
        openingBalance: openingBalance || "0",
        date: new Date().toISOString().split("T")[0],
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/day-sessions") });
      toast({ title: language === "ar" ? "تم بدء اليوم بنجاح" : "Day started successfully" });
      setOpenDialogOpen(false);
      setOpeningBalance("");
    },
    onError: (error: any) => {
      toast({ 
        title: language === "ar" ? "خطأ" : "Error", 
        description: error?.message || (language === "ar" ? "فشل في بدء اليوم" : "Failed to start day"),
        variant: "destructive" 
      });
    },
  });

  const closeSessionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/day-sessions/${currentSession?.id}/close`, {
        closingBalance,
        notes: closeNotes,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/day-sessions") });
      toast({ title: language === "ar" ? "تم إنهاء اليوم بنجاح" : "Day ended successfully" });
      setCloseDialogOpen(false);
      setClosingBalance("");
      setCloseNotes("");
    },
    onError: (error: any) => {
      toast({ 
        title: language === "ar" ? "خطأ" : "Error", 
        description: error?.message,
        variant: "destructive" 
      });
    },
  });

  const addTransactionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/day-sessions/${currentSession?.id}/transactions`, {
        type: transactionType,
        amount: transactionAmount,
        reason: transactionReason,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/day-sessions", currentSession?.id, "transactions"] });
      toast({ title: language === "ar" ? "تم إضافة العملية" : "Transaction added" });
      setTransactionDialogOpen(false);
      setTransactionAmount("");
      setTransactionReason("");
    },
    onError: (error: any) => {
      toast({ 
        title: language === "ar" ? "خطأ" : "Error", 
        description: error?.message,
        variant: "destructive" 
      });
    },
  });

  const formatCurrency = (amount: string | number | null | undefined) => {
    const num = parseFloat(String(amount || 0));
    return `${num.toFixed(2)} ${language === "ar" ? "ر.س" : "SAR"}`;
  };

  const formatTime = (date: Date | string | null | undefined) => {
    if (!date) return "-";
    return new Date(date).toLocaleTimeString(language === "ar" ? "ar-SA" : "en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString(language === "ar" ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const expectedBalance = parseFloat(currentSession?.openingBalance || "0") + cashSales;

  if (sessionLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">
              {language === "ar" ? "إدارة اليوم" : "Day Management"}
            </h1>
            <p className="text-muted-foreground">
              {new Date().toLocaleDateString(language === "ar" ? "ar-SA" : "en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </div>
        
        {!currentSession ? (
          <Button onClick={() => setOpenDialogOpen(true)} className="gap-2">
            <Play className="h-4 w-4" />
            {language === "ar" ? "بدأ اليوم" : "Start Day"}
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setTransactionDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              {language === "ar" ? "إضافة عملية" : "Add Transaction"}
            </Button>
            <Button variant="destructive" onClick={() => setCloseDialogOpen(true)} className="gap-2">
              <Square className="h-4 w-4" />
              {language === "ar" ? "إنهاء اليوم" : "End Day"}
            </Button>
          </div>
        )}
      </div>

      {/* Session Status */}
      {currentSession ? (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  {language === "ar" ? "الرصيد الافتتاحي" : "Opening Balance"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(currentSession.openingBalance)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {language === "ar" ? "فتح الساعة" : "Opened at"} {formatTime(currentSession.openedAt)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  {language === "ar" ? "مبيعات اليوم" : "Today's Sales"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(todaySales)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {todayOrders.length} {language === "ar" ? "طلب" : "orders"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  {language === "ar" ? "المبيعات النقدية" : "Cash Sales"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(cashSales)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {language === "ar" ? "البطاقات" : "Cards"}: {formatCurrency(cardSales)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  {language === "ar" ? "الرصيد المتوقع" : "Expected Balance"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {formatCurrency(expectedBalance)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {language === "ar" ? "افتتاحي + نقدي" : "Opening + Cash"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Delivery Platforms Status */}
          {deliveryIntegrations && deliveryIntegrations.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Truck className="h-5 w-5" />
                  {language === "ar" ? "تطبيقات التوصيل" : "Delivery Platforms"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {deliveryIntegrations.filter(i => i.isActive).map((integration) => {
                    const info = platformInfo[integration.platform] || { name: integration.platform, nameAr: integration.platform, color: '#666', bgColor: '#999', letter: '?' };
                    const isOpen = integration.outletStatus === 'open';
                    const platformDeliveryStats = deliveryStats[integration.platform];
                    return (
                      <div
                        key={integration.id}
                        className={`flex items-center justify-between p-3 rounded-lg border-2 transition-colors ${
                          isOpen ? 'border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-800' : 'border-gray-200 bg-gray-50 dark:bg-gray-900 dark:border-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <PlatformLogo platform={integration.platform} size={36} />
                          <div>
                            <div className="font-semibold text-sm">
                              {language === "ar" ? info.nameAr : info.name}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {isOpen 
                                ? (language === "ar" ? "مفتوح" : "Open")
                                : (language === "ar" ? "مغلق" : "Closed")
                              }
                              {platformDeliveryStats && (
                                <span className="mx-1">• {platformDeliveryStats.count} {language === "ar" ? "طلب" : "orders"}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {togglingPlatform === integration.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Switch
                              checked={isOpen}
                              onCheckedChange={(checked) => 
                                togglePlatformStatus(integration.id, integration.platform, checked ? 'open' : 'closed')
                              }
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Delivery Summary */}
                {totalDeliveryCount > 0 && (
                  <div className="mt-3 pt-3 border-t flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {language === "ar" ? "إجمالي طلبات التوصيل" : "Total Delivery Orders"}: <strong>{totalDeliveryCount}</strong>
                    </span>
                    <span className="font-semibold text-orange-600">
                      {formatCurrency(totalDeliveryAmount)}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Transactions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                {language === "ar" ? "عمليات الصندوق" : "Cash Transactions"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {transactions && transactions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{language === "ar" ? "النوع" : "Type"}</TableHead>
                      <TableHead>{language === "ar" ? "المبلغ" : "Amount"}</TableHead>
                      <TableHead>{language === "ar" ? "السبب" : "Reason"}</TableHead>
                      <TableHead>{language === "ar" ? "الوقت" : "Time"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell>
                          <Badge variant={tx.type === "deposit" ? "default" : "destructive"}>
                            {tx.type === "deposit" ? (
                              <><ArrowUpCircle className="h-3 w-3 mr-1" /> {language === "ar" ? "إيداع" : "Deposit"}</>
                            ) : (
                              <><ArrowDownCircle className="h-3 w-3 mr-1" /> {language === "ar" ? "سحب" : "Withdrawal"}</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell className={tx.type === "deposit" ? "text-green-600" : "text-red-600"}>
                          {tx.type === "deposit" ? "+" : "-"}{formatCurrency(tx.amount)}
                        </TableCell>
                        <TableCell>{tx.reason || "-"}</TableCell>
                        <TableCell>{formatTime(tx.createdAt)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {language === "ar" ? "لا توجد عمليات" : "No transactions"}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">
              {language === "ar" ? "لم يتم بدء اليوم بعد" : "Day Not Started Yet"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {language === "ar" 
                ? "ابدأ اليوم لبدء تسجيل المبيعات وإدارة الصندوق" 
                : "Start the day to begin recording sales and manage cash drawer"}
            </p>
            <Button onClick={() => setOpenDialogOpen(true)} className="gap-2">
              <Play className="h-4 w-4" />
              {language === "ar" ? "بدأ اليوم الآن" : "Start Day Now"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Session History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            {language === "ar" ? "سجل الأيام السابقة" : "Previous Days History"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <Skeleton className="h-32" />
          ) : sessionHistory && sessionHistory.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === "ar" ? "التاريخ" : "Date"}</TableHead>
                  <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                  <TableHead>{language === "ar" ? "الافتتاحي" : "Opening"}</TableHead>
                  <TableHead>{language === "ar" ? "الختامي" : "Closing"}</TableHead>
                  <TableHead>{language === "ar" ? "المتوقع" : "Expected"}</TableHead>
                  <TableHead>{language === "ar" ? "الفرق" : "Difference"}</TableHead>
                  <TableHead>{language === "ar" ? "الطلبات" : "Orders"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessionHistory.slice(0, 10).map((session) => {
                  const diff = parseFloat(session.difference || "0");
                  return (
                    <TableRow key={session.id}>
                      <TableCell>{session.date}</TableCell>
                      <TableCell>
                        <Badge variant={session.status === "open" ? "default" : "secondary"}>
                          {session.status === "open" 
                            ? (language === "ar" ? "مفتوح" : "Open")
                            : (language === "ar" ? "مغلق" : "Closed")}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatCurrency(session.openingBalance)}</TableCell>
                      <TableCell>{formatCurrency(session.closingBalance)}</TableCell>
                      <TableCell>{formatCurrency(session.expectedBalance)}</TableCell>
                      <TableCell>
                        {session.difference && (
                          <span className={diff === 0 ? "text-green-600" : diff > 0 ? "text-blue-600" : "text-red-600"}>
                            {diff > 0 ? "+" : ""}{formatCurrency(diff)}
                            {diff === 0 && <CheckCircle className="h-3 w-3 inline ml-1" />}
                            {diff !== 0 && <AlertTriangle className="h-3 w-3 inline ml-1" />}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{session.totalOrders || 0}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {language === "ar" ? "لا يوجد سجل سابق" : "No history yet"}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Open Day Dialog */}
      <Dialog open={openDialogOpen} onOpenChange={setOpenDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "بدأ اليوم" : "Start Day"}</DialogTitle>
            <DialogDescription>
              {language === "ar" 
                ? "أدخل الرصيد الافتتاحي للصندوق" 
                : "Enter the opening cash drawer balance"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{language === "ar" ? "الرصيد الافتتاحي" : "Opening Balance"}</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
              />
            </div>

            {/* Delivery Platforms */}
            {deliveryIntegrations && deliveryIntegrations.filter(i => i.isActive).length > 0 && (
              <div>
                <Label className="flex items-center gap-2 mb-3">
                  <Truck className="h-4 w-4" />
                  {language === "ar" ? "تطبيقات التوصيل" : "Delivery Platforms"}
                </Label>
                <div className="space-y-2">
                  {deliveryIntegrations.filter(i => i.isActive).map((integration) => {
                    const info = platformInfo[integration.platform] || { name: integration.platform, nameAr: integration.platform, color: '#666', bgColor: '#999', letter: '?' };
                    const isOpen = integration.outletStatus === 'open';
                    return (
                      <div
                        key={integration.id}
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          isOpen ? 'border-green-300 bg-green-50 dark:bg-green-950/30' : 'border-gray-200 bg-gray-50 dark:bg-gray-900'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <PlatformLogo platform={integration.platform} size={28} />
                          <span className="font-medium text-sm">{language === "ar" ? info.nameAr : info.name}</span>
                          <Badge variant={isOpen ? "default" : "secondary"} className="text-xs">
                            {isOpen ? (language === "ar" ? "مفتوح" : "Open") : (language === "ar" ? "مغلق" : "Closed")}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          {togglingPlatform === integration.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Switch
                              checked={isOpen}
                              onCheckedChange={(checked) => 
                                togglePlatformStatus(integration.id, integration.platform, checked ? 'open' : 'closed')
                              }
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {language === "ar" ? "فعّل التطبيقات لاستقبال طلبات التوصيل" : "Enable platforms to receive delivery orders"}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialogOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={() => openSessionMutation.mutate()} disabled={openSessionMutation.isPending}>
              {language === "ar" ? "بدأ اليوم" : "Start Day"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Day Dialog */}
      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "إنهاء اليوم" : "End Day"}</DialogTitle>
            <DialogDescription>
              {language === "ar" 
                ? "عد النقود في الصندوق وأدخل المبلغ الفعلي" 
                : "Count the cash in the drawer and enter the actual amount"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Cash Summary */}
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between">
                <span>{language === "ar" ? "الرصيد الافتتاحي" : "Opening Balance"}</span>
                <span>{formatCurrency(currentSession?.openingBalance)}</span>
              </div>
              <div className="flex justify-between">
                <span>{language === "ar" ? "المبيعات النقدية" : "Cash Sales"}</span>
                <span className="text-green-600">+{formatCurrency(cashSales)}</span>
              </div>
              <div className="flex justify-between font-bold border-t pt-2">
                <span>{language === "ar" ? "الرصيد المتوقع" : "Expected Balance"}</span>
                <span>{formatCurrency(expectedBalance)}</span>
              </div>
            </div>

            {/* Delivery Orders Breakdown */}
            {totalDeliveryCount > 0 && (
              <div className="p-4 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg space-y-2">
                <div className="flex items-center gap-2 font-semibold text-sm mb-2">
                  <Truck className="h-4 w-4 text-orange-600" />
                  {language === "ar" ? "طلبات التوصيل" : "Delivery Orders"}
                </div>
                {Object.entries(deliveryStats).map(([platform, stats]) => {
                  const info = platformInfo[platform] || { name: platform, nameAr: platform };
                  return (
                    <div key={platform} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <PlatformLogo platform={platform} size={20} />
                        <span>{language === "ar" ? info.nameAr : info.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {stats.count} {language === "ar" ? "طلب" : "orders"}
                        </Badge>
                        {stats.cancelled > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {stats.cancelled} {language === "ar" ? "ملغي" : "cancelled"}
                          </Badge>
                        )}
                      </div>
                      <span className="font-semibold">{formatCurrency(stats.total)}</span>
                    </div>
                  );
                })}
                <div className="flex justify-between font-bold border-t border-orange-300 dark:border-orange-700 pt-2 mt-1">
                  <span>{language === "ar" ? "إجمالي التوصيل" : "Total Delivery"}</span>
                  <span className="text-orange-600">{formatCurrency(totalDeliveryAmount)}</span>
                </div>
              </div>
            )}

            <div>
              <Label>{language === "ar" ? "الرصيد الفعلي" : "Actual Balance"}</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={closingBalance}
                onChange={(e) => setClosingBalance(e.target.value)}
              />
              {closingBalance && (
                <p className={`text-sm mt-1 ${
                  parseFloat(closingBalance) === expectedBalance ? "text-green-600" : "text-orange-600"
                }`}>
                  {language === "ar" ? "الفرق" : "Difference"}: {formatCurrency(parseFloat(closingBalance) - expectedBalance)}
                </p>
              )}
            </div>
            <div>
              <Label>{language === "ar" ? "ملاحظات" : "Notes"}</Label>
              <Textarea
                placeholder={language === "ar" ? "أي ملاحظات إضافية..." : "Any additional notes..."}
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDialogOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => closeSessionMutation.mutate()} 
              disabled={closeSessionMutation.isPending || !closingBalance}
            >
              {language === "ar" ? "إنهاء اليوم" : "End Day"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Transaction Dialog */}
      <Dialog open={transactionDialogOpen} onOpenChange={setTransactionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "إضافة عملية صندوق" : "Add Cash Transaction"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{language === "ar" ? "نوع العملية" : "Transaction Type"}</Label>
              <Select value={transactionType} onValueChange={(v: any) => setTransactionType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deposit">
                    <span className="flex items-center gap-2">
                      <ArrowUpCircle className="h-4 w-4 text-green-600" />
                      {language === "ar" ? "إيداع" : "Deposit"}
                    </span>
                  </SelectItem>
                  <SelectItem value="withdrawal">
                    <span className="flex items-center gap-2">
                      <ArrowDownCircle className="h-4 w-4 text-red-600" />
                      {language === "ar" ? "سحب" : "Withdrawal"}
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{language === "ar" ? "المبلغ" : "Amount"}</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={transactionAmount}
                onChange={(e) => setTransactionAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>{language === "ar" ? "السبب" : "Reason"}</Label>
              <Input
                placeholder={language === "ar" ? "سبب العملية..." : "Reason for transaction..."}
                value={transactionReason}
                onChange={(e) => setTransactionReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransactionDialogOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button 
              onClick={() => addTransactionMutation.mutate()} 
              disabled={addTransactionMutation.isPending || !transactionAmount}
            >
              {language === "ar" ? "إضافة" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

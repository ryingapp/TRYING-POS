import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  Building2,
  Users,
  ShoppingCart,
  DollarSign,
  Search,
  Eye,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Store,
  LogOut,
  ChevronDown,
  ChevronUp,
  Globe,
  Power,
  PowerOff,
  CreditCard,
  Clock,
  FileText,
  Shield,
  ShieldOff,
  Bell,
  Send,
  AlertTriangle,
  TrendingUp,
  UtensilsCrossed,
  Package,
  Receipt,
  CircleDollarSign,
  Wallet,
  Activity,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import logoImg from "@assets/logo.jpg";

interface RecentOrder {
  id: string;
  orderNumber: string;
  orderType: string;
  status: string;
  total: string;
  paymentMethod: string | null;
  isPaid: boolean;
  customerName: string | null;
  createdAt: string;
}

interface RestaurantDetail {
  id: string;
  nameEn: string;
  nameAr: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  kitchenType: string | null;
  logo: string | null;
  isActive: boolean | null;
  subscriptionStart: string | null;
  subscriptionEnd: string | null;
  subscriptionPlan: string | null;
  subscriptionNotes: string | null;
  createdAt: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  usersCount: number;
  branchesCount: number;
  ordersCount: number;
  totalRevenue: string;
  todayOrders: number;
  todayRevenue: string;
  avgOrderValue: string;
  menuItemsCount: number;
  recentOrders: RecentOrder[];
  ordersByStatus: Record<string, number>;
  ordersByType: Record<string, number>;
  branches: Array<{
    id: string;
    name: string;
    nameAr: string | null;
    address: string | null;
    phone: string | null;
    isActive: boolean;
  }>;
  users: Array<{
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
    role: string;
    isActive: boolean;
    lastLoginAt: string | null;
    createdAt: string;
  }>;
}

interface AdminStats {
  totalRestaurants: number;
  totalUsers: number;
  totalOrders: number;
  totalRevenue: string;
  totalMenuItems: number;
  activeRestaurants: number;
  inactiveRestaurants: number;
  todayOrders: number;
  todayRevenue: string;
  ordersByStatus: Record<string, number>;
  ordersByType: Record<string, number>;
  planCounts: Record<string, number>;
  roleCounts: Record<string, number>;
  revenueByRestaurant: Array<{ name: string; revenue: number; orders: number }>;
}

const roleLabels: Record<string, { en: string; ar: string }> = {
  owner: { en: "Owner", ar: "مالك" },
  branch_manager: { en: "Branch Manager", ar: "مدير فرع" },
  cashier: { en: "Cashier", ar: "كاشير" },
  kitchen: { en: "Kitchen", ar: "مطبخ" },
  accountant: { en: "Accountant", ar: "محاسب" },
};

const statusLabelsAr: Record<string, string> = {
  pending: "معلق",
  preparing: "قيد التحضير",
  ready: "جاهز",
  completed: "مكتمل",
  cancelled: "ملغي",
  delivered: "تم التوصيل",
};

const orderTypeLabelsAr: Record<string, string> = {
  dine_in: "محلي",
  pickup: "استلام",
  delivery: "توصيل",
  takeaway: "سفري",
};

const paymentMethodLabels: Record<string, { en: string; ar: string }> = {
  cash: { en: "Cash", ar: "نقدي" },
  card: { en: "Card", ar: "بطاقة" },
  mada: { en: "Mada", ar: "مدى" },
  apple_pay: { en: "Apple Pay", ar: "Apple Pay" },
  stc_pay: { en: "STC Pay", ar: "STC Pay" },
  tap_to_pay: { en: "Tap to Pay", ar: "تاب" },
  mobile_pay: { en: "Mobile Pay", ar: "دفع إلكتروني" },
};

const planOptions = [
  { value: "trial", labelEn: "Trial", labelAr: "تجريبي" },
  { value: "basic", labelEn: "Basic", labelAr: "أساسي" },
  { value: "pro", labelEn: "Pro", labelAr: "احترافي" },
  { value: "enterprise", labelEn: "Enterprise", labelAr: "مؤسسي" },
];

export default function PlatformAdminPage() {
  const { logout } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const isAr = language === "ar";
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [subscriptionDialog, setSubscriptionDialog] = useState<RestaurantDetail | null>(null);
  const [subStart, setSubStart] = useState("");
  const [subEnd, setSubEnd] = useState("");
  const [subPlan, setSubPlan] = useState("");
  const [subNotes, setSubNotes] = useState("");
  const [notifDialog, setNotifDialog] = useState(false);
  const [notifTitle, setNotifTitle] = useState("");
  const [notifTitleAr, setNotifTitleAr] = useState("");
  const [notifMessage, setNotifMessage] = useState("");
  const [notifMessageAr, setNotifMessageAr] = useState("");
  const [notifPriority, setNotifPriority] = useState("normal");
  const [notifTarget, setNotifTarget] = useState<"all" | "selected">("all");
  const [notifSelectedIds, setNotifSelectedIds] = useState<string[]>([]);

  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: restaurants = [], isLoading: restaurantsLoading } = useQuery<RestaurantDetail[]>({
    queryKey: ["/api/admin/restaurants"],
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (restaurantId: string) => {
      const res = await apiRequest("PATCH", `/api/admin/restaurant/${restaurantId}/toggle-active`);
      return res.json();
    },
    onSuccess: (_data, restaurantId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/restaurants"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      const r = restaurants.find(r => r.id === restaurantId);
      const wasActive = r?.isActive !== false;
      toast({
        title: wasActive
          ? (isAr ? "تم إيقاف المطعم" : "Restaurant Deactivated")
          : (isAr ? "تم تفعيل المطعم" : "Restaurant Activated"),
      });
    },
    onError: () => {
      toast({ title: isAr ? "حدث خطأ" : "Error occurred", variant: "destructive" });
    },
  });

  const updateSubscriptionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/admin/restaurant/${id}/subscription`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/restaurants"] });
      setSubscriptionDialog(null);
      toast({ title: isAr ? "تم تحديث الاشتراك" : "Subscription Updated" });
    },
    onError: () => {
      toast({ title: isAr ? "حدث خطأ" : "Error occurred", variant: "destructive" });
    },
  });

  const sendNotificationMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/admin/notifications/send", data);
      return res.json();
    },
    onSuccess: (data) => {
      setNotifDialog(false);
      setNotifTitle("");
      setNotifTitleAr("");
      setNotifMessage("");
      setNotifMessageAr("");
      setNotifPriority("normal");
      setNotifTarget("all");
      setNotifSelectedIds([]);
      toast({
        title: isAr
          ? `تم إرسال ${data.sent} إشعار بنجاح`
          : `${data.sent} notification(s) sent successfully`,
      });
    },
    onError: () => {
      toast({ title: isAr ? "فشل إرسال الإشعار" : "Failed to send notification", variant: "destructive" });
    },
  });

  const handleSendNotification = () => {
    if (!notifTitle.trim() || !notifMessage.trim()) {
      toast({ title: isAr ? "العنوان والرسالة مطلوبين" : "Title and message are required", variant: "destructive" });
      return;
    }
    sendNotificationMutation.mutate({
      title: notifTitle,
      titleAr: notifTitleAr || null,
      message: notifMessage,
      messageAr: notifMessageAr || null,
      priority: notifPriority,
      targetRestaurantIds: notifTarget === "selected" ? notifSelectedIds : [],
    });
  };

  const toggleRestaurantSelection = (id: string) => {
    setNotifSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const filtered = restaurants.filter(r => {
    const term = searchTerm.toLowerCase();
    return (
      r.nameEn.toLowerCase().includes(term) ||
      r.nameAr.includes(searchTerm) ||
      r.ownerName.toLowerCase().includes(term) ||
      r.ownerEmail.toLowerCase().includes(term)
    );
  });

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString(isAr ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateInput = (dateStr: string | null) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toISOString().split("T")[0];
  };

  const getSubscriptionStatus = (r: RestaurantDetail) => {
    if (r.isActive === false) return { label: isAr ? "موقوف" : "Suspended", variant: "destructive" as const };
    if (!r.subscriptionEnd) return { label: isAr ? "غير محدد" : "No Plan", variant: "secondary" as const };
    const end = new Date(r.subscriptionEnd);
    const now = new Date();
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysLeft < 0) return { label: isAr ? "منتهي" : "Expired", variant: "destructive" as const };
    if (daysLeft <= 7) return { label: isAr ? `${daysLeft} يوم` : `${daysLeft}d left`, variant: "outline" as const };
    return { label: isAr ? "نشط" : "Active", variant: "default" as const };
  };

  const getDaysRemaining = (endDate: string | null) => {
    if (!endDate) return null;
    const end = new Date(endDate);
    const now = new Date();
    return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  };

  const openSubscriptionDialog = (r: RestaurantDetail) => {
    setSubscriptionDialog(r);
    setSubStart(formatDateInput(r.subscriptionStart));
    setSubEnd(formatDateInput(r.subscriptionEnd));
    setSubPlan(r.subscriptionPlan || "");
    setSubNotes(r.subscriptionNotes || "");
  };

  const handleSaveSubscription = () => {
    if (!subscriptionDialog) return;
    updateSubscriptionMutation.mutate({
      id: subscriptionDialog.id,
      data: {
        subscriptionStart: subStart || null,
        subscriptionEnd: subEnd || null,
        subscriptionPlan: subPlan || null,
        subscriptionNotes: subNotes || null,
      },
    });
  };

  return (
    <div className="min-h-screen bg-background" dir={isAr ? "rtl" : "ltr"}>
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="TRYING" className="h-9 w-9 rounded-md object-contain" />
            <div>
              <h1 className="text-lg font-bold text-foreground">
                {isAr ? "لوحة إدارة المنصة" : "Platform Admin"}
              </h1>
              <p className="text-xs text-muted-foreground">
                {isAr ? "إدارة المطاعم والاشتراكات" : "Manage restaurants & subscriptions"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={() => setNotifDialog(true)}
              data-testid="button-open-notifications"
            >
              <Bell className="h-4 w-4 me-1" />
              {isAr ? "إرسال إشعار" : "Send Notification"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const newLang = language === "ar" ? "en" : "ar";
                localStorage.setItem("language", newLang);
                window.location.reload();
              }}
              data-testid="button-toggle-language"
            >
              <Globe className="h-4 w-4 me-1" />
              {isAr ? "EN" : "عربي"}
            </Button>
            <Button variant="outline" size="sm" onClick={logout} data-testid="button-admin-logout">
              <LogOut className="h-4 w-4 me-1" />
              {isAr ? "خروج" : "Logout"}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Stats Cards Row 1 - Key Metrics */}
        {statsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i}><CardContent className="p-4"><Skeleton className="h-4 w-20 mb-2" /><Skeleton className="h-8 w-16" /></CardContent></Card>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">{isAr ? "إجمالي المطاعم" : "Total Restaurants"}</p>
                      <p className="text-2xl font-bold" data-testid="text-total-restaurants">{stats?.totalRestaurants || 0}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-green-600">{stats?.activeRestaurants || 0} {isAr ? "نشط" : "active"}</span>
                        {(stats?.inactiveRestaurants || 0) > 0 && (
                          <span className="text-xs text-red-500">{stats?.inactiveRestaurants} {isAr ? "موقوف" : "suspended"}</span>
                        )}
                      </div>
                    </div>
                    <Building2 className="h-8 w-8 text-primary opacity-40" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">{isAr ? "إجمالي المستخدمين" : "Total Users"}</p>
                      <p className="text-2xl font-bold" data-testid="text-total-users">{stats?.totalUsers || 0}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {stats?.roleCounts && Object.entries(stats.roleCounts).slice(0, 3).map(([role, count]) => (
                          <span key={role} className="text-xs text-muted-foreground">
                            {count} {isAr ? (roleLabels[role]?.ar || role) : (roleLabels[role]?.en || role)}
                          </span>
                        ))}
                      </div>
                    </div>
                    <Users className="h-8 w-8 text-blue-500 opacity-40" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">{isAr ? "إجمالي الطلبات" : "Total Orders"}</p>
                      <p className="text-2xl font-bold" data-testid="text-total-orders">{stats?.totalOrders || 0}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        <span className="font-semibold text-foreground">{stats?.todayOrders || 0}</span> {isAr ? "اليوم" : "today"}
                      </p>
                    </div>
                    <ShoppingCart className="h-8 w-8 text-green-500 opacity-40" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">{isAr ? "إجمالي الإيرادات" : "Total Revenue"}</p>
                      <p className="text-2xl font-bold" data-testid="text-total-revenue">{stats?.totalRevenue || "0.00"} <span className="text-sm font-normal text-muted-foreground">{isAr ? "ريال" : "SAR"}</span></p>
                      <p className="text-xs text-muted-foreground mt-1">
                        <span className="font-semibold text-foreground">{stats?.todayRevenue || "0.00"}</span> {isAr ? "اليوم" : "today"}
                      </p>
                    </div>
                    <CircleDollarSign className="h-8 w-8 text-amber-500 opacity-40" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Stats Row 2 - Breakdowns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Orders by Status */}
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1">
                    <Activity className="h-3.5 w-3.5" /> {isAr ? "حالة الطلبات" : "Orders by Status"}
                  </p>
                  <div className="space-y-2">
                    {stats?.ordersByStatus && Object.entries(stats.ordersByStatus).map(([status, count]) => (
                      <div key={status} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${
                            status === "completed" ? "bg-green-500" :
                            status === "preparing" ? "bg-amber-500" :
                            status === "pending" ? "bg-blue-500" :
                            status === "ready" ? "bg-purple-500" :
                            status === "cancelled" ? "bg-red-500" : "bg-muted-foreground"
                          }`} />
                          <span className="text-sm capitalize">{isAr ? statusLabelsAr[status] || status : status}</span>
                        </div>
                        <span className="text-sm font-semibold">{count}</span>
                      </div>
                    ))}
                    {(!stats?.ordersByStatus || Object.keys(stats.ordersByStatus).length === 0) && (
                      <p className="text-sm text-muted-foreground text-center py-2">{isAr ? "لا توجد طلبات" : "No orders yet"}</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Orders by Type */}
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1">
                    <Receipt className="h-3.5 w-3.5" /> {isAr ? "أنواع الطلبات" : "Orders by Type"}
                  </p>
                  <div className="space-y-2">
                    {stats?.ordersByType && Object.entries(stats.ordersByType).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between gap-2">
                        <span className="text-sm">{isAr ? orderTypeLabelsAr[type] || type : type.replace(/_/g, " ")}</span>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    ))}
                    {(!stats?.ordersByType || Object.keys(stats.ordersByType).length === 0) && (
                      <p className="text-sm text-muted-foreground text-center py-2">{isAr ? "لا توجد طلبات" : "No orders yet"}</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Subscription Plans */}
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1">
                    <CreditCard className="h-3.5 w-3.5" /> {isAr ? "خطط الاشتراك" : "Subscription Plans"}
                  </p>
                  <div className="space-y-2">
                    {stats?.planCounts && Object.entries(stats.planCounts).map(([plan, count]) => (
                      <div key={plan} className="flex items-center justify-between gap-2">
                        <span className="text-sm">
                          {plan === "none"
                            ? (isAr ? "غير محدد" : "Not set")
                            : (planOptions.find(p => p.value === plan)?.[isAr ? "labelAr" : "labelEn"] || plan)}
                        </span>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Restaurants List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 flex-wrap">
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              {isAr ? "المطاعم المسجلة" : "Registered Restaurants"}
              <Badge variant="secondary">{filtered.length}</Badge>
            </CardTitle>
            <div className="relative w-full max-w-xs">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={isAr ? "بحث بالاسم أو الإيميل..." : "Search by name or email..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="ps-9"
                data-testid="input-search-restaurants"
              />
            </div>
          </CardHeader>
          <CardContent>
            {restaurantsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p>{isAr ? "لا توجد مطاعم مسجلة" : "No restaurants found"}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((restaurant) => {
                  const subStatus = getSubscriptionStatus(restaurant);
                  const daysLeft = getDaysRemaining(restaurant.subscriptionEnd);

                  return (
                    <div key={restaurant.id} className={`border rounded-md overflow-hidden ${restaurant.isActive === false ? "opacity-70 border-destructive/30" : ""}`}>
                      <div
                        className="flex items-center justify-between gap-4 p-4 cursor-pointer hover-elevate"
                        onClick={() => setExpandedId(expandedId === restaurant.id ? null : restaurant.id)}
                        data-testid={`card-restaurant-${restaurant.id}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center overflow-hidden shrink-0">
                            {restaurant.logo ? (
                              <img src={restaurant.logo} alt="" className="h-full w-full object-contain" />
                            ) : (
                              <Store className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold truncate">
                                {isAr ? restaurant.nameAr : restaurant.nameEn}
                              </p>
                              <Badge variant={subStatus.variant} className="text-xs">
                                {subStatus.label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" /> {restaurant.ownerEmail}
                              </span>
                              {restaurant.subscriptionPlan && (
                                <span className="flex items-center gap-1">
                                  <CreditCard className="h-3 w-3" />
                                  {planOptions.find(p => p.value === restaurant.subscriptionPlan)?.[isAr ? "labelAr" : "labelEn"] || restaurant.subscriptionPlan}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="hidden sm:flex items-center gap-2 flex-wrap">
                            <Badge variant="outline">
                              <ShoppingCart className="h-3 w-3 me-1" /> {restaurant.ordersCount}
                            </Badge>
                            <Badge variant="outline">
                              <CircleDollarSign className="h-3 w-3 me-1" /> {restaurant.totalRevenue} {isAr ? "ريال" : "SAR"}
                            </Badge>
                            <Badge variant="outline">
                              <Users className="h-3 w-3 me-1" /> {restaurant.usersCount}
                            </Badge>
                            <Badge variant="outline">
                              <UtensilsCrossed className="h-3 w-3 me-1" /> {restaurant.menuItemsCount}
                            </Badge>
                            {daysLeft !== null && (
                              <Badge variant={daysLeft < 0 ? "destructive" : daysLeft <= 7 ? "outline" : "secondary"}>
                                <Clock className="h-3 w-3 me-1" />
                                {daysLeft < 0
                                  ? (isAr ? `منتهي ${Math.abs(daysLeft)} يوم` : `Expired ${Math.abs(daysLeft)}d ago`)
                                  : (isAr ? `${daysLeft} يوم متبقي` : `${daysLeft}d left`)}
                              </Badge>
                            )}
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              openSubscriptionDialog(restaurant);
                            }}
                            data-testid={`button-subscription-${restaurant.id}`}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant={restaurant.isActive === false ? "default" : "ghost"}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleActiveMutation.mutate(restaurant.id);
                            }}
                            data-testid={`button-toggle-active-${restaurant.id}`}
                          >
                            {restaurant.isActive === false ? (
                              <Power className="h-4 w-4" />
                            ) : (
                              <PowerOff className="h-4 w-4" />
                            )}
                          </Button>
                          {expandedId === restaurant.id ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>

                      {expandedId === restaurant.id && (
                        <div className="border-t bg-muted/30 p-4 space-y-4">
                          {/* Quick Stats Row */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-3">
                            <div className="border rounded-md p-3 bg-background text-center">
                              <p className="text-lg font-bold">{restaurant.ordersCount}</p>
                              <p className="text-xs text-muted-foreground">{isAr ? "الطلبات" : "Orders"}</p>
                            </div>
                            <div className="border rounded-md p-3 bg-background text-center">
                              <p className="text-lg font-bold">{restaurant.totalRevenue}</p>
                              <p className="text-xs text-muted-foreground">{isAr ? "الإيرادات (ريال)" : "Revenue (SAR)"}</p>
                            </div>
                            <div className="border rounded-md p-3 bg-background text-center">
                              <p className="text-lg font-bold">{restaurant.todayOrders}</p>
                              <p className="text-xs text-muted-foreground">{isAr ? "طلبات اليوم" : "Today Orders"}</p>
                            </div>
                            <div className="border rounded-md p-3 bg-background text-center">
                              <p className="text-lg font-bold">{restaurant.todayRevenue}</p>
                              <p className="text-xs text-muted-foreground">{isAr ? "إيرادات اليوم" : "Today Revenue"}</p>
                            </div>
                            <div className="border rounded-md p-3 bg-background text-center">
                              <p className="text-lg font-bold">{restaurant.avgOrderValue}</p>
                              <p className="text-xs text-muted-foreground">{isAr ? "متوسط الطلب" : "Avg Order"}</p>
                            </div>
                            <div className="border rounded-md p-3 bg-background text-center">
                              <p className="text-lg font-bold">{restaurant.menuItemsCount}</p>
                              <p className="text-xs text-muted-foreground">{isAr ? "أصناف القائمة" : "Menu Items"}</p>
                            </div>
                          </div>

                          {/* Info Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">
                                {isAr ? "المالك" : "Owner"}
                              </p>
                              <p className="text-sm font-medium">{restaurant.ownerName}</p>
                              <p className="text-xs text-muted-foreground">{restaurant.ownerEmail}</p>
                              {restaurant.ownerPhone && restaurant.ownerPhone !== "-" && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Phone className="h-3 w-3" /> {restaurant.ownerPhone}
                                </p>
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">
                                {isAr ? "معلومات المطعم" : "Restaurant Info"}
                              </p>
                              <p className="text-sm">{isAr ? restaurant.nameAr : restaurant.nameEn}</p>
                              {restaurant.address && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <MapPin className="h-3 w-3" /> {restaurant.address}
                                </p>
                              )}
                              {restaurant.phone && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Phone className="h-3 w-3" /> {restaurant.phone}
                                </p>
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">
                                {isAr ? "الاشتراك" : "Subscription"}
                              </p>
                              <p className="text-sm font-medium">
                                {restaurant.subscriptionPlan
                                  ? (planOptions.find(p => p.value === restaurant.subscriptionPlan)?.[isAr ? "labelAr" : "labelEn"] || restaurant.subscriptionPlan)
                                  : (isAr ? "غير محدد" : "Not set")}
                              </p>
                              {restaurant.subscriptionStart && (
                                <p className="text-xs text-muted-foreground">
                                  {isAr ? "من" : "From"}: {formatDate(restaurant.subscriptionStart)}
                                </p>
                              )}
                              {restaurant.subscriptionEnd && (
                                <p className="text-xs text-muted-foreground">
                                  {isAr ? "إلى" : "To"}: {formatDate(restaurant.subscriptionEnd)}
                                </p>
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-1">
                                {isAr ? "تاريخ التسجيل" : "Registration"}
                              </p>
                              <p className="text-sm">{formatDate(restaurant.createdAt)}</p>
                              {restaurant.subscriptionNotes && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {restaurant.subscriptionNotes}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Order Status & Type Breakdown */}
                          {restaurant.ordersCount > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2">
                                  {isAr ? "حالة الطلبات" : "Orders by Status"}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {Object.entries(restaurant.ordersByStatus).map(([status, count]) => (
                                    <Badge key={status} variant="outline" className="gap-1">
                                      <div className={`h-2 w-2 rounded-full ${
                                        status === "completed" ? "bg-green-500" :
                                        status === "preparing" ? "bg-amber-500" :
                                        status === "pending" ? "bg-blue-500" :
                                        status === "ready" ? "bg-purple-500" :
                                        status === "cancelled" ? "bg-red-500" : "bg-muted-foreground"
                                      }`} />
                                      {isAr ? statusLabelsAr[status] || status : status} ({count})
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2">
                                  {isAr ? "أنواع الطلبات" : "Orders by Type"}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {Object.entries(restaurant.ordersByType).map(([type, count]) => (
                                    <Badge key={type} variant="secondary">
                                      {isAr ? orderTypeLabelsAr[type] || type : type.replace(/_/g, " ")} ({count})
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Recent Orders */}
                          {restaurant.recentOrders.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-2">
                                {isAr ? "آخر الطلبات" : "Recent Orders"} ({Math.min(restaurant.recentOrders.length, 10)})
                              </p>
                              <div className="overflow-x-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>{isAr ? "رقم الطلب" : "Order #"}</TableHead>
                                      <TableHead>{isAr ? "النوع" : "Type"}</TableHead>
                                      <TableHead>{isAr ? "الحالة" : "Status"}</TableHead>
                                      <TableHead>{isAr ? "المبلغ" : "Amount"}</TableHead>
                                      <TableHead>{isAr ? "الدفع" : "Payment"}</TableHead>
                                      <TableHead>{isAr ? "العميل" : "Customer"}</TableHead>
                                      <TableHead>{isAr ? "التاريخ" : "Date"}</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {restaurant.recentOrders.map(order => (
                                      <TableRow key={order.id}>
                                        <TableCell className="font-mono text-xs">{order.orderNumber}</TableCell>
                                        <TableCell>
                                          <Badge variant="outline" className="text-xs">
                                            {isAr ? orderTypeLabelsAr[order.orderType] || order.orderType : order.orderType.replace(/_/g, " ")}
                                          </Badge>
                                        </TableCell>
                                        <TableCell>
                                          <Badge variant={
                                            order.status === "completed" ? "default" :
                                            order.status === "cancelled" ? "destructive" : "secondary"
                                          } className="text-xs">
                                            {isAr ? statusLabelsAr[order.status] || order.status : order.status}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="font-semibold">{order.total} {isAr ? "ريال" : "SAR"}</TableCell>
                                        <TableCell>
                                          <div className="flex items-center gap-1">
                                            <span className="text-xs">
                                              {order.paymentMethod ? (isAr ? paymentMethodLabels[order.paymentMethod]?.ar || order.paymentMethod : paymentMethodLabels[order.paymentMethod]?.en || order.paymentMethod) : "-"}
                                            </span>
                                            {order.isPaid && (
                                              <Badge variant="default" className="text-xs">{isAr ? "مدفوع" : "Paid"}</Badge>
                                            )}
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{order.customerName || "-"}</TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          )}

                          {restaurant.branches.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-2">
                                {isAr ? "الفروع" : "Branches"} ({restaurant.branches.length})
                              </p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {restaurant.branches.map(branch => (
                                  <div key={branch.id} className="border rounded-md p-2 bg-background text-sm flex items-center justify-between gap-2">
                                    <div>
                                      <p className="font-medium">{isAr ? (branch.nameAr || branch.name) : branch.name}</p>
                                      {branch.address && <p className="text-xs text-muted-foreground">{branch.address}</p>}
                                    </div>
                                    <Badge variant={branch.isActive ? "default" : "secondary"}>
                                      {branch.isActive ? (isAr ? "نشط" : "Active") : (isAr ? "معطل" : "Inactive")}
                                    </Badge>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {restaurant.users.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground mb-2">
                                {isAr ? "المستخدمين" : "Users"} ({restaurant.users.length})
                              </p>
                              <div className="overflow-x-auto">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>{isAr ? "الاسم" : "Name"}</TableHead>
                                      <TableHead>{isAr ? "الإيميل" : "Email"}</TableHead>
                                      <TableHead>{isAr ? "الدور" : "Role"}</TableHead>
                                      <TableHead>{isAr ? "الحالة" : "Status"}</TableHead>
                                      <TableHead>{isAr ? "آخر دخول" : "Last Login"}</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {restaurant.users.map(user => (
                                      <TableRow key={user.id}>
                                        <TableCell className="font-medium">{user.name || "-"}</TableCell>
                                        <TableCell className="text-muted-foreground">{user.email}</TableCell>
                                        <TableCell>
                                          <Badge variant="outline">
                                            {isAr ? (roleLabels[user.role]?.ar || user.role) : (roleLabels[user.role]?.en || user.role)}
                                          </Badge>
                                        </TableCell>
                                        <TableCell>
                                          <Badge variant={user.isActive ? "default" : "secondary"}>
                                            {user.isActive ? (isAr ? "نشط" : "Active") : (isAr ? "معطل" : "Inactive")}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-xs">
                                          {formatDate(user.lastLoginAt)}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Subscription Management Dialog */}
      <Dialog open={!!subscriptionDialog} onOpenChange={(o) => !o && setSubscriptionDialog(null)}>
        <DialogContent className="max-w-md">
          {subscriptionDialog && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  {isAr ? "إدارة الاشتراك" : "Manage Subscription"}
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  {isAr ? subscriptionDialog.nameAr : subscriptionDialog.nameEn}
                </p>
              </DialogHeader>

              <div className="space-y-4 mt-2">
                <div>
                  <Label>{isAr ? "نوع الاشتراك" : "Subscription Plan"}</Label>
                  <Select value={subPlan} onValueChange={setSubPlan}>
                    <SelectTrigger data-testid="select-subscription-plan">
                      <SelectValue placeholder={isAr ? "اختر الخطة" : "Select plan"} />
                    </SelectTrigger>
                    <SelectContent>
                      {planOptions.map(p => (
                        <SelectItem key={p.value} value={p.value}>
                          {isAr ? p.labelAr : p.labelEn}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>{isAr ? "بداية الاشتراك" : "Start Date"}</Label>
                    <Input
                      type="date"
                      value={subStart}
                      onChange={(e) => setSubStart(e.target.value)}
                      data-testid="input-subscription-start"
                    />
                  </div>
                  <div>
                    <Label>{isAr ? "نهاية الاشتراك" : "End Date"}</Label>
                    <Input
                      type="date"
                      value={subEnd}
                      onChange={(e) => setSubEnd(e.target.value)}
                      data-testid="input-subscription-end"
                    />
                  </div>
                </div>

                {subStart && subEnd && (
                  <div className="bg-muted rounded-md p-3 text-center">
                    <p className="text-sm text-muted-foreground">{isAr ? "مدة الاشتراك" : "Duration"}</p>
                    <p className="text-lg font-bold">
                      {Math.ceil((new Date(subEnd).getTime() - new Date(subStart).getTime()) / (1000 * 60 * 60 * 24))} {isAr ? "يوم" : "days"}
                    </p>
                  </div>
                )}

                <div>
                  <Label>{isAr ? "ملاحظات" : "Notes"}</Label>
                  <Textarea
                    value={subNotes}
                    onChange={(e) => setSubNotes(e.target.value)}
                    placeholder={isAr ? "ملاحظات إضافية عن الاشتراك..." : "Additional notes about subscription..."}
                    rows={3}
                    data-testid="input-subscription-notes"
                  />
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setSubscriptionDialog(null)} data-testid="button-cancel-subscription">
                  {isAr ? "إلغاء" : "Cancel"}
                </Button>
                <Button
                  onClick={handleSaveSubscription}
                  disabled={updateSubscriptionMutation.isPending}
                  data-testid="button-save-subscription"
                >
                  {updateSubscriptionMutation.isPending
                    ? (isAr ? "جاري الحفظ..." : "Saving...")
                    : (isAr ? "حفظ" : "Save")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      {/* Send Notification Dialog */}
      <Dialog open={notifDialog} onOpenChange={(o) => !o && setNotifDialog(false)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              {isAr ? "إرسال إشعار" : "Send Notification"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            <div>
              <Label>{isAr ? "الأولوية" : "Priority"}</Label>
              <Select value={notifPriority} onValueChange={setNotifPriority}>
                <SelectTrigger data-testid="select-notification-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">{isAr ? "منخفضة" : "Low"}</SelectItem>
                  <SelectItem value="normal">{isAr ? "عادية" : "Normal"}</SelectItem>
                  <SelectItem value="high">{isAr ? "عالية" : "High"}</SelectItem>
                  <SelectItem value="urgent">{isAr ? "عاجلة" : "Urgent"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>{isAr ? "العنوان (انجليزي)" : "Title (English)"}</Label>
                <Input
                  value={notifTitle}
                  onChange={(e) => setNotifTitle(e.target.value)}
                  placeholder={isAr ? "العنوان بالانجليزي" : "Notification title"}
                  data-testid="input-notification-title"
                />
              </div>
              <div>
                <Label>{isAr ? "العنوان (عربي)" : "Title (Arabic)"}</Label>
                <Input
                  value={notifTitleAr}
                  onChange={(e) => setNotifTitleAr(e.target.value)}
                  placeholder={isAr ? "العنوان بالعربي" : "Arabic title"}
                  data-testid="input-notification-title-ar"
                />
              </div>
            </div>

            <div>
              <Label>{isAr ? "الرسالة (انجليزي)" : "Message (English)"}</Label>
              <Textarea
                value={notifMessage}
                onChange={(e) => setNotifMessage(e.target.value)}
                placeholder={isAr ? "نص الرسالة بالانجليزي" : "Notification message"}
                rows={3}
                data-testid="input-notification-message"
              />
            </div>

            <div>
              <Label>{isAr ? "الرسالة (عربي)" : "Message (Arabic)"}</Label>
              <Textarea
                value={notifMessageAr}
                onChange={(e) => setNotifMessageAr(e.target.value)}
                placeholder={isAr ? "نص الرسالة بالعربي" : "Arabic message"}
                rows={3}
                data-testid="input-notification-message-ar"
              />
            </div>

            <div>
              <Label className="mb-2 block">{isAr ? "الإرسال إلى" : "Send To"}</Label>
              <div className="flex items-center gap-4">
                <Button
                  variant={notifTarget === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setNotifTarget("all")}
                  data-testid="button-target-all"
                >
                  {isAr ? "جميع المطاعم" : "All Restaurants"}
                </Button>
                <Button
                  variant={notifTarget === "selected" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setNotifTarget("selected")}
                  data-testid="button-target-selected"
                >
                  {isAr ? "مطاعم محددة" : "Selected Restaurants"}
                </Button>
              </div>
            </div>

            {notifTarget === "selected" && (
              <div className="border rounded-md max-h-48 overflow-y-auto">
                {restaurants.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground text-center">
                    {isAr ? "لا توجد مطاعم" : "No restaurants"}
                  </p>
                ) : (
                  <div className="divide-y">
                    {restaurants.map(r => (
                      <label
                        key={r.id}
                        className="flex items-center gap-3 p-3 cursor-pointer hover-elevate"
                        data-testid={`checkbox-restaurant-${r.id}`}
                      >
                        <Checkbox
                          checked={notifSelectedIds.includes(r.id)}
                          onCheckedChange={() => toggleRestaurantSelection(r.id)}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {isAr ? r.nameAr : r.nameEn}
                          </p>
                          <p className="text-xs text-muted-foreground">{r.ownerEmail}</p>
                        </div>
                        {r.isActive === false && (
                          <Badge variant="destructive" className="text-xs">
                            {isAr ? "موقوف" : "Suspended"}
                          </Badge>
                        )}
                      </label>
                    ))}
                  </div>
                )}
                {notifSelectedIds.length > 0 && (
                  <div className="border-t p-2 bg-muted/50 text-center">
                    <p className="text-xs text-muted-foreground">
                      {isAr ? `تم اختيار ${notifSelectedIds.length} مطعم` : `${notifSelectedIds.length} restaurant(s) selected`}
                    </p>
                  </div>
                )}
              </div>
            )}

            {notifPriority === "urgent" && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-md text-sm">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                <p className="text-destructive">
                  {isAr ? "الإشعارات العاجلة ستظهر بأولوية قصوى للمستخدمين" : "Urgent notifications will be highlighted as top priority for users"}
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setNotifDialog(false)} data-testid="button-cancel-notification">
              {isAr ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={handleSendNotification}
              disabled={sendNotificationMutation.isPending || (!notifTitle.trim() || !notifMessage.trim()) || (notifTarget === "selected" && notifSelectedIds.length === 0)}
              data-testid="button-send-notification"
            >
              <Send className="h-4 w-4 me-1" />
              {sendNotificationMutation.isPending
                ? (isAr ? "جاري الإرسال..." : "Sending...")
                : (isAr ? "إرسال" : "Send")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

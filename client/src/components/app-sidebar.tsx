import { LayoutDashboard, UtensilsCrossed, Settings, QrCode, Package, BarChart3, Tag, LogOut, UserCheck, FileText, Star, ShoppingCart, ChefHat, ClipboardList, Grid, CalendarDays, Truck } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import type { Restaurant } from "@shared/schema";


export function AppSidebar() {
  const { t, direction, getLocalizedName } = useLanguage();
  const { logout, user } = useAuth();
  const [location] = useLocation();

  const { data: restaurant } = useQuery<Restaurant>({
    queryKey: ["/api/restaurant"],
  });

  // Check if user has permission
  const hasPermission = (perm: boolean | null | undefined) => {
    if (!user) return false;
    // Owner, platform_admin, and branch_manager have all permissions
    if (user.role === 'owner' || user.role === 'platform_admin' || user.role === 'branch_manager') return true;
    return perm === true;
  };

  const allMenuItems = [
    { title: t("dashboard"), url: "/", icon: LayoutDashboard, permission: user?.permDashboard },
    { title: direction === "rtl" ? "نقطة البيع" : "POS", url: "/pos", icon: ShoppingCart, permission: user?.permPos },
    { title: direction === "rtl" ? "المطبخ" : "Kitchen", url: "/kitchen", icon: ChefHat, permission: user?.permKitchen },
    { title: direction === "rtl" ? "الطلبات" : "Orders", url: "/orders", icon: ClipboardList, permission: user?.permOrders },
    { title: direction === "rtl" ? "الطاولات" : "Tables", url: "/tables", icon: Grid, permission: user?.permTables },
    { title: direction === "rtl" ? "الحجوزات" : "Reservations", url: "/reservations", icon: CalendarDays, permission: user?.permTables },
    { title: direction === "rtl" ? "التوصيل" : "Delivery", url: "/delivery-orders", icon: Truck, permission: user?.permOrders },
    { title: t("menu"), url: "/menu", icon: UtensilsCrossed, permission: user?.permMenu },
    { title: t("qrCodes"), url: "/qr-codes", icon: QrCode, permission: user?.permQr },
    { title: t("inventory"), url: "/inventory", icon: Package, permission: user?.permInventory },
    { title: t("reports"), url: "/reports", icon: BarChart3, permission: user?.permReports },
    { title: direction === "rtl" ? "أرشيف الفواتير" : "Invoice Archive", url: "/invoice-archive", icon: FileText, permission: user?.permReports },
    { title: direction === "rtl" ? "العملاء" : "Customers", url: "/customers", icon: UserCheck, permission: user?.permMarketing },
    { title: direction === "rtl" ? "التقييمات" : "Reviews", url: "/reviews", icon: Star, permission: user?.permReviews },
    { title: t("promotions"), url: "/promotions", icon: Tag, permission: user?.permMarketing },
    { title: t("settings"), url: "/settings", icon: Settings, permission: user?.permSettings },
  ];

  // Filter menu items based on permissions
  const menuItems = allMenuItems.filter(item => hasPermission(item.permission));

  const isActive = (url: string) => {
    if (url === "/") return location === "/";
    return location.startsWith(url);
  };

  const restaurantName = restaurant
    ? getLocalizedName(restaurant.nameEn, restaurant.nameAr)
    : "";

  return (
    <Sidebar className={cn(direction === "rtl" && "border-l border-r-0")}>
      <SidebarHeader className="p-4">
        <Link href="/" data-testid="link-home">
          <div className="flex items-center gap-3">
            {restaurant?.logo ? (
              <img src={restaurant.logo} alt={restaurantName} className="h-10 w-10 rounded-md object-cover" />
            ) : (
              <div className="h-10 w-10 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
                {(restaurantName || "T").charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-foreground truncate" data-testid="text-restaurant-name">
                {restaurantName || "Trying"}
              </span>
              <span className="text-xs text-muted-foreground">{t("restaurant")}</span>
            </div>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={isActive(item.url)}
                    data-testid={`nav-${item.url.replace("/", "") || "dashboard"}`}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-5 w-5" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-3">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2"
          onClick={logout}
          data-testid="button-sidebar-logout"
        >
          <LogOut className="h-4 w-4" />
          <span>{direction === "rtl" ? "تسجيل الخروج" : "Logout"}</span>
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

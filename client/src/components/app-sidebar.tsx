import { LayoutDashboard, UtensilsCrossed, ClipboardList, Users, Settings, ChefHat, ShoppingCart, CookingPot, QrCode, Package, BarChart3, Tag, LogOut, UserCheck, CalendarDays, ListOrdered } from "lucide-react";
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
import logoImg from "@assets/logo.jpg";

export function AppSidebar() {
  const { t, direction, getLocalizedName } = useLanguage();
  const { logout } = useAuth();
  const [location] = useLocation();

  const { data: restaurant } = useQuery<Restaurant>({
    queryKey: ["/api/restaurant"],
  });

  const menuItems = [
    { title: t("dashboard"), url: "/", icon: LayoutDashboard },
    { title: t("pos"), url: "/pos", icon: ShoppingCart },
    { title: t("kitchen"), url: "/kitchen", icon: CookingPot },
    { title: direction === "rtl" ? "أقسام المطبخ" : "Kitchen Sections", url: "/kitchen-sections", icon: ChefHat },
    { title: t("menu"), url: "/menu", icon: UtensilsCrossed },
    { title: t("orders"), url: "/orders", icon: ClipboardList },
    { title: t("tables"), url: "/tables", icon: Users },
    { title: t("qrCodes"), url: "/qr-codes", icon: QrCode },
    { title: t("inventory"), url: "/inventory", icon: Package },
    { title: t("reports"), url: "/reports", icon: BarChart3 },
    { title: direction === "rtl" ? "العملاء" : "Customers", url: "/customers", icon: UserCheck },
    { title: direction === "rtl" ? "الحجوزات" : "Reservations", url: "/reservations", icon: CalendarDays },
    { title: direction === "rtl" ? "الطابور" : "Queue", url: "/queue", icon: ListOrdered },
    { title: t("promotions"), url: "/promotions", icon: Tag },
    { title: t("settings"), url: "/settings", icon: Settings },
  ];

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
              <img src={logoImg} alt="Trying" className="h-10 w-10 rounded-md object-contain" />
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

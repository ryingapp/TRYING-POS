import { Switch, Route, useLocation, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Header } from "@/components/header";
import { ProtectedRoute } from "@/components/protected-route";
import { ThemeProvider } from "@/lib/theme";
import { LanguageProvider, useLanguage } from "@/lib/i18n";
import { BranchProvider } from "@/lib/branch";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useWebSocket } from "@/lib/useWebSocket";
import Dashboard from "@/pages/dashboard";
import MenuPage from "@/pages/menu";
import OrdersPage from "@/pages/orders";
import TablesPage from "@/pages/tables";
import SettingsPage from "@/pages/settings";
import POSPage from "@/pages/pos";
import KitchenPage from "@/pages/kitchen";
import KitchenSectionsPage from "@/pages/kitchen-sections";
import QRCodesPage from "@/pages/qr-codes";
import InventoryPage from "@/pages/inventory";
import ReportsPage from "@/pages/reports";
import PromotionsPage from "@/pages/promotions";
import CustomersPage from "@/pages/customers";
import CustomerMenuPage from "@/pages/customer-menu";
import MenuItemDetailPage from "@/pages/menu-item-detail";
import PublicLandingPage from "@/pages/public-landing";
import PublicReservePage from "@/pages/public-reserve";
import PublicQueuePage from "@/pages/public-queue";
import OrderStatusPage from "@/pages/order-status";
import PaymentPage from "@/pages/payment";
import PaymentCallbackPage from "@/pages/payment-callback";
import ReservationPaymentCallbackPage from "@/pages/reservation-payment-callback";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import PlatformAdminPage from "@/pages/platform-admin";
import ReservationsPage from "@/pages/reservations";
import DaySessionPage from "@/pages/day-session";
import CustomizationsPage from "@/pages/customizations";
import QueuePage from "@/pages/queue";
import InvoiceArchivePage from "@/pages/invoice-archive";
import DeliverySettingsPage from "@/pages/delivery-settings";
import DeliveryOrdersPage from "@/pages/delivery-orders";
import ReviewsPage from "@/pages/reviews";
import KioskPage from "@/pages/kiosk";
import NotFound from "@/pages/not-found";

function AdminLayout() {
  const { direction } = useLanguage();
  const { user } = useAuth();
  
  // Enable real-time notifications via WebSocket
  useWebSocket();
  
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className={`flex h-screen w-full ${direction === "rtl" ? "flex-row-reverse" : ""}`} dir={direction}>
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-auto">
            <Switch>
              <Route path="/" component={() => <ProtectedRoute component={Dashboard} permission={user?.permDashboard} />} />
              <Route path="/pos" component={() => <ProtectedRoute component={POSPage} permission={user?.permPos} />} />
              <Route path="/kitchen" component={() => <ProtectedRoute component={KitchenPage} permission={user?.permKitchen} />} />
              <Route path="/kitchen-sections" component={() => <ProtectedRoute component={KitchenSectionsPage} permission={user?.permKitchen} />} />
              <Route path="/menu" component={() => <ProtectedRoute component={MenuPage} permission={user?.permMenu} />} />
              <Route path="/orders" component={() => <ProtectedRoute component={OrdersPage} permission={user?.permOrders} />} />
              <Route path="/tables" component={() => <ProtectedRoute component={TablesPage} permission={user?.permTables} />} />
              <Route path="/qr-codes" component={() => <ProtectedRoute component={QRCodesPage} permission={user?.permQr} />} />
              <Route path="/inventory" component={() => <ProtectedRoute component={InventoryPage} permission={user?.permInventory} />} />
              <Route path="/reports" component={() => <ProtectedRoute component={ReportsPage} permission={user?.permReports} />} />
              <Route path="/customers" component={() => <ProtectedRoute component={CustomersPage} permission={user?.permMarketing} />} />
              <Route path="/promotions" component={() => <ProtectedRoute component={PromotionsPage} permission={user?.permMarketing} />} />
              <Route path="/reservations" component={() => <ProtectedRoute component={ReservationsPage} permission={user?.permTables} />} />
              <Route path="/queue" component={() => <ProtectedRoute component={QueuePage} permission={user?.permTables} />} />
              <Route path="/day-session" component={() => <ProtectedRoute component={DaySessionPage} permission={user?.permReports} />} />
              <Route path="/customizations" component={() => <ProtectedRoute component={CustomizationsPage} permission={user?.permMenu} />} />
              <Route path="/invoice-archive" component={() => <ProtectedRoute component={InvoiceArchivePage} permission={user?.permReports} />} />
              <Route path="/delivery-settings" component={() => <ProtectedRoute component={DeliverySettingsPage} permission={user?.permSettings} />} />
              <Route path="/delivery-orders" component={() => <ProtectedRoute component={DeliveryOrdersPage} permission={user?.permOrders} />} />
              <Route path="/reviews" component={() => <ProtectedRoute component={ReviewsPage} permission={user?.permReviews} />} />
              <Route path="/kiosk" component={() => <ProtectedRoute component={KioskPage} permission={user?.permPos} />} />
              <Route path="/settings" component={() => <ProtectedRoute component={SettingsPage} permission={user?.permSettings} />} />
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function LoadingSplash() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-background z-50">
      <div className="flex flex-col items-center gap-6">
        <div className="flex items-center justify-center">
          <img src="/logo.png" alt="Trying" className="h-20 object-contain drop-shadow-lg" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-sm text-muted-foreground">منصة إدارة المطاعم</span>
        </div>
        <div className="flex gap-1.5 mt-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
          <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
        </div>
      </div>
    </div>
  );
}

function AppRouter() {
  const [location] = useLocation();
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingSplash />;
  }
  
  const isCustomerRoute = location === "/order" || 
    location.startsWith("/order/") || 
    location.startsWith("/order-status/") ||
    location.match(/^\/m\/[^/]+\/order-status\//) ||
    location.startsWith("/payment/") ||
    location.startsWith("/payment-callback/") ||
    location.startsWith("/m/") ||
    location.startsWith("/kiosk/") ||
    location.match(/^\/m\/[^/]+\/reservation-payment\//);

  const isAuthRoute = location === "/login" || location === "/register";

  if (isCustomerRoute) {
    return (
      <Switch>
        <Route path="/m/:restaurantId/menu" component={CustomerMenuPage} />
        <Route path="/m/:restaurantId/item/:itemId" component={MenuItemDetailPage} />
        <Route path="/m/:restaurantId/reserve" component={PublicReservePage} />
        <Route path="/m/:restaurantId/reservation-payment/:reservationId" component={ReservationPaymentCallbackPage} />
        <Route path="/m/:restaurantId/queue" component={PublicQueuePage} />
        <Route path="/m/:restaurantId/order-status/:orderId" component={OrderStatusPage} />
        <Route path="/m/:restaurantId/table/:tableId" component={CustomerMenuPage} />
        <Route path="/m/:restaurantId/:tableId" component={CustomerMenuPage} />
        <Route path="/m/:restaurantId" component={PublicLandingPage} />
        <Route path="/kiosk/:restaurantId" component={KioskPage} />
        <Route path="/order/:tableId?" component={CustomerMenuPage} />
        <Route path="/order-status/:orderId" component={OrderStatusPage} />
        <Route path="/payment/:orderId" component={PaymentPage} />
        <Route path="/payment-callback/:orderId" component={PaymentCallbackPage} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  if (isAuthRoute) {
    if (isAuthenticated && location === "/login") {
      return <Redirect to="/" />;
    }
    return (
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={RegisterPage} />
      </Switch>
    );
  }

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  if (user?.role === "platform_admin") {
    return <PlatformAdminPage />;
  }
  
  return <AdminLayout />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <BranchProvider>
              <TooltipProvider>
                <AppRouter />
                <Toaster />
              </TooltipProvider>
            </BranchProvider>
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;

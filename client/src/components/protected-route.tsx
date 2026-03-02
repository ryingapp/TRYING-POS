import { ComponentType, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldOff, Home } from "lucide-react";

interface ProtectedRouteProps {
  component: ComponentType<any>;
  permission?: boolean | null | undefined;
  requireRole?: string[];
  fallbackPath?: string;
}

export function ProtectedRoute({ 
  component: Component, 
  permission, 
  requireRole,
  fallbackPath = "/" 
}: ProtectedRouteProps) {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { language } = useLanguage();

  // Check if user has required role
  const hasRequiredRole = () => {
    if (!requireRole || requireRole.length === 0) return true;
    if (!user) return false;
    return requireRole.includes(user.role);
  };

  // Check if user has permission
  const hasPermission = () => {
    if (!user) return false;
    
    // Owner, platform_admin, and branch_manager have all permissions
    if (user.role === 'owner' || user.role === 'platform_admin' || user.role === 'branch_manager') {
      return true;
    }
    
    // If no specific permission is required, allow access
    if (permission === undefined) return true;
    
    // Check the specific permission
    return permission === true;
  };

  const canAccess = hasRequiredRole() && hasPermission();

  // If user doesn't have access, show access denied page
  if (!canAccess) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-red-100 dark:bg-red-900/20 rounded-full">
                <ShieldOff className="h-12 w-12 text-red-600 dark:text-red-400" />
              </div>
            </div>
            <CardTitle className="text-2xl">
              {language === "ar" ? "الوصول محظور" : "Access Denied"}
            </CardTitle>
            <CardDescription className="text-base mt-2">
              {language === "ar" 
                ? "عذراً، ليس لديك صلاحية للوصول إلى هذه الصفحة. يرجى التواصل مع المدير لمنحك الصلاحيات المطلوبة."
                : "Sorry, you don't have permission to access this page. Please contact your manager to grant you the required permissions."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center gap-3">
            <Button onClick={() => setLocation(fallbackPath)} variant="default">
              <Home className="h-4 w-4 mr-2" />
              {language === "ar" ? "العودة للرئيسية" : "Go to Dashboard"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <Component />;
}

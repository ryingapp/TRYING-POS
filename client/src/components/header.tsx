import { Sun, Moon, Languages, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTheme } from "@/lib/theme";
import { useLanguage } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { BranchSelector } from "@/components/branch-selector";
import { NotificationBell } from "@/components/notifications";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface HeaderProps {
  title?: string;
}

export function Header({ title }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();
  const { user, logout } = useAuth();

  return (
    <header className="flex h-14 items-center justify-between gap-4 border-b bg-card px-4">
      <div className="flex items-center gap-3">
        <SidebarTrigger data-testid="button-sidebar-toggle" />
        <BranchSelector />
        {title && (
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        )}
      </div>
      <div className="flex items-center gap-2">
        <NotificationBell />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon"
              data-testid="button-language-toggle"
            >
              <Languages className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem 
              onClick={() => setLanguage("en")}
              className={language === "en" ? "bg-accent" : ""}
              data-testid="button-language-en"
            >
              {t("english")}
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => setLanguage("ar")}
              className={language === "ar" ? "bg-accent" : ""}
              data-testid="button-language-ar"
            >
              {t("arabic")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={toggleTheme}
          data-testid="button-theme-toggle"
        >
          {theme === "light" ? (
            <Moon className="h-5 w-5" />
          ) : (
            <Sun className="h-5 w-5" />
          )}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              data-testid="button-user-menu"
            >
              <User className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {user && (
              <>
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium" data-testid="text-user-name">{user.name || user.email}</p>
                  <p className="text-xs text-muted-foreground" data-testid="text-user-role">{user.role}</p>
                </div>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onClick={logout} data-testid="button-logout">
              <LogOut className="h-4 w-4" />
              <span className="ml-2">{language === "ar" ? "تسجيل الخروج" : "Logout"}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

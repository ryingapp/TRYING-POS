import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Bell, BellRing, Check, CheckCheck, Trash2, 
  ShoppingCart, ChefHat, Package, Calendar, AlertTriangle,
  X, Clock, Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";
import { apiRequest } from "@/lib/queryClient";
import { useBranch } from "@/lib/branch";
import type { Notification } from "@shared/schema";
import { cn } from "@/lib/utils";

const notificationIcons: Record<string, typeof Bell> = {
  new_order: ShoppingCart,
  order_ready: ChefHat,
  order_completed: Check,
  low_stock: Package,
  new_reservation: Calendar,
  reservation_reminder: Clock,
  system: Info,
  alert: AlertTriangle,
};

const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-800",
  normal: "bg-blue-100 text-blue-800",
  high: "bg-orange-100 text-orange-800",
  urgent: "bg-red-100 text-red-800",
};

export function NotificationBell() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedBranchId } = useBranch();
  const [open, setOpen] = useState(false);

  const branchParam = selectedBranchId ? `?branch=${selectedBranchId}` : "";

  // Get notifications - filtered by selected branch
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: [`/api/notifications${branchParam}`],
  });

  // Get unread count - filtered by selected branch
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: [`/api/notifications/unread-count${branchParam}`],
  });

  const unreadCount = unreadData?.count || notifications.filter(n => !n.isRead).length;

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PUT", `/api/notifications/${id}/read`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/notifications") });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", `/api/notifications/read-all${branchParam}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/notifications") });
      toast({ title: language === "ar" ? "تم تحديد الكل كمقروء" : "All marked as read" });
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/notifications/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/notifications") });
    },
  });

  const formatTime = (date: Date | string | null | undefined) => {
    if (!date) return "";
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return language === "ar" ? "الآن" : "Just now";
    if (minutes < 60) return language === "ar" ? `منذ ${minutes} دقيقة` : `${minutes}m ago`;
    if (hours < 24) return language === "ar" ? `منذ ${hours} ساعة` : `${hours}h ago`;
    return language === "ar" ? `منذ ${days} يوم` : `${days}d ago`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          {unreadCount > 0 ? (
            <BellRing className="h-5 w-5 animate-pulse" />
          ) : (
            <Bell className="h-5 w-5" />
          )}
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">
            {language === "ar" ? "الإشعارات" : "Notifications"}
          </h3>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => markAllAsReadMutation.mutate()}
              className="text-xs"
            >
              <CheckCheck className="h-4 w-4 mr-1" />
              {language === "ar" ? "قراءة الكل" : "Mark all read"}
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-80">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-50" />
              <p>{language === "ar" ? "لا توجد إشعارات" : "No notifications"}</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const Icon = notificationIcons[notification.type || "system"] || Bell;
                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "p-3 hover:bg-muted/50 cursor-pointer transition-colors",
                      !notification.isRead && "bg-blue-50/50"
                    )}
                    onClick={() => {
                      if (!notification.isRead) {
                        markAsReadMutation.mutate(notification.id);
                      }
                    }}
                  >
                    <div className="flex gap-3">
                      <div className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center",
                        priorityColors[notification.priority || "normal"]
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn(
                            "text-sm line-clamp-2",
                            !notification.isRead && "font-medium"
                          )}>
                            {language === "ar" 
                              ? (notification.titleAr || notification.title)
                              : notification.title}
                          </p>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotificationMutation.mutate(notification.id);
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {language === "ar" 
                            ? (notification.messageAr || notification.message)
                            : notification.message}
                        </p>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs text-muted-foreground">
                            {formatTime(notification.createdAt)}
                          </span>
                          {!notification.isRead && (
                            <Badge variant="secondary" className="text-[10px] h-4">
                              {language === "ar" ? "جديد" : "New"}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

// Standalone Notifications Page Component
export function NotificationsPage() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedBranchId } = useBranch();

  const branchParam = selectedBranchId ? `?branch=${selectedBranchId}` : "";

  const { data: notifications = [], isLoading } = useQuery<Notification[]>({
    queryKey: [`/api/notifications${branchParam}`],
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PUT", `/api/notifications/${id}/read`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/notifications") });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PUT", `/api/notifications/read-all${branchParam}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/notifications") });
      toast({ title: language === "ar" ? "تم تحديد الكل كمقروء" : "All marked as read" });
    },
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/notifications/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/notifications") });
    },
  });

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return "";
    return new Date(date).toLocaleDateString(language === "ar" ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (isLoading) {
    return <div className="p-6">{language === "ar" ? "جاري التحميل..." : "Loading..."}</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">
              {language === "ar" ? "الإشعارات" : "Notifications"}
            </h1>
            <p className="text-muted-foreground">
              {unreadCount > 0 
                ? (language === "ar" ? `${unreadCount} إشعار غير مقروء` : `${unreadCount} unread`)
                : (language === "ar" ? "لا توجد إشعارات جديدة" : "No new notifications")}
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <Button onClick={() => markAllAsReadMutation.mutate()} variant="outline">
            <CheckCheck className="h-4 w-4 mr-2" />
            {language === "ar" ? "تحديد الكل كمقروء" : "Mark all as read"}
          </Button>
        )}
      </div>

      <div className="space-y-4">
        {notifications.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{language === "ar" ? "لا توجد إشعارات" : "No notifications"}</p>
          </div>
        ) : (
          notifications.map((notification) => {
            const Icon = notificationIcons[notification.type || "system"] || Bell;
            return (
              <div
                key={notification.id}
                className={cn(
                  "p-4 rounded-lg border flex gap-4",
                  !notification.isRead && "bg-blue-50/50 border-blue-200"
                )}
              >
                <div className={cn(
                  "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                  priorityColors[notification.priority || "normal"]
                )}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className={cn(
                        "font-medium",
                        !notification.isRead && "font-semibold"
                      )}>
                        {language === "ar" 
                          ? (notification.titleAr || notification.title)
                          : notification.title}
                      </h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {language === "ar" 
                          ? (notification.messageAr || notification.message)
                          : notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {formatDate(notification.createdAt)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {!notification.isRead && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => markAsReadMutation.mutate(notification.id)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => deleteNotificationMutation.mutate(notification.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

import { useEffect, useRef, useCallback } from "react";
import { useAuth } from "./auth";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface WebSocketMessage {
  type:
    | "new_order"
    | "order_status_changed"
    | "order_updated"
    | "data_changed"
    | "connected"
    | "pong";
  order?: any;
  payload?: any;
  previousStatus?: string;
  newStatus?: string;
}

// Maps entity names from server to their API query key prefixes
const ENTITY_QUERY_MAP: Record<string, string[]> = {
  orders: ["/api/orders", "/api/kitchen"],
  "menu-items": ["/api/menu-items", "/api/categories"],
  categories: ["/api/categories", "/api/menu-items"],
  "kitchen-sections": ["/api/kitchen-sections", "/api/kitchen"],
  tables: ["/api/tables"],
  inventory: ["/api/inventory"],
  recipes: ["/api/recipes", "/api/menu-items"],
  invoices: ["/api/invoices"],
  restaurant: ["/api/restaurant"],
  customers: ["/api/customers"],
  branches: ["/api/branches"],
  reservations: ["/api/reservations"],
  queue: ["/api/queue"],
  "day-sessions": ["/api/day-sessions"],
  notifications: ["/api/notifications"],
  promotions: ["/api/promotions"],
  coupons: ["/api/coupons"],
};

export function useWebSocket() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);

  const connect = useCallback(() => {
    const token = localStorage.getItem("auth_token");
    if (!user || !token) return;

    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close();
    }

    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws?token=${token}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("✅ WebSocket connected");
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          switch (message.type) {
            case "new_order":
              // Show notification
              toast({
                title: "🔔 طلب جديد",
                description: `طلب رقم #${message.order?.orderNumber || message.payload?.orderNumber || message.order?.id || ""}`,
              });

              // Invalidate orders and kitchen queries to refresh lists
              queryClient.invalidateQueries({
                predicate: (query) =>
                  String(query.queryKey[0]).startsWith("/api/orders"),
              });
              queryClient.invalidateQueries({
                predicate: (query) =>
                  String(query.queryKey[0]).startsWith("/api/kitchen"),
              });
              queryClient.invalidateQueries({
                predicate: (query) =>
                  String(query.queryKey[0]).startsWith("/api/tables"),
              });

              // Play notification sound
              try {
                const audio = new Audio("/notification.mp3");
                audio.play().catch(() => {});
              } catch (e) {}
              break;

            case "order_status_changed":
            case "order_updated": {
              const order =
                message.order || message.payload?.order || message.payload;
              const newStatus = message.newStatus || message.payload?.status;

              // Show notification
              const statusText: Record<string, string> = {
                created: "تم الإنشاء",
                ready: "جاهز",
                delivered: "تم التوصيل",
                preparing: "قيد التحضير",
                cancelled: "ملغي",
                completed: "مكتمل",
              };

              toast({
                title: "📦 تحديث حالة الطلب",
                description: `الطلب #${order?.orderNumber || order?.id || ""} - ${statusText[newStatus || ""] || newStatus || ""}`,
              });

              // Invalidate orders, kitchen, and tables queries
              queryClient.invalidateQueries({
                predicate: (query) =>
                  String(query.queryKey[0]).startsWith("/api/orders"),
              });
              queryClient.invalidateQueries({
                predicate: (query) =>
                  String(query.queryKey[0]).startsWith("/api/kitchen"),
              });
              queryClient.invalidateQueries({
                predicate: (query) =>
                  String(query.queryKey[0]).startsWith("/api/tables"),
              });
              if (order?.id) {
                queryClient.invalidateQueries({
                  queryKey: [`/api/orders/${order.id}`],
                });
              }
              break;
            }

            case "data_changed": {
              // Generic data change — invalidate matching queries
              const entity = message.payload?.entity;
              if (entity) {
                const prefixes = ENTITY_QUERY_MAP[entity] || [`/api/${entity}`];
                for (const prefix of prefixes) {
                  queryClient.invalidateQueries({
                    predicate: (query) =>
                      String(query.queryKey[0]).startsWith(prefix),
                  });
                }
              }
              break;
            }

            case "connected":
            case "pong":
              // Handled silently
              break;
          }
        } catch (error) {
          console.error("Error parsing WebSocket message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("❌ WebSocket error:", error);
      };

      ws.onclose = (event) => {
        console.log("🔌 WebSocket disconnected, code:", event.code);
        wsRef.current = null;

        // Don't reconnect on auth failures (4001) - token is invalid
        if (event.code === 4001) {
          console.log("🔒 WebSocket auth failed - clearing token and stopping reconnect");
          localStorage.removeItem("auth_token");
          localStorage.removeItem("auth_user");
          window.location.reload();
          return;
        }

        // Attempt to reconnect with exponential backoff
        const maxAttempts = 10;
        const baseDelay = 1000;

        if (reconnectAttemptsRef.current < maxAttempts) {
          const delay = Math.min(
            baseDelay * Math.pow(2, reconnectAttemptsRef.current),
            30000,
          );
          reconnectAttemptsRef.current++;

          console.log(
            `🔄 Reconnecting in ${delay}ms... (attempt ${reconnectAttemptsRef.current}/${maxAttempts})`,
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
    }
  }, [user, toast, queryClient]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    reconnectAttemptsRef.current = 0;
  }, []);

  // Connect when user logs in
  useEffect(() => {
    if (user) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [user, connect, disconnect]);

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
    connect,
    disconnect,
  };
}

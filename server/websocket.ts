import { WebSocketServer, WebSocket } from "ws";
import type { Server as HTTPServer } from "http";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key";

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  restaurantId?: string;
  branchId?: string;
  role?: string;
}

interface WebSocketMessage {
  type: string;
  payload?: any;
}

export class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, Set<AuthenticatedWebSocket>> = new Map();

  initialize(server: HTTPServer) {
    this.wss = new WebSocketServer({ 
      server,
      path: "/ws",
    });

    console.log("✅ WebSocket server initialized at /ws");

    this.wss.on("connection", (ws: AuthenticatedWebSocket, req) => {
      console.log("New WebSocket connection attempt");

      // Authenticate using token from query params
      const url = new URL(req.url || "", `http://${req.headers.host}`);
      const token = url.searchParams.get("token");

      if (!token) {
        console.log("WebSocket auth failed: no token");
        ws.close(4001, "Authentication required");
        return;
      }

      try {
        const decoded = jwt.verify(token, JWT_SECRET) as { 
          userId: string; 
          restaurantId: string;
          branchId?: string;
          role?: string;
        };
        
        ws.userId = decoded.userId;
        ws.restaurantId = decoded.restaurantId;
        ws.branchId = decoded.branchId;
        ws.role = decoded.role;

        console.log(`WebSocket authenticated: user=${ws.userId}, restaurant=${ws.restaurantId}`);

        // Add to clients map
        if (!this.clients.has(ws.restaurantId)) {
          this.clients.set(ws.restaurantId, new Set());
        }
        this.clients.get(ws.restaurantId)!.add(ws);

        // Send welcome message
        ws.send(JSON.stringify({
          type: "connected",
          payload: { userId: ws.userId, restaurantId: ws.restaurantId }
        }));

        // Handle incoming messages
        ws.on("message", (data) => {
          try {
            const message: WebSocketMessage = JSON.parse(data.toString());
            this.handleMessage(ws, message);
          } catch (err) {
            console.error("WebSocket message parse error:", err);
          }
        });

        // Handle disconnect
        ws.on("close", () => {
          console.log(`WebSocket disconnected: user=${ws.userId}`);
          if (ws.restaurantId && this.clients.has(ws.restaurantId)) {
            this.clients.get(ws.restaurantId)!.delete(ws);
            if (this.clients.get(ws.restaurantId)!.size === 0) {
              this.clients.delete(ws.restaurantId);
            }
          }
        });

        ws.on("error", (err) => {
          console.error("WebSocket error:", err);
        });

      } catch (err) {
        console.log("WebSocket auth failed: invalid token");
        ws.close(4001, "Invalid token");
      }
    });

    console.log("✓ WebSocket server initialized at /ws");
  }

  private handleMessage(ws: AuthenticatedWebSocket, message: WebSocketMessage) {
    console.log("WebSocket message received:", message.type);
    
    // Handle ping/pong for keepalive
    if (message.type === "ping") {
      ws.send(JSON.stringify({ type: "pong" }));
    }
  }

  // Broadcast to all clients of a restaurant
  broadcastToRestaurant(restaurantId: string, message: WebSocketMessage) {
    const clients = this.clients.get(restaurantId);
    if (!clients) return;

    const payload = JSON.stringify(message);
    let sent = 0;

    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
        sent++;
      }
    });

    console.log(`Broadcast to restaurant ${restaurantId}: ${message.type} (${sent} clients)`);
  }

  // Broadcast to all clients of a specific branch
  broadcastToBranch(restaurantId: string, branchId: string, message: WebSocketMessage) {
    const clients = this.clients.get(restaurantId);
    if (!clients) return;

    const payload = JSON.stringify(message);
    let sent = 0;

    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN && client.branchId === branchId) {
        client.send(payload);
        sent++;
      }
    });

    console.log(`Broadcast to branch ${branchId}: ${message.type} (${sent} clients)`);
  }

  // Send notification about new order
  notifyNewOrder(restaurantId: string, branchId: string, order: any) {
    this.broadcastToBranch(restaurantId, branchId, {
      type: "new_order",
      payload: order
    });
  }

  // Send notification about order status change
  notifyOrderStatusChange(restaurantId: string, branchId: string, orderId: string, status: string, order?: any) {
    this.broadcastToBranch(restaurantId, branchId, {
      type: "order_status_changed",
      payload: { orderId, status, order }
    });
  }

  // Send notification about order update
  notifyOrderUpdate(restaurantId: string, branchId: string, order: any) {
    this.broadcastToBranch(restaurantId, branchId, {
      type: "order_updated",
      payload: order
    });
  }

  getConnectedClients(restaurantId: string): number {
    return this.clients.get(restaurantId)?.size || 0;
  }
}

export const wsManager = new WebSocketManager();

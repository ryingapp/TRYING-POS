import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from './auth';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

interface WebSocketMessage {
  type: 'new_order' | 'order_status_changed';
  order: any;
  previousStatus?: string;
  newStatus?: string;
}

export function useWebSocket() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);

  const connect = useCallback(() => {
    const token = localStorage.getItem('auth_token');
    if (!user || !token) return;

    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close();
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws?token=${token}`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        reconnectAttemptsRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          switch (message.type) {
            case 'new_order':
              // Show notification
              toast({
                title: '🔔 طلب جديد',
                description: `طلب رقم #${message.order.orderNumber || message.order.id}`,
              });
              
              // Invalidate orders and kitchen queries to refresh lists
              queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
              queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith('/api/kitchen') });
              
              // Play notification sound
              try {
                const audio = new Audio('/notification.mp3');
                audio.play().catch(() => {});
              } catch (e) {}
              break;

            case 'order_status_changed':
              // Show notification
              const statusText: Record<string, string> = {
                created: 'تم الإنشاء',
                ready: 'جاهز',
                delivered: 'تم التوصيل',
                preparing: 'قيد التحضير',
                cancelled: 'ملغي',
              };
              
              toast({
                title: '📦 تحديث حالة الطلب',
                description: `الطلب #${message.order.orderNumber || message.order.id} - ${statusText[message.newStatus || ''] || message.newStatus}`,
              });
              
              // Invalidate orders and kitchen queries to refresh
              queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
              queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith('/api/kitchen') });
              queryClient.invalidateQueries({ queryKey: [`/api/orders/${message.order.id}`] });
              break;
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        wsRef.current = null;

        // Attempt to reconnect with exponential backoff
        const maxAttempts = 10;
        const baseDelay = 1000;
        
        if (reconnectAttemptsRef.current < maxAttempts) {
          const delay = Math.min(baseDelay * Math.pow(2, reconnectAttemptsRef.current), 30000);
          reconnectAttemptsRef.current++;
          
          console.log(`🔄 Reconnecting in ${delay}ms... (attempt ${reconnectAttemptsRef.current}/${maxAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
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

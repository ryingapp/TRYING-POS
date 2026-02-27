import NetInfo from '@react-native-community/netinfo';
import { api } from './api';
import { database } from './database';

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

interface SyncCallbacks {
  onStatusChange?: (status: SyncStatus) => void;
  onPendingCountChange?: (count: number) => void;
  onDataSynced?: () => void;
}

class SyncService {
  private callbacks: SyncCallbacks = {};
  private isRunning = false;
  private syncInterval: ReturnType<typeof setInterval> | null = null;
  private isOnline = true;
  private dbReady = false;
  private branchId: string | null = null;

  setBranchId(id: string | null) {
    this.branchId = id;
  }

  setCallbacks(callbacks: SyncCallbacks) {
    this.callbacks = callbacks;
  }

  private async ensureDb() {
    if (!this.dbReady) {
      try {
        await database.init();
        this.dbReady = true;
      } catch (e) {
        console.log('[Sync] DB init error:', e);
      }
    }
  }

  async startAutoSync(intervalMs: number = 60000) {
    await this.ensureDb();

    // Monitor connectivity
    NetInfo.addEventListener((state) => {
      const wasOffline = !this.isOnline;
      this.isOnline = !!(state.isConnected && state.isInternetReachable !== false);

      if (this.isOnline && wasOffline) {
        // Just came online — sync immediately
        console.log('[Sync] Reconnected, auto-syncing...');
        this.syncAll();
      }

      if (!this.isOnline) {
        this.callbacks.onStatusChange?.('offline');
      }
    });

    // Periodic sync
    this.syncInterval = setInterval(() => {
      if (this.isOnline) {
        this.syncAll();
      } else {
        // Even offline, update pending count so UI stays accurate
        this.updatePendingCount();
      }
    }, intervalMs);

    // Initial sync
    if (this.isOnline) {
      await this.syncAll();
    } else {
      await this.updatePendingCount();
    }
  }

  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  private async updatePendingCount() {
    try {
      await this.ensureDb();
      const count = await database.getSyncQueueCount();
      const unsyncedOrders = await database.getUnsyncedOrders();
      this.callbacks.onPendingCountChange?.(count + unsyncedOrders.length);
    } catch {}
  }

  async syncAll(): Promise<boolean> {
    if (this.isRunning || !this.isOnline) return false;
    this.isRunning = true;

    try {
      await this.ensureDb();
      this.callbacks.onStatusChange?.('syncing');

      // 1. Push unsynced orders
      await this.pushOrders();

      // 2. Process sync queue (status + payment changes)
      await this.processSyncQueue();

      // 3. Retry previously failed items
      await this.retryFailed();

      // 4. Pull fresh data
      await this.pullData();

      // Update pending count
      await this.updatePendingCount();

      this.callbacks.onStatusChange?.('idle');
      this.callbacks.onDataSynced?.();
      return true;
    } catch (error) {
      console.log('[Sync] error:', error);
      this.callbacks.onStatusChange?.('error');
      return false;
    } finally {
      this.isRunning = false;
    }
  }

  private async pushOrders(): Promise<void> {
    const unsynced = await database.getUnsyncedOrders();
    console.log(`[Sync] Pushing ${unsynced.length} unsynced orders...`);

    for (const order of unsynced) {
      try {
        // Send order without items (server creates order first, items separately)
        const serverOrder = await api.createOrder({
          orderNumber: order.orderNumber || `ORD-${Date.now().toString().slice(-6)}`,
          status: order.status || 'pending',
          branchId: order.branchId,
          tableId: order.tableId,
          orderType: order.orderType,
          customerName: order.customerName,
          customerPhone: order.customerPhone,
          notes: order.notes,
          kitchenNotes: order.kitchenNotes,
          subtotal: order.subtotal,
          discount: order.discount || '0',
          deliveryFee: order.deliveryFee || '0',
          tax: order.tax,
          total: order.total,
          paymentMethod: order.paymentMethod,
          isPaid: order.isPaid,
        });

        // Create order items separately
        if (order.items && Array.isArray(order.items)) {
          for (const item of order.items) {
            try {
              await api.createOrderItem(serverOrder.id, {
                menuItemId: item.menuItemId,
                quantity: item.quantity,
                unitPrice: item.unitPrice || item.price || '0',
                totalPrice: item.totalPrice || (parseFloat(item.unitPrice || item.price || '0') * item.quantity).toFixed(2),
                notes: item.notes || '',
              });
            } catch (err) {
              console.log('[Sync] Failed to push order item:', err);
            }
          }
        }

        // Also create invoice for the server order
        try {
          await api.createInvoice({
            orderId: serverOrder.id,
            branchId: order.branchId,
            subtotal: order.subtotal,
            discount: order.discount || '0',
            deliveryFee: order.deliveryFee || '0',
            paymentMethod: order.paymentMethod,
            isPaid: order.isPaid,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
          });
        } catch (err) {
          console.log('[Sync] Failed to create invoice for synced order:', err);
        }

        await database.markOrderSynced(order.localId, serverOrder);
        console.log(`[Sync] Order ${order.localId} synced as ${serverOrder.id}`);
      } catch (error) {
        console.log('[Sync] Failed to push order:', order.localId, error);
      }
    }
  }

  private async processSyncQueue(): Promise<void> {
    const items = await database.getPendingSyncItems();

    for (const item of items) {
      try {
        switch (item.type) {
          case 'order_status':
            await api.updateOrderStatus(
              item.data.orderId,
              item.data.status,
              item.data.reason
            );
            break;
          case 'order_payment':
            await api.updateOrderPayment(
              item.data.orderId,
              item.data.paymentMethod,
              item.data.isPaid
            );
            break;
        }
        await database.markSyncItemCompleted(item.id);
      } catch (error) {
        console.log('Sync queue item failed:', item.id, error);
        await database.markSyncItemFailed(item.id);
      }
    }
  }

  private async retryFailed(): Promise<void> {
    try {
      const failed = await database.getFailedSyncItems();
      if (failed.length === 0) return;
      console.log(`[Sync] Retrying ${failed.length} failed items...`);
      for (const item of failed) {
        if (item.retryCount >= 5) continue; // give up after 5 attempts
        try {
          switch (item.type) {
            case 'order_status':
              await api.updateOrderStatus(item.data.orderId, item.data.status, item.data.reason);
              break;
            case 'order_payment':
              await api.updateOrderPayment(item.data.orderId, item.data.paymentMethod, item.data.isPaid);
              break;
          }
          await database.markSyncItemCompleted(item.id);
        } catch {
          await database.markSyncItemFailed(item.id);
        }
      }
    } catch (e) {
      console.log('[Sync] retryFailed error:', e);
    }
  }

  async pullData(): Promise<void> {
    try {
      // Pull categories
      const categories = await api.getCategories();
      await database.saveCategories(categories);
    } catch (error) {
      console.log('Pull categories error:', error);
    }

    try {
      // Pull menu items
      const menuItems = await api.getMenuItems();
      await database.saveMenuItems(menuItems);
    } catch (error) {
      console.log('Pull menu items error:', error);
    }

    try {
      // Pull today's orders (with branch filter if set)
      const orders = await api.getOrders(this.branchId || undefined);
      for (const order of orders.slice(0, 50)) {
        await database.saveOrder(order, true).catch(() => {});
      }
    } catch (error) {
      console.log('Pull orders error:', error);
    }
  }

  getIsOnline(): boolean {
    return this.isOnline;
  }
}

export const syncService = new SyncService();

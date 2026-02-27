import * as SQLite from 'expo-sqlite';
import type { Category, MenuItem, Order, OrderItem, SyncQueueItem } from '../types';

const DB_NAME = 'tryingpos.db';

class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;

  async init(): Promise<void> {
    this.db = await SQLite.openDatabaseAsync(DB_NAME);

    await this.db.execAsync('PRAGMA journal_mode = WAL;');

    // Create tables if they don't exist (preserve existing data)
    await this.db.execAsync(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        nameEn TEXT,
        nameAr TEXT,
        sortOrder INTEGER DEFAULT 0,
        restaurantId TEXT,
        isActive INTEGER DEFAULT 1,
        data TEXT
      );

      CREATE TABLE IF NOT EXISTS menu_items (
        id TEXT PRIMARY KEY,
        nameEn TEXT,
        nameAr TEXT,
        price TEXT,
        categoryId TEXT,
        image TEXT,
        isAvailable INTEGER DEFAULT 1,
        restaurantId TEXT,
        data TEXT
      );

      CREATE TABLE IF NOT EXISTS orders (
        id TEXT,
        localId TEXT UNIQUE,
        orderNumber TEXT,
        orderType TEXT DEFAULT 'dine_in',
        status TEXT DEFAULT 'pending',
        subtotal TEXT DEFAULT '0',
        discount TEXT DEFAULT '0',
        deliveryFee TEXT DEFAULT '0',
        tax TEXT DEFAULT '0',
        total TEXT DEFAULT '0',
        paymentMethod TEXT DEFAULT 'cash',
        isPaid INTEGER DEFAULT 0,
        customerName TEXT,
        customerPhone TEXT,
        notes TEXT,
        kitchenNotes TEXT,
        restaurantId TEXT,
        branchId TEXT,
        tableId TEXT,
        synced INTEGER DEFAULT 0,
        data TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        orderId TEXT,
        localOrderId TEXT,
        menuItemId TEXT,
        itemName TEXT,
        quantity INTEGER DEFAULT 1,
        unitPrice TEXT,
        totalPrice TEXT,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        action TEXT NOT NULL,
        data TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        retryCount INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_orders_synced ON orders(synced);
      CREATE INDEX IF NOT EXISTS idx_orders_branchId ON orders(branchId);
      CREATE INDEX IF NOT EXISTS idx_order_items_orderId ON order_items(orderId);
      CREATE INDEX IF NOT EXISTS idx_order_items_localOrderId ON order_items(localOrderId);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
    `);
  }

  // ==================== CATEGORIES ====================

  async saveCategories(categories: Category[]): Promise<void> {
    if (!this.db) return;
    await this.db.execAsync('DELETE FROM categories;');
    for (const cat of categories) {
      await this.db.runAsync(
        'INSERT INTO categories (id, nameEn, nameAr, sortOrder, restaurantId, isActive, data) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          cat.id,
          cat.nameEn || '',
          cat.nameAr || '',
          cat.sortOrder || 0,
          cat.restaurantId || null,
          cat.isActive !== false ? 1 : 0,
          JSON.stringify(cat),
        ]
      );
    }
  }

  async getCategories(): Promise<Category[]> {
    if (!this.db) return [];
    const rows = await this.db.getAllAsync('SELECT data FROM categories WHERE isActive = 1 ORDER BY sortOrder ASC');
    return rows.map((r: any) => JSON.parse(r.data));
  }

  // ==================== MENU ITEMS ====================

  async saveMenuItems(items: MenuItem[]): Promise<void> {
    if (!this.db) return;
    await this.db.execAsync('DELETE FROM menu_items;');
    for (const item of items) {
      await this.db.runAsync(
        'INSERT INTO menu_items (id, nameEn, nameAr, price, categoryId, image, isAvailable, restaurantId, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          item.id,
          item.nameEn || '',
          item.nameAr || '',
          item.price || '0',
          item.categoryId || null,
          item.image || null,
          item.isAvailable !== false ? 1 : 0,
          item.restaurantId || null,
          JSON.stringify(item),
        ]
      );
    }
  }

  async getMenuItems(categoryId?: string): Promise<MenuItem[]> {
    if (!this.db) return [];
    let query = 'SELECT data FROM menu_items WHERE isAvailable = 1';
    const params: any[] = [];
    if (categoryId) {
      query += ' AND categoryId = ?';
      params.push(categoryId);
    }
    const rows = await this.db.getAllAsync(query, params);
    return rows.map((r: any) => JSON.parse(r.data));
  }

  // ==================== ORDERS ====================

  async saveOrder(order: any, synced: boolean = false): Promise<string> {
    if (!this.db) throw new Error('Database not initialized');

    // If order has a server id, check if it already exists in the DB
    // and UPDATE instead of INSERT — prevents duplicate rows on every sync
    if (order.id) {
      const existing: any = await this.db.getFirstAsync(
        'SELECT localId FROM orders WHERE id = ?', [order.id]
      );
      if (existing) {
        await this.db.runAsync(
          `UPDATE orders SET
            status=?, paymentMethod=?, isPaid=?, data=?, orderNumber=?,
            synced=?, customerName=?, customerPhone=?, notes=?, kitchenNotes=?,
            tableId=?, branchId=?
           WHERE id=?`,
          [
            order.status || 'pending',
            order.paymentMethod || 'cash',
            order.isPaid ? 1 : 0,
            JSON.stringify(order),
            order.orderNumber || null,
            synced ? 1 : 0,
            order.customerName || null,
            order.customerPhone || null,
            order.notes || null,
            order.kitchenNotes || null,
            order.tableId || null,
            order.branchId || null,
            order.id,
          ]
        );
        // Update items if provided
        if (order.items?.length) {
          await this.db.runAsync('DELETE FROM order_items WHERE orderId = ?', [order.id]);
          for (const item of order.items) {
            await this.db.runAsync(
              `INSERT INTO order_items (orderId, localOrderId, menuItemId, itemName, quantity, unitPrice, totalPrice, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                order.id,
                existing.localId,
                item.menuItemId || null,
                item.itemName || item.nameAr || item.nameEn || null,
                item.quantity || 1,
                item.unitPrice?.toString() || item.price?.toString() || '0',
                item.totalPrice?.toString() || '0',
                item.notes || null,
              ]
            );
          }
        }
        return existing.localId;
      }
    }

    const localId = order.localId || `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await this.db.runAsync(
      `INSERT OR REPLACE INTO orders (id, localId, orderNumber, orderType, status, subtotal, discount, deliveryFee, tax, total, paymentMethod, isPaid, customerName, customerPhone, notes, kitchenNotes, restaurantId, branchId, tableId, synced, data, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        order.id || null,
        localId,
        order.orderNumber || null,
        order.orderType || 'dine_in',
        order.status || 'pending',
        order.subtotal?.toString() || '0',
        order.discount?.toString() || '0',
        order.deliveryFee?.toString() || '0',
        order.tax?.toString() || '0',
        order.total?.toString() || '0',
        order.paymentMethod || 'cash',
        order.isPaid ? 1 : 0,
        order.customerName || null,
        order.customerPhone || null,
        order.notes || null,
        order.kitchenNotes || null,
        order.restaurantId || null,
        order.branchId || null,
        order.tableId || null,
        synced ? 1 : 0,
        JSON.stringify(order),
        order.createdAt || new Date().toISOString(),
      ]
    );

    // Save order items
    if (order.items?.length) {
      for (const item of order.items) {
        await this.db.runAsync(
          `INSERT INTO order_items (orderId, localOrderId, menuItemId, itemName, quantity, unitPrice, totalPrice, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            order.id || null,
            localId,
            item.menuItemId || null,
            item.itemName || item.nameAr || item.nameEn || null,
            item.quantity || 1,
            item.unitPrice?.toString() || item.price?.toString() || '0',
            item.totalPrice?.toString() || '0',
            item.notes || null,
          ]
        );
      }
    }

    return localId;
  }

  async getOrders(): Promise<Order[]> {
    if (!this.db) return [];
    const rows = await this.db.getAllAsync('SELECT data, id, localId FROM orders ORDER BY createdAt DESC LIMIT 100');
    const orders: Order[] = [];
    for (const r of rows as any[]) {
      const order = JSON.parse(r.data);
      // If items not in JSON data, fetch from order_items table
      if (!order.items || order.items.length === 0) {
        try {
          const orderId = order.id || r.id;
          const localId = r.localId;
          const itemRows = await this.db!.getAllAsync(
            'SELECT * FROM order_items WHERE orderId = ? OR localOrderId = ?',
            [orderId || '', localId || '']
          );
          if (itemRows && (itemRows as any[]).length > 0) {
            order.items = itemRows;
          }
        } catch {}
      }
      orders.push(order);
    }
    return orders;
  }

  async getUnsyncedOrders(): Promise<any[]> {
    if (!this.db) return [];
    const rows = await this.db.getAllAsync('SELECT * FROM orders WHERE synced = 0');
    return rows.map((r: any) => ({
      ...JSON.parse(r.data || '{}'),
      localId: r.localId,
    }));
  }

  async markOrderSynced(localId: string, serverOrder: Order): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync(
      'UPDATE orders SET id = ?, synced = 1, data = ?, orderNumber = ? WHERE localId = ?',
      [serverOrder.id, JSON.stringify(serverOrder), serverOrder.orderNumber || null, localId]
    );
  }

  async updateOrderInDb(orderId: string, data: Partial<Order>): Promise<void> {
    if (!this.db) return;
    const existing = await this.db.getFirstAsync('SELECT data FROM orders WHERE id = ?', [orderId]);
    if (existing) {
      const parsed = JSON.parse((existing as any).data);
      const updated = { ...parsed, ...data };
      await this.db.runAsync(
        'UPDATE orders SET status = ?, data = ? WHERE id = ?',
        [updated.status || parsed.status, JSON.stringify(updated), orderId]
      );
    }
  }

  // ==================== SYNC QUEUE ====================

  async addToSyncQueue(type: string, action: string, data: any): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync(
      'INSERT INTO sync_queue (type, action, data) VALUES (?, ?, ?)',
      [type, action, JSON.stringify(data)]
    );
  }

  async getPendingSyncItems(): Promise<SyncQueueItem[]> {
    if (!this.db) return [];
    const rows = await this.db.getAllAsync(
      "SELECT * FROM sync_queue WHERE status = 'pending' ORDER BY createdAt ASC"
    );
    return rows.map((r: any) => ({
      ...r,
      data: JSON.parse(r.data),
    }));
  }

  async markSyncItemCompleted(id: number): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync("UPDATE sync_queue SET status = 'completed' WHERE id = ?", [id]);
  }

  async markSyncItemFailed(id: number): Promise<void> {
    if (!this.db) return;
    await this.db.runAsync(
      "UPDATE sync_queue SET status = 'failed', retryCount = retryCount + 1 WHERE id = ?",
      [id]
    );
  }

  async getFailedSyncItems(): Promise<SyncQueueItem[]> {
    if (!this.db) return [];
    const rows = await this.db.getAllAsync(
      "SELECT * FROM sync_queue WHERE status = 'failed' AND retryCount < 5 ORDER BY createdAt ASC"
    );
    return rows.map((r: any) => ({
      ...r,
      data: JSON.parse(r.data),
    }));
  }

  async getSyncQueueCount(): Promise<number> {
    if (!this.db) return 0;
    const result = await this.db.getFirstAsync("SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending'");
    return (result as any)?.count || 0;
  }

  // ==================== CLEANUP ====================

  async clearAll(): Promise<void> {
    if (!this.db) return;
    await this.db.execAsync(`
      DELETE FROM categories;
      DELETE FROM menu_items;
      DELETE FROM orders;
      DELETE FROM order_items;
      DELETE FROM sync_queue;
    `);
  }
}

export const database = new DatabaseService();

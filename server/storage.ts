import { 
  restaurants, categories, menuItems, tables, orders, orderItems, invoices, branches, users, inventoryItems, inventoryTransactions, recipes, printers, moyasarMerchants, moyasarDocuments, paymentTransactions, moyasarInvoices, applePayDomains,
  reservations, promotions, coupons, couponUsage, reviews, menuItemVariants, customizationGroups, customizationOptions, menuItemCustomizations, orderItemCustomizations, queueEntries, queueCounters,
  daySessions, cashTransactions, notifications, notificationSettings, customers, orderAuditLog, kitchenSections,
  type Restaurant, type InsertRestaurant,
  type Category, type InsertCategory,
  type MenuItem, type InsertMenuItem,
  type Table, type InsertTable,
  type Order, type InsertOrder,
  type OrderItem, type InsertOrderItem,
  type Invoice, type InsertInvoice,
  type Branch, type InsertBranch,
  type User, type InsertUser,
  type InventoryItem, type InsertInventoryItem,
  type InventoryTransaction, type InsertInventoryTransaction,
  type Recipe, type InsertRecipe,
  type Printer, type InsertPrinter,
  type MoyasarMerchant, type InsertMoyasarMerchant,
  type MoyasarDocument, type InsertMoyasarDocument,
  type PaymentTransaction, type InsertPaymentTransaction,
  type MoyasarInvoice, type InsertMoyasarInvoice,
  type ApplePayDomain, type InsertApplePayDomain,
  type Reservation, type InsertReservation,
  type Promotion, type InsertPromotion,
  type Coupon, type InsertCoupon,
  type CouponUsage, type InsertCouponUsage,
  type MenuItemVariant, type InsertMenuItemVariant,
  type CustomizationGroup, type InsertCustomizationGroup,
  type CustomizationOption, type InsertCustomizationOption,
  type MenuItemCustomization, type InsertMenuItemCustomization,
  type OrderItemCustomization, type InsertOrderItemCustomization,
  type QueueEntry, type InsertQueueEntry,
  type QueueCounter, type InsertQueueCounter,
  type DaySession, type InsertDaySession,
  type CashTransaction, type InsertCashTransaction,
  type Notification, type InsertNotification,
  type NotificationSettings, type InsertNotificationSettings,
  type Customer, type InsertCustomer,
  type Review, type InsertReview,
  type KitchenSection, type InsertKitchenSection,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, sql, and, gte, lte, or, isNull } from "drizzle-orm";

export interface IStorage {
  // Restaurant
  getRestaurant(): Promise<Restaurant | undefined>;
  getRestaurantById(id: string): Promise<Restaurant | undefined>;
  getRestaurantBySlug(slug: string): Promise<Restaurant | undefined>;
  resolveRestaurantId(idOrSlug: string): Promise<string | null>;
  createRestaurant(data: InsertRestaurant): Promise<Restaurant>;
  updateRestaurant(data: InsertRestaurant): Promise<Restaurant | undefined>;
  updateRestaurantById(id: string, data: Partial<InsertRestaurant>): Promise<Restaurant | undefined>;
  
  // Categories
  getCategories(restaurantId: string): Promise<Category[]>;
  getCategory(id: string): Promise<Category | undefined>;
  createCategory(data: InsertCategory): Promise<Category>;
  updateCategory(id: string, data: InsertCategory): Promise<Category | undefined>;
  deleteCategory(id: string): Promise<void>;
  
  // Kitchen Sections
  getKitchenSections(restaurantId: string, branchId?: string): Promise<KitchenSection[]>;
  getKitchenSection(id: string): Promise<KitchenSection | undefined>;
  createKitchenSection(data: InsertKitchenSection): Promise<KitchenSection>;
  updateKitchenSection(id: string, data: InsertKitchenSection): Promise<KitchenSection | undefined>;
  deleteKitchenSection(id: string): Promise<void>;
  
  // Menu Items
  getMenuItems(restaurantId: string): Promise<MenuItem[]>;
  getMenuItem(id: string): Promise<MenuItem | undefined>;
  createMenuItem(data: InsertMenuItem): Promise<MenuItem>;
  updateMenuItem(id: string, data: InsertMenuItem): Promise<MenuItem | undefined>;
  deleteMenuItem(id: string): Promise<void>;
  
  // Tables
  getTables(restaurantId: string, branchId?: string): Promise<Table[]>;
  getTable(id: string): Promise<Table | undefined>;
  createTable(data: InsertTable): Promise<Table>;
  updateTable(id: string, data: InsertTable): Promise<Table | undefined>;
  updateTableStatus(id: string, status: string): Promise<Table | undefined>;
  deleteTable(id: string): Promise<void>;
  
  // Orders
  getOrders(restaurantId: string, branchId?: string): Promise<Order[]>;
  getOrder(id: string): Promise<Order | undefined>;
  getActiveOrderByTable(tableId: string): Promise<Order | undefined>;
  createOrder(data: InsertOrder): Promise<Order>;
  updateOrder(id: string, data: Partial<InsertOrder>): Promise<Order | undefined>;
  updateOrderStatus(id: string, status: string): Promise<Order | undefined>;
  deleteOrder(id: string): Promise<void>;
  
  // Order Items
  getOrderItems(orderId: string): Promise<OrderItem[]>;
  createOrderItem(data: InsertOrderItem): Promise<OrderItem>;
  deleteOrderItem(id: string): Promise<void>;
  
  // Invoices
  getInvoices(restaurantId: string): Promise<Invoice[]>;
  getInvoice(id: string): Promise<Invoice | undefined>;
  getInvoiceByOrder(orderId: string): Promise<Invoice | undefined>;
  createInvoice(data: InsertInvoice): Promise<Invoice>;
  updateInvoice(id: string, data: Partial<InsertInvoice>): Promise<Invoice | undefined>;
  getNextInvoiceNumber(restaurantId: string): Promise<string>;
  
  // Branches
  getBranches(restaurantId: string): Promise<Branch[]>;
  getBranch(id: string): Promise<Branch | undefined>;
  getBranchBySlug(restaurantId: string, slug: string): Promise<Branch | undefined>;
  resolveBranchId(restaurantId: string, idOrSlug: string): Promise<string | null>;
  createBranch(data: InsertBranch): Promise<Branch>;
  updateBranch(id: string, data: Partial<InsertBranch>): Promise<Branch | undefined>;
  deleteBranch(id: string): Promise<void>;
  
  // Users
  getUsers(restaurantId: string): Promise<User[]>;
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(data: InsertUser): Promise<User>;
  updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;
  updateUserLastLogin(id: string): Promise<void>;

  getCustomers(restaurantId: string): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | undefined>;
  getCustomerByPhone(restaurantId: string, phone: string): Promise<Customer | undefined>;
  createCustomer(data: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, data: Partial<InsertCustomer>): Promise<Customer | undefined>;
  deleteCustomer(id: string): Promise<void>;

  // Platform Admin
  getAllRestaurants(): Promise<Restaurant[]>;
  getAllUsers(): Promise<User[]>;
  getOrdersByRestaurant(restaurantId: string): Promise<Order[]>;
  
  // Inventory Items
  getInventoryItems(restaurantId: string, branchId?: string): Promise<InventoryItem[]>;
  getInventoryItem(id: string): Promise<InventoryItem | undefined>;
  createInventoryItem(data: InsertInventoryItem): Promise<InventoryItem>;
  updateInventoryItem(id: string, data: Partial<InsertInventoryItem>): Promise<InventoryItem | undefined>;
  deleteInventoryItem(id: string): Promise<void>;
  
  // Inventory Transactions
  getInventoryTransactions(itemId: string): Promise<InventoryTransaction[]>;
  createInventoryTransaction(data: InsertInventoryTransaction): Promise<InventoryTransaction>;
  
  // Reports
  getSalesReport(restaurantId: string, startDate: Date, endDate: Date, branchId?: string): Promise<any>;
  getTopSellingItems(restaurantId: string, limit: number, branchId?: string): Promise<any>;
  getOrdersByType(restaurantId: string, startDate: Date, endDate: Date, branchId?: string): Promise<any>;
  getHourlyOrderStats(restaurantId: string, date: Date, branchId?: string): Promise<any>;
  
  // Recipes
  getRecipes(menuItemId: string): Promise<Recipe[]>;
  getRecipesByRestaurant(restaurantId: string): Promise<Recipe[]>;
  createRecipe(data: InsertRecipe): Promise<Recipe>;
  updateRecipe(id: string, data: Partial<InsertRecipe>): Promise<Recipe | undefined>;
  deleteRecipe(id: string): Promise<void>;
  deleteRecipesByMenuItem(menuItemId: string): Promise<void>;
  
  // Printers
  getPrinters(restaurantId: string, branchId?: string): Promise<Printer[]>;
  getPrinter(id: string): Promise<Printer | undefined>;
  createPrinter(data: InsertPrinter): Promise<Printer>;
  updatePrinter(id: string, data: Partial<InsertPrinter>): Promise<Printer | undefined>;
  deletePrinter(id: string): Promise<void>;
  
  // User Authentication
  getUserByEmail(email: string): Promise<User | undefined>;
  updateUserLastLogin(id: string): Promise<void>;
  
  // Moyasar Merchants
  getMoyasarMerchant(restaurantId: string): Promise<MoyasarMerchant | undefined>;
  getMoyasarMerchantById(id: string): Promise<MoyasarMerchant | undefined>;
  getMoyasarMerchantByMoyasarId(moyasarId: string): Promise<MoyasarMerchant | undefined>;
  createMoyasarMerchant(data: InsertMoyasarMerchant): Promise<MoyasarMerchant>;
  updateMoyasarMerchant(id: string, data: Partial<InsertMoyasarMerchant>): Promise<MoyasarMerchant | undefined>;
  deleteMoyasarMerchant(id: string): Promise<void>;
  
  // Moyasar Documents
  getMoyasarDocuments(merchantId: string): Promise<MoyasarDocument[]>;
  getMoyasarDocument(id: string): Promise<MoyasarDocument | undefined>;
  getMoyasarDocumentByType(merchantId: string, documentType: string): Promise<MoyasarDocument | undefined>;
  createMoyasarDocument(data: InsertMoyasarDocument): Promise<MoyasarDocument>;
  updateMoyasarDocument(id: string, data: Partial<InsertMoyasarDocument>): Promise<MoyasarDocument | undefined>;
  deleteMoyasarDocument(id: string): Promise<void>;

  // Payment Transactions
  getPaymentTransactions(restaurantId: string, orderId?: string): Promise<PaymentTransaction[]>;
  getPaymentTransaction(id: string): Promise<PaymentTransaction | undefined>;
  getPaymentTransactionByMoyasarId(moyasarPaymentId: string): Promise<PaymentTransaction | undefined>;
  createPaymentTransaction(data: InsertPaymentTransaction): Promise<PaymentTransaction>;
  updatePaymentTransaction(id: string, data: Partial<InsertPaymentTransaction>): Promise<PaymentTransaction | undefined>;

  // Moyasar Invoices
  getMoyasarInvoices(restaurantId: string): Promise<MoyasarInvoice[]>;
  getMoyasarInvoice(id: string): Promise<MoyasarInvoice | undefined>;
  getMoyasarInvoiceByMoyasarId(moyasarInvoiceId: string): Promise<MoyasarInvoice | undefined>;
  createMoyasarInvoice(data: InsertMoyasarInvoice): Promise<MoyasarInvoice>;
  updateMoyasarInvoice(id: string, data: Partial<InsertMoyasarInvoice>): Promise<MoyasarInvoice | undefined>;

  // Apple Pay Domains
  getApplePayDomains(restaurantId: string): Promise<ApplePayDomain[]>;
  createApplePayDomain(data: InsertApplePayDomain): Promise<ApplePayDomain>;
  updateApplePayDomain(id: string, data: Partial<InsertApplePayDomain>): Promise<ApplePayDomain | undefined>;
  deleteApplePayDomain(id: string): Promise<void>;
  
  // ===============================
  // 1. RESERVATIONS - نظام الحجوزات
  // ===============================
  getReservations(restaurantId: string, branchId?: string, date?: Date): Promise<Reservation[]>;
  getReservation(id: string): Promise<Reservation | undefined>;
  createReservation(data: InsertReservation): Promise<Reservation>;
  checkTableConflict(restaurantId: string, tableId: string, date: Date, time: string, duration?: number, excludeId?: string): Promise<Reservation | undefined>;
  updateReservation(id: string, data: Partial<InsertReservation>): Promise<Reservation | undefined>;
  updateReservationStatus(id: string, status: string): Promise<Reservation | undefined>;
  deleteReservation(id: string): Promise<void>;
  getAvailableTimeSlots(restaurantId: string, branchId: string | undefined, date: Date): Promise<string[]>;
  findPaidDepositByPhone(restaurantId: string, customerPhone: string): Promise<Reservation | undefined>;
  markDepositApplied(reservationId: string, orderId: string): Promise<void>;
  
  // ===============================
  // 2. PROMOTIONS & COUPONS - العروض والكوبونات
  // ===============================
  getPromotions(restaurantId: string, activeOnly?: boolean, branchId?: string): Promise<Promotion[]>;
  getPromotion(id: string): Promise<Promotion | undefined>;
  createPromotion(data: InsertPromotion): Promise<Promotion>;
  updatePromotion(id: string, data: Partial<InsertPromotion>): Promise<Promotion | undefined>;
  deletePromotion(id: string): Promise<void>;
  
  getCoupons(restaurantId: string): Promise<Coupon[]>;
  getCoupon(id: string): Promise<Coupon | undefined>;
  getCouponByCode(restaurantId: string, code: string): Promise<Coupon | undefined>;
  createCoupon(data: InsertCoupon): Promise<Coupon>;
  updateCoupon(id: string, data: Partial<InsertCoupon>): Promise<Coupon | undefined>;
  deleteCoupon(id: string): Promise<void>;
  validateCoupon(restaurantId: string, code: string, orderTotal: number, customerPhone?: string): Promise<{ valid: boolean; coupon?: Coupon; error?: string }>;
  useCoupon(data: InsertCouponUsage): Promise<CouponUsage>;
  getCouponUsage(couponId: string): Promise<CouponUsage[]>;
  
  // ===============================
  // REVIEWS - التقييمات
  // ===============================
  getReviews(restaurantId: string): Promise<Review[]>;
  getReviewByOrder(orderId: string): Promise<Review | undefined>;
  createReview(data: InsertReview): Promise<Review>;
  getAverageRating(restaurantId: string): Promise<{ average: number; count: number }>;
  
  // ===============================
  // 3. MENU VARIANTS & CUSTOMIZATIONS - المتغيرات والتخصيصات
  // ===============================
  getMenuItemVariants(menuItemId: string): Promise<MenuItemVariant[]>;
  getMenuItemVariant(id: string): Promise<MenuItemVariant | undefined>;
  createMenuItemVariant(data: InsertMenuItemVariant): Promise<MenuItemVariant>;
  updateMenuItemVariant(id: string, data: Partial<InsertMenuItemVariant>): Promise<MenuItemVariant | undefined>;
  deleteMenuItemVariant(id: string): Promise<void>;
  
  getCustomizationGroups(restaurantId: string): Promise<CustomizationGroup[]>;
  getCustomizationGroup(id: string): Promise<CustomizationGroup | undefined>;
  createCustomizationGroup(data: InsertCustomizationGroup): Promise<CustomizationGroup>;
  updateCustomizationGroup(id: string, data: Partial<InsertCustomizationGroup>): Promise<CustomizationGroup | undefined>;
  deleteCustomizationGroup(id: string): Promise<void>;
  
  getCustomizationOptions(groupId: string): Promise<CustomizationOption[]>;
  getCustomizationOption(id: string): Promise<CustomizationOption | undefined>;
  createCustomizationOption(data: InsertCustomizationOption): Promise<CustomizationOption>;
  updateCustomizationOption(id: string, data: Partial<InsertCustomizationOption>): Promise<CustomizationOption | undefined>;
  deleteCustomizationOption(id: string): Promise<void>;
  
  getMenuItemCustomizations(menuItemId: string): Promise<(MenuItemCustomization & { group: CustomizationGroup; options: CustomizationOption[] })[]>;
  linkMenuItemCustomization(data: InsertMenuItemCustomization): Promise<MenuItemCustomization>;
  unlinkMenuItemCustomization(menuItemId: string, groupId: string): Promise<void>;
  
  createOrderItemCustomization(data: InsertOrderItemCustomization): Promise<OrderItemCustomization>;
  getOrderItemCustomizations(orderItemId: string): Promise<OrderItemCustomization[]>;
  
  // ===============================
  // 4. QUEUE MANAGEMENT - نظام الطابور
  // ===============================
  getQueueEntries(restaurantId: string, branchId?: string, status?: string): Promise<QueueEntry[]>;
  getQueueEntry(id: string): Promise<QueueEntry | undefined>;
  createQueueEntry(data: InsertQueueEntry): Promise<QueueEntry>;
  updateQueueEntry(id: string, data: Partial<InsertQueueEntry>): Promise<QueueEntry | undefined>;
  updateQueueStatus(id: string, status: string): Promise<QueueEntry | undefined>;
  deleteQueueEntry(id: string): Promise<void>;
  getNextQueueNumber(restaurantId: string, branchId?: string): Promise<number>;
  getQueuePosition(id: string): Promise<number>;
  getEstimatedWaitTime(restaurantId: string, branchId?: string): Promise<number>;
  
  // ===============================
  // 5. DAY SESSIONS - إدارة اليوم
  // ===============================
  getDaySessions(restaurantId: string, branchId?: string): Promise<DaySession[]>;
  getCurrentDaySession(restaurantId: string, branchId?: string): Promise<DaySession | undefined>;
  getDaySession(id: string): Promise<DaySession | undefined>;
  openDaySession(data: InsertDaySession): Promise<DaySession>;
  closeDaySession(id: string, closingData: { closedBy?: string; closingBalance?: string; notes?: string }): Promise<DaySession | undefined>;
  updateDaySession(id: string, data: Partial<InsertDaySession>): Promise<DaySession | undefined>;
  incrementDaySessionTotals(id: string, orderTotal: number, paymentMethod: string): Promise<void>;
  
  getCashTransactions(sessionId: string): Promise<CashTransaction[]>;
  createCashTransaction(data: InsertCashTransaction): Promise<CashTransaction>;
  
  // ===============================
  // 6. NOTIFICATIONS - الإشعارات
  // ===============================
  getNotifications(restaurantId: string, branchId?: string, unreadOnly?: boolean): Promise<Notification[]>;
  getNotification(id: string): Promise<Notification | undefined>;
  createNotification(data: InsertNotification): Promise<Notification>;
  markNotificationAsRead(id: string, readBy?: string): Promise<Notification | undefined>;
  markAllNotificationsAsRead(restaurantId: string, branchId?: string): Promise<void>;
  deleteNotification(id: string): Promise<void>;
  deleteOldNotifications(days: number): Promise<void>;
  
  getNotificationSettings(restaurantId: string, branchId?: string): Promise<NotificationSettings | undefined>;
  updateNotificationSettings(restaurantId: string, branchId: string | undefined, data: Partial<InsertNotificationSettings>): Promise<NotificationSettings>;

  // Order Audit Log
  // ===============================
  createOrderAuditLog(data: any): Promise<any>;
  getOrderAuditLog(orderId: string): Promise<any[]>;
}

export class DatabaseStorage implements IStorage {
  // Restaurant
  async getRestaurant(): Promise<Restaurant | undefined> {
    const [restaurant] = await db.select().from(restaurants).limit(1);
    return restaurant;
  }

  async getRestaurantById(id: string): Promise<Restaurant | undefined> {
    const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.id, id)).limit(1);
    return restaurant;
  }

  async getRestaurantBySlug(slug: string): Promise<Restaurant | undefined> {
    const [restaurant] = await db.select().from(restaurants).where(eq(restaurants.slug, slug)).limit(1);
    return restaurant;
  }

  async resolveRestaurantId(idOrSlug: string): Promise<string | null> {
    // Try by slug first (more common in URLs)
    try {
      const bySlug = await this.getRestaurantBySlug(idOrSlug);
      if (bySlug) return bySlug.id;
    } catch (e: any) {
      // slug lookup failed, try by ID
    }
    // Then try by ID
    try {
      const byId = await this.getRestaurantById(idOrSlug);
      if (byId) return byId.id;
    } catch (e: any) {
      // id lookup failed
    }
    return null;
  }

  private generateSlug(name: string): string {
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+/g, '') // strip Arabic
      .replace(/[^a-z0-9\s-]/g, '') // keep only English letters, numbers, spaces, hyphens
      .replace(/\s+/g, '-') // spaces to hyphens
      .replace(/-+/g, '-') // collapse multiple hyphens
      .replace(/^-|-$/g, ''); // trim hyphens
    // If nothing left (pure Arabic name), return empty so caller generates fallback
    return slug;
  }

  async createRestaurant(data: InsertRestaurant): Promise<Restaurant> {
    // Auto-generate slug from restaurant name if not provided
    if (!data.slug) {
      const baseName = data.nameEn || data.nameAr || 'restaurant';
      let slug = this.generateSlug(baseName);
      if (!slug) slug = 'r-' + Math.random().toString(36).substring(2, 8);
      // Ensure uniqueness by appending random suffix if needed
      const existing = await this.getRestaurantBySlug(slug);
      if (existing) {
        slug = `${slug}-${Math.random().toString(36).substring(2, 6)}`;
      }
      data = { ...data, slug };
    }
    const [restaurant] = await db.insert(restaurants).values(data).returning();
    return restaurant;
  }

  async updateRestaurant(data: InsertRestaurant): Promise<Restaurant | undefined> {
    const existing = await this.getRestaurant();
    if (!existing) {
      return this.createRestaurant(data);
    }
    const [updated] = await db.update(restaurants)
      .set(data)
      .where(eq(restaurants.id, existing.id))
      .returning();
    return updated;
  }

  async updateRestaurantById(id: string, data: Partial<InsertRestaurant>): Promise<Restaurant | undefined> {
    const [updated] = await db.update(restaurants)
      .set(data)
      .where(eq(restaurants.id, id))
      .returning();
    return updated;
  }

  // Categories
  async getCategories(restaurantId: string): Promise<Category[]> {
    return db.select().from(categories).where(eq(categories.restaurantId, restaurantId));
  }

  async getCategory(id: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.id, id));
    return category;
  }

  async createCategory(data: InsertCategory): Promise<Category> {
    const [category] = await db.insert(categories).values(data).returning();
    return category;
  }

  async updateCategory(id: string, data: InsertCategory): Promise<Category | undefined> {
    const [updated] = await db.update(categories)
      .set(data)
      .where(eq(categories.id, id))
      .returning();
    return updated;
  }

  async deleteCategory(id: string): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
  }

  // Kitchen Sections
  async getKitchenSections(restaurantId: string, branchId?: string): Promise<KitchenSection[]> {
    if (branchId) {
      return db.select().from(kitchenSections)
        .where(and(
          eq(kitchenSections.restaurantId, restaurantId),
          or(
            eq(kitchenSections.branchId, branchId),
            isNull(kitchenSections.branchId)
          )
        ))
        .orderBy(asc(kitchenSections.sortOrder));
    }
    return db.select().from(kitchenSections)
      .where(eq(kitchenSections.restaurantId, restaurantId))
      .orderBy(asc(kitchenSections.sortOrder));
  }

  async getKitchenSection(id: string): Promise<KitchenSection | undefined> {
    const [section] = await db.select().from(kitchenSections).where(eq(kitchenSections.id, id));
    return section;
  }

  async createKitchenSection(data: InsertKitchenSection): Promise<KitchenSection> {
    const [section] = await db.insert(kitchenSections).values(data).returning();
    return section;
  }

  async updateKitchenSection(id: string, data: InsertKitchenSection): Promise<KitchenSection | undefined> {
    const [updated] = await db.update(kitchenSections)
      .set(data)
      .where(eq(kitchenSections.id, id))
      .returning();
    return updated;
  }

  async deleteKitchenSection(id: string): Promise<void> {
    await db.delete(kitchenSections).where(eq(kitchenSections.id, id));
  }

  // Menu Items
  async getMenuItems(restaurantId: string): Promise<MenuItem[]> {
    return db.select().from(menuItems).where(eq(menuItems.restaurantId, restaurantId));
  }

  async getMenuItem(id: string): Promise<MenuItem | undefined> {
    const [item] = await db.select().from(menuItems).where(eq(menuItems.id, id));
    return item;
  }

  async createMenuItem(data: InsertMenuItem): Promise<MenuItem> {
    const [item] = await db.insert(menuItems).values(data).returning();
    return item;
  }

  async updateMenuItem(id: string, data: InsertMenuItem): Promise<MenuItem | undefined> {
    const [updated] = await db.update(menuItems)
      .set(data)
      .where(eq(menuItems.id, id))
      .returning();
    return updated;
  }

  async deleteMenuItem(id: string): Promise<void> {
    await db.delete(menuItems).where(eq(menuItems.id, id));
  }

  // Tables
  async getTables(restaurantId: string, branchId?: string): Promise<Table[]> {
    if (branchId) {
      return db.select().from(tables).where(
        sql`${tables.restaurantId} = ${restaurantId} AND ${tables.branchId} = ${branchId}`
      );
    }
    return db.select().from(tables).where(eq(tables.restaurantId, restaurantId));
  }

  async getTable(id: string): Promise<Table | undefined> {
    const [table] = await db.select().from(tables).where(eq(tables.id, id));
    return table;
  }

  async createTable(data: InsertTable): Promise<Table> {
    const [table] = await db.insert(tables).values(data).returning();
    return table;
  }

  async updateTable(id: string, data: InsertTable): Promise<Table | undefined> {
    const [updated] = await db.update(tables)
      .set(data)
      .where(eq(tables.id, id))
      .returning();
    return updated;
  }

  async updateTableStatus(id: string, status: string): Promise<Table | undefined> {
    const [updated] = await db.update(tables)
      .set({ status })
      .where(eq(tables.id, id))
      .returning();
    return updated;
  }

  async deleteTable(id: string): Promise<void> {
    await db.delete(tables).where(eq(tables.id, id));
  }

  // Orders
  async getOrders(restaurantId: string, branchId?: string): Promise<Order[]> {
    if (branchId) {
      return db.select().from(orders)
        .where(sql`${orders.restaurantId} = ${restaurantId} AND (${orders.branchId} = ${branchId} OR ${orders.branchId} IS NULL)`)
        .orderBy(desc(orders.createdAt));
    }
    return db.select().from(orders)
      .where(eq(orders.restaurantId, restaurantId))
      .orderBy(desc(orders.createdAt));
  }

  async getOrder(id: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    return order;
  }

  async getActiveOrderByTable(tableId: string): Promise<Order | undefined> {
    const [order] = await db.select().from(orders)
      .where(sql`${orders.tableId} = ${tableId} AND ${orders.status} NOT IN ('completed', 'cancelled') AND (${orders.isPaid} = false OR ${orders.isPaid} IS NULL)`)
      .orderBy(desc(orders.createdAt))
      .limit(1);
    return order;
  }

  async createOrder(data: InsertOrder): Promise<Order> {
    // Generate server-side unique order number (atomic counter)
    const today = new Date();
    const datePrefix = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    
    // Count existing orders for this restaurant today to get sequence number
    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(orders)
      .where(sql`${orders.restaurantId} = ${data.restaurantId} AND ${orders.createdAt}::date = CURRENT_DATE`);
    
    const seq = (Number(countResult?.count) || 0) + 1;
    const orderNumber = `ORD-${datePrefix}-${String(seq).padStart(4, '0')}`;
    
    const [order] = await db.insert(orders).values({
      ...data,
      orderNumber,
    }).returning();
    return order;
  }

  async updateOrder(id: string, data: Partial<InsertOrder>): Promise<Order | undefined> {
    const [updated] = await db.update(orders)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return updated;
  }

  async updateOrderStatus(id: string, status: string): Promise<Order | undefined> {
    const [updated] = await db.update(orders)
      .set({ status, updatedAt: new Date() })
      .where(eq(orders.id, id))
      .returning();
    return updated;
  }

  async deleteOrder(id: string): Promise<void> {
    await db.delete(orders).where(eq(orders.id, id));
  }

  // Order Items
  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    return db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  }

  async createOrderItem(data: InsertOrderItem): Promise<OrderItem> {
    const [item] = await db.insert(orderItems).values(data).returning();
    return item;
  }

  async deleteOrderItem(id: string): Promise<void> {
    await db.delete(orderItems).where(eq(orderItems.id, id));
  }

  // Invoices
  async getInvoices(restaurantId: string): Promise<Invoice[]> {
    return db.select().from(invoices)
      .where(eq(invoices.restaurantId, restaurantId))
      .orderBy(desc(invoices.createdAt));
  }

  async getInvoice(id: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    return invoice;
  }

  async getInvoiceByOrder(orderId: string): Promise<Invoice | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.orderId, orderId));
    return invoice;
  }

  async createInvoice(data: InsertInvoice): Promise<Invoice> {
    const [invoice] = await db.insert(invoices).values(data).returning();
    return invoice;
  }

  async updateInvoice(id: string, data: Partial<InsertInvoice>): Promise<Invoice | undefined> {
    const [updated] = await db.update(invoices)
      .set(data)
      .where(eq(invoices.id, id))
      .returning();
    return updated;
  }

  async getNextInvoiceNumber(restaurantId: string): Promise<string> {
    // Use MAX to find the highest invoice number and increment, avoiding race conditions
    const year = new Date().getFullYear();
    const prefix = `INV-${year}-`;
    const result = await db.select({ 
      maxNum: sql<string>`MAX(CASE WHEN ${invoices.invoiceNumber} LIKE ${prefix + '%'} THEN SUBSTRING(${invoices.invoiceNumber} FROM ${prefix.length + 1})::int ELSE 0 END)` 
    })
      .from(invoices)
      .where(eq(invoices.restaurantId, restaurantId));
    const maxNum = Number(result[0]?.maxNum) || 0;
    const nextNumber = maxNum + 1;
    return `${prefix}${nextNumber.toString().padStart(6, '0')}`;
  }

  // Branches
  async getBranches(restaurantId: string): Promise<Branch[]> {
    return db.select().from(branches).where(eq(branches.restaurantId, restaurantId));
  }

  async getBranch(id: string): Promise<Branch | undefined> {
    const [branch] = await db.select().from(branches).where(eq(branches.id, id));
    return branch;
  }

  async getBranchBySlug(restaurantId: string, slug: string): Promise<Branch | undefined> {
    const [branch] = await db.select().from(branches)
      .where(and(eq(branches.restaurantId, restaurantId), eq(branches.slug, slug)))
      .limit(1);
    return branch;
  }

  async resolveBranchId(restaurantId: string, idOrSlug: string): Promise<string | null> {
    // Try by slug first
    try {
      const bySlug = await this.getBranchBySlug(restaurantId, idOrSlug);
      if (bySlug) return bySlug.id;
    } catch (e) { /* ignore */ }
    // Then try by ID
    try {
      const byId = await this.getBranch(idOrSlug);
      if (byId && byId.restaurantId === restaurantId) return byId.id;
    } catch (e) { /* ignore */ }
    return null;
  }

  async createBranch(data: InsertBranch): Promise<Branch> {
    // Auto-generate slug from branch name if not provided
    if (!data.slug) {
      const baseName = data.name || 'branch';
      let slug = this.generateSlug(baseName);
      if (!slug) slug = 'b-' + Math.random().toString(36).substring(2, 8);
      // Check uniqueness within this restaurant
      const existing = await this.getBranchBySlug(data.restaurantId, slug);
      if (existing) {
        slug = `${slug}-${Math.random().toString(36).substring(2, 6)}`;
      }
      data = { ...data, slug };
    }
    const [branch] = await db.insert(branches).values(data).returning();
    return branch;
  }

  async updateBranch(id: string, data: Partial<InsertBranch>): Promise<Branch | undefined> {
    const [updated] = await db.update(branches)
      .set(data)
      .where(eq(branches.id, id))
      .returning();
    return updated;
  }

  async deleteBranch(id: string): Promise<void> {
    await db.delete(branches).where(eq(branches.id, id));
  }

  // Users
  async getUsers(restaurantId: string): Promise<User[]> {
    return db.select().from(users).where(eq(users.restaurantId, restaurantId));
  }

  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async createUser(data: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(data).returning();
    return user;
  }

  async updateUser(id: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const [updated] = await db.update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  async getCustomers(restaurantId: string): Promise<Customer[]> {
    return db.select().from(customers)
      .where(eq(customers.restaurantId, restaurantId))
      .orderBy(desc(customers.createdAt));
  }

  async getCustomer(id: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(eq(customers.id, id));
    return customer;
  }

  async getCustomerByPhone(restaurantId: string, phone: string): Promise<Customer | undefined> {
    const [customer] = await db.select().from(customers).where(
      and(eq(customers.restaurantId, restaurantId), eq(customers.phone, phone))
    );
    return customer;
  }

  async createCustomer(data: InsertCustomer): Promise<Customer> {
    const [customer] = await db.insert(customers).values(data).returning();
    return customer;
  }

  async updateCustomer(id: string, data: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const [updated] = await db.update(customers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(customers.id, id))
      .returning();
    return updated;
  }

  async deleteCustomer(id: string): Promise<void> {
    await db.delete(customers).where(eq(customers.id, id));
  }

  // Inventory Items
  async getInventoryItems(restaurantId: string, branchId?: string): Promise<InventoryItem[]> {
    if (branchId) {
      return db.select().from(inventoryItems).where(
        sql`${inventoryItems.restaurantId} = ${restaurantId} AND ${inventoryItems.branchId} = ${branchId}`
      );
    }
    return db.select().from(inventoryItems).where(eq(inventoryItems.restaurantId, restaurantId));
  }

  async getInventoryItem(id: string): Promise<InventoryItem | undefined> {
    const [item] = await db.select().from(inventoryItems).where(eq(inventoryItems.id, id));
    return item;
  }

  async createInventoryItem(data: InsertInventoryItem): Promise<InventoryItem> {
    const [item] = await db.insert(inventoryItems).values(data).returning();
    return item;
  }

  async updateInventoryItem(id: string, data: Partial<InsertInventoryItem>): Promise<InventoryItem | undefined> {
    const [updated] = await db.update(inventoryItems)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(inventoryItems.id, id))
      .returning();
    return updated;
  }

  async deleteInventoryItem(id: string): Promise<void> {
    await db.delete(inventoryTransactions).where(eq(inventoryTransactions.inventoryItemId, id));
    await db.delete(inventoryItems).where(eq(inventoryItems.id, id));
  }

  // Inventory Transactions
  async getInventoryTransactions(itemId: string): Promise<InventoryTransaction[]> {
    return db.select().from(inventoryTransactions)
      .where(eq(inventoryTransactions.inventoryItemId, itemId))
      .orderBy(desc(inventoryTransactions.createdAt));
  }

  async createInventoryTransaction(data: InsertInventoryTransaction): Promise<InventoryTransaction> {
    const [transaction] = await db.insert(inventoryTransactions).values(data).returning();
    
    // Update current stock
    const item = await this.getInventoryItem(data.inventoryItemId);
    if (item) {
      const currentStock = parseFloat(item.currentStock || "0");
      const quantity = parseFloat(data.quantity);
      let newStock = currentStock;
      
      if (data.type === "purchase" || data.type === "return") {
        newStock = currentStock + quantity;
      } else if (data.type === "usage" || data.type === "waste") {
        newStock = currentStock - quantity;
      } else if (data.type === "adjustment") {
        newStock = quantity; // Direct set
      }
      
      await this.updateInventoryItem(data.inventoryItemId, { currentStock: newStock.toString() });
    }
    
    return transaction;
  }

  // Reports
  async getSalesReport(restaurantId: string, startDate: Date, endDate: Date, branchId?: string): Promise<any> {
    let query = sql`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as order_count,
        SUM(CAST(total as DECIMAL)) as total_sales,
        SUM(CAST(tax as DECIMAL)) as total_tax,
        SUM(CAST(discount as DECIMAL)) as total_discount
      FROM orders 
      WHERE restaurant_id = ${restaurantId}
        AND created_at >= ${startDate}
        AND created_at <= ${endDate}
        AND status NOT IN ('cancelled', 'refunded')
    `;
    
    if (branchId) {
      query = sql`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as order_count,
          SUM(CAST(total as DECIMAL)) as total_sales,
          SUM(CAST(tax as DECIMAL)) as total_tax,
          SUM(CAST(discount as DECIMAL)) as total_discount
        FROM orders 
        WHERE restaurant_id = ${restaurantId}
          AND branch_id = ${branchId}
          AND created_at >= ${startDate}
          AND created_at <= ${endDate}
          AND status NOT IN ('cancelled', 'refunded')
        GROUP BY DATE(created_at)
        ORDER BY date
      `;
    } else {
      query = sql`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as order_count,
          SUM(CAST(total as DECIMAL)) as total_sales,
          SUM(CAST(tax as DECIMAL)) as total_tax,
          SUM(CAST(discount as DECIMAL)) as total_discount
        FROM orders 
        WHERE restaurant_id = ${restaurantId}
          AND created_at >= ${startDate}
          AND created_at <= ${endDate}
          AND status NOT IN ('cancelled', 'refunded')
        GROUP BY DATE(created_at)
        ORDER BY date
      `;
    }
    
    const result = await db.execute(query);
    return result.rows;
  }

  async getTopSellingItems(restaurantId: string, limit: number, branchId?: string): Promise<any> {
    let query;
    if (branchId) {
      query = sql`
        SELECT 
          mi.id,
          mi.name_en,
          mi.name_ar,
          SUM(oi.quantity) as total_quantity,
          SUM(CAST(oi.total_price as DECIMAL)) as total_revenue
        FROM order_items oi
        JOIN menu_items mi ON oi.menu_item_id = mi.id
        JOIN orders o ON oi.order_id = o.id
        WHERE o.restaurant_id = ${restaurantId}
          AND o.branch_id = ${branchId}
          AND o.status NOT IN ('cancelled', 'refunded')
        GROUP BY mi.id, mi.name_en, mi.name_ar
        ORDER BY total_quantity DESC
        LIMIT ${limit}
      `;
    } else {
      query = sql`
        SELECT 
          mi.id,
          mi.name_en,
          mi.name_ar,
          SUM(oi.quantity) as total_quantity,
          SUM(CAST(oi.total_price as DECIMAL)) as total_revenue
        FROM order_items oi
        JOIN menu_items mi ON oi.menu_item_id = mi.id
        JOIN orders o ON oi.order_id = o.id
        WHERE o.restaurant_id = ${restaurantId}
          AND o.status NOT IN ('cancelled', 'refunded')
        GROUP BY mi.id, mi.name_en, mi.name_ar
        ORDER BY total_quantity DESC
        LIMIT ${limit}
      `;
    }
    
    const result = await db.execute(query);
    return result.rows;
  }

  async getOrdersByType(restaurantId: string, startDate: Date, endDate: Date, branchId?: string): Promise<any> {
    let query;
    if (branchId) {
      query = sql`
        SELECT 
          order_type,
          COUNT(*) as count,
          SUM(CAST(total as DECIMAL)) as total_revenue
        FROM orders 
        WHERE restaurant_id = ${restaurantId}
          AND branch_id = ${branchId}
          AND created_at >= ${startDate}
          AND created_at <= ${endDate}
          AND status NOT IN ('cancelled', 'refunded')
        GROUP BY order_type
      `;
    } else {
      query = sql`
        SELECT 
          order_type,
          COUNT(*) as count,
          SUM(CAST(total as DECIMAL)) as total_revenue
        FROM orders 
        WHERE restaurant_id = ${restaurantId}
          AND created_at >= ${startDate}
          AND created_at <= ${endDate}
          AND status NOT IN ('cancelled', 'refunded')
        GROUP BY order_type
      `;
    }
    
    const result = await db.execute(query);
    return result.rows;
  }

  async getHourlyOrderStats(restaurantId: string, date: Date, branchId?: string): Promise<any> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    let query;
    if (branchId) {
      query = sql`
        SELECT 
          EXTRACT(HOUR FROM created_at) as hour,
          COUNT(*) as order_count,
          SUM(CAST(total as DECIMAL)) as total_sales
        FROM orders 
        WHERE restaurant_id = ${restaurantId}
          AND branch_id = ${branchId}
          AND created_at >= ${startOfDay}
          AND created_at <= ${endOfDay}
          AND status NOT IN ('cancelled', 'refunded')
        GROUP BY EXTRACT(HOUR FROM created_at)
        ORDER BY hour
      `;
    } else {
      query = sql`
        SELECT 
          EXTRACT(HOUR FROM created_at) as hour,
          COUNT(*) as order_count,
          SUM(CAST(total as DECIMAL)) as total_sales
        FROM orders 
        WHERE restaurant_id = ${restaurantId}
          AND created_at >= ${startOfDay}
          AND created_at <= ${endOfDay}
          AND status NOT IN ('cancelled', 'refunded')
        GROUP BY EXTRACT(HOUR FROM created_at)
        ORDER BY hour
      `;
    }
    
    const result = await db.execute(query);
    return result.rows;
  }

  // Recipes
  async getRecipes(menuItemId: string): Promise<Recipe[]> {
    return db.select().from(recipes).where(eq(recipes.menuItemId, menuItemId));
  }

  async getRecipesByRestaurant(restaurantId: string): Promise<Recipe[]> {
    return db.select().from(recipes).where(eq(recipes.restaurantId, restaurantId));
  }

  async createRecipe(data: InsertRecipe): Promise<Recipe> {
    const [recipe] = await db.insert(recipes).values(data).returning();
    return recipe;
  }

  async updateRecipe(id: string, data: Partial<InsertRecipe>): Promise<Recipe | undefined> {
    const [updated] = await db.update(recipes)
      .set(data)
      .where(eq(recipes.id, id))
      .returning();
    return updated;
  }

  async deleteRecipe(id: string): Promise<void> {
    await db.delete(recipes).where(eq(recipes.id, id));
  }

  async deleteRecipesByMenuItem(menuItemId: string): Promise<void> {
    await db.delete(recipes).where(eq(recipes.menuItemId, menuItemId));
  }

  // Printers
  async getPrinters(restaurantId: string, branchId?: string): Promise<Printer[]> {
    if (branchId) {
      return db.select().from(printers)
        .where(and(eq(printers.restaurantId, restaurantId), eq(printers.branchId, branchId)));
    }
    return db.select().from(printers).where(eq(printers.restaurantId, restaurantId));
  }

  async getPrinter(id: string): Promise<Printer | undefined> {
    const [printer] = await db.select().from(printers).where(eq(printers.id, id));
    return printer;
  }

  async createPrinter(data: InsertPrinter): Promise<Printer> {
    const [printer] = await db.insert(printers).values(data).returning();
    return printer;
  }

  async updatePrinter(id: string, data: Partial<InsertPrinter>): Promise<Printer | undefined> {
    const [updated] = await db.update(printers)
      .set(data)
      .where(eq(printers.id, id))
      .returning();
    return updated;
  }

  async deletePrinter(id: string): Promise<void> {
    await db.delete(printers).where(eq(printers.id, id));
  }

  // User Authentication
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async updateUserLastLogin(id: string): Promise<void> {
    await db.update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, id));
  }

  async getAllRestaurants(): Promise<Restaurant[]> {
    return await db.select().from(restaurants).orderBy(desc(restaurants.createdAt));
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async getOrdersByRestaurant(restaurantId: string): Promise<Order[]> {
    return await db.select().from(orders).where(eq(orders.restaurantId, restaurantId)).orderBy(desc(orders.createdAt));
  }
  
  // Moyasar Merchants
  async getMoyasarMerchant(restaurantId: string): Promise<MoyasarMerchant | undefined> {
    const [merchant] = await db.select().from(moyasarMerchants).where(eq(moyasarMerchants.restaurantId, restaurantId));
    return merchant;
  }

  async getMoyasarMerchantById(id: string): Promise<MoyasarMerchant | undefined> {
    const [merchant] = await db.select().from(moyasarMerchants).where(eq(moyasarMerchants.id, id));
    return merchant;
  }

  async getMoyasarMerchantByMoyasarId(moyasarId: string): Promise<MoyasarMerchant | undefined> {
    const [merchant] = await db.select().from(moyasarMerchants).where(eq(moyasarMerchants.moyasarMerchantId, moyasarId));
    return merchant;
  }

  async createMoyasarMerchant(data: InsertMoyasarMerchant): Promise<MoyasarMerchant> {
    const [merchant] = await db.insert(moyasarMerchants).values(data as any).returning();
    return merchant;
  }

  async updateMoyasarMerchant(id: string, data: Partial<InsertMoyasarMerchant>): Promise<MoyasarMerchant | undefined> {
    const [updated] = await db.update(moyasarMerchants)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(moyasarMerchants.id, id))
      .returning();
    return updated;
  }

  async deleteMoyasarMerchant(id: string): Promise<void> {
    // First delete associated documents
    await db.delete(moyasarDocuments).where(eq(moyasarDocuments.merchantId, id));
    await db.delete(moyasarMerchants).where(eq(moyasarMerchants.id, id));
  }

  // Moyasar Documents
  async getMoyasarDocuments(merchantId: string): Promise<MoyasarDocument[]> {
    return db.select().from(moyasarDocuments).where(eq(moyasarDocuments.merchantId, merchantId));
  }

  async getMoyasarDocument(id: string): Promise<MoyasarDocument | undefined> {
    const [doc] = await db.select().from(moyasarDocuments).where(eq(moyasarDocuments.id, id));
    return doc;
  }

  async getMoyasarDocumentByType(merchantId: string, documentType: string): Promise<MoyasarDocument | undefined> {
    const [doc] = await db.select().from(moyasarDocuments).where(
      and(eq(moyasarDocuments.merchantId, merchantId), eq(moyasarDocuments.documentType, documentType))
    );
    return doc;
  }

  async createMoyasarDocument(data: InsertMoyasarDocument): Promise<MoyasarDocument> {
    const [doc] = await db.insert(moyasarDocuments).values(data as any).returning();
    return doc;
  }

  async updateMoyasarDocument(id: string, data: Partial<InsertMoyasarDocument>): Promise<MoyasarDocument | undefined> {
    const [updated] = await db.update(moyasarDocuments)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(moyasarDocuments.id, id))
      .returning();
    return updated;
  }

  async deleteMoyasarDocument(id: string): Promise<void> {
    await db.delete(moyasarDocuments).where(eq(moyasarDocuments.id, id));
  }

  // Payment Transactions
  async getPaymentTransactions(restaurantId: string, orderId?: string): Promise<PaymentTransaction[]> {
    let conditions = [eq(paymentTransactions.restaurantId, restaurantId)];
    if (orderId) {
      conditions.push(eq(paymentTransactions.orderId, orderId));
    }
    return db.select().from(paymentTransactions).where(and(...conditions)).orderBy(desc(paymentTransactions.createdAt));
  }

  async getPaymentTransaction(id: string): Promise<PaymentTransaction | undefined> {
    const [tx] = await db.select().from(paymentTransactions).where(eq(paymentTransactions.id, id));
    return tx;
  }

  async getPaymentTransactionByMoyasarId(moyasarPaymentId: string): Promise<PaymentTransaction | undefined> {
    const [tx] = await db.select().from(paymentTransactions).where(eq(paymentTransactions.moyasarPaymentId, moyasarPaymentId));
    return tx;
  }

  async createPaymentTransaction(data: InsertPaymentTransaction): Promise<PaymentTransaction> {
    const [tx] = await db.insert(paymentTransactions).values(data as any).returning();
    return tx;
  }

  async updatePaymentTransaction(id: string, data: Partial<InsertPaymentTransaction>): Promise<PaymentTransaction | undefined> {
    const [updated] = await db.update(paymentTransactions)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(paymentTransactions.id, id))
      .returning();
    return updated;
  }

  // Moyasar Invoices
  async getMoyasarInvoices(restaurantId: string): Promise<MoyasarInvoice[]> {
    return db.select().from(moyasarInvoices).where(eq(moyasarInvoices.restaurantId, restaurantId)).orderBy(desc(moyasarInvoices.createdAt));
  }

  async getMoyasarInvoice(id: string): Promise<MoyasarInvoice | undefined> {
    const [inv] = await db.select().from(moyasarInvoices).where(eq(moyasarInvoices.id, id));
    return inv;
  }

  async getMoyasarInvoiceByMoyasarId(moyasarInvoiceId: string): Promise<MoyasarInvoice | undefined> {
    const [inv] = await db.select().from(moyasarInvoices).where(eq(moyasarInvoices.moyasarInvoiceId, moyasarInvoiceId));
    return inv;
  }

  async createMoyasarInvoice(data: InsertMoyasarInvoice): Promise<MoyasarInvoice> {
    const [inv] = await db.insert(moyasarInvoices).values(data as any).returning();
    return inv;
  }

  async updateMoyasarInvoice(id: string, data: Partial<InsertMoyasarInvoice>): Promise<MoyasarInvoice | undefined> {
    const [updated] = await db.update(moyasarInvoices)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(moyasarInvoices.id, id))
      .returning();
    return updated;
  }

  // Apple Pay Domains
  async getApplePayDomains(restaurantId: string): Promise<ApplePayDomain[]> {
    return db.select().from(applePayDomains).where(eq(applePayDomains.restaurantId, restaurantId));
  }

  async createApplePayDomain(data: InsertApplePayDomain): Promise<ApplePayDomain> {
    const [domain] = await db.insert(applePayDomains).values(data as any).returning();
    return domain;
  }

  async updateApplePayDomain(id: string, data: Partial<InsertApplePayDomain>): Promise<ApplePayDomain | undefined> {
    const [updated] = await db.update(applePayDomains)
      .set(data as any)
      .where(eq(applePayDomains.id, id))
      .returning();
    return updated;
  }

  async deleteApplePayDomain(id: string): Promise<void> {
    await db.delete(applePayDomains).where(eq(applePayDomains.id, id));
  }

  // ===============================
  // 1. RESERVATIONS - نظام الحجوزات
  // ===============================
  async getReservations(restaurantId: string, branchId?: string, date?: Date): Promise<Reservation[]> {
    let conditions = [eq(reservations.restaurantId, restaurantId)];
    if (branchId) {
      conditions.push(eq(reservations.branchId, branchId));
    }
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      conditions.push(gte(reservations.reservationDate, startOfDay));
      conditions.push(lte(reservations.reservationDate, endOfDay));
    }
    return db.select().from(reservations).where(and(...conditions)).orderBy(reservations.reservationDate);
  }

  async getReservation(id: string): Promise<Reservation | undefined> {
    const [reservation] = await db.select().from(reservations).where(eq(reservations.id, id));
    return reservation;
  }

  async createReservation(data: InsertReservation): Promise<Reservation> {
    const [reservation] = await db.insert(reservations).values(data as any).returning();
    return reservation;
  }

  async checkTableConflict(restaurantId: string, tableId: string, date: Date, time: string, duration: number = 90, excludeId?: string): Promise<Reservation | undefined> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    let conditions = [
      eq(reservations.restaurantId, restaurantId),
      eq(reservations.tableId, tableId),
      gte(reservations.reservationDate, startOfDay),
      lte(reservations.reservationDate, endOfDay),
    ];

    const existingReservations = await db.select().from(reservations).where(and(...conditions));
    
    // Parse requested time
    const [reqHour, reqMin] = time.split(":").map(Number);
    const reqStart = reqHour * 60 + reqMin;
    const reqEnd = reqStart + duration;
    
    // Check overlap with each existing reservation
    for (const r of existingReservations) {
      // Skip cancelled/no_show and the reservation being edited
      if (r.status === "cancelled" || r.status === "no_show") continue;
      if (excludeId && r.id === excludeId) continue;
      
      const [eHour, eMin] = r.reservationTime.split(":").map(Number);
      const eStart = eHour * 60 + eMin;
      const eEnd = eStart + (r.duration || 90);
      
      // Check time overlap
      if (reqStart < eEnd && reqEnd > eStart) {
        return r; // Conflict found
      }
    }
    return undefined; // No conflict
  }

  async updateReservation(id: string, data: Partial<InsertReservation>): Promise<Reservation | undefined> {
    const [updated] = await db.update(reservations)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(reservations.id, id))
      .returning();
    return updated;
  }

  async updateReservationStatus(id: string, status: string): Promise<Reservation | undefined> {
    const [updated] = await db.update(reservations)
      .set({ status, updatedAt: new Date() })
      .where(eq(reservations.id, id))
      .returning();
    return updated;
  }

  async deleteReservation(id: string): Promise<void> {
    await db.delete(reservations).where(eq(reservations.id, id));
  }

  async getAvailableTimeSlots(restaurantId: string, branchId: string | undefined, date: Date): Promise<string[]> {
    // Get all reservations for the date
    const existingReservations = await this.getReservations(restaurantId, branchId, date);
    const bookedTimes = new Set(existingReservations.map(r => r.reservationTime));
    
    // Generate time slots from 10:00 to 22:00
    const allSlots: string[] = [];
    for (let hour = 10; hour <= 22; hour++) {
      for (let min = 0; min < 60; min += 30) {
        const time = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
        if (!bookedTimes.has(time)) {
          allSlots.push(time);
        }
      }
    }
    return allSlots;
  }

  async findPaidDepositByPhone(restaurantId: string, customerPhone: string): Promise<Reservation | undefined> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [reservation] = await db.select().from(reservations).where(
      and(
        eq(reservations.restaurantId, restaurantId),
        eq(reservations.customerPhone, customerPhone),
        eq(reservations.depositPaid, true),
        sql`${reservations.depositAppliedToOrder} IS NULL`,
        gte(reservations.reservationDate, today)
      )
    ).orderBy(desc(reservations.createdAt)).limit(1);
    return reservation;
  }

  async markDepositApplied(reservationId: string, orderId: string): Promise<void> {
    await db.update(reservations)
      .set({ depositAppliedToOrder: orderId, updatedAt: new Date() } as any)
      .where(eq(reservations.id, reservationId));
  }

  // ===============================
  // 2. PROMOTIONS & COUPONS - العروض والكوبونات
  // ===============================
  async getPromotions(restaurantId: string, activeOnly?: boolean, branchId?: string): Promise<Promotion[]> {
    const conditions = [eq(promotions.restaurantId, restaurantId)];
    if (branchId) {
      conditions.push(eq(promotions.branchId, branchId));
    }
    if (activeOnly) {
      const now = new Date();
      conditions.push(eq(promotions.isActive, true));
      conditions.push(lte(promotions.startDate, now));
      conditions.push(gte(promotions.endDate, now));
    }
    return db.select().from(promotions).where(and(...conditions));
  }

  async getPromotion(id: string): Promise<Promotion | undefined> {
    const [promotion] = await db.select().from(promotions).where(eq(promotions.id, id));
    return promotion;
  }

  async createPromotion(data: InsertPromotion): Promise<Promotion> {
    const [promotion] = await db.insert(promotions).values(data as any).returning();
    return promotion;
  }

  async updatePromotion(id: string, data: Partial<InsertPromotion>): Promise<Promotion | undefined> {
    const [updated] = await db.update(promotions)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(promotions.id, id))
      .returning();
    return updated;
  }

  async deletePromotion(id: string): Promise<void> {
    await db.delete(promotions).where(eq(promotions.id, id));
  }

  async getCoupons(restaurantId: string): Promise<Coupon[]> {
    return db.select().from(coupons).where(eq(coupons.restaurantId, restaurantId));
  }

  async getCoupon(id: string): Promise<Coupon | undefined> {
    const [coupon] = await db.select().from(coupons).where(eq(coupons.id, id));
    return coupon;
  }

  async getCouponByCode(restaurantId: string, code: string): Promise<Coupon | undefined> {
    const [coupon] = await db.select().from(coupons).where(
      and(eq(coupons.restaurantId, restaurantId), eq(coupons.code, code.toUpperCase()))
    );
    return coupon;
  }

  async createCoupon(data: InsertCoupon): Promise<Coupon> {
    const [coupon] = await db.insert(coupons).values({ ...data, code: data.code.toUpperCase() } as any).returning();
    return coupon;
  }

  async updateCoupon(id: string, data: Partial<InsertCoupon>): Promise<Coupon | undefined> {
    const updateData = { ...data, updatedAt: new Date() };
    if (data.code) updateData.code = data.code.toUpperCase();
    const [updated] = await db.update(coupons)
      .set(updateData as any)
      .where(eq(coupons.id, id))
      .returning();
    return updated;
  }

  async deleteCoupon(id: string): Promise<void> {
    await db.delete(couponUsage).where(eq(couponUsage.couponId, id));
    await db.delete(coupons).where(eq(coupons.id, id));
  }

  async validateCoupon(restaurantId: string, code: string, orderTotal: number, customerPhone?: string): Promise<{ valid: boolean; coupon?: Coupon; error?: string }> {
    const coupon = await this.getCouponByCode(restaurantId, code);
    
    if (!coupon) {
      return { valid: false, error: "Coupon not found" };
    }
    
    if (!coupon.isActive) {
      return { valid: false, error: "Coupon is not active" };
    }
    
    const now = new Date();
    if (coupon.startDate && now < coupon.startDate) {
      return { valid: false, error: "Coupon is not yet valid" };
    }
    
    if (coupon.endDate && now > coupon.endDate) {
      return { valid: false, error: "Coupon has expired" };
    }
    
    if (coupon.usageLimit && coupon.usageCount && coupon.usageCount >= coupon.usageLimit) {
      return { valid: false, error: "Coupon usage limit reached" };
    }
    
    if (coupon.minOrderAmount && orderTotal < parseFloat(coupon.minOrderAmount)) {
      return { valid: false, error: `Minimum order amount is ${coupon.minOrderAmount}` };
    }
    
    // Check per-customer usage
    if (customerPhone && coupon.usagePerCustomer) {
      const usageByCustomer = await db.select().from(couponUsage).where(
        and(eq(couponUsage.couponId, coupon.id), eq(couponUsage.customerPhone, customerPhone))
      );
      if (usageByCustomer.length >= coupon.usagePerCustomer) {
        return { valid: false, error: "You have already used this coupon" };
      }
    }
    
    return { valid: true, coupon };
  }

  async useCoupon(data: InsertCouponUsage): Promise<CouponUsage> {
    const [usage] = await db.insert(couponUsage).values(data as any).returning();
    // Increment usage count
    await db.update(coupons)
      .set({ usageCount: sql`COALESCE(usage_count, 0) + 1` })
      .where(eq(coupons.id, data.couponId));
    return usage;
  }

  async getCouponUsage(couponId: string): Promise<CouponUsage[]> {
    return db.select().from(couponUsage).where(eq(couponUsage.couponId, couponId));
  }

  // ===============================
  // REVIEWS - التقييمات
  // ===============================
  async getReviews(restaurantId: string): Promise<Review[]> {
    return db.select().from(reviews).where(eq(reviews.restaurantId, restaurantId)).orderBy(desc(reviews.createdAt));
  }

  async getReviewByOrder(orderId: string): Promise<Review | undefined> {
    const [review] = await db.select().from(reviews).where(eq(reviews.orderId, orderId));
    return review;
  }

  async createReview(data: InsertReview): Promise<Review> {
    const [review] = await db.insert(reviews).values(data as any).returning();
    return review;
  }

  async getAverageRating(restaurantId: string): Promise<{ average: number; count: number }> {
    const result = await db.select({
      avg: sql<string>`coalesce(avg(${reviews.rating}), 0)`,
      count: sql<string>`count(*)`,
    }).from(reviews).where(and(eq(reviews.restaurantId, restaurantId), eq(reviews.isPublic, true)));
    return {
      average: parseFloat(result[0]?.avg || "0"),
      count: parseInt(result[0]?.count || "0"),
    };
  }

  // ===============================
  // 3. MENU VARIANTS & CUSTOMIZATIONS - المتغيرات والتخصيصات
  // ===============================
  async getMenuItemVariants(menuItemId: string): Promise<MenuItemVariant[]> {
    return db.select().from(menuItemVariants).where(eq(menuItemVariants.menuItemId, menuItemId)).orderBy(menuItemVariants.sortOrder);
  }

  async getMenuItemVariant(id: string): Promise<MenuItemVariant | undefined> {
    const [variant] = await db.select().from(menuItemVariants).where(eq(menuItemVariants.id, id));
    return variant;
  }

  async createMenuItemVariant(data: InsertMenuItemVariant): Promise<MenuItemVariant> {
    const [variant] = await db.insert(menuItemVariants).values(data as any).returning();
    return variant;
  }

  async updateMenuItemVariant(id: string, data: Partial<InsertMenuItemVariant>): Promise<MenuItemVariant | undefined> {
    const [updated] = await db.update(menuItemVariants)
      .set(data as any)
      .where(eq(menuItemVariants.id, id))
      .returning();
    return updated;
  }

  async deleteMenuItemVariant(id: string): Promise<void> {
    await db.delete(menuItemVariants).where(eq(menuItemVariants.id, id));
  }

  async getCustomizationGroups(restaurantId: string): Promise<CustomizationGroup[]> {
    return db.select().from(customizationGroups).where(eq(customizationGroups.restaurantId, restaurantId)).orderBy(customizationGroups.sortOrder);
  }

  async getCustomizationGroup(id: string): Promise<CustomizationGroup | undefined> {
    const [group] = await db.select().from(customizationGroups).where(eq(customizationGroups.id, id));
    return group;
  }

  async createCustomizationGroup(data: InsertCustomizationGroup): Promise<CustomizationGroup> {
    const [group] = await db.insert(customizationGroups).values(data as any).returning();
    return group;
  }

  async updateCustomizationGroup(id: string, data: Partial<InsertCustomizationGroup>): Promise<CustomizationGroup | undefined> {
    const [updated] = await db.update(customizationGroups)
      .set(data as any)
      .where(eq(customizationGroups.id, id))
      .returning();
    return updated;
  }

  async deleteCustomizationGroup(id: string): Promise<void> {
    await db.delete(customizationOptions).where(eq(customizationOptions.groupId, id));
    await db.delete(menuItemCustomizations).where(eq(menuItemCustomizations.customizationGroupId, id));
    await db.delete(customizationGroups).where(eq(customizationGroups.id, id));
  }

  async getCustomizationOptions(groupId: string): Promise<CustomizationOption[]> {
    return db.select().from(customizationOptions).where(eq(customizationOptions.groupId, groupId)).orderBy(customizationOptions.sortOrder);
  }

  async getCustomizationOption(id: string): Promise<CustomizationOption | undefined> {
    const [option] = await db.select().from(customizationOptions).where(eq(customizationOptions.id, id));
    return option;
  }

  async createCustomizationOption(data: InsertCustomizationOption): Promise<CustomizationOption> {
    const [option] = await db.insert(customizationOptions).values(data as any).returning();
    return option;
  }

  async updateCustomizationOption(id: string, data: Partial<InsertCustomizationOption>): Promise<CustomizationOption | undefined> {
    const [updated] = await db.update(customizationOptions)
      .set(data as any)
      .where(eq(customizationOptions.id, id))
      .returning();
    return updated;
  }

  async deleteCustomizationOption(id: string): Promise<void> {
    await db.delete(customizationOptions).where(eq(customizationOptions.id, id));
  }

  async getMenuItemCustomizations(menuItemId: string): Promise<(MenuItemCustomization & { group: CustomizationGroup; options: CustomizationOption[] })[]> {
    const links = await db.select().from(menuItemCustomizations).where(eq(menuItemCustomizations.menuItemId, menuItemId));
    const result = [];
    for (const link of links) {
      const group = await this.getCustomizationGroup(link.customizationGroupId);
      if (group) {
        const options = await this.getCustomizationOptions(group.id);
        result.push({ ...link, group, options });
      }
    }
    return result;
  }

  async linkMenuItemCustomization(data: InsertMenuItemCustomization): Promise<MenuItemCustomization> {
    const [link] = await db.insert(menuItemCustomizations).values(data as any).returning();
    return link;
  }

  async unlinkMenuItemCustomization(menuItemId: string, groupId: string): Promise<void> {
    await db.delete(menuItemCustomizations).where(
      and(eq(menuItemCustomizations.menuItemId, menuItemId), eq(menuItemCustomizations.customizationGroupId, groupId))
    );
  }

  async createOrderItemCustomization(data: InsertOrderItemCustomization): Promise<OrderItemCustomization> {
    const [customization] = await db.insert(orderItemCustomizations).values(data as any).returning();
    return customization;
  }

  async getOrderItemCustomizations(orderItemId: string): Promise<OrderItemCustomization[]> {
    return db.select().from(orderItemCustomizations).where(eq(orderItemCustomizations.orderItemId, orderItemId));
  }

  // ===============================
  // 4. QUEUE MANAGEMENT - نظام الطابور
  // ===============================
  async getQueueEntries(restaurantId: string, branchId?: string, status?: string): Promise<QueueEntry[]> {
    let conditions = [eq(queueEntries.restaurantId, restaurantId)];
    if (branchId) {
      conditions.push(eq(queueEntries.branchId, branchId));
    }
    if (status) {
      conditions.push(eq(queueEntries.status, status));
    }
    // Only show today's entries
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    conditions.push(gte(queueEntries.createdAt, today));
    
    return db.select().from(queueEntries).where(and(...conditions)).orderBy(queueEntries.queueNumber);
  }

  async getQueueEntry(id: string): Promise<QueueEntry | undefined> {
    const [entry] = await db.select().from(queueEntries).where(eq(queueEntries.id, id));
    return entry;
  }

  async createQueueEntry(data: InsertQueueEntry): Promise<QueueEntry> {
    const [entry] = await db.insert(queueEntries).values(data as any).returning();
    return entry;
  }

  async updateQueueEntry(id: string, data: Partial<InsertQueueEntry>): Promise<QueueEntry | undefined> {
    const [updated] = await db.update(queueEntries)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(queueEntries.id, id))
      .returning();
    return updated;
  }

  async updateQueueStatus(id: string, status: string): Promise<QueueEntry | undefined> {
    const updateData: any = { status, updatedAt: new Date() };
    if (status === "notified") {
      updateData.notifiedAt = new Date();
    } else if (status === "seated") {
      updateData.seatedAt = new Date();
    }
    const [updated] = await db.update(queueEntries)
      .set(updateData)
      .where(eq(queueEntries.id, id))
      .returning();
    return updated;
  }

  async deleteQueueEntry(id: string): Promise<void> {
    await db.delete(queueEntries).where(eq(queueEntries.id, id));
  }

  async getNextQueueNumber(restaurantId: string, branchId?: string): Promise<number> {
    const today = new Date().toISOString().split('T')[0]; // "2026-02-10"
    
    // Check if counter exists for today
    let conditions = [eq(queueCounters.restaurantId, restaurantId), eq(queueCounters.date, today)];
    if (branchId) {
      conditions.push(eq(queueCounters.branchId, branchId));
    }
    
    const [existingCounter] = await db.select().from(queueCounters).where(and(...conditions));
    
    if (existingCounter) {
      const nextNumber = (existingCounter.lastNumber || 0) + 1;
      await db.update(queueCounters)
        .set({ lastNumber: nextNumber })
        .where(eq(queueCounters.id, existingCounter.id));
      return nextNumber;
    } else {
      // Create new counter for today
      await db.insert(queueCounters).values({
        restaurantId,
        branchId: branchId || null,
        date: today,
        lastNumber: 1,
      } as any);
      return 1;
    }
  }

  async getQueuePosition(id: string): Promise<number> {
    const entry = await this.getQueueEntry(id);
    if (!entry) return 0;
    
    const waitingEntries = await this.getQueueEntries(entry.restaurantId, entry.branchId || undefined, "waiting");
    const position = waitingEntries.findIndex(e => e.id === id);
    return position >= 0 ? position + 1 : 0;
  }

  async getEstimatedWaitTime(restaurantId: string, branchId?: string): Promise<number> {
    const waitingEntries = await this.getQueueEntries(restaurantId, branchId, "waiting");
    // Estimate 10 minutes per party in queue
    return waitingEntries.length * 10;
  }

  // ===============================
  // 5. DAY SESSIONS - إدارة اليوم
  // ===============================
  async getDaySessions(restaurantId: string, branchId?: string): Promise<DaySession[]> {
    let conditions = [eq(daySessions.restaurantId, restaurantId)];
    if (branchId) {
      conditions.push(eq(daySessions.branchId, branchId));
    }
    return db.select().from(daySessions).where(and(...conditions)).orderBy(desc(daySessions.openedAt));
  }

  async getCurrentDaySession(restaurantId: string, branchId?: string): Promise<DaySession | undefined> {
    const today = new Date().toISOString().split('T')[0];
    
    // First: try to find a session matching the exact branch
    if (branchId) {
      const [branchSession] = await db.select().from(daySessions).where(
        and(
          eq(daySessions.restaurantId, restaurantId),
          eq(daySessions.date, today),
          eq(daySessions.status, "open"),
          eq(daySessions.branchId, branchId),
        )
      );
      if (branchSession) return branchSession;
    }
    
    // Fallback: find any open session for this restaurant today (branch-agnostic)
    const [anySession] = await db.select().from(daySessions).where(
      and(
        eq(daySessions.restaurantId, restaurantId),
        eq(daySessions.date, today),
        eq(daySessions.status, "open"),
      )
    );
    return anySession;
  }

  async getDaySession(id: string): Promise<DaySession | undefined> {
    const [session] = await db.select().from(daySessions).where(eq(daySessions.id, id));
    return session;
  }

  async openDaySession(data: InsertDaySession): Promise<DaySession> {
    const [session] = await db.insert(daySessions).values({
      ...data,
      date: new Date().toISOString().split('T')[0],
      status: "open",
    } as any).returning();
    return session;
  }

  async closeDaySession(id: string, closingData: { closedBy?: string; closingBalance?: string; notes?: string }): Promise<DaySession | undefined> {
    const session = await this.getDaySession(id);
    if (!session) return undefined;

    // Calculate expected balance and difference
    const cashSales = parseFloat(session.cashSales || "0");
    const openingBalance = parseFloat(session.openingBalance || "0");
    const expectedBalance = openingBalance + cashSales;
    const closingBalance = parseFloat(closingData.closingBalance || "0");
    const difference = closingBalance - expectedBalance;

    const [updated] = await db.update(daySessions)
      .set({
        status: "closed",
        closedAt: new Date(),
        closedBy: closingData.closedBy,
        closingBalance: closingData.closingBalance,
        expectedBalance: expectedBalance.toFixed(2),
        difference: difference.toFixed(2),
        notes: closingData.notes,
      } as any)
      .where(eq(daySessions.id, id))
      .returning();
    return updated;
  }

  async updateDaySession(id: string, data: Partial<InsertDaySession>): Promise<DaySession | undefined> {
    const [updated] = await db.update(daySessions)
      .set(data as any)
      .where(eq(daySessions.id, id))
      .returning();
    return updated;
  }

  async incrementDaySessionTotals(id: string, orderTotal: number, paymentMethod: string): Promise<void> {
    // Atomic SQL increment to prevent race conditions under concurrent orders
    await db.execute(sql`
      UPDATE ${daySessions}
      SET
        total_sales = COALESCE(total_sales::numeric, 0) + ${orderTotal},
        total_orders = COALESCE(total_orders, 0) + 1,
        cash_sales = CASE WHEN ${paymentMethod} = 'cash' THEN COALESCE(cash_sales::numeric, 0) + ${orderTotal} ELSE cash_sales END,
        card_sales = CASE WHEN ${paymentMethod} IN ('card', 'online') THEN COALESCE(card_sales::numeric, 0) + ${orderTotal} ELSE card_sales END
      WHERE id = ${id}
    `);
  }

  async getCashTransactions(sessionId: string): Promise<CashTransaction[]> {
    return db.select().from(cashTransactions).where(eq(cashTransactions.sessionId, sessionId)).orderBy(desc(cashTransactions.createdAt));
  }

  async createCashTransaction(data: InsertCashTransaction): Promise<CashTransaction> {
    const [transaction] = await db.insert(cashTransactions).values(data as any).returning();
    return transaction;
  }

  // ===============================
  // 6. NOTIFICATIONS - الإشعارات
  // ===============================
  async getNotifications(restaurantId: string, branchId?: string, unreadOnly?: boolean): Promise<Notification[]> {
    let conditions: any[] = [eq(notifications.restaurantId, restaurantId)];
    if (branchId) {
      conditions.push(eq(notifications.branchId, branchId));
    }
    if (unreadOnly) {
      conditions.push(eq(notifications.isRead, false));
    }
    return db.select().from(notifications).where(and(...conditions)).orderBy(desc(notifications.createdAt)).limit(100);
  }

  async getNotification(id: string): Promise<Notification | undefined> {
    const [notification] = await db.select().from(notifications).where(eq(notifications.id, id));
    return notification;
  }

  async createNotification(data: InsertNotification): Promise<Notification> {
    const [notification] = await db.insert(notifications).values(data as any).returning();
    return notification;
  }

  async markNotificationAsRead(id: string, readBy?: string): Promise<Notification | undefined> {
    const [updated] = await db.update(notifications)
      .set({ isRead: true, readAt: new Date(), readBy } as any)
      .where(eq(notifications.id, id))
      .returning();
    return updated;
  }

  async markAllNotificationsAsRead(restaurantId: string, branchId?: string): Promise<void> {
    let conditions: any[] = [eq(notifications.restaurantId, restaurantId), eq(notifications.isRead, false)];
    if (branchId) {
      conditions.push(eq(notifications.branchId, branchId));
    }
    await db.update(notifications)
      .set({ isRead: true, readAt: new Date() } as any)
      .where(and(...conditions));
  }

  async deleteNotification(id: string): Promise<void> {
    await db.delete(notifications).where(eq(notifications.id, id));
  }

  async deleteOldNotifications(days: number): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    await db.delete(notifications).where(lte(notifications.createdAt, cutoffDate));
  }

  async getNotificationSettings(restaurantId: string, branchId?: string): Promise<NotificationSettings | undefined> {
    let conditions: any[] = [eq(notificationSettings.restaurantId, restaurantId)];
    if (branchId) {
      conditions.push(eq(notificationSettings.branchId, branchId));
    }
    const [settings] = await db.select().from(notificationSettings).where(and(...conditions));
    return settings;
  }

  async updateNotificationSettings(restaurantId: string, branchId: string | undefined, data: Partial<InsertNotificationSettings>): Promise<NotificationSettings> {
    const existing = await this.getNotificationSettings(restaurantId, branchId);
    if (existing) {
      const [updated] = await db.update(notificationSettings)
        .set({ ...data, updatedAt: new Date() } as any)
        .where(eq(notificationSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(notificationSettings).values({
        restaurantId,
        branchId,
        ...data,
      } as any).returning();
      return created;
    }
  }

  // Order Audit Log
  async createOrderAuditLog(data: any): Promise<any> {
    const [log] = await db.insert(orderAuditLog).values(data).returning();
    return log;
  }

  async getOrderAuditLog(orderId: string): Promise<any[]> {
    return await db.select().from(orderAuditLog)
      .where(eq(orderAuditLog.orderId, orderId))
      .orderBy(orderAuditLog.createdAt);
  }
}

export const storage = new DatabaseStorage();

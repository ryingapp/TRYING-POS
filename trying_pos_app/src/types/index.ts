// ==================== USER ====================
export interface User {
  id: string;
  restaurantId: string;
  branchId?: string | null;
  email: string;
  name?: string | null;
  phone?: string | null;
  role: string;
  isActive: boolean;
  permDashboard?: boolean;
  permPos?: boolean;
  permOrders?: boolean;
  permMenu?: boolean;
  permKitchen?: boolean;
  permInventory?: boolean;
  permReports?: boolean;
  permSettings?: boolean;
  permTables?: boolean;
  lastLoginAt?: string | null;
  createdAt?: string | null;
}

// ==================== BRANCH ====================
export interface Branch {
  id: string;
  restaurantId: string;
  name: string;
  nameAr?: string | null;
  slug?: string | null;
  address?: string | null;
  phone?: string | null;
  isMain: boolean;
  isActive: boolean;
}

// ==================== CATEGORY ====================
export interface Category {
  id: string;
  restaurantId: string;
  nameEn: string;
  nameAr: string;
  parentId?: string | null;
  sortOrder: number;
  isActive: boolean;
}

// ==================== MENU ITEM ====================
export interface MenuItem {
  id: string;
  restaurantId: string;
  categoryId: string;
  kitchenSectionId?: string | null;
  nameEn: string;
  nameAr: string;
  descriptionEn?: string | null;
  descriptionAr?: string | null;
  price: string;
  image?: string | null;
  isAvailable: boolean;
  sortOrder: number;
  prepTime?: number | null;
  calories?: number | null;
  isNew?: boolean;
  isBestseller?: boolean;
  isSpicy?: boolean;
}

// ==================== ORDER ====================
export interface Order {
  id: string;
  restaurantId: string;
  branchId?: string | null;
  tableId?: string | null;
  customerId?: string | null;
  orderNumber: string;
  orderType: string;
  status: string;
  customerName?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  notes?: string | null;
  kitchenNotes?: string | null;
  subtotal: string;
  discount: string;
  deliveryFee: string;
  tax: string;
  total: string;
  paymentMethod: string;
  isPaid: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  items?: OrderItem[];
}

export interface OrderItem {
  id?: string;
  orderId?: string;
  menuItemId?: string | null;
  itemName?: string | null;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  notes?: string | null;
}

// ==================== CART ====================
export interface CartItem {
  menuItemId: string;
  nameEn: string;
  nameAr: string;
  price: string;
  quantity: number;
  notes: string;
  image?: string | null;
}

// ==================== SYNC ====================
export interface SyncQueueItem {
  id: number;
  type: string;
  action: string;
  data: any;
  status: string;
  retryCount: number;
  createdAt: string;
}

// ==================== HELPERS ====================
export function getDisplayName(item: { nameAr?: string | null; nameEn?: string | null } | null): string {
  if (!item) return '';
  return item.nameAr || item.nameEn || '';
}

export function getCategoryName(cat: Category): string {
  return cat.nameAr || cat.nameEn || '';
}

export function getItemPrice(item: { price: string } | null): number {
  if (!item) return 0;
  return parseFloat(item.price) || 0;
}

export function getOrderTotal(order: Order): number {
  return parseFloat(order.total) || 0;
}

export function getImageUrl(image?: string | null): string {
  if (!image) return '';
  if (image.startsWith('http')) return image;
  return `https://tryingpos.com${image}`;
}

export const ORDER_STATUS_MAP: Record<string, string> = {
  pending: 'جديد',
  preparing: 'قيد التحضير',
  ready: 'جاهز',
  completed: 'مكتمل',
  cancelled: 'ملغي',
};

export const ORDER_TYPE_MAP: Record<string, string> = {
  dine_in: 'محلي',
  takeout: 'سفري',
  pickup: 'استلام',
  delivery: 'توصيل',
};

export const PAYMENT_MAP: Record<string, string> = {
  cash: 'كاش',
  card: 'شبكة',
  bank_transfer: 'تحويل',
  online: 'أونلاين',
};

export const ROLE_MAP: Record<string, string> = {
  owner: 'مالك',
  branch_manager: 'مدير فرع',
  cashier: 'كاشير',
  kitchen: 'مطبخ',
  accountant: 'محاسب',
  platform_admin: 'مسؤول النظام',
};

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { I18nManager } from 'react-native';

export type Lang = 'ar' | 'en';

/* ─── Translation dictionaries ─────────────────── */

const AR: Record<string, string> = {
  // Navigation
  'nav.dashboard': 'الرئيسية',
  'nav.pos': 'نقطة البيع',
  'nav.orders': 'الطلبات',
  'nav.kitchen': 'المطبخ',
  'nav.settings': 'الإعدادات',

  // Settings
  'settings.title': 'الإعدادات',
  'settings.user': 'المستخدم',
  'settings.branch': 'الفرع',
  'settings.noBranches': 'لا توجد فروع',
  'settings.sync': 'المزامنة',
  'settings.syncStatus': 'الحالة',
  'settings.syncPending': 'في الانتظار',
  'settings.syncLast': 'آخر مزامنة',
  'settings.syncNow': 'مزامنة الآن',
  'settings.syncing': 'جاري المزامنة...',
  'settings.syncNotYet': 'لم يتم بعد',
  'settings.language': 'اللغة',
  'settings.langAr': 'العربية',
  'settings.langEn': 'English',
  'settings.actions': 'إجراءات',
  'settings.clearData': 'مسح البيانات المحلية',
  'settings.logout': 'تسجيل الخروج',
  'settings.logoutConfirm': 'هل أنت متأكد من تسجيل الخروج؟',
  'settings.cancel': 'إلغاء',
  'settings.clearConfirm': 'سيتم مسح جميع البيانات المخزنة محلياً. هل أنت متأكد؟',
  'settings.clear': 'مسح',
  'settings.done': 'تم',
  'settings.clearedMsg': 'تم مسح البيانات المحلية',
  'settings.item': 'عنصر',
  'settings.items': 'عناصر',

  // Sync statuses
  'sync.connected': 'متصل',
  'sync.syncing': 'جاري المزامنة...',
  'sync.error': 'خطأ في المزامنة',
  'sync.offline': 'غير متصل',
  'sync.offlineMode': 'وضع عدم الاتصال',
  'sync.pendingItems': 'عناصر في الانتظار',

  // Dashboard
  'dash.greeting.morning': 'صباح الخير',
  'dash.greeting.evening': 'مساء الخير',
  'dash.orders': 'الطلبات',
  'dash.revenue': 'الإيرادات',
  'dash.avgOrder': 'متوسط الطلب',
  'dash.paid': 'مدفوع',
  'dash.orderStatus': 'حالة الطلبات',
  'dash.orderType': 'نوع الطلبات',
  'dash.offlineBanner': 'غير متصل — البيانات قد تكون قديمة',
  'dash.localData': 'بيانات محلية',

  // Statuses
  'status.pending': 'جديد',
  'status.preparing': 'قيد التحضير',
  'status.ready': 'جاهز',
  'status.completed': 'مكتمل',
  'status.cancelled': 'ملغي',

  // Order types
  'type.dine_in': 'محلي',
  'type.takeout': 'سفري',
  'type.delivery': 'توصيل',

  // Kitchen
  'kitchen.title': 'المطبخ',
  'kitchen.activeOrders': 'طلب نشط',
  'kitchen.newOrders': 'جديد',
  'kitchen.preparing': 'قيد التحضير',
  'kitchen.noOrders': 'لا توجد طلبات',
  'kitchen.ordersAppear': 'الطلبات الجديدة ستظهر هنا تلقائياً',
  'kitchen.offline': 'غير متصل بالإنترنت',
  'kitchen.start': 'ابدأ التحضير',
  'kitchen.ready': 'جاهز ✓',
  'kitchen.noDetails': 'لا توجد تفاصيل',
  'kitchen.loading': 'جاري تحميل طلبات المطبخ...',

  // POS
  'pos.search': 'بحث في القائمة...',
  'pos.all': 'الكل',
  'pos.noItems': 'لا توجد عناصر',
  'pos.pullToRefresh': 'اسحب للأسفل للتحديث',
  'pos.cart': 'السلة',

  // Orders
  'orders.title': 'الطلبات',
  'orders.all': 'الكل',
  'orders.noOrders': 'لا توجد طلبات',
  'orders.collect': 'تحصيل',
  'orders.items': 'العناصر',

  // Cart
  'cart.network': 'شبكة',
  'cart.networkTap': 'شبكة (Tap)',
  'cart.cash': 'كاش',
  'cart.transfer': 'تحويل',
  'cart.success': 'تم بنجاح',
  'cart.orderCreated': 'تم إنشاء الطلب',
  'cart.saved': 'تم الحفظ',
  'cart.savedLocal': 'تم حفظ الطلب محلياً وسيتم مزامنته',
  'cart.savedOffline': 'تم حفظ الطلب محلياً (غير متصل)',

  // Receipt
  'receipt.title': 'الفاتورة',
  'receipt.print': 'طباعة',
  'receipt.share': 'مشاركة',
  'receipt.retry': 'إعادة المحاولة',
  'receipt.loading': 'جاري تحميل الفاتورة...',

  // Common
  'common.error': 'خطأ',
  'common.hello': 'مرحبًا',
  'common.sar': 'ر.س',
};

const EN: Record<string, string> = {
  // Navigation
  'nav.dashboard': 'Dashboard',
  'nav.pos': 'POS',
  'nav.orders': 'Orders',
  'nav.kitchen': 'Kitchen',
  'nav.settings': 'Settings',

  // Settings
  'settings.title': 'Settings',
  'settings.user': 'User',
  'settings.branch': 'Branch',
  'settings.noBranches': 'No branches',
  'settings.sync': 'Sync',
  'settings.syncStatus': 'Status',
  'settings.syncPending': 'Pending',
  'settings.syncLast': 'Last sync',
  'settings.syncNow': 'Sync Now',
  'settings.syncing': 'Syncing...',
  'settings.syncNotYet': 'Not yet',
  'settings.language': 'Language',
  'settings.langAr': 'العربية',
  'settings.langEn': 'English',
  'settings.actions': 'Actions',
  'settings.clearData': 'Clear Local Data',
  'settings.logout': 'Logout',
  'settings.logoutConfirm': 'Are you sure you want to logout?',
  'settings.cancel': 'Cancel',
  'settings.clearConfirm': 'All locally stored data will be deleted. Are you sure?',
  'settings.clear': 'Clear',
  'settings.done': 'Done',
  'settings.clearedMsg': 'Local data cleared',
  'settings.item': 'item',
  'settings.items': 'items',

  // Sync statuses
  'sync.connected': 'Connected',
  'sync.syncing': 'Syncing...',
  'sync.error': 'Sync Error',
  'sync.offline': 'Offline',
  'sync.offlineMode': 'Offline Mode',
  'sync.pendingItems': 'items pending',

  // Dashboard
  'dash.greeting.morning': 'Good morning',
  'dash.greeting.evening': 'Good evening',
  'dash.orders': 'Orders',
  'dash.revenue': 'Revenue',
  'dash.avgOrder': 'Avg. Order',
  'dash.paid': 'Paid',
  'dash.orderStatus': 'Order Status',
  'dash.orderType': 'Order Type',
  'dash.offlineBanner': 'Offline — data may be outdated',
  'dash.localData': 'Local data',

  // Statuses
  'status.pending': 'New',
  'status.preparing': 'Preparing',
  'status.ready': 'Ready',
  'status.completed': 'Completed',
  'status.cancelled': 'Cancelled',

  // Order types
  'type.dine_in': 'Dine-in',
  'type.takeout': 'Takeout',
  'type.delivery': 'Delivery',

  // Kitchen
  'kitchen.title': 'Kitchen',
  'kitchen.activeOrders': 'active orders',
  'kitchen.newOrders': 'New',
  'kitchen.preparing': 'Preparing',
  'kitchen.noOrders': 'No orders',
  'kitchen.ordersAppear': 'New orders will appear here automatically',
  'kitchen.offline': 'No internet connection',
  'kitchen.start': 'Start Preparing',
  'kitchen.ready': 'Ready ✓',
  'kitchen.noDetails': 'No details',
  'kitchen.loading': 'Loading kitchen orders...',

  // POS
  'pos.search': 'Search menu...',
  'pos.all': 'All',
  'pos.noItems': 'No items',
  'pos.pullToRefresh': 'Pull down to refresh',
  'pos.cart': 'Cart',

  // Orders
  'orders.title': 'Orders',
  'orders.all': 'All',
  'orders.noOrders': 'No orders',
  'orders.collect': 'Collect',
  'orders.items': 'Items',

  // Cart
  'cart.network': 'Card',
  'cart.networkTap': 'Card (Tap)',
  'cart.cash': 'Cash',
  'cart.transfer': 'Transfer',
  'cart.success': 'Success',
  'cart.orderCreated': 'Order created',
  'cart.saved': 'Saved',
  'cart.savedLocal': 'Order saved locally and will sync',
  'cart.savedOffline': 'Order saved locally (offline)',

  // Receipt
  'receipt.title': 'Invoice',
  'receipt.print': 'Print',
  'receipt.share': 'Share',
  'receipt.retry': 'Retry',
  'receipt.loading': 'Loading invoice...',

  // Common
  'common.error': 'Error',
  'common.hello': 'Hello',
  'common.sar': 'SAR',
};

const DICTIONARIES: Record<Lang, Record<string, string>> = { ar: AR, en: EN };

/* ─── Context ─────────────────────────── */

interface LanguageContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
  isRTL: boolean;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'ar',
  setLang: () => {},
  t: (k) => k,
  isRTL: true,
});

const LANG_KEY = '@tryingpos_lang';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('ar');

  useEffect(() => {
    AsyncStorage.getItem(LANG_KEY).then((v) => {
      if (v === 'en' || v === 'ar') setLangState(v);
    });
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    AsyncStorage.setItem(LANG_KEY, l);
  }, []);

  const t = useCallback(
    (key: string) => DICTIONARIES[lang][key] || key,
    [lang],
  );

  const isRTL = lang === 'ar';

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}

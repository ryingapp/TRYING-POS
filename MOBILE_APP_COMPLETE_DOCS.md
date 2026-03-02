# TRYING POS - دليل المبرمج الشامل لتطبيق الجوال

## 📱 نظرة عامة

**TryingPOS Mobile App** هو تطبيق React Native لنقاط البيع (POS) مع دعم كامل للعمل بدون إنترنت، تكامل مع بوابة الدفع EdfaPay، ومزامنة تلقائية مع السيرفر.

### المواصفات الرئيسية
- **المنصة**: React Native + Expo
- **اللغات المدعومة**: عربي (RTL) + إنجليزي
- **دعم Offline**: SQLite محلي + نظام مزامنة تلقائي
- **الدفع**: EdfaPay Tap-to-Pay (NFC) - Android فقط
- **السيرفر**: https://tryingpos.com
- **الصلاحيات**: نظام صلاحيات متعدد المستويات

---

## 🏗️ البنية التقنية

### Stack الرئيسي
```json
{
  "framework": "React Native 0.81.5",
  "runtime": "Expo SDK 54",
  "navigation": "@react-navigation/native 7.1",
  "state": "React Context API",
  "storage": "AsyncStorage + SQLite",
  "payment": "edfapay-react-native 1.0.5",
  "language": "TypeScript 5.9"
}
```

### المكتبات الأساسية
```json
{
  "dependencies": {
    "@react-native-async-storage/async-storage": "2.2.0",
    "@react-native-community/netinfo": "11.4.1",
    "@react-navigation/bottom-tabs": "7.3.0",
    "expo-sqlite": "16.0.10",
    "expo-print": "15.0.8",
    "react-native-qrcode-svg": "6.3.21",
    "edfapay-react-native": "1.0.5"
  }
}
```

---

## ⚙️ التكوين والإعداد

### 1. app.json - التكوين الأساسي
```json
{
  "expo": {
    "name": "TryingPOS",
    "slug": "trying-pos",
    "version": "1.0.0",
    "orientation": "default",
    "android": {
      "package": "com.tryingapp.pos",
      "minSdkVersion": 29,
      "permissions": [
        "android.permission.NFC",
        "android.permission.INTERNET",
        "android.permission.ACCESS_FINE_LOCATION"
      ]
    },
    "ios": {
      "bundleIdentifier": "com.tryingapp.pos"
    },
    "extra": {
      "apiUrl": "https://tryingpos.com",
      "edfaPayAuthToken": "",
      "edfaPayEnv": "SANDBOX"
    }
  }
}
```

### 2. API Configuration
**الملف**: `src/config/api.ts`

```typescript
export const API_URL = 'https://tryingpos.com';

export const ENDPOINTS = {
  login: '/api/auth/login',
  me: '/api/auth/me',
  categories: '/api/categories',
  menuItems: '/api/menu-items',
  orders: '/api/orders',
  branches: '/api/branches',
  restaurant: '/api/restaurant',
  invoices: '/api/invoices',
} as const;
```

### 3. تشغيل التطبيق
```bash
# التثبيت
cd trying_pos_app
npm install

# تشغيل للتطوير
npm start                 # Expo DevTools
npm run android          # Android Emulator
npm run ios             # iOS Simulator

# بناء Production
eas build --platform android
eas build --platform ios
```

---

## 🔐 نظام تسجيل الدخول والصلاحيات

### 1. AuthContext
**الملف**: `src/context/AuthContext.tsx`

#### واجهة User
```typescript
interface User {
  id: string;
  restaurantId: string;
  branchId?: string | null;
  email: string;
  name?: string | null;
  role: string;              // 'owner' | 'branch_manager' | 'cashier' | 'kitchen'
  isActive: boolean;
  
  // الصلاحيات
  permDashboard?: boolean;
  permPos?: boolean;
  permOrders?: boolean;
  permMenu?: boolean;
  permKitchen?: boolean;
  permInventory?: boolean;
  permReports?: boolean;
  permSettings?: boolean;
  permTables?: boolean;
}
```

#### تسجيل الدخول
```typescript
import { useAuth } from './context/AuthContext';

function LoginScreen() {
  const { login, isLoading } = useAuth();
  
  const handleLogin = async () => {
    try {
      await login(email, password);
      // تلقائياً يحفظ: token, user, branches في AsyncStorage
      // تلقائياً يبدأ database initialization
    } catch (error) {
      console.error(error.message);
    }
  };
}
```

#### استخدام البيانات
```typescript
function AnyComponent() {
  const { user, token, branch, logout } = useAuth();
  
  if (!user) return <LoginScreen />;
  
  return (
    <View>
      <Text>مرحباً {user.name}</Text>
      <Text>الفرع: {branch?.name}</Text>
      <Button onPress={logout}>تسجيل خروج</Button>
    </View>
  );
}
```

### 2. نظام الصلاحيات
```typescript
const isAdmin = user.role === 'owner' || user.role === 'platform_admin';
const canViewDashboard = isAdmin || user.permDashboard;
const canUsePos = isAdmin || user.permPos;
const canManageOrders = isAdmin || user.permOrders;
const canAccessKitchen = isAdmin || user.permKitchen;
```

**دور المطبخ Kitchen-Only**:
```typescript
const isKitchenOnly = user.role === 'kitchen' || 
  (!user.permPos && !user.permOrders && user.permKitchen);

// يظهر له فقط: KitchenScreen + SettingsScreen
```

---

## 🌐 API Service - جميع الـ Endpoints

### الملف: `src/services/api.ts`

### 1. التسجيل والمصادقة
```typescript
// تسجيل الدخول
await api.login(email: string, password: string);
// Returns: { user: User, token: string }

// جلب بيانات المستخدم الحالي
await api.getMe();
// Returns: { user: User }
```

### 2. الفروع Branches
```typescript
await api.getBranches();
// Returns: Branch[]

interface Branch {
  id: string;
  restaurantId: string;
  name: string;
  nameAr?: string;
  address?: string;
  phone?: string;
  isMain: boolean;
  isActive: boolean;
}
```

### 3. القوائم والأصناف
```typescript
// جلب الأصناف
await api.getCategories();
// Returns: Category[]

// جلب عناصر القائمة
await api.getMenuItems();
// Returns: MenuItem[]

interface MenuItem {
  id: string;
  nameEn: string;
  nameAr: string;
  price: string;
  categoryId: string;
  image?: string;
  isAvailable: boolean;
  prepTime?: number;
}
```

### 4. الطلبات Orders
```typescript
// جلب الطلبات
await api.getOrders(branchId?: string, period?: string);
// period: 'today' | 'week' | 'month'
// Returns: Order[]

// إنشاء طلب جديد
await api.createOrder({
  orderType: 'dine_in',     // 'dine_in' | 'takeout' | 'delivery'
  customerName: 'أحمد',
  customerPhone: '0501234567',
  subtotal: '100.00',
  tax: '15.00',
  total: '115.00',
  paymentMethod: 'cash',    // 'cash' | 'card' | 'bank_transfer'
  isPaid: true,
  branchId: 'branch_id',
  items: [
    {
      menuItemId: 'item_id',
      quantity: 2,
      unitPrice: '50.00',
      totalPrice: '100.00',
      notes: 'بدون بصل'
    }
  ]
});

// إضافة عناصر للطلب
await api.createOrderItem(orderId, {
  menuItemId: 'item_id',
  quantity: 1,
  unitPrice: '25.00',
  totalPrice: '25.00'
});

// جلب عناصر طلب معين
await api.getOrderItems(orderId);

// تحديث حالة الطلب
await api.updateOrderStatus(orderId, 'preparing');
// statuses: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled'

// تحديث طريقة الدفع
await api.updateOrderPayment(orderId, 'card', true);
```

### 5. الفواتير Invoices
```typescript
// إنشاء فاتورة
await api.createInvoice({
  orderId: 'order_id',
  // ... بيانات الفاتورة
});

// جلب فاتورة بواسطة Order ID
await api.getInvoiceByOrder(orderId);

// جلب فاتورة بـ Invoice ID
await api.getInvoice(invoiceId);

// استرجاع فاتورة (Refund)
await api.refundInvoice(invoiceId, 'سبب الاسترجاع');

// استرجاع طلب كامل
await api.refundOrder(orderId, 'خطأ في الطلب');
```

### 6. معلومات المطعم
```typescript
await api.getRestaurant();
// Returns: { nameAr, nameEn, phone, address, ... }
```

### 7. EdfaPay Token
```typescript
await api.getSoftposToken();
// Returns: { authToken: string, environment: 'SANDBOX' | 'PRODUCTION' }
```

### 8. فحص الاتصال
```typescript
const isOnline = await api.checkServer();
// Returns: true | false
```

---

## 💾 قاعدة البيانات المحلية (Offline Support)

### الملف: `src/services/database.ts`

### 1. الجداول
```sql
-- الأصناف
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  nameEn TEXT,
  nameAr TEXT,
  sortOrder INTEGER,
  isActive INTEGER,
  data TEXT  -- JSON كامل
);

-- عناصر القائمة
CREATE TABLE menu_items (
  id TEXT PRIMARY KEY,
  nameEn TEXT,
  nameAr TEXT,
  price TEXT,
  categoryId TEXT,
  image TEXT,
  isAvailable INTEGER,
  data TEXT
);

-- الطلبات
CREATE TABLE orders (
  id TEXT,              -- Server ID (null إذا offline)
  localId TEXT UNIQUE,  -- معرّف محلي فريد
  orderNumber TEXT,
  orderType TEXT,
  status TEXT,
  total TEXT,
  paymentMethod TEXT,
  isPaid INTEGER,
  synced INTEGER,       -- 0 = unsynced, 1 = synced
  data TEXT,
  createdAt TEXT
);

-- عناصر الطلبات
CREATE TABLE order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  orderId TEXT,
  localOrderId TEXT,
  menuItemId TEXT,
  itemName TEXT,
  quantity INTEGER,
  unitPrice TEXT,
  totalPrice TEXT
);

-- طابور المزامنة
CREATE TABLE sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT,           -- 'order' | 'payment' | ...
  action TEXT,         -- 'create' | 'update' | 'delete'
  data TEXT,           -- JSON بيانات العملية
  status TEXT,         -- 'pending' | 'syncing' | 'synced' | 'failed'
  retryCount INTEGER,
  createdAt TEXT
);
```

### 2. استخدام Database Service
```typescript
import { database } from './services/database';

// تهيئة (يتم تلقائياً عند تسجيل الدخول)
await database.init();

// حفظ البيانات
await database.saveCategories(categories);
await database.saveMenuItems(menuItems);

// جلب البيانات
const categories = await database.getCategories();
const items = await database.getMenuItems(categoryId);

// حفظ طلب
const localId = await database.saveOrder({
  orderType: 'dine_in',
  total: '100.00',
  items: [...],
  synced: false  // سيتم مزامنته لاحقاً
});

// جلب طلبات غير مزامنة
const unsyncedOrders = await database.getUnsyncedOrders();

// مسح كل البيانات (عند تسجيل الخروج)
await database.clearAll();
```

---

## 🔄 نظام المزامنة (Sync System)

### الملف: `src/services/sync.ts` & `src/context/SyncContext.tsx`

### 1. SyncContext
```typescript
import { useSync } from './context/SyncContext';

function Component() {
  const { 
    isOnline,          // هل متصل بالإنترنت؟
    isSyncing,         // هل في عملية مزامنة الآن؟
    lastSync,          // آخر وقت مزامنة
    pendingCount,      // عدد العمليات المعلقة
    triggerSync        // بدء مزامنة يدوية
  } = useSync();
  
  return (
    <View>
      <Text>{isOnline ? 'متصل' : 'غير متصل'}</Text>
      <Text>عمليات معلقة: {pendingCount}</Text>
      <Button onPress={triggerSync}>مزامنة الآن</Button>
    </View>
  );
}
```

### 2. كيف تعمل المزامنة؟

#### أ. عند العمل Offline
```typescript
// 1. حفظ الطلب محلياً
const localId = await database.saveOrder(orderData);

// 2. إضافة للـ Sync Queue
await database.addToSyncQueue({
  type: 'order',
  action: 'create',
  data: orderData
});

// 3. عند توفر الاتصال:
// - syncService يكتشف الاتصال تلقائياً
// - يرسل الطلبات المعلقة واحداً تلو الآخر
// - يحدث localId → serverId
// - يضع synced = 1
```

#### ب. Pull من السيرفر
```typescript
// كل 30 ثانية (إذا متصل):
- يجلب categories, menuItems, orders جديدة
- يحدث قاعدة البيانات المحلية
- يبث التغييرات عبر React Context
```

### 3. مثال: إنشاء طلب Offline-First
```typescript
async function createOfflineOrder(orderData: any) {
  try {
    // 1. حفظ محلي
    const localId = await database.saveOrder({
      ...orderData,
      localId: `local_${Date.now()}`,
      synced: 0
    });
    
    // 2. محاولة الإرسال للسيرفر (إذا متصل)
    if (await api.checkServer()) {
      try {
        const serverOrder = await api.createOrder(orderData);
        // نجح - تحديث localId بـ serverId
        await database.updateOrderServerId(localId, serverOrder.id);
      } catch {
        // فشل - سيتم المزامنة لاحقاً
      }
    }
    
    return localId;
  } catch (error) {
    throw error;
  }
}
```

---

## 📱 الشاشات والميزات

### 1. LoginScreen
**الملف**: `src/screens/LoginScreen.tsx`

**الميزات**:
- تسجيل دخول بـ Email + Password
- تخزين Token في AsyncStorage
- اختيار الفرع (إذا أكثر من فرع)
- دعم RTL للعربية

**API المستخدمة**:
- `POST /api/auth/login`
- `GET /api/branches`

---

### 2. DashboardScreen
**الملف**: `src/screens/DashboardScreen.tsx`

**الميزات**:
- إحصائيات المبيعات اليوم
- عدد الطلبات (معلقة، جاهزة، مكتملة)
- إجمالي المبيعات
- رسم بياني للمبيعات
- الطلبات الأخيرة

**API المستخدمة**:
- `GET /api/orders?period=today&branch={branchId}`

---

### 3. PosScreen (نقطة البيع)
**الملف**: `src/screens/PosScreen.tsx`

**الميزات**:
- عرض القوائم والأصناف
- إضافة للسلة مع ملاحظات
- حساب المجموع + الضريبة تلقائياً
- اختيار طريقة الدفع (كاش، شبكة، بنك)
- **Tap-to-Pay NFC** عبر EdfaPay
- طباعة الفاتورة
- دعم Offline كامل

**مكونات**:
```typescript
<MenuGrid />        // عرض الأصناف
<CartPanel />       // السلة
<TapToPayModal />   // دفع NFC
<ReceiptModal />    // طباعة الفاتورة
```

**الاستخدام**:
```typescript
import { useCart } from '../context/CartContext';

function PosScreen() {
  const { cart, addItem, removeItem, updateQuantity, clearCart, total } = useCart();
  
  const handleCheckout = async () => {
    const order = await api.createOrder({
      orderType: 'dine_in',
      total: total.toFixed(2),
      items: cart.map(item => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        unitPrice: item.price,
        totalPrice: (parseFloat(item.price) * item.quantity).toFixed(2)
      }))
    });
    
    clearCart();
  };
}
```

---

### 4. OrdersScreen
**الملف**: `src/screens/OrdersScreen.tsx`

**الميزات**:
- عرض الطلبات (اليوم، الأسبوع، الشهر)
- فلترة حسب الحالة
- تفاصيل كل طلب
- تحديث حالة الطلب
- استرجاع طلب (Refund)
- البحث بـ Order Number

**API المستخدمة**:
- `GET /api/orders?period=today&branch={id}`
- `PUT /api/orders/{id}/status`
- `POST /api/invoices/{id}/refund`

---

### 5. KitchenScreen
**الملف**: `src/screens/KitchenScreen.tsx`

**الميزات**:
- عرض الطلبات الجديدة والقيد التحضير
- عمودين: جديد | قيد التحضير
- تقدم الطلب: pending → preparing → ready
- إشعار صوتي عند طلب جديد
- تحديث تلقائي كل 10 ثواني

**واجهة**:
```typescript
// pending → preparing
await api.updateOrderStatus(orderId, 'preparing');

// preparing → ready
await api.updateOrderStatus(orderId, 'ready');
```

---

### 6. SettingsScreen
**الملف**: `src/screens/SettingsScreen.tsx`

**الميزات**:
- معلومات المستخدم
- اختيار الفرع
- تغيير اللغة (عربي/إنجليزي)
- حالة المزامنة
- تسجيل الخروج

---

## 💳 نظام الدفع - EdfaPay Tap-to-Pay

### الملف: `src/services/edfapay-softpos.ts`

### 1. الإعداد

#### الحصول على Token
```typescript
// من لوحة تحكم EdfaPay Partner Portal:
// 1. سجّل كـ Partner
// 2. احصل على Partner Config (مشفر)
// 3. احصل على Auth Token لكل restaurant

const EDFAPAY_PARTNER_CONFIG = '...';  // من Partner Portal
const EDFAPAY_AUTH_TOKEN = '...';       // من Restaurant Dashboard
const EDFAPAY_ENV = 'SANDBOX';          // أو 'PRODUCTION'
```

#### في app.json
```json
{
  "extra": {
    "edfaPayAuthToken": "your_token_here",
    "edfaPayEnv": "SANDBOX"
  }
}
```

### 2. الاستخدام

```typescript
import { edfaPaySoftPos } from '../services/edfapay-softpos';

async function handleTapToPay() {
  // 1. التحقق من التوفر
  if (!edfaPaySoftPos.isAvailable()) {
    alert('Tap-to-Pay متوفر على Android فقط');
    return;
  }
  
  // 2. التهيئة (مرة واحدة عند تسجيل الدخول)
  await edfaPaySoftPos.init();
  
  // 3. إجراء الدفع
  const result = await edfaPaySoftPos.purchase('115.50', orderId);
  
  if (result.success) {
    console.log('نجح الدفع:', result.transaction);
    // result.transaction.transactionNumber
    // result.transaction.rrn
    // result.transaction.authCode
    
    // تحديث الطلب
    await api.updateOrderPayment(orderId, 'card', true);
  } else if (result.cancelledByUser) {
    console.log('ألغى المستخدم');
  } else {
    console.error('فشل:', result.error);
  }
}
```

### 3. استرجاع دفعة
```typescript
const refundResult = await edfaPaySoftPos.refund(
  transactionNumber,
  '115.50',
  orderId
);

if (refundResult.success) {
  console.log('تم الاسترجاع');
}
```

### 4. Demo Mode
إذا كان `EDFAPAY_AUTH_TOKEN` فارغ → Demo Mode:
- يعرض واجهة محاكاة
- دائماً ينجح بعد 2 ثانية
- مفيد للتطوير بدون SDK حقيقي

---

## 🖨️ نظام طباعة الفواتير (Invoice Printing System)

### الملف الرئيسي: `src/components/ReceiptModal.tsx`

### 1. مقدمة - كيف تعمل الطباعة؟

نستخدم مكتبة **expo-print** للطباعة. الطريقة بسيطة:
1. نبني صفحة HTML تحتوي تصميم الفاتورة
2. نمررها لـ `Print.printAsync({ html })`
3. النظام يفتح واجهة الطباعة الأصلية للجهاز (يمكن للمستخدم اختيار الطابعة أو حفظ PDF)

```typescript
import * as Print from 'expo-print';

// طباعة بسيطة
await Print.printAsync({
  html: '<h1>مرحباً</h1>'
});
```

### 2. مكون ReceiptModal

هذا المكون يعرض الفاتورة ويطبعها:

```typescript
import ReceiptModal from '../components/ReceiptModal';

// الاستخدام في أي شاشة:
<ReceiptModal
  visible={showReceipt}
  onClose={() => setShowReceipt(false)}
  orderId="order_123"           // جلب الفاتورة من السيرفر
  autoPrint={true}              // طباعة تلقائية عند الفتح
/>

// أو للطباعة Offline:
<ReceiptModal
  visible={showReceipt}
  onClose={() => setShowReceipt(false)}
  localOrder={orderData}        // بيانات الطلب مباشرة (بدون API)
  autoPrint={true}
/>
```

### 3. Props المكون

| Prop | النوع | الوصف |
|------|------|-------|
| `visible` | `boolean` | إظهار/إخفاء Modal |
| `onClose` | `() => void` | دالة الإغلاق |
| `orderId` | `string?` | معرف الطلب (يجلب الفاتورة من السيرفر) |
| `invoiceId` | `string?` | معرف الفاتورة مباشرة |
| `autoPrint` | `boolean?` | طباعة تلقائية عند الفتح |
| `localOrder` | `any?` | بيانات طلب محلي (للطباعة Offline) |

### 4. بنية HTML للطباعة

الفاتورة المطبوعة تتضمن:

```
┌─────────────────────────────────────┐
│         اسم المطعم (عربي)          │
│         Restaurant Name (EN)       │
│         العنوان · الرقم الضريبي     │
├─────────────────────────────────────┤
│      فاتورة ضريبية مبسطة           │
│      Simplified Tax Invoice        │
├─────────────────────────────────────┤
│         ╔═══════════════╗           │
│         ║  الطلب #123   ║           │
│         ╚═══════════════╝           │
├─────────────────────────────────────┤
│ رقم الفاتورة: INV-001              │
│ التاريخ: 2026/03/02 10:30 AM       │
│ نوع الطلب: داخل المطعم              │
├─────────────────────────────────────┤
│ الكمية │ المنتج         │ السعر    │
├────────┼────────────────┼──────────┤
│   2    │ برجر كلاسيك    │ 50 ر.س   │
│   1    │ بطاطس كبير     │ 15 ر.س   │
├─────────────────────────────────────┤
│ المجموع الفرعي         │ 65.00 ر.س│
│ ضريبة 15%              │ 9.75 ر.س │
│ ─────────────────────────────────  │
│ الإجمالي               │ 74.75 ر.س│
├─────────────────────────────────────┤
│ الدفع: نقدي / Cash                 │
│ عدد المنتجات: 3                    │
├─────────────────────────────────────┤
│     شكراً لزيارتكم | Thank you     │
│         Powered by Trying          │
└─────────────────────────────────────┘
```

### 5. الكود الرئيسي للطباعة

```typescript
const _printInvoice = async (inv: any) => {
  // 1. استخراج بيانات المطعم
  const restaurantName = inv.restaurant?.nameAr || '';
  const address = getRestaurantAddress();
  const vatNumber = inv.restaurant?.vatNumber || '';

  // 2. بناء HTML للمنتجات
  const itemsHtml = inv.order?.items?.map((item: any) => `
    <tr>
      <td style="text-align:center;">${item.quantity}</td>
      <td style="text-align:right;">
        <div style="font-weight:bold;">${item.menuItem?.nameEn || item.itemName}</div>
        <div style="font-size:10px;color:#555;">${item.menuItem?.nameAr || ''}</div>
      </td>
      <td style="text-align:left;">${item.totalPrice} ر.س</td>
    </tr>
  `).join('');

  // 3. بناء HTML الكامل
  const html = `
  <!DOCTYPE html>
  <html dir="rtl" lang="ar">
  <head>
    <meta charset="UTF-8">
    <style>
      @page { margin: 5mm; size: 80mm auto; }
      body {
        font-family: Arial, sans-serif;
        font-size: 12px;
        max-width: 72mm;
        margin: 0 auto;
      }
      .center { text-align: center; }
      .bold { font-weight: bold; }
      .divider { border-top: 1px dashed #000; margin: 6px 0; }
      table { width: 100%; border-collapse: collapse; }
      .order-box {
        border: 2px solid #000;
        text-align: center;
        padding: 6px;
        font-size: 16px;
        font-weight: bold;
      }
    </style>
  </head>
  <body>
    <!-- معلومات المطعم -->
    <div class="center">
      <div style="font-size:16px;font-weight:bold;">${restaurantName}</div>
      ${vatNumber ? `<div style="font-size:10px;">الرقم الضريبي: ${vatNumber}</div>` : ''}
    </div>

    <div class="divider"></div>

    <!-- رقم الطلب -->
    <div class="order-box">الطلب #${inv.order?.orderNumber || '—'}</div>

    <!-- المنتجات -->
    <table>
      <thead>
        <tr><th>الكمية</th><th>المنتج</th><th>السعر</th></tr>
      </thead>
      <tbody>${itemsHtml}</tbody>
    </table>

    <!-- المجاميع -->
    <div class="divider"></div>
    <div>المجموع: ${inv.subtotal} ر.س</div>
    <div>الضريبة ${inv.taxRate}%: ${inv.taxAmount} ر.س</div>
    <div class="bold">الإجمالي: ${inv.total} ر.س</div>

    <div class="center" style="margin-top:8px;">
      <div>شكراً لزيارتكم</div>
    </div>
  </body>
  </html>
  `;

  // 4. تنفيذ الطباعة
  await Print.printAsync({ html });
};
```

### 6. الطباعة Offline (بدون سيرفر)

للطباعة بدون اتصال، مرر `localOrder` مباشرة:

```typescript
// بناء بيانات الفاتورة من الطلب المحلي
const localOrder = {
  orderNumber: '123',
  orderType: 'dine_in',
  customerName: 'أحمد',
  customerPhone: '0501234567',
  subtotal: '100.00',
  tax: '15.00',
  total: '115.00',
  paymentMethod: 'cash',
  isPaid: true,
  createdAt: new Date().toISOString(),
  items: [
    {
      menuItemId: 'item_1',
      itemName: 'برجر كلاسيك',
      nameAr: 'برجر كلاسيك',
      nameEn: 'Classic Burger',
      quantity: 2,
      unitPrice: '25.00',
      totalPrice: '50.00'
    }
  ],
  // معلومات المطعم للطباعة
  _restaurant: {
    nameAr: 'مطعم الوشل',
    nameEn: 'Washel Restaurant',
    vatNumber: '300012345678901',
    phone: '0501234567'
  }
};

// الطباعة
<ReceiptModal
  visible={true}
  onClose={() => {}}
  localOrder={localOrder}
  autoPrint={true}
/>
```

### 7. مشاركة الفاتورة (Share)

بدلاً من الطباعة، يمكن مشاركة نص الفاتورة:

```typescript
const handleShare = async () => {
  const text = `فاتورة #${invoice.invoiceNumber}
الطلب #${invoice.order?.orderNumber}

المنتجات:
${invoice.order?.items?.map(i => `  ${i.quantity}x ${i.menuItem?.nameEn} = ${i.totalPrice} ر.س`).join('\n')}

الإجمالي: ${invoice.total} ر.س
شكراً لزيارتكم - ${invoice.restaurant?.nameAr}`;

  await Share.share({ message: text });
};
```

### 8. تخصيص تصميم الفاتورة

لتغيير شكل الفاتورة، عدّل HTML في دالة `_printInvoice`:

- **تغيير حجم الخط**: عدّل `font-size` في CSS
- **تغيير عرض الورق**: عدّل `@page { size: 80mm auto; }` (للطابعات الحرارية 80mm أو 58mm)
- **إضافة لوجو**: أضف `<img src="..." />` (يجب أن يكون URL عام)
- **إضافة QR Code**: نستخدم `react-native-qrcode-svg` لإنشاء QR في الواجهة

### 9. الطباعة على طابعات حرارية

**expo-print** يستخدم نظام الطباعة الأصلي:
- **Android**: يرسل للطابعة عبر Bluetooth/WiFi المعرّفة في الإعدادات
- **iOS**: يستخدم AirPrint

للطابعات الحرارية المباشرة (ESC/POS)، قد تحتاج مكتبة متخصصة مثل `react-native-thermal-receipt-printer`.

### 10. أمثلة استخدام في PosScreen

```typescript
// في PosScreen بعد إتمام الطلب:
const [showReceipt, setShowReceipt] = useState(false);
const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);

const handleCheckout = async () => {
  const order = await api.createOrder(orderData);
  
  // عرض الفاتورة للطباعة
  setCurrentOrderId(order.id);
  setShowReceipt(true);
};

return (
  <>
    {/* ... باقي الشاشة */}
    
    <ReceiptModal
      visible={showReceipt}
      onClose={() => {
        setShowReceipt(false);
        setCurrentOrderId(null);
        clearCart();
      }}
      orderId={currentOrderId}
      autoPrint={true}
    />
  </>
);
```

---

## 🎨 السمات والألوان

### الملف: `src/config/theme.ts`

```typescript
export const COLORS = {
  primary: '#8B1A1A',           // أحمر غامق
  primaryLight: '#A52A2A',
  success: '#22C55E',           // أخضر
  warning: '#F59E0B',           // برتقالي
  error: '#EF4444',             // أحمر
  text: '#1F2937',              // رمادي داكن
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  background: '#F9FAFB',
  surface: '#FFFFFF',
  border: '#E5E7EB',
  card: '#FFFFFF',
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 16,
  full: 9999,
};
```

---

## 🌍 التعريب (i18n)

### الملف: `src/context/LanguageContext.tsx`

```typescript
import { useLang } from '../context/LanguageContext';

function Component() {
  const { language, setLanguage, t, isRTL } = useLang();
  
  return (
    <View style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
      <Text>{t('welcome')}</Text>          {/* مرحباً | Welcome */}
      <Button onPress={() => setLanguage('en')}>English</Button>
      <Button onPress={() => setLanguage('ar')}>عربي</Button>
    </View>
  );
}
```

**المصطلحات المدعومة**:
```typescript
{
  welcome: { ar: 'مرحباً', en: 'Welcome' },
  login: { ar: 'تسجيل دخول', en: 'Login' },
  logout: { ar: 'تسجيل خروج', en: 'Logout' },
  dashboard: { ar: 'الرئيسية', en: 'Dashboard' },
  pos: { ar: 'نقطة البيع', en: 'POS' },
  orders: { ar: 'الطلبات', en: 'Orders' },
  kitchen: { ar: 'المطبخ', en: 'Kitchen' },
  // ... والمزيد
}
```

---

## 🧪 أمثلة عملية كاملة

### مثال 1: إنشاء طلب كامل مع Offline Support

```typescript
import { useState } from 'react';
import { useCart } from '../context/CartContext';
import { useSync } from '../context/SyncContext';
import { api } from '../services/api';
import { database } from '../services/database';

function CreateOrderExample() {
  const { cart, clearCart, total } = useCart();
  const { isOnline } = useSync();
  const [loading, setLoading] = useState(false);
  
  const createOrder = async () => {
    setLoading(true);
    
    try {
      // بيانات الطلب
      const orderData = {
        orderType: 'dine_in',
        customerName: 'أحمد محمد',
        customerPhone: '0501234567',
        subtotal: total.toFixed(2),
        tax: (total * 0.15).toFixed(2),
        total: (total * 1.15).toFixed(2),
        paymentMethod: 'cash',
        isPaid: true,
        branchId: 'branch_123',
        items: cart.map(item => ({
          menuItemId: item.menuItemId,
          itemName: item.nameAr,
          quantity: item.quantity,
          unitPrice: item.price,
          totalPrice: (parseFloat(item.price) * item.quantity).toFixed(2),
          notes: item.notes
        }))
      };
      
      if (isOnline) {
        // Online: إرسال مباشر للسيرفر
        const order = await api.createOrder(orderData);
        
        // حفظ محلياً للكاش
        await database.saveOrder({
          ...order,
          synced: 1
        });
        
        console.log('تم إنشاء الطلب:', order.orderNumber);
        clearCart();
        return order;
      } else {
        // Offline: حفظ محلي + إضافة لطابور المزامنة
        const localId = await database.saveOrder({
          ...orderData,
          localId: `local_${Date.now()}`,
          synced: 0
        });
        
        await database.addToSyncQueue({
          type: 'order',
          action: 'create',
          data: orderData
        });
        
        console.log('تم حفظ الطلب محلياً - سيتم المزامنة عند الاتصال');
        clearCart();
        return { localId };
      }
    } catch (error) {
      console.error('فشل إنشاء الطلب:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Button onPress={createOrder} disabled={loading}>
      {loading ? 'جاري الحفظ...' : 'إتمام الطلب'}
    </Button>
  );
}
```

### مثال 2: دفع Tap-to-Pay كامل

```typescript
import { edfaPaySoftPos } from '../services/edfapay-softpos';

async function handlePayment(order: Order) {
  try {
    // 1. التحقق من التوفر
    if (!edfaPaySoftPos.isAvailable()) {
      alert('Tap-to-Pay غير مدعوم على هذا الجهاز');
      return;
    }
    
    // 2. التهيئة
    const initialized = await edfaPaySoftPos.init();
    if (!initialized) {
      alert('فشل تهيئة نظام الدفع');
      return;
    }
    
    // 3. معالجة الدفع
    const result = await edfaPaySoftPos.purchase(
      order.total,
      order.id
    );
    
    if (result.success && result.transaction) {
      // نجح الدفع
      console.log('معلومات الدفع:', {
        transactionNumber: result.transaction.transactionNumber,
        rrn: result.transaction.rrn,
        authCode: result.transaction.authCode,
        amount: result.transaction.amount,
        cardNumber: result.transaction.cardNumber,
        scheme: result.transaction.formattedScheme
      });
      
      // تحديث الطلب
      await api.updateOrderPayment(order.id, 'card', true);
      
      // إنشاء فاتورة
      await api.createInvoice({
        orderId: order.id,
        paymentTransactionNumber: result.transaction.transactionNumber,
        paymentRrn: result.transaction.rrn
      });
      
      alert('تم الدفع بنجاح');
    } else if (result.cancelledByUser) {
      console.log('ألغى المستخدم العملية');
    } else {
      console.error('فشل الدفع:', result.error);
      alert(`فشل الدفع: ${result.error}`);
    }
  } catch (error) {
    console.error('خطأ في الدفع:', error);
    alert('حدث خطأ أثناء الدفع');
  }
}
```

### مثال 3: شاشة Kitchen مع تحديث تلقائي

```typescript
import { useState, useEffect, useCallback } from 'react';
import { FlatList, TouchableOpacity, Text, View, Vibration } from 'react-native';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

function KitchenScreen() {
  const { branch } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  
  const loadOrders = useCallback(async () => {
    try {
      const all = await api.getOrders(branch?.id, 'today');
      
      // فقط pending + preparing
      const kitchen = all.filter(
        o => o.status === 'pending' || o.status === 'preparing'
      );
      
      // إشعار إذا طلبات جديدة
      const newCount = kitchen.filter(o => o.status === 'pending').length;
      if (newCount > orders.filter(o => o.status === 'pending').length) {
        Vibration.vibrate([0, 200, 100, 200]);
      }
      
      setOrders(kitchen);
    } catch (error) {
      console.error('فشل جلب الطلبات:', error);
    } finally {
      setLoading(false);
    }
  }, [branch, orders]);
  
  // تحديث كل 10 ثواني
  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 10000);
    return () => clearInterval(interval);
  }, [loadOrders]);
  
  const updateStatus = async (order: Order) => {
    const nextStatus = order.status === 'pending' ? 'preparing' : 'ready';
    await api.updateOrderStatus(order.id, nextStatus);
    loadOrders();
  };
  
  const pending = orders.filter(o => o.status === 'pending');
  const preparing = orders.filter(o => o.status === 'preparing');
  
  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      {/* عمود الطلبات الجديدة */}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', padding: 16 }}>
          جديد ({pending.length})
        </Text>
        <FlatList
          data={pending}
          keyExtractor={o => o.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={{ padding: 16, backgroundColor: '#FFF8EB', margin: 8 }}
              onPress={() => updateStatus(item)}
            >
              <Text style={{ fontSize: 20, fontWeight: 'bold' }}>
                #{item.orderNumber}
              </Text>
              <Text>{item.customerName}</Text>
            </TouchableOpacity>
          )}
        />
      </View>
      
      {/* عمود قيد التحضير */}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', padding: 16 }}>
          قيد التحضير ({preparing.length})
        </Text>
        <FlatList
          data={preparing}
          keyExtractor={o => o.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={{ padding: 16, backgroundColor: '#EBF5FF', margin: 8 }}
              onPress={() => updateStatus(item)}
            >
              <Text style={{ fontSize: 20, fontWeight: 'bold' }}>
                #{item.orderNumber}
              </Text>
              <Text>{item.customerName}</Text>
            </TouchableOpacity>
          )}
        />
      </View>
    </View>
  );
}
```

---

## 🔧 استكشاف الأخطاء

### 1. فشل تسجيل الدخول
```typescript
// تحقق من:
- الاتصال بالإنترنت
- صحة Email/Password
- حالة السيرفر: await api.checkServer()
```

### 2. EdfaPay لا يعمل
```typescript
// تأكد من:
- Android (iOS غير مدعوم)
- Auth Token صحيح
- minSdkVersion >= 29
- صلاحية NFC في Manifest
```

### 3. المزامنة لا تعمل
```typescript
// تحقق:
const { isOnline, isSyncing, pendingCount } = useSync();
console.log({ isOnline, isSyncing, pendingCount });

// مزامنة يدوية
await syncService.syncNow();
```

### 4. قاعدة البيانات لا تحفظ
```typescript
// تأكد من التهيئة
if (!database.db) {
  await database.init();
}

// تحقق من الأخطاء
try {
  await database.saveOrder(order);
} catch (error) {
  console.error('DB Error:', error);
}
```

---

## 📊 البنية الهرمية للمكونات

```
App.tsx
├── AuthProvider
│   ├── LanguageProvider
│   │   ├── CartProvider
│   │   │   ├── SyncProvider
│   │   │   │   ├── NavigationContainer
│   │   │   │   │   ├── TabNavigator
│   │   │   │   │   │   ├── DashboardScreen
│   │   │   │   │   │   ├── PosScreen
│   │   │   │   │   │   │   ├── MenuGrid
│   │   │   │   │   │   │   ├── CartPanel
│   │   │   │   │   │   │   └── TapToPayModal
│   │   │   │   │   │   ├── OrdersScreen
│   │   │   │   │   │   │   └── OrderCard
│   │   │   │   │   │   ├── KitchenScreen
│   │   │   │   │   │   └── SettingsScreen
```

---

## 🚀 نصائح للمبرمج

### 1. اختبار Offline Mode
```typescript
// في Developer Menu:
// - شغّل Airplane Mode
// - اختبر إنشاء طلبات
// - افصل Wi-Fi ثم وصّل
// - راقب console للـ sync logs
```

### 2. استخدام TypeScript بشكل صحيح
```typescript
// دائماً استخدم الـ types من src/types/index.ts
import type { Order, MenuItem, User } from '../types';

const order: Order = {...};
const items: MenuItem[] = [...];
```

### 3. معالجة Errors
```typescript
try {
  const result = await api.someEndpoint();
} catch (error: any) {
  // في Production: سجّل الخطأ
  console.error('API Error:', error.message);
  
  // في التطبيق: أظهر رسالة للمستخدم
  Alert.alert('خطأ', error.message || 'حدث خطأ غير متوقع');
}
```

### 4. Performance
```typescript
// استخدم React.memo للمكونات الثقيلة
const MenuGrid = React.memo(({ items, onSelect }) => {
  // ...
});

// استخدم useCallback للدوال
const handleSelect = useCallback((item) => {
  // ...
}, [dependencies]);
```

---

## 📝 ملخص سريع - Quick Reference

### تسجيل الدخول
```typescript
await api.login('email@example.com', 'password');
```

### جلب البيانات
```typescript
const categories = await api.getCategories();
const items = await api.getMenuItems();
const orders = await api.getOrders(branchId, 'today');
```

### إنشاء طلب
```typescript
const order = await api.createOrder({
  orderType: 'dine_in',
  total: '115.00',
  items: [{ menuItemId, quantity, unitPrice, totalPrice }]
});
```

### دفع NFC
```typescript
const result = await edfaPaySoftPos.purchase('115.00', orderId);
```

### تحديث حالة
```typescript
await api.updateOrderStatus(orderId, 'preparing');
```

### استرجاع
```typescript
await api.refundOrder(orderId, 'خطأ في الطلب');
```

---

## 🪑 نظام الطاولات والحجوزات والطابور (Tables, Reservations & Queue)

هذا القسم يشرح كيفية إضافة نظام إدارة الطاولات والحجوزات والطابور في تطبيق الجوال.

> **ملاحظة مهمة**: جميع الـ APIs جاهزة في السيرفر. المبرمج يحتاج فقط بناء الواجهات واستدعاء الـ APIs.

---

### 1. إدارة الطاولات (Tables)

#### 1.1 الـ API Endpoints

```typescript
// إضافة للملف: src/services/api.ts

// جلب جميع الطاولات
getTables: async (branchId?: string) => {
  const url = branchId ? `/api/tables?branch=${branchId}` : '/api/tables';
  return fetchWithAuth(url);
},

// جلب طاولة واحدة
getTable: async (tableId: string) => {
  return fetchWithAuth(`/api/tables/${tableId}`);
},

// إنشاء طاولة جديدة
createTable: async (data: CreateTableData) => {
  return fetchWithAuth('/api/tables', {
    method: 'POST',
    body: JSON.stringify(data),
  });
},

// تحديث طاولة
updateTable: async (tableId: string, data: UpdateTableData) => {
  return fetchWithAuth(`/api/tables/${tableId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
},

// تحديث حالة الطاولة
updateTableStatus: async (tableId: string, status: TableStatus) => {
  return fetchWithAuth(`/api/tables/${tableId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
},
```

#### 1.2 الـ Types

```typescript
// إضافة للملف: src/types/index.ts

interface Table {
  id: string;
  restaurantId: string;
  branchId?: string | null;
  tableNumber: string;      // "T1", "T2", "VIP-1"
  capacity: number;         // عدد المقاعد
  status: TableStatus;      // حالة الطاولة
  location?: string | null; // "صالة رئيسية", "تراس", "غرفة خاصة"
}

type TableStatus = 'available' | 'occupied' | 'reserved' | 'maintenance';

interface CreateTableData {
  tableNumber: string;
  capacity: number;
  location?: string;
  branchId?: string;
}
```

#### 1.3 مثال: شاشة إدارة الطاولات

```typescript
// src/screens/TablesScreen.tsx

import React, { useState, useEffect } from 'react';
import { View, FlatList, TouchableOpacity, Text, Alert } from 'react-native';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

const STATUS_COLORS = {
  available: '#22C55E',   // أخضر
  occupied: '#EF4444',    // أحمر
  reserved: '#F59E0B',    // برتقالي
  maintenance: '#6B7280', // رمادي
};

const STATUS_AR = {
  available: 'متاحة',
  occupied: 'مشغولة',
  reserved: 'محجوزة',
  maintenance: 'صيانة',
};

export default function TablesScreen() {
  const { branch } = useAuth();
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTables();
  }, [branch]);

  const loadTables = async () => {
    try {
      const data = await api.getTables(branch?.id);
      setTables(data);
    } catch (error) {
      console.error('Failed to load tables:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChangeStatus = async (table: Table) => {
    const options = ['available', 'occupied', 'reserved', 'maintenance'];
    const nextStatus = options[(options.indexOf(table.status) + 1) % options.length];
    
    try {
      await api.updateTableStatus(table.id, nextStatus);
      loadTables();
    } catch (error) {
      Alert.alert('خطأ', 'فشل تحديث حالة الطاولة');
    }
  };

  return (
    <View style={{ flex: 1, padding: 16 }}>
      <FlatList
        data={tables}
        numColumns={3}
        keyExtractor={t => t.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => handleChangeStatus(item)}
            style={{
              flex: 1,
              margin: 8,
              padding: 16,
              backgroundColor: STATUS_COLORS[item.status],
              borderRadius: 12,
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#FFF' }}>
              {item.tableNumber}
            </Text>
            <Text style={{ color: '#FFF', marginTop: 4 }}>
              {item.capacity} أشخاص
            </Text>
            <Text style={{ color: '#FFF', marginTop: 4, fontSize: 12 }}>
              {STATUS_AR[item.status]}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
```

---

### 2. نظام الحجوزات (Reservations)

#### 2.1 الـ API Endpoints

```typescript
// إضافة للملف: src/services/api.ts

// جلب الحجوزات
getReservations: async (branchId?: string, date?: string) => {
  let url = '/api/reservations';
  const params = [];
  if (branchId) params.push(`branch=${branchId}`);
  if (date) params.push(`date=${date}`);  // "2026-03-02"
  if (params.length) url += '?' + params.join('&');
  return fetchWithAuth(url);
},

// جلب حجز واحد
getReservation: async (reservationId: string) => {
  return fetchWithAuth(`/api/reservations/${reservationId}`);
},

// إنشاء حجز جديد
createReservation: async (data: CreateReservationData) => {
  return fetchWithAuth('/api/reservations', {
    method: 'POST',
    body: JSON.stringify(data),
  });
},

// تحديث حجز
updateReservation: async (reservationId: string, data: Partial<Reservation>) => {
  return fetchWithAuth(`/api/reservations/${reservationId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
},

// تحديث حالة الحجز
updateReservationStatus: async (reservationId: string, status: ReservationStatus) => {
  return fetchWithAuth(`/api/reservations/${reservationId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
},

// حذف حجز
deleteReservation: async (reservationId: string) => {
  return fetchWithAuth(`/api/reservations/${reservationId}`, {
    method: 'DELETE',
  });
},

// تأكيد دفع العربون
markDepositPaid: async (reservationId: string) => {
  return fetchWithAuth(`/api/reservations/${reservationId}/deposit`, {
    method: 'PUT',
  });
},

// فحص عربون بالجوال
checkDepositByPhone: async (phone: string) => {
  return fetchWithAuth(`/api/reservations/check-deposit?phone=${phone}`);
},

// الأوقات المتاحة للحجز
getAvailableSlots: async (branchId?: string, date?: string) => {
  let url = '/api/reservations/available-slots';
  if (date) url += `?date=${date}`;
  if (branchId) url += `&branch=${branchId}`;
  return fetchWithAuth(url);
},
```

#### 2.2 الـ Types

```typescript
// إضافة للملف: src/types/index.ts

interface Reservation {
  id: string;
  restaurantId: string;
  branchId?: string | null;
  reservationNumber: string;     // "RES-123456"
  tableId?: string | null;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  guestCount: number;            // عدد الضيوف
  reservationDate: string;       // "2026-03-02T00:00:00Z"
  reservationTime: string;       // "14:00"
  duration: number;              // بالدقائق (90 افتراضي)
  status: ReservationStatus;
  specialRequests?: string | null;
  notes?: string | null;
  source: 'website' | 'phone' | 'walk_in' | 'app';
  depositAmount: string;         // "20.00"
  depositPaid: boolean;
  reminderSent: boolean;
  createdAt: string;
}

type ReservationStatus = 
  | 'pending'      // في الانتظار
  | 'confirmed'    // مؤكد
  | 'seated'       // تم الجلوس
  | 'completed'    // مكتمل
  | 'cancelled'    // ملغي
  | 'no_show';     // لم يحضر

interface CreateReservationData {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  guestCount: number;
  reservationDate: string;    // "2026-03-02"
  reservationTime: string;    // "14:00"
  tableId?: string;           // اختياري - "any" أو ID معين
  specialRequests?: string;
  notes?: string;
  source?: 'app' | 'phone';
  branchId?: string;
}
```

#### 2.3 مثال: شاشة الحجوزات

```typescript
// src/screens/ReservationsScreen.tsx

import React, { useState, useEffect } from 'react';
import { View, FlatList, TouchableOpacity, Text, Alert, TextInput } from 'react-native';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

const STATUS_COLORS = {
  pending: '#F59E0B',
  confirmed: '#3B82F6',
  seated: '#22C55E',
  completed: '#6B7280',
  cancelled: '#EF4444',
  no_show: '#DC2626',
};

const STATUS_AR = {
  pending: 'في الانتظار',
  confirmed: 'مؤكد',
  seated: 'تم الجلوس',
  completed: 'مكتمل',
  cancelled: 'ملغي',
  no_show: 'لم يحضر',
};

export default function ReservationsScreen() {
  const { branch } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReservations();
  }, [branch, selectedDate]);

  const loadReservations = async () => {
    try {
      const data = await api.getReservations(branch?.id, selectedDate);
      setReservations(data);
    } catch (error) {
      console.error('Failed to load reservations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (reservation: Reservation, newStatus: ReservationStatus) => {
    try {
      await api.updateReservationStatus(reservation.id, newStatus);
      loadReservations();
      
      if (newStatus === 'seated') {
        Alert.alert('تم', `تم جلوس ${reservation.customerName}`);
      }
    } catch (error) {
      Alert.alert('خطأ', 'فشل تحديث الحالة');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Date Selector */}
      <View style={{ padding: 16, backgroundColor: '#FFF' }}>
        <TextInput
          value={selectedDate}
          onChangeText={setSelectedDate}
          placeholder="YYYY-MM-DD"
          style={{ borderWidth: 1, padding: 12, borderRadius: 8 }}
        />
      </View>

      <FlatList
        data={reservations}
        keyExtractor={r => r.id}
        renderItem={({ item }) => (
          <View style={{
            margin: 8,
            padding: 16,
            backgroundColor: '#FFF',
            borderRadius: 12,
            borderLeftWidth: 4,
            borderLeftColor: STATUS_COLORS[item.status],
          }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold' }}>
                {item.customerName}
              </Text>
              <Text style={{ color: STATUS_COLORS[item.status], fontWeight: 'bold' }}>
                {STATUS_AR[item.status]}
              </Text>
            </View>
            
            <Text style={{ color: '#666', marginTop: 4 }}>
              📞 {item.customerPhone}
            </Text>
            <Text style={{ color: '#666' }}>
              🕐 {item.reservationTime} · {item.guestCount} أشخاص
            </Text>
            {item.specialRequests && (
              <Text style={{ color: '#888', marginTop: 4 }}>
                📝 {item.specialRequests}
              </Text>
            )}
            
            {/* Action Buttons */}
            <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
              {item.status === 'pending' && (
                <TouchableOpacity
                  onPress={() => handleStatusChange(item, 'confirmed')}
                  style={{ backgroundColor: '#3B82F6', padding: 8, borderRadius: 6 }}
                >
                  <Text style={{ color: '#FFF' }}>تأكيد</Text>
                </TouchableOpacity>
              )}
              {item.status === 'confirmed' && (
                <TouchableOpacity
                  onPress={() => handleStatusChange(item, 'seated')}
                  style={{ backgroundColor: '#22C55E', padding: 8, borderRadius: 6 }}
                >
                  <Text style={{ color: '#FFF' }}>جلوس</Text>
                </TouchableOpacity>
              )}
              {item.status !== 'cancelled' && item.status !== 'completed' && (
                <TouchableOpacity
                  onPress={() => handleStatusChange(item, 'cancelled')}
                  style={{ backgroundColor: '#EF4444', padding: 8, borderRadius: 6 }}
                >
                  <Text style={{ color: '#FFF' }}>إلغاء</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      />
    </View>
  );
}
```

#### 2.4 إنشاء حجز جديد

```typescript
// مثال: إنشاء حجز
const createNewReservation = async () => {
  try {
    const reservation = await api.createReservation({
      customerName: 'محمد أحمد',
      customerPhone: '0501234567',
      guestCount: 4,
      reservationDate: '2026-03-05',
      reservationTime: '19:00',
      tableId: 'any',  // أو ID طاولة محددة
      specialRequests: 'طاولة هادئة بعيدة عن المدخل',
      source: 'app',
      branchId: branch?.id,
    });
    
    console.log('تم إنشاء الحجز:', reservation.reservationNumber);
    return reservation;
  } catch (error: any) {
    if (error.message === 'tableConflict') {
      Alert.alert('تعارض', 'الطاولة محجوزة في هذا الوقت');
    } else {
      Alert.alert('خطأ', error.message);
    }
  }
};
```

---

### 3. نظام الطابور (Queue/Waitlist)

#### 3.1 الـ API Endpoints

```typescript
// إضافة للملف: src/services/api.ts

// جلب قائمة الانتظار
getQueueEntries: async (branchId?: string, status?: string) => {
  let url = '/api/queue';
  const params = [];
  if (branchId) params.push(`branch=${branchId}`);
  if (status) params.push(`status=${status}`);
  if (params.length) url += '?' + params.join('&');
  return fetchWithAuth(url);
},

// إحصائيات الطابور
getQueueStats: async (branchId?: string) => {
  const url = branchId ? `/api/queue/stats?branch=${branchId}` : '/api/queue/stats';
  return fetchWithAuth(url);
},

// إضافة للطابور
addToQueue: async (data: AddToQueueData) => {
  return fetchWithAuth('/api/queue', {
    method: 'POST',
    body: JSON.stringify(data),
  });
},

// تحديث حالة في الطابور
updateQueueStatus: async (entryId: string, status: QueueStatus, tableId?: string) => {
  return fetchWithAuth(`/api/queue/${entryId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status, tableId }),
  });
},

// حذف من الطابور
removeFromQueue: async (entryId: string) => {
  return fetchWithAuth(`/api/queue/${entryId}`, {
    method: 'DELETE',
  });
},

// فحص موقع العميل في الطابور
checkQueuePosition: async (phone: string, branchId?: string) => {
  const url = branchId 
    ? `/api/queue/check/${phone}?branch=${branchId}` 
    : `/api/queue/check/${phone}`;
  return fetchWithAuth(url);
},
```

#### 3.2 الـ Types

```typescript
// إضافة للملف: src/types/index.ts

interface QueueEntry {
  id: string;
  restaurantId: string;
  branchId?: string | null;
  queueNumber: number;           // رقم الدور (1, 2, 3...)
  customerName: string;
  customerPhone: string;
  partySize: number;             // عدد الأشخاص
  status: QueueStatus;
  estimatedWaitMinutes?: number; // الوقت المتوقع
  notifiedAt?: string | null;    // وقت الإشعار
  seatedAt?: string | null;      // وقت الجلوس
  tableId?: string | null;
  notes?: string | null;
  createdAt: string;
  position?: number;             // الموقع الحالي في الطابور
}

type QueueStatus = 
  | 'waiting'   // في الانتظار
  | 'notified'  // تم إشعاره
  | 'seated'    // تم جلوسه
  | 'cancelled' // ألغى
  | 'no_show';  // لم يحضر

interface AddToQueueData {
  customerName: string;
  customerPhone: string;
  partySize: number;
  notes?: string;
  branchId?: string;
}

interface QueueStats {
  waitingCount: number;
  estimatedWaitMinutes: number;
}
```

#### 3.3 مثال: شاشة الطابور

```typescript
// src/screens/QueueScreen.tsx

import React, { useState, useEffect } from 'react';
import { View, FlatList, TouchableOpacity, Text, Alert, TextInput } from 'react-native';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function QueueScreen() {
  const { branch } = useAuth();
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [stats, setStats] = useState<QueueStats>({ waitingCount: 0, estimatedWaitMinutes: 0 });
  const [loading, setLoading] = useState(true);

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [partySize, setPartySize] = useState('2');

  useEffect(() => {
    loadQueue();
    // تحديث كل 30 ثانية
    const interval = setInterval(loadQueue, 30000);
    return () => clearInterval(interval);
  }, [branch]);

  const loadQueue = async () => {
    try {
      const [queueData, statsData] = await Promise.all([
        api.getQueueEntries(branch?.id, 'waiting'),
        api.getQueueStats(branch?.id),
      ]);
      setEntries(queueData);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to load queue:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToQueue = async () => {
    if (!name || !phone) {
      Alert.alert('خطأ', 'الاسم والجوال مطلوبان');
      return;
    }

    try {
      const entry = await api.addToQueue({
        customerName: name,
        customerPhone: phone,
        partySize: parseInt(partySize) || 2,
        branchId: branch?.id,
      });
      
      Alert.alert(
        'تم الإضافة', 
        `رقم الدور: ${entry.queueNumber}\nالانتظار المتوقع: ${entry.estimatedWaitMinutes} دقيقة`
      );
      
      setName('');
      setPhone('');
      setPartySize('2');
      loadQueue();
    } catch (error) {
      Alert.alert('خطأ', 'فشل الإضافة للطابور');
    }
  };

  const handleNotify = async (entry: QueueEntry) => {
    try {
      await api.updateQueueStatus(entry.id, 'notified');
      Alert.alert('تم', `تم إشعار ${entry.customerName}`);
      loadQueue();
    } catch (error) {
      Alert.alert('خطأ', 'فشل الإشعار');
    }
  };

  const handleSeat = async (entry: QueueEntry, tableId?: string) => {
    try {
      await api.updateQueueStatus(entry.id, 'seated', tableId);
      Alert.alert('تم', `تم جلوس ${entry.customerName}`);
      loadQueue();
    } catch (error) {
      Alert.alert('خطأ', 'فشل التسجيل');
    }
  };

  const handleRemove = async (entry: QueueEntry) => {
    Alert.alert(
      'تأكيد',
      `هل تريد إزالة ${entry.customerName} من الطابور؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'إزالة',
          style: 'destructive',
          onPress: async () => {
            await api.removeFromQueue(entry.id);
            loadQueue();
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Stats Header */}
      <View style={{ 
        padding: 20, 
        backgroundColor: '#8B1A1A', 
        flexDirection: 'row', 
        justifyContent: 'space-around' 
      }}>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: '#FFF', fontSize: 32, fontWeight: 'bold' }}>
            {stats.waitingCount}
          </Text>
          <Text style={{ color: '#FFF' }}>في الانتظار</Text>
        </View>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: '#FFF', fontSize: 32, fontWeight: 'bold' }}>
            {stats.estimatedWaitMinutes}
          </Text>
          <Text style={{ color: '#FFF' }}>دقيقة انتظار</Text>
        </View>
      </View>

      {/* Add Form */}
      <View style={{ padding: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderColor: '#EEE' }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            placeholder="الاسم"
            value={name}
            onChangeText={setName}
            style={{ flex: 2, borderWidth: 1, padding: 10, borderRadius: 8 }}
          />
          <TextInput
            placeholder="الجوال"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            style={{ flex: 2, borderWidth: 1, padding: 10, borderRadius: 8 }}
          />
          <TextInput
            placeholder="عدد"
            value={partySize}
            onChangeText={setPartySize}
            keyboardType="numeric"
            style={{ flex: 1, borderWidth: 1, padding: 10, borderRadius: 8 }}
          />
        </View>
        <TouchableOpacity
          onPress={handleAddToQueue}
          style={{ backgroundColor: '#22C55E', padding: 12, borderRadius: 8, marginTop: 8 }}
        >
          <Text style={{ color: '#FFF', textAlign: 'center', fontWeight: 'bold' }}>
            إضافة للطابور
          </Text>
        </TouchableOpacity>
      </View>

      {/* Queue List */}
      <FlatList
        data={entries}
        keyExtractor={e => e.id}
        renderItem={({ item, index }) => (
          <View style={{
            margin: 8,
            padding: 16,
            backgroundColor: '#FFF',
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
          }}>
            {/* Queue Number */}
            <View style={{
              width: 50,
              height: 50,
              borderRadius: 25,
              backgroundColor: '#8B1A1A',
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 12,
            }}>
              <Text style={{ color: '#FFF', fontSize: 20, fontWeight: 'bold' }}>
                {item.queueNumber}
              </Text>
            </View>

            {/* Info */}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold' }}>
                {item.customerName}
              </Text>
              <Text style={{ color: '#666' }}>
                📞 {item.customerPhone} · 👥 {item.partySize}
              </Text>
              <Text style={{ color: '#888', fontSize: 12 }}>
                انتظار: {item.estimatedWaitMinutes || (index + 1) * 10} دقيقة
              </Text>
            </View>

            {/* Actions */}
            <View style={{ gap: 4 }}>
              {item.status === 'waiting' && (
                <TouchableOpacity
                  onPress={() => handleNotify(item)}
                  style={{ backgroundColor: '#F59E0B', padding: 8, borderRadius: 6 }}
                >
                  <Text style={{ color: '#FFF', fontSize: 12 }}>إشعار</Text>
                </TouchableOpacity>
              )}
              {(item.status === 'waiting' || item.status === 'notified') && (
                <TouchableOpacity
                  onPress={() => handleSeat(item)}
                  style={{ backgroundColor: '#22C55E', padding: 8, borderRadius: 6 }}
                >
                  <Text style={{ color: '#FFF', fontSize: 12 }}>جلوس</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => handleRemove(item)}
                style={{ backgroundColor: '#EF4444', padding: 8, borderRadius: 6 }}
              >
                <Text style={{ color: '#FFF', fontSize: 12 }}>إزالة</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
    </View>
  );
}
```

---

### 4. ما يحتاجه المبرمج منك

#### 4.1 إعدادات المطعم المطلوبة (من لوحة التحكم)

تأكد من تفعيل الخدمات في إعدادات المطعم:

| الإعداد | الوصف | الموقع |
|---------|-------|--------|
| `serviceTableBooking` | تفعيل الحجوزات | الإعدادات > الخدمات |
| `serviceQueue` | تفعيل الطابور | الإعدادات > الخدمات |
| `reservationDuration` | مدة الحجز الافتراضية | الإعدادات > الحجوزات |
| `reservationDepositAmount` | مبلغ العربون | الإعدادات > الحجوزات |

#### 4.2 الطاولات (يجب إنشاؤها أولاً)

قبل استخدام الحجوزات، يجب إنشاء الطاولات من لوحة التحكم:

1. اذهب إلى **الإعدادات > الطاولات**
2. أضف طاولات جديدة مع:
   - رقم الطاولة (T1, T2, VIP-1...)
   - السعة (عدد المقاعد)
   - الموقع (صالة، تراس، خاص...)

#### 4.3 الصلاحيات

تأكد من أن المستخدم لديه صلاحية `permTables` للوصول لهذه الميزات.

---

### 5. ملخص الـ APIs الجاهزة

| الميزة | الـ Endpoint | الوظيفة |
|--------|-------------|---------|
| **الطاولات** | | |
| | `GET /api/tables` | جلب كل الطاولات |
| | `POST /api/tables` | إنشاء طاولة |
| | `PUT /api/tables/:id/status` | تحديث حالة الطاولة |
| **الحجوزات** | | |
| | `GET /api/reservations` | جلب الحجوزات |
| | `POST /api/reservations` | إنشاء حجز |
| | `PUT /api/reservations/:id/status` | تحديث حالة الحجز |
| | `GET /api/reservations/check-deposit?phone=` | فحص العربون |
| | `GET /api/reservations/available-slots?date=` | الأوقات المتاحة |
| **الطابور** | | |
| | `GET /api/queue` | جلب الطابور |
| | `POST /api/queue` | إضافة للطابور |
| | `PUT /api/queue/:id/status` | تحديث حالة |
| | `GET /api/queue/stats` | إحصائيات الطابور |
| | `GET /api/queue/check/:phone` | موقع العميل |

---

### 6. التكامل مع POS

عند إنشاء طلب لطاولة معينة:

```typescript
// ربط الطلب بالطاولة
const order = await api.createOrder({
  orderType: 'dine_in',
  tableId: 'table_123',  // ← ربط الطاولة
  // ... باقي البيانات
});

// الطاولة ستتحول تلقائياً لـ "occupied"
```

عند إكمال الطلب وإغلاق الفاتورة:

```typescript
// تحرير الطاولة
await api.updateTableStatus(tableId, 'available');
```

---

### 7. إشعارات Real-time (اختياري)

للحصول على تحديثات فورية عند حجز جديد أو إضافة للطابور:

```typescript
// في App.tsx أو شاشة الطاولات
import { useWebSocket } from '../services/websocket';

function TablesScreen() {
  const { lastMessage } = useWebSocket();

  useEffect(() => {
    if (lastMessage?.type === 'new_reservation') {
      // حجز جديد - حدث البيانات
      loadReservations();
      Alert.alert('حجز جديد', lastMessage.data.customerName);
    }
    
    if (lastMessage?.type === 'queue_update') {
      loadQueue();
    }
  }, [lastMessage]);
}
```

---

## ⏰ نظام الشفتات وإدارة اليوم (Day Sessions)

نظام الشفتات يتيح تتبع المبيعات والمصاريف يومياً مع فتح وإغلاق اليوم.

### 1. كيف يعمل النظام؟

```
┌──────────────────────────────────────────────────────────┐
│                    فتح الشفت                             │
│    POST /api/day-sessions/open                          │
│    { openingBalance: "500.00" }                         │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  ● كل طلب جديد يُحدّث الشفت تلقائياً:                    │
│    - totalSales += order.total                          │
│    - totalOrders += 1                                   │
│    - cashSales += (if cash)                             │
│    - cardSales += (if card)                             │
│                                                          │
│  ● التحويلات النقدية تُسجل في cash_transactions         │
│                                                          │
├──────────────────────────────────────────────────────────┤
│                    إغلاق الشفت                           │
│    POST /api/day-sessions/:id/close                     │
│    { closingBalance: "1850.00" }                        │
│                                                          │
│    الحسابات التلقائية:                                   │
│    expectedBalance = openingBalance + cashSales         │
│    difference = closingBalance - expectedBalance        │
│    status = "closed"                                     │
└──────────────────────────────────────────────────────────┘
```

> **ملاحظة**: إذا الشفت مغلق، لا يمكن إنشاء طلبات جديدة (السيرفر يرجع خطأ `daySessionClosed`)

---

### 2. الـ API Endpoints

```typescript
// إضافة للملف: src/services/api.ts

// جلب الشفت الحالي (المفتوح)
getCurrentSession: async (branchId?: string) => {
  const url = branchId 
    ? `/api/day-sessions/current?branch=${branchId}` 
    : '/api/day-sessions/current';
  return fetchWithAuth(url);
},

// فتح شفت جديد
openDaySession: async (data: OpenSessionData, branchId?: string) => {
  const url = branchId 
    ? `/api/day-sessions/open?branch=${branchId}` 
    : '/api/day-sessions/open';
  return fetchWithAuth(url, {
    method: 'POST',
    body: JSON.stringify(data),
  });
},

// إغلاق الشفت
closeDaySession: async (sessionId: string, data: CloseSessionData) => {
  return fetchWithAuth(`/api/day-sessions/${sessionId}/close`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
},

// جلب جميع الشفتات
getDaySessions: async (branchId?: string) => {
  const url = branchId 
    ? `/api/day-sessions?branch=${branchId}` 
    : '/api/day-sessions';
  return fetchWithAuth(url);
},

// جلب شفت محدد
getDaySession: async (sessionId: string) => {
  return fetchWithAuth(`/api/day-sessions/${sessionId}`);
},

// جلب التحويلات النقدية لشفت
getSessionTransactions: async (sessionId: string) => {
  return fetchWithAuth(`/api/day-sessions/${sessionId}/transactions`);
},

// إضافة تحويل نقدي
addCashTransaction: async (sessionId: string, data: CashTransactionData) => {
  return fetchWithAuth(`/api/day-sessions/${sessionId}/transactions`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
},
```

---

### 3. الـ Types

```typescript
// إضافة للملف: src/types/index.ts

interface DaySession {
  id: string;
  restaurantId: string;
  branchId?: string | null;
  date: string;                  // "2026-03-02"
  status: 'open' | 'closed';
  openedBy?: string | null;
  closedBy?: string | null;
  openedAt: string;
  closedAt?: string | null;
  openingBalance: string;        // الرصيد الافتتاحي
  closingBalance?: string | null;// الرصيد عند الإغلاق (الفعلي)
  expectedBalance?: string | null;// المتوقع (الافتتاحي + المبيعات النقدية)
  difference?: string | null;    // الفرق
  totalSales: string;            // إجمالي المبيعات
  totalOrders: number;           // عدد الطلبات
  cashSales: string;             // مبيعات نقدية
  cardSales: string;             // مبيعات بطاقة
  notes?: string | null;
}

interface OpenSessionData {
  openingBalance: string;
  notes?: string;
}

interface CloseSessionData {
  closingBalance: string;
  notes?: string;
}

interface CashTransaction {
  id: string;
  sessionId: string;
  type: 'deposit' | 'withdrawal' | 'adjustment';
  amount: string;
  reason?: string | null;
  performedBy?: string | null;
  createdAt: string;
}

interface CashTransactionData {
  type: 'deposit' | 'withdrawal' | 'adjustment';
  amount: string;
  reason?: string;
}
```

---

### 4. تقارير الشفتات

#### 4.1 جلب جميع الشفتات المغلقة

```typescript
GET /api/reports/day-sessions?branch={branchId}&startDate=2026-03-01&endDate=2026-03-31&status=closed

Response:
{
  "sessions": [
    {
      "id": "session_1",
      "date": "2026-03-02",
      "status": "closed",
      "openingBalance": "500.00",
      "closingBalance": "1850.00",
      "expectedBalance": "1900.00",
      "difference": "-50.00",
      "totalSales": "1500.00",
      "totalOrders": 25,
      "cashSales": "1400.00",
      "cardSales": "100.00"
    }
  ],
  "totals": {
    "totalSales": 45000,
    "totalOrders": 750,
    "cashSales": 40000,
    "cardSales": 5000,
    "totalDifference": -150,
    "sessionsCount": 30
  }
}
```

#### 4.2 ملخص شهري

```typescript
GET /api/reports/day-sessions/monthly-summary?branch={branchId}&year=2026&month=3

Response:
{
  "summary": {
    "year": 2026,
    "month": 3,
    "daysWorked": 28,
    "totalSales": 45000,
    "totalOrders": 750,
    "averageDailySales": 1607.14,
    "totalDifference": -150
  },
  "dailyData": [
    { "date": "2026-03-01", "totalSales": 1500, "totalOrders": 25, "difference": 0 },
    // ... كل يوم
  ]
}
```

#### 4.3 تفاصيل شفت واحد

```typescript
GET /api/reports/day-sessions/:id/details

Response:
{
  "session": { ... },
  "transactions": [
    { "type": "withdrawal", "amount": "200.00", "reason": "سحب للبنك" }
  ],
  "ordersCount": 25,
  "paymentBreakdown": {
    "cash": { "count": 20, "total": 1400 },
    "card": { "count": 5, "total": 100 }
  }
}
```

---

### 5. مثال: شاشة إدارة الشفت

```typescript
// src/screens/DaySessionScreen.tsx

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ScrollView } from 'react-native';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function DaySessionScreen() {
  const { branch } = useAuth();
  const [session, setSession] = useState<DaySession | null>(null);
  const [openingBalance, setOpeningBalance] = useState('');
  const [closingBalance, setClosingBalance] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCurrentSession();
  }, [branch]);

  const loadCurrentSession = async () => {
    try {
      const data = await api.getCurrentSession(branch?.id);
      setSession(data);
    } catch (error) {
      setSession(null);
    } finally {
      setLoading(false);
    }
  };

  // فتح الشفت
  const handleOpenSession = async () => {
    if (!openingBalance) {
      Alert.alert('خطأ', 'أدخل الرصيد الافتتاحي');
      return;
    }

    try {
      const newSession = await api.openDaySession({
        openingBalance,
        notes: 'فتح من التطبيق',
      }, branch?.id);
      
      setSession(newSession);
      Alert.alert('تم', 'تم فتح اليوم بنجاح');
    } catch (error: any) {
      Alert.alert('خطأ', error.message || 'فشل فتح اليوم');
    }
  };

  // إغلاق الشفت
  const handleCloseSession = async () => {
    if (!closingBalance) {
      Alert.alert('خطأ', 'أدخل الرصيد الفعلي');
      return;
    }

    if (!session) return;

    Alert.alert(
      'تأكيد إغلاق اليوم',
      `الرصيد المتوقع: ${parseFloat(session.openingBalance) + parseFloat(session.cashSales)} ريال\nالرصيد الفعلي: ${closingBalance} ريال`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'إغلاق',
          style: 'destructive',
          onPress: async () => {
            try {
              const closedSession = await api.closeDaySession(session.id, {
                closingBalance,
              });
              
              const diff = parseFloat(closedSession.difference || '0');
              if (diff !== 0) {
                Alert.alert(
                  'تم إغلاق اليوم',
                  `الفرق: ${diff > 0 ? '+' : ''}${diff.toFixed(2)} ريال\n${diff < 0 ? '⚠️ يوجد نقص في الصندوق' : '✅ يوجد زيادة'}`
                );
              } else {
                Alert.alert('تم', 'تم إغلاق اليوم بنجاح - الصندوق مطابق');
              }
              
              setSession(null);
              setClosingBalance('');
            } catch (error: any) {
              Alert.alert('خطأ', error.message || 'فشل إغلاق اليوم');
            }
          },
        },
      ]
    );
  };

  // إضافة تحويل نقدي
  const handleCashTransaction = async (type: 'deposit' | 'withdrawal') => {
    Alert.prompt(
      type === 'deposit' ? 'إيداع نقدي' : 'سحب نقدي',
      'أدخل المبلغ',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'تأكيد',
          onPress: async (amount) => {
            if (!amount || !session) return;
            
            try {
              await api.addCashTransaction(session.id, {
                type,
                amount,
                reason: type === 'deposit' ? 'إيداع نقدي' : 'سحب نقدي',
              });
              
              Alert.alert('تم', `تم ${type === 'deposit' ? 'الإيداع' : 'السحب'} بنجاح`);
              loadCurrentSession();
            } catch (error) {
              Alert.alert('خطأ', 'فشلت العملية');
            }
          },
        },
      ],
      'plain-text',
      '',
      'numeric'
    );
  };

  if (loading) {
    return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><Text>جاري التحميل...</Text></View>;
  }

  // إذا لا يوجد شفت مفتوح
  if (!session) {
    return (
      <View style={{ flex: 1, padding: 20, justifyContent: 'center' }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 }}>
          🔒 اليوم مغلق
        </Text>
        <Text style={{ textAlign: 'center', color: '#666', marginBottom: 30 }}>
          افتح اليوم لبدء استقبال الطلبات
        </Text>
        
        <TextInput
          placeholder="الرصيد الافتتاحي"
          value={openingBalance}
          onChangeText={setOpeningBalance}
          keyboardType="numeric"
          style={{
            borderWidth: 1,
            borderColor: '#DDD',
            padding: 15,
            borderRadius: 10,
            fontSize: 18,
            textAlign: 'center',
            marginBottom: 15,
          }}
        />
        
        <TouchableOpacity
          onPress={handleOpenSession}
          style={{
            backgroundColor: '#22C55E',
            padding: 15,
            borderRadius: 10,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: '#FFF', fontSize: 18, fontWeight: 'bold' }}>
            فتح اليوم
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // شفت مفتوح - عرض الإحصائيات
  return (
    <ScrollView style={{ flex: 1 }}>
      {/* Header */}
      <View style={{ backgroundColor: '#22C55E', padding: 20 }}>
        <Text style={{ color: '#FFF', fontSize: 16 }}>اليوم مفتوح</Text>
        <Text style={{ color: '#FFF', fontSize: 24, fontWeight: 'bold' }}>{session.date}</Text>
      </View>

      {/* Stats */}
      <View style={{ padding: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
          <StatBox label="المبيعات" value={`${session.totalSales} ر.س`} color="#3B82F6" />
          <StatBox label="الطلبات" value={session.totalOrders.toString()} color="#8B5CF6" />
        </View>
        
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
          <StatBox label="نقدي" value={`${session.cashSales} ر.س`} color="#22C55E" />
          <StatBox label="شبكة" value={`${session.cardSales} ر.س`} color="#F59E0B" />
        </View>

        <View style={{ backgroundColor: '#F3F4F6', padding: 15, borderRadius: 10, marginBottom: 15 }}>
          <Text style={{ color: '#666' }}>الرصيد الافتتاحي</Text>
          <Text style={{ fontSize: 20, fontWeight: 'bold' }}>{session.openingBalance} ر.س</Text>
        </View>

        {/* التحويلات النقدية */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
          <TouchableOpacity
            onPress={() => handleCashTransaction('deposit')}
            style={{ flex: 1, backgroundColor: '#22C55E', padding: 12, borderRadius: 8, alignItems: 'center' }}
          >
            <Text style={{ color: '#FFF' }}>+ إيداع</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleCashTransaction('withdrawal')}
            style={{ flex: 1, backgroundColor: '#EF4444', padding: 12, borderRadius: 8, alignItems: 'center' }}
          >
            <Text style={{ color: '#FFF' }}>- سحب</Text>
          </TouchableOpacity>
        </View>

        {/* إغلاق اليوم */}
        <View style={{ borderTopWidth: 1, borderColor: '#EEE', paddingTop: 20 }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 10 }}>إغلاق اليوم</Text>
          
          <TextInput
            placeholder="الرصيد الفعلي في الصندوق"
            value={closingBalance}
            onChangeText={setClosingBalance}
            keyboardType="numeric"
            style={{
              borderWidth: 1,
              borderColor: '#DDD',
              padding: 15,
              borderRadius: 10,
              fontSize: 18,
              textAlign: 'center',
              marginBottom: 15,
            }}
          />
          
          <TouchableOpacity
            onPress={handleCloseSession}
            style={{
              backgroundColor: '#EF4444',
              padding: 15,
              borderRadius: 10,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#FFF', fontSize: 18, fontWeight: 'bold' }}>
              إغلاق اليوم
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

// مكون الإحصائية
function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={{
      flex: 1,
      backgroundColor: color,
      padding: 15,
      borderRadius: 10,
      marginHorizontal: 5,
      alignItems: 'center',
    }}>
      <Text style={{ color: '#FFF', fontSize: 12 }}>{label}</Text>
      <Text style={{ color: '#FFF', fontSize: 20, fontWeight: 'bold' }}>{value}</Text>
    </View>
  );
}
```

---

### 6. ملخص APIs الشفتات

| Method | Endpoint | الوظيفة |
|--------|----------|---------|
| `GET` | `/api/day-sessions` | جلب جميع الشفتات |
| `GET` | `/api/day-sessions/current` | الشفت المفتوح حالياً |
| `POST` | `/api/day-sessions/open` | **فتح شفت جديد** |
| `POST` | `/api/day-sessions/:id/close` | **إغلاق الشفت** |
| `GET` | `/api/day-sessions/:id/transactions` | التحويلات النقدية |
| `POST` | `/api/day-sessions/:id/transactions` | إضافة تحويل |
| `GET` | `/api/reports/day-sessions` | **تقرير الشفتات** |
| `GET` | `/api/reports/day-sessions/monthly-summary` | **ملخص شهري** |
| `GET` | `/api/reports/day-sessions/:id/details` | **تفاصيل شفت** |

---

### 7. مكان حفظ البيانات

البيانات تُحفظ في **قاعدة البيانات PostgreSQL**:

| الجدول | الوصف |
|--------|-------|
| `day_sessions` | بيانات الشفتات (الأرصدة، المبيعات، الفروقات) |
| `cash_transactions` | التحويلات النقدية (إيداع/سحب/تعديل) |

كل شيء محفوظ ويمكن الرجوع له في أي وقت للتقارير والمراجعة.

---

## 🎯 الخلاصة

هذا التطبيق يوفر:
✅ نظام POS كامل مع Offline Support
✅ مزامنة تلقائية في الخلفية
✅ دفع NFC عبر EdfaPay
✅ نظام صلاحيات متقدم
✅ دعم عربي/إنجليزي كامل
✅ قاعدة بيانات محلية SQLite
✅ واجهة سريعة وسلسة
✅ **نظام إدارة الطاولات**
✅ **نظام الحجوزات مع العربون**
✅ **نظام الطابور/قائمة الانتظار**
✅ **نظام الشفتات وإدارة اليوم**
✅ **تقارير إغلاق الشفتات**

**للمبرمج - ما يحتاجه:**
1. ✅ الـ APIs جاهزة بالكامل في السيرفر
2. 📋 أضف الطاولات من لوحة التحكم أولاً
3. ⚙️ فعّل `serviceTableBooking` و `serviceQueue` في الإعدادات
4. 🔧 استخدم الكود الجاهز في هذا المستند

**للدعم الفني**: راجع الكود في `trying_pos_app/src/`

**السيرفر**: https://tryingpos.com
**API Docs**: راجع `server/routes.ts` في المشروع الرئيسي

---

**آخر تحديث**: مارس 2026
**الإصدار**: 1.0.0

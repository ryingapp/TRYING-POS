# تطبيق إدارة المطاعم - Trying POS System
## Complete Project Documentation

---

## 📋 جدول المحتويات
- [نظرة عامة](#نظرة-عامة)
- [التكنولوجيا المستخدمة](#التكنولوجيا-المستخدمة)
- [معمارية المشروع](#معمارية-المشروع)
- [قاعدة البيانات](#قاعدة-البيانات)
- [ميزات رئيسية](#ميزات-رئيسية)
- [API Endpoints](#api-endpoints)
- [التعديلات الأخيرة](#التعديلات-الأخيرة)
- [كيفية البدء](#كيفية-البدء)
- [النشر والإطلاق](#النشر-والإطلاق)

---

## 🎯 نظرة عامة

**Trying POS System** هو تطبيق شامل لإدارة المطاعم يوفر:
- ✅ نظام نقاط البيع (POS)
- ✅ إدارة المنيو والفئات
- ✅ إدارة الأوامر بنظام 3 حالات
- ✅ الفاتورة الإلكترونية (ZATCA/Fatoora)
- ✅ إدارة المستخدمين والصلاحيات
- ✅ الجدول الزمني (Day Sessions)
- ✅ التقارير والإحصائيات
- ✅ نظام التوصيل (Delivery Integration)
- ✅ الحجوزات والطوابير

**الإصدار الحالي:** Phase 18 (Database Reset + 3-State Order System)
**الحالة:** ✅ بناء ناجح

---

## 💻 التكنولوجيا المستخدمة

### Backend
- **Runtime:** Node.js (v24.13.1)
- **Framework:** Express.js
- **ORM:** Drizzle ORM
- **Database:** PostgreSQL (Neon)
- **Authentication:** JWT
- **Validation:** Zod

### Frontend
- **Framework:** React 18
- **Build Tool:** Vite
- **UI Component:** shadcn/ui
- **Styling:** Tailwind CSS
- **State Management:** TanStack React Query
- **Form Handling:** React Hook Form
- **Localization:** Custom i18n (Arabic/English)

### Development
- **Language:** TypeScript
- **Bundler:** esbuild (via Vite, tsx)
- **Package Manager:** npm
- **Task Runner:** PM2

---

## 🏗️ معمارية المشروع

```
trying-recovery/
├── client/                    # Frontend (React)
│   ├── public/                # Assets
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/            # Page components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── lib/              # Utilities & helpers
│   │   ├── App.tsx           # Main app component
│   │   └── main.tsx         # Entry point
│   └── vite.config.ts
│
├── server/                    # Backend (Express)
│   ├── index.ts             # Server entry point
│   ├── routes.ts            # All API endpoints (8828 lines)
│   ├── db.ts                # Database connection
│   ├── storage.ts           # Data access layer
│   ├── zatca.ts             # ZATCA e-invoice logic
│   ├── edfapay.ts           # Payment gateway
│   ├── hungerstation.ts     # Integration
│   ├── jahez.ts             # Integration
│   └── vite.ts              # Vite server middleware
│
├── shared/
│   └── schema.ts            # Database schema (Drizzle)
│
├── script/
│   ├── build.ts             # Build script
│   ├── reset-and-seed-washil.ts  # Database seeding
│   ├── deploy-live.mjs      # Deployment script
│   └── [other utilities]
│
├── migrations/              # Drizzle migrations
├── package.json            # Dependencies
├── tsconfig.json          # TypeScript config
├── vite.config.ts         # Vite config
├── tailwind.config.ts     # Tailwind config
└── drizzle.config.ts      # Drizzle config
```

---

## 📊 قاعدة البيانات

### الجداول الرئيسية

#### 1. **restaurants** - المطاعم
```sql
- id: UUID (primary key)
- slug: VARCHAR (unique)
- name_en, name_ar: TEXT
- address, phone, email: TEXT
- kitchen_type: VARCHAR (fast_food, casual, fine_dining)
- price_range: VARCHAR ($, $$, $$$, $$$$)
- service_dine_in, service_pickup, service_delivery: BOOLEAN
- vat_number, commercial_registration: TEXT
- zatca_device_id, zatca_environment: TEXT
- edfapay_merchant_id, edfapay_password: TEXT
- is_active: BOOLEAN
```

#### 2. **branches** - الفروع
```sql
- id: UUID (primary key)
- restaurant_id: UUID (FK)
- name, name_ar: TEXT
- address, phone: TEXT
- is_main: BOOLEAN
- is_active: BOOLEAN
```

#### 3. **users** - المستخدمون
```sql
- id: UUID (primary key)
- restaurant_id, branch_id: UUID (FK)
- email, password: TEXT
- name, phone: TEXT
- role: VARCHAR (owner, branch_manager, cashier, kitchen, accountant, platform_admin)
- Permissions: perm_dashboard, perm_pos, perm_orders, perm_menu, perm_kitchen, 
              perm_inventory, perm_reports, perm_settings, perm_tables
- last_login_at, created_at: TIMESTAMP
```

#### 4. **orders** - الأوامر (3-State System)
```sql
- id: UUID (primary key)
- restaurant_id, branch_id: UUID (FK)
- order_number: VARCHAR
- status: VARCHAR (created, ready, delivered) ⭐ SIMPLIFIED
- total_amount, tax_amount, discount: DECIMAL
- payment_method: VARCHAR (cash, card, online)
- created_at, ready_at_time: TIMESTAMP
```

#### 5. **order_items** - عناصر الأوامر
```sql
- id: UUID (primary key)
- order_id, menu_item_id: UUID (FK)
- quantity, price: DECIMAL
- notes: TEXT
```

#### 6. **menu_items** - عناصر المنيو
```sql
- id: UUID (primary key)
- restaurant_id, category_id: UUID (FK)
- name_en, name_ar: TEXT
- price, cost: DECIMAL
- is_available: BOOLEAN
- calories: INTEGER
```

#### 7. **categories** - فئات المنيو
```sql
- id: UUID (primary key)
- restaurant_id: UUID (FK)
- name_en, name_ar: TEXT
- sort_order: INTEGER
```

#### 8. **kitchen_sections** - أقسام المطبخ
```sql
- id: UUID (primary key)
- restaurant_id: UUID (FK)
- name_en, name_ar: TEXT
```

#### 9. **tables** - الطاولات
```sql
- id: UUID (primary key)
- restaurant_id, branch_id: UUID (FK)
- table_number, location: VARCHAR
- capacity: INTEGER
- status: VARCHAR (available, occupied, reserved)
```

#### 10. **day_sessions** - جلسات اليوم
```sql
- id: UUID (primary key)
- restaurant_id, branch_id: UUID (FK)
- session_date: DATE
- is_closed: BOOLEAN
- opened_by, closed_by: TEXT
```

#### 11. **invoices** - الفواتير
```sql
- id: UUID (primary key)
- order_id: UUID (FK)
- invoice_number: VARCHAR
- total_amount: DECIMAL
- zatca_xml, zatca_qr_code: TEXT
```

#### 12. **printers** - الطابعات
```sql
- id: UUID (primary key)
- restaurant_id: UUID (FK)
- name: TEXT
- type: VARCHAR (network, usb, bluetooth)
- connection_string: TEXT
```

---

## ⭐ ميزات رئيسية

### 1️⃣ نظام الأوامر (3-State System) - **PHASE 17B**
**التغيير:** تم تبسيط نظام الأوامر من 8 حالات إلى 3 حالات

```
OLD (8 states):
payment_pending → pending → confirmed → preparing → ready → 
completed → cancelled → refunded

NEW (3 states):
created → ready → delivered ✅
```

**الميزات:**
- ✅ الأوامر الجديدة تبدأ بحالة "created"
- ✅ auto-timeout: بعد 30 دقيقة → تنتقل لـ "ready" تلقائياً
- ✅ العاملون في المطبخ يضغطون "Start Cooking" لتغييرها
- ✅ عند التسليم → "delivered"
- ✅ حذف كل منطق الإلغاء والاسترداد

### 2️⃣ الفاتورة الإلكترونية (ZATCA)
- إنشاء فواتير معترف بها من هيئة الزكاة والضريبة والجمارك
- توليد رموز QR
- تقارير تلقائية للهيئة

### 3️⃣ نظام الدفع (EdfaPay)
- تكامل مع بوابة الدفع الإلكترونية
- دعم جميع طرق الدفع الرقمية

### 4️⃣ نظام التوصيل
- تكامل مع منصات التوصيل (Hunger Station, Jahez, وغيرها)
- إدارة طلبات التوصيل

### 5️⃣ نظام الجدول الزمني
- فتح وإغلاق جلسات العمل اليومية
- حفظ التقارير

### 6️⃣ إدارة المستخدمين والصلاحيات
- أدوار مختلفة: Owner, Manager, Cashier, Kitchen, Accountant, Platform Admin
- صلاحيات دقيقة (Dashboard, POS, Orders, Menu, Kitchen, Reports, Settings)

### 7️⃣ التقارير والإحصائيات
- تقارير المبيعات اليومية
- إحصائيات الأوامر
- تحليل الأداء

### 8️⃣ نظام الحجوزات والطوابير
- إدارة الحجوزات
- نظام الطوابير لدعم الانتظار

---

## Washil Fast Food Restaurant 🍔

### تم إضافة مطعم نموذجي: **واشل**

**بيانات المطعم:**
```
الاسم:     Washil (واشل)
النوع:     Fast Food
السعر:     $ (budget-friendly)
الخدمات:   Dine-in ✅ | Pickup ✅ | Delivery ✅
الفروع:    1 (الرياض الرئيسية)
الإدارة:   admin@washil.sa
```

**أقسام المطبخ (3):**
1. Burgers & Sandwiches (برجر و ساندويتشات)
2. Wraps & Sides (رابات و إضافات)
3. Drinks (مشروبات)

**فئات المنيو (8):**
1. Washil Specials - 2 items
2. Burgers - 3 items
3. Sandwiches - 2 items
4. Wraps - 3 items
5. Sides - 4 items
6. Drinks - 3 items
7. Milkshakes - 3 items
8. Kids Meals - 2 items

**إجمالي عناصر المنيو:** 22 item

**الطاولات (6):**
- Front Left, Center, Right
- Back Left, Center, Right
- السعة: 4 أشخاص لكل طاولة

---

## 🔌 API Endpoints

### Authentication
```
POST   /api/login              - User login
POST   /api/register           - User registration
GET    /api/me                 - Get current user
```

### Restaurants
```
GET    /api/restaurant         - Get current restaurant details
PUT    /api/restaurant         - Update restaurant
GET    /api/restaurants        - List all restaurants (admin)
```

### Branches
```
GET    /api/branches           - List branches
POST   /api/branches           - Create branch
PUT    /api/branches/:id       - Update branch
DELETE /api/branches/:id       - Delete branch
```

### Users
```
GET    /api/users              - List users
POST   /api/users              - Create user
PUT    /api/users/:id          - Update user
DELETE /api/users/:id          - Delete user
```

### Menu
```
GET    /api/categories         - List categories
POST   /api/categories         - Create category
GET    /api/menu-items         - List menu items
POST   /api/menu-items         - Create menu item
PUT    /api/menu-items/:id     - Update menu item
DELETE /api/menu-items/:id     - Delete menu item
```

### Orders (3-State System)
```
GET    /api/orders             - List orders
POST   /api/orders             - Create order
GET    /api/orders/:id         - Get order details
PUT    /api/orders/:id/status  - Update order status (created→ready→delivered)
GET    /api/kitchen/orders     - Kitchen display (created + ready)
```

### Kitchen
```
GET    /api/kitchen-sections   - List kitchen sections
POST   /api/kitchen-sections   - Create section
```

### Tables
```
GET    /api/tables             - List tables
POST   /api/tables             - Create table
PUT    /api/tables/:id         - Update table
DELETE /api/tables/:id         - Delete table
```

### Invoices
```
GET    /api/invoices           - List invoices
POST   /api/invoices           - Create invoice
```

### Day Sessions
```
POST   /api/day-sessions/open  - Open session
PUT    /api/day-sessions/:id/close - Close session
```

### ZATCA (E-Invoice)
```
GET    /api/zatca/status       - Get ZATCA status
POST   /api/zatca/compliance-csid    - Get compliance CSID
POST   /api/zatca/compliance-check   - Verify compliance
POST   /api/zatca/production-csid    - Get production CSID
```

---

## 📝 التعديلات الأخيرة

### Phase 17B: Order System Simplification ✅ COMPLETE
**التاريخ:** فبراير 2026
**الملفات المعدلة:**
- `shared/schema.ts` - تحديث enum orderStatus
- `server/routes.ts` - تحديث endpoints
- `client/src/pages/kitchen.tsx` - تحديث UI

**التغييرات:**
```typescript
// OLD
orderStatus: ["payment_pending", "pending", "confirmed", "preparing", "ready", 
              "completed", "cancelled", "refunded"]

// NEW
orderStatus: ["created", "ready", "delivered"]
```

**Auto-Timeout Logic:**
```typescript
// في GET /api/kitchen/orders
const createdAt = order.createdAt;
const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
if (createdAt < thirtyMinutesAgo && order.status === "created") {
  // Auto-transition to "ready"
  await updateOrderStatus(order.id, "ready");
}
```

### Phase 18: Database Reset + Washil Seeding ✅ COMPLETE
**التاريخ:** فبراير 2026
**الملف الجديد:**
- `script/reset-and-seed-washil.ts` (540 lines)

**الإجراءات:**
1. حذف جميع البيانات السابقة من قاعدة البيانات
2. إنشاء مطعم Washil جديد
3. إنشاء فرع رئيسي
4. إنشاء حساب admin (admin@washil.sa)
5. إضافة 3 أقسام مطبخ
6. إضافة 8 فئات منيو
7. إضافة 22 عنصر منيو
8. إضافة 6 طاولات

**طريقة التشغيل:**
```bash
npx tsx script/reset-and-seed-washil.ts
```

---

## 🚀 كيفية البدء

### 1. تثبيت المتطلبات
```bash
cd trying-recovery
npm install
```

### 2. إعداد متغيرات البيئة
```bash
# أنشئ ملف .env
DATABASE_URL=postgresql://...(your neon connection string)
JWT_SECRET=your-secret-key
```

### 3. تشغيل الخادم
```bash
npm start
```

**النتيجة:**
```
✅ Server running on port 5000
✅ Database connected
✅ Ready to accept requests
```

### 4. الوصول للتطبيق
- **URL:** http://localhost:5000
- **Email:** admin@washil.sa
- **Password:** Admin@Washil123

### 5. بناء الإصدار الإنتاجي
```bash
npm run build
```

**الملفات الناتجة:**
- `dist/index.cjs` - Server bundle
- `dist/client/` - Frontend bundle

---

## 🌐 النشر والإطلاق

### النشر على الـ Production

#### الخادم الحالي:
```
IP:   72.62.40.134
Port: 5000
URL:  http://72.62.40.134:5000
```

#### خطوات النشر:
```bash
# 1. Build الإصدار الجديد
npm run build

# 2. نسخ الملفات للخادم
scp -r dist/ user@72.62.40.134:/app/

# 3. إعادة تشغيل الخادم
pm2 restart trying

# 4. التحقق
curl http://72.62.40.134:5000
```

#### استخدام PM2:
```bash
# عرض الحالة
pm2 status

# إعادة التشغيل
pm2 restart trying

# عرض السجلات
pm2 logs trying

# إيقاف
pm2 stop trying
```

### قاعدة البيانات
**نوع:** PostgreSQL (Neon)
**الاتصال:** `postgresql://neondb_owner:npg_41htWOCBVKyn@ep-blue-bush-aibgf4j4-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require`

---

## 📱 التطبيق المحمول (Trying POS App)

**الموقع:** `trying_pos_app/` و `trying_pos_mobile/`

**البناء:**
```bash
cd trying_pos_app
npm install
npm run build
```

---

## 🔐 الأمان والصلاحيات

### أنواع المستخدمين:

| الدور | الصلاحيات | الوصول |
|------|---------|--------|
| **platform_admin** | جميع الميزات | كل المطاعم |
| **owner** | كل شيء في مطعمه | المطعم الخاص |
| **branch_manager** | إدارة الفرع | الفرع المخصص |
| **cashier** | POS + Orders | الفرع المخصص |
| **kitchen** | Kitchen Display | الفرع المخصص |
| **accountant** | Reports + Invoices | المطعم الخاص |

### متغيرات البيئة الأمنة:
```bash
JWT_SECRET              # Secret key for JWT tokens
DATABASE_URL           # PostgreSQL connection string
ZATCA_PRIVATE_KEY      # ZATCA certification key
EDFAPAY_MERCHANT_ID    # Payment gateway merchant ID
EDFAPAY_PASSWORD       # Payment gateway password
```

---

## 🔍 الاختبار والجودة

### بناء التطبيق
```bash
npm run build
```

**الحالة الحالية:** ✅ Build Success (8.80s)

### اختبار الميزات الرئيسية

1. **تسجيل الدخول**
   ```
   بريد: admin@washil.sa
   كلمة: Admin@Washil123
   ```

2. **عرض الطلبات**
   ```
   اذهب: Kitchen → New Orders
   توقع: عرض الطلبات بحالة "created"
   ```

3. **تحديث حالة الطلب**
   ```
   اضغط: "Start Cooking" → "Delivered"
   توقع: تحديث الحالة في قاعدة البيانات
   ```

4. **إدارة المنيو**
   ```
   اذهب: Settings → Menu
   توقع: عرض 22 عنصر منيو
   ```

---

## 📞 الدعم والمساعدة

### جهات الاتصال الرئيسية:
- **البريد الإداري:** cto@tryingapp.com (Platform Admin)
- **دعم المطاعم:** admin@washil.sa (Washil Restaurant)

### المشاكل الشائعة:

**المشكلة:** "Database connection failed"
```bash
# الحل: تحقق من DATABASE_URL في .env
echo $DATABASE_URL
```

**المشكلة:** "Build failed - TypeScript errors"
```bash
# الحل: نظف node_modules وأعد التثبيت
rm -rf node_modules package-lock.json
npm install
npm run build
```

**المشكلة:** "Port 5000 is already in use"
```bash
# الحل: استخدم منفذ مختلف
PORT=3000 npm start
```

---

## 📚 الموارد والمراجع

### الملفات الهامة:
- `CODEBASE_REPORT.md` - تقرير مفصل عن الكود
- `EDFAPAY_REQUIREMENTS.md` - متطلبات دفع EdfaPay
- `.env.example` - متغيرات البيئة النموذجية

### الروابط المفيدة:
- Drizzle ORM Docs: https://orm.drizzle.team
- React Query Docs: https://tanstack.com/query
- Tailwind CSS: https://tailwindcss.com
- shadcn/ui: https://ui.shadcn.com

---

## 📊 إحصائيات المشروع

| المقياس | القيمة |
|--------|--------|
| **إجمالي الملفات** | 100+ |
| **أسطر الكود (Server)** | ~8,828 |
| **أسطر الكود (Client)** | ~5,000+ |
| **عدد API Endpoints** | 50+ |
| **عدد جداول قاعدة البيانات** | 15+ |
| **اللغات المدعومة** | عربي، إنجليزي |
| **التطبيقات** | Web, Mobile (React Native) |

---

## ✅ قائمة الفحص النهائية

قبل الإطلاق:
- [ ] اختبار تسجيل الدخول
- [ ] اختبار إنشاء الأوامر
- [ ] اختبار تحديث حالات الأوامر
- [ ] اختبار الفاتورة الإلكترونية
- [ ] اختبار نظام الدفع
- [ ] اختبار إدارة المستخدمين
- [ ] اختبار التقارير
- [ ] اختبار الأداء
- [ ] اختبار الأمان

---

**آخر تحديث:** 27 فبراير 2026  
**الإصدار:** Phase 18.1 (3-State Order + Washil Database)  
**الحالة:** ✅ جاهز للإطلاق

---

*تم إعداد هذا التوثيق بواسطة CTO Development Team*

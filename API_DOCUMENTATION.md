# TryingPOS - توثيق API الكامل
# Complete API Documentation for Mobile App Development

---

## 📋 Overview | نظرة عامة

| Property | Value |
|----------|-------|
| **Base URL** | `https://tryingpos.com` |
| **Auth Type** | JWT Bearer Token |
| **Token Expiry** | 7 days |
| **Content-Type** | `application/json` |

### Authentication Header | ترويسة المصادقة
```
Authorization: Bearer <jwt_token>
```

---

# 🔐 1. Authentication | المصادقة

## POST `/api/auth/login`
**Login | تسجيل الدخول**

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "Ahmed",
    "role": "cashier",
    "restaurantId": "uuid",
    "branchId": "uuid",
    "permDashboard": true,
    "permPos": true,
    "permOrders": true,
    "permMenu": false,
    "permKitchen": true,
    "permInventory": false,
    "permReviews": false,
    "permMarketing": false,
    "permQr": false,
    "permReports": false,
    "permSettings": false,
    "permTables": true
  },
  "restaurant": {
    "id": "uuid",
    "nameEn": "Al Majlis",
    "nameAr": "المجلس",
    "logo": "https://...",
    "vatNumber": "300000000000003",
    "taxRate": "15.00",
    "taxEnabled": true
  },
  "branch": {
    "id": "uuid",
    "name": "Riyadh Main",
    "nameAr": "الرياض الرئيسي"
  }
}
```

## GET `/api/auth/me`
**Get Current User | جلب المستخدم الحالي**

**Response (200):** Same as login response user object

---

# 📦 2. Orders | الطلبات

## GET `/api/orders`
**List Orders | قائمة الطلبات**

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `branch` | string | Branch ID (optional) |
| `status` | string | `pending`, `preparing`, `ready`, `completed`, `cancelled`, `void` |
| `period` | string | `today`, `week`, `month` |
| `date` | string | ISO date `2026-03-07` |

**Response (200):**
```json
[
  {
    "id": "uuid",
    "orderNumber": "ORD-20260307-0001",
    "orderType": "dine_in",
    "status": "pending",
    "customerName": "محمد",
    "customerPhone": "0512345678",
    "customerAddress": null,
    "tableId": "uuid",
    "notes": "بدون ملح",
    "kitchenNotes": "عاجل",
    "subtotal": "85.00",
    "discount": "0.00",
    "deliveryFee": "0.00",
    "tax": "12.75",
    "total": "97.75",
    "paymentMethod": "cash",
    "isPaid": true,
    "branchId": "uuid",
    "daySessionId": "uuid",
    "createdAt": "2026-03-07T10:30:00Z",
    "updatedAt": "2026-03-07T10:30:00Z",
    "items": [
      {
        "id": "uuid",
        "menuItemId": "uuid",
        "itemName": "برجر لحم",
        "quantity": 2,
        "unitPrice": "35.00",
        "totalPrice": "70.00",
        "notes": "بدون بصل"
      }
    ]
  }
]
```

## GET `/api/orders/:id`
**Get Single Order | جلب طلب واحد**

**Response (200):** Single order object with items array

## POST `/api/orders`
**Create Order | إنشاء طلب**

**Request:**
```json
{
  "orderNumber": "ORD-20260307-0002",
  "orderType": "dine_in",
  "customerName": "أحمد",
  "customerPhone": "0512345678",
  "subtotal": "50.00",
  "tax": "7.50",
  "total": "57.50",
  "paymentMethod": "cash",
  "isPaid": true,
  "branchId": "uuid",
  "shiftId": "uuid",
  "tableId": "uuid",
  "notes": "ملاحظات الطلب",
  "items": [
    {
      "menuItemId": "uuid",
      "quantity": 2,
      "unitPrice": "25.00",
      "totalPrice": "50.00",
      "notes": "بدون ملح"
    }
  ]
}
```

**Note:** Server recalculates totals from items prices + tax rate

**Response (201):** Created order object

## PUT `/api/orders/:id`
**Update Order | تحديث طلب**

**Request:** (partial update allowed)
```json
{
  "status": "preparing",
  "notes": "تم التحديث"
}
```

## PUT `/api/orders/:id/status`
**Update Order Status | تحديث حالة الطلب**

**Request:**
```json
{
  "status": "ready"
}
```

**Valid Statuses:**
- `pending` - جديد
- `confirmed` - مؤكد
- `preparing` - قيد التحضير
- `ready` - جاهز
- `completed` - مكتمل
- `cancelled` - ملغي
- `void` - ملغي (مع استرداد)

## PUT `/api/orders/:id/void`
**Void Order | إلغاء طلب مع الاسترداد**

**Request:**
```json
{
  "reason": "طلب العميل الإلغاء"
}
```

## POST `/api/orders/:id/refund`
**Refund Order | استرداد الطلب**

**Request:**
```json
{
  "reason": "منتج معيب",
  "amount": "50.00"
}
```

---

# 🍽️ 3. Menu | القائمة

## GET `/api/categories`
**List Categories | قائمة التصنيفات**

**Response (200):**
```json
[
  {
    "id": "uuid",
    "nameEn": "Appetizers",
    "nameAr": "المقبلات",
    "parentId": null,
    "sortOrder": 1,
    "isActive": true
  }
]
```

## GET `/api/menu-items`
**List Menu Items | قائمة الأصناف**

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `category` | string | Category ID |
| `branch` | string | Branch ID |

**Response (200):**
```json
[
  {
    "id": "uuid",
    "categoryId": "uuid",
    "kitchenSectionId": "uuid",
    "nameEn": "Beef Burger",
    "nameAr": "برجر لحم",
    "descriptionEn": "Juicy beef patty",
    "descriptionAr": "قطعة لحم طازجة",
    "price": "35.00",
    "image": "https://...",
    "isAvailable": true,
    "sortOrder": 1,
    "prepTime": 15,
    "calories": 650,
    "sugar": "5.00",
    "fat": "28.00",
    "sodium": "850.00",
    "protein": "35.00",
    "allergens": ["gluten", "dairy"],
    "isSpicy": false,
    "isVegetarian": false,
    "isNew": false,
    "isBestseller": true
  }
]
```

## GET `/api/menu-items/:id`
**Get Menu Item with Variants & Customizations**

**Response (200):**
```json
{
  "id": "uuid",
  "nameEn": "Beef Burger",
  "nameAr": "برجر لحم",
  "price": "35.00",
  "variants": [
    {
      "id": "uuid",
      "nameEn": "Regular",
      "nameAr": "عادي",
      "priceAdjustment": "0.00",
      "isDefault": true
    },
    {
      "id": "uuid",
      "nameEn": "Large",
      "nameAr": "كبير",
      "priceAdjustment": "10.00",
      "isDefault": false
    }
  ],
  "customizationGroups": [
    {
      "id": "uuid",
      "nameEn": "Extra Toppings",
      "nameAr": "إضافات",
      "selectionType": "multiple",
      "minSelections": 0,
      "maxSelections": 5,
      "isRequired": false,
      "options": [
        {
          "id": "uuid",
          "nameEn": "Extra Cheese",
          "nameAr": "جبنة إضافية",
          "priceAdjustment": "5.00",
          "isDefault": false
        }
      ]
    }
  ]
}
```

---

# 🧾 4. Invoices | الفواتير

## GET `/api/invoices`
**List Invoices | قائمة الفواتير**

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `branch` | string | Branch ID |
| `startDate` | string | ISO date |
| `endDate` | string | ISO date |

**Response (200):**
```json
[
  {
    "id": "uuid",
    "invoiceNumber": "INV-202603070001",
    "orderId": "uuid",
    "invoiceType": "simplified",
    "status": "issued",
    "subtotal": "85.00",
    "taxAmount": "12.75",
    "taxRate": "15.00",
    "discount": "0.00",
    "deliveryFee": "0.00",
    "total": "97.75",
    "customerName": "أحمد",
    "customerPhone": "0512345678",
    "paymentMethod": "cash",
    "isPaid": true,
    "qrCodeData": "base64...",
    "zatcaStatus": "submitted",
    "cashierName": "محمد",
    "createdAt": "2026-03-07T10:30:00Z"
  }
]
```

## GET `/api/invoices/search?q=<query>`
**Search Invoices | البحث في الفواتير**

## POST `/api/invoices`
**Create Invoice for Order | إنشاء فاتورة**

**Request:**
```json
{
  "orderId": "uuid"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "invoiceNumber": "INV-202603070002",
  "orderId": "uuid",
  "qrCodeData": "AXJT...",
  "total": "97.75"
}
```

## POST `/api/invoices/:id/refund`
**Create Credit Note | إنشاء إشعار دائن**

**Request:**
```json
{
  "reason": "استرداد منتج"
}
```

---

# 👨‍🍳 5. Kitchen Display | شاشة المطبخ

## GET `/api/kitchen/orders`
**Get Kitchen Orders | طلبات المطبخ**

Returns orders with status `pending` or `preparing`

**Response (200):**
```json
[
  {
    "id": "uuid",
    "orderNumber": "ORD-001",
    "orderType": "dine_in",
    "status": "pending",
    "tableId": "uuid",
    "customerName": "أحمد",
    "notes": "عاجل",
    "kitchenNotes": "بدون ملح",
    "createdAt": "2026-03-07T10:30:00Z",
    "items": [
      {
        "id": "uuid",
        "itemName": "برجر لحم",
        "quantity": 2,
        "notes": "بدون بصل"
      }
    ]
  }
]
```

## GET `/api/kitchen-sections`
**List Kitchen Sections | أقسام المطبخ**

**Response (200):**
```json
[
  {
    "id": "uuid",
    "nameEn": "Grills",
    "nameAr": "المشاوي",
    "icon": "🍖",
    "color": "#8B1A1A",
    "sortOrder": 1,
    "isActive": true
  }
]
```

---

# 🪑 6. Tables | الطاولات

## GET `/api/tables`
**List Tables | قائمة الطاولات**

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `branch` | string | Branch ID |

**Response (200):**
```json
[
  {
    "id": "uuid",
    "tableNumber": "T1",
    "capacity": 4,
    "status": "available",
    "location": "داخلي",
    "branchId": "uuid"
  }
]
```

**Table Status Values:**
- `available` - متاحة
- `occupied` - مشغولة
- `reserved` - محجوزة
- `cleaning` - تنظيف

## PUT `/api/tables/:id/status`
**Update Table Status | تحديث حالة الطاولة**

**Request:**
```json
{
  "status": "occupied"
}
```

---

# 📅 7. Day Sessions (Shifts) | الورديات

## GET `/api/day-sessions/current`
**Get Current Open Session | الوردية الحالية**

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `branch` | string | Branch ID |

**Response (200):**
```json
{
  "id": "uuid",
  "date": "2026-03-07",
  "status": "open",
  "openedAt": "2026-03-07T08:00:00Z",
  "openingBalance": "500.00",
  "totalSales": "1250.00",
  "totalOrders": 15,
  "cashSales": "800.00",
  "cardSales": "450.00"
}
```

## POST `/api/day-sessions/open`
**Open New Session | فتح وردية جديدة**

**Request:**
```json
{
  "branchId": "uuid",
  "openingBalance": "500.00",
  "date": "2026-03-07"
}
```

## POST `/api/day-sessions/:id/close`
**Close Session | إغلاق الوردية**

**Request:**
```json
{
  "closingBalance": "1750.00",
  "notes": "ملاحظات الإغلاق"
}
```

**Response (200):**
```json
{
  "id": "uuid",
  "status": "closed",
  "closedAt": "2026-03-07T22:00:00Z",
  "closingBalance": "1750.00",
  "expectedBalance": "1300.00",
  "difference": "450.00",
  "totalSales": "1250.00",
  "totalOrders": 15
}
```

## GET `/api/day-sessions/:id/transactions`
**Get Cash Transactions | المعاملات النقدية**

**Response (200):**
```json
[
  {
    "id": "uuid",
    "type": "deposit",
    "amount": "200.00",
    "reason": "إيداع نقدي",
    "createdAt": "2026-03-07T14:00:00Z"
  }
]
```

## POST `/api/day-sessions/:id/transactions`
**Add Cash Transaction | إضافة معاملة نقدية**

**Request:**
```json
{
  "type": "deposit",
  "amount": "200.00",
  "reason": "إيداع إضافي"
}
```

**Transaction Types:**
- `deposit` - إيداع
- `withdrawal` - سحب
- `adjustment` - تعديل

---

# 📆 8. Reservations | الحجوزات

## GET `/api/reservations`
**List Reservations | قائمة الحجوزات**

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `branch` | string | Branch ID |
| `date` | string | ISO date |
| `status` | string | Filter by status |

**Response (200):**
```json
[
  {
    "id": "uuid",
    "reservationNumber": "RES-001",
    "customerName": "محمد أحمد",
    "customerPhone": "0512345678",
    "guestCount": 4,
    "reservationDate": "2026-03-07T19:00:00Z",
    "reservationTime": "19:00",
    "duration": 90,
    "status": "confirmed",
    "tableId": "uuid",
    "specialRequests": "طاولة بجانب النافذة",
    "depositAmount": "50.00",
    "depositPaid": true,
    "depositCode": "RES-A7X2"
  }
]
```

## POST `/api/reservations`
**Create Reservation | إنشاء حجز**

**Request:**
```json
{
  "branchId": "uuid",
  "customerName": "محمد",
  "customerPhone": "0512345678",
  "guestCount": 4,
  "reservationDate": "2026-03-10",
  "reservationTime": "19:00",
  "specialRequests": "طاولة هادئة"
}
```

## PUT `/api/reservations/:id/status`
**Update Reservation Status | تحديث حالة الحجز**

**Request:**
```json
{
  "status": "seated"
}
```

**Reservation Statuses:**
- `pending` - قيد الانتظار
- `confirmed` - مؤكد
- `seated` - جالس
- `completed` - مكتمل
- `cancelled` - ملغي
- `no_show` - لم يحضر

## PUT `/api/reservations/:id/deposit`
**Mark Deposit Paid | تأكيد دفع العربون**

## PUT `/api/reservations/:id/deposit-applied`
**Apply Deposit to Order | تطبيق العربون على الطلب**

**Request:**
```json
{
  "orderId": "uuid"
}
```

---

# 👥 9. Queue Management | إدارة الطابور

## GET `/api/queue`
**List Queue Entries | قائمة الطابور**

**Response (200):**
```json
[
  {
    "id": "uuid",
    "queueNumber": 15,
    "customerName": "سارة",
    "customerPhone": "0512345678",
    "partySize": 3,
    "status": "waiting",
    "estimatedWaitMinutes": 20,
    "createdAt": "2026-03-07T18:30:00Z"
  }
]
```

## GET `/api/queue/stats`
**Queue Statistics | إحصائيات الطابور**

**Response (200):**
```json
{
  "totalWaiting": 8,
  "averageWaitTime": 25,
  "currentNumber": 15,
  "seatedToday": 45
}
```

## POST `/api/queue`
**Add to Queue | إضافة للطابور**

**Request:**
```json
{
  "branchId": "uuid",
  "customerName": "أحمد",
  "customerPhone": "0512345678",
  "partySize": 4
}
```

## PUT `/api/queue/:id/status`
**Update Queue Status | تحديث حالة الطابور**

**Request:**
```json
{
  "status": "notified"
}
```

**Queue Statuses:**
- `waiting` - في الانتظار
- `notified` - تم إبلاغه
- `seated` - جالس
- `cancelled` - ملغي
- `no_show` - لم يحضر

---

# 👤 10. Customers | العملاء

## GET `/api/customers`
**List Customers | قائمة العملاء**

**Response (200):**
```json
[
  {
    "id": "uuid",
    "name": "محمد أحمد",
    "phone": "0512345678",
    "email": "m@example.com",
    "address": "الرياض",
    "totalOrders": 25,
    "totalSpent": "3500.00",
    "lastOrderAt": "2026-03-05T15:00:00Z"
  }
]
```

## POST `/api/customers`
**Create Customer | إنشاء عميل**

## PUT `/api/customers/:id`
**Update Customer | تحديث عميل**

---

# 📦 11. Inventory | المخزون

## GET `/api/inventory`
**List Inventory Items | قائمة المخزون**

**Response (200):**
```json
[
  {
    "id": "uuid",
    "name": "لحم بقري",
    "nameAr": "لحم بقري",
    "unit": "kg",
    "currentStock": "15.50",
    "minStock": "5.00",
    "costPerUnit": "45.00",
    "category": "meat",
    "isActive": true
  }
]
```

## POST `/api/inventory/:itemId/transactions`
**Add Stock Transaction | إضافة حركة مخزون**

**Request:**
```json
{
  "type": "purchase",
  "quantity": "10.00",
  "unitCost": "45.00",
  "notes": "شراء من المورد"
}
```

**Transaction Types:**
- `purchase` - شراء
- `usage` - استخدام
- `adjustment` - تعديل
- `transfer` - نقل
- `waste` - هدر

---

# 🎫 12. Promotions & Coupons | العروض والكوبونات

## GET `/api/promotions`
**List Promotions | قائمة العروض**

## GET `/api/coupons`
**List Coupons | قائمة الكوبونات**

## POST `/api/coupons/validate`
**Validate Coupon | التحقق من الكوبون**

**Request:**
```json
{
  "code": "SAVE20",
  "orderTotal": "100.00",
  "orderType": "delivery"
}
```

**Response (200):**
```json
{
  "valid": true,
  "coupon": {
    "id": "uuid",
    "code": "SAVE20",
    "discountType": "percentage",
    "discountValue": "20.00"
  },
  "discountAmount": "20.00"
}
```

---

# 📊 13. Reports | التقارير

## GET `/api/reports/sales`
**Sales Report | تقرير المبيعات**

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `startDate` | string | ISO date |
| `endDate` | string | ISO date |
| `branch` | string | Branch ID |

**Response (200):**
```json
{
  "totalSales": "15000.00",
  "totalOrders": 150,
  "totalTax": "2250.00",
  "totalDiscounts": "500.00",
  "averageOrderValue": "100.00",
  "salesByPaymentMethod": {
    "cash": "8000.00",
    "card": "6500.00",
    "bank_transfer": "500.00"
  },
  "salesByOrderType": {
    "dine_in": "6000.00",
    "takeout": "4000.00",
    "delivery": "5000.00"
  }
}
```

## GET `/api/reports/top-items`
**Top Selling Items | الأصناف الأكثر مبيعاً**

**Response (200):**
```json
[
  {
    "menuItemId": "uuid",
    "itemName": "برجر لحم",
    "quantitySold": 250,
    "totalRevenue": "8750.00"
  }
]
```

## GET `/api/reports/summary`
**Dashboard Summary | ملخص لوحة التحكم**

**Response (200):**
```json
{
  "todaySales": "5000.00",
  "todayOrders": 45,
  "pendingOrders": 3,
  "activeKitchenOrders": 5,
  "lowStockItems": 2,
  "pendingReservations": 8
}
```

---

# 🔔 14. Notifications | الإشعارات

## GET `/api/notifications`
**List Notifications | قائمة الإشعارات**

## GET `/api/notifications/unread-count`
**Unread Count | عدد غير المقروءة**

**Response (200):**
```json
{
  "count": 5
}
```

## PUT `/api/notifications/:id/read`
**Mark as Read | تحديد كمقروء**

## PUT `/api/notifications/read-all`
**Mark All as Read | تحديد الكل كمقروء**

---

# 🏪 15. Branches | الفروع

## GET `/api/branches`
**List Branches | قائمة الفروع**

**Response (200):**
```json
[
  {
    "id": "uuid",
    "name": "Riyadh Main",
    "nameAr": "الرياض الرئيسي",
    "address": "طريق الملك فهد",
    "phone": "0112345678",
    "isMain": true,
    "isActive": true
  }
]
```

---

# ⚙️ 16. Restaurant Settings | إعدادات المطعم

## GET `/api/restaurant`
**Get Restaurant Settings | جلب الإعدادات**

**Response (200):**
```json
{
  "id": "uuid",
  "nameEn": "Al Majlis",
  "nameAr": "المجلس",
  "logo": "https://...",
  "banner": "https://...",
  "phone": "0112345678",
  "whatsapp": "0512345678",
  "email": "info@almajlis.com",
  "address": "الرياض",
  "vatNumber": "300000000000003",
  "commercialRegistration": "1010000000",
  "taxEnabled": true,
  "taxRate": "15.00",
  "serviceDineIn": true,
  "servicePickup": true,
  "serviceDelivery": true,
  "serviceTableBooking": true,
  "serviceQueue": true
}
```

## PUT `/api/restaurant`
**Update Restaurant Settings | تحديث الإعدادات**

---

# 💳 17. Payments (EdfaPay) | المدفوعات

## GET `/api/edfapay/status`
**Check Payment Gateway Status | حالة بوابة الدفع**

**Response (200):**
```json
{
  "configured": true,
  "merchantId": "xxx-xxx",
  "isLive": false
}
```

## POST `/api/payments/create-session`
**Create Payment Session | إنشاء جلسة دفع**

**Request:**
```json
{
  "orderId": "uuid",
  "amount": "97.75",
  "customerPhone": "0512345678",
  "customerEmail": "customer@example.com"
}
```

**Response (201):**
```json
{
  "paymentId": "uuid",
  "redirectUrl": "https://pay.edfapay.com/...",
  "status": "initiated"
}
```

## GET `/api/payments/verify/:paymentId`
**Verify Payment | التحقق من الدفع**

**Response (200):**
```json
{
  "status": "paid",
  "transactionId": "EDF-12345",
  "amount": "97.75",
  "paymentMethod": "creditcard",
  "cardBrand": "visa",
  "cardLast4": "4242"
}
```

---

# 🌐 18. WebSocket Events | أحداث WebSocket

## Connection | الاتصال
```
wss://tryingpos.com/ws?token=<jwt_token>
```

## Server → Client Events | أحداث من السيرفر

### `new_order`
**New Order Created | طلب جديد**
```json
{
  "type": "new_order",
  "order": { ... }
}
```

### `order_updated`
**Order Status Changed | تغيير حالة الطلب**
```json
{
  "type": "order_updated",
  "orderId": "uuid",
  "status": "ready",
  "order": { ... }
}
```

### `data_changed`
**Data Changed | تغيير البيانات**
```json
{
  "type": "data_changed",
  "dataType": "reservations",
  "action": "created"
}
```

---

# 📋 Database Schema | هيكل قاعدة البيانات

## restaurants
| Column | Type | Description |
|--------|------|-------------|
| id | varchar | Primary Key |
| slug | varchar | URL-friendly name |
| nameEn | text | English name |
| nameAr | text | Arabic name |
| logo | text | Logo URL |
| vatNumber | text | VAT registration |
| taxRate | decimal | Tax percentage |
| taxEnabled | boolean | Tax enabled |
| edfapayMerchantId | text | Payment gateway ID |
| zatcaEnvironment | text | sandbox/production |

## branches
| Column | Type | Description |
|--------|------|-------------|
| id | varchar | Primary Key |
| restaurantId | varchar | FK → restaurants |
| name | text | Branch name |
| nameAr | text | Arabic name |
| address | text | Address |
| phone | text | Phone |
| isMain | boolean | Main branch flag |
| isActive | boolean | Active status |

## users
| Column | Type | Description |
|--------|------|-------------|
| id | varchar | Primary Key |
| restaurantId | varchar | FK → restaurants |
| branchId | varchar | FK → branches |
| email | text | Email |
| password | text | Hashed password |
| name | text | Full name |
| role | text | cashier/kitchen/manager/owner |
| permDashboard | boolean | Permission flag |
| permPos | boolean | Permission flag |
| permOrders | boolean | Permission flag |
| permMenu | boolean | Permission flag |
| permKitchen | boolean | Permission flag |
| permInventory | boolean | Permission flag |
| permReports | boolean | Permission flag |
| permSettings | boolean | Permission flag |

## categories
| Column | Type | Description |
|--------|------|-------------|
| id | varchar | Primary Key |
| restaurantId | varchar | FK → restaurants |
| nameEn | text | English name |
| nameAr | text | Arabic name |
| parentId | varchar | Parent category |
| sortOrder | integer | Display order |
| isActive | boolean | Active status |

## menuItems (menu_items)
| Column | Type | Description |
|--------|------|-------------|
| id | varchar | Primary Key |
| restaurantId | varchar | FK → restaurants |
| categoryId | varchar | FK → categories |
| nameEn | text | English name |
| nameAr | text | Arabic name |
| price | decimal | Price |
| image | text | Image URL |
| isAvailable | boolean | Available status |
| calories | integer | Calories (SFDA) |
| allergens | jsonb | Allergen list |

## tables
| Column | Type | Description |
|--------|------|-------------|
| id | varchar | Primary Key |
| restaurantId | varchar | FK → restaurants |
| branchId | varchar | FK → branches |
| tableNumber | text | Display number |
| capacity | integer | Seats count |
| status | text | available/occupied/reserved |
| location | text | Section/area |

## orders
| Column | Type | Description |
|--------|------|-------------|
| id | varchar | Primary Key |
| restaurantId | varchar | FK → restaurants |
| branchId | varchar | FK → branches |
| tableId | varchar | FK → tables |
| orderNumber | text | Display number |
| orderType | text | dine_in/takeout/delivery |
| status | text | pending/preparing/ready/completed |
| customerName | text | Customer name |
| customerPhone | text | Customer phone |
| subtotal | decimal | Before tax |
| tax | decimal | Tax amount |
| total | decimal | Final total |
| paymentMethod | text | cash/card/bank_transfer |
| isPaid | boolean | Payment status |
| notes | text | Order notes |
| kitchenNotes | text | Kitchen notes |
| createdAt | timestamp | Creation time |

## orderItems (order_items)
| Column | Type | Description |
|--------|------|-------------|
| id | varchar | Primary Key |
| orderId | varchar | FK → orders |
| menuItemId | varchar | FK → menuItems |
| itemName | text | Item name (cached) |
| quantity | integer | Quantity |
| unitPrice | decimal | Price per unit |
| totalPrice | decimal | Line total |
| notes | text | Item notes |

## invoices
| Column | Type | Description |
|--------|------|-------------|
| id | varchar | Primary Key |
| restaurantId | varchar | FK → restaurants |
| orderId | varchar | FK → orders |
| invoiceNumber | text | Display number |
| invoiceType | text | simplified/standard |
| subtotal | decimal | Before tax |
| taxAmount | decimal | Tax amount |
| total | decimal | Final total |
| qrCodeData | text | ZATCA QR data |
| zatcaStatus | text | pending/submitted/cleared |
| cashierName | text | Cashier name |
| createdAt | timestamp | Issue time |

## daySessions (day_sessions)
| Column | Type | Description |
|--------|------|-------------|
| id | varchar | Primary Key |
| restaurantId | varchar | FK → restaurants |
| branchId | varchar | FK → branches |
| date | text | Session date |
| status | text | open/closed |
| openingBalance | decimal | Opening cash |
| closingBalance | decimal | Closing cash |
| totalSales | decimal | Total sales |
| totalOrders | integer | Order count |
| cashSales | decimal | Cash total |
| cardSales | decimal | Card total |

## reservations
| Column | Type | Description |
|--------|------|-------------|
| id | varchar | Primary Key |
| restaurantId | varchar | FK → restaurants |
| branchId | varchar | FK → branches |
| customerName | text | Name |
| customerPhone | text | Phone |
| guestCount | integer | Party size |
| reservationDate | timestamp | Date |
| reservationTime | text | Time "HH:mm" |
| status | text | pending/confirmed/seated |
| depositAmount | decimal | Deposit required |
| depositPaid | boolean | Deposit status |
| depositCode | text | Redemption code |

## queueEntries (queue_entries)
| Column | Type | Description |
|--------|------|-------------|
| id | varchar | Primary Key |
| restaurantId | varchar | FK → restaurants |
| branchId | varchar | FK → branches |
| queueNumber | integer | Queue number |
| customerName | text | Name |
| customerPhone | text | Phone |
| partySize | integer | Party size |
| status | text | waiting/notified/seated |
| estimatedWaitMinutes | integer | Wait estimate |

## inventoryItems (inventory_items)
| Column | Type | Description |
|--------|------|-------------|
| id | varchar | Primary Key |
| restaurantId | varchar | FK → restaurants |
| name | text | Item name |
| unit | text | kg/g/liter/piece |
| currentStock | decimal | Current quantity |
| minStock | decimal | Minimum alert |
| costPerUnit | decimal | Unit cost |
| category | text | Item category |

## customers
| Column | Type | Description |
|--------|------|-------------|
| id | varchar | Primary Key |
| restaurantId | varchar | FK → restaurants |
| name | text | Full name |
| phone | text | Phone (unique) |
| email | text | Email |
| address | text | Address |
| totalOrders | integer | Order count |
| totalSpent | decimal | Total spent |
| lastOrderAt | timestamp | Last order |

---

# ✅ Validation Rules | قواعد التحقق

| Field | Rule | Example |
|-------|------|---------|
| Phone (Saudi) | 10 digits, starts with `05` | `0512345678` |
| VAT Number | 15 digits, starts/ends with `3` | `300000000000003` |
| Price | Non-negative, max 2 decimals | `35.50` |
| Quantity | Positive integer | `3` |
| Email | Valid email format | `user@example.com` |

---

# 📱 HTTP Status Codes | رموز الحالة

| Code | Meaning | المعنى |
|------|---------|--------|
| 200 | Success | نجاح |
| 201 | Created | تم الإنشاء |
| 204 | No Content | بدون محتوى (حذف) |
| 400 | Bad Request | طلب خاطئ |
| 401 | Unauthorized | غير مصرح |
| 403 | Forbidden | ممنوع |
| 404 | Not Found | غير موجود |
| 409 | Conflict | تعارض |
| 500 | Server Error | خطأ في السيرفر |

---

# 🔑 Error Response Format | صيغة رسالة الخطأ

```json
{
  "error": "رسالة الخطأ",
  "code": "ERROR_CODE",
  "details": "تفاصيل إضافية"
}
```

---

**Document Version:** 1.0  
**Last Updated:** March 7, 2026  
**API Version:** v1

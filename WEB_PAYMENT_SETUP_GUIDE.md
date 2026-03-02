# دليل إعداد الدفع الإلكتروني - TryingPOS Web

## 🔴 المشكلة: الدفع لا يعمل

إذا كانت صفحة الدفع لا تعمل، السبب غالباً هو **عدم إعداد بيانات EdfaPay**.

---

## ✅ الحل: خطوات الإعداد الكاملة

### 1️⃣ التسجيل في EdfaPay

#### أ. إنشاء حساب Partner
1. اذهب إلى: **https://edfapay.com/** أو **https://app.edfapay.com/**
2. سجّل حساب جديد كـ **Partner** (شريك)
3. أكمل عملية التحقق من الهوية (KYC)
4. احصل على:
   - ✅ **Merchant ID** (معرّف التاجر)
   - ✅ **Password** (كلمة السر)

#### ب. بيئة الاختبار Sandbox
للتطوير والاختبار، استخدم بيئة Sandbox:
- **URL**: `https://api-sandbox.edfapay.com`
- **Merchant ID**: سيُعطى لك من لوحة التحكم
- **Password**: سيُعطى لك من لوحة التحكم

#### ج. بيئة Production
للموقع المباشر:
- **URL**: `https://api.edfapay.com`
- **Merchant ID**: بيانات حقيقية بعد اعتماد الحساب
- **Password**: بيانات حقيقية بعد اعتماد الحساب

---

### 2️⃣ إدخال البيانات في TryingPOS

#### الطريقة 1: من لوحة الإعدادات (Settings)

1. سجّل دخول كـ **Owner** أو **Admin**
2. اذهب إلى: **Settings** (الإعدادات)
3. ابحث عن قسم: **"EdfaPay Payment Gateway"**
4. أدخل:
   ```
   Merchant ID: xxxxx
   Password: xxxxx
   ```
5. اضغط **Save**

#### الطريقة 2: من Platform Admin

1. سجّل دخول كـ **Platform Admin**
2. اذهب إلى: **Platform Admin** → **Restaurants**
3. اختر المطعم
4. اضغط **Payment Settings**
5. أدخل:
   ```
   EdfaPay Merchant ID: xxxxx
   EdfaPay Password: xxxxx
   ```
6. اضغط **Save**

#### الطريقة 3: مباشرة في قاعدة البيانات

إذا كنت تتعامل مباشرة مع PostgreSQL:

```sql
UPDATE restaurant 
SET 
  "edfapayMerchantId" = 'your_merchant_id_here',
  "edfapayPassword" = 'your_password_here'
WHERE id = 'your_restaurant_id';
```

---

### 3️⃣ التحقق من الإعداد

#### اختبار من Backend
```bash
# افتح PowerShell في مجلد المشروع
cd server

# جرّب الاتصال بـ EdfaPay
node -e "
const edfapay = require('./edfapay');
console.log('Testing EdfaPay connection...');
"
```

#### اختبار من الموقع
1. اذهب إلى: **Settings** → **EdfaPay Status**
2. يجب أن يظهر:
   ```
   ✅ Configured
   Merchant ID: xxxxx
   ```

---

## 🧪 اختبار الدفع

### بطاقات الاختبار (Sandbox Only)

استخدم هذه البطاقات للتجربة في بيئة Sandbox:

#### ✅ بطاقات ناجحة

| النوع | الرقم | Expiry | CVV | النتيجة |
|------|-------|--------|-----|---------|
| **Mastercard** | `5123450000000008` | `01/39` | `100` | ✅ ناجح |
| **Visa** | `4111111111111111` | `01/39` | `100` | ✅ ناجح |
| **Mada** | `5043000000000003` | `01/39` | `100` | ✅ ناجح |

#### ❌ بطاقات فاشلة (للاختبار)

| النوع | الرقم | Expiry | CVV | النتيجة |
|------|-------|--------|-----|---------|
| **Visa** | `4000000000000002` | `01/39` | `100` | ❌ مرفوض |
| **Mada** | `5043000000000011` | `01/39` | `100` | ❌ مرفوض |

---

## 🔍 استكشاف الأخطاء

### ❌ خطأ: "Payment gateway not configured"

**السبب**: لم يتم إدخال Merchant ID أو Password

**الحل**:
1. تأكد من إدخال البيانات في Settings
2. تحقق من قاعدة البيانات:
```sql
SELECT "edfapayMerchantId", "edfapayPassword" 
FROM restaurant 
WHERE id = 'your_restaurant_id';
```

---

### ❌ خطأ: "Failed to create payment session"

**السبب**: بيانات EdfaPay خاطئة أو انتهت صلاحيتها

**الحل**:
1. تحقق من صحة Merchant ID و Password
2. تأكد أنك تستخدم بيئة صحيحة (Sandbox vs Production)
3. راجع logs في Server:
```bash
# في Terminal
npm run dev

# راقب الأخطاء في Console
```

---

### ❌ خطأ: "Hash verification failed"

**السبب**: خطأ في حساب التوقيع (signature)

**الحل**:
1. تأكد أن Password صحيح 100%
2. تحقق من أن الـ hash function في `server/edfapay.ts` تعمل بشكل صحيح

---

### ❌ الدفع ينجح ولكن Order لا يتحدث

**السبب**: Webhook لا يصل للسيرفر

**الحل**:
1. تأكد أن السيرفر يعمل على HTTPS (ليس HTTP)
2. تحقق من Webhook URL في EdfaPay Dashboard:
   ```
   https://tryingpos.com/api/payments/webhook
   ```
3. تحقق من logs:
```bash
# في server/routes.ts - سطر 6374
# يجب أن ترى: "EdfaPay Webhook: action=SALE result=SUCCESS..."
```

---

## 🌐 Apple Pay (اختياري)

### متطلبات Apple Pay

1. **Domain Verification**:
   - يجب أن يكون الموقع HTTPS
   - يجب تسجيل Domain في Apple Developer Portal

2. **Certificate**:
   - احصل على Apple Pay Merchant Certificate (`.p12`)
   - أضف في EdfaPay Portal

3. **متغيرات البيئة**:
```bash
# في .env
APPLEPAY_MERCHANT_ID=merchant.com.tryingpos
APPLEPAY_DOMAIN=tryingpos.com
APPLEPAY_CERT_PATH=/path/to/cert.p12
APPLEPAY_CERT_PASSWORD=cert_password
```

4. **الاختبار**:
   - يعمل فقط على Safari (macOS / iOS)
   - يحتاج بطاقة حقيقية مُضافة إلى Apple Wallet

---

## 📋 Checklist - قائمة التحقق

قبل أن يعمل الدفع، تأكد من:

- [ ] ✅ تم التسجيل في EdfaPay
- [ ] ✅ حصلت على Merchant ID
- [ ] ✅ حصلت على Password
- [ ] ✅ أدخلت البيانات في Settings
- [ ] ✅ تحققت من EdfaPay Status (Configured)
- [ ] ✅ السيرفر يعمل على HTTPS
- [ ] ✅ جربت بطاقة اختبار (Sandbox)
- [ ] ✅ Order يتحدث بعد الدفع

---

## 🔧 الكود المسؤول عن الدفع

### 1. Frontend - صفحة الدفع
**الملف**: `client/src/pages/payment.tsx`

```typescript
// إنشاء جلسة دفع
const sessionRes = await fetch("/api/payments/create-session", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    orderId: order.id,
    callbackUrl,
  }),
});

const session = await sessionRes.json();

if (session.action === "redirect" && session.redirectUrl) {
  // توجيه العميل لصفحة EdfaPay
  window.location.href = session.redirectUrl;
}
```

### 2. Backend - API Endpoint
**الملف**: `server/routes.ts` - سطر `5903`

```typescript
app.post("/api/payments/create-session", async (req, res) => {
  const { orderId, callbackUrl } = req.body;
  const order = await storage.getOrder(orderId);
  
  // جلب بيانات EdfaPay من قاعدة البيانات
  const keys = await getRestaurantEdfapayKeys(order.restaurantId);
  
  if (!keys.merchantId || !keys.password) {
    return res.status(500).json({ 
      error: "بوابة الدفع غير مُعدة بعد", 
      configured: false 
    });
  }
  
  // إنشاء طلب دفع
  const edfaResult = await edfapay.initiateSale({
    merchantId: keys.merchantId,
    password: keys.password,
    orderId: orderId,
    amount: order.total,
    // ... بقية البيانات
  });
  
  res.json({
    action: "redirect",
    redirectUrl: edfaResult.redirect_url,
  });
});
```

### 3. EdfaPay Integration
**الملف**: `server/edfapay.ts`

```typescript
/**
 * إنشاء طلب دفع جديد
 */
export async function initiateSale(params: {
  merchantId: string;
  password: string;
  orderId: string;
  amount: string;
  // ...
}): Promise<EdfaPayInitiateResponse> {
  
  // حساب التوقيع (Hash)
  const hash = generateInitiateHash(
    params.orderId,
    params.amount,
    "SAR",
    orderDescription,
    params.password
  );
  
  // إرسال الطلب لـ EdfaPay
  const response = await fetch("https://api.edfapay.com/payment/initiate", {
    method: "POST",
    body: JSON.stringify({
      action: "SALE",
      edfa_merchant_id: params.merchantId,
      order_id: params.orderId,
      order_amount: params.amount,
      order_currency: "SAR",
      hash: hash,
      // ... بقية البيانات
    }),
  });
  
  return response.json();
}
```

---

## 🚀 الخطوة التالية

بعد إعداد الدفع بنجاح:

1. **اختبر في Sandbox** باستخدام بطاقات الاختبار
2. **انتقل إلى Production** عندما تكون جاهزاً
3. **فعّل Webhooks** لتحديث الطلبات تلقائياً
4. **راقب Transactions** من لوحة تحكم EdfaPay

---

## 📞 الدعم

### EdfaPay Support
- **Website**: https://edfapay.com/
- **Email**: support@edfapay.com
- **Docs**: https://sandbox.edfapay.com/pgapi/EdfapayCheckout_Developer-API.html

### TryingPOS Technical
- **Server Code**: `server/edfapay.ts`
- **Routes**: `server/routes.ts` (السطر 5903 - 6700)
- **Frontend**: `client/src/pages/payment.tsx`

---

## 📝 ملخص سريع

### للبدء الآن:
```bash
1. سجّل في EdfaPay → احصل على (Merchant ID + Password)
2. اذهب إلى Settings في TryingPOS → أدخل البيانات
3. جرّب طلب اختباري → استخدم بطاقة: 5123450000000008
4. يجب أن يعمل! ✅
```

### إذا لم يعمل:
```bash
1. تحقق من Console (F12) → ابحث عن أخطاء
2. تحقق من Server logs → npm run dev
3. تأكد من HTTPS (ليس HTTP)
4. راجع قاعدة البيانات:
   SELECT "edfapayMerchantId" FROM restaurant;
```

---

**آخر تحديث**: مارس 2026  
**الإصدار**: 1.0.0

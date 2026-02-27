import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useSync } from '../context/SyncContext';
import { database } from '../services/database';
import { api } from '../services/api';
import { COLORS, SPACING, RADIUS, FONTS } from '../config/theme';
import { getDisplayName, getItemPrice } from '../types';
import ReceiptModal from './ReceiptModal';
import TapToPayModal from './TapToPayModal';
import { edfaPaySoftPos } from '../services/edfapay-softpos';

interface CartPanelProps {
  onClose: () => void;
}

const ORDER_TYPES = [
  { key: 'dine_in', label: 'محلي' },
  { key: 'takeout', label: 'سفري' },
  { key: 'delivery', label: 'توصيل' },
] as const;

const PAYMENT_METHODS = [
  { key: 'cash', label: 'كاش' },
  { key: 'card', label: edfaPaySoftPos.isAvailable() ? 'شبكة (Tap)' : 'شبكة' },
  { key: 'bank_transfer', label: 'تحويل' },
] as const;

export default function CartPanel({ onClose }: CartPanelProps) {
  const { user, branch } = useAuth();
  const {
    items,
    orderType,
    customerName,
    customerPhone,
    notes,
    kitchenNotes,
    discount,
    deliveryFee,
    subtotal,
    tax,
    total,
    itemCount,
    removeItem,
    updateQuantity,
    setOrderType,
    setCustomerName,
    setCustomerPhone,
    setNotes,
    setKitchenNotes,
    setDiscount,
    setDeliveryFee,
    clearCart,
  } = useCart();
  const { isOnline } = useSync();

  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [submitting, setSubmitting] = useState(false);
  const [receiptOrderId, setReceiptOrderId] = useState<string | null>(null);
  const [localReceiptOrder, setLocalReceiptOrder] = useState<any>(null);
  const [showTapToPay, setShowTapToPay] = useState(false);

  /** Core order-creation logic — called by handleSubmit (cash) or TapToPay onSuccess (card) */
  const createOrder = async (isPaid: boolean) => {
    setSubmitting(true);
    try {
      const orderData = {
        orderNumber: `ORD-${Date.now().toString().slice(-6)}`,
        status: 'pending',
        branchId: branch!.id,
        orderType,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
        notes: notes || undefined,
        kitchenNotes: kitchenNotes || undefined,
        subtotal: subtotal.toFixed(2),
        discount: discount.toFixed(2),
        deliveryFee: deliveryFee.toFixed(2),
        tax: tax.toFixed(2),
        total: total.toFixed(2),
        paymentMethod,
        isPaid,
      };

      if (isOnline) {
        try {
          const createdOrder = await api.createOrder(orderData);
          
          for (const item of items) {
            try {
              await api.createOrderItem(createdOrder.id, {
                menuItemId: item.menuItemId,
                itemName: item.nameAr || item.nameEn || '',
                quantity: item.quantity,
                unitPrice: item.price,
                totalPrice: (parseFloat(item.price) * item.quantity).toFixed(2),
                notes: item.notes || '',
              });
            } catch (err) {
              console.log('Failed to create order item:', err);
            }
          }
          
          try {
            await api.createInvoice({
              orderId: createdOrder.id,
              branchId: branch!.id,
              subtotal: subtotal.toFixed(2),
              discount: discount.toFixed(2),
              deliveryFee: deliveryFee.toFixed(2),
              paymentMethod,
              isPaid,
              customerName: customerName || undefined,
              customerPhone: customerPhone || undefined,
            });
          } catch (err) {
            console.log('Failed to create invoice:', err);
          }
          
          clearCart();
          if (createdOrder?.id) {
            setReceiptOrderId(createdOrder.id);
          } else {
            Alert.alert('تم بنجاح', 'تم إنشاء الطلب');
            onClose();
          }
        } catch (error: any) {
          console.log('Online order creation failed:', error?.message || error);
          const offlineItems = items.map((item) => ({
            menuItemId: item.menuItemId,
            itemName: item.nameAr || item.nameEn,
            nameAr: item.nameAr,
            nameEn: item.nameEn,
            quantity: item.quantity,
            unitPrice: item.price,
            price: item.price,
            totalPrice: (parseFloat(item.price) * item.quantity).toFixed(2),
            notes: item.notes,
          }));
          const offlineOrder = {
            ...orderData,
            restaurantId: user?.restaurantId,
            items: offlineItems,
            _restaurant: branch ? { nameAr: branch.nameAr || branch.name, nameEn: branch.name, phone: branch.phone } : null,
          };
          await database.saveOrder(offlineOrder);
          clearCart();
          setLocalReceiptOrder(offlineOrder);
        }
      } else {
        const offlineItems = items.map((item) => ({
          menuItemId: item.menuItemId,
          itemName: item.nameAr || item.nameEn,
          nameAr: item.nameAr,
          nameEn: item.nameEn,
          quantity: item.quantity,
          unitPrice: item.price,
          price: item.price,
          totalPrice: (parseFloat(item.price) * item.quantity).toFixed(2),
          notes: item.notes,
        }));
        const offlineOrder = {
          ...orderData,
          restaurantId: user?.restaurantId,
          items: offlineItems,
          _restaurant: branch ? { nameAr: branch.nameAr || branch.name, nameEn: branch.name, phone: branch.phone } : null,
        };
        await database.saveOrder(offlineOrder);
        clearCart();
        setLocalReceiptOrder(offlineOrder);
      }
    } catch (error: any) {
      Alert.alert('خطأ', error.message || 'فشل في إنشاء الطلب');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    if (items.length === 0) {
      Alert.alert('خطأ', 'السلة فارغة');
      return;
    }

    if (!branch) {
      Alert.alert('خطأ', 'الرجاء اختيار فرع أولاً من الإعدادات');
      return;
    }

    // Card + SoftPos → show TapToPay modal (it calls createOrder on success)
    if (paymentMethod === 'card' && edfaPaySoftPos.isAvailable()) {
      setShowTapToPay(true);
      return;
    }

    // Cash → create order directly as paid
    await createOrder(paymentMethod === 'cash');
  };

  return (
    <>
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>السلة</Text>
          <Text style={styles.headerCount}>{itemCount} عنصر</Text>
        </View>
        {items.length > 0 && (
          <TouchableOpacity onPress={clearCart} style={styles.clearButton}>
            <Text style={styles.clearText}>مسح</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Cart Items */}
        {items.length === 0 ? (
          <View style={styles.emptyCart}>
            <Text style={styles.emptyIcon}>—</Text>
            <Text style={styles.emptyText}>السلة فارغة</Text>
            <Text style={styles.emptyHint}>أضف منتجات من القائمة</Text>
          </View>
        ) : (
          <View style={styles.section}>
            {items.map((item) => (
              <View key={item.menuItemId} style={styles.cartItem}>
                <View style={styles.cartItemInfo}>
                  <Text style={styles.cartItemName}>
                    {item.nameAr || item.nameEn}
                  </Text>
                  <Text style={styles.cartItemPrice}>
                    {(parseFloat(item.price) * item.quantity).toFixed(2)} ر.س
                  </Text>
                  {item.quantity > 1 && (
                    <Text style={styles.cartItemUnit}>
                      {parseFloat(item.price).toFixed(2)} × {item.quantity}
                    </Text>
                  )}
                </View>
                <View style={styles.quantityControls}>
                  <TouchableOpacity
                    style={styles.qtyButton}
                    onPress={() => updateQuantity(item.menuItemId, item.quantity - 1)}
                  >
                    <Text style={styles.qtyButtonText}>−</Text>
                  </TouchableOpacity>
                  <Text style={styles.qtyText}>{item.quantity}</Text>
                  <TouchableOpacity
                    style={styles.qtyButton}
                    onPress={() => updateQuantity(item.menuItemId, item.quantity + 1)}
                  >
                    <Text style={styles.qtyButtonText}>+</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {items.length > 0 && (
          <>
            {/* Order Type */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>نوع الطلب</Text>
              <View style={styles.segmentControl}>
                {ORDER_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type.key}
                    style={[
                      styles.segment,
                      orderType === type.key && styles.segmentActive,
                    ]}
                    onPress={() => setOrderType(type.key as any)}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        orderType === type.key && styles.segmentTextActive,
                      ]}
                    >
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Payment Method */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>طريقة الدفع</Text>
              <View style={styles.segmentControl}>
                {PAYMENT_METHODS.map((method) => (
                  <TouchableOpacity
                    key={method.key}
                    style={[
                      styles.segment,
                      paymentMethod === method.key && styles.segmentActive,
                    ]}
                    onPress={() => setPaymentMethod(method.key)}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        paymentMethod === method.key && styles.segmentTextActive,
                      ]}
                    >
                      {method.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Customer Info */}
            {(orderType === 'delivery' || orderType === 'takeout') && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>بيانات العميل</Text>
                <TextInput
                  style={styles.input}
                  placeholder="اسم العميل"
                  placeholderTextColor={COLORS.textLight}
                  value={customerName}
                  onChangeText={setCustomerName}
                  textAlign="right"
                />
                <TextInput
                  style={styles.input}
                  placeholder="رقم الجوال"
                  placeholderTextColor={COLORS.textLight}
                  value={customerPhone}
                  onChangeText={setCustomerPhone}
                  keyboardType="phone-pad"
                  textAlign="right"
                />
              </View>
            )}

            {/* Notes */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>ملاحظات</Text>
              <TextInput
                style={[styles.input, { minHeight: 50 }]}
                placeholder="ملاحظات على الطلب..."
                placeholderTextColor={COLORS.textLight}
                value={notes}
                onChangeText={setNotes}
                textAlign="right"
                multiline
              />
              <View style={styles.kitchenNotesWrap}>
                <Text style={styles.kitchenNotesLabel}>ملاحظات المطبخ</Text>
                <TextInput
                  style={[styles.input, styles.kitchenNotesInput]}
                  placeholder="ملاحظات للمطبخ (بدون بصل، ناشف، حار...)"
                  placeholderTextColor={COLORS.textLight}
                  value={kitchenNotes}
                  onChangeText={setKitchenNotes}
                  textAlign="right"
                  multiline
                />
              </View>
            </View>

            {/* Totals */}
            <View style={styles.totalsSection}>
              <View style={styles.totalRow}>
                <Text style={styles.totalValue}>{subtotal.toFixed(2)} ر.س</Text>
                <Text style={styles.totalLabel}>المجموع الفرعي</Text>
              </View>
              {discount > 0 && (
                <View style={styles.totalRow}>
                  <Text style={[styles.totalValue, { color: COLORS.success }]}>
                    -{discount.toFixed(2)} ر.س
                  </Text>
                  <Text style={styles.totalLabel}>الخصم</Text>
                </View>
              )}
              <View style={styles.totalRow}>
                <Text style={styles.totalValue}>{tax.toFixed(2)} ر.س</Text>
                <Text style={styles.totalLabel}>ضريبة القيمة المضافة (15%)</Text>
              </View>
              {deliveryFee > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalValue}>{deliveryFee.toFixed(2)} ر.س</Text>
                  <Text style={styles.totalLabel}>رسوم التوصيل</Text>
                </View>
              )}
              <View style={[styles.totalRow, styles.grandTotalRow]}>
                <Text style={styles.grandTotalValue}>{total.toFixed(2)} ر.س</Text>
                <Text style={styles.grandTotalLabel}>الإجمالي</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Submit Button */}
      {items.length > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>
                تأكيد الطلب • {total.toFixed(2)} ر.س
              </Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>

    {/* Receipt Modal - online order (fetches from API) */}
    <ReceiptModal
      visible={receiptOrderId !== null}
      onClose={() => {
        setReceiptOrderId(null);
        setTimeout(() => onClose(), 500);
      }}
      orderId={receiptOrderId || undefined}
      autoPrint={true}
    />

    {/* Receipt Modal - offline/local order (no API needed) */}
    <ReceiptModal
      visible={localReceiptOrder !== null}
      onClose={() => {
        setLocalReceiptOrder(null);
        setTimeout(() => onClose(), 500);
      }}
      localOrder={localReceiptOrder || undefined}
      autoPrint={true}
    />

    {/* Tap-to-Pay NFC modal */}
    <TapToPayModal
      visible={showTapToPay}
      amount={total.toFixed(2)}
      onSuccess={() => {
        setShowTapToPay(false);
        createOrder(true); // card paid successfully
      }}
      onCancel={() => setShowTapToPay(false)}
      onError={(msg) => {
        setShowTapToPay(false);
        Alert.alert('فشل الدفع', msg);
      }}
    />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md + 2,
    backgroundColor: COLORS.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: '700',
  },
  headerTitleWrap: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  headerCount: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 1,
  },
  clearButton: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  clearText: {
    color: COLORS.error,
    fontWeight: '700',
    fontSize: 14,
  },
  content: {
    flex: 1,
  },
  emptyCart: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl * 3,
  },
  emptyIcon: {
    fontSize: 48,
    fontWeight: '200',
    color: COLORS.textMuted,
    marginBottom: SPACING.md,
  },
  emptyText: {
    ...FONTS.subtitle,
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  emptyHint: {
    ...FONTS.caption,
    color: COLORS.textLight,
  },
  section: {
    padding: SPACING.lg,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.md,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    ...FONTS.bold,
    color: COLORS.text,
    textAlign: 'right',
    marginBottom: SPACING.sm,
    fontSize: 16,
  },
  cartItem: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  cartItemInfo: {
    flex: 1,
    marginRight: SPACING.md,
  },
  cartItemName: {
    ...FONTS.bold,
    color: COLORS.text,
    fontSize: 15,
    textAlign: 'right',
  },
  cartItemPrice: {
    ...FONTS.price,
    color: COLORS.primary,
    fontSize: 14,
    textAlign: 'right',
    marginTop: 2,
  },
  cartItemUnit: {
    ...FONTS.caption,
    color: COLORS.textLight,
    textAlign: 'right',
    marginTop: 1,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.md,
    padding: 3,
  },
  qtyButton: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qtyButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  qtyText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
    marginHorizontal: SPACING.md,
    minWidth: 20,
    textAlign: 'center',
  },
  segmentControl: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.lg,
    padding: 3,
  },
  segment: {
    flex: 1,
    paddingVertical: SPACING.sm + 2,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: COLORS.primary,
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.text,
  },
  segmentTextActive: {
    color: '#fff',
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  totalsSection: {
    padding: SPACING.lg,
    backgroundColor: COLORS.card,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs + 2,
  },
  totalLabel: {
    ...FONTS.regular,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  totalValue: {
    ...FONTS.bold,
    color: COLORS.text,
    fontSize: 14,
  },
  grandTotalRow: {
    borderTopWidth: 1.5,
    borderTopColor: COLORS.border,
    marginTop: SPACING.sm,
    paddingTop: SPACING.md,
  },
  grandTotalLabel: {
    ...FONTS.bold,
    color: COLORS.text,
    fontSize: 18,
  },
  grandTotalValue: {
    ...FONTS.price,
    color: COLORS.primary,
    fontSize: 24,
  },
  footer: {
    padding: SPACING.lg,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingVertical: SPACING.md + 4,
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  kitchenNotesWrap: {
    marginTop: SPACING.sm,
    backgroundColor: COLORS.warningLight,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.warning,
  },
  kitchenNotesLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.warning,
    textAlign: 'right',
    marginBottom: 6,
  },
  kitchenNotesInput: {
    backgroundColor: COLORS.surface,
    marginBottom: 0,
    minHeight: 50,
    borderColor: COLORS.warning,
  },
});

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SPACING, RADIUS, FONTS } from '../config/theme';
import { ORDER_STATUS_MAP, ORDER_TYPE_MAP, PAYMENT_MAP } from '../types';
import type { Order } from '../types';

interface OrderCardProps {
  order: Order;
  onStatusChange: (status: string) => void;
  onPayment: (method: string) => void;
  onViewInvoice?: (order: Order) => void;
  onRefund?: (order: Order) => void;
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; border: string; label: string }> = {
  pending:    { bg: COLORS.warningLight, text: COLORS.statusPending, border: COLORS.statusPending, label: 'جديد' },
  preparing:  { bg: COLORS.infoLight, text: COLORS.statusPreparing, border: COLORS.statusPreparing, label: 'قيد التحضير' },
  ready:      { bg: COLORS.successLight, text: COLORS.statusReady, border: COLORS.statusReady, label: 'جاهز' },
  completed:  { bg: COLORS.surface, text: COLORS.statusCompleted, border: COLORS.statusCompleted, label: 'مكتمل' },
  cancelled:  { bg: COLORS.errorLight, text: COLORS.statusCancelled, border: COLORS.statusCancelled, label: 'ملغي' },
};

export default function OrderCard({ order, onStatusChange, onPayment, onViewInvoice, onRefund }: OrderCardProps) {
  const statusLabel = ORDER_STATUS_MAP[order.status] || order.status;
  const typeLabel = ORDER_TYPE_MAP[order.orderType] || order.orderType;
  const paymentLabel = PAYMENT_MAP[order.paymentMethod || 'cash'] || order.paymentMethod;
  const sc = STATUS_CONFIG[order.status] || { bg: COLORS.textSecondary, text: '#fff', border: COLORS.border, label: order.status };

  const getNextStatus = () => {
    switch (order.status) {
      case 'pending':
        return { key: 'preparing', label: 'بدء التحضير' };
      case 'preparing':
        return { key: 'ready', label: 'جاهز للتسليم' };
      case 'ready':
        return { key: 'completed', label: 'تم التسليم' };
      case 'cancelled':
      case 'completed':
        return { key: 'pending', label: 'استرجاع' };
      default:
        return null;
    }
  };

  const nextStatus = getNextStatus();
  const canCancel = order.status === 'pending' || order.status === 'preparing';

  const formatTime = (dateStr?: string | null) => {
    if (!dateStr) return '';
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const totalItems = order.items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 0;

  return (
    <View style={[s.card, { borderRightColor: sc.border, borderRightWidth: 4 }]}>
      {/* ========== STATUS BAR (top) ========== */}
      <View style={[s.statusBar, { backgroundColor: sc.bg }]}>
        <View style={s.statusLeft}>
          <Text style={[s.statusLabel, { color: sc.text }]}>{sc.label}</Text>
        </View>
        <Text style={[s.statusTime, { color: sc.text }]}>{formatTime(order.createdAt)}</Text>
      </View>

      {/* ========== ORDER HEADER ========== */}
      <View style={s.orderHeader}>
        <View style={s.orderMeta}>
          <View style={s.chipRow}>
            <View style={[s.chip, { backgroundColor: COLORS.card }]}>
              <Text style={s.chipText}>{typeLabel}</Text>
            </View>
            <View style={[s.chip, { backgroundColor: COLORS.card }]}>
              <Text style={s.chipText}>{paymentLabel}</Text>
            </View>
            {order.isPaid ? (
              <View style={[s.chip, { backgroundColor: COLORS.success + '22' }]}>
                <Text style={[s.chipText, { color: COLORS.success }]}>مدفوع</Text>
              </View>
            ) : (
              <View style={[s.chip, { backgroundColor: COLORS.warning + '22' }]}>
                <Text style={[s.chipText, { color: COLORS.warning }]}>غير مدفوع</Text>
              </View>
            )}
          </View>
        </View>
        <View style={s.orderIdWrap}>
          <Text style={s.orderNumber}>
            #{order.orderNumber || order.id?.toString().slice(-6)}
          </Text>
          <Text style={s.orderItemsCount}>{totalItems} عنصر</Text>
        </View>
      </View>

      {/* ========== CUSTOMER ========== */}
      {(order.customerName || order.customerPhone) && (
        <View style={s.customerBar}>
          <Text style={s.customerText}>
            {order.customerName}
            {order.customerPhone ? ` • ${order.customerPhone}` : ''}
          </Text>
        </View>
      )}

      {/* ========== ITEMS ========== */}
      {order.items && order.items.length > 0 ? (
        <View style={s.itemsBox}>
          <View style={s.itemsHeader}>
            <Text style={s.itemsTitle}>العناصر ({order.items.length})</Text>
          </View>
          {order.items.slice(0, 6).map((item, index) => (
            <View key={item.id || index} style={s.itemRow}>
              <Text style={s.itemPrice}>
                {parseFloat(item.totalPrice || item.unitPrice || '0').toFixed(0)} ر.س
              </Text>
              <Text style={s.itemText} numberOfLines={1}>
                <Text style={s.itemQty}>{item.quantity}× </Text>
                {item.itemName || (item as any).menuItem?.nameAr || (item as any).menuItem?.nameEn || (item as any).nameAr || 'عنصر'}
              </Text>
            </View>
          ))}
          {order.items.length > 6 && (
            <Text style={s.moreItems}>+{order.items.length - 6} عناصر أخرى...</Text>
          )}
        </View>
      ) : order.items === undefined ? (
        <View style={s.itemsBox}>
          <Text style={s.noItemsText}>جاري تحميل العناصر...</Text>
        </View>
      ) : (
        <View style={s.itemsBox}>
          <Text style={s.noItemsText}>لا توجد عناصر</Text>
        </View>
      )}

      {/* ========== NOTES ========== */}
      {order.notes && (
        <View style={s.notesBar}>
          <Text style={s.notesText} numberOfLines={2}>{order.notes}</Text>
        </View>
      )}
      {order.kitchenNotes && (
        <View style={s.kitchenNotesBar}>
          <Text style={s.kitchenNotesText} numberOfLines={2}>{order.kitchenNotes}</Text>
        </View>
      )}

      {/* ========== TOTAL + ACTIONS ========== */}
      <View style={s.footer}>
        <View style={s.footerTop}>
          <View style={s.totalWrap}>
            <Text style={s.totalAmount}>
              {parseFloat(order.total?.toString() || '0').toFixed(2)}
            </Text>
            <Text style={s.totalCurrency}> ر.س</Text>
          </View>

          <View style={s.actionRow}>
            {onViewInvoice && (
              <TouchableOpacity
                style={s.invoiceBtn}
                onPress={() => onViewInvoice(order)}
              >
                <Text style={s.invoiceBtnText}>فاتورة</Text>
              </TouchableOpacity>
            )}
            {onRefund && order.isPaid && (order.status === 'completed' || order.status === 'ready') && (
              <TouchableOpacity
                style={s.refundBtn}
                onPress={() => onRefund(order)}
              >
                <Text style={s.refundBtnText}>استرجاع</Text>
              </TouchableOpacity>
            )}
            {!order.isPaid && order.status !== 'cancelled' && (
              <TouchableOpacity
                style={s.payBtn}
                onPress={() => onPayment(order.paymentMethod || 'cash')}
              >
                <Text style={s.payBtnText}>تحصيل</Text>
              </TouchableOpacity>
            )}
            {canCancel && (
              <TouchableOpacity
                style={s.cancelBtn}
                onPress={() => onStatusChange('cancelled')}
              >
                <Text style={s.cancelBtnText}>إلغاء</Text>
              </TouchableOpacity>
            )}
            {nextStatus && (
              <TouchableOpacity
                style={s.nextBtn}
                onPress={() => onStatusChange(nextStatus.key)}
              >
                <Text style={s.nextBtnText}>{nextStatus.label}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 14,
    elevation: 5,
  },

  // Status Bar
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  statusTime: {
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.9,
  },

  // Order Header
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  orderIdWrap: {
    alignItems: 'flex-end',
  },
  orderNumber: {
    fontSize: 21,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 0.5,
  },
  orderItemsCount: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  orderMeta: {
    flex: 1,
    marginRight: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  chipText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },

  // Customer
  customerBar: {
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  customerText: {
    fontSize: 13,
    color: COLORS.text,
    textAlign: 'right',
    fontWeight: '500',
  },

  // Items
  itemsBox: {
    marginHorizontal: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  itemsHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 6,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  itemsTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.text,
  },
  noItemsText: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 4,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border,
  },
  itemText: {
    fontSize: 14,
    color: COLORS.text,
    flex: 1,
    textAlign: 'right',
    fontWeight: '600',
  },
  itemQty: {
    fontWeight: '900',
    color: COLORS.primary,
    fontSize: 15,
  },
  itemPrice: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '700',
    marginRight: 8,
    minWidth: 55,
  },
  moreItems: {
    fontSize: 11,
    color: COLORS.textLight,
    textAlign: 'right',
    marginTop: 4,
    fontStyle: 'italic',
  },

  // Notes
  notesBar: {
    paddingHorizontal: 14,
    paddingBottom: 4,
  },
  notesText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'right',
    lineHeight: 18,
  },
  kitchenNotesBar: {
    marginHorizontal: 14,
    backgroundColor: COLORS.background,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  kitchenNotesText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'right',
    fontWeight: '600',
  },

  // Footer
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  footerTop: {
    gap: 8,
  },
  totalWrap: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: '900',
    color: COLORS.primary,
  },
  totalCurrency: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    gap: 6,
  },
  invoiceBtn: {
    paddingHorizontal: 12,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  invoiceBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
  },
  payBtn: {
    paddingHorizontal: 14,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.successLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  payBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.success,
  },
  refundBtn: {
    paddingHorizontal: 12,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.errorLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.error + '66',
  },
  refundBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.error,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  cancelBtnText: {
    color: COLORS.textSecondary,
    fontWeight: '800',
    fontSize: 13,
  },
  nextBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    minWidth: 110,
    alignItems: 'center',
    backgroundColor: COLORS.primary,
  },
  nextBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },
});

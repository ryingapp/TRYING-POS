import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Modal,
  AppState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { database } from '../services/database';
import { api } from '../services/api';
import { COLORS, SPACING, RADIUS, FONTS } from '../config/theme';
import OrderCard from '../components/OrderCard';
import SyncBar from '../components/SyncBar';
import ReceiptModal from '../components/ReceiptModal';
import TapToPayModal from '../components/TapToPayModal';
import { edfaPaySoftPos } from '../services/edfapay-softpos';
import type { Order } from '../types';
import { ORDER_STATUS_MAP } from '../types';

const STATUS_TABS = [
  { key: 'all', label: 'الكل' },
  { key: 'pending', label: 'جديد' },
  { key: 'preparing', label: 'قيد التحضير' },
  { key: 'ready', label: 'جاهز' },
  { key: 'completed', label: 'مكتمل' },
  { key: 'cancelled', label: 'ملغي' },
];

const PERIOD_TABS = [
  { key: 'today', label: 'اليوم' },
  { key: 'week', label: 'الأسبوع الماضي' },
  { key: 'archived', label: 'مؤرشفة' },
  { key: 'all', label: 'الكل' },
];

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const { branch } = useAuth();
  const { isOnline, forceSync } = useSync();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [activePeriod, setActivePeriod] = useState<'today' | 'week' | 'archived' | 'all'>('today');
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  // Receipt: store the full order so local (unsynced) orders can show offline receipt
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  // Refund
  const [refundOrder, setRefundOrder] = useState<Order | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [refundLoading, setRefundLoading] = useState(false);
  const [tapPayOrderId, setTapPayOrderId] = useState<string | null>(null);
  const [tapPayAmount, setTapPayAmount] = useState('0');

  const enrichOrdersWithItems = useCallback(async (ordersData: Order[]) => {
    if (!isOnline || ordersData.length === 0) return ordersData;

    const targets = ordersData
      .filter((order) => order.id && (!order.items || order.items.length === 0))
      .slice(0, 5);

    if (targets.length === 0) return ordersData;

    const fetched = await Promise.all(
      targets.map(async (order) => {
        try {
          const items = await api.getOrderItems(order.id);
          return [order.id, items] as const;
        } catch {
          return [order.id, undefined] as const;
        }
      })
    );

    const itemsMap = new Map(fetched);
    return ordersData.map((order) => {
      const items = itemsMap.get(order.id);
      return items ? { ...order, items } : order;
    });
  }, [isOnline]);

  const loadOrders = useCallback(async () => {
    try {
      let data: Order[] = [];

      if (isOnline) {
        try {
          data = await api.getOrders(branch?.id, activePeriod);
          data = await enrichOrdersWithItems(data);
          // Save to local DB in background
          for (const order of data.slice(0, 50)) {
            database.saveOrder(order, true).catch(() => {});
          }
        } catch {
          data = await database.getOrders();
        }
      } else {
        data = await database.getOrders();
      }

      setOrders(data);
    } catch (err) {
      console.log('Load orders error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isOnline, branch, activePeriod, enrichOrdersWithItems]);

  useEffect(() => {
    loadOrders();
    // Auto-refresh every 30 seconds (avoids server 429 rate limit)
    const interval = setInterval(loadOrders, 30000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  // Also refresh when app comes back to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        loadOrders();
      }
    });
    return () => sub.remove();
  }, [loadOrders]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (isOnline) await forceSync();
    await loadOrders();
  }, [isOnline, forceSync, loadOrders]);

  const handleStatusChange = async (orderId: string, newStatus: string) => {
    if (newStatus === 'cancelled') {
      setCancelOrderId(orderId);
      return;
    }

    try {
      if (isOnline) {
        await api.updateOrderStatus(orderId, newStatus);
      } else {
        await database.addToSyncQueue('order_status', 'update', {
          orderId,
          status: newStatus,
        });
      }
      await database.updateOrderInDb(orderId, { status: newStatus } as any);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
      );
    } catch (error: any) {
      Alert.alert('خطأ', error.message || 'فشل في تحديث حالة الطلب');
    }
  };

  const handleCancel = async () => {
    if (!cancelOrderId || !cancelReason.trim()) {
      Alert.alert('خطأ', 'الرجاء إدخال سبب الإلغاء');
      return;
    }

    try {
      if (isOnline) {
        await api.updateOrderStatus(cancelOrderId, 'cancelled', cancelReason);
      } else {
        await database.addToSyncQueue('order_status', 'update', {
          orderId: cancelOrderId,
          status: 'cancelled',
          reason: cancelReason,
        });
      }
      await database.updateOrderInDb(cancelOrderId, { status: 'cancelled' } as any);
      setOrders((prev) =>
        prev.map((o) =>
          o.id === cancelOrderId ? { ...o, status: 'cancelled' } : o
        )
      );
      setCancelOrderId(null);
      setCancelReason('');
      Alert.alert('تم', 'تم إلغاء الطلب');
    } catch (error: any) {
      Alert.alert('خطأ', error.message || 'فشل في إلغاء الطلب');
    }
  };

  const handleRefund = async () => {
    if (!refundOrder || !refundReason.trim()) {
      Alert.alert('خطأ', 'الرجاء إدخال سبب الاسترجاع');
      return;
    }
    setRefundLoading(true);
    try {
      await api.refundOrder(refundOrder.id, refundReason);
      setOrders((prev) =>
        prev.map((o) => o.id === refundOrder.id ? { ...o, status: 'refunded' } : o)
      );
      await database.updateOrderInDb(refundOrder.id, { status: 'refunded' } as any);
      setRefundOrder(null);
      setRefundReason('');
      Alert.alert('تم', 'تم الاسترجاع بنجاح وإصدار إشعار دائن');
    } catch (error: any) {
      Alert.alert('خطأ في الاسترجاع', error.message || 'فشل في معالجة الاسترجاع');
    } finally {
      setRefundLoading(false);
    }
  };

  const handlePayment = async (orderId: string, method: string) => {
    try {
      // If card payment and SoftPos available, show TapToPay modal
      if (method === 'card' && edfaPaySoftPos.isAvailable()) {
        const order = orders.find((o) => o.id === orderId);
        const amount = parseFloat(order?.total?.toString() || '0').toFixed(2);
        setTapPayAmount(amount);
        setTapPayOrderId(orderId);
        return; // Payment continues in handleTapPaySuccess
      }

      // Cash: mark as paid directly
      await markOrderPaid(orderId, method);
    } catch (error: any) {
      Alert.alert('خطأ', error.message || 'فشل في تحديث الدفع');
    }
  };

  const markOrderPaid = async (orderId: string, method: string) => {
    try {
      if (isOnline) {
        await api.updateOrderPayment(orderId, method, true);
      } else {
        await database.addToSyncQueue('order_payment', 'update', {
          orderId,
          paymentMethod: method,
          isPaid: true,
        });
      }
      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId ? { ...o, paymentMethod: method, isPaid: true } : o
        )
      );
    } catch (error: any) {
      Alert.alert('خطأ', error.message || 'فشل في تحديث الدفع');
    }
  };

  const filteredOrders = orders.filter((order) => {
    if (activeTab === 'all') return true;
    return order.status === activeTab;
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>جاري تحميل الطلبات...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Status bar spacer */}
      <View style={{ height: insets.top, backgroundColor: COLORS.surface }} />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>الطلبات</Text>
        <View style={styles.orderCountBadge}>
          <Text style={styles.orderCount}>{filteredOrders.length}</Text>
        </View>
      </View>

      <SyncBar />

      {/* Period Tabs (Today / Week / Archived / All) */}
      <View style={styles.periodTabsContainer}>
        {PERIOD_TABS.map((tab) => {
          const isActive = activePeriod === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.periodTab, isActive && styles.periodTabActive]}
              onPress={() => setActivePeriod(tab.key as any)}
              activeOpacity={0.7}
            >
              <Text style={[styles.periodTabText, isActive && styles.periodTabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Status Tabs */}
      <View style={styles.tabsContainer}>
        <View style={styles.tabsGrid}>
          {STATUS_TABS.map((tab) => {
            const count = orders.filter(
              (o) => tab.key === 'all' || o.status === tab.key
            ).length;
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.tab, isActive && styles.tabActive]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.82}
              >
                <View style={styles.tabTopRow}>
                  <Text style={[styles.tabText, isActive && styles.tabTextActive]} numberOfLines={1}>
                    {tab.label}
                  </Text>
                </View>
                <View style={[styles.tabCount, isActive && styles.tabCountActive]}>
                  <Text style={[styles.tabCountText, isActive && styles.tabCountTextActive]}>{count}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Orders List */}
      <FlatList
        data={filteredOrders}
        keyExtractor={(item, index) => item.id || item.orderNumber || `local-${index}`}
        renderItem={({ item }) => (
          <OrderCard
            order={item}
            onStatusChange={(status: string) => handleStatusChange(item.id, status)}
            onPayment={(method: string) => handlePayment(item.id, method)}
            onViewInvoice={(order: Order) => setReceiptOrder(order)}
            onRefund={(order: Order) => {
              setRefundOrder(order);
              setRefundReason('');
            }}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>—</Text>
            <Text style={styles.emptyText}>لا توجد طلبات</Text>
            <Text style={styles.emptyHint}>اسحب للأسفل للتحديث</Text>
          </View>
        }
      />

      {/* Receipt Modal — uses server invoice if online/synced, else builds local receipt */}
      <ReceiptModal
        visible={receiptOrder !== null}
        onClose={() => setReceiptOrder(null)}
        orderId={receiptOrder?.id || undefined}
        localOrder={!receiptOrder?.id ? receiptOrder : undefined}
      />

      {/* Tap-to-Pay NFC Modal */}
      <TapToPayModal
        visible={tapPayOrderId !== null}
        amount={tapPayAmount}
        onSuccess={() => {
          const oid = tapPayOrderId!;
          setTapPayOrderId(null);
          markOrderPaid(oid, 'card');
        }}
        onCancel={() => setTapPayOrderId(null)}
        onError={(msg) => {
          setTapPayOrderId(null);
          Alert.alert('فشل الدفع', msg);
        }}
      />

      {/* Cancel Modal */}
      <Modal
        visible={cancelOrderId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setCancelOrderId(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>إلغاء الطلب</Text>
            <Text style={styles.modalSubtitle}>
              يجب إدخال سبب الإلغاء (مطلوب لنظام فوترة ZATCA)
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="سبب الإلغاء..."
              placeholderTextColor={COLORS.textLight}
              value={cancelReason}
              onChangeText={setCancelReason}
              multiline
              textAlign="right"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setCancelOrderId(null);
                  setCancelReason('');
                }}
              >
                <Text style={styles.modalButtonCancelText}>رجوع</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm]}
                onPress={handleCancel}
              >
                <Text style={styles.modalButtonConfirmText}>تأكيد الإلغاء</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ======= REFUND MODAL ======= */}
      <Modal
        visible={refundOrder !== null}
        transparent
        animationType="fade"
        onRequestClose={() => { setRefundOrder(null); setRefundReason(''); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>استرجاع الطلب</Text>
            <Text style={styles.modalSubtitle}>
              طلب #{refundOrder?.orderNumber} — إجمالي {parseFloat(refundOrder?.total?.toString() || '0').toFixed(2)} ر.س
            </Text>
            <Text style={[styles.modalSubtitle, { color: COLORS.error, marginTop: 4 }]}>
              سيتم إصدار إشعار دائن (ZATCA) لا يمكن التراجع عنه
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="سبب الاسترجاع... (مطلوب)"
              placeholderTextColor={COLORS.textMuted}
              value={refundReason}
              onChangeText={setRefundReason}
              multiline
              textAlign="right"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => { setRefundOrder(null); setRefundReason(''); }}
                disabled={refundLoading}
              >
                <Text style={styles.modalButtonCancelText}>رجوع</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: COLORS.error, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center', flex: 1 }]}
                onPress={handleRefund}
                disabled={refundLoading}
              >
                {refundLoading
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>تأكيد الاسترجاع</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: SPACING.md,
    ...FONTS.subtitle,
    color: COLORS.textMuted,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.text,
    letterSpacing: 0.3,
  },
  orderCountBadge: {
    backgroundColor: COLORS.primary + '22',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: COLORS.primary + '44',
  },
  orderCount: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '800',
  },
  tabsContainer: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  tabsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  tab: {
    width: '32%',
    minHeight: 54,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  tabTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 4,
  },
  tabIcon: {
    fontSize: 13,
  },
  tabIconActive: {
    opacity: 1,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  tabTextActive: {
    color: '#fff',
  },
  tabCount: {
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignSelf: 'center',
    backgroundColor: COLORS.background,
  },
  tabCountActive: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  tabCountText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
  },
  tabCountTextActive: {
    color: '#fff',
  },
  listContent: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: 110,
    gap: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxl * 3,
  },
  emptyIcon: {
    fontSize: 44,
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
    color: COLORS.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xxl,
    padding: SPACING.xl,
    width: '100%',
    maxWidth: 400,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'right',
    marginBottom: SPACING.xs,
  },
  modalSubtitle: {
    ...FONTS.caption,
    color: COLORS.textMuted,
    textAlign: 'right',
    marginBottom: SPACING.lg,
  },
  modalInput: {
    backgroundColor: '#FCFCFC',
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: '#E8E5E2',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: SPACING.lg,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  modalButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
  },
  modalButtonCancel: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  modalButtonCancelText: {
    color: COLORS.text,
    fontWeight: 'bold',
    fontSize: 15,
  },
  modalButtonConfirm: {
    backgroundColor: COLORS.error,
  },
  modalButtonConfirmText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  periodTabsContainer: {
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  periodTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  periodTabActive: {
    borderBottomColor: COLORS.primary,
  },
  periodTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textLight,
  },
  periodTabTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
});

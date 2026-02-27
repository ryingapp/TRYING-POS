/**
 * KitchenScreen — Live kitchen order display.
 *
 * Two columns: New (pending) | In Progress (preparing)
 * Tap to advance: pending → preparing → ready
 * Auto-refreshes every 10 seconds.
 * Sound notification on new orders (vibration on Android).
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Vibration,
  RefreshControl,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { api } from '../services/api';
import { COLORS, SPACING, RADIUS } from '../config/theme';
import type { Order, OrderItem } from '../types';

const POLL_INTERVAL = 10_000; // 10s

const ORDER_TYPE_LABELS: Record<string, string> = {
  dine_in: 'محلي',
  takeout: 'سفري',
  delivery: 'توصيل',
};

export default function KitchenScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width > 700;
  const { branch } = useAuth();
  const { isOnline } = useSync();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const prevCountRef = useRef(0);

  // ─── Load Orders ────────────────────────
  const loadOrders = useCallback(async () => {
    if (!isOnline || !branch) return;
    try {
      const all: Order[] = await api.getOrders();
      // Only pending + preparing for kitchen
      const kitchen = all.filter(
        (o) => o.status === 'pending' || o.status === 'preparing'
      );

      // Enrich with items (max 8 at a time)
      const needItems = kitchen.filter((o) => !o.items || o.items.length === 0).slice(0, 8);
      const enriched = await Promise.all(
        needItems.map(async (o) => {
          try {
            const items: OrderItem[] = await api.getOrderItems(o.id);
            return { ...o, items };
          } catch {
            return o;
          }
        })
      );

      const enrichMap = new Map(enriched.map((o) => [o.id, o]));
      const final = kitchen.map((o) => enrichMap.get(o.id) || o);

      // Notify on new orders
      const newPending = final.filter((o) => o.status === 'pending').length;
      if (newPending > prevCountRef.current && prevCountRef.current > 0) {
        Vibration.vibrate([0, 200, 100, 200]);
      }
      prevCountRef.current = newPending;

      setOrders(final);
    } catch (e) {
      console.log('[Kitchen] Failed to load:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isOnline, branch]);

  useEffect(() => {
    loadOrders();
    const id = setInterval(loadOrders, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [loadOrders]);

  // ─── Status Actions ─────────────────────
  const advance = async (order: Order) => {
    const next = order.status === 'pending' ? 'preparing' : 'ready';
    try {
      await api.updateOrderStatus(order.id, next);
      setOrders((prev) =>
        next === 'ready'
          ? prev.filter((o) => o.id !== order.id)
          : prev.map((o) => (o.id === order.id ? { ...o, status: next } : o))
      );
    } catch (e: any) {
      console.log('[Kitchen] Status update failed:', e);
    }
  };

  // ─── Helpers ────────────────────────────
  const pending = orders.filter((o) => o.status === 'pending');
  const preparing = orders.filter((o) => o.status === 'preparing');

  const elapsed = (date?: string | null) => {
    if (!date) return '';
    const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (mins < 1) return 'الآن';
    if (mins < 60) return `${mins} د`;
    return `${Math.floor(mins / 60)} س ${mins % 60} د`;
  };

  // ─── Order Card ─────────────────────────
  const renderCard = (order: Order) => {
    const isPending = order.status === 'pending';
    const accent = isPending ? COLORS.warning : COLORS.primary;
    const bgTint = isPending ? '#FFF8EB' : '#EBF5FF';

    return (
      <View key={order.id} style={[s.card, { borderLeftColor: accent, borderLeftWidth: 4 }]}>
        {/* Header */}
        <View style={s.cardHead}>
          <View style={{ flex: 1 }}>
            <Text style={s.orderNum}>#{order.orderNumber}</Text>
            <Text style={s.orderMeta}>
              {ORDER_TYPE_LABELS[order.orderType] || order.orderType}
              {order.customerName ? ` · ${order.customerName}` : ''}
            </Text>
          </View>
          <View style={[s.timeBadge, { backgroundColor: bgTint }]}>
            <Text style={[s.timeText, { color: accent }]}>{elapsed(order.createdAt)}</Text>
          </View>
        </View>

        {/* Items */}
        {order.items && order.items.length > 0 ? (
          <View style={s.itemList}>
            {order.items.map((item, idx) => (
              <View key={item.id || idx} style={s.itemRow}>
                <View style={s.qtyBadge}>
                  <Text style={s.qtyText}>{item.quantity}×</Text>
                </View>
                <Text style={s.itemName} numberOfLines={1}>
                  {item.itemName || '—'}
                </Text>
                {item.notes ? <Text style={s.itemNote}>{item.notes}</Text> : null}
              </View>
            ))}
          </View>
        ) : (
          <Text style={s.noItems}>لا توجد تفاصيل</Text>
        )}

        {/* Kitchen Notes */}
        {order.kitchenNotes ? (
          <View style={s.kitchenNote}>
            <Text style={s.kitchenNoteText}>{order.kitchenNotes}</Text>
          </View>
        ) : null}

        {/* Action */}
        <TouchableOpacity
          style={[s.actionBtn, { backgroundColor: isPending ? COLORS.primary : COLORS.success }]}
          onPress={() => advance(order)}
          activeOpacity={0.7}
        >
          <Text style={s.actionText}>
            {isPending ? 'ابدأ التحضير' : 'جاهز ✓'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ─── Loading / Offline ──────────────────
  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={s.loadText}>جاري تحميل طلبات المطبخ...</Text>
      </View>
    );
  }

  if (!isOnline) {
    return (
      <View style={s.center}>
        <Text style={{ fontSize: 14, color: COLORS.textSecondary }}>غير متصل بالإنترنت</Text>
      </View>
    );
  }

  // ─── Layout ─────────────────────────────
  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>المطبخ</Text>
        <View style={s.headerRight}>
          <View style={s.badge}>
            <Text style={s.badgeText}>{orders.length}</Text>
          </View>
          <Text style={s.headerSub}>طلب نشط</Text>
        </View>
      </View>

      {isWide ? (
        /* ── Wide: two-column layout ── */
        <View style={s.columns}>
          <View style={s.col}>
            <View style={[s.colHeader, { backgroundColor: COLORS.warning + '22' }]}>
              <Text style={[s.colTitle, { color: COLORS.warning }]}>جديد ({pending.length})</Text>
            </View>
            <FlatList
              data={pending}
              keyExtractor={(o) => o.id}
              renderItem={({ item }) => renderCard(item)}
              contentContainerStyle={s.listContent}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadOrders(); }} />
              }
              ListEmptyComponent={<Text style={s.empty}>لا توجد طلبات جديدة</Text>}
            />
          </View>

          <View style={[s.col, { borderLeftWidth: 1, borderLeftColor: COLORS.border }]}>
            <View style={[s.colHeader, { backgroundColor: COLORS.primary + '22' }]}>
              <Text style={[s.colTitle, { color: COLORS.primary }]}>قيد التحضير ({preparing.length})</Text>
            </View>
            <FlatList
              data={preparing}
              keyExtractor={(o) => o.id}
              renderItem={({ item }) => renderCard(item)}
              contentContainerStyle={s.listContent}
              ListEmptyComponent={<Text style={s.empty}>لا توجد طلبات قيد التحضير</Text>}
            />
          </View>
        </View>
      ) : (
        /* ── Narrow: single list with section headers ── */
        <FlatList
          data={[...pending, ...preparing]}
          keyExtractor={(o) => o.id}
          renderItem={({ item }) => renderCard(item)}
          contentContainerStyle={[s.listContent, { paddingBottom: insets.bottom + 80 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadOrders(); }} />
          }
          ListEmptyComponent={
            <View style={s.center}>
              <Text style={{ fontSize: 28, fontWeight: '300', color: COLORS.textMuted }}>لا توجد طلبات</Text>
              <Text style={s.emptySub}>الطلبات الجديدة ستظهر هنا تلقائياً</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
    padding: 32,
  },
  loadText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },

  // Header
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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerSub: {
    fontSize: 15,
    color: COLORS.textSecondary,
    fontWeight: '500',
    marginLeft: 8,
  },
  badge: {
    backgroundColor: COLORS.error,
    borderRadius: 12,
    minWidth: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  badgeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },

  // Columns (wide)
  columns: {
    flex: 1,
    flexDirection: 'row',
  },
  col: {
    flex: 1,
  },
  colHeader: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  colTitle: {
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },

  listContent: {
    padding: 12,
  },

  // Card
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  orderNum: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  orderMeta: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
    marginTop: 2,
  },
  timeBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Items
  itemList: {
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderLight,
  },
  qtyBadge: {
    backgroundColor: COLORS.background,
    borderRadius: 6,
    width: 32,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  qtyText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },
  itemName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  itemNote: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginLeft: 8,
  },
  noItems: {
    fontSize: 13,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: 8,
  },

  // Kitchen note
  kitchenNote: {
    backgroundColor: '#FFF8EB',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  kitchenNoteText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.warning,
  },

  // Action button
  actionBtn: {
    borderRadius: RADIUS.sm,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Empty states
  empty: {
    fontSize: 15,
    color: COLORS.textMuted,
    textAlign: 'center',
    paddingVertical: 40,
      fontWeight: '500',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginTop: 16,
  },
  emptySub: {
    fontSize: 15,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
});

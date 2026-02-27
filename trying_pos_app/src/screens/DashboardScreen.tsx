import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { useLang } from '../context/LanguageContext';
import { api } from '../services/api';
import { database } from '../services/database';
import { COLORS, SPACING, RADIUS } from '../config/theme';
import type { Order } from '../types';

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { user, branch } = useAuth();
  const { isOnline } = useSync();
  const { t } = useLang();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dataSource, setDataSource] = useState<'api' | 'local'>('api');

  const load = useCallback(async () => {
    try {
      let all: Order[] = [];

      if (isOnline && branch) {
        try {
          all = await api.getOrders();
          setDataSource('api');
        } catch (e) {
          console.log('[Dashboard] API error, falling back to local:', e);
          all = await database.getOrders();
          setDataSource('local');
        }
      } else {
        // Offline - load from SQLite
        all = await database.getOrders();
        setDataSource('local');
      }

      // Filter today only
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayOrders = all.filter((o) => {
        if (!o.createdAt) return false;
        return new Date(o.createdAt) >= today;
      });
      setOrders(todayOrders);
    } catch (e) {
      console.log('[Dashboard] load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isOnline, branch]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  // ─── Computed Metrics ───────────────────
  const totalOrders = orders.length;
  const revenue = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + parseFloat(o.total || '0'), 0);
  const avgValue = totalOrders > 0 ? revenue / totalOrders : 0;
  const paidCount = orders.filter((o) => o.isPaid && o.status !== 'cancelled').length;

  const byStatus = {
    pending: orders.filter((o) => o.status === 'pending').length,
    preparing: orders.filter((o) => o.status === 'preparing').length,
    ready: orders.filter((o) => o.status === 'ready').length,
    completed: orders.filter((o) => o.status === 'completed').length,
    cancelled: orders.filter((o) => o.status === 'cancelled').length,
  };

  const byType = {
    dine_in: orders.filter((o) => o.orderType === 'dine_in').length,
    takeout: orders.filter((o) => o.orderType === 'takeout').length,
    delivery: orders.filter((o) => o.orderType === 'delivery').length,
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t('dash.greeting.morning');
    return t('dash.greeting.evening');
  };

  if (loading) {
    return (
      <View style={[s.root, s.center]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* ── Dark Header ── */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <View>
            <Text style={s.greeting}>{greeting()}</Text>
            <Text style={s.name}>{user?.name || 'مرحباً'}</Text>
          </View>
          <TouchableOpacity style={s.branchPill} activeOpacity={0.7}>
            <View style={s.branchDot} />
            <Text style={s.branchText}>{branch?.nameAr || branch?.name || '—'}</Text>
          </TouchableOpacity>
        </View>

        {/* Big Revenue highlight */}
        <View style={s.revenueBox}>
          <Text style={s.revenueLabel}>إجمالي اليوم</Text>
          <Text style={s.revenueValue}>{revenue.toFixed(2)}</Text>
          <Text style={s.revenueCurrency}>ريال سعودي</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
            tintColor={COLORS.primary}
          />
        }
      >
        {/* ── Metric Cards row ── */}
        <View style={s.metricsRow}>
          <MetricCard label="الطلبات" value={`${totalOrders}`} color={COLORS.primary} icon="↑" />
          <MetricCard label="متوسط الطلب" value={`${avgValue.toFixed(0)}`} color={COLORS.accent} icon="≈" sub="ر.س" />
          <MetricCard label="المدفوعة" value={`${paidCount}`} color="#A78BFA" icon="✓" />
        </View>

        {/* ── Status SECTION ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>حالة الطلبات</Text>
          <View style={s.card}>
            <StatusRow label="جديد"           count={byStatus.pending}   color={COLORS.statusPending}   />
            <StatusRow label="قيد التحضير"    count={byStatus.preparing} color={COLORS.statusPreparing} />
            <StatusRow label="جاهز"           count={byStatus.ready}     color={COLORS.statusReady}     />
            <StatusRow label="مكتمل"          count={byStatus.completed} color={COLORS.statusCompleted} />
            <StatusRow label="ملغي"           count={byStatus.cancelled} color={COLORS.statusCancelled} last />
          </View>
        </View>

        {/* ── Type SECTION ── */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>نوع الطلبات</Text>
          <View style={s.card}>
            <StatusRow label="في المطعم"  count={byType.dine_in}  color={COLORS.typeDineIn}  />
            <StatusRow label="استلام"     count={byType.takeout}  color={COLORS.typePickup}  />
            <StatusRow label="توصيل"      count={byType.delivery} color={COLORS.typeDelivery} last />
          </View>
        </View>

        {dataSource === 'local' && (
          <View style={s.offlineBanner}>
            <Text style={s.offlineText}>
              {isOnline ? 'بيانات محلية' : '⚡ وضع غير متصل'}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function MetricCard({ label, value, color, icon, sub }: {
  label: string; value: string; color: string; icon?: string; sub?: string;
}) {
  return (
    <View style={[mc.wrap, { borderTopColor: color, borderTopWidth: 3 }]}>
      <Text style={[mc.icon, { color }]}>{icon}</Text>
      <View style={mc.valueRow}>
        <Text style={[mc.value, { color }]}>{value}</Text>
        {sub && <Text style={[mc.sub, { color }]}>{sub}</Text>}
      </View>
      <Text style={mc.label}>{label}</Text>
    </View>
  );
}

const mc = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'flex-end',
  },
  icon: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  value: {
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 30,
  },
  sub: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
    opacity: 0.7,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 4,
    letterSpacing: 0.3,
  },
});

function StatusRow({ label, count, color, last }: {
  label: string; count: number; color: string; last?: boolean;
}) {
  const pct = count > 0 ? Math.min(count * 15, 100) : 0;
  return (
    <View style={[sr.row, !last && sr.border]}>
      <View style={sr.left}>
        <View style={[sr.dot, { backgroundColor: color }]} />
        <Text style={sr.label}>{label}</Text>
      </View>
      <View style={sr.right}>
        <View style={sr.barBg}>
          <View style={[sr.barFill, { width: `${pct}%` as any, backgroundColor: color }]} />
        </View>
        <View style={[sr.badge, { backgroundColor: color + '22' }]}>
          <Text style={[sr.count, { color }]}>{count}</Text>
        </View>
      </View>
    </View>
  );
}

const sr = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  border: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 15, fontWeight: '500', color: COLORS.text },
  right: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barBg: {
    width: 60,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 2 },
  badge: {
    borderRadius: 8,
    minWidth: 34,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  count: { fontSize: 14, fontWeight: '800' },
});

// ── Styles ──────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.background },
  center: { justifyContent: 'center', alignItems: 'center' },

  /* header */
  header: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  greeting: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign: 'right',
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    textAlign: 'right',
    marginTop: 3,
  },
  branchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  branchDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  branchText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.text,
  },

  /* revenue */
  revenueBox: {
    alignItems: 'flex-end',
  },
  revenueLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  revenueValue: {
    fontSize: 48,
    fontWeight: '900',
    color: COLORS.primary,
    lineHeight: 52,
  },
  revenueCurrency: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: 2,
  },

  /* content */
  content: { padding: 16, gap: 4 },

  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },

  section: { marginBottom: 20 },

  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textMuted,
    textAlign: 'right',
    marginBottom: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  offlineBanner: {
    backgroundColor: COLORS.warningLight,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.warning + '44',
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  offlineText: {
    fontSize: 13,
    color: COLORS.warning,
    fontWeight: '700',
  },
});

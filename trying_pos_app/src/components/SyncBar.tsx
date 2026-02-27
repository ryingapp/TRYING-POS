import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useSync } from '../context/SyncContext';
import { useLang } from '../context/LanguageContext';
import { COLORS, SPACING, FONTS } from '../config/theme';

export default function SyncBar() {
  const { status, pendingCount, isOnline, forceSync } = useSync();
  const { t } = useLang();

  // Don't show when everything is fine
  if (status === 'idle' && pendingCount === 0 && isOnline) return null;

  const getBarStyle = () => {
    if (!isOnline || status === 'offline') return styles.barOffline;
    if (status === 'syncing') return styles.barSyncing;
    if (status === 'error') return styles.barError;
    if (pendingCount > 0) return styles.barPending;
    return styles.barOk;
  };

  const getMessage = () => {
    if (!isOnline || status === 'offline') return t('sync.offlineMode');
    if (status === 'syncing') return t('sync.syncing');
    if (status === 'error') return t('sync.error');
    if (pendingCount > 0) return `${pendingCount} ${t('sync.pendingItems')}`;
    return '';
  };

  const message = getMessage();
  if (!message) return null;

  return (
    <TouchableOpacity
      style={[styles.bar, getBarStyle()]}
      onPress={isOnline ? forceSync : undefined}
      activeOpacity={isOnline ? 0.7 : 1}
    >
      <Text style={styles.message}>{message}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  bar: {
    paddingVertical: 6,
    paddingHorizontal: SPACING.md,
    alignItems: 'center',
  },
  barOffline: {
    backgroundColor: COLORS.textMuted,
  },
  barSyncing: {
    backgroundColor: COLORS.warning,
  },
  barError: {
    backgroundColor: COLORS.error,
  },
  barPending: {
    backgroundColor: COLORS.info,
  },
  barOk: {
    backgroundColor: COLORS.success,
  },
  message: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
});

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { useLang } from '../context/LanguageContext';
import { database } from '../services/database';
import { COLORS, SPACING, RADIUS, FONTS } from '../config/theme';
import SyncBar from '../components/SyncBar';

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user, branch, branches, logout, selectBranch, refreshBranches } = useAuth();
  const { status, pendingCount, lastSyncTime, isOnline, forceSync } = useSync();
  const { t, lang, setLang } = useLang();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    await forceSync();
    setSyncing(false);
  };

  const handleLogout = () => {
    Alert.alert(t('settings.logout'), t('settings.logoutConfirm'), [
      { text: t('settings.cancel'), style: 'cancel' },
      {
        text: t('settings.logout'),
        style: 'destructive',
        onPress: logout,
      },
    ]);
  };

  const handleClearData = () => {
    Alert.alert(
      t('settings.clearData'),
      t('settings.clearConfirm'),
      [
        { text: t('settings.cancel'), style: 'cancel' },
        {
          text: t('settings.clear'),
          style: 'destructive',
          onPress: async () => {
            await database.clearAll();
            Alert.alert(t('settings.done'), t('settings.clearedMsg'));
          },
        },
      ]
    );
  };

  const getStatusText = () => {
    switch (status) {
      case 'idle':
        return t('sync.connected');
      case 'syncing':
        return t('sync.syncing');
      case 'error':
        return t('sync.error');
      case 'offline':
        return t('sync.offline');
      default:
        return status;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'idle':
        return COLORS.success;
      case 'syncing':
        return COLORS.warning;
      case 'error':
        return COLORS.error;
      case 'offline':
        return COLORS.textLight;
    }
  };

  return (
    <View style={styles.container}>
      {/* Status bar spacer */}
      <View style={{ height: insets.top, backgroundColor: COLORS.surface }} />
      
      {/* Header */}
      <View style={styles.headerBar}>
        <View style={styles.headerLogoWrap}>
          <View style={styles.headerLogo}>
            <Text style={styles.headerLogoText}>T</Text>
          </View>
          <Text style={styles.headerBrand}>Trying</Text>
        </View>
        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
      </View>
      
      <SyncBar />

      <ScrollView contentContainerStyle={styles.content}>
        {/* User Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.user')}</Text>
          <View style={styles.card}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(user?.name || user?.email || '?')[0].toUpperCase()}
              </Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{user?.name || t('settings.user')}</Text>
              <Text style={styles.userEmail}>{user?.email}</Text>
              <View style={styles.roleBadge}>
                <Text style={styles.roleText}>{user?.role || 'cashier'}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Branch Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.branch')}</Text>
          <View style={styles.branchList}>
            {branches.map((b) => (
              <TouchableOpacity
                key={b.id}
                style={[
                  styles.branchCard,
                  branch?.id === b.id && styles.branchCardActive,
                ]}
                onPress={() => selectBranch(b)}
              >
                <Text
                  style={[
                    styles.branchName,
                    branch?.id === b.id && styles.branchNameActive,
                  ]}
                >
                  {b.nameAr || b.name}
                </Text>
                {branch?.id === b.id && (
                  <Text style={styles.branchCheck}>✓</Text>
                )}
              </TouchableOpacity>
            ))}
            {branches.length === 0 && (
              <Text style={styles.noBranches}>{t('settings.noBranches')}</Text>
            )}
          </View>
        </View>

        {/* Language */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
          <View style={styles.langRow}>
            <TouchableOpacity
              style={[styles.langBtn, lang === 'ar' && styles.langBtnActive]}
              onPress={() => setLang('ar')}
            >
              <Text style={[styles.langBtnText, lang === 'ar' && styles.langBtnTextActive]}>
                {t('settings.langAr')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.langBtn, lang === 'en' && styles.langBtnActive]}
              onPress={() => setLang('en')}
            >
              <Text style={[styles.langBtnText, lang === 'en' && styles.langBtnTextActive]}>
                {t('settings.langEn')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sync Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.sync')}</Text>
          <View style={styles.syncCard}>
            <View style={styles.syncRow}>
              <Text style={styles.syncLabel}>{t('settings.syncStatus')}</Text>
              <View style={styles.syncStatusRow}>
                <View
                  style={[
                    styles.syncDot,
                    { backgroundColor: getStatusColor() },
                  ]}
                />
                <Text style={styles.syncValue}>{getStatusText()}</Text>
              </View>
            </View>

            <View style={styles.syncRow}>
              <Text style={styles.syncLabel}>{t('settings.syncPending')}</Text>
              <Text style={styles.syncValue}>
                {pendingCount} {pendingCount === 1 ? t('settings.item') : t('settings.items')}
              </Text>
            </View>

            <View style={styles.syncRow}>
              <Text style={styles.syncLabel}>{t('settings.syncLast')}</Text>
              <Text style={styles.syncValue}>
                {lastSyncTime
                  ? lastSyncTime.toLocaleTimeString(lang === 'ar' ? 'ar-SA' : 'en-US')
                  : t('settings.syncNotYet')}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.syncButton, syncing && styles.syncButtonDisabled]}
              onPress={handleSync}
              disabled={syncing}
            >
              <Text style={styles.syncButtonText}>
                {syncing ? t('settings.syncing') : t('settings.syncNow')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.actions')}</Text>

          <TouchableOpacity style={styles.actionButton} onPress={handleClearData}>
            <Text style={styles.actionButtonText}>{t('settings.clearData')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.logoutButton]}
            onPress={handleLogout}
          >
            <Text style={[styles.actionButtonText, styles.logoutButtonText]}>
              {t('settings.logout')}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.version}>Trying POS v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  headerBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 16,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerLogoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerLogo: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  headerLogoText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#fff',
  },
  headerBrand: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.text,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.text,
  },
  content: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: 110,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
    textAlign: 'right',
    letterSpacing: 0.3,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  avatarText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.text,
  },
  userEmail: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  roleBadge: {
    backgroundColor: COLORS.primary + '22',
    borderWidth: 1,
    borderColor: COLORS.primary + '44',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  roleText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  branchList: {
    gap: SPACING.sm,
  },
  branchCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  branchCardActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary + '11',
  },
  branchName: {
    ...FONTS.bold,
    color: COLORS.text,
    fontSize: 16,
  },
  branchNameActive: {
    color: COLORS.primary,
  },
  branchCheck: {
    color: COLORS.primary,
    fontSize: 20,
    fontWeight: 'bold',
  },
  noBranches: {
    ...FONTS.subtitle,
    color: COLORS.textMuted,
    textAlign: 'center',
    padding: SPACING.lg,
  },
  langRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  langBtn: {
    flex: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    padding: SPACING.md + 2,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.border,
  },
  langBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
  },
  langBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  langBtnTextActive: {
    color: COLORS.primary,
    fontWeight: '700',
  },
  syncCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: SPACING.lg,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8,
    elevation: 2,
  },
  syncRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  syncLabel: {
    ...FONTS.regular,
    color: COLORS.textMuted,
    fontSize: 14,
  },
  syncStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  syncDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: SPACING.xs,
  },
  syncValue: {
    ...FONTS.bold,
    color: COLORS.text,
    fontSize: 14,
  },
  syncButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: SPACING.md + 2,
    alignItems: 'center',
    marginTop: SPACING.sm,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  syncButtonDisabled: {
    opacity: 0.7,
  },
  syncButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  actionButton: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: SPACING.md + 2,
    marginBottom: SPACING.sm,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4,
    elevation: 1,
  },
  actionButtonText: {
    fontSize: 16,
    color: COLORS.text,
    textAlign: 'center',
    fontWeight: '600',
  },
  logoutButton: {
    borderColor: COLORS.error,
    backgroundColor: COLORS.errorLight,
  },
  logoutButtonText: {
    color: COLORS.error,
    fontWeight: '700',
  },
  version: {
    textAlign: 'center',
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: SPACING.xl,
    marginBottom: SPACING.md,
  },
});

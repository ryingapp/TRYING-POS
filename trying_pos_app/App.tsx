import React, { useEffect } from 'react';
import { StatusBar, ActivityIndicator, View, Text, StyleSheet, I18nManager } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { CartProvider } from './src/context/CartContext';
import { SyncProvider } from './src/context/SyncContext';
import { LanguageProvider, useLang } from './src/context/LanguageContext';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import PosScreen from './src/screens/PosScreen';
import OrdersScreen from './src/screens/OrdersScreen';
import KitchenScreen from './src/screens/KitchenScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { COLORS } from './src/config/theme';
import { edfaPaySoftPos } from './src/services/edfapay-softpos';

// Enable RTL for Arabic
I18nManager.allowRTL(true);

const Tab = createBottomTabNavigator();

function MainTabs() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useLang();

  const isAdmin = user?.role === 'owner' || user?.role === 'platform_admin' || user?.role === 'branch_manager';
  const can = (perm: boolean | undefined) => isAdmin || perm !== false;

  const canDashboard = can(user?.permDashboard);
  const canPos       = can(user?.permPos);
  const canOrders    = can(user?.permOrders);
  const canKitchen   = can(user?.permKitchen);
  const canSettings  = can(user?.permSettings);

  const isKitchenOnly =
    user?.role === 'kitchen' ||
    (!canPos && !canOrders && !canDashboard && canKitchen);

  const TAB_ICONS: Record<string, { active: string; inactive: string }> = {
    Dashboard: { active: '◈', inactive: '◇' },
    POS:       { active: '⊞', inactive: '⊟' },
    Orders:    { active: '≡', inactive: '☰' },
    Kitchen:   { active: '◉', inactive: '○' },
    Settings:  { active: '⚙', inactive: '⚙' },
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarIcon: ({ focused, color }) => {
          const icons = TAB_ICONS[route.name] ?? { active: '●', inactive: '○' };
          return (
            <Text style={{ fontSize: 18, color, lineHeight: 22 }}>
              {focused ? icons.active : icons.inactive}
            </Text>
          );
        },
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 10,
          height: 62 + Math.max(insets.bottom, 8),
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 2,
          letterSpacing: 0.3,
        },
        tabBarItemStyle: {
          paddingTop: 2,
        },
      })}
    >
      {isKitchenOnly ? (
        <>
          <Tab.Screen name="Kitchen" component={KitchenScreen} options={{ tabBarLabel: t('nav.kitchen') }} />
          {canSettings && (
            <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: t('nav.settings') }} />
          )}
        </>
      ) : (
        <>
          {canDashboard && (
            <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarLabel: t('nav.dashboard') }} />
          )}
          {canPos && (
            <Tab.Screen name="POS" component={PosScreen} options={{ tabBarLabel: t('nav.pos') }} />
          )}
          {canOrders && (
            <Tab.Screen name="Orders" component={OrdersScreen} options={{ tabBarLabel: t('nav.orders') }} />
          )}
          {canKitchen && (
            <Tab.Screen name="Kitchen" component={KitchenScreen} options={{ tabBarLabel: t('nav.kitchen') }} />
          )}
          {canSettings && (
            <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: t('nav.settings') }} />
          )}
        </>
      )}
    </Tab.Navigator>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      edfaPaySoftPos.init().catch(() => {});
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <View style={styles.splash}>
        <View style={styles.splashGlow} />
        <View style={styles.splashMark}>
          <Text style={styles.splashLetter}>T</Text>
        </View>
        <Text style={styles.splashBrand}>TRYING</Text>
        <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 32 }} />
        <Text style={styles.splashText}>جاري التحميل...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <CartProvider>
      <SyncProvider>
        <NavigationContainer>
          <MainTabs />
        </NavigationContainer>
      </SyncProvider>
    </CartProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
      <LanguageProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  splashGlow: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: COLORS.primary,
    opacity: 0.06,
  },
  splashMark: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
  },
  splashLetter: {
    fontSize: 40,
    fontWeight: '900',
    color: '#fff',
  },
  splashBrand: {
    marginTop: 20,
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.text,
    letterSpacing: 4,
  },
  splashText: {
    marginTop: 10,
    fontSize: 13,
    color: COLORS.textMuted,
    fontWeight: '500',
  },
});

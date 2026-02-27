/**
 * EdfaPay SoftPOS SDK Service — v1.0.5+
 *
 * Wraps the `edfapay-react-native` SDK for NFC Tap-to-Pay payments.
 *
 * When EDFAPAY_AUTH_TOKEN is empty → DEMO mode (simulated payment with UI)
 * When EDFAPAY_AUTH_TOKEN is set  → real NFC SDK via EdfaPayPlugin
 *
 * Reference: https://docs.edfapay.com/softpos
 */

import { Platform } from 'react-native';
import { api } from './api';

// ==================== SDK TYPES (lazy-loaded) ====================
let EdfaPayPlugin: any = null;
let TransactionType: any = null;
let FlowType: any = null;
let Env: any = null;
let Presentation: any = null;
let PurchaseSecondaryAction: any = null;

// ==================== CONFIG ====================
// Token is fetched dynamically from server per restaurant
// Fallback: set manually here for testing
let EDFAPAY_AUTH_TOKEN = '';             // Fetched from server
let EDFAPAY_ENV: string = 'SANDBOX';    // Fetched from server

// Partner config — encrypted string from EdfaPay partner portal
// This is the SAME for all restaurants under your partner account
const EDFAPAY_PARTNER_CONFIG = '';      // Your encrypted partner config string

// Demo mode: simulates payment when auth is empty
const isDemoMode = () => !EDFAPAY_AUTH_TOKEN;

// ==================== TYPES ====================
export interface PaymentResult {
  success: boolean;
  transaction?: {
    transactionNumber?: string;
    rrn?: string;
    authCode?: string;
    amount: string;
    currency?: string;
    status: string;
    operationType?: string;
    cardNumber?: string;
    formattedScheme?: string;
    cardholderName?: string;
    transactionDate?: string;
  };
  error?: string;
  cancelledByUser?: boolean;
}

export interface RefundResult {
  success: boolean;
  transaction?: any;
  error?: string;
}

// ==================== SERVICE ====================

class EdfaPaySoftPosService {
  private initialized = false;
  private initializing = false;
  private sessionId: string | null = null;

  /**
   * Whether Tap-to-Pay is available:
   * - Demo mode: always true (shows simulation)
   * - Real mode: Android only
   */
  isAvailable(): boolean {
    if (isDemoMode()) return true;
    return Platform.OS === 'android';
  }

  isDemoMode(): boolean {
    return isDemoMode();
  }

  isReady(): boolean {
    return this.initialized && this.isAvailable();
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  /**
   * Initialize the SDK
   * In demo mode: instant.
   * In real mode: dynamically imports the SDK and calls EdfaPayPlugin.initiate()
   */
  async init(): Promise<boolean> {
    // Fetch auth token from server for this restaurant
    try {
      const config = await api.getSoftposToken();
      if (config.authToken) {
        EDFAPAY_AUTH_TOKEN = config.authToken;
        EDFAPAY_ENV = config.environment || 'SANDBOX';
        console.log('[EdfaPay] Token loaded from server, env:', EDFAPAY_ENV);
      }
    } catch (e: any) {
      console.log('[EdfaPay] Could not fetch token from server, using local config');
    }

    if (isDemoMode()) {
      this.initialized = true;
      console.log('[EdfaPay] Demo mode — SDK simulated');
      return true;
    }

    if (this.initialized) return true;
    if (this.initializing) return false;
    this.initializing = true;

    try {
      // Dynamic import — avoids crash on iOS or when SDK isn't installed
      const sdk = await import('edfapay-react-native');
      EdfaPayPlugin = sdk.EdfaPayPlugin ?? sdk.default?.EdfaPayPlugin ?? sdk;
      TransactionType = sdk.TransactionType;
      FlowType = sdk.FlowType;
      Env = sdk.Env;
      Presentation = sdk.Presentation;
      PurchaseSecondaryAction = sdk.PurchaseSecondaryAction;

      // Enable logs in dev
      if (__DEV__) {
        EdfaPayPlugin.setEnableLogs?.(true) ?? EdfaPayPlugin.enableLogs?.(true);
      }

      // ★ Apply partner config BEFORE initialization (required for partners)
      if (EDFAPAY_PARTNER_CONFIG) {
        try {
          EdfaPayPlugin.setPartnerConfig(EDFAPAY_PARTNER_CONFIG);
          console.log('[EdfaPay] Partner config applied');
        } catch (e: any) {
          console.warn('[EdfaPay] setPartnerConfig failed:', e?.message);
        }
      }

      // Set theme to match app branding (call BEFORE initiate)
      try {
        EdfaPayPlugin.setTheme?.({
          primaryColor: '#22C55E',        // app green
          secondaryColor: '#FFFFFF',
          fontScale: 1.1,
          presentation: Presentation?.DIALOG_BOTTOM_FILL ?? 'DIALOG_BOTTOM_FILL',
          presentationOptions: {
            cornerRadius: 20,
            dimAmount: 0.6,
            dismissOnTouchOutside: false,
            dismissOnBackPress: false,
            purchaseSecondaryAction: PurchaseSecondaryAction?.REVERSE ?? 'REVERSE',
            shufflePinPad: true,
          },
        });
      } catch {
        // Theme is optional — don't block init
      }

      // Determine environment
      const env =
        EDFAPAY_ENV === 'PRODUCTION'
          ? Env?.PRODUCTION ?? 'PRODUCTION'
          : Env?.SANDBOX ?? 'SANDBOX';

      // Build credentials
      const credentials = {
        environment: env,
        authCode: EDFAPAY_AUTH_TOKEN,
      };

      // Initiate SDK with terminal binding handler
      const sid = await EdfaPayPlugin.initiate(credentials, {
        onTerminalBindingTask: (bindingTask: any) => {
          // Use SDK's built-in terminal selection UI
          bindingTask.bind();
        },
      });

      this.sessionId = sid ?? null;
      this.initialized = true;
      console.log('[EdfaPay] SDK initialized — session:', sid);
      return true;
    } catch (error: any) {
      console.error('[EdfaPay] Init error:', error?.message ?? error);
      return false;
    } finally {
      this.initializing = false;
    }
  }

  /**
   * Process a Tap-to-Pay NFC purchase
   */
  async purchase(amount: string, orderId?: string): Promise<PaymentResult> {
    // Demo mode — simulated success
    if (isDemoMode()) {
      return {
        success: true,
        transaction: {
          transactionNumber: `DEMO-${Date.now()}`,
          rrn: `DEMO${Date.now().toString().slice(-8)}`,
          amount,
          status: 'APPROVED',
          operationType: 'PURCHASE',
          formattedScheme: 'DEMO',
          cardNumber: '****1234',
          currency: 'SAR',
        },
      };
    }

    // Ensure SDK ready
    if (!this.initialized || !EdfaPayPlugin) {
      const ok = await this.init();
      if (!ok) return { success: false, error: 'فشل تهيئة EdfaPay SDK' };
    }

    try {
      const txnParams = {
        amount,
        transactionType: TransactionType?.PURCHASE ?? 'PURCHASE',
        ...(orderId ? { orderId } : {}),
      };

      const transaction = await EdfaPayPlugin.purchase({
        txnParams,
        flowType: FlowType?.DETAIL ?? 'DETAIL',
      });

      console.log('[EdfaPay] Purchase result:', transaction?.rrn, transaction?.status);

      return {
        success: true,
        transaction: {
          transactionNumber: transaction?.transactionNumber,
          rrn: transaction?.rrn,
          authCode: transaction?.authCode,
          amount: transaction?.amount ?? amount,
          currency: transaction?.currency ?? 'SAR',
          status: transaction?.status ?? 'APPROVED',
          operationType: transaction?.operationType ?? 'PURCHASE',
          cardNumber: transaction?.cardNumber ?? transaction?.formatCreditCardNumber?.() ?? '',
          formattedScheme: transaction?.formattedScheme,
          cardholderName: transaction?.cardholderName,
          transactionDate: transaction?.createdDate ?? transaction?.formattedCreatedDate,
        },
      };
    } catch (error: any) {
      const msg = error?.message ?? 'خطأ في عملية الدفع';

      // User cancellation
      if (
        error?.code === 'CANCELLED_BY_USER' ||
        msg.toLowerCase().includes('cancel')
      ) {
        return { success: false, error: 'تم الإلغاء', cancelledByUser: true };
      }

      // Timeout
      if (error?.code === 'TIMEOUT' || msg.toLowerCase().includes('timeout')) {
        return { success: false, error: 'انتهت مهلة العملية' };
      }

      // Session expired — try re-init
      if (msg.toLowerCase().includes('session expired') || msg.toLowerCase().includes('not initialized')) {
        this.initialized = false;
        return { success: false, error: 'انتهت الجلسة — حاول مرة أخرى' };
      }

      console.error('[EdfaPay] Purchase error:', msg);
      return { success: false, error: msg };
    }
  }

  /**
   * Refund a previous purchase via NFC
   */
  async refund(amount: string, originalRrn: string, originalDate: string): Promise<RefundResult> {
    if (isDemoMode()) {
      return {
        success: true,
        transaction: {
          transactionNumber: `DEMO-REF-${Date.now()}`,
          rrn: `DREF${Date.now().toString().slice(-8)}`,
          amount,
          status: 'APPROVED',
          operationType: 'REFUND',
        },
      };
    }

    if (!this.initialized || !EdfaPayPlugin) {
      const ok = await this.init();
      if (!ok) return { success: false, error: 'فشل تهيئة EdfaPay SDK' };
    }

    try {
      const transaction = await EdfaPayPlugin.refund({
        txnParams: {
          amount,
          transactionType: TransactionType?.REFUND ?? 'REFUND',
          originalTransaction: {
            rrn: originalRrn,
            transactionDate: originalDate,
          },
        },
      });

      return { success: true, transaction };
    } catch (error: any) {
      return { success: false, error: error?.message ?? 'فشل الاسترجاع' };
    }
  }

  /**
   * Void an unsettled transaction
   */
  async voidTransaction(originalRrn: string, originalDate: string): Promise<RefundResult> {
    if (isDemoMode()) {
      return { success: true, transaction: { status: 'VOIDED' } };
    }

    if (!this.initialized || !EdfaPayPlugin) {
      const ok = await this.init();
      if (!ok) return { success: false, error: 'فشل تهيئة EdfaPay SDK' };
    }

    try {
      const response = await EdfaPayPlugin.voidTransaction({
        rrn: originalRrn,
        transactionDate: originalDate,
      });
      return { success: true, transaction: response?.transaction };
    } catch (error: any) {
      return { success: false, error: error?.message ?? 'فشل إلغاء العملية' };
    }
  }

  /**
   * Reverse the last transaction
   */
  async reverseLastTransaction(): Promise<RefundResult> {
    if (isDemoMode()) {
      return { success: true, transaction: { status: 'REVERSED' } };
    }

    if (!this.initialized || !EdfaPayPlugin) {
      const ok = await this.init();
      if (!ok) return { success: false, error: 'فشل تهيئة EdfaPay SDK' };
    }

    try {
      const response = await EdfaPayPlugin.reverseLastTransaction();
      return { success: true, transaction: response?.transaction };
    } catch (error: any) {
      return { success: false, error: error?.message ?? 'فشل عكس العملية' };
    }
  }

  /**
   * End-of-day reconciliation
   */
  async reconcile(): Promise<{ success: boolean; result?: any; error?: string }> {
    if (isDemoMode()) {
      return {
        success: true,
        result: { batchId: `DEMO-${Date.now()}`, totalCount: 0, totalAmount: '0.00' },
      };
    }

    if (!this.initialized || !EdfaPayPlugin) {
      const ok = await this.init();
      if (!ok) return { success: false, error: 'فشل تهيئة EdfaPay SDK' };
    }

    try {
      const result = await EdfaPayPlugin.reconcile();
      return { success: true, result };
    } catch (error: any) {
      return { success: false, error: error?.message ?? 'فشل التسوية' };
    }
  }

  /**
   * Get terminal info
   */
  async getTerminalInfo(): Promise<any> {
    if (isDemoMode()) {
      return {
        deviceId: 'DEMO-DEVICE',
        tsn: 'DEMO-TSN',
        terminalId: 'DEMO-TID',
        merchantId: 'DEMO-MID',
        merchantName: 'وضع تجريبي',
        version: '1.0.5-demo',
      };
    }

    if (!EdfaPayPlugin) return null;
    try {
      return await EdfaPayPlugin.terminalInfo();
    } catch {
      return null;
    }
  }

  /**
   * Get transaction history
   */
  async getTransactionHistory(page = 1, pageSize = 20): Promise<any[]> {
    if (isDemoMode()) return [];
    if (!EdfaPayPlugin) return [];

    try {
      return await EdfaPayPlugin.txnHistory({ pagination: { page, pageSize } });
    } catch {
      return [];
    }
  }

  /**
   * Logout / clear session
   */
  async logout(): Promise<void> {
    if (isDemoMode()) {
      this.initialized = false;
      return;
    }

    try {
      await EdfaPayPlugin?.logoutCurrentSession?.();
    } catch {
      // ignore
    }
    this.initialized = false;
    this.sessionId = null;
  }
}

export const edfaPaySoftPos = new EdfaPaySoftPosService();

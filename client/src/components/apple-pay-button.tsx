/**
 * Apple Pay Button Component (S2S Integration)
 *
 * Flow:
 * 1. Check if Apple Pay is available on this device/browser
 * 2. Fetch Apple Pay config from our server
 * 3. User clicks Apple Pay → ApplePaySession opens
 * 4. onvalidatemerchant → POST /api/payments/apple-pay-session
 * 5. onpaymentauthorized → capture token → POST /api/payments/apple-pay-sale
 * 6. Handle success/failure
 *
 * Apple Pay on the web works ONLY in Safari (macOS / iOS).
 * Production only — cannot be tested in sandbox.
 */

import { useState, useEffect, useCallback } from "react";

// Extend Window with Apple Pay JS API types
declare global {
  interface Window {
    ApplePaySession?: {
      new (version: number, request: ApplePayPaymentRequest): ApplePaySessionInstance;
      canMakePayments(): boolean;
      supportsVersion(version: number): boolean;
      STATUS_SUCCESS: number;
      STATUS_FAILURE: number;
    };
  }
}

interface ApplePayPaymentRequest {
  countryCode: string;
  currencyCode: string;
  supportedNetworks: string[];
  merchantCapabilities: string[];
  total: {
    label: string;
    amount: string;
    type?: "final" | "pending";
  };
  requiredBillingContactFields?: string[];
  requiredShippingContactFields?: string[];
}

interface ApplePaySessionInstance {
  begin(): void;
  abort(): void;
  completeMerchantValidation(merchantSession: any): void;
  completePayment(result: { status: number }): void;
  onvalidatemerchant: ((event: { validationURL: string }) => void) | null;
  onpaymentauthorized: ((event: { payment: { token: any; billingContact?: any; shippingContact?: any } }) => void) | null;
  oncancel: (() => void) | null;
  onpaymentmethodselected: ((event: any) => void) | null;
}

interface ApplePayButtonProps {
  orderId: string;
  amount: string;          // "125.50"
  label: string;           // Display label, e.g. "TryingPOS"
  callbackUrl: string;     // Where to redirect after 3DS (if needed)
  language?: "ar" | "en";
  onSuccess?: (result: { transId: string; orderId: string }) => void;
  onError?: (error: string) => void;
  onRedirect?: (url: string) => void;
  disabled?: boolean;
  className?: string;
}

interface ApplePayConfig {
  available: boolean;
  merchantId: string | null;
  supportedNetworks: string[];
  merchantCapabilities: string[];
  currencyCode: string;
}

export default function ApplePayButton({
  orderId,
  amount,
  label,
  callbackUrl,
  language = "ar",
  onSuccess,
  onError,
  onRedirect,
  disabled = false,
  className = "",
}: ApplePayButtonProps) {
  const [isAvailable, setIsAvailable] = useState(false);
  const [config, setConfig] = useState<ApplePayConfig | null>(null);
  const [processing, setProcessing] = useState(false);

  // Check Apple Pay availability on mount
  useEffect(() => {
    checkAvailability();
  }, []);

  const checkAvailability = async () => {
    try {
      // 1. Browser must support Apple Pay (Safari only)
      if (!window.ApplePaySession || !window.ApplePaySession.canMakePayments()) {
        return;
      }

      // 2. Check if we support version 3+
      if (!window.ApplePaySession.supportsVersion(3)) {
        return;
      }

      // 3. Check server-side config
      const res = await fetch("/api/payments/apple-pay-config");
      if (!res.ok) return;
      const data: ApplePayConfig = await res.json();

      if (data.available && data.merchantId) {
        setConfig(data);
        setIsAvailable(true);
      }
    } catch {
      // Silently fail — Apple Pay just won't show
    }
  };

  const handleApplePay = useCallback(async () => {
    if (!config || !window.ApplePaySession || processing || disabled) return;

    setProcessing(true);

    try {
      const request: ApplePayPaymentRequest = {
        countryCode: "SA",
        currencyCode: config.currencyCode || "SAR",
        supportedNetworks: config.supportedNetworks || ["visa", "masterCard", "mada"],
        merchantCapabilities: config.merchantCapabilities || ["supports3DS"],
        total: {
          label,
          amount,
          type: "final",
        },
      };

      const session = new window.ApplePaySession!(3, request);

      // Step 1: Merchant Validation
      session.onvalidatemerchant = async (event) => {
        try {
          const res = await fetch("/api/payments/apple-pay-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ validationURL: event.validationURL }),
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || "Merchant validation failed");
          }

          const merchantSession = await res.json();
          session.completeMerchantValidation(merchantSession);
        } catch (err: any) {
          console.error("Apple Pay merchant validation failed:", err);
          session.abort();
          setProcessing(false);
          onError?.(language === "ar"
            ? "فشل التحقق من التاجر. حاول مرة أخرى."
            : "Merchant validation failed. Please try again.");
        }
      };

      // Step 2: Payment Authorized — customer authenticated with Face ID / Touch ID
      session.onpaymentauthorized = async (event) => {
        try {
          const token = event.payment.token;

          // Send token to our backend → EdfaPay S2S API
          const res = await fetch("/api/payments/apple-pay-sale", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              orderId,
              callbackUrl,
              applePayToken: token,
            }),
          });

          const data = await res.json();

          if (!res.ok) {
            session.completePayment({ status: window.ApplePaySession!.STATUS_FAILURE });
            setProcessing(false);
            onError?.(data.error || (language === "ar" ? "فشل الدفع" : "Payment failed"));
            return;
          }

          if (data.action === "success") {
            session.completePayment({ status: window.ApplePaySession!.STATUS_SUCCESS });
            setProcessing(false);
            onSuccess?.({ transId: data.transId, orderId: data.orderId });
          } else if (data.action === "redirect" && data.redirectUrl) {
            // 3DS redirect (rare for Apple Pay)
            session.completePayment({ status: window.ApplePaySession!.STATUS_SUCCESS });
            setProcessing(false);
            onRedirect?.(data.redirectUrl);
          } else {
            session.completePayment({ status: window.ApplePaySession!.STATUS_FAILURE });
            setProcessing(false);
            onError?.(data.error || (language === "ar" ? "فشل الدفع" : "Payment failed"));
          }
        } catch (err: any) {
          console.error("Apple Pay payment processing error:", err);
          session.completePayment({ status: window.ApplePaySession!.STATUS_FAILURE });
          setProcessing(false);
          onError?.(language === "ar"
            ? "حدث خطأ أثناء معالجة الدفع"
            : "An error occurred during payment processing");
        }
      };

      // Step 3: User cancelled
      session.oncancel = () => {
        setProcessing(false);
      };

      // Start the Apple Pay session
      session.begin();
    } catch (err: any) {
      console.error("Apple Pay session error:", err);
      setProcessing(false);
      onError?.(language === "ar"
        ? "فشل بدء جلسة Apple Pay"
        : "Failed to start Apple Pay session");
    }
  }, [config, processing, disabled, orderId, amount, label, callbackUrl, language, onSuccess, onError, onRedirect]);

  // Don't render if Apple Pay is not available
  if (!isAvailable) return null;

  return (
    <button
      onClick={handleApplePay}
      disabled={disabled || processing}
      className={`apple-pay-button w-full h-12 rounded-xl flex items-center justify-center gap-2 text-white font-semibold text-base transition-all disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
      style={{
        backgroundColor: "#000",
        WebkitAppearance: "none",
        cursor: disabled || processing ? "not-allowed" : "pointer",
      }}
      aria-label="Apple Pay"
    >
      {processing ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-5 w-5 text-white" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {language === "ar" ? "جاري المعالجة..." : "Processing..."}
        </span>
      ) : (
        <span className="flex items-center gap-1.5">
          {language === "ar" ? "ادفع بواسطة" : "Pay with"}
          {/* Apple logo SVG */}
          <svg className="h-5 w-5 inline-block" viewBox="0 0 24 24" fill="white">
            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
          </svg>
          <span className="font-semibold">Pay</span>
        </span>
      )}
    </button>
  );
}

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, CreditCard, Smartphone, Wallet, ShieldCheck, Lock } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import type { Order } from "@shared/schema";

declare global {
  interface Window {
    Moyasar: {
      init: (config: any) => void;
    };
  }
}

type PaymentMethodType = "creditcard" | "stcpay" | "applepay";

export default function PaymentPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { language, setLanguage, direction } = useLanguage();
  const [isFormLoaded, setIsFormLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodType | null>(null);
  const [sessionData, setSessionData] = useState<any>(null);
  const formContainerRef = useRef<HTMLDivElement>(null);
  const formInitialized = useRef(false);

  const toggleLanguage = () => {
    setLanguage(language === "ar" ? "en" : "ar");
  };

  const { data: order, isLoading: orderLoading } = useQuery<Order>({
    queryKey: ["/api/public/orders", orderId],
    queryFn: async () => {
      const res = await fetch(`/api/public/orders/${orderId}`);
      if (!res.ok) throw new Error("Order not found");
      return res.json();
    },
    enabled: !!orderId,
  });

  // Load Moyasar SDK and session data
  useEffect(() => {
    if (!order) return;

    // Handle already-paid orders
    if (order.isPaid) {
      window.location.href = `/payment-callback/${order.id}?status=paid`;
      return;
    }

    const baseUrl = window.location.origin;
    const callbackUrl = `${baseUrl}/payment-callback/${order.id}`;

    const loadSession = async () => {
      try {
        const sessionRes = await fetch("/api/payments/create-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: order.id,
            callbackUrl,
          }),
        });
        if (!sessionRes.ok) throw new Error("Failed to create payment session");
        const session = await sessionRes.json();

        if (!session.publishableKey || session.publishableKey === "pending_setup") {
          setError(language === "ar" 
            ? "بوابة الدفع غير مُعدة بعد. يرجى التواصل مع المطعم."
            : "Payment gateway not configured yet. Please contact the restaurant.");
          return;
        }

        setSessionData(session);

        // Load Moyasar CSS
        if (!document.querySelector('link[href*="moyasar.css"]')) {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = "https://cdn.moyasar.com/mpf/1.14.0/moyasar.css";
          document.head.appendChild(link);
        }

        // Load Moyasar JS
        if (!document.querySelector('script[src*="moyasar.js"]')) {
          const script = document.createElement("script");
          script.src = "https://cdn.moyasar.com/mpf/1.14.0/moyasar.js";
          script.onload = () => setIsFormLoaded(true);
          script.onerror = () => {
            setError(language === "ar" 
              ? "فشل تحميل نظام الدفع. يرجى المحاولة مرة أخرى."
              : "Failed to load payment system. Please try again.");
          };
          document.head.appendChild(script);
        } else if (window.Moyasar) {
          setIsFormLoaded(true);
        }
      } catch (err) {
        console.error("Payment init error:", err);
        setError(language === "ar"
          ? "حدث خطأ أثناء تحميل صفحة الدفع"
          : "Error loading payment page");
      }
    };

    loadSession();
  }, [order, language]);

  // Initialize Moyasar form when method is selected
  useEffect(() => {
    if (!selectedMethod || !sessionData || !isFormLoaded || !formContainerRef.current) return;
    if (formInitialized.current) return;
    formInitialized.current = true;

    try {
      // Clear existing content
      if (formContainerRef.current) {
        formContainerRef.current.innerHTML = "";
      }

      const methods: string[] = [selectedMethod];
      
      window.Moyasar.init({
        element: formContainerRef.current,
        amount: sessionData.amount,
        currency: sessionData.currency,
        description: sessionData.description,
        publishable_api_key: sessionData.publishableKey,
        callback_url: sessionData.callbackUrl,
        methods,
        supported_networks: ["visa", "mastercard", "mada"],
        apple_pay: selectedMethod === "applepay" ? {
          country: "SA",
          label: sessionData.description || "Payment",
          validate_merchant_url: "https://api.moyasar.com/v1/applepay/initiate",
        } : undefined,
        language: language === "ar" ? "ar" : "en",
        metadata: {
          order_id: sessionData.orderId,
        },
        on_completed: function (payment: any) {
          console.log("Payment completed:", payment.id, payment.status);
        },
      });
    } catch (err) {
      console.error("Moyasar init error:", err);
      setError(language === "ar"
        ? "فشل تهيئة نظام الدفع"
        : "Failed to initialize payment system");
    }
  }, [selectedMethod, sessionData, isFormLoaded, language]);

  const handleMethodSelect = (method: PaymentMethodType) => {
    if (selectedMethod === method) {
      // Toggle off
      setSelectedMethod(null);
      formInitialized.current = false;
      if (formContainerRef.current) formContainerRef.current.innerHTML = "";
    } else {
      // Switch method
      formInitialized.current = false;
      if (formContainerRef.current) formContainerRef.current.innerHTML = "";
      setSelectedMethod(method);
    }
  };

  if (orderLoading) {
    return (
      <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0a0a0a] flex items-center justify-center" dir={direction}>
        <div className="w-full max-w-md p-4 space-y-3">
          <Skeleton className="h-7 w-40 mx-auto dark:bg-white/[0.04]" />
          <Skeleton className="h-20 w-full rounded-xl dark:bg-white/[0.04]" />
          <Skeleton className="h-40 w-full rounded-xl dark:bg-white/[0.04]" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0a0a0a] flex items-center justify-center" dir={direction}>
        <div className="max-w-md w-full mx-4 bg-white dark:bg-white/[0.03] rounded-2xl border border-gray-100 dark:border-white/[0.05] p-6 text-center">
          <div className="w-12 h-12 bg-[#8B1A1A]/10 dark:bg-[#8B1A1A]/20 rounded-xl flex items-center justify-center mx-auto mb-3">
            <CreditCard className="h-5 w-5 text-[#8B1A1A]" />
          </div>
          <p className="text-base font-bold text-gray-900 dark:text-white mb-1">
            {language === "ar" ? "الطلب غير موجود" : "Order not found"}
          </p>
          <p className="text-sm text-gray-500 dark:text-white/50">
            {language === "ar" ? "تأكد من الرابط وحاول مرة أخرى" : "Check the link and try again"}
          </p>
        </div>
      </div>
    );
  }

  const amount = parseFloat(order.total || "0").toFixed(2);

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0a0a0a]" dir={direction}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#faf9f7]/90 dark:bg-[#0a0a0a]/90 backdrop-blur-xl border-b border-gray-100 dark:border-white/[0.04]">
        <div className="max-w-md mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-[#8B1A1A] rounded-lg flex items-center justify-center">
              <Lock className="h-3.5 w-3.5 text-white" />
            </div>
            <h1 className="text-sm font-bold text-gray-900 dark:text-white">
              {language === "ar" ? "الدفع الآمن" : "Secure Payment"}
            </h1>
          </div>
          <button
            onClick={toggleLanguage}
            className="text-xs font-medium text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            {language === "ar" ? "EN" : "عربي"}
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 pb-8 space-y-4">
        {/* Amount Card */}
        <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-gray-100 dark:border-white/[0.05] p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-500 dark:text-white/40">
              {language === "ar" ? "رقم الطلب" : "Order"} <span className="font-mono font-semibold text-gray-700 dark:text-white/70">{order.orderNumber}</span>
            </p>
            <div className="flex items-center gap-1 text-[10px] text-green-600 dark:text-green-400 font-medium">
              <ShieldCheck className="h-3 w-3" />
              {language === "ar" ? "آمن" : "Secure"}
            </div>
          </div>
          <div className="text-center">
            <p className="text-[11px] text-gray-400 dark:text-white/30 mb-1">
              {language === "ar" ? "المبلغ المطلوب" : "Amount Due"}
            </p>
            <div className="flex items-baseline justify-center gap-1.5">
              <span className="text-3xl font-bold text-gray-900 dark:text-white tabular-nums">{amount}</span>
              <span className="text-sm text-gray-400 dark:text-white/30">{language === "ar" ? "ر.س" : "SAR"}</span>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/20 p-4 text-center">
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            <button
              className="mt-2.5 text-xs font-medium text-[#8B1A1A] hover:underline"
              onClick={() => window.location.reload()}
            >
              {language === "ar" ? "إعادة المحاولة" : "Retry"}
            </button>
          </div>
        )}

        {/* Loading */}
        {!isFormLoaded && !error && !sessionData && (
          <div className="flex flex-col items-center justify-center py-8 gap-2.5">
            <Loader2 className="h-6 w-6 animate-spin text-[#8B1A1A]" />
            <p className="text-sm text-gray-400 dark:text-white/40">
              {language === "ar" ? "جاري تحميل نظام الدفع..." : "Loading payment form..."}
            </p>
          </div>
        )}

        {/* Payment Methods */}
        {sessionData && !error && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-gray-400 dark:text-white/30 px-0.5">
              {language === "ar" ? "اختر طريقة الدفع" : "Payment method"}
            </p>

            {/* Method buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => handleMethodSelect("creditcard")}
                className={`flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-all ${
                  selectedMethod === "creditcard"
                    ? "border-[#8B1A1A] bg-[#8B1A1A]/5 dark:bg-[#8B1A1A]/10"
                    : "border-gray-100 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] hover:border-gray-200 dark:hover:border-white/[0.1]"
                }`}
              >
                <CreditCard className={`h-5 w-5 ${selectedMethod === "creditcard" ? "text-[#8B1A1A]" : "text-gray-400 dark:text-white/30"}`} />
                <span className={`text-[11px] font-medium ${selectedMethod === "creditcard" ? "text-[#8B1A1A]" : "text-gray-500 dark:text-white/50"}`}>
                  {language === "ar" ? "بطاقة" : "Card"}
                </span>
                <div className="flex items-center gap-1">
                  <img src="https://cdn.moyasar.com/mpf/1.14.0/visa.svg" alt="" className="h-3" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  <img src="https://cdn.moyasar.com/mpf/1.14.0/mastercard.svg" alt="" className="h-3" onError={(e) => (e.currentTarget.style.display = 'none')} />
                  <img src="https://cdn.moyasar.com/mpf/1.14.0/mada.svg" alt="" className="h-3" onError={(e) => (e.currentTarget.style.display = 'none')} />
                </div>
              </button>
              <button
                onClick={() => handleMethodSelect("stcpay")}
                className={`flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-all ${
                  selectedMethod === "stcpay"
                    ? "border-[#8B1A1A] bg-[#8B1A1A]/5 dark:bg-[#8B1A1A]/10"
                    : "border-gray-100 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] hover:border-gray-200 dark:hover:border-white/[0.1]"
                }`}
              >
                <Smartphone className={`h-5 w-5 ${selectedMethod === "stcpay" ? "text-[#8B1A1A]" : "text-gray-400 dark:text-white/30"}`} />
                <span className={`text-[11px] font-medium ${selectedMethod === "stcpay" ? "text-[#8B1A1A]" : "text-gray-500 dark:text-white/50"}`}>STC Pay</span>
              </button>
              <button
                onClick={() => handleMethodSelect("applepay")}
                className={`flex-1 flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-all ${
                  selectedMethod === "applepay"
                    ? "border-[#8B1A1A] bg-[#8B1A1A]/5 dark:bg-[#8B1A1A]/10"
                    : "border-gray-100 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] hover:border-gray-200 dark:hover:border-white/[0.1]"
                }`}
              >
                <Wallet className={`h-5 w-5 ${selectedMethod === "applepay" ? "text-[#8B1A1A]" : "text-gray-400 dark:text-white/30"}`} />
                <span className={`text-[11px] font-medium ${selectedMethod === "applepay" ? "text-[#8B1A1A]" : "text-gray-500 dark:text-white/50"}`}>Apple Pay</span>
              </button>
            </div>

            {/* Form area */}
            {selectedMethod && (
              <div className="bg-white dark:bg-white/[0.03] rounded-xl border border-gray-100 dark:border-white/[0.05] p-4">
                <div ref={formContainerRef} className="moyasar-form-container" />
              </div>
            )}
          </div>
        )}

        {/* Security footer */}
        <div className="flex items-center justify-center gap-1.5 pt-2">
          <Lock className="h-3 w-3 text-gray-300 dark:text-white/20" />
          <p className="text-[10px] text-gray-300 dark:text-white/20">
            {language === "ar" 
              ? "الدفع آمن ومشفر عبر بوابة مؤسر"
              : "Secure payment powered by Moyasar"}
          </p>
        </div>
      </main>

      <style>{`
        .moyasar-form-container .mysr-form-header,
        .moyasar-form-container .mysr-form-tabs {
          display: none !important;
        }
        .moyasar-form-container .mysr-form {
          border: none !important;
          box-shadow: none !important;
          padding: 0 !important;
        }
      `}</style>
    </div>
  );
}

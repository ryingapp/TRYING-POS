import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, CreditCard, ShieldCheck, Lock } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import type { Order } from "@shared/schema";
import ApplePayButton from "@/components/apple-pay-button";

export default function PaymentPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { language, setLanguage, direction } = useLanguage();
  const [error, setError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

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

  // Check if order is already paid
  useEffect(() => {
    if (!order) return;
    if (order.isPaid) {
      window.location.href = `/payment-callback/${order.id}?status=paid`;
    } else {
      setSessionReady(true);
    }
  }, [order]);

  // Initiate EdfaPay payment and redirect
  const handlePayNow = async () => {
    if (!order || isRedirecting) return;
    setIsRedirecting(true);
    setError(null);

    try {
      const baseUrl = window.location.origin;
      const callbackUrl = `${baseUrl}/payment-callback/${order.id}`;

      const sessionRes = await fetch("/api/payments/create-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          callbackUrl,
        }),
      });

      if (!sessionRes.ok) {
        const errData = await sessionRes.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to create payment session");
      }

      const session = await sessionRes.json();

      if (session.action === "redirect" && session.redirectUrl) {
        // Redirect to EdfaPay checkout page
        window.location.href = session.redirectUrl;
      } else {
        throw new Error(language === "ar"
          ? "بوابة الدفع غير مُعدة بعد. يرجى التواصل مع المطعم."
          : "Payment gateway not configured yet. Please contact the restaurant.");
      }
    } catch (err: any) {
      console.error("Payment init error:", err);
      setError(err.message || (language === "ar"
        ? "حدث خطأ أثناء تحميل صفحة الدفع"
        : "Error loading payment page"));
      setIsRedirecting(false);
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

        {/* Pay Button */}
        {sessionReady && !error && (
          <div className="space-y-3">
            {/* Apple Pay Button — only renders on Safari/iOS with Apple Pay configured */}
            <ApplePayButton
              orderId={order.id}
              amount={amount}
              label={language === "ar" ? "TryingPOS" : "TryingPOS"}
              callbackUrl={`${window.location.origin}/payment-callback/${order.id}`}
              language={language as "ar" | "en"}
              onSuccess={(result) => {
                window.location.href = `/payment-callback/${order.id}?status=paid&transId=${result.transId}`;
              }}
              onError={(errorMsg) => {
                setError(errorMsg);
              }}
              onRedirect={(url) => {
                window.location.href = url;
              }}
              disabled={isRedirecting}
            />

            {/* Accepted methods info */}
            <div className="bg-white dark:bg-white/[0.03] rounded-xl border border-gray-100 dark:border-white/[0.05] p-4">
              <p className="text-xs font-medium text-gray-400 dark:text-white/30 mb-3 text-center">
                {language === "ar" ? "طرق الدفع المقبولة" : "Accepted payment methods"}
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-white/[0.04]">
                  <CreditCard className="h-4 w-4 text-gray-400" />
                  <span className="text-xs text-gray-500 dark:text-white/50">Visa</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-white/[0.04]">
                  <CreditCard className="h-4 w-4 text-gray-400" />
                  <span className="text-xs text-gray-500 dark:text-white/50">Mastercard</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-white/[0.04]">
                  <CreditCard className="h-4 w-4 text-gray-400" />
                  <span className="text-xs text-gray-500 dark:text-white/50">mada</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-white/[0.04]">
                  <svg className="h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                  <span className="text-xs text-gray-500 dark:text-white/50">Apple Pay</span>
                </div>
              </div>
            </div>

            {/* Pay Now Button */}
            <button
              onClick={handlePayNow}
              disabled={isRedirecting}
              className="w-full py-4 rounded-xl bg-[#8B1A1A] hover:bg-[#7A1717] active:bg-[#6A1414] text-white font-bold text-base transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isRedirecting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {language === "ar" ? "جاري التحويل لصفحة الدفع..." : "Redirecting to payment..."}
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  {language === "ar" ? `ادفع ${amount} ر.س` : `Pay ${amount} SAR`}
                </>
              )}
            </button>
          </div>
        )}

        {/* Loading state */}
        {!sessionReady && !error && (
          <div className="flex flex-col items-center justify-center py-8 gap-2.5">
            <Loader2 className="h-6 w-6 animate-spin text-[#8B1A1A]" />
            <p className="text-sm text-gray-400 dark:text-white/40">
              {language === "ar" ? "جاري تحميل نظام الدفع..." : "Loading payment..."}
            </p>
          </div>
        )}

        {/* Security footer */}
        <div className="flex items-center justify-center gap-1.5 pt-2">
          <Lock className="h-3 w-3 text-gray-300 dark:text-white/20" />
          <p className="text-[10px] text-gray-300 dark:text-white/20">
            {language === "ar" 
              ? "الدفع آمن ومشفر عبر بوابة أدفع باي"
              : "Secure payment powered by EdfaPay"}
          </p>
        </div>
      </main>
    </div>
  );
}

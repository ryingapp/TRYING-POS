import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, Globe, CalendarCheck } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export default function ReservationPaymentCallbackPage() {
  const { restaurantId, reservationId } = useParams<{ restaurantId: string; reservationId: string }>();
  const [, setLocation] = useLocation();
  const { language, setLanguage, direction } = useLanguage();
  const [status, setStatus] = useState<"loading" | "success" | "failed">("loading");
  const [message, setMessage] = useState("");

  const toggleLanguage = () => {
    setLanguage(language === "ar" ? "en" : "ar");
  };

  const urlParams = new URLSearchParams(window.location.search);
  const branchParam = urlParams.get("b");
  const branchQuery = branchParam ? `?b=${branchParam}` : "";

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const paymentId = urlParams.get("id");

        if (!paymentId) {
          setStatus("failed");
          setMessage(language === "ar" ? "معرّف الدفع غير موجود" : "Payment ID not found");
          return;
        }

        const response = await fetch(`/api/public/${restaurantId}/reservation-payment-complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reservationId, paymentId }),
        });

        if (response.ok) {
          setStatus("success");
          setMessage(language === "ar" ? "تم دفع رسوم الحجز بنجاح" : "Booking fee paid successfully");
        } else {
          const errorData = await response.json().catch(() => ({}));
          setStatus("failed");
          setMessage(errorData.error || (language === "ar" ? "فشل الدفع" : "Payment failed"));
        }
      } catch (err) {
        console.error("Payment verification error:", err);
        setStatus("failed");
        setMessage(language === "ar" ? "حدث خطأ أثناء التحقق من الدفع" : "Error verifying payment");
      }
    };

    verifyPayment();
  }, [restaurantId, reservationId, language]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center" dir={direction}>
      <div className="w-full max-w-md px-4">
        <div className="flex justify-end mb-4">
          <Button variant="outline" size="sm" onClick={toggleLanguage} className="gap-2 rounded-full">
            <Globe className="h-4 w-4" />
            {language === "ar" ? "EN" : "عربي"}
          </Button>
        </div>

        <Card>
          <CardContent className="p-8 text-center space-y-6">
            {status === "loading" && (
              <>
                <Loader2 className="h-16 w-16 animate-spin text-blue-600 mx-auto" />
                <div>
                  <h2 className="text-xl font-bold mb-2">
                    {language === "ar" ? "جاري التحقق من الدفع..." : "Verifying payment..."}
                  </h2>
                  <p className="text-muted-foreground">
                    {language === "ar" ? "يرجى الانتظار" : "Please wait"}
                  </p>
                </div>
              </>
            )}

            {status === "success" && (
              <>
                <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold mb-2">
                    {language === "ar" ? "تم تأكيد الحجز!" : "Reservation Confirmed!"}
                  </h2>
                  <p className="text-muted-foreground">{message}</p>
                </div>
                <Card className="border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20">
                  <CardContent className="p-4 text-sm text-green-800 dark:text-green-200 flex items-center gap-2">
                    <CalendarCheck className="h-4 w-4 flex-shrink-0" />
                    {language === "ar"
                      ? "تم دفع رسوم الحجز وسيتم خصمها من فاتورتك النهائية عند الحضور"
                      : "Booking fee paid and will be deducted from your final bill upon arrival"}
                  </CardContent>
                </Card>
                <Button
                  onClick={() => setLocation(`/m/${restaurantId}${branchQuery}`)}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  {language === "ar" ? "العودة للرئيسية" : "Back to Home"}
                </Button>
              </>
            )}

            {status === "failed" && (
              <>
                <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto">
                  <XCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold mb-2">
                    {language === "ar" ? "فشل الدفع" : "Payment Failed"}
                  </h2>
                  <p className="text-muted-foreground">{message}</p>
                </div>
                <div className="space-y-2">
                  <Button
                    onClick={() => setLocation(`/m/${restaurantId}/reserve${branchQuery}`)}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {language === "ar" ? "إعادة المحاولة" : "Try Again"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setLocation(`/m/${restaurantId}${branchQuery}`)}
                    className="w-full"
                  >
                    {language === "ar" ? "العودة للرئيسية" : "Back to Home"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

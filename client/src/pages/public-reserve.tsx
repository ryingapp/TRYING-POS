import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { PhoneInput } from "@/components/phone-input";
import { ArrowLeft, ArrowRight, CalendarCheck, Check, Globe, ChefHat, Loader2, Users, Clock, MapPin, CreditCard, Lock } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";

export default function PublicReservePage() {
  const params = useParams<{ restaurantId?: string }>();
  const [, setLocation] = useLocation();
  const { language, setLanguage, direction, getLocalizedName } = useLanguage();
  const { toast } = useToast();
  const restaurantId = params.restaurantId || "default";

  const urlParams = new URLSearchParams(window.location.search);
  const branchParam = urlParams.get("b");
  const branchQuery = branchParam ? `?b=${branchParam}` : "";

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [reservationDate, setReservationDate] = useState("");
  const [reservationTime, setReservationTime] = useState("");
  const [guestCount, setGuestCount] = useState("2");
  const [specialRequests, setSpecialRequests] = useState("");
  const [tableId, setTableId] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Payment integration state
  const [step, setStep] = useState<"form" | "payment" | "success">("form");
  const [createdReservation, setCreatedReservation] = useState<any>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [isPaymentFormLoaded, setIsPaymentFormLoaded] = useState(false);
  const formInitialized = useRef(false);

  const { data: restaurant, isLoading } = useQuery<any>({
    queryKey: [`/api/public/${restaurantId}/restaurant`],
  });

  const { data: tables } = useQuery<any[]>({
    queryKey: [`/api/public/${restaurantId}/tables${branchParam ? `?branch=${branchParam}` : ""}`],
  });

  const toggleLanguage = () => {
    setLanguage(language === "ar" ? "en" : "ar");
  };

  const t = (key: string) => {
    const translations: Record<string, { en: string; ar: string }> = {
      reserveTable: { en: "Reserve a Table", ar: "احجز طاولة" },
      back: { en: "Back", ar: "رجوع" },
      yourName: { en: "Your Name", ar: "اسمك" },
      namePlaceholder: { en: "Enter your name", ar: "ادخل اسمك" },
      phone: { en: "Phone Number", ar: "رقم الجوال" },
      phonePlaceholder: { en: "05xxxxxxxx", ar: "05xxxxxxxx" },
      date: { en: "Date", ar: "التاريخ" },
      time: { en: "Time", ar: "الوقت" },
      guests: { en: "Number of Guests", ar: "عدد الضيوف" },
      selectTable: { en: "Preferred Table (Optional)", ar: "الطاولة المفضلة (اختياري)" },
      anyTable: { en: "Any available table", ar: "أي طاولة متاحة" },
      tableNum: { en: "Table", ar: "طاولة" },
      seats: { en: "seats", ar: "مقاعد" },
      specialRequests: { en: "Special Requests (Optional)", ar: "طلبات خاصة (اختياري)" },
      specialRequestsPlaceholder: { en: "Any special requests or notes...", ar: "أي طلبات خاصة أو ملاحظات..." },
      depositNote: { en: `A booking fee of ${depositAmount} SAR is required and will be deducted from the final bill`, ar: `رسوم حجز ${depositAmount} ر.س تُخصم من الفاتورة النهائية عند الحضور` },
      submit: { en: "Submit Reservation", ar: "تأكيد الحجز" },
      submitting: { en: "Submitting...", ar: "جاري الإرسال..." },
      success: { en: "Reservation Submitted!", ar: "تم إرسال الحجز!" },
      successDesc: { en: "Your reservation has been submitted. The restaurant will confirm it shortly.", ar: "تم إرسال حجزك. المطعم سيؤكده قريباً." },
      depositReminder: { en: `Remember: A ${depositAmount} SAR booking fee will be collected and deducted from your bill.`, ar: `تذكير: رسوم الحجز ${depositAmount} ر.س تُخصم من فاتورتك النهائية.` },
      backToHome: { en: "Back to Home", ar: "العودة للرئيسية" },
      makeAnother: { en: "Make Another Reservation", ar: "حجز آخر" },
      required: { en: "Please fill in all required fields", ar: "يرجى تعبئة جميع الحقول المطلوبة" },
      error: { en: "Failed to submit reservation", ar: "فشل في إرسال الحجز" },
      restaurantNotFound: { en: "Restaurant not found", ar: "المطعم غير موجود" },
    };
    return translations[key]?.[language] || key;
  };

  const createReservation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/public/${restaurantId}/reservations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerPhone,
          reservationDate: new Date(`${reservationDate}T${reservationTime}`).toISOString(),
          reservationTime,
          guestCount: parseInt(guestCount),
          specialRequests: specialRequests || undefined,
          tableId: (tableId && tableId !== "any") ? tableId : undefined,
          branchId: branchParam || undefined,
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error === "tableConflict" ? "tableConflict" : "Failed to create reservation");
      }
      return response.json();
    },
    onSuccess: (data: any) => {
      if (depositRequired) {
        // Store reservation data and switch to payment step
        setCreatedReservation(data);
        setStep("payment");
        setPaymentError(null);
      } else {
        setStep("success");
        setSubmitted(true);
      }
    },
    onError: (error: any) => {
      if (error?.message === "tableConflict") {
        toast({
          title: language === "ar" ? "الطاولة محجوزة" : "Table Already Booked",
          description: language === "ar" ? "الطاولة محجوزة في هذا الوقت. اختر وقت أو طاولة أخرى." : "This table is already booked at this time. Choose a different time or table.",
          variant: "destructive",
        });
      } else {
        toast({
          title: t("error"),
          variant: "destructive",
        });
      }
    },
  });

  const handleSubmit = () => {
    if (!customerName || !reservationDate || !reservationTime || !guestCount) {
      toast({ title: t("required"), variant: "destructive" });
      return;
    }
    // Validate Saudi phone
    const cleanPhone = customerPhone.replace(/\D/g, "");
    if (cleanPhone.length !== 10 || !cleanPhone.startsWith("05")) {
      toast({
        title: language === "ar" ? "رقم الجوال غير صحيح" : "Invalid phone number",
        description: language === "ar" ? "يجب أن يكون 10 أرقام ويبدأ بـ 05" : "Must be 10 digits starting with 05",
        variant: "destructive",
      });
      return;
    }
    // Validate not in the past
    const now = new Date();
    const selectedDateTime = new Date(`${reservationDate}T${reservationTime}`);
    if (selectedDateTime <= now) {
      toast({
        title: language === "ar" ? "لا يمكن الحجز في الماضي" : "Cannot book in the past",
        description: language === "ar" ? "يرجى اختيار تاريخ ووقت مستقبلي" : "Please select a future date and time",
        variant: "destructive",
      });
      return;
    }
    createReservation.mutate();
  };

  // Handle EdfaPay payment redirect when step is "payment"  
  const handleReservationPayment = async () => {
    if (!createdReservation || isRedirecting) return;
    setIsRedirecting(true);
    setPaymentError(null);

    const reservationId = createdReservation.id;
    const baseUrl = window.location.origin;
    const callbackUrl = `${baseUrl}/m/${restaurantId}/reservation-payment/${reservationId}${branchQuery}`;

    try {
      const sessionRes = await fetch(`/api/public/${restaurantId}/reservation-payment-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reservationId,
          amount: depositAmount,
          callbackUrl,
        }),
      });

      if (!sessionRes.ok) {
        throw new Error("Failed to create payment session");
      }

      const session = await sessionRes.json();

      if (session.action === "redirect" && session.redirectUrl) {
        window.location.href = session.redirectUrl;
      } else {
        throw new Error(
          language === "ar"
            ? "بوابة الدفع غير مُعدة بعد. يرجى التواصل مع المطعم."
            : "Payment gateway not configured yet. Please contact the restaurant."
        );
      }
    } catch (err: any) {
      console.error("Payment init error:", err);
      setPaymentError(err.message || (
        language === "ar"
          ? "حدث خطأ أثناء تحميل صفحة الدفع"
          : "Error loading payment page"
      ));
      setIsRedirecting(false);
    }
  };

  const today = new Date().toISOString().split("T")[0];

  // Generate time slots, filtering out past times if today is selected
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const isToday = reservationDate === today;

  const timeSlots: string[] = [];
  for (let h = 10; h <= 23; h++) {
    for (const m of [0, 30]) {
      // If today, only show future time slots (at least 30 min ahead)
      if (isToday && (h < currentHour || (h === currentHour && m <= currentMinute))) {
        continue;
      }
      timeSlots.push(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center" dir={direction}>
        <div className="text-center space-y-4">
          <Skeleton className="h-12 w-48 mx-auto" />
          <Skeleton className="h-64 w-80 mx-auto" />
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center" dir={direction}>
        <Card className="max-w-sm mx-auto">
          <CardContent className="p-8 text-center">
            <ChefHat className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium text-muted-foreground">{t("restaurantNotFound")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const restaurantName = getLocalizedName(restaurant.nameEn, restaurant.nameAr) || "Restaurant";
  const depositRequired = restaurant.reservationDepositRequired !== false;
  const depositAmount = restaurant.reservationDepositAmount || "20.00";
  const BackArrow = direction === "rtl" ? ArrowRight : ArrowLeft;

  // Payment step view - EdfaPay redirect flow
  if (step === "payment") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800" dir={direction}>
        <div className="absolute top-4 right-4 z-10">
          <Button variant="outline" size="sm" onClick={toggleLanguage} className="gap-1.5 rounded-full">
            <Globe className="h-4 w-4" />
            {language === "ar" ? "EN" : "عربي"}
          </Button>
        </div>

        <div className="max-w-md mx-auto px-4 py-6 space-y-6">
          <div className="text-center space-y-2">
            <div className="h-16 w-16 rounded-full bg-blue-100 dark:bg-blue-900/50 mx-auto flex items-center justify-center">
              <CreditCard className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-xl font-bold">
              {language === "ar" ? "دفع رسوم الحجز" : "Pay Booking Fee"}
            </h2>
            <p className="text-sm text-muted-foreground">{restaurantName}</p>
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted-foreground">
                  {language === "ar" ? "رسوم الحجز" : "Booking Fee"}
                </span>
                <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {parseFloat(depositAmount).toFixed(2)} {language === "ar" ? "ر.س" : "SAR"}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {language === "ar"
                  ? "تُخصم من الفاتورة النهائية عند الحضور"
                  : "Will be deducted from your final bill"}
              </p>
            </CardContent>
          </Card>

          {paymentError && (
            <Card className="border-destructive">
              <CardContent className="p-4 text-center">
                <p className="text-destructive text-sm">{paymentError}</p>
                <Button
                  variant="outline"
                  className="mt-3"
                  onClick={() => {
                    setPaymentError(null);
                    setIsRedirecting(false);
                  }}
                >
                  {language === "ar" ? "إعادة المحاولة" : "Retry"}
                </Button>
              </CardContent>
            </Card>
          )}

          {!paymentError && (
            <Button
              className="w-full h-14 text-lg font-bold bg-blue-600 hover:bg-blue-700"
              onClick={handleReservationPayment}
              disabled={isRedirecting}
            >
              {isRedirecting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  {language === "ar" ? "جاري التحويل لصفحة الدفع..." : "Redirecting to payment..."}
                </>
              ) : (
                <>
                  <Lock className="h-5 w-5 mr-2" />
                  {language === "ar" ? "ادفع الآن" : "Pay Now"}
                </>
              )}
            </Button>
          )}

          <p className="text-xs text-center text-muted-foreground">
            {language === "ar"
              ? "الدفع آمن ومشفر عبر بوابة أدفع باي"
              : "Secure payment powered by EdfaPay"}
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800" dir={direction}>
        <div className="max-w-md mx-auto px-4 py-12 space-y-6">
          <div className="text-center space-y-4">
            <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-900/50 mx-auto flex items-center justify-center">
              <Check className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-bold">{t("success")}</h2>
            <p className="text-muted-foreground">{t("successDesc")}</p>
            {depositRequired && (
              <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
                <CardContent className="p-4 text-sm text-amber-800 dark:text-amber-200">
                  {t("depositReminder")}
                </CardContent>
              </Card>
            )}
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setLocation(`/m/${restaurantId}${branchQuery}`)}
            >
              {t("backToHome")}
            </Button>
            <Button
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                setSubmitted(false);
                setStep("form");
                setCreatedReservation(null);
                formInitialized.current = false;
                setIsPaymentFormLoaded(false);
                setPaymentError(null);
                setCustomerName("");
                setCustomerPhone("");
                setReservationDate("");
                setReservationTime("");
                setGuestCount("2");
                setSpecialRequests("");
                setTableId("");
              }}
            >
              {t("makeAnother")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-gray-900 dark:to-gray-800" dir={direction}>
      <div className="absolute top-4 right-4 z-10">
        <Button variant="outline" size="sm" onClick={toggleLanguage} className="gap-1.5 rounded-full">
          <Globe className="h-4 w-4" />
          {language === "ar" ? "EN" : "عربي"}
        </Button>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation(`/m/${restaurantId}${branchQuery}`)}
          >
            <BackArrow className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold">{t("reserveTable")}</h1>
            <p className="text-sm text-muted-foreground">{restaurantName}</p>
          </div>
        </div>

        <Card>
          <CardContent className="p-5 space-y-5">
            <div className="space-y-2">
              <Label>{t("yourName")} *</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={t("namePlaceholder")}
              />
            </div>

            <PhoneInput
              value={customerPhone}
              onChange={setCustomerPhone}
              label={t("phone")}
              placeholder={t("phonePlaceholder")}
              required
              showValidation={true}
              language={language as "en" | "ar"}
            />

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>{t("date")} *</Label>
                <Input
                  type="date"
                  value={reservationDate}
                  onChange={(e) => {
                    setReservationDate(e.target.value);
                    // Reset time if switching to today and current time is past selected
                    if (e.target.value === today && reservationTime) {
                      const [h, m] = reservationTime.split(":").map(Number);
                      if (h < currentHour || (h === currentHour && m <= currentMinute)) {
                        setReservationTime("");
                      }
                    }
                  }}
                  min={today}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("time")} *</Label>
                <Select value={reservationTime} onValueChange={setReservationTime}>
                  <SelectTrigger>
                    <SelectValue placeholder="--:--" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeSlots.map((slot) => (
                      <SelectItem key={slot} value={slot}>{slot}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("guests")} *</Label>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setGuestCount(String(Math.max(1, parseInt(guestCount) - 1)))}
                  disabled={parseInt(guestCount) <= 1}
                >
                  -
                </Button>
                <div className="flex items-center gap-1.5 text-lg font-semibold min-w-[3rem] justify-center">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  {guestCount}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setGuestCount(String(parseInt(guestCount) + 1))}
                  disabled={parseInt(guestCount) >= 20}
                >
                  +
                </Button>
              </div>
            </div>

            {tables && tables.length > 0 && (
              <div className="space-y-2">
                <Label>{t("selectTable")}</Label>
                <Select value={tableId} onValueChange={setTableId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("anyTable")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">{t("anyTable")}</SelectItem>
                    {tables.map((table: any) => (
                      <SelectItem key={table.id} value={table.id}>
                        {t("tableNum")} {table.tableNumber} ({table.capacity} {t("seats")})
                        {table.location && ` - ${table.location}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label>{t("specialRequests")}</Label>
              <Textarea
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                placeholder={t("specialRequestsPlaceholder")}
                rows={3}
              />
            </div>

            {depositRequired && (
              <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
                <CardContent className="p-3 text-sm text-amber-800 dark:text-amber-200 flex items-start gap-2">
                  <CalendarCheck className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  {t("depositNote")}
                </CardContent>
              </Card>
            )}

            <Button
              className="w-full bg-blue-600 hover:bg-blue-700 text-white h-12 text-base"
              onClick={handleSubmit}
              disabled={createReservation.isPending}
            >
              {createReservation.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  {t("submitting")}
                </>
              ) : (
                t("submit")
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

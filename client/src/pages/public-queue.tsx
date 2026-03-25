import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { PhoneInput } from "@/components/phone-input";
import { ArrowLeft, ArrowRight, Users, Check, Globe, ChefHat, Loader2, Clock, Hash, MessageCircle } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";

export default function PublicQueuePage() {
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
  const [partySize, setPartySize] = useState("2");
  const [submitted, setSubmitted] = useState(false);
  const [queueResult, setQueueResult] = useState<any>(null);

  const { data: restaurant, isLoading } = useQuery<any>({
    queryKey: [`/api/public/${restaurantId}/restaurant`],
  });

  const { data: queueStats, refetch: refetchStats } = useQuery<any>({
    queryKey: [`/api/public/${restaurantId}/queue/stats${branchParam ? `?branch=${branchParam}` : ""}`],
    refetchInterval: 5000,
  });

  const toggleLanguage = () => {
    setLanguage(language === "ar" ? "en" : "ar");
  };

  const t = (key: string) => {
    const translations: Record<string, { en: string; ar: string }> = {
      joinQueue: { en: "Join the Queue", ar: "سجّل بالطابور" },
      back: { en: "Back", ar: "رجوع" },
      yourName: { en: "Your Name", ar: "اسمك" },
      namePlaceholder: { en: "Enter your name", ar: "ادخل اسمك" },
      phone: { en: "Phone Number", ar: "رقم الجوال" },
      phonePlaceholder: { en: "05xxxxxxxx", ar: "05xxxxxxxx" },
      partySize: { en: "Party Size", ar: "عدد الأشخاص" },
      currentWait: { en: "Current Wait", ar: "الانتظار الحالي" },
      peopleWaiting: { en: "people waiting", ar: "بالانتظار" },
      minEstimated: { en: "min estimated", ar: "دقيقة تقريباً" },
      noWaitNow: { en: "No wait right now!", ar: "لا يوجد انتظار حالياً!" },
      submit: { en: "Join Queue", ar: "سجّل بالطابور" },
      submitting: { en: "Joining...", ar: "جاري التسجيل..." },
      success: { en: "You're in the Queue!", ar: "تم تسجيلك بالطابور!" },
      yourNumber: { en: "Your Queue Number", ar: "رقمك بالطابور" },
      position: { en: "Your Position", ar: "ترتيبك" },
      estimatedWait: { en: "Estimated Wait", ar: "وقت الانتظار المتوقع" },
      minutes: { en: "minutes", ar: "دقيقة" },
      waitNote: { en: "We'll call your name when your table is ready. Please stay nearby.", ar: "سننادي اسمك لما تجهز طاولتك. الرجاء البقاء بالقرب." },
      backToHome: { en: "Back to Home", ar: "العودة للرئيسية" },
      browseMenu: { en: "Browse Menu While Waiting", ar: "تصفح المنيو أثناء الانتظار" },
      sendWhatsApp: { en: "Send WhatsApp Reminder", ar: "أرسل تذكير عبر واتساب" },
      required: { en: "Please fill in all required fields", ar: "يرجى تعبئة جميع الحقول المطلوبة" },
      error: { en: "Failed to join queue", ar: "فشل في التسجيل بالطابور" },
      restaurantNotFound: { en: "Restaurant not found", ar: "المطعم غير موجود" },
    };
    return translations[key]?.[language] || key;
  };

  const joinQueue = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/public/${restaurantId}/queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName,
          customerPhone,
          partySize: parseInt(partySize),
          branchId: branchParam || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data?.error === "daySessionClosed") {
          throw new Error("daySessionClosed");
        }
        throw new Error("Failed to join queue");
      }
      return data;
    },
    onSuccess: (data) => {
      setQueueResult(data);
      setSubmitted(true);
      refetchStats();
    },
    onError: (error: Error) => {
      toast({
        title: error.message === "daySessionClosed"
          ? (language === "ar" ? "المطعم لم يبدأ يوم العمل بعد" : "Restaurant has not started the work day yet")
          : t("error"),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!customerName) {
      toast({ title: t("required"), variant: "destructive" });
      return;
    }
    // Check if phone is valid (exactly 10 digits, starts with 05)
    const sanitizedPhone = customerPhone.replace(/\D/g, "");
    if (sanitizedPhone.length !== 10 || !sanitizedPhone.startsWith("05")) {
      toast({
        title: language === "ar" ? "رقم جوال غير صحيح" : "Invalid phone number",
        variant: "destructive",
      });
      return;
    }
    joinQueue.mutate();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center" dir={direction}>
        <div className="text-center space-y-4">
          <Skeleton className="h-12 w-48 mx-auto" />
          <Skeleton className="h-64 w-80 mx-auto" />
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center" dir={direction}>
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
  const BackArrow = direction === "rtl" ? ArrowRight : ArrowLeft;

  if (submitted && queueResult) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white dark:from-gray-900 dark:to-gray-800" dir={direction}>
        <div className="max-w-md mx-auto px-4 py-12 space-y-6">
          <div className="text-center space-y-4">
            <div className="h-20 w-20 rounded-full bg-green-100 dark:bg-green-900/50 mx-auto flex items-center justify-center">
              <Check className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-bold">{t("success")}</h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Card className="border-green-200 dark:border-green-800">
              <CardContent className="p-4 text-center">
                <Hash className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto mb-1" />
                <p className="text-xs text-muted-foreground mb-1">{t("yourNumber")}</p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">{queueResult.queueNumber}</p>
              </CardContent>
            </Card>
            <Card className="border-blue-200 dark:border-blue-800">
              <CardContent className="p-4 text-center">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400 mx-auto mb-1" />
                <p className="text-xs text-muted-foreground mb-1">{t("estimatedWait")}</p>
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{queueResult.estimatedWaitMinutes || 0}</p>
                <p className="text-xs text-muted-foreground">{t("minutes")}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20">
            <CardContent className="p-4 text-sm text-amber-800 dark:text-amber-200 text-center">
              {t("waitNote")}
            </CardContent>
          </Card>

          <div className="space-y-3">
            <Button
              className="w-full bg-orange-600 hover:bg-orange-700 text-white h-12"
              onClick={() => setLocation(`/m/${restaurantId}/menu${branchQuery}`)}
            >
              {t("browseMenu")}
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setLocation(`/m/${restaurantId}${branchQuery}`)}
            >
              {t("backToHome")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white dark:from-gray-900 dark:to-gray-800" dir={direction}>
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
            <h1 className="text-xl font-bold">{t("joinQueue")}</h1>
            <p className="text-sm text-muted-foreground">{restaurantName}</p>
          </div>
        </div>

        {queueStats && (
          <Card className={`${queueStats.waitingCount === 0 ? "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20" : "border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20"}`}>
            <CardContent className="p-4 text-center">
              <p className="text-sm font-medium mb-1">{t("currentWait")}</p>
              {queueStats.waitingCount === 0 ? (
                <p className="text-lg font-bold text-green-600 dark:text-green-400">{t("noWaitNow")}</p>
              ) : (
                <div className="flex items-center justify-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-orange-600" />
                    <span className="font-bold text-lg">{queueStats.waitingCount}</span>
                    <span className="text-sm text-muted-foreground">{t("peopleWaiting")}</span>
                  </div>
                  <span className="text-muted-foreground">|</span>
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-orange-600" />
                    <span className="font-bold text-lg">~{queueStats.estimatedWaitMinutes}</span>
                    <span className="text-sm text-muted-foreground">{t("minEstimated")}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

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

            <div className="space-y-2">
              <Label>{t("partySize")}</Label>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setPartySize(String(Math.max(1, parseInt(partySize) - 1)))}
                  disabled={parseInt(partySize) <= 1}
                >
                  -
                </Button>
                <div className="flex items-center gap-1.5 text-lg font-semibold min-w-[3rem] justify-center">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  {partySize}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setPartySize(String(parseInt(partySize) + 1))}
                  disabled={parseInt(partySize) >= 20}
                >
                  +
                </Button>
              </div>
            </div>

            <Button
              className="w-full bg-green-600 hover:bg-green-700 text-white h-12 text-base"
              onClick={handleSubmit}
              disabled={joinQueue.isPending}
            >
              {joinQueue.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  {t("submitting")}
                </>
              ) : (
                <>
                  <Users className="h-5 w-5 mr-2" />
                  {t("submit")}
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

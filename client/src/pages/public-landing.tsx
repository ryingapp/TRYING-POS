import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  UtensilsCrossed,
  CalendarCheck,
  Users,
  Globe,
  ChefHat,
  Phone,
  MapPin,
  Clock,
  Truck,
  ShoppingBag,
  Store,
  MessageCircle,
  ArrowRight,
  ArrowLeft,
  Utensils,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export default function PublicLandingPage() {
  const params = useParams<{ restaurantId?: string }>();
  const [, setLocation] = useLocation();
  const { language, setLanguage, direction, getLocalizedName } = useLanguage();
  const restaurantId = params.restaurantId || "default";

  const urlParams = new URLSearchParams(window.location.search);
  const branchParam = urlParams.get("b");
  const branchQuery = branchParam ? `?b=${branchParam}` : "";

  const { data: restaurant, isLoading } = useQuery<any>({
    queryKey: [`/api/public/${restaurantId}/restaurant`],
  });

  const { data: queueStats } = useQuery<any>({
    queryKey: [`/api/public/${restaurantId}/queue/stats${branchParam ? `?branch=${branchParam}` : ""}`],
    enabled: !!restaurant?.serviceQueue,
    refetchInterval: 30000,
  });

  const { data: categories } = useQuery<any[]>({
    queryKey: [`/api/public/${restaurantId}/categories`],
  });

  const toggleLanguage = () => {
    setLanguage(language === "ar" ? "en" : "ar");
  };

  const t = (key: string) => {
    const translations: Record<string, { en: string; ar: string }> = {
      welcome: { en: "Welcome to", ar: "أهلاً بك في" },
      ourServices: { en: "Our Services", ar: "خدماتنا" },
      browseMenu: { en: "Browse Menu", ar: "تصفح المنيو" },
      browseMenuDesc: { en: "View our full menu and order online", ar: "تصفح قائمتنا الكاملة واطلب أونلاين" },
      makeReservation: { en: "Reserve a Table", ar: "احجز طاولة" },
      makeReservationDesc: { en: "Book your table in advance", ar: "احجز طاولتك مسبقاً" },
      joinQueue: { en: "Join the Queue", ar: "سجّل بالطابور" },
      joinQueueDesc: { en: "Get in line, we'll notify you", ar: "سجّل وبنبلغك لما يجي دورك" },
      currentlyWaiting: { en: "waiting", ar: "بالانتظار" },
      estimatedWait: { en: "min wait", ar: "دقيقة انتظار" },
      noWait: { en: "No wait!", ar: "بدون انتظار!" },
      orderTypes: { en: "Order Options", ar: "خيارات الطلب" },
      dineIn: { en: "Dine In", ar: "أكل بالمطعم" },
      pickup: { en: "Pickup", ar: "استلام" },
      delivery: { en: "Delivery", ar: "توصيل" },
      contactUs: { en: "Contact Us", ar: "تواصل معنا" },
      workingHours: { en: "Working Hours", ar: "أوقات العمل" },
      open: { en: "Open", ar: "مفتوح" },
      closed: { en: "Closed", ar: "مغلق" },
      ourMenu: { en: "Our Menu Categories", ar: "أقسام المنيو" },
      viewAll: { en: "View Full Menu", ar: "عرض المنيو كاملاً" },
      restaurantNotFound: { en: "Restaurant not found", ar: "المطعم غير موجود" },
      deposit: { en: "Booking fee deducted from bill", ar: "رسوم حجز تُخصم من الفاتورة" },
      sat: { en: "Saturday", ar: "السبت" },
      sun: { en: "Sunday", ar: "الأحد" },
      mon: { en: "Monday", ar: "الاثنين" },
      tue: { en: "Tuesday", ar: "الثلاثاء" },
      wed: { en: "Wednesday", ar: "الأربعاء" },
      thu: { en: "Thursday", ar: "الخميس" },
      fri: { en: "Friday", ar: "الجمعة" },
    };
    return translations[key]?.[language] || key;
  };

  const Arrow = direction === "rtl" ? ArrowLeft : ArrowRight;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900" dir={direction}>
        <Skeleton className="h-48 w-full" />
        <div className="max-w-lg mx-auto px-4 -mt-12 space-y-4">
          <Skeleton className="h-24 w-24 rounded-full mx-auto" />
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-64 mx-auto" />
          <div className="space-y-3 pt-4">
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center" dir={direction}>
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
  const description = getLocalizedName(restaurant.descriptionEn, restaurant.descriptionAr);

  const isCurrentlyOpen = () => {
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
    const dayNames = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const todayKey = dayNames[now.getDay()];

    if (restaurant.workingHours && restaurant.workingHours[todayKey]) {
      const todayHours = restaurant.workingHours[todayKey];
      return currentTime >= todayHours.open && currentTime <= todayHours.close;
    }

    if (!restaurant.openingTime || !restaurant.closingTime) return null;
    return currentTime >= restaurant.openingTime && currentTime <= restaurant.closingTime;
  };

  const openStatus = isCurrentlyOpen();

  const servicesList = [];
  if (restaurant.serviceDineIn) servicesList.push({ icon: Utensils, label: t("dineIn") });
  if (restaurant.servicePickup) servicesList.push({ icon: ShoppingBag, label: t("pickup") });
  if (restaurant.serviceDelivery) servicesList.push({ icon: Truck, label: t("delivery") });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900" dir={direction}>
      <div className="fixed top-4 right-4 z-50">
        <Button variant="secondary" size="sm" onClick={toggleLanguage} className="gap-1.5 rounded-full shadow-lg backdrop-blur-sm bg-white/80 dark:bg-gray-800/80">
          <Globe className="h-4 w-4" />
          {language === "ar" ? "EN" : "عربي"}
        </Button>
      </div>

      {restaurant.banner ? (
        <div className="relative h-52 w-full overflow-hidden">
          <img src={restaurant.banner} alt="" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/60" />
        </div>
      ) : (
        <div className="h-40 bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 relative">
          <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 relative">
        <div className="flex flex-col items-center -mt-14 mb-6">
          {restaurant.logo ? (
            <img src={restaurant.logo} alt={restaurantName} className="h-28 w-28 rounded-full object-cover border-4 border-white dark:border-gray-800 shadow-xl bg-white dark:bg-gray-800" />
          ) : (
            <div className="h-28 w-28 rounded-full bg-white dark:bg-gray-800 flex items-center justify-center border-4 border-white dark:border-gray-800 shadow-xl">
              <ChefHat className="h-14 w-14 text-orange-500" />
            </div>
          )}

          <div className="text-center mt-4 space-y-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{restaurantName}</h1>
            {description && (
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">{description}</p>
            )}

            <div className="flex items-center justify-center gap-2 flex-wrap">
              {openStatus !== null && (
                <Badge variant={openStatus ? "default" : "secondary"} className={`${openStatus ? "bg-green-500 hover:bg-green-600" : "bg-gray-400"} text-white`}>
                  <Clock className="h-3 w-3 mr-1" />
                  {openStatus ? t("open") : t("closed")}
                </Badge>
              )}
              {restaurant.openingTime && restaurant.closingTime && (
                <span className="text-xs text-muted-foreground">
                  {restaurant.openingTime} - {restaurant.closingTime}
                </span>
              )}
            </div>

            {servicesList.length > 0 && (
              <div className="flex items-center justify-center gap-3 pt-1">
                {servicesList.map((s, i) => (
                  <div key={i} className="flex items-center gap-1 text-xs text-muted-foreground">
                    <s.icon className="h-3.5 w-3.5" />
                    <span>{s.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 pb-8">
          <Button
            className="w-full h-14 text-base font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-xl shadow-md shadow-orange-200 dark:shadow-orange-900/30 gap-3"
            onClick={() => setLocation(`/m/${restaurantId}/menu${branchQuery}`)}
          >
            <UtensilsCrossed className="h-5 w-5" />
            {t("browseMenu")}
            <Arrow className="h-4 w-4 ms-auto" />
          </Button>

          {restaurant.serviceTableBooking && (
            <Card
              className="cursor-pointer hover:shadow-md transition-all rounded-xl border-0 shadow-sm bg-white dark:bg-gray-800"
              onClick={() => setLocation(`/m/${restaurantId}/reserve${branchQuery}`)}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                  <CalendarCheck className="h-6 w-6 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold">{t("makeReservation")}</h3>
                  <p className="text-xs text-muted-foreground">{t("makeReservationDesc")}</p>
                </div>
                <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600 dark:text-amber-400 flex-shrink-0">
                  {t("deposit")}
                </Badge>
              </CardContent>
            </Card>
          )}

          {restaurant.serviceQueue && (
            <Card
              className="cursor-pointer hover:shadow-md transition-all rounded-xl border-0 shadow-sm bg-white dark:bg-gray-800"
              onClick={() => setLocation(`/m/${restaurantId}/queue${branchQuery}`)}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-green-50 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                  <Users className="h-6 w-6 text-green-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold">{t("joinQueue")}</h3>
                  <p className="text-xs text-muted-foreground">{t("joinQueueDesc")}</p>
                </div>
                {queueStats && (
                  <div className="flex-shrink-0 text-end">
                    {queueStats.waitingCount === 0 ? (
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 hover:bg-green-100 text-[10px]">
                        {t("noWait")}
                      </Badge>
                    ) : (
                      <div className="space-y-0.5">
                        <p className="text-xs font-semibold text-orange-500">{queueStats.waitingCount} {t("currentlyWaiting")}</p>
                        <p className="text-[10px] text-muted-foreground">~{queueStats.estimatedWaitMinutes} {t("estimatedWait")}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}



          {(restaurant.phone || restaurant.whatsapp || restaurant.address || restaurant.socialInstagram || restaurant.socialTwitter || restaurant.socialTiktok || restaurant.socialSnapchat || restaurant.socialFacebook) && (
            <Card className="rounded-xl border-0 shadow-sm bg-white dark:bg-gray-800">
              <CardContent className="p-4 space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground">{t("contactUs")}</h3>
                {restaurant.phone && (
                  <a href={`tel:${restaurant.phone}`} className="flex items-center gap-3 text-sm hover:text-orange-500 transition-colors">
                    <div className="h-9 w-9 rounded-lg bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
                      <Phone className="h-4 w-4 text-orange-500" />
                    </div>
                    <span dir="ltr">{restaurant.phone}</span>
                  </a>
                )}
                {restaurant.whatsapp && (
                  <a href={`https://wa.me/${restaurant.whatsapp.replace(/[^0-9]/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-sm hover:text-green-500 transition-colors">
                    <div className="h-9 w-9 rounded-lg bg-green-50 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                      <MessageCircle className="h-4 w-4 text-green-500" />
                    </div>
                    <span dir="ltr">{restaurant.whatsapp}</span>
                  </a>
                )}
                {restaurant.address && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="h-9 w-9 rounded-lg bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                      <MapPin className="h-4 w-4 text-purple-500" />
                    </div>
                    <span className="text-muted-foreground">{restaurant.address}</span>
                  </div>
                )}
                {/* Social Media Links */}
                {(restaurant.socialInstagram || restaurant.socialTwitter || restaurant.socialTiktok || restaurant.socialSnapchat || restaurant.socialFacebook) && (
                  <div className="flex items-center gap-3 pt-2 border-t">
                    {restaurant.socialInstagram && (
                      <a href={`https://instagram.com/${restaurant.socialInstagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="h-9 w-9 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center hover:opacity-80 transition-opacity">
                        <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                      </a>
                    )}
                    {restaurant.socialTwitter && (
                      <a href={`https://x.com/${restaurant.socialTwitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="h-9 w-9 rounded-lg bg-black flex items-center justify-center hover:opacity-80 transition-opacity">
                        <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                      </a>
                    )}
                    {restaurant.socialTiktok && (
                      <a href={`https://tiktok.com/@${restaurant.socialTiktok.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="h-9 w-9 rounded-lg bg-black flex items-center justify-center hover:opacity-80 transition-opacity">
                        <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
                      </a>
                    )}
                    {restaurant.socialSnapchat && (
                      <a href={`https://snapchat.com/add/${restaurant.socialSnapchat.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="h-9 w-9 rounded-lg bg-yellow-400 flex items-center justify-center hover:opacity-80 transition-opacity">
                        <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12.922-.271.143-.082.291-.123.437-.123.259 0 .5.1.678.285.178.186.264.439.237.7-.073.568-.582.884-1.105 1.066-.209.073-.426.127-.59.178-.241.073-.448.135-.61.207-.31.137-.497.346-.592.58-.097.249-.094.562-.089.875v.033c.022.601.07 1.215.331 1.756.264.557.704.964 1.378 1.285.342.16.704.283 1.069.396.229.07.455.138.671.216.402.147.635.326.745.543.113.223.053.489-.084.694-.21.316-.58.534-1.141.63-.56.097-1.25.089-1.983-.041-.358-.063-.89-.195-1.364-.316-.326-.083-.64-.163-.877-.2-.149-.023-.32.005-.537.056.068 1.159.197 2.362-.133 3.364-.401 1.215-1.198 2.207-2.364 2.946C14.675 23.594 13.454 24 12.19 24c-1.264 0-2.485-.406-3.626-1.208-1.166-.739-1.963-1.731-2.364-2.946-.33-1.002-.199-2.205-.131-3.364a2.268 2.268 0 00-.542-.059l-.074.008c-.236.036-.544.113-.864.194-.474.121-1.009.253-1.369.316-.728.131-1.419.138-1.978.042-.561-.097-.931-.315-1.141-.63-.138-.207-.197-.472-.084-.695.11-.218.343-.396.745-.543.218-.078.444-.146.672-.216.367-.113.728-.236 1.071-.397.674-.32 1.114-.727 1.378-1.284.263-.545.31-1.16.332-1.768v-.022c.004-.251.005-.504-.003-.75-.008-.234-.088-.543-.294-.797-.155-.191-.389-.344-.638-.45-.162-.072-.369-.134-.61-.208-.164-.05-.381-.105-.59-.177-.523-.183-1.032-.499-1.105-1.067-.026-.261.059-.514.237-.7.178-.186.419-.284.678-.284.146 0 .294.04.437.122.263.152.622.287.922.272.195 0 .325-.046.401-.091-.008-.165-.018-.33-.03-.51l-.003-.06c-.104-1.628-.23-3.654.299-4.847C6.86 1.069 10.216.793 11.206.793h1z"/></svg>
                      </a>
                    )}
                    {restaurant.socialFacebook && (
                      <a href={`https://facebook.com/${restaurant.socialFacebook}`} target="_blank" rel="noopener noreferrer" className="h-9 w-9 rounded-lg bg-blue-600 flex items-center justify-center hover:opacity-80 transition-opacity">
                        <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                      </a>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {restaurant.workingHours && Object.keys(restaurant.workingHours).length > 0 && (
            <Card className="rounded-xl border-0 shadow-sm bg-white dark:bg-gray-800">
              <CardContent className="p-4 space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  {t("workingHours")}
                </h3>
                <div className="space-y-1.5">
                  {["sat", "sun", "mon", "tue", "wed", "thu", "fri"].map((day) => {
                    const hours = restaurant.workingHours?.[day];
                    if (!hours) return null;
                    return (
                      <div key={day} className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{t(day)}</span>
                        <span className="font-medium" dir="ltr">{hours.open} - {hours.close}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="text-center pt-4 pb-6">
            <p className="text-xs text-muted-foreground opacity-60">
              Powered by TRYING
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useParams, Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Clock, ChefHat, Package, ArrowLeft, Globe, Star, Send } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Order, OrderItem, MenuItem } from "@shared/schema";

type OrderWithItems = Order & {
  items: (OrderItem & { menuItem?: MenuItem })[];
};

const statusSteps = ["pending", "preparing", "ready", "completed"] as const;

export default function OrderStatusPage() {
  const { orderId, restaurantId } = useParams<{ orderId: string; restaurantId?: string }>();
  const { t, direction, language, setLanguage, getLocalizedName } = useLanguage();
  const { toast } = useToast();

  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [hoverRating, setHoverRating] = useState(0);

  const toggleLanguage = () => {
    setLanguage(language === "ar" ? "en" : "ar");
  };

  const isPublic = !!restaurantId;
  const orderEndpoint = isPublic ? `/api/public/${restaurantId}/orders/${orderId}` : `/api/orders/${orderId}`;
  const itemsEndpoint = isPublic ? `/api/public/${restaurantId}/orders/${orderId}/items` : `/api/orders/${orderId}/items`;

  const { data: order, isLoading: orderLoading } = useQuery<Order>({
    queryKey: [orderEndpoint],
    refetchInterval: 5000,
  });

  const { data: orderItems, isLoading: itemsLoading } = useQuery<(OrderItem & { menuItem?: MenuItem })[]>({
    queryKey: [itemsEndpoint],
    refetchInterval: 5000,
    enabled: !!orderId,
  });

  // Check if order has been reviewed
  const reviewCheckEndpoint = isPublic ? `/api/public/${restaurantId}/reviews/order/${orderId}` : null;
  const { data: reviewStatus } = useQuery<{ reviewed: boolean; review: any }>({
    queryKey: [reviewCheckEndpoint],
    enabled: !!reviewCheckEndpoint && !!orderId,
  });

  const submitReviewMutation = useMutation({
    mutationFn: async (data: { rating: number; comment: string }) => {
      const res = await apiRequest("POST", `/api/public/${restaurantId}/reviews`, {
        orderId,
        customerName: order?.customerName || null,
        customerPhone: order?.customerPhone || null,
        rating: data.rating,
        comment: data.comment || null,
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: language === "ar" ? "شكراً لتقييمك!" : "Thank you for your review!",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" ? "فشل إرسال التقييم" : "Failed to submit review",
      });
    },
  });

  const isLoading = orderLoading || itemsLoading;

  const orderWithItems: OrderWithItems | null = order ? {
    ...order,
    items: orderItems || [],
  } : null;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="h-8 w-8" />;
      case "preparing":
        return <ChefHat className="h-8 w-8" />;
      case "ready":
        return <Package className="h-8 w-8" />;
      case "completed":
        return <CheckCircle2 className="h-8 w-8" />;
      default:
        return <Clock className="h-8 w-8" />;
    }
  };

  const getStatusColor = (status: string, currentStatus: string) => {
    const currentIndex = statusSteps.indexOf(currentStatus as typeof statusSteps[number]);
    const stepIndex = statusSteps.indexOf(status as typeof statusSteps[number]);

    if (stepIndex < currentIndex) {
      return "bg-green-500 text-white";
    } else if (stepIndex === currentIndex) {
      return "bg-orange-500 text-white animate-pulse";
    }
    return "bg-muted text-muted-foreground";
  };

  const getStatusMessage = (status: string) => {
    switch (status) {
      case "pending":
        return t("orderReceived");
      case "preparing":
        return t("orderPreparing");
      case "ready":
        return t("orderReady");
      case "completed":
        return t("orderCompleted");
      default:
        return t("orderReceived");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0a0a0a] p-6" dir={direction}>
        <div className="max-w-lg mx-auto space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!orderWithItems) {
    return (
      <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0a0a0a] flex items-center justify-center" dir={direction}>
        <Card className="max-w-md w-full mx-4 rounded-2xl border-gray-200/60 dark:border-white/[0.06] shadow-sm">
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground mb-4">{t("noOrders")}</p>
            <Link href={isPublic ? `/m/${restaurantId}/menu` : "/order"}>
              <Button className="bg-[#8B1A1A] hover:bg-[#A02020] text-white rounded-xl" data-testid="button-back-to-menu">{t("backToMenu")}</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0a0a0a]" dir={direction}>
      <header className="sticky top-0 z-10 bg-[#faf9f7]/95 dark:bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-gray-100 dark:border-white/[0.04] p-4">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={isPublic ? `/m/${restaurantId}/menu` : "/order"}>
              <Button variant="ghost" size="icon" className="rounded-xl bg-white dark:bg-white/[0.05] ring-1 ring-gray-100 dark:ring-white/[0.06] h-9 w-9" data-testid="button-back-to-menu">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-base font-bold tracking-tight" data-testid="text-track-order-title">{t("trackOrder")}</h1>
              <p className="text-[11px] text-muted-foreground" data-testid="text-order-number">
                {t("orderNumber")} {orderWithItems.orderNumber}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleLanguage}
            className="gap-1.5 rounded-xl h-8 text-xs border-gray-100 dark:border-white/[0.06]"
            data-testid="button-status-toggle-language"
          >
            <Globe className="h-3.5 w-3.5" />
            {language === "ar" ? "EN" : "عربي"}
          </Button>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-5">
        {/* Status Hero Card */}
        <Card className="overflow-hidden rounded-2xl border-0 shadow-md" data-testid="card-order-status">
          <div className={`p-7 text-center relative overflow-hidden ${
            orderWithItems.status === "ready" 
              ? "bg-emerald-500 text-white" 
              : orderWithItems.status === "completed"
              ? "bg-slate-800 text-white"
              : "bg-[#8B1A1A] text-white"
          }`}>
            <div className="relative z-10">
              <div className={`w-14 h-14 rounded-2xl bg-white/15 mx-auto flex items-center justify-center mb-3 ${orderWithItems.status === "preparing" ? "animate-pulse" : ""}`}>
                {getStatusIcon(orderWithItems.status || "pending")}
              </div>
              <h2 className="text-xl font-bold" data-testid="text-status-message">
                {getStatusMessage(orderWithItems.status || "pending")}
              </h2>
            </div>
          </div>
        </Card>

        {/* Progress Steps */}
        <div className="flex items-center justify-between px-1 py-2" data-testid="status-progress">
          {statusSteps.map((step, index) => {
            const currentIndex = statusSteps.indexOf(orderWithItems.status as typeof statusSteps[number] || "pending");
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;
            return (
              <div key={step} className="flex-1 flex flex-col items-center" data-testid={`status-step-${step}`}>
                <div className="flex items-center w-full">
                  {index > 0 && (
                    <div className={`flex-1 h-0.5 rounded-full transition-all ${isCompleted ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-white/10'}`} />
                  )}
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold transition-all flex-shrink-0 ${
                      isCompleted
                        ? "bg-emerald-500 text-white"
                        : isCurrent
                        ? "bg-[#8B1A1A] text-white animate-pulse"
                        : "bg-gray-100 dark:bg-white/[0.05] text-gray-300 dark:text-white/20"
                    }`}
                  >
                    {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                  </div>
                  {index < statusSteps.length - 1 && (
                    <div className={`flex-1 h-0.5 rounded-full transition-all ${isCompleted ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-white/10'}`} />
                  )}
                </div>
                <span className={`text-[9px] text-center font-semibold mt-1.5 ${isCurrent ? 'text-[#8B1A1A] dark:text-[#e88]' : isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-300 dark:text-white/20'}`}>{t(step)}</span>
              </div>
            );
          })}
        </div>

        {/* Order Details Card */}
        <Card className="rounded-2xl border-gray-100 dark:border-white/[0.05] shadow-sm overflow-hidden">
          <CardContent className="p-4 space-y-3">
            <h3 className="font-bold text-sm">{t("orderDetails")}</h3>
            
            <div className="space-y-2.5 text-sm" data-testid="order-details">
              <div className="flex justify-between items-center" data-testid="row-order-type">
                <span className="text-muted-foreground font-medium">{t("orderType")}</span>
                <Badge variant="secondary" className="rounded-xl font-bold text-[11px] h-6" data-testid="badge-order-type">
                  {t(orderWithItems.orderType === "dine_in" ? "dineIn" : orderWithItems.orderType)}
                </Badge>
              </div>
              {orderWithItems.tableId && (
                <div className="flex justify-between items-center" data-testid="row-table-number">
                  <span className="text-muted-foreground font-medium">{t("tableNumber")}</span>
                  <span className="font-bold text-sm" data-testid="text-table-id">{orderWithItems.tableId}</span>
                </div>
              )}
              {orderWithItems.customerName && (
                <div className="flex justify-between items-center" data-testid="row-customer-name">
                  <span className="text-muted-foreground font-medium">{t("customer")}</span>
                  <span className="font-bold text-sm" data-testid="text-customer-name">{orderWithItems.customerName}</span>
                </div>
              )}
              <div className="flex justify-between items-center" data-testid="row-payment-method">
                <span className="text-muted-foreground font-medium">{t("paymentMethod")}</span>
                <span className="font-bold text-sm" data-testid="text-payment-method">{t(orderWithItems.paymentMethod || "cash")}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Order Items Card */}
        <Card className="rounded-2xl border-gray-100 dark:border-white/[0.05] shadow-sm overflow-hidden">
          <CardContent className="p-4 space-y-3">
            <h3 className="font-bold text-sm">{t("orderItems")}</h3>
            
            {orderWithItems.items && orderWithItems.items.length > 0 ? (
              <div className="space-y-0 divide-y divide-gray-100 dark:divide-white/[0.05]" data-testid="order-items-list">
                {orderWithItems.items.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-center py-3 first:pt-0 last:pb-0"
                    data-testid={`order-item-${index}`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm" data-testid={`text-item-name-${index}`}>
                        {getLocalizedName(item.menuItem?.nameEn, item.menuItem?.nameAr) || t("items")}
                      </p>
                      {item.notes && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1" data-testid={`text-item-notes-${index}`}>{item.notes}</p>
                      )}
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <Badge variant="outline" className="rounded-lg text-[10px] font-bold h-5 px-2" data-testid={`badge-item-qty-${index}`}>{item.quantity}x</Badge>
                      <p className="text-sm text-[#8B1A1A] dark:text-[#e88] font-bold tabular-nums min-w-[60px] text-right" data-testid={`text-item-price-${index}`}>
                        {parseFloat(item.totalPrice).toFixed(2)} {t("sar")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm" data-testid="text-no-items">{t("noItems")}</p>
            )}

            <div className="pt-3 border-t border-gray-100 dark:border-white/[0.06]">
              <div className="flex justify-between items-center font-bold text-base">
                <span>{t("total")}</span>
                <span className="text-[#8B1A1A] dark:text-[#e88] tabular-nums" data-testid="text-order-total">
                  {parseFloat(orderWithItems.total || "0").toFixed(2)} {t("sar")}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {orderWithItems.kitchenNotes && (
          <Card data-testid="card-kitchen-notes" className="rounded-2xl border-gray-100 dark:border-white/[0.05] shadow-sm">
            <CardContent className="p-4">
              <h3 className="font-bold text-sm mb-2">{t("kitchenNotes")}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed" data-testid="text-kitchen-notes">{orderWithItems.kitchenNotes}</p>
            </CardContent>
          </Card>
        )}

        {/* Review Section */}
        {isPublic && (orderWithItems.status === "completed" || orderWithItems.status === "ready") && (
          <Card className="rounded-2xl border-gray-100 dark:border-white/[0.05] shadow-sm overflow-hidden">
            <CardContent className="p-5">
              {reviewStatus?.reviewed || submitReviewMutation.isSuccess ? (
                <div className="text-center py-3">
                  <div className="flex justify-center gap-1 mb-2.5">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`h-7 w-7 ${star <= (reviewStatus?.review?.rating || reviewRating) ? "fill-amber-400 text-amber-400" : "text-gray-200 dark:text-gray-700"}`}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-emerald-600 dark:text-emerald-400 font-bold">
                    {language === "ar" ? "شكراً لتقييمك! ✨" : "Thanks for your review! ✨"}
                  </p>
                </div>
              ) : (
                <div>
                  <h3 className="font-bold text-center mb-3">
                    {language === "ar" ? "كيف كانت تجربتك؟" : "How was your experience?"}
                  </h3>
                  <div className="flex justify-center gap-2 mb-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setReviewRating(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        className="transition-all hover:scale-110 active:scale-95"
                      >
                        <Star
                          className={`h-8 w-8 transition-all ${
                            star <= (hoverRating || reviewRating)
                              ? "fill-amber-400 text-amber-400"
                              : "text-gray-200 dark:text-gray-700"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  {reviewRating > 0 && (
                    <>
                      <Textarea
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder={language === "ar" ? "اكتب تعليقك (اختياري)..." : "Write a comment (optional)..."}
                        className="mb-3 resize-none rounded-xl border-gray-100 dark:border-white/[0.06] focus:ring-[#8B1A1A]/30"
                        rows={3}
                      />
                      <Button
                        className="w-full bg-[#8B1A1A] hover:bg-[#A02020] text-white rounded-xl h-11 font-semibold"
                        disabled={submitReviewMutation.isPending}
                        onClick={() => submitReviewMutation.mutate({ rating: reviewRating, comment: reviewComment })}
                      >
                        <Send className="h-4 w-4 mr-2" />
                        {submitReviewMutation.isPending
                          ? (language === "ar" ? "جاري الإرسال..." : "Submitting...")
                          : (language === "ar" ? "إرسال التقييم" : "Submit Review")}
                      </Button>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

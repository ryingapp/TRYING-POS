import { useQuery, useMutation } from "@tanstack/react-query";
import { Star, StarOff, Eye, EyeOff, MessageSquare } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Review } from "@shared/schema";

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

export default function ReviewsPage() {
  const { direction } = useLanguage();
  const { toast } = useToast();
  const isRtl = direction === "rtl";

  const { data: reviews = [], isLoading } = useQuery<Review[]>({
    queryKey: ["/api/reviews"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/reviews");
      return res.json();
    },
  });

  const togglePublicMutation = useMutation({
    mutationFn: ({ id, isPublic }: { id: string; isPublic: boolean }) =>
      apiRequest("PATCH", `/api/reviews/${id}`, { isPublic }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reviews"] });
      toast({ title: isRtl ? "تم التحديث" : "Updated successfully" });
    },
    onError: () => {
      toast({ title: isRtl ? "حدث خطأ" : "Error updating review", variant: "destructive" });
    },
  });

  const total = reviews.length;
  const avg =
    total > 0
      ? (reviews.reduce((s, r) => s + (r.rating ?? 0), 0) / total).toFixed(1)
      : "—";

  const dist = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length,
    pct: total > 0 ? Math.round((reviews.filter((r) => r.rating === star).length / total) * 100) : 0,
  }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-muted-foreground">{isRtl ? "جاري التحميل..." : "Loading..."}</div>
      </div>
    );
  }

  return (
    <div className={`p-6 space-y-6 ${isRtl ? "rtl" : "ltr"}`}>
      <div className="flex items-center gap-3">
        <MessageSquare className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">{isRtl ? "التقييمات" : "Reviews"}</h1>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-4xl font-black text-primary">{avg}</p>
            <div className="flex justify-center mt-1">
              {total > 0 && <StarRating rating={Math.round(Number(avg))} />}
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              {isRtl ? "متوسط التقييم" : "Average Rating"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-4xl font-black">{total}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {isRtl ? "إجمالي التقييمات" : "Total Reviews"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 space-y-1">
            {dist.map(({ star, count, pct }) => (
              <div key={star} className="flex items-center gap-2 text-sm">
                <span className="w-4 text-right font-medium">{star}</span>
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400 shrink-0" />
                <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-yellow-400 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-6 text-right text-muted-foreground">{count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Reviews list */}
      {reviews.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {isRtl ? "لا توجد تقييمات بعد" : "No reviews yet"}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {reviews.map((review) => (
            <Card key={review.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{review.customerName || (isRtl ? "عميل" : "Customer")}</span>
                      {review.customerPhone && (
                        <span className="text-sm text-muted-foreground">{review.customerPhone}</span>
                      )}
                    </div>
                    <StarRating rating={review.rating ?? 0} />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={review.isPublic ? "default" : "secondary"}>
                      {review.isPublic
                        ? isRtl ? "عام" : "Public"
                        : isRtl ? "مخفي" : "Hidden"}
                    </Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() =>
                        togglePublicMutation.mutate({ id: review.id, isPublic: !review.isPublic })
                      }
                      title={review.isPublic ? (isRtl ? "إخفاء" : "Hide") : (isRtl ? "إظهار" : "Show")}
                    >
                      {review.isPublic ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {review.comment && (
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground">{review.comment}</p>
                </CardContent>
              )}
              <div className="px-6 pb-3 flex items-center justify-between text-xs text-muted-foreground">
                {review.orderId && (
                  <span>{isRtl ? "رقم الطلب:" : "Order:"} #{review.orderId}</span>
                )}
                <span>
                  {review.createdAt
                    ? new Date(review.createdAt).toLocaleDateString(isRtl ? "ar-SA" : "en-US")
                    : ""}
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

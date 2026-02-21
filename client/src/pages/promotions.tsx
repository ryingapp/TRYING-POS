import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";
import { useBranch } from "@/lib/branch";
import { Tag, Percent, Gift, Plus, Copy, Trash2, Edit } from "lucide-react";
import { format } from "date-fns";

interface Promotion {
  id: string;
  restaurantId: string;
  nameEn: string;
  nameAr: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  discountType: string;
  discountValue: string;
  minOrderAmount: string | null;
  maxDiscountAmount: string | null;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
}

interface Coupon {
  id: string;
  restaurantId: string;
  code: string;
  discountType: string;
  discountValue: string;
  minOrderAmount: string | null;
  maxDiscountAmount: string | null;
  usageLimit: number | null;
  usageCount: number;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  createdAt: string;
}

export default function PromotionsPage() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedBranchId } = useBranch();
  const branchParam = selectedBranchId ? `?branch=${selectedBranchId}` : "";
  const [isPromoDialogOpen, setIsPromoDialogOpen] = useState(false);
  const [isCouponDialogOpen, setIsCouponDialogOpen] = useState(false);

  const [promoFormData, setPromoFormData] = useState({
    nameEn: "",
    nameAr: "",
    descriptionEn: "",
    descriptionAr: "",
    discountType: "percentage",
    discountValue: "",
    minOrderAmount: "",
    maxDiscountAmount: "",
    startDate: format(new Date(), "yyyy-MM-dd"),
    endDate: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
    isActive: true,
  });

  const [couponFormData, setCouponFormData] = useState({
    code: "",
    discountType: "percentage",
    discountValue: "",
    minOrderAmount: "",
    maxDiscountAmount: "",
    usageLimit: "",
    validFrom: format(new Date(), "yyyy-MM-dd"),
    validUntil: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
    isActive: true,
  });

  // Fetch promotions
  const { data: promotions = [], isLoading: loadingPromos } = useQuery<Promotion[]>({
    queryKey: [`/api/promotions${branchParam}`],
  });

  // Fetch coupons
  const { data: coupons = [], isLoading: loadingCoupons } = useQuery<Coupon[]>({
    queryKey: ["/api/coupons"],
  });

  // Create promotion
  const createPromoMutation = useMutation({
    mutationFn: async (data: typeof promoFormData) => {
      const response = await fetch("/api/promotions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          restaurantId: "default",
          discountValue: parseFloat(data.discountValue),
          minOrderAmount: data.minOrderAmount ? parseFloat(data.minOrderAmount) : null,
          maxDiscountAmount: data.maxDiscountAmount ? parseFloat(data.maxDiscountAmount) : null,
        }),
      });
      if (!response.ok) throw new Error("Failed to create promotion");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promotions"] });
      setIsPromoDialogOpen(false);
      toast({
        title: language === "ar" ? "تم الحفظ" : "Saved",
        description: language === "ar" ? "تم إنشاء العرض بنجاح" : "Promotion created successfully",
      });
    },
  });

  // Create coupon
  const createCouponMutation = useMutation({
    mutationFn: async (data: typeof couponFormData) => {
      const response = await fetch("/api/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          restaurantId: "default",
          discountValue: parseFloat(data.discountValue),
          minOrderAmount: data.minOrderAmount ? parseFloat(data.minOrderAmount) : null,
          maxDiscountAmount: data.maxDiscountAmount ? parseFloat(data.maxDiscountAmount) : null,
          usageLimit: data.usageLimit ? parseInt(data.usageLimit) : null,
        }),
      });
      if (!response.ok) throw new Error("Failed to create coupon");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
      setIsCouponDialogOpen(false);
      toast({
        title: language === "ar" ? "تم الحفظ" : "Saved",
        description: language === "ar" ? "تم إنشاء الكوبون بنجاح" : "Coupon created successfully",
      });
    },
  });

  // Delete promotion
  const deletePromoMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/promotions/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/promotions"] });
      toast({ title: language === "ar" ? "تم الحذف" : "Deleted" });
    },
  });

  // Delete coupon
  const deleteCouponMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/coupons/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
      toast({ title: language === "ar" ? "تم الحذف" : "Deleted" });
    },
  });

  const generateCouponCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCouponFormData({ ...couponFormData, code });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: language === "ar" ? "تم النسخ" : "Copied",
      description: text,
    });
  };

  const activePromos = promotions.filter(p => p.isActive);
  const activeCoupons = coupons.filter(c => c.isActive);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">
          {language === "ar" ? "العروض والكوبونات" : "Promotions & Coupons"}
        </h1>
        <p className="text-muted-foreground">
          {language === "ar" ? "إدارة العروض الترويجية وأكواد الخصم" : "Manage promotional offers and discount codes"}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "ar" ? "العروض النشطة" : "Active Promotions"}
            </CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activePromos.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "ar" ? "الكوبونات النشطة" : "Active Coupons"}
            </CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCoupons.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "ar" ? "إجمالي الاستخدامات" : "Total Usage"}
            </CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {coupons.reduce((sum, c) => sum + c.usageCount, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "ar" ? "إجمالي الكوبونات" : "Total Coupons"}
            </CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{coupons.length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="promotions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="promotions">
            {language === "ar" ? "العروض" : "Promotions"}
          </TabsTrigger>
          <TabsTrigger value="coupons">
            {language === "ar" ? "الكوبونات" : "Coupons"}
          </TabsTrigger>
        </TabsList>

        {/* Promotions Tab */}
        <TabsContent value="promotions">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{language === "ar" ? "العروض الترويجية" : "Promotions"}</CardTitle>
              <Dialog open={isPromoDialogOpen} onOpenChange={setIsPromoDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    {language === "ar" ? "عرض جديد" : "New Promotion"}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{language === "ar" ? "عرض جديد" : "New Promotion"}</DialogTitle>
                  </DialogHeader>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      createPromoMutation.mutate(promoFormData);
                    }}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{language === "ar" ? "الاسم (إنجليزي)" : "Name (English)"}</Label>
                        <Input
                          value={promoFormData.nameEn}
                          onChange={(e) => setPromoFormData({ ...promoFormData, nameEn: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{language === "ar" ? "الاسم (عربي)" : "Name (Arabic)"}</Label>
                        <Input
                          value={promoFormData.nameAr}
                          onChange={(e) => setPromoFormData({ ...promoFormData, nameAr: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{language === "ar" ? "نوع الخصم" : "Discount Type"}</Label>
                        <Select
                          value={promoFormData.discountType}
                          onValueChange={(value) => setPromoFormData({ ...promoFormData, discountType: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage">{language === "ar" ? "نسبة مئوية" : "Percentage"}</SelectItem>
                            <SelectItem value="fixed">{language === "ar" ? "مبلغ ثابت" : "Fixed Amount"}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{language === "ar" ? "قيمة الخصم" : "Discount Value"}</Label>
                        <Input
                          type="number"
                          value={promoFormData.discountValue}
                          onChange={(e) => setPromoFormData({ ...promoFormData, discountValue: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{language === "ar" ? "تاريخ البداية" : "Start Date"}</Label>
                        <Input
                          type="date"
                          value={promoFormData.startDate}
                          onChange={(e) => setPromoFormData({ ...promoFormData, startDate: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{language === "ar" ? "تاريخ النهاية" : "End Date"}</Label>
                        <Input
                          type="date"
                          value={promoFormData.endDate}
                          onChange={(e) => setPromoFormData({ ...promoFormData, endDate: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={promoFormData.isActive}
                        onCheckedChange={(checked) => setPromoFormData({ ...promoFormData, isActive: checked })}
                      />
                      <Label>{language === "ar" ? "نشط" : "Active"}</Label>
                    </div>
                    <Button type="submit" className="w-full" disabled={createPromoMutation.isPending}>
                      {createPromoMutation.isPending ? "..." : (language === "ar" ? "حفظ" : "Save")}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {loadingPromos ? (
                <div className="text-center py-8">{language === "ar" ? "جاري التحميل..." : "Loading..."}</div>
              ) : promotions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {language === "ar" ? "لا توجد عروض" : "No promotions"}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{language === "ar" ? "العرض" : "Promotion"}</TableHead>
                      <TableHead>{language === "ar" ? "الخصم" : "Discount"}</TableHead>
                      <TableHead>{language === "ar" ? "الفترة" : "Period"}</TableHead>
                      <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                      <TableHead>{language === "ar" ? "إجراءات" : "Actions"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {promotions.map((promo) => (
                      <TableRow key={promo.id}>
                        <TableCell>
                          <div className="font-medium">{language === "ar" ? promo.nameAr : promo.nameEn}</div>
                        </TableCell>
                        <TableCell>
                          {promo.discountType === "percentage"
                            ? `${promo.discountValue}%`
                            : `${promo.discountValue} ${language === "ar" ? "ريال" : "SAR"}`}
                        </TableCell>
                        <TableCell>
                          {promo.startDate} - {promo.endDate}
                        </TableCell>
                        <TableCell>
                          <Badge variant={promo.isActive ? "default" : "secondary"}>
                            {promo.isActive ? (language === "ar" ? "نشط" : "Active") : (language === "ar" ? "غير نشط" : "Inactive")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => { if (window.confirm('هل أنت متأكد من حذف هذا العرض؟')) deletePromoMutation.mutate(promo.id); }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Coupons Tab */}
        <TabsContent value="coupons">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{language === "ar" ? "أكواد الخصم" : "Discount Codes"}</CardTitle>
              <Dialog open={isCouponDialogOpen} onOpenChange={setIsCouponDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    {language === "ar" ? "كوبون جديد" : "New Coupon"}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{language === "ar" ? "كوبون جديد" : "New Coupon"}</DialogTitle>
                  </DialogHeader>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      createCouponMutation.mutate(couponFormData);
                    }}
                    className="space-y-4"
                  >
                    <div className="space-y-2">
                      <Label>{language === "ar" ? "كود الخصم" : "Coupon Code"}</Label>
                      <div className="flex gap-2">
                        <Input
                          value={couponFormData.code}
                          onChange={(e) => setCouponFormData({ ...couponFormData, code: e.target.value.toUpperCase() })}
                          required
                        />
                        <Button type="button" variant="outline" onClick={generateCouponCode}>
                          {language === "ar" ? "توليد" : "Generate"}
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{language === "ar" ? "نوع الخصم" : "Discount Type"}</Label>
                        <Select
                          value={couponFormData.discountType}
                          onValueChange={(value) => setCouponFormData({ ...couponFormData, discountType: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="percentage">{language === "ar" ? "نسبة مئوية" : "Percentage"}</SelectItem>
                            <SelectItem value="fixed">{language === "ar" ? "مبلغ ثابت" : "Fixed Amount"}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>{language === "ar" ? "قيمة الخصم" : "Discount Value"}</Label>
                        <Input
                          type="number"
                          value={couponFormData.discountValue}
                          onChange={(e) => setCouponFormData({ ...couponFormData, discountValue: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{language === "ar" ? "الحد الأدنى للطلب" : "Min Order Amount"}</Label>
                        <Input
                          type="number"
                          value={couponFormData.minOrderAmount}
                          onChange={(e) => setCouponFormData({ ...couponFormData, minOrderAmount: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{language === "ar" ? "الحد الأقصى للخصم" : "Max Discount"}</Label>
                        <Input
                          type="number"
                          value={couponFormData.maxDiscountAmount}
                          onChange={(e) => setCouponFormData({ ...couponFormData, maxDiscountAmount: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>{language === "ar" ? "عدد مرات الاستخدام" : "Usage Limit"}</Label>
                      <Input
                        type="number"
                        value={couponFormData.usageLimit}
                        onChange={(e) => setCouponFormData({ ...couponFormData, usageLimit: e.target.value })}
                        placeholder={language === "ar" ? "بدون حد" : "Unlimited"}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>{language === "ar" ? "صالح من" : "Valid From"}</Label>
                        <Input
                          type="date"
                          value={couponFormData.validFrom}
                          onChange={(e) => setCouponFormData({ ...couponFormData, validFrom: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{language === "ar" ? "صالح حتى" : "Valid Until"}</Label>
                        <Input
                          type="date"
                          value={couponFormData.validUntil}
                          onChange={(e) => setCouponFormData({ ...couponFormData, validUntil: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <Button type="submit" className="w-full" disabled={createCouponMutation.isPending}>
                      {createCouponMutation.isPending ? "..." : (language === "ar" ? "حفظ" : "Save")}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {loadingCoupons ? (
                <div className="text-center py-8">{language === "ar" ? "جاري التحميل..." : "Loading..."}</div>
              ) : coupons.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {language === "ar" ? "لا توجد كوبونات" : "No coupons"}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{language === "ar" ? "الكود" : "Code"}</TableHead>
                      <TableHead>{language === "ar" ? "الخصم" : "Discount"}</TableHead>
                      <TableHead>{language === "ar" ? "الاستخدام" : "Usage"}</TableHead>
                      <TableHead>{language === "ar" ? "الصلاحية" : "Validity"}</TableHead>
                      <TableHead>{language === "ar" ? "الحالة" : "Status"}</TableHead>
                      <TableHead>{language === "ar" ? "إجراءات" : "Actions"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coupons.map((coupon) => (
                      <TableRow key={coupon.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="bg-muted px-2 py-1 rounded font-mono">{coupon.code}</code>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copyToClipboard(coupon.code)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          {coupon.discountType === "percentage"
                            ? `${coupon.discountValue}%`
                            : `${coupon.discountValue} ${language === "ar" ? "ريال" : "SAR"}`}
                        </TableCell>
                        <TableCell>
                          {coupon.usageCount} / {coupon.usageLimit || "∞"}
                        </TableCell>
                        <TableCell>
                          {coupon.validFrom} - {coupon.validUntil}
                        </TableCell>
                        <TableCell>
                          <Badge variant={coupon.isActive ? "default" : "secondary"}>
                            {coupon.isActive ? (language === "ar" ? "نشط" : "Active") : (language === "ar" ? "غير نشط" : "Inactive")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteCouponMutation.mutate(coupon.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/lib/i18n";
import {
  ArrowLeft, ArrowRight, ShoppingCart, Plus, Minus, Flame, Leaf, Sparkles, Star, Clock, MapPin, Globe, ChefHat, Share2,
} from "lucide-react";
import type { MenuItem, Category } from "@shared/schema";

interface SelectedCustomization {
  groupId: string;
  optionId: string;
  nameEn: string;
  nameAr: string;
  priceAdjustment: number;
}

interface SelectedVariant {
  id: string;
  nameEn: string;
  nameAr: string;
  priceAdjustment: number;
}

export default function MenuItemDetailPage() {
  const params = useParams<{ restaurantId: string; itemId: string }>();
  const [, setLocation] = useLocation();
  const { t, direction, language, setLanguage, getLocalizedName } = useLanguage();

  const restaurantId = params.restaurantId;
  const itemId = params.itemId;
  const apiBase = `/api/public/${restaurantId}`;

  const [variant, setVariant] = useState<SelectedVariant | null>(null);
  const [customizations, setCustomizations] = useState<SelectedCustomization[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [menuDark] = useState(() => { try { return localStorage.getItem('menu_theme') !== 'light'; } catch { return true; } });
  const d = menuDark;

  const { data: restaurant } = useQuery<any>({
    queryKey: [`${apiBase}/restaurant`],
  });

  const { data: menuItems, isLoading: itemsLoading } = useQuery<MenuItem[]>({
    queryKey: [`${apiBase}/menu-items`],
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: [`${apiBase}/categories`],
  });

  const { data: allVariants } = useQuery<Record<string, any[]>>({
    queryKey: [`${apiBase}/all-variants`],
  });

  const { data: allCustomizations } = useQuery<Record<string, any[]>>({
    queryKey: [`${apiBase}/all-customizations`],
  });

  const item = menuItems?.find((i) => i.id === itemId);
  const variants = allVariants?.[itemId || ""] || [];
  const custGroups = allCustomizations?.[itemId || ""] || [];
  const category = categories?.find((c) => c.id === item?.categoryId);

  // Related items from same category
  const relatedItems = menuItems
    ?.filter((i) => i.categoryId === item?.categoryId && i.id !== itemId && i.isAvailable)
    ?.slice(0, 4);

  // Set default variant
  useEffect(() => {
    if (variants.length > 0 && !variant) {
      const first = variants[0];
      setVariant({
        id: first.id,
        nameEn: first.nameEn,
        nameAr: first.nameAr,
        priceAdjustment: parseFloat(first.priceAdjustment || "0"),
      });
    }
  }, [variants, variant]);

  const basePrice = item ? parseFloat(item.price) : 0;
  const variantAdj = variant?.priceAdjustment || 0;
  const custAdj = customizations.reduce((s, c) => s + c.priceAdjustment, 0);
  const unitPrice = basePrice + variantAdj + custAdj;
  const totalPrice = unitPrice * quantity;

  const handleAddToCart = () => {
    if (!item) return;
    // Store in localStorage for transfer to customer-menu page
    const cartKey = `${item.id}_${variant?.id || "none"}_${customizations.map(c => c.optionId).sort().join(",")}`;
    const cartAdd = {
      menuItem: item,
      quantity,
      notes: "",
      cartKey,
      selectedVariant: variant,
      selectedCustomizations: [...customizations],
    };
    // Store pending cart item
    const existing = localStorage.getItem(`cart_${restaurantId}`);
    let cartItems = existing ? JSON.parse(existing) : [];
    const existingIdx = cartItems.findIndex((c: any) => c.cartKey === cartKey);
    if (existingIdx >= 0) {
      cartItems[existingIdx].quantity += quantity;
    } else {
      cartItems.push(cartAdd);
    }
    localStorage.setItem(`cart_${restaurantId}`, JSON.stringify(cartItems));
    // Navigate back to menu
    setLocation(`/m/${restaurantId}/menu`);
  };

  const handleShare = async () => {
    const url = window.location.href;
    const name = item ? getLocalizedName(item.nameEn, item.nameAr) : "";
    if (navigator.share) {
      try {
        await navigator.share({ title: name, url });
      } catch {}
    } else {
      navigator.clipboard.writeText(url);
    }
  };

  if (itemsLoading) {
    return (
      <div className={`min-h-screen ${d ? 'bg-[#0a0a0a]' : 'bg-[#faf9f7]'}`} dir={direction}>
        <Skeleton className={`h-64 sm:h-72 w-full rounded-none ${d ? 'bg-white/[0.04]' : 'bg-gray-200/70'}`} />
        <div className="max-w-2xl mx-auto px-5 py-6 space-y-4">
          <Skeleton className={`h-8 w-3/4 ${d ? 'bg-white/[0.04]' : 'bg-gray-200/70'}`} />
          <Skeleton className={`h-5 w-1/2 ${d ? 'bg-white/[0.04]' : 'bg-gray-200/70'}`} />
          <Skeleton className={`h-20 w-full ${d ? 'bg-white/[0.04]' : 'bg-gray-200/70'}`} />
          <Skeleton className={`h-12 w-full rounded-2xl ${d ? 'bg-white/[0.04]' : 'bg-gray-200/70'}`} />
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className={`min-h-screen ${d ? 'bg-[#0a0a0a]' : 'bg-[#faf9f7]'} flex items-center justify-center`} dir={direction}>
        <div className="text-center">
          <ChefHat className={`h-16 w-16 ${d ? 'text-white/15' : 'text-gray-300'} mx-auto mb-4`} />
          <h2 className={`text-xl font-bold ${d ? 'text-white/60' : 'text-gray-600'}`}>
            {language === "ar" ? "الصنف غير موجود" : "Item not found"}
          </h2>
          <Button variant="outline" className={`mt-4 rounded-xl ${d ? 'border-white/[0.08] text-white/70 hover:bg-white/[0.05]' : 'border-gray-200/60 text-gray-600 hover:bg-gray-100'}`} onClick={() => setLocation(`/m/${restaurantId}/menu`)}>
            {language === "ar" ? "العودة للقائمة" : "Back to Menu"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${d ? 'bg-[#0a0a0a]' : 'bg-[#faf9f7]'} pb-32`} dir={direction}>
      {/* Hero Image */}
      <div className="relative">
        {item.image ? (
          <div className="h-64 sm:h-72 w-full overflow-hidden">
            <img src={item.image} alt={getLocalizedName(item.nameEn, item.nameAr)} className="w-full h-full object-cover" />
            <div className={`absolute inset-0 bg-gradient-to-t ${d ? 'from-[#0a0a0a] via-[#0a0a0a]/20' : 'from-[#faf9f7] via-transparent'} to-black/10`} />
          </div>
        ) : (
          <div className={`h-52 sm:h-64 w-full relative ${d ? 'bg-gradient-to-br from-[#1a0a0a] to-[#0a0a0a]' : 'bg-gradient-to-br from-[#8B1A1A] to-[#a02020]'} flex items-center justify-center overflow-hidden`}>
          <div className="absolute inset-0 overflow-hidden">
              <div className={`absolute -top-20 -right-20 w-48 h-48 rounded-full ${d ? 'bg-[#8B1A1A]/15' : 'bg-white/10'} blur-[60px]`} />
            </div>
            <span className={`text-[120px] font-black ${d ? 'text-white/[0.04]' : 'text-white/15'} select-none relative z-10`}>
              {getLocalizedName(item.nameEn, item.nameAr).charAt(0)}
            </span>
          </div>
        )}

        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 p-3.5 flex items-center justify-between z-10">
          <button
            onClick={() => setLocation(`/m/${restaurantId}/menu`)}
            className="w-10 h-10 rounded-xl bg-black/25 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-black/40 transition-colors"
          >
            {direction === "rtl" ? <ArrowRight className="h-5 w-5 text-white" /> : <ArrowLeft className="h-5 w-5 text-white" />}
          </button>
          <div className="flex gap-1.5">
            <button
              onClick={handleShare}
              className="w-10 h-10 rounded-xl bg-black/25 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-black/40 transition-colors"
            >
              <Share2 className="h-4 w-4 text-white" />
            </button>
            <button
              onClick={() => setLanguage(language === "ar" ? "en" : "ar")}
              className="w-10 h-10 rounded-xl bg-black/25 backdrop-blur-md flex items-center justify-center border border-white/10 hover:bg-black/40 transition-colors"
            >
              <Globe className="h-4 w-4 text-white" />
            </button>
          </div>
        </div>

        {/* Floating badges */}
        <div className="absolute bottom-5 left-4 flex gap-2">
          {item.isNew && (
            <span className="inline-flex items-center gap-1 bg-emerald-500/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg backdrop-blur-sm">
              <Sparkles className="h-2.5 w-2.5" /> {language === "ar" ? "جديد" : "New"}
            </span>
          )}
          {item.isBestseller && (
            <span className="inline-flex items-center gap-1 bg-amber-500/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg backdrop-blur-sm">
              <Star className="h-2.5 w-2.5 fill-current" /> {language === "ar" ? "مميز" : "Popular"}
            </span>
          )}
        </div>
      </div>

      {/* Content Card */}
      <div className="max-w-2xl mx-auto px-4 -mt-6 relative z-10">
        <div className={`${d ? 'bg-white/[0.03] border-white/[0.05]' : 'bg-white border-gray-100'} rounded-2xl border p-5 sm:p-6 shadow-sm`}>
          {/* Category */}
          {category && (
            <span className="text-[10px] font-bold text-[#8B1A1A] uppercase tracking-wider">
              {getLocalizedName(category.nameEn, category.nameAr)}
            </span>
          )}

          {/* Name & Price */}
          <h1 className={`text-xl sm:text-2xl font-bold ${d ? 'text-white' : 'text-gray-900'} mt-1 leading-tight`}>
            {getLocalizedName(item.nameEn, item.nameAr)}
          </h1>

          <div className="flex items-center gap-3 mt-3">
            <p className={`text-xl font-bold ${d ? 'text-white' : 'text-gray-900'} tabular-nums`}>
              {unitPrice.toFixed(2)} <span className={`text-sm font-normal ${d ? 'text-white/35' : 'text-gray-400'}`}>{t("sar")}</span>
            </p>
            <div className="flex gap-2">
              {item.isSpicy && (
                <span className={`w-8 h-8 rounded-xl ${d ? 'bg-red-500/10 border border-red-500/15' : 'bg-red-50 border border-red-100'} flex items-center justify-center`}>
                  <Flame className="h-4 w-4 text-red-400" />
                </span>
              )}
              {item.isVegetarian && (
                <span className={`w-8 h-8 rounded-xl ${d ? 'bg-green-500/10 border border-green-500/15' : 'bg-green-50 border border-green-100'} flex items-center justify-center`}>
                  <Leaf className="h-4 w-4 text-green-400" />
                </span>
              )}
            </div>
            {item.calories && (
              <span className={`text-xs font-bold ${d ? 'text-white/30 bg-white/[0.04] border border-white/[0.05]' : 'text-gray-400 bg-gray-50 border border-gray-100'} px-3 py-1.5 rounded-xl`}>
                {item.calories} {t("calories")}
              </span>
            )}
          </div>

          {/* Description */}
          {(item.descriptionEn || item.descriptionAr) && (
            <p className={`${d ? 'text-white/40' : 'text-gray-500'} mt-5 leading-relaxed text-[15px]`}>
              {getLocalizedName(item.descriptionEn || "", item.descriptionAr || "")}
            </p>
          )}

          {/* Tags */}
          <div className="flex flex-wrap gap-2 mt-5">
            {item.isSpicy && (
              <span className={`inline-flex items-center gap-1.5 text-red-400 ${d ? 'bg-red-500/10 border border-red-500/15' : 'bg-red-50 border border-red-100'} rounded-xl text-xs font-bold px-3 py-1.5`}>
                <Flame className="h-3 w-3" />{language === "ar" ? "حار" : "Spicy"}
              </span>
            )}
            {item.isVegetarian && (
              <span className={`inline-flex items-center gap-1.5 text-green-400 ${d ? 'bg-green-500/10 border border-green-500/15' : 'bg-green-50 border border-green-100'} rounded-xl text-xs font-bold px-3 py-1.5`}>
                <Leaf className="h-3 w-3" />{language === "ar" ? "نباتي" : "Vegetarian"}
              </span>
            )}
          </div>

          {/* Variants */}
          {variants.length > 0 && (
            <div className="mt-6 space-y-3">
              <h3 className={`font-bold text-sm ${d ? 'text-white' : 'text-gray-900'}`}>{language === "ar" ? "اختر الحجم" : "Choose Size"}</h3>
              <RadioGroup
                value={variant?.id || ""}
                onValueChange={(val) => {
                  const v = variants.find((vr: any) => vr.id === val);
                  if (v) setVariant({ id: v.id, nameEn: v.nameEn, nameAr: v.nameAr, priceAdjustment: parseFloat(v.priceAdjustment || "0") });
                }}
                className="space-y-2"
              >
                {variants.map((v: any) => (
                  <div
                    key={v.id}
                    className={`flex items-center justify-between rounded-xl p-3.5 cursor-pointer transition-all duration-200 ${variant?.id === v.id ? "bg-[#8B1A1A]/15 ring-2 ring-[#8B1A1A]" : d ? "bg-white/5 ring-1 ring-white/10 hover:ring-[#8B1A1A]/50" : "bg-gray-50 ring-1 ring-gray-200 hover:ring-[#8B1A1A]/50"}`}
                    onClick={() => setVariant({ id: v.id, nameEn: v.nameEn, nameAr: v.nameAr, priceAdjustment: parseFloat(v.priceAdjustment || "0") })}
                  >
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value={v.id} id={`v-${v.id}`} className={`${d ? 'border-white/20' : 'border-gray-300'} text-[#8B1A1A] data-[state=checked]:border-[#8B1A1A]`} />
                      <Label htmlFor={`v-${v.id}`} className={`cursor-pointer font-medium text-sm ${d ? 'text-white/80' : 'text-gray-700'}`}>{getLocalizedName(v.nameEn, v.nameAr)}</Label>
                    </div>
                    <span className={`text-sm font-semibold ${d ? 'text-white/70' : 'text-gray-600'}`}>
                      {parseFloat(v.priceAdjustment || "0") > 0 ? `+${parseFloat(v.priceAdjustment).toFixed(2)}` : parseFloat(v.priceAdjustment || "0") < 0 ? parseFloat(v.priceAdjustment).toFixed(2) : (language === "ar" ? "مجاناً" : "Free")} {parseFloat(v.priceAdjustment || "0") !== 0 ? t("sar") : ""}
                    </span>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}

          {/* Customizations */}
          {custGroups.map((group: any) => (
            <div key={group.id} className="mt-6 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className={`font-bold text-sm ${d ? 'text-white' : 'text-gray-900'}`}>{getLocalizedName(group.nameEn, group.nameAr)}</h3>
                {group.isRequired && (
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-[#8B1A1A] text-white rounded-md">{language === "ar" ? "مطلوب" : "Required"}</span>
                )}
              </div>
              {group.selectionType === "single" ? (
                <RadioGroup
                  value={customizations.find(c => c.groupId === group.id)?.optionId || ""}
                  onValueChange={(val) => {
                    const opt = group.options?.find((o: any) => o.id === val);
                    if (opt) {
                      setCustomizations(prev => [
                        ...prev.filter(c => c.groupId !== group.id),
                        { groupId: group.id, optionId: opt.id, nameEn: opt.nameEn, nameAr: opt.nameAr, priceAdjustment: parseFloat(opt.priceAdjustment || "0") },
                      ]);
                    }
                  }}
                  className="space-y-2"
                >
                  {group.options?.map((opt: any) => (
                    <div
                      key={opt.id}
                      className={`flex items-center justify-between rounded-xl p-3.5 cursor-pointer transition-all duration-200 ${customizations.find(c => c.optionId === opt.id) ? "bg-[#8B1A1A]/15 ring-2 ring-[#8B1A1A]" : d ? "bg-white/5 ring-1 ring-white/10 hover:ring-[#8B1A1A]/50" : "bg-gray-50 ring-1 ring-gray-200 hover:ring-[#8B1A1A]/50"}`}
                      onClick={() => {
                        setCustomizations(prev => [
                          ...prev.filter(c => c.groupId !== group.id),
                          { groupId: group.id, optionId: opt.id, nameEn: opt.nameEn, nameAr: opt.nameAr, priceAdjustment: parseFloat(opt.priceAdjustment || "0") },
                        ]);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value={opt.id} id={`o-${opt.id}`} className={`${d ? 'border-white/20' : 'border-gray-300'} text-[#8B1A1A] data-[state=checked]:border-[#8B1A1A]`} />
                        <Label htmlFor={`o-${opt.id}`} className={`cursor-pointer text-sm ${d ? 'text-white/80' : 'text-gray-700'}`}>{getLocalizedName(opt.nameEn, opt.nameAr)}</Label>
                      </div>
                      {parseFloat(opt.priceAdjustment || "0") !== 0 && (
                        <span className={`text-sm font-semibold ${d ? 'text-white/70' : 'text-gray-600'}`}>+{parseFloat(opt.priceAdjustment).toFixed(2)} {t("sar")}</span>
                      )}
                    </div>
                  ))}
                </RadioGroup>
              ) : (
                <div className="space-y-2">
                  {group.options?.map((opt: any) => {
                    const isChecked = customizations.some(c => c.optionId === opt.id);
                    return (
                      <div
                        key={opt.id}
                        className={`flex items-center justify-between rounded-xl p-3.5 cursor-pointer transition-all duration-200 ${isChecked ? "bg-[#8B1A1A]/15 ring-2 ring-[#8B1A1A]" : d ? "bg-white/5 ring-1 ring-white/10 hover:ring-[#8B1A1A]/50" : "bg-gray-50 ring-1 ring-gray-200 hover:ring-[#8B1A1A]/50"}`}
                        onClick={() => {
                          setCustomizations(prev =>
                            isChecked
                              ? prev.filter(c => c.optionId !== opt.id)
                              : [...prev, { groupId: group.id, optionId: opt.id, nameEn: opt.nameEn, nameAr: opt.nameAr, priceAdjustment: parseFloat(opt.priceAdjustment || "0") }]
                          );
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox checked={isChecked} id={`c-${opt.id}`} className={`${d ? 'border-white/20' : 'border-gray-300'} data-[state=checked]:bg-[#8B1A1A] data-[state=checked]:border-[#8B1A1A]`} />
                          <Label htmlFor={`c-${opt.id}`} className={`cursor-pointer text-sm ${d ? 'text-white/80' : 'text-gray-700'}`}>{getLocalizedName(opt.nameEn, opt.nameAr)}</Label>
                        </div>
                        {parseFloat(opt.priceAdjustment || "0") !== 0 && (
                          <span className={`text-sm font-semibold ${d ? 'text-white/70' : 'text-gray-600'}`}>+{parseFloat(opt.priceAdjustment).toFixed(2)} {t("sar")}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Related items */}
        {relatedItems && relatedItems.length > 0 && (
          <div className="mt-7">
            <h3 className={`text-sm font-bold ${d ? 'text-white' : 'text-gray-900'} mb-3`}>
              {language === "ar" ? "أصناف مشابهة" : "You might also like"}
            </h3>
            <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-2">
              {relatedItems.map((r) => (
                <div
                  key={r.id}
                  onClick={() => {
                    setVariant(null);
                    setCustomizations([]);
                    setQuantity(1);
                    setLocation(`/m/${restaurantId}/item/${r.id}`);
                  }}
                  className={`flex-shrink-0 w-36 ${d ? 'bg-white/[0.03] border-white/[0.04]' : 'bg-white border-gray-100 hover:shadow-sm'} rounded-xl overflow-hidden border cursor-pointer transition-all`}
                >
                  {r.image ? (
                    <img src={r.image} alt="" className="w-full h-24 object-cover" />
                  ) : (
                    <div className={`w-full h-24 ${d ? 'bg-gradient-to-br from-[#8B1A1A]/10 to-transparent' : 'bg-gradient-to-br from-[#8B1A1A]/5 to-gray-50'} flex items-center justify-center`}>
                      <span className={`text-2xl font-bold ${d ? 'text-white/[0.06]' : 'text-gray-200'}`}>{getLocalizedName(r.nameEn, r.nameAr).charAt(0)}</span>
                    </div>
                  )}
                  <div className="p-2.5">
                    <p className={`text-[11px] font-semibold line-clamp-1 ${d ? 'text-white/90' : 'text-gray-900'}`}>{getLocalizedName(r.nameEn, r.nameAr)}</p>
                    <p className={`text-[11px] font-bold ${d ? 'text-[#e88]' : 'text-[#8B1A1A]'} mt-0.5 tabular-nums`}>{parseFloat(r.price).toFixed(2)} {t("sar")}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fixed bottom bar */}
      {item.isAvailable && (
        <div className={`fixed bottom-0 left-0 right-0 z-30 ${d ? 'bg-[#0a0a0a]/95 border-white/[0.04]' : 'bg-white/95 border-gray-100'} backdrop-blur-xl border-t px-4 pb-5 pt-3`}>
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            {/* Quantity */}
            <div className={`flex items-center gap-0 ${d ? 'bg-white/[0.04] border-white/[0.06]' : 'bg-gray-50 border-gray-100'} rounded-xl p-1 border`}>
              <button className={`h-10 w-10 rounded-lg flex items-center justify-center ${d ? 'text-white/60 hover:bg-white/10 active:scale-95' : 'text-gray-500 hover:bg-gray-100 active:scale-95'} transition-colors`} onClick={() => setQuantity(Math.max(1, quantity - 1))}>
                <Minus className="h-4 w-4" />
              </button>
              <span className={`text-base font-bold w-10 text-center tabular-nums ${d ? 'text-white' : 'text-gray-900'}`}>{quantity}</span>
              <button className={`h-10 w-10 rounded-lg flex items-center justify-center ${d ? 'text-white/60 hover:bg-white/10 active:scale-95' : 'text-gray-500 hover:bg-gray-100 active:scale-95'} transition-colors`} onClick={() => setQuantity(quantity + 1)}>
                <Plus className="h-4 w-4" />
              </button>
            </div>
            
            {/* Add to cart */}
            <button
              className="flex-1 h-12 rounded-xl bg-[#8B1A1A] hover:bg-[#A02020] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
              onClick={handleAddToCart}
            >
              <ShoppingCart className="h-4.5 w-4.5" />
              {language === "ar" ? "أضف للسلة" : "Add to Cart"} · {totalPrice.toFixed(2)} {t("sar")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

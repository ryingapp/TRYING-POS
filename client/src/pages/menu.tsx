import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Edit2, Trash2, FolderOpen, UtensilsCrossed, Flame, AlertTriangle, Coffee, Footprints, Wheat, Milk, Fish, Egg, Leaf, Star, Sparkles, Settings2, ChevronDown, Package, Beaker, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";
import { useBranch } from "@/lib/branch";
import { queryClient as defaultQueryClient, apiRequest } from "@/lib/queryClient";
import type { Category, MenuItem, InsertCategory, InsertMenuItem, KitchenSection, InventoryItem, Recipe } from "@shared/schema";

// Allergen options
const allergenOptions = [
  { id: "nuts", labelEn: "Nuts", labelAr: "مكسرات", icon: "🥜" },
  { id: "gluten", labelEn: "Gluten", labelAr: "جلوتين", icon: "🌾" },
  { id: "dairy", labelEn: "Dairy", labelAr: "ألبان", icon: "🥛" },
  { id: "eggs", labelEn: "Eggs", labelAr: "بيض", icon: "🥚" },
  { id: "soy", labelEn: "Soy", labelAr: "صويا", icon: "🫘" },
  { id: "fish", labelEn: "Fish", labelAr: "أسماك", icon: "🐟" },
  { id: "shellfish", labelEn: "Shellfish", labelAr: "محار", icon: "🦐" },
  { id: "sesame", labelEn: "Sesame", labelAr: "سمسم", icon: "🌰" },
  { id: "wheat", labelEn: "Wheat", labelAr: "قمح", icon: "🌾" },
];

const categoryFormSchema = z.object({
  nameEn: z.string().min(1, "Required"),
  nameAr: z.string().min(1, "Required"),
  isActive: z.boolean().default(true),
});

const menuItemFormSchema = z.object({
  nameEn: z.string().min(1, "Required"),
  nameAr: z.string().min(1, "Required"),
  descriptionEn: z.string().optional(),
  descriptionAr: z.string().optional(),
  price: z.string().min(1, "Required"),
  categoryId: z.string().min(1, "Required"),
  kitchenSectionId: z.string().optional(),
  image: z.string().optional(),
  isAvailable: z.boolean().default(true),
  prepTime: z.string().optional(),
  // Nutritional Information
  calories: z.string().optional(),
  sugar: z.string().optional(),
  fat: z.string().optional(),
  saturatedFat: z.string().optional(),
  sodium: z.string().optional(),
  protein: z.string().optional(),
  carbs: z.string().optional(),
  fiber: z.string().optional(),
  caffeine: z.string().optional(),
  // Labels
  allergens: z.array(z.string()).default([]),
  isHighSodium: z.boolean().default(false),
  isSpicy: z.boolean().default(false),
  isVegetarian: z.boolean().default(false),
  isVegan: z.boolean().default(false),
  isGlutenFree: z.boolean().default(false),
  isNew: z.boolean().default(false),
  isBestseller: z.boolean().default(false),
  // Burn time
  walkingMinutes: z.string().optional(),
  runningMinutes: z.string().optional(),
});

// Helper function to calculate burn time
function calculateBurnTime(calories: number): { walking: number; running: number } {
  // Average: Walking burns ~4 cal/min, Running burns ~10 cal/min
  return {
    walking: Math.round(calories / 4),
    running: Math.round(calories / 10),
  };
}

function CategoryForm({ 
  category, 
  onSuccess 
}: { 
  category?: Category; 
  onSuccess: () => void;
}) {
  const { t } = useLanguage();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof categoryFormSchema>>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      nameEn: category?.nameEn || "",
      nameAr: category?.nameAr || "",
      isActive: category?.isActive ?? true,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertCategory) => apiRequest("POST", "/api/categories", data),
    onSuccess: () => {
      defaultQueryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: t("categoryCreated") });
      onSuccess();
    },
    onError: () => {
      toast({ title: t("categoryCreateFailed"), variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: InsertCategory) => 
      apiRequest("PUT", `/api/categories/${category?.id}`, data),
    onSuccess: () => {
      defaultQueryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: t("categoryUpdated") });
      onSuccess();
    },
    onError: () => {
      toast({ title: t("categoryUpdateFailed"), variant: "destructive" });
    },
  });

  const onSubmit = (data: z.infer<typeof categoryFormSchema>) => {
    const payload: InsertCategory = {
      ...data,
      restaurantId: "default",
    };
    if (category) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="nameEn"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("nameEn")}</FormLabel>
              <FormControl>
                <Input {...field} data-testid="input-category-name-en" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="nameAr"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("nameAr")}</FormLabel>
              <FormControl>
                <Input {...field} dir="rtl" data-testid="input-category-name-ar" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="isActive"
          render={({ field }) => (
            <FormItem className="flex items-center justify-between">
              <FormLabel>{t("active")}</FormLabel>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  data-testid="switch-category-active"
                />
              </FormControl>
            </FormItem>
          )}
        />
        <Button 
          type="submit" 
          className="w-full" 
          disabled={isPending}
          data-testid="button-save-category"
        >
          {isPending ? "..." : t("save")}
        </Button>
      </form>
    </Form>
  );
}

function MenuItemForm({ 
  item, 
  categories,
  onSuccess 
}: { 
  item?: MenuItem; 
  categories: Category[];
  onSuccess: () => void;
}) {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedBranchId } = useBranch();
  const branchParam = selectedBranchId ? `?branch=${selectedBranchId}` : "";
  const [activeTab, setActiveTab] = useState("basic");
  const [savedItemId, setSavedItemId] = useState<string | null>(item?.id || null);

  // Variant inline form state
  const [showVariantForm, setShowVariantForm] = useState(false);
  const [variantForm, setVariantForm] = useState({ nameEn: "", nameAr: "", priceModifier: "0", isDefault: false, isAvailable: true });

  // Recipe state
  const [recipeIngredient, setRecipeIngredient] = useState({ inventoryItemId: "", quantity: "", unit: "" });

  const itemAny = item as any;

  const form = useForm<z.infer<typeof menuItemFormSchema>>({
    resolver: zodResolver(menuItemFormSchema),
    defaultValues: {
      nameEn: item?.nameEn || "",
      nameAr: item?.nameAr || "",
      descriptionEn: item?.descriptionEn || "",
      descriptionAr: item?.descriptionAr || "",
      price: item?.price?.toString() || "",
      categoryId: item?.categoryId || "",
      kitchenSectionId: (item as any)?.kitchenSectionId || "",
      image: item?.image || "",
      isAvailable: item?.isAvailable ?? true,
      prepTime: item?.prepTime?.toString() || "",
      calories: item?.calories?.toString() || "",
      sugar: itemAny?.sugar?.toString() || "",
      fat: itemAny?.fat?.toString() || "",
      saturatedFat: itemAny?.saturatedFat?.toString() || "",
      sodium: itemAny?.sodium?.toString() || "",
      protein: itemAny?.protein?.toString() || "",
      carbs: itemAny?.carbs?.toString() || "",
      fiber: itemAny?.fiber?.toString() || "",
      caffeine: itemAny?.caffeine?.toString() || "",
      allergens: itemAny?.allergens || [],
      isHighSodium: itemAny?.isHighSodium ?? false,
      isSpicy: itemAny?.isSpicy ?? false,
      isVegetarian: itemAny?.isVegetarian ?? false,
      isVegan: itemAny?.isVegan ?? false,
      isGlutenFree: itemAny?.isGlutenFree ?? false,
      isNew: itemAny?.isNew ?? false,
      isBestseller: itemAny?.isBestseller ?? false,
      walkingMinutes: itemAny?.walkingMinutes?.toString() || "",
      runningMinutes: itemAny?.runningMinutes?.toString() || "",
    },
  });

  // Auto-calculate burn time when calories change
  const watchCalories = form.watch("calories");
  const autoCalculateBurnTime = () => {
    const cal = parseInt(watchCalories || "0");
    if (cal > 0) {
      const burn = calculateBurnTime(cal);
      form.setValue("walkingMinutes", burn.walking.toString());
      form.setValue("runningMinutes", burn.running.toString());
    }
  };

  // ==== Kitchen sections ====
  const { data: kitchenSections } = useQuery<KitchenSection[]>({
    queryKey: [`/api/kitchen-sections${branchParam}`],
  });

  // ==== Variants queries ====
  const { data: variants = [], isLoading: loadingVariants } = useQuery<any[]>({
    queryKey: ["/api/menu-items", savedItemId, "variants"],
    queryFn: async () => {
      if (!savedItemId) return [];
      const response = await fetch(`/api/menu-items/${savedItemId}/variants`);
      return response.json();
    },
    enabled: !!savedItemId,
  });

  // ==== Customization groups & links ====
  const { data: allGroups = [] } = useQuery<any[]>({
    queryKey: ["/api/customization-groups"],
  });

  const { data: itemCustomizations = [], isLoading: loadingCustomizations } = useQuery<any[]>({
    queryKey: ["/api/menu-items", savedItemId, "customizations"],
    queryFn: async () => {
      if (!savedItemId) return [];
      const response = await fetch(`/api/menu-items/${savedItemId}/customizations`);
      return response.json();
    },
    enabled: !!savedItemId,
  });

  const linkedGroupIds = itemCustomizations.map((c: any) => c.customizationGroupId);

  // ==== Mutations ====
  const createMutation = useMutation({
    mutationFn: async (data: InsertMenuItem) => {
      const res = await apiRequest("POST", "/api/menu-items", data);
      return res.json();
    },
    onSuccess: (newItem: any) => {
      defaultQueryClient.invalidateQueries({ queryKey: ["/api/menu-items"] });
      setSavedItemId(newItem.id);
      toast({ title: language === "ar" ? "تم إنشاء الصنف بنجاح" : "Item created successfully" });
      // Switch to variants tab after first save
      setActiveTab("variants");
    },
    onError: () => {
      toast({ title: language === "ar" ? "فشل في إنشاء الصنف" : "Failed to create item", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: InsertMenuItem) => 
      apiRequest("PUT", `/api/menu-items/${savedItemId}`, data),
    onSuccess: () => {
      defaultQueryClient.invalidateQueries({ queryKey: ["/api/menu-items"] });
      toast({ title: language === "ar" ? "تم تحديث الصنف بنجاح" : "Item updated successfully" });
    },
    onError: () => {
      toast({ title: language === "ar" ? "فشل في تحديث الصنف" : "Failed to update item", variant: "destructive" });
    },
  });

  // Variant mutations
  const createVariantMutation = useMutation({
    mutationFn: async (data: typeof variantForm) => {
      const response = await fetch(`/api/menu-items/${savedItemId}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, menuItemId: savedItemId, priceModifier: parseFloat(data.priceModifier) }),
      });
      if (!response.ok) throw new Error("Failed");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu-items", savedItemId, "variants"] });
      setShowVariantForm(false);
      setVariantForm({ nameEn: "", nameAr: "", priceModifier: "0", isDefault: false, isAvailable: true });
      toast({ title: language === "ar" ? "تم إضافة المتغير" : "Variant added" });
    },
  });

  const deleteVariantMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/variants/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu-items", savedItemId, "variants"] });
      toast({ title: language === "ar" ? "تم حذف المتغير" : "Variant deleted" });
    },
  });

  // Customization link/unlink mutations
  const linkCustomizationMutation = useMutation({
    mutationFn: async (groupId: string) => {
      const response = await fetch(`/api/menu-items/${savedItemId}/customizations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menuItemId: savedItemId, customizationGroupId: groupId }),
      });
      if (!response.ok) throw new Error("Failed");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu-items", savedItemId, "customizations"] });
    },
  });

  const unlinkCustomizationMutation = useMutation({
    mutationFn: async (groupId: string) => {
      const response = await fetch(`/api/menu-items/${savedItemId}/customizations/${groupId}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu-items", savedItemId, "customizations"] });
    },
  });

  // ==== Recipe / Ingredients ====
  const { data: recipes = [], isLoading: loadingRecipes } = useQuery<Recipe[]>({
    queryKey: ["/api/menu-items", savedItemId, "recipes"],
    queryFn: async () => {
      if (!savedItemId) return [];
      const response = await fetch(`/api/menu-items/${savedItemId}/recipes`);
      if (!response.ok) throw new Error("Failed to fetch recipes");
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!savedItemId,
  });

  const { data: inventoryItems = [] } = useQuery<InventoryItem[]>({
    queryKey: ["/api/inventory"],
    queryFn: async () => {
      const response = await fetch("/api/inventory");
      if (!response.ok) throw new Error("Failed to fetch inventory");
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!savedItemId,
  });

  const createRecipeMutation = useMutation({
    mutationFn: async (data: { menuItemId: string; inventoryItemId: string; quantity: string; unit: string }) => {
      const res = await fetch("/api/recipes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu-items", savedItemId, "recipes"] });
      setRecipeIngredient({ inventoryItemId: "", quantity: "", unit: "" });
      toast({ title: language === "ar" ? "تمت إضافة المكون" : "Ingredient added" });
    },
    onError: () => {
      toast({ title: language === "ar" ? "فشل في إضافة المكون" : "Failed to add ingredient", variant: "destructive" });
    },
  });

  const deleteRecipeMutation = useMutation({
    mutationFn: async (recipeId: string) => {
      const res = await fetch(`/api/recipes/${recipeId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu-items", savedItemId, "recipes"] });
      toast({ title: language === "ar" ? "تم حذف المكون" : "Ingredient removed" });
    },
  });

  const handleAddIngredient = () => {
    if (!recipeIngredient.inventoryItemId || !recipeIngredient.quantity) return;
    createRecipeMutation.mutate({
      menuItemId: savedItemId!,
      inventoryItemId: recipeIngredient.inventoryItemId,
      quantity: recipeIngredient.quantity,
      unit: recipeIngredient.unit,
    });
  };

  const onSubmit = (data: z.infer<typeof menuItemFormSchema>) => {
    const payload: any = {
      ...data,
      price: data.price,
      restaurantId: "default",
      calories: data.calories ? parseInt(data.calories) : null,
      prepTime: data.prepTime ? parseInt(data.prepTime) : null,
      sugar: data.sugar ? parseFloat(data.sugar) : null,
      fat: data.fat ? parseFloat(data.fat) : null,
      saturatedFat: data.saturatedFat ? parseFloat(data.saturatedFat) : null,
      sodium: data.sodium ? parseFloat(data.sodium) : null,
      protein: data.protein ? parseFloat(data.protein) : null,
      carbs: data.carbs ? parseFloat(data.carbs) : null,
      fiber: data.fiber ? parseFloat(data.fiber) : null,
      caffeine: data.caffeine ? parseFloat(data.caffeine) : null,
      walkingMinutes: data.walkingMinutes ? parseInt(data.walkingMinutes) : null,
      runningMinutes: data.runningMinutes ? parseInt(data.runningMinutes) : null,
    };
    if (savedItemId) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const basePrice = parseFloat(form.watch("price") || "0");

  return (
    <div className="space-y-4">
     <Form {...form}>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="basic" className="text-xs sm:text-sm">
            <UtensilsCrossed className="h-3.5 w-3.5 me-1.5 hidden sm:inline" />
            {language === "ar" ? "أساسي" : "Basic"}
          </TabsTrigger>
          <TabsTrigger value="variants" className="text-xs sm:text-sm" disabled={!savedItemId}>
            <Package className="h-3.5 w-3.5 me-1.5 hidden sm:inline" />
            {language === "ar" ? "الأحجام" : "Variants"}
            {variants.length > 0 && <Badge variant="secondary" className="ms-1.5 h-5 px-1.5 text-[10px]">{variants.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="customizations" className="text-xs sm:text-sm" disabled={!savedItemId}>
            <Settings2 className="h-3.5 w-3.5 me-1.5 hidden sm:inline" />
            {language === "ar" ? "تخصيص" : "Custom"}
            {linkedGroupIds.length > 0 && <Badge variant="secondary" className="ms-1.5 h-5 px-1.5 text-[10px]">{linkedGroupIds.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="recipe" className="text-xs sm:text-sm" disabled={!savedItemId}>
            <Beaker className="h-3.5 w-3.5 me-1.5 hidden sm:inline" />
            {language === "ar" ? "الوصفة" : "Recipe"}
            {recipes.length > 0 && <Badge variant="secondary" className="ms-1.5 h-5 px-1.5 text-[10px]">{recipes.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="nutrition" className="text-xs sm:text-sm">
            <Flame className="h-3.5 w-3.5 me-1.5 hidden sm:inline" />
            {language === "ar" ? "غذائي" : "Nutrition"}
          </TabsTrigger>
        </TabsList>

        {/* ====== TAB 1: Basic Info ====== */}
        <TabsContent value="basic" className="mt-4 space-y-0">
            <div className="space-y-4">
              {/* Names */}
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="nameEn" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "ar" ? "الاسم (إنجليزي)" : "Name (English)"}</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g. Chicken Burger" data-testid="input-item-name-en" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="nameAr" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "ar" ? "الاسم (عربي)" : "Name (Arabic)"}</FormLabel>
                    <FormControl><Input {...field} dir="rtl" placeholder="مثال: برجر دجاج" data-testid="input-item-name-ar" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Descriptions */}
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="descriptionEn" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "ar" ? "الوصف (إنجليزي)" : "Description (EN)"}</FormLabel>
                    <FormControl><Textarea {...field} rows={2} placeholder="Brief description..." data-testid="input-item-desc-en" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="descriptionAr" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "ar" ? "الوصف (عربي)" : "Description (AR)"}</FormLabel>
                    <FormControl><Textarea {...field} dir="rtl" rows={2} placeholder="وصف مختصر..." data-testid="input-item-desc-ar" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Price + Category + Prep Time */}
              <div className="grid grid-cols-3 gap-4">
                <FormField control={form.control} name="price" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "ar" ? "السعر الأساسي (ريال)" : "Base Price (SAR)"}</FormLabel>
                    <FormControl><Input {...field} type="number" step="0.01" data-testid="input-item-price" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="categoryId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("category")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-item-category">
                          <SelectValue placeholder={t("selectCategory")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {language === "ar" ? cat.nameAr : cat.nameEn}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="kitchenSectionId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "ar" ? "قسم المطبخ" : "Kitchen Section"}</FormLabel>
                    <Select value={field.value || "__none__"} onValueChange={(val) => { const v = val === "__none__" ? "" : val; if (v !== field.value) field.onChange(v); }}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={language === "ar" ? "اختياري - لا قسم" : "Optional - No section"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">{language === "ar" ? "لا قسم" : "No section"}</SelectItem>
                        {kitchenSections?.filter(s => s.isActive).map((section) => (
                          <SelectItem key={section.id} value={section.id}>
                            {section.icon && <span className="me-1">{section.icon}</span>}
                            {language === "ar" ? section.nameAr : section.nameEn}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="prepTime" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "ar" ? "وقت التحضير (دقيقة)" : "Prep Time (min)"}</FormLabel>
                    <FormControl><Input {...field} type="number" data-testid="input-item-prep-time" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              {/* Image */}
              <FormField control={form.control} name="image" render={({ field }) => (
                <FormItem>
                  <FormLabel>{language === "ar" ? "صورة الصنف" : "Item Image URL"}</FormLabel>
                  <FormControl><Input {...field} placeholder="https://..." data-testid="input-item-image" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* Availability */}
              <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-2">
                  <div className={`h-2.5 w-2.5 rounded-full ${form.watch("isAvailable") ? "bg-green-500" : "bg-red-500"}`} />
                  <FormLabel className="mb-0">{language === "ar" ? "متاح للطلب" : "Available for ordering"}</FormLabel>
                </div>
                <FormField control={form.control} name="isAvailable" render={({ field }) => (
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-item-available" />
                  </FormControl>
                )} />
              </div>

              <Button type="button" onClick={form.handleSubmit(onSubmit)} className="w-full" disabled={isPending} data-testid="button-save-item">
                {isPending ? "..." : savedItemId ? (language === "ar" ? "تحديث الصنف" : "Update Item") : (language === "ar" ? "حفظ ومتابعة" : "Save & Continue")}
              </Button>
              {!savedItemId && (
                <p className="text-xs text-muted-foreground text-center">
                  {language === "ar" ? "احفظ أولاً لإضافة الأحجام والتخصيصات" : "Save first to add variants & customizations"}
                </p>
              )}
            </div>
        </TabsContent>

        {/* ====== TAB 2: Variants / Sizes ====== */}
        <TabsContent value="variants" className="mt-4">
          {!savedItemId ? (
            <div className="text-center py-8 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>{language === "ar" ? "احفظ الصنف أولاً لإضافة المتغيرات" : "Save the item first to add variants"}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header with info */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-sm">{language === "ar" ? "أحجام وأنواع الصنف" : "Item Sizes & Types"}</h4>
                  <p className="text-xs text-muted-foreground">
                    {language === "ar" 
                      ? `السعر الأساسي: ${basePrice.toFixed(2)} ريال — أضف أحجام مختلفة` 
                      : `Base price: ${basePrice.toFixed(2)} SAR — Add different sizes`}
                  </p>
                </div>
                <Button size="sm" onClick={() => setShowVariantForm(true)} disabled={showVariantForm}>
                  <Plus className="h-4 w-4 me-1" />
                  {language === "ar" ? "إضافة حجم" : "Add Size"}
                </Button>
              </div>

              {/* Add Variant Inline Form */}
              {showVariantForm && (
                <Card className="border-primary/30 border-dashed">
                  <CardContent className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">{language === "ar" ? "الاسم (إنجليزي)" : "Name (EN)"}</Label>
                        <Input
                          value={variantForm.nameEn}
                          onChange={(e) => setVariantForm({ ...variantForm, nameEn: e.target.value })}
                          placeholder="Large, Medium, Small..."
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">{language === "ar" ? "الاسم (عربي)" : "Name (AR)"}</Label>
                        <Input
                          value={variantForm.nameAr}
                          onChange={(e) => setVariantForm({ ...variantForm, nameAr: e.target.value })}
                          placeholder="كبير، وسط، صغير..."
                          dir="rtl"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 items-end">
                      <div className="space-y-1.5">
                        <Label className="text-xs">{language === "ar" ? "فرق السعر (ريال)" : "Price Change (SAR)"}</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={variantForm.priceModifier}
                          onChange={(e) => setVariantForm({ ...variantForm, priceModifier: e.target.value })}
                          placeholder="+5.00 or -3.00"
                        />
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                          <Switch
                            checked={variantForm.isDefault}
                            onCheckedChange={(c) => setVariantForm({ ...variantForm, isDefault: c })}
                          />
                          <Label className="text-xs">{language === "ar" ? "افتراضي" : "Default"}</Label>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Switch
                            checked={variantForm.isAvailable}
                            onCheckedChange={(c) => setVariantForm({ ...variantForm, isAvailable: c })}
                          />
                          <Label className="text-xs">{language === "ar" ? "متاح" : "Available"}</Label>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1"
                          onClick={() => createVariantMutation.mutate(variantForm)}
                          disabled={!variantForm.nameEn || !variantForm.nameAr || createVariantMutation.isPending}
                        >
                          {language === "ar" ? "حفظ" : "Save"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setShowVariantForm(false)}>
                          {language === "ar" ? "إلغاء" : "Cancel"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Variants List */}
              {loadingVariants ? (
                <div className="space-y-2">
                  <Skeleton className="h-16" />
                  <Skeleton className="h-16" />
                </div>
              ) : variants.length === 0 ? (
                <div className="text-center py-6 border rounded-lg bg-muted/20">
                  <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    {language === "ar" ? "لا توجد أحجام — سيظهر السعر الأساسي فقط" : "No variants — base price will be used"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {variants.map((v: any) => {
                    const mod = parseFloat(v.priceModifier || "0");
                    const finalPrice = basePrice + mod;
                    return (
                      <div key={v.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-md bg-primary/10 flex items-center justify-center">
                            <Package className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium text-sm">
                              {language === "ar" ? v.nameAr : v.nameEn}
                              {v.isDefault && (
                                <Badge variant="secondary" className="ms-2 text-[10px] h-4">{language === "ar" ? "افتراضي" : "Default"}</Badge>
                              )}
                              {!v.isAvailable && (
                                <Badge variant="destructive" className="ms-1 text-[10px] h-4">{language === "ar" ? "غير متاح" : "N/A"}</Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {mod >= 0 ? "+" : ""}{mod.toFixed(2)} {language === "ar" ? "ريال" : "SAR"}
                              <span className="mx-1">→</span>
                              <span className="font-semibold text-foreground">{finalPrice.toFixed(2)} {language === "ar" ? "ريال" : "SAR"}</span>
                            </div>
                          </div>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => deleteVariantMutation.mutate(v.id)}
                          disabled={deleteVariantMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => { setActiveTab("customizations"); }}>
                  {language === "ar" ? "التالي: التخصيصات →" : "Next: Customizations →"}
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ====== TAB 3: Customizations ====== */}
        <TabsContent value="customizations" className="mt-4">
          {!savedItemId ? (
            <div className="text-center py-8 text-muted-foreground">
              <Settings2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p>{language === "ar" ? "احفظ الصنف أولاً لإضافة التخصيصات" : "Save the item first to add customizations"}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-sm">{language === "ar" ? "ربط مجموعات التخصيص" : "Link Customization Groups"}</h4>
                <p className="text-xs text-muted-foreground">
                  {language === "ar" 
                    ? "اختر مجموعات التخصيص التي تنطبق على هذا الصنف (مثل: الإضافات، الصوصات، درجة الطبخ)" 
                    : "Select which customization groups apply to this item (e.g. Extras, Sauces, Cook Level)"}
                </p>
              </div>

              {loadingCustomizations ? (
                <div className="space-y-2">
                  <Skeleton className="h-14" />
                  <Skeleton className="h-14" />
                </div>
              ) : allGroups.length === 0 ? (
                <div className="text-center py-6 border rounded-lg bg-muted/20">
                  <Settings2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    {language === "ar" 
                      ? "لا توجد مجموعات تخصيص — أنشئها من تبويب التخصيصات في صفحة المنيو" 
                      : "No customization groups — create them in the Customizations tab"}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {allGroups.map((group: any) => {
                    const isLinked = linkedGroupIds.includes(group.id);
                    return (
                      <div
                        key={group.id}
                        className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${
                          isLinked ? "border-primary/50 bg-primary/5" : "hover:bg-muted/30"
                        }`}
                        onClick={() => {
                          if (isLinked) {
                            unlinkCustomizationMutation.mutate(group.id);
                          } else {
                            linkCustomizationMutation.mutate(group.id);
                          }
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <Checkbox checked={isLinked} className="pointer-events-none" />
                          <div>
                            <div className="font-medium text-sm flex items-center gap-2">
                              {language === "ar" ? group.nameAr : group.nameEn}
                              <Badge variant="outline" className="text-[10px] h-4">
                                {group.selectionType === "single" 
                                  ? (language === "ar" ? "اختيار واحد" : "Single") 
                                  : (language === "ar" ? "متعدد" : "Multiple")}
                              </Badge>
                              {group.isRequired && (
                                <Badge variant="secondary" className="text-[10px] h-4">
                                  {language === "ar" ? "إلزامي" : "Required"}
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {language === "ar" ? group.nameEn : group.nameAr}
                            </p>
                          </div>
                        </div>
                        <Switch checked={isLinked} className="pointer-events-none" />
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-between">
                <Button variant="outline" size="sm" onClick={() => setActiveTab("variants")}>
                  {language === "ar" ? "← السابق: الأحجام" : "← Back: Variants"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setActiveTab("recipe")}>
                  {language === "ar" ? "التالي: الوصفة →" : "Next: Recipe →"}
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ====== TAB 4: Recipe / Ingredients ====== */}
        <TabsContent value="recipe" className="mt-4">
          {!savedItemId ? (
            <div className="text-center py-8 text-muted-foreground">
              {language === "ar" ? "احفظ الصنف أولاً لإضافة الوصفة" : "Save the item first to add recipe"}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Add ingredient form */}
              <div className="border rounded-lg p-4 space-y-3">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Beaker className="h-4 w-4 text-green-600" />
                  {language === "ar" ? "إضافة مكون من المخزون" : "Add Ingredient from Inventory"}
                </h4>
                <div className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-5">
                    <Label className="text-xs mb-1 block">{language === "ar" ? "المكون" : "Ingredient"}</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors"
                      value={recipeIngredient.inventoryItemId}
                      onChange={(e) => {
                        const item = inventoryItems.find((i: InventoryItem) => i.id === e.target.value);
                        setRecipeIngredient({
                          ...recipeIngredient,
                          inventoryItemId: e.target.value,
                          unit: item?.unit || "",
                        });
                      }}
                    >
                      <option value="">{language === "ar" ? "اختر مكون..." : "Select ingredient..."}</option>
                      {inventoryItems
                        .filter((item: InventoryItem) => !recipes.some((r: Recipe) => r.inventoryItemId === item.id))
                        .map((item: InventoryItem) => (
                          <option key={item.id} value={item.id}>
                            {language === "ar" ? (item.nameAr || item.name) : item.name}
                            {" "}({item.currentStock} {item.unit})
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="col-span-3">
                    <Label className="text-xs mb-1 block">{language === "ar" ? "الكمية" : "Quantity"}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={recipeIngredient.quantity}
                      onChange={(e) => setRecipeIngredient({ ...recipeIngredient, quantity: e.target.value })}
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-xs mb-1 block">{language === "ar" ? "الوحدة" : "Unit"}</Label>
                    <Input
                      value={recipeIngredient.unit}
                      readOnly
                      className="bg-muted"
                    />
                  </div>
                  <div className="col-span-2">
                    <Button
                      type="button"
                      size="sm"
                      className="w-full"
                      onClick={handleAddIngredient}
                      disabled={!recipeIngredient.inventoryItemId || !recipeIngredient.quantity || createRecipeMutation.isPending}
                    >
                      {language === "ar" ? "إضافة" : "Add"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Recipe ingredients list */}
              {loadingRecipes ? (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  {language === "ar" ? "جاري التحميل..." : "Loading..."}
                </div>
              ) : recipes.length === 0 ? (
                <div className="text-center py-8 border rounded-lg">
                  <Beaker className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {language === "ar" ? "لم يتم إضافة مكونات بعد" : "No ingredients added yet"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {language === "ar" ? "أضف مكونات من المخزون لحساب التكلفة وخصم المخزون تلقائياً" : "Add inventory ingredients to auto-calculate cost & deduct stock"}
                  </p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        <th className="text-start p-2 font-medium">{language === "ar" ? "المكون" : "Ingredient"}</th>
                        <th className="text-center p-2 font-medium">{language === "ar" ? "الكمية" : "Qty"}</th>
                        <th className="text-center p-2 font-medium">{language === "ar" ? "الوحدة" : "Unit"}</th>
                        <th className="text-center p-2 font-medium">{language === "ar" ? "تكلفة الوحدة" : "Unit Cost"}</th>
                        <th className="text-center p-2 font-medium">{language === "ar" ? "التكلفة" : "Cost"}</th>
                        <th className="text-center p-2 font-medium w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {recipes.map((recipe: any) => {
                        const invItem = inventoryItems.find((i: InventoryItem) => i.id === recipe.inventoryItemId);
                        const unitCost = invItem?.costPerUnit ? parseFloat(invItem.costPerUnit) : 0;
                        const qty = parseFloat(recipe.quantity) || 0;
                        const lineCost = unitCost * qty;
                        return (
                          <tr key={recipe.id} className="border-t">
                            <td className="p-2">
                              <span className="font-medium">
                                {language === "ar" ? (invItem?.nameAr || invItem?.name || "—") : (invItem?.name || "—")}
                              </span>
                              {invItem && parseFloat(String(invItem.currentStock)) <= parseFloat(String(invItem.minStock || 0)) && (
                                <span className="text-xs text-red-500 block">
                                  {language === "ar" ? "⚠ مخزون منخفض" : "⚠ Low stock"}
                                </span>
                              )}
                            </td>
                            <td className="p-2 text-center">{qty}</td>
                            <td className="p-2 text-center">{recipe.unit}</td>
                            <td className="p-2 text-center">{unitCost.toFixed(2)}</td>
                            <td className="p-2 text-center font-medium">{lineCost.toFixed(2)} {language === "ar" ? "ر.س" : "SAR"}</td>
                            <td className="p-2 text-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                                onClick={() => deleteRecipeMutation.mutate(recipe.id)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-muted/30">
                      <tr className="border-t font-semibold">
                        <td className="p-2" colSpan={4}>
                          {language === "ar" ? "إجمالي تكلفة الوصفة" : "Total Recipe Cost"}
                        </td>
                        <td className="p-2 text-center">
                          {recipes.reduce((sum: number, r: any) => {
                            const inv = inventoryItems.find((i: InventoryItem) => i.id === r.inventoryItemId);
                            const uc = inv?.costPerUnit ? parseFloat(inv.costPerUnit) : 0;
                            return sum + uc * (parseFloat(r.quantity) || 0);
                          }, 0).toFixed(2)} {language === "ar" ? "ر.س" : "SAR"}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between">
                <Button variant="outline" size="sm" onClick={() => setActiveTab("customizations")}>
                  {language === "ar" ? "← السابق: التخصيصات" : "← Back: Customizations"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setActiveTab("nutrition")}>
                  {language === "ar" ? "التالي: المعلومات الغذائية →" : "Next: Nutrition →"}
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ====== TAB 5: Nutrition & Labels ====== */}
        <TabsContent value="nutrition" className="mt-4">
            <div className="space-y-4">
              {/* Nutritional Info Header */}
              <div className="flex items-center gap-2 pb-1">
                <Flame className="h-4 w-4 text-orange-500" />
                <h4 className="font-semibold text-sm">{language === "ar" ? "المعلومات الغذائية (SFDA)" : "Nutritional Information (SFDA)"}</h4>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <FormField control={form.control} name="calories" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">{language === "ar" ? "السعرات (kcal)" : "Calories (kcal)"}</FormLabel>
                    <FormControl><Input {...field} type="number" placeholder="0" onBlur={autoCalculateBurnTime} /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="protein" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">{language === "ar" ? "البروتين (جم)" : "Protein (g)"}</FormLabel>
                    <FormControl><Input {...field} type="number" step="0.1" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="carbs" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">{language === "ar" ? "الكربوهيدرات (جم)" : "Carbs (g)"}</FormLabel>
                    <FormControl><Input {...field} type="number" step="0.1" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="fat" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">{language === "ar" ? "الدهون (جم)" : "Fat (g)"}</FormLabel>
                    <FormControl><Input {...field} type="number" step="0.1" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="saturatedFat" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">{language === "ar" ? "دهون مشبعة (جم)" : "Sat. Fat (g)"}</FormLabel>
                    <FormControl><Input {...field} type="number" step="0.1" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="sugar" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">{language === "ar" ? "السكر (جم)" : "Sugar (g)"}</FormLabel>
                    <FormControl><Input {...field} type="number" step="0.1" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="sodium" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">{language === "ar" ? "الصوديوم (ملجم)" : "Sodium (mg)"}</FormLabel>
                    <FormControl><Input {...field} type="number" step="0.1" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="fiber" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">{language === "ar" ? "الألياف (جم)" : "Fiber (g)"}</FormLabel>
                    <FormControl><Input {...field} type="number" step="0.1" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="caffeine" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">{language === "ar" ? "الكافيين (ملجم)" : "Caffeine (mg)"}</FormLabel>
                    <FormControl><Input {...field} type="number" step="0.1" /></FormControl>
                  </FormItem>
                )} />
              </div>

              <Separator />
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="walkingMinutes" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs flex items-center gap-1">
                      <Footprints className="h-3 w-3" /> {language === "ar" ? "دقائق المشي للحرق" : "Walking (min)"}
                    </FormLabel>
                    <FormControl><Input {...field} type="number" /></FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="runningMinutes" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs flex items-center gap-1">
                      🏃 {language === "ar" ? "دقائق الجري للحرق" : "Running (min)"}
                    </FormLabel>
                    <FormControl><Input {...field} type="number" /></FormControl>
                  </FormItem>
                )} />
              </div>

              <Separator />

              {/* Dietary Labels */}
              <div className="flex items-center gap-2 pb-1">
                <Star className="h-4 w-4 text-yellow-500" />
                <h4 className="font-semibold text-sm">{language === "ar" ? "التسميات الغذائية" : "Dietary Labels"}</h4>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { name: "isSpicy" as const, emoji: "🌶️", labelEn: "Spicy", labelAr: "حار" },
                  { name: "isHighSodium" as const, emoji: "🧂", labelEn: "High Sodium", labelAr: "عالي الملح" },
                  { name: "isVegetarian" as const, emoji: "🥬", labelEn: "Vegetarian", labelAr: "نباتي" },
                  { name: "isVegan" as const, emoji: "🌱", labelEn: "Vegan", labelAr: "نباتي صرف" },
                  { name: "isGlutenFree" as const, emoji: "🌾", labelEn: "Gluten-Free", labelAr: "خالي جلوتين" },
                  { name: "isNew" as const, emoji: "✨", labelEn: "New", labelAr: "جديد" },
                  { name: "isBestseller" as const, emoji: "⭐", labelEn: "Bestseller", labelAr: "الأكثر مبيعاً" },
                ].map(({ name, emoji, labelEn, labelAr }) => (
                  <FormField key={name} control={form.control} name={name} render={({ field }) => (
                    <FormItem className="flex items-center gap-2 space-y-0 p-2 rounded-md border hover:bg-muted/30 transition-colors">
                      <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                      <FormLabel className="text-xs font-normal cursor-pointer">{emoji} {language === "ar" ? labelAr : labelEn}</FormLabel>
                    </FormItem>
                  )} />
                ))}
              </div>

              <Separator />

              {/* Allergens */}
              <div className="flex items-center gap-2 pb-1">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <h4 className="font-semibold text-sm">{language === "ar" ? "مسببات الحساسية" : "Allergens"}</h4>
              </div>
              <FormField control={form.control} name="allergens" render={({ field }) => (
                <FormItem>
                  <div className="grid grid-cols-3 gap-2">
                    {allergenOptions.map((allergen) => (
                      <div
                        key={allergen.id}
                        className={`flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-all ${
                          field.value?.includes(allergen.id) ? "border-orange-400 bg-orange-50 dark:bg-orange-900/20" : "hover:bg-muted/30"
                        }`}
                        onClick={() => {
                          const current = field.value || [];
                          if (current.includes(allergen.id)) {
                            field.onChange(current.filter((a: string) => a !== allergen.id));
                          } else {
                            field.onChange([...current, allergen.id]);
                          }
                        }}
                      >
                        <Checkbox checked={field.value?.includes(allergen.id)} className="pointer-events-none" />
                        <span className="text-xs">{allergen.icon} {language === "ar" ? allergen.labelAr : allergen.labelEn}</span>
                      </div>
                    ))}
                  </div>
                </FormItem>
              )} />

              <Button type="button" onClick={form.handleSubmit(onSubmit)} className="w-full" disabled={isPending} data-testid="button-save-nutrition">
                {isPending ? "..." : savedItemId ? (language === "ar" ? "حفظ التغييرات" : "Save Changes") : (language === "ar" ? "حفظ الصنف" : "Save Item")}
              </Button>
              {savedItemId && (
                <Button type="button" variant="outline" className="w-full" onClick={onSuccess}>
                  {language === "ar" ? "تم — إغلاق" : "Done — Close"}
                </Button>
              )}
            </div>
        </TabsContent>
      </Tabs>
     </Form>
    </div>
  );
}

export default function MenuPage() {
  const { t, language, getLocalizedName } = useLanguage();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | undefined>();
  const [editingItem, setEditingItem] = useState<MenuItem | undefined>();

  const { data: categories, isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: kitchenSections } = useQuery<KitchenSection[]>({
    queryKey: ["/api/kitchen-sections"],
  });

  const { data: menuItems, isLoading: itemsLoading } = useQuery<MenuItem[]>({
    queryKey: ["/api/menu-items"],
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/categories/${id}`),
    onSuccess: () => {
      defaultQueryClient.invalidateQueries({ queryKey: ["/api/categories"] });
      toast({ title: t("categoryDeleted") });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/menu-items/${id}`),
    onSuccess: () => {
      defaultQueryClient.invalidateQueries({ queryKey: ["/api/menu-items"] });
      toast({ title: t("itemDeleted") });
    },
  });

  const filteredItems = menuItems?.filter((item) => {
    const matchesSearch =
      item.nameEn.toLowerCase().includes(search.toLowerCase()) ||
      item.nameAr.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === "all" || item.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const openEditCategory = (category: Category) => {
    setEditingCategory(category);
    setCategoryDialogOpen(true);
  };

  const openEditItem = (item: MenuItem) => {
    setEditingItem(item);
    setItemDialogOpen(true);
  };

  const closeDialogs = () => {
    setCategoryDialogOpen(false);
    setItemDialogOpen(false);
    setEditingCategory(undefined);
    setEditingItem(undefined);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-foreground">{t("menu")}</h2>
        <div className="flex gap-2">
          <Dialog open={categoryDialogOpen} onOpenChange={(open) => {
            if (!open) closeDialogs();
            else setCategoryDialogOpen(true);
          }}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-add-category">
                <FolderOpen className="h-4 w-4 me-2" />
                {t("addCategory")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingCategory ? t("edit") : t("addCategory")}
                </DialogTitle>
              </DialogHeader>
              <CategoryForm 
                category={editingCategory} 
                onSuccess={closeDialogs}
              />
            </DialogContent>
          </Dialog>
          <Dialog open={itemDialogOpen} onOpenChange={(open) => {
            if (!open) closeDialogs();
            else setItemDialogOpen(true);
          }}>
            <DialogTrigger asChild>
              <Button data-testid="button-add-item">
                <Plus className="h-4 w-4 me-2" />
                {t("addItem")}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingItem 
                    ? (language === "ar" ? "تعديل الصنف" : "Edit Menu Item") 
                    : (language === "ar" ? "إضافة صنف جديد" : "Add New Menu Item")}
                </DialogTitle>
              </DialogHeader>
              <MenuItemForm 
                item={editingItem}
                categories={categories || []}
                onSuccess={closeDialogs}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="items" className="w-full">
        <TabsList>
          <TabsTrigger value="items" data-testid="tab-items">
            {t("items")} ({menuItems?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="categories" data-testid="tab-categories">
            {t("categories")} ({categories?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="customizations" data-testid="tab-customizations">
            <Settings2 className="h-4 w-4 me-1" />
            {t("customizations")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="mt-4">
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("search")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="ps-9"
                data-testid="input-search-items"
              />
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[200px]" data-testid="select-filter-category">
                <SelectValue placeholder={t("allCategories")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allCategories")}</SelectItem>
                {categories?.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {getLocalizedName(cat.nameEn, cat.nameAr)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {itemsLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-48" />
              ))}
            </div>
          ) : !filteredItems || filteredItems.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <UtensilsCrossed className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <p className="text-lg text-muted-foreground">{t("noItems")}</p>
                <Button 
                  className="mt-4" 
                  onClick={() => setItemDialogOpen(true)}
                  data-testid="button-add-first-item"
                >
                  <Plus className="h-4 w-4 me-2" />
                  {t("addItem")}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredItems.map((item) => {
                const category = categories?.find((c) => c.id === item.categoryId);
                const itemAny = item as any;
                return (
                  <Card key={item.id} className="overflow-hidden hover-elevate" data-testid={`item-card-${item.id}`}>
                    <div className="relative h-40 bg-muted">
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={getLocalizedName(item.nameEn, item.nameAr)}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <UtensilsCrossed className="h-12 w-12 text-muted-foreground/50" />
                        </div>
                      )}
                      {/* Status & Labels Badges */}
                      <div className="absolute top-2 end-2 flex flex-col gap-1">
                        <Badge variant={item.isAvailable ? "default" : "secondary"}>
                          {item.isAvailable ? t("available") : t("unavailable")}
                        </Badge>
                        {itemAny.isNew && <Badge className="bg-green-500">✨ {t("isNew") || "جديد"}</Badge>}
                        {itemAny.isBestseller && <Badge className="bg-yellow-500">⭐ {t("bestseller") || "الأكثر مبيعاً"}</Badge>}
                      </div>
                      {/* Warning Labels */}
                      <div className="absolute bottom-2 start-2 flex gap-1">
                        {itemAny.isHighSodium && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="destructive" className="text-xs">🧂</Badge>
                              </TooltipTrigger>
                              <TooltipContent>{t("highSodium") || "عالي الملح"}</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {itemAny.isSpicy && (
                          <Badge variant="outline" className="bg-red-100 text-xs">🌶️</Badge>
                        )}
                        {itemAny.isVegetarian && (
                          <Badge variant="outline" className="bg-green-100 text-xs">🥬</Badge>
                        )}
                        {itemAny.isGlutenFree && (
                          <Badge variant="outline" className="bg-yellow-100 text-xs">🌾✓</Badge>
                        )}
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <h3 className="font-semibold">
                            {getLocalizedName(item.nameEn, item.nameAr)}
                          </h3>
                          {category && (
                            <p className="text-sm text-muted-foreground">
                              {getLocalizedName(category.nameEn, category.nameAr)}
                            </p>
                          )}
                        </div>
                        <span className="font-bold text-primary">
                          {parseFloat(item.price?.toString() || "0").toFixed(2)} {t("sar")}
                        </span>
                      </div>
                      
                      {/* Nutritional Quick View */}
                      {item.calories && (
                        <div className="mt-2 p-2 bg-muted/50 rounded-lg">
                          <div className="flex items-center justify-between text-xs">
                            <span className="flex items-center gap-1">
                              <Flame className="h-3 w-3 text-orange-500" />
                              {item.calories} {t("kcal") || "سعرة"}
                            </span>
                            {itemAny.walkingMinutes && (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Footprints className="h-3 w-3" />
                                {itemAny.walkingMinutes} {t("min") || "د"}
                              </span>
                            )}
                            {itemAny.caffeine && parseFloat(itemAny.caffeine) > 0 && (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <Coffee className="h-3 w-3" />
                                {itemAny.caffeine}mg
                              </span>
                            )}
                          </div>
                          {/* Macro nutrients bar */}
                          {(itemAny.protein || itemAny.carbs || itemAny.fat) && (
                            <div className="flex gap-2 mt-1 text-xs text-muted-foreground">
                              {itemAny.protein && <span>P: {itemAny.protein}g</span>}
                              {itemAny.carbs && <span>C: {itemAny.carbs}g</span>}
                              {itemAny.fat && <span>F: {itemAny.fat}g</span>}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Allergens Warning */}
                      {itemAny.allergens && itemAny.allergens.length > 0 && (
                        <div className="mt-2 flex items-center gap-1 text-xs text-orange-600">
                          <AlertTriangle className="h-3 w-3" />
                          <span>{t("containsAllergens") || "يحتوي على مسببات حساسية"}:</span>
                          {itemAny.allergens.map((a: string) => (
                            <span key={a}>{allergenOptions.find(opt => opt.id === a)?.icon}</span>
                          ))}
                        </div>
                      )}
                      
                      <div className="flex items-center justify-end gap-2 mt-3 pt-3 border-t">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => openEditItem(item)}
                          data-testid={`button-edit-item-${item.id}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => { if (window.confirm('هل أنت متأكد من حذف هذا العنصر؟')) deleteItemMutation.mutate(item.id); }}
                          data-testid={`button-delete-item-${item.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          {categoriesLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : !categories || categories.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <FolderOpen className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <p className="text-lg text-muted-foreground">No categories yet</p>
                <Button 
                  className="mt-4" 
                  onClick={() => setCategoryDialogOpen(true)}
                  data-testid="button-add-first-category"
                >
                  <Plus className="h-4 w-4 me-2" />
                  {t("addCategory")}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {categories.map((category) => {
                const itemCount = menuItems?.filter((i) => i.categoryId === category.id).length || 0;
                return (
                  <Card key={category.id} className="hover-elevate" data-testid={`category-card-${category.id}`}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
                            <FolderOpen className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold">
                              {getLocalizedName(category.nameEn, category.nameAr)}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              {itemCount} {t("items")}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Badge variant={category.isActive ? "default" : "secondary"}>
                            {category.isActive ? t("active") : t("unavailable")}
                          </Badge>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => openEditCategory(category)}
                            data-testid={`button-edit-category-${category.id}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => { if (window.confirm('هل أنت متأكد من حذف هذا التصنيف؟')) deleteCategoryMutation.mutate(category.id); }}
                            data-testid={`button-delete-category-${category.id}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Customizations Tab */}
        <TabsContent value="customizations" className="mt-4">
          <CustomizationsSection language={language} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Customizations Section Component
function CustomizationsSection({ language }: { language: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedMenuItem, setSelectedMenuItem] = useState<string>("");
  const [isVariantDialogOpen, setIsVariantDialogOpen] = useState(false);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [isOptionDialogOpen, setIsOptionDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);

  const [variantFormData, setVariantFormData] = useState({
    nameEn: "",
    nameAr: "",
    priceModifier: "0",
    isDefault: false,
    isAvailable: true,
  });

  const [groupFormData, setGroupFormData] = useState({
    nameEn: "",
    nameAr: "",
    type: "single",
    isRequired: false,
    minSelections: "",
    maxSelections: "",
  });

  const [optionFormData, setOptionFormData] = useState({
    nameEn: "",
    nameAr: "",
    priceModifier: "0",
    isDefault: false,
    isAvailable: true,
  });

  // Fetch menu items
  const { data: menuItems = [] } = useQuery<any[]>({
    queryKey: ["/api/menu-items"],
  });

  // Fetch variants for selected menu item
  const { data: variants = [], isLoading: loadingVariants } = useQuery<any[]>({
    queryKey: ["/api/menu-items", selectedMenuItem, "variants"],
    queryFn: async () => {
      if (!selectedMenuItem) return [];
      const response = await fetch(`/api/menu-items/${selectedMenuItem}/variants`);
      return response.json();
    },
    enabled: !!selectedMenuItem,
  });

  // Fetch customization groups
  const { data: groups = [], isLoading: loadingGroups } = useQuery<any[]>({
    queryKey: ["/api/customization-groups"],
  });

  // Fetch options for selected group
  const { data: options = [] } = useQuery<any[]>({
    queryKey: ["/api/customization-groups", selectedGroup?.id, "options"],
    queryFn: async () => {
      if (!selectedGroup) return [];
      const response = await fetch(`/api/customization-groups/${selectedGroup.id}/options`);
      return response.json();
    },
    enabled: !!selectedGroup,
  });

  // Create variant
  const createVariantMutation = useMutation({
    mutationFn: async (data: typeof variantFormData) => {
      const response = await fetch(`/api/menu-items/${selectedMenuItem}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          menuItemId: selectedMenuItem,
          priceModifier: parseFloat(data.priceModifier),
        }),
      });
      if (!response.ok) throw new Error("Failed to create variant");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu-items", selectedMenuItem, "variants"] });
      setIsVariantDialogOpen(false);
      setVariantFormData({ nameEn: "", nameAr: "", priceModifier: "0", isDefault: false, isAvailable: true });
      toast({ title: language === "ar" ? "تم الحفظ" : "Saved" });
    },
  });

  // Create customization group
  const createGroupMutation = useMutation({
    mutationFn: async (data: typeof groupFormData) => {
      const response = await fetch("/api/customization-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          restaurantId: "default",
          minSelections: data.minSelections ? parseInt(data.minSelections) : null,
          maxSelections: data.maxSelections ? parseInt(data.maxSelections) : null,
        }),
      });
      if (!response.ok) throw new Error("Failed to create group");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customization-groups"] });
      setIsGroupDialogOpen(false);
      setGroupFormData({ nameEn: "", nameAr: "", type: "single", isRequired: false, minSelections: "", maxSelections: "" });
      toast({ title: language === "ar" ? "تم الحفظ" : "Saved" });
    },
  });

  // Create option
  const createOptionMutation = useMutation({
    mutationFn: async (data: typeof optionFormData) => {
      const response = await fetch(`/api/customization-groups/${selectedGroup?.id}/options`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          groupId: selectedGroup?.id,
          priceModifier: parseFloat(data.priceModifier),
        }),
      });
      if (!response.ok) throw new Error("Failed to create option");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customization-groups", selectedGroup?.id, "options"] });
      setIsOptionDialogOpen(false);
      setOptionFormData({ nameEn: "", nameAr: "", priceModifier: "0", isDefault: false, isAvailable: true });
      toast({ title: language === "ar" ? "تم الحفظ" : "Saved" });
    },
  });

  // Delete variant
  const deleteVariantMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/variants/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/menu-items", selectedMenuItem, "variants"] });
      toast({ title: language === "ar" ? "تم الحذف" : "Deleted" });
    },
  });

  // Delete group
  const deleteGroupMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/customization-groups/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customization-groups"] });
      toast({ title: language === "ar" ? "تم الحذف" : "Deleted" });
    },
  });

  // Delete option
  const deleteOptionMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/customization-options/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customization-groups", selectedGroup?.id, "options"] });
      toast({ title: language === "ar" ? "تم الحذف" : "Deleted" });
    },
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Variants Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {language === "ar" ? "متغيرات الأصناف" : "Item Variants"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{language === "ar" ? "اختر صنف" : "Select Item"}</Label>
            <Select value={selectedMenuItem} onValueChange={setSelectedMenuItem}>
              <SelectTrigger>
                <SelectValue placeholder={language === "ar" ? "اختر صنف..." : "Select item..."} />
              </SelectTrigger>
              <SelectContent>
                {menuItems.map((item: any) => (
                  <SelectItem key={item.id} value={item.id}>
                    {language === "ar" ? item.nameAr : item.nameEn} - {item.price} {language === "ar" ? "ريال" : "SAR"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedMenuItem && (
            <>
              <div className="flex justify-between items-center">
                <h4 className="font-medium">{language === "ar" ? "المتغيرات" : "Variants"}</h4>
                <Dialog open={isVariantDialogOpen} onOpenChange={setIsVariantDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 me-1" />
                      {language === "ar" ? "إضافة" : "Add"}
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{language === "ar" ? "متغير جديد" : "New Variant"}</DialogTitle>
                    </DialogHeader>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        createVariantMutation.mutate(variantFormData);
                      }}
                      className="space-y-4"
                    >
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>{language === "ar" ? "الاسم (إنجليزي)" : "Name (English)"}</Label>
                          <Input
                            value={variantFormData.nameEn}
                            onChange={(e) => setVariantFormData({ ...variantFormData, nameEn: e.target.value })}
                            placeholder="Large, Medium, Small..."
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{language === "ar" ? "الاسم (عربي)" : "Name (Arabic)"}</Label>
                          <Input
                            value={variantFormData.nameAr}
                            onChange={(e) => setVariantFormData({ ...variantFormData, nameAr: e.target.value })}
                            placeholder="كبير، وسط، صغير..."
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>{language === "ar" ? "تعديل السعر" : "Price Modifier"}</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={variantFormData.priceModifier}
                          onChange={(e) => setVariantFormData({ ...variantFormData, priceModifier: e.target.value })}
                        />
                        <p className="text-xs text-muted-foreground">
                          {language === "ar" ? "استخدم قيمة سالبة للخصم" : "Use negative value for discount"}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={variantFormData.isDefault}
                            onCheckedChange={(checked) => setVariantFormData({ ...variantFormData, isDefault: checked })}
                          />
                          <Label>{language === "ar" ? "افتراضي" : "Default"}</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={variantFormData.isAvailable}
                            onCheckedChange={(checked) => setVariantFormData({ ...variantFormData, isAvailable: checked })}
                          />
                          <Label>{language === "ar" ? "متاح" : "Available"}</Label>
                        </div>
                      </div>
                      <Button type="submit" className="w-full" disabled={createVariantMutation.isPending}>
                        {language === "ar" ? "حفظ" : "Save"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              {loadingVariants ? (
                <div className="text-center py-4">{language === "ar" ? "جاري التحميل..." : "Loading..."}</div>
              ) : variants.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  {language === "ar" ? "لا توجد متغيرات" : "No variants"}
                </div>
              ) : (
                <div className="space-y-2">
                  {variants.map((variant: any) => (
                    <div
                      key={variant.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <div className="font-medium">
                          {language === "ar" ? variant.nameAr : variant.nameEn}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {parseFloat(variant.priceModifier) >= 0 ? "+" : ""}{variant.priceModifier} {language === "ar" ? "ريال" : "SAR"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {variant.isDefault && (
                          <Badge variant="secondary">{language === "ar" ? "افتراضي" : "Default"}</Badge>
                        )}
                        {!variant.isAvailable && (
                          <Badge variant="destructive">{language === "ar" ? "غير متاح" : "Unavailable"}</Badge>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => deleteVariantMutation.mutate(variant.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Customization Groups Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            {language === "ar" ? "مجموعات التخصيص" : "Customization Groups"}
          </CardTitle>
          <Dialog open={isGroupDialogOpen} onOpenChange={setIsGroupDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 me-1" />
                {language === "ar" ? "مجموعة جديدة" : "New Group"}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{language === "ar" ? "مجموعة تخصيص جديدة" : "New Customization Group"}</DialogTitle>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  createGroupMutation.mutate(groupFormData);
                }}
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{language === "ar" ? "الاسم (إنجليزي)" : "Name (English)"}</Label>
                    <Input
                      value={groupFormData.nameEn}
                      onChange={(e) => setGroupFormData({ ...groupFormData, nameEn: e.target.value })}
                      placeholder="Size, Extras, Sauce..."
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{language === "ar" ? "الاسم (عربي)" : "Name (Arabic)"}</Label>
                    <Input
                      value={groupFormData.nameAr}
                      onChange={(e) => setGroupFormData({ ...groupFormData, nameAr: e.target.value })}
                      placeholder="الحجم، إضافات، صوص..."
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{language === "ar" ? "نوع الاختيار" : "Selection Type"}</Label>
                  <Select
                    value={groupFormData.type}
                    onValueChange={(value) => setGroupFormData({ ...groupFormData, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">{language === "ar" ? "اختيار واحد" : "Single Selection"}</SelectItem>
                      <SelectItem value="multiple">{language === "ar" ? "اختيار متعدد" : "Multiple Selection"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {groupFormData.type === "multiple" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{language === "ar" ? "الحد الأدنى" : "Min Selections"}</Label>
                      <Input
                        type="number"
                        min="0"
                        value={groupFormData.minSelections}
                        onChange={(e) => setGroupFormData({ ...groupFormData, minSelections: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{language === "ar" ? "الحد الأقصى" : "Max Selections"}</Label>
                      <Input
                        type="number"
                        min="1"
                        value={groupFormData.maxSelections}
                        onChange={(e) => setGroupFormData({ ...groupFormData, maxSelections: e.target.value })}
                      />
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Switch
                    checked={groupFormData.isRequired}
                    onCheckedChange={(checked) => setGroupFormData({ ...groupFormData, isRequired: checked })}
                  />
                  <Label>{language === "ar" ? "إلزامي" : "Required"}</Label>
                </div>
                <Button type="submit" className="w-full" disabled={createGroupMutation.isPending}>
                  {language === "ar" ? "حفظ" : "Save"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {loadingGroups ? (
            <div className="text-center py-4">{language === "ar" ? "جاري التحميل..." : "Loading..."}</div>
          ) : groups.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              {language === "ar" ? "لا توجد مجموعات" : "No groups"}
            </div>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {groups.map((group: any) => (
                <AccordionItem key={group.id} value={group.id}>
                  <AccordionTrigger
                    onClick={() => setSelectedGroup(group)}
                    className="hover:no-underline"
                  >
                    <div className="flex items-center gap-2">
                      <span>{language === "ar" ? group.nameAr : group.nameEn}</span>
                      <Badge variant="outline">{group.type}</Badge>
                      {group.isRequired && (
                        <Badge variant="secondary">{language === "ar" ? "إلزامي" : "Required"}</Badge>
                      )}
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pt-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">
                          {language === "ar" ? "الخيارات" : "Options"}
                        </span>
                        <div className="flex gap-2">
                          <Dialog open={isOptionDialogOpen && selectedGroup?.id === group.id} onOpenChange={setIsOptionDialogOpen}>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="outline" onClick={() => setSelectedGroup(group)}>
                                <Plus className="h-3 w-3 me-1" />
                                {language === "ar" ? "خيار" : "Option"}
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>{language === "ar" ? "خيار جديد" : "New Option"}</DialogTitle>
                              </DialogHeader>
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  createOptionMutation.mutate(optionFormData);
                                }}
                                className="space-y-4"
                              >
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label>{language === "ar" ? "الاسم (إنجليزي)" : "Name (English)"}</Label>
                                    <Input
                                      value={optionFormData.nameEn}
                                      onChange={(e) => setOptionFormData({ ...optionFormData, nameEn: e.target.value })}
                                      required
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>{language === "ar" ? "الاسم (عربي)" : "Name (Arabic)"}</Label>
                                    <Input
                                      value={optionFormData.nameAr}
                                      onChange={(e) => setOptionFormData({ ...optionFormData, nameAr: e.target.value })}
                                      required
                                    />
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label>{language === "ar" ? "السعر الإضافي" : "Additional Price"}</Label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={optionFormData.priceModifier}
                                    onChange={(e) => setOptionFormData({ ...optionFormData, priceModifier: e.target.value })}
                                  />
                                </div>
                                <Button type="submit" className="w-full" disabled={createOptionMutation.isPending}>
                                  {language === "ar" ? "حفظ" : "Save"}
                                </Button>
                              </form>
                            </DialogContent>
                          </Dialog>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteGroupMutation.mutate(group.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      {selectedGroup?.id === group.id && options.length > 0 ? (
                        <div className="space-y-2">
                          {options.map((option: any) => (
                            <div
                              key={option.id}
                              className="flex items-center justify-between p-2 bg-muted rounded"
                            >
                              <span>{language === "ar" ? option.nameAr : option.nameEn}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm">
                                  +{option.priceModifier} {language === "ar" ? "ريال" : "SAR"}
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => deleteOptionMutation.mutate(option.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {language === "ar" ? "اضغط لعرض الخيارات" : "Click to view options"}
                        </p>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

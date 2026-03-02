import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";
import { Settings2, Plus, Trash2, Edit, Package } from "lucide-react";

interface MenuItem {
  id: string;
  nameEn: string;
  nameAr: string;
  price: string;
}

interface Variant {
  id: string;
  menuItemId: string;
  nameEn: string;
  nameAr: string;
  priceModifier: string;
  isDefault: boolean;
  isAvailable: boolean;
}

interface CustomizationGroup {
  id: string;
  restaurantId: string;
  nameEn: string;
  nameAr: string;
  type: string;
  isRequired: boolean;
  minSelections: number | null;
  maxSelections: number | null;
  sortOrder: number;
}

interface CustomizationOption {
  id: string;
  groupId: string;
  nameEn: string;
  nameAr: string;
  priceModifier: string;
  isDefault: boolean;
  isAvailable: boolean;
}

export default function CustomizationsPage() {
  const { language, t } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedMenuItem, setSelectedMenuItem] = useState<string>("");
  const [isVariantDialogOpen, setIsVariantDialogOpen] = useState(false);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [isOptionDialogOpen, setIsOptionDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<CustomizationGroup | null>(null);

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
  const { data: menuItems = [] } = useQuery<MenuItem[]>({
    queryKey: ["/api/menu-items"],
  });

  // Fetch variants for selected menu item
  const { data: variants = [], isLoading: loadingVariants } = useQuery<Variant[]>({
    queryKey: ["/api/menu-items", selectedMenuItem, "variants"],
    queryFn: async () => {
      if (!selectedMenuItem) return [];
      const response = await fetch(`/api/menu-items/${selectedMenuItem}/variants`);
      return response.json();
    },
    enabled: !!selectedMenuItem,
  });

  // Fetch customization groups
  const { data: groups = [], isLoading: loadingGroups } = useQuery<CustomizationGroup[]>({
    queryKey: ["/api/customization-groups"],
  });

  // Fetch options for selected group
  const { data: options = [] } = useQuery<CustomizationOption[]>({
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
      // Validate inputs
      if (!data.nameEn || !data.nameAr) {
        throw new Error(language === "ar" ? "الاسم الإنجليزي والعربي مطلوب" : "Both names required");
      }
      
      const minSel = data.minSelections ? parseInt(data.minSelections) : 0;
      const maxSel = data.maxSelections ? parseInt(data.maxSelections) : 1;
      
      if (minSel > maxSel) {
        throw new Error(language === "ar" ? "الحد الأدنى لا يمكن أن يكون أكبر من الحد الأقصى" : "Min selections cannot be greater than max");
      }
      
      const response = await fetch("/api/customization-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          restaurantId: "default",
          minSelections: minSel || null,
          maxSelections: maxSel || null,
        }),
      });
      if (!response.ok) throw new Error("Failed to create group");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customization-groups"] });
      setIsGroupDialogOpen(false);
      setGroupFormData({ nameEn: "", nameAr: "", type: "single", isRequired: false, minSelections: "", maxSelections: "" });
      toast({ title: language === "ar" ? "تم الإضافة" : "Added successfully" });
    },
    onError: (error: any) => {
      toast({ title: error.message, variant: "destructive" });
    },
  });

  // Create option
  const createOptionMutation = useMutation({
    mutationFn: async (data: typeof optionFormData) => {
      // Validate inputs
      if (!data.nameEn || !data.nameAr) {
        throw new Error(language === "ar" ? "الاسم الإنجليزي والعربي مطلوب" : "Both names required");
      }
      
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
      toast({ title: language === "ar" ? "تم الإضافة" : "Added successfully" });
    },
    onError: (error: any) => {
      toast({ title: error.message, variant: "destructive" });
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
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">
          {language === "ar" ? "المتغيرات والتخصيصات" : "Variants & Customizations"}
        </h1>
        <p className="text-muted-foreground">
          {language === "ar" ? "إدارة متغيرات الأصناف وخيارات التخصيص" : "Manage item variants and customization options"}
        </p>
      </div>

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
                  {menuItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {language === "ar" ? item.nameAr : item.nameEn} - {item.price} {t("sar")}
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
                        <Plus className="h-4 w-4 mr-1" />
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
                    {variants.map((variant) => (
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
                  <Plus className="h-4 w-4 mr-1" />
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
                {groups.map((group) => (
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
                                  <Plus className="h-3 w-3 mr-1" />
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
                            {options.map((option) => (
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
    </div>
  );
}

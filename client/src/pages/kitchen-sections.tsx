import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLanguage } from "@/lib/i18n";
import { useBranch } from "@/lib/branch";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Edit2, Trash2, ChefHat, GripVertical } from "lucide-react";
import type { KitchenSection } from "@shared/schema";

export default function KitchenSectionsPage() {
  const { t, language, getLocalizedName, direction } = useLanguage();
  const { toast } = useToast();
  const { selectedBranchId } = useBranch();
  const [showDialog, setShowDialog] = useState(false);
  const [editingSection, setEditingSection] = useState<KitchenSection | null>(null);
  const [formData, setFormData] = useState({
    nameEn: "",
    nameAr: "",
    icon: "",
    color: "#8B1A1A",
    sortOrder: 0,
  });

  const branchParam = selectedBranchId ? `?branch=${selectedBranchId}` : "";

  const { data: sections, isLoading } = useQuery<KitchenSection[]>({
    queryKey: [`/api/kitchen-sections${branchParam}`],
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest("POST", "/api/kitchen-sections", {
        ...data,
        branchId: selectedBranchId || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kitchen-sections"] });
      toast({
        title: language === "ar" ? "تم الإضافة" : "Section Added",
        description: language === "ar" ? "تم إضافة القسم بنجاح" : "Kitchen section added successfully",
      });
      handleCloseDialog();
    },
    onError: () => {
      toast({
        title: t("error"),
        description: language === "ar" ? "فشل في إضافة القسم" : "Failed to add section",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest("PUT", `/api/kitchen-sections/${id}`, {
        ...data,
        branchId: selectedBranchId || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kitchen-sections"] });
      toast({
        title: language === "ar" ? "تم التحديث" : "Section Updated",
        description: language === "ar" ? "تم تحديث القسم بنجاح" : "Kitchen section updated successfully",
      });
      handleCloseDialog();
    },
    onError: () => {
      toast({
        title: t("error"),
        description: language === "ar" ? "فشل في تحديث القسم" : "Failed to update section",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/kitchen-sections/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kitchen-sections"] });
      toast({
        title: language === "ar" ? "تم الحذف" : "Section Deleted",
        description: language === "ar" ? "تم حذف القسم بنجاح" : "Kitchen section deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: t("error"),
        description: language === "ar" ? "فشل في حذف القسم" : "Failed to delete section",
        variant: "destructive",
      });
    },
  });

  const handleOpenDialog = (section?: KitchenSection) => {
    if (section) {
      setEditingSection(section);
      setFormData({
        nameEn: section.nameEn,
        nameAr: section.nameAr,
        icon: section.icon || "",
        color: section.color || "#8B1A1A",
        sortOrder: section.sortOrder || 0,
      });
    } else {
      setEditingSection(null);
      setFormData({
        nameEn: "",
        nameAr: "",
        icon: "",
        color: "#8B1A1A",
        sortOrder: (sections?.length || 0) + 1,
      });
    }
    setShowDialog(true);
  };

  const handleCloseDialog = () => {
    setShowDialog(false);
    setEditingSection(null);
    setFormData({ nameEn: "", nameAr: "", icon: "", color: "#8B1A1A", sortOrder: 0 });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSection) {
      updateMutation.mutate({ id: editingSection.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm(language === "ar" ? "هل تريد حذف هذا القسم؟" : "Delete this section?")) {
      deleteMutation.mutate(id);
    }
  };

  const commonIcons = ["🥗", "🍖", "🍕", "🍰", "🚚", "🍜", "🍔", "🍣", "🥘", "☕"];

  if (isLoading) {
    return (
      <div className="p-6 space-y-6" dir={direction}>
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6" dir={direction}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ChefHat className="h-8 w-8 text-orange-600 dark:text-orange-400" />
          <h1 className="text-2xl font-bold">
            {language === "ar" ? "أقسام المطبخ" : "Kitchen Sections"}
          </h1>
        </div>
        <Button onClick={() => handleOpenDialog()} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          {language === "ar" ? "إضافة قسم" : "Add Section"}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {language === "ar" ? "إدارة أقسام المطبخ" : "Manage Kitchen Sections"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!sections || sections.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ChefHat className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>{language === "ar" ? "لا توجد أقسام مطبخ بعد" : "No kitchen sections yet"}</p>
              <p className="text-sm mt-1">
                {language === "ar" 
                  ? "أضف أقسام لتنظيم المطبخ (مقبلات، مشاوي، بيتزا، إلخ)" 
                  : "Add sections to organize your kitchen (appetizers, grills, pizza, etc.)"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead className="w-16">{language === "ar" ? "أيقونة" : "Icon"}</TableHead>
                  <TableHead>{language === "ar" ? "الاسم" : "Name"}</TableHead>
                  <TableHead className="w-24">{language === "ar" ? "اللون" : "Color"}</TableHead>
                  <TableHead className="w-24">{language === "ar" ? "الحالة" : "Status"}</TableHead>
                  <TableHead className="w-32 text-end">{language === "ar" ? "إجراءات" : "Actions"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sections.map((section) => (
                  <TableRow key={section.id}>
                    <TableCell>
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                    <TableCell>
                      <span className="text-2xl">{section.icon || "🍽️"}</span>
                    </TableCell>
                    <TableCell className="font-medium">
                      {getLocalizedName(section.nameEn, section.nameAr)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-6 h-6 rounded border" 
                          style={{ backgroundColor: section.color || '#8B1A1A' }}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      {section.isActive ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          {language === "ar" ? "نشط" : "Active"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                          {language === "ar" ? "غير نشط" : "Inactive"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(section)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(section.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent dir={direction}>
          <DialogHeader>
            <DialogTitle>
              {editingSection
                ? (language === "ar" ? "تعديل القسم" : "Edit Section")
                : (language === "ar" ? "إضافة قسم جديد" : "Add New Section")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nameEn">{language === "ar" ? "الاسم بالإنجليزية" : "Name (English)"}</Label>
              <Input
                id="nameEn"
                value={formData.nameEn}
                onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                placeholder="Appetizers"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nameAr">{language === "ar" ? "الاسم بالعربية" : "Name (Arabic)"}</Label>
              <Input
                id="nameAr"
                value={formData.nameAr}
                onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                placeholder="المقبلات"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{language === "ar" ? "الأيقونة" : "Icon"}</Label>
              <div className="flex gap-2 flex-wrap">
                {commonIcons.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    className={`w-10 h-10 rounded-lg border-2 flex items-center justify-center text-xl hover:border-primary transition-colors ${
                      formData.icon === icon ? 'border-primary bg-primary/10' : 'border-border'
                    }`}
                    onClick={() => setFormData({ ...formData, icon })}
                  >
                    {icon}
                  </button>
                ))}
              </div>
              <Input
                value={formData.icon}
                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                placeholder="🍽️"
                className="text-center text-2xl h-12"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">{language === "ar" ? "اللون" : "Color"}</Label>
              <div className="flex gap-2">
                <Input
                  id="color"
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-20 h-10"
                />
                <Input
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="#8B1A1A"
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sortOrder">{language === "ar" ? "ترتيب العرض" : "Sort Order"}</Label>
              <Input
                id="sortOrder"
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                min="0"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                {t("cancel")}
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingSection ? t("save") : (language === "ar" ? "إضافة" : "Add")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

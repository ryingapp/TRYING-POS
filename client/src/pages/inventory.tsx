import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, Edit2, Trash2, Package, ArrowUpCircle, ArrowDownCircle, AlertTriangle, History } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";
import { useBranch } from "@/lib/branch";

import { queryClient, apiRequest } from "@/lib/queryClient";
import type { InventoryItem, InventoryTransaction, InsertInventoryItem, InsertInventoryTransaction } from "@shared/schema";
import { inventoryUnits, inventoryCategories, inventoryTransactionTypes } from "@shared/schema";

const inventoryItemSchema = z.object({
  name: z.string().min(1, "Required"),
  nameAr: z.string().optional(),
  unit: z.string().min(1, "Required"),
  category: z.string().optional(),
  minStock: z.string().optional(),
  costPerUnit: z.string().optional(),
});

const transactionSchema = z.object({
  type: z.string().min(1, "Required"),
  quantity: z.string().min(1, "Required"),
  unitCost: z.string().optional(),
  notes: z.string().optional(),
});

const unitLabels: Record<string, { en: string; ar: string }> = {
  kg: { en: "Kilogram", ar: "كيلوغرام" },
  g: { en: "Gram", ar: "غرام" },
  liter: { en: "Liter", ar: "لتر" },
  ml: { en: "Milliliter", ar: "مليلتر" },
  piece: { en: "Piece", ar: "قطعة" },
  box: { en: "Box", ar: "صندوق" },
  pack: { en: "Pack", ar: "عبوة" },
  dozen: { en: "Dozen", ar: "دستة" },
};

const categoryLabels: Record<string, { en: string; ar: string }> = {
  vegetables: { en: "Vegetables", ar: "خضروات" },
  fruits: { en: "Fruits", ar: "فواكه" },
  meat: { en: "Meat", ar: "لحوم" },
  poultry: { en: "Poultry", ar: "دواجن" },
  seafood: { en: "Seafood", ar: "مأكولات بحرية" },
  dairy: { en: "Dairy", ar: "ألبان" },
  grains: { en: "Grains", ar: "حبوب" },
  spices: { en: "Spices", ar: "توابل" },
  beverages: { en: "Beverages", ar: "مشروبات" },
  packaging: { en: "Packaging", ar: "تغليف" },
  other: { en: "Other", ar: "أخرى" },
};

const transactionTypeLabels: Record<string, { en: string; ar: string }> = {
  purchase: { en: "Purchase", ar: "شراء" },
  usage: { en: "Usage", ar: "استخدام" },
  adjustment: { en: "Adjustment", ar: "تعديل" },
  transfer: { en: "Transfer", ar: "تحويل" },
  waste: { en: "Waste", ar: "هدر" },
  return: { en: "Return", ar: "إرجاع" },
};

function InventoryItemForm({ 
  item, 
  onSuccess 
}: { 
  item?: InventoryItem; 
  onSuccess: () => void;
}) {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const { selectedBranchId } = useBranch();

  const form = useForm<z.infer<typeof inventoryItemSchema>>({
    resolver: zodResolver(inventoryItemSchema),
    defaultValues: {
      name: item?.name || "",
      nameAr: item?.nameAr || "",
      unit: item?.unit || "",
      category: item?.category || "",
      minStock: item?.minStock || "0",
      costPerUnit: item?.costPerUnit || "0",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertInventoryItem) => apiRequest("POST", "/api/inventory", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => 
        typeof query.queryKey[0] === 'string' && query.queryKey[0].startsWith('/api/inventory')
      });
      toast({ title: language === "ar" ? "تم إضافة المادة" : "Item added successfully" });
      onSuccess();
    },
    onError: () => {
      toast({ title: language === "ar" ? "فشل في إضافة المادة" : "Failed to add item", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: Partial<InsertInventoryItem>) => 
      apiRequest("PUT", `/api/inventory/${item?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => 
        typeof query.queryKey[0] === 'string' && query.queryKey[0].startsWith('/api/inventory')
      });
      toast({ title: language === "ar" ? "تم تحديث المادة" : "Item updated successfully" });
      onSuccess();
    },
    onError: () => {
      toast({ title: language === "ar" ? "فشل في تحديث المادة" : "Failed to update item", variant: "destructive" });
    },
  });

  const onSubmit = (data: z.infer<typeof inventoryItemSchema>) => {
    const payload: InsertInventoryItem = {
      ...data,
      restaurantId: "default",
      branchId: selectedBranchId || undefined,
    };
    if (item) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{language === "ar" ? "الاسم (EN)" : "Name (EN)"}</FormLabel>
                <FormControl>
                  <Input {...field} data-testid="input-inventory-name" />
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
                <FormLabel>{language === "ar" ? "الاسم (AR)" : "Name (AR)"}</FormLabel>
                <FormControl>
                  <Input {...field} dir="rtl" data-testid="input-inventory-name-ar" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="unit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{language === "ar" ? "الوحدة" : "Unit"}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-inventory-unit">
                      <SelectValue placeholder={language === "ar" ? "اختر الوحدة" : "Select unit"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {inventoryUnits.map((unit) => (
                      <SelectItem key={unit} value={unit}>
                        {language === "ar" ? unitLabels[unit]?.ar : unitLabels[unit]?.en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{language === "ar" ? "الفئة" : "Category"}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger data-testid="select-inventory-category">
                      <SelectValue placeholder={language === "ar" ? "اختر الفئة" : "Select category"} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {inventoryCategories.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {language === "ar" ? categoryLabels[cat]?.ar : categoryLabels[cat]?.en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="minStock"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{language === "ar" ? "الحد الأدنى" : "Min Stock"}</FormLabel>
                <FormControl>
                  <Input {...field} type="number" step="0.01" data-testid="input-inventory-min-stock" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="costPerUnit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{language === "ar" ? "التكلفة/الوحدة" : "Cost per Unit"}</FormLabel>
                <FormControl>
                  <Input {...field} type="number" step="0.01" data-testid="input-inventory-cost" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <Button type="submit" disabled={isPending} className="w-full" data-testid="button-save-inventory">
          {isPending ? (language === "ar" ? "جاري الحفظ..." : "Saving...") : (language === "ar" ? "حفظ" : "Save")}
        </Button>
      </form>
    </Form>
  );
}

function TransactionForm({ 
  item, 
  onSuccess 
}: { 
  item: InventoryItem; 
  onSuccess: () => void;
}) {
  const { language } = useLanguage();
  const { toast } = useToast();
  const { selectedBranchId } = useBranch();

  const form = useForm<z.infer<typeof transactionSchema>>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: "",
      quantity: "",
      unitCost: "",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: InsertInventoryTransaction) => 
      apiRequest("POST", `/api/inventory/${item.id}/transactions`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => 
        typeof query.queryKey[0] === 'string' && query.queryKey[0].startsWith('/api/inventory')
      });
      toast({ title: language === "ar" ? "تم تسجيل الحركة" : "Transaction recorded" });
      onSuccess();
    },
    onError: () => {
      toast({ title: language === "ar" ? "فشل في تسجيل الحركة" : "Failed to record transaction", variant: "destructive" });
    },
  });

  const onSubmit = (data: z.infer<typeof transactionSchema>) => {
    const quantity = parseFloat(data.quantity);
    const unitCost = data.unitCost ? parseFloat(data.unitCost) : undefined;
    const totalCost = unitCost ? (quantity * unitCost).toFixed(2) : undefined;
    
    const payload: InsertInventoryTransaction = {
      inventoryItemId: item.id,
      type: data.type,
      quantity: data.quantity,
      unitCost: unitCost?.toString(),
      totalCost,
      notes: data.notes,
      branchId: selectedBranchId || undefined,
    };
    createMutation.mutate(payload);
  };

  const selectedType = form.watch("type");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{language === "ar" ? "نوع الحركة" : "Transaction Type"}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger data-testid="select-transaction-type">
                    <SelectValue placeholder={language === "ar" ? "اختر النوع" : "Select type"} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {inventoryTransactionTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {language === "ar" ? transactionTypeLabels[type]?.ar : transactionTypeLabels[type]?.en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="quantity"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {language === "ar" ? "الكمية" : "Quantity"} ({language === "ar" ? unitLabels[item.unit]?.ar : unitLabels[item.unit]?.en})
              </FormLabel>
              <FormControl>
                <Input {...field} type="number" step="0.01" data-testid="input-transaction-quantity" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {selectedType === "purchase" && (
          <FormField
            control={form.control}
            name="unitCost"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{language === "ar" ? "سعر الوحدة" : "Unit Cost"}</FormLabel>
                <FormControl>
                  <Input {...field} type="number" step="0.01" data-testid="input-transaction-cost" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{language === "ar" ? "ملاحظات" : "Notes"}</FormLabel>
              <FormControl>
                <Textarea {...field} data-testid="input-transaction-notes" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={createMutation.isPending} className="w-full" data-testid="button-save-transaction">
          {createMutation.isPending ? (language === "ar" ? "جاري الحفظ..." : "Saving...") : (language === "ar" ? "تسجيل" : "Record")}
        </Button>
      </form>
    </Form>
  );
}

function TransactionHistory({ item }: { item: InventoryItem }) {
  const { language } = useLanguage();
  
  const { data: transactions, isLoading } = useQuery<InventoryTransaction[]>({
    queryKey: [`/api/inventory/${item.id}/transactions`],
  });

  if (isLoading) {
    return <Skeleton className="h-32 w-full" />;
  }

  if (!transactions || transactions.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8">
        {language === "ar" ? "لا توجد حركات" : "No transactions yet"}
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{language === "ar" ? "النوع" : "Type"}</TableHead>
          <TableHead>{language === "ar" ? "الكمية" : "Quantity"}</TableHead>
          <TableHead>{language === "ar" ? "التكلفة" : "Cost"}</TableHead>
          <TableHead>{language === "ar" ? "التاريخ" : "Date"}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((tx) => (
          <TableRow key={tx.id}>
            <TableCell>
              <Badge variant={tx.type === "purchase" || tx.type === "return" ? "default" : "secondary"}>
                {language === "ar" ? transactionTypeLabels[tx.type]?.ar : transactionTypeLabels[tx.type]?.en}
              </Badge>
            </TableCell>
            <TableCell>
              {tx.type === "purchase" || tx.type === "return" ? "+" : "-"}
              {tx.quantity}
            </TableCell>
            <TableCell>{tx.totalCost ? `${tx.totalCost} SAR` : "-"}</TableCell>
            <TableCell>{tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : "-"}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function Inventory() {
  const { language } = useLanguage();
  const { selectedBranchId } = useBranch();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [transactionItem, setTransactionItem] = useState<InventoryItem | null>(null);
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);

  const inventoryUrl = selectedBranchId 
    ? `/api/inventory?branch=${selectedBranchId}` 
    : "/api/inventory";

  const { data: items, isLoading } = useQuery<InventoryItem[]>({
    queryKey: [inventoryUrl],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/inventory/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => 
        typeof query.queryKey[0] === 'string' && query.queryKey[0].startsWith('/api/inventory')
      });
      toast({ title: language === "ar" ? "تم حذف المادة" : "Item deleted" });
    },
    onError: () => {
      toast({ title: language === "ar" ? "فشل في حذف المادة" : "Failed to delete item", variant: "destructive" });
    },
  });

  const filteredItems = items?.filter((item) => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.nameAr && item.nameAr.includes(searchQuery));
    const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const lowStockItems = filteredItems?.filter((item) => {
    const current = parseFloat(item.currentStock || "0");
    const min = parseFloat(item.minStock || "0");
    return current <= min && min > 0;
  });

  const totalValue = filteredItems?.reduce((acc, item) => {
    const stock = parseFloat(item.currentStock || "0");
    const cost = parseFloat(item.costPerUnit || "0");
    return acc + (stock * cost);
  }, 0) || 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {language === "ar" ? "إدارة المخزون" : "Inventory Management"}
          </h1>
          <p className="text-muted-foreground">
            {language === "ar" ? "تتبع المواد الخام والمكونات" : "Track raw materials and ingredients"}
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-inventory">
          <Plus className="w-4 h-4 mr-2" />
          {language === "ar" ? "إضافة مادة" : "Add Item"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "ar" ? "إجمالي المواد" : "Total Items"}
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredItems?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "ar" ? "قيمة المخزون" : "Inventory Value"}
            </CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalValue.toFixed(2)} SAR</div>
          </CardContent>
        </Card>
        <Card className={lowStockItems && lowStockItems.length > 0 ? "border-destructive" : ""}>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "ar" ? "مواد منخفضة" : "Low Stock Items"}
            </CardTitle>
            <AlertTriangle className={`h-4 w-4 ${lowStockItems && lowStockItems.length > 0 ? "text-destructive" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${lowStockItems && lowStockItems.length > 0 ? "text-destructive" : ""}`}>
              {lowStockItems?.length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder={language === "ar" ? "بحث..." : "Search..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-inventory"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-48" data-testid="select-filter-category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{language === "ar" ? "كل الفئات" : "All Categories"}</SelectItem>
            {inventoryCategories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {language === "ar" ? categoryLabels[cat]?.ar : categoryLabels[cat]?.en}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filteredItems && filteredItems.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === "ar" ? "المادة" : "Item"}</TableHead>
                <TableHead>{language === "ar" ? "الفئة" : "Category"}</TableHead>
                <TableHead>{language === "ar" ? "المخزون" : "Stock"}</TableHead>
                <TableHead>{language === "ar" ? "الحد الأدنى" : "Min"}</TableHead>
                <TableHead>{language === "ar" ? "التكلفة" : "Cost"}</TableHead>
                <TableHead>{language === "ar" ? "الإجراءات" : "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.map((item) => {
                const current = parseFloat(item.currentStock || "0");
                const min = parseFloat(item.minStock || "0");
                const isLow = current <= min && min > 0;
                
                return (
                  <TableRow key={item.id} data-testid={`row-inventory-${item.id}`}>
                    <TableCell>
                      <div className="font-medium">{language === "ar" && item.nameAr ? item.nameAr : item.name}</div>
                      {language === "ar" && <div className="text-sm text-muted-foreground">{item.name}</div>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {item.category ? (language === "ar" ? categoryLabels[item.category]?.ar : categoryLabels[item.category]?.en) : "-"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={isLow ? "text-destructive font-medium" : ""}>
                        {item.currentStock} {language === "ar" ? unitLabels[item.unit]?.ar : unitLabels[item.unit]?.en}
                      </span>
                      {isLow && <AlertTriangle className="inline-block ml-2 h-4 w-4 text-destructive" />}
                    </TableCell>
                    <TableCell>{item.minStock}</TableCell>
                    <TableCell>{item.costPerUnit} SAR</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setTransactionItem(item)}
                          title={language === "ar" ? "إضافة حركة" : "Add Transaction"}
                          data-testid={`button-transaction-${item.id}`}
                        >
                          <ArrowDownCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setHistoryItem(item)}
                          title={language === "ar" ? "السجل" : "History"}
                          data-testid={`button-history-${item.id}`}
                        >
                          <History className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setEditingItem(item)}
                          data-testid={`button-edit-${item.id}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => { if (window.confirm('هل أنت متأكد من حذف هذا العنصر؟')) deleteMutation.mutate(item.id); }}
                          data-testid={`button-delete-${item.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card className="p-12 text-center">
          <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">
            {language === "ar" ? "لا توجد مواد" : "No inventory items"}
          </h3>
          <p className="text-muted-foreground mb-4">
            {language === "ar" ? "ابدأ بإضافة مواد المخزون" : "Start by adding inventory items"}
          </p>
          <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-first-inventory">
            <Plus className="w-4 h-4 mr-2" />
            {language === "ar" ? "إضافة مادة" : "Add Item"}
          </Button>
        </Card>
      )}

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "إضافة مادة جديدة" : "Add New Item"}</DialogTitle>
          </DialogHeader>
          <InventoryItemForm onSuccess={() => setIsAddDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "تعديل المادة" : "Edit Item"}</DialogTitle>
          </DialogHeader>
          {editingItem && (
            <InventoryItemForm item={editingItem} onSuccess={() => setEditingItem(null)} />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!transactionItem} onOpenChange={(open) => !open && setTransactionItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === "ar" ? "تسجيل حركة" : "Record Transaction"}: {transactionItem?.name}
            </DialogTitle>
          </DialogHeader>
          {transactionItem && (
            <TransactionForm item={transactionItem} onSuccess={() => setTransactionItem(null)} />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyItem} onOpenChange={(open) => !open && setHistoryItem(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {language === "ar" ? "سجل الحركات" : "Transaction History"}: {historyItem?.name}
            </DialogTitle>
          </DialogHeader>
          {historyItem && <TransactionHistory item={historyItem} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

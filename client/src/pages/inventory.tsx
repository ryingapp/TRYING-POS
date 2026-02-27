import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, Edit2, Trash2, Package, ArrowUpCircle, ArrowDownCircle, AlertTriangle, History, Download, FileSpreadsheet, FileText, Printer, BarChart3, TrendingDown, Boxes } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

/* ══════════════════════════════════════════════════════════
   Export Helpers
   ══════════════════════════════════════════════════════════ */

function exportToCSV(data: any[], filename: string, headers: { key: string; label: string }[]) {
  const csv = [
    headers.map(h => `"${h.label}"`).join(","),
    ...data.map(row => headers.map(h => `"${row[h.key] ?? ""}"`).join(",")),
  ].join("\n");
  downloadBlob(csv, `${filename}.csv`, "text/csv;charset=utf-8;");
}

function exportToExcel(data: any[], filename: string, headers: { key: string; label: string }[]) {
  const tsv = [
    headers.map(h => h.label).join("\t"),
    ...data.map(row => headers.map(h => `${row[h.key] ?? ""}`).join("\t")),
  ].join("\n");
  downloadBlob(tsv, `${filename}.xls`, "application/vnd.ms-excel;charset=utf-8;");
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob(["\ufeff" + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function generateInventoryPDF(opts: {
  language: string;
  restaurantName: string;
  branchName?: string;
  items: InventoryItem[];
  lowStockItems: InventoryItem[];
  totalValue: number;
  categoryBreakdown: { category: string; count: number; value: number }[];
}) {
  const ar = opts.language === "ar";
  const dir = ar ? "rtl" : "ltr";
  const f = (v: number) => `${v.toFixed(2)} ${ar ? "ر.س" : "SAR"}`;
  const now = new Date();
  const dateStr = now.toLocaleDateString(ar ? "ar-SA" : "en-US", {
    year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const title = ar ? "تقرير المخزون" : "Inventory Report";

  /* summary cards */
  const summaryCards = `
    <div class="g4">
      <div class="sc"><div class="sl">${ar ? "إجمالي المواد" : "Total Items"}</div><div class="sv">${opts.items.length}</div><div class="ss">${ar ? "مادة في المخزون" : "items in stock"}</div></div>
      <div class="sc"><div class="sl">${ar ? "قيمة المخزون" : "Inventory Value"}</div><div class="sv">${f(opts.totalValue)}</div><div class="ss">${ar ? "إجمالي القيمة" : "total value"}</div></div>
      <div class="sc${opts.lowStockItems.length > 0 ? " brd" : ""}"><div class="sl">${ar ? "مواد منخفضة" : "Low Stock"}</div><div class="sv${opts.lowStockItems.length > 0 ? " red" : ""}">${opts.lowStockItems.length}</div><div class="ss">${ar ? "تحتاج إعادة طلب" : "need reorder"}</div></div>
      <div class="sc"><div class="sl">${ar ? "الفئات" : "Categories"}</div><div class="sv">${opts.categoryBreakdown.length}</div><div class="ss">${ar ? "فئة مخزون" : "categories"}</div></div>
    </div>`;

  /* full stock table */
  const stockRows = opts.items.map(item => {
    const current = parseFloat(item.currentStock || "0");
    const min = parseFloat(item.minStock || "0");
    const cost = parseFloat(item.costPerUnit || "0");
    const value = current * cost;
    const isLow = current <= min && min > 0;
    const catLabel = item.category ? (ar ? categoryLabels[item.category]?.ar : categoryLabels[item.category]?.en) : "-";
    const unitLabel = ar ? unitLabels[item.unit]?.ar : unitLabels[item.unit]?.en;
    return `<tr${isLow ? ' class="low"' : ""}>
      <td class="b">${ar ? (item.nameAr || item.name) : item.name}</td>
      <td>${catLabel}</td>
      <td>${current} ${unitLabel}</td>
      <td>${min}</td>
      <td>${f(cost)}</td>
      <td class="b">${f(value)}</td>
      <td>${isLow ? (ar ? "⚠ منخفض" : "⚠ Low") : (ar ? "✓ جيد" : "✓ OK")}</td>
    </tr>`;
  }).join("");

  const stockTable = `
    <div class="sec"><h2>📦 ${ar ? "تفاصيل المخزون" : "Stock Details"}</h2>
    <table><thead><tr>
      <th>${ar ? "المادة" : "Item"}</th><th>${ar ? "الفئة" : "Category"}</th><th>${ar ? "المخزون" : "Stock"}</th>
      <th>${ar ? "الحد الأدنى" : "Min"}</th><th>${ar ? "تكلفة الوحدة" : "Unit Cost"}</th><th>${ar ? "القيمة" : "Value"}</th><th>${ar ? "الحالة" : "Status"}</th>
    </tr></thead><tbody>${stockRows}</tbody>
    <tfoot><tr class="tot"><td class="b" colspan="5">${ar ? "الإجمالي" : "Total"}</td><td class="b">${f(opts.totalValue)}</td><td></td></tr></tfoot></table></div>`;

  /* low stock table */
  const lowStockSection = opts.lowStockItems.length > 0 ? `
    <div class="sec"><h2>⚠️ ${ar ? "مواد تحتاج إعادة طلب" : "Items Needing Reorder"}</h2>
    <table><thead><tr>
      <th>${ar ? "المادة" : "Item"}</th><th>${ar ? "المخزون الحالي" : "Current"}</th><th>${ar ? "الحد الأدنى" : "Min"}</th><th>${ar ? "النقص" : "Deficit"}</th>
    </tr></thead><tbody>${opts.lowStockItems.map(item => {
      const current = parseFloat(item.currentStock || "0");
      const min = parseFloat(item.minStock || "0");
      const unitLabel = ar ? unitLabels[item.unit]?.ar : unitLabels[item.unit]?.en;
      return `<tr><td class="b">${ar ? (item.nameAr || item.name) : item.name}</td><td class="red">${current} ${unitLabel}</td><td>${min} ${unitLabel}</td><td class="red b">${(min - current).toFixed(2)} ${unitLabel}</td></tr>`;
    }).join("")}</tbody></table></div>` : "";

  /* category breakdown */
  const catRows = opts.categoryBreakdown.map(c => 
    `<tr><td class="b">${c.category}</td><td>${c.count}</td><td class="b">${f(c.value)}</td><td>${opts.totalValue > 0 ? ((c.value / opts.totalValue) * 100).toFixed(1) : 0}%</td></tr>`
  ).join("");
  const catTable = catRows ? `
    <div class="sec"><h2>📊 ${ar ? "توزيع المخزون حسب الفئة" : "Stock by Category"}</h2>
    <table><thead><tr><th>${ar ? "الفئة" : "Category"}</th><th>${ar ? "العدد" : "Count"}</th><th>${ar ? "القيمة" : "Value"}</th><th>${ar ? "النسبة" : "Share"}</th></tr></thead><tbody>${catRows}</tbody></table></div>` : "";

  const html = `<!DOCTYPE html><html lang="${ar ? "ar" : "en"}" dir="${dir}"><head><meta charset="UTF-8">
<title>${title} — ${opts.restaurantName}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Tahoma,Verdana,sans-serif;direction:${dir};text-align:${ar ? "right" : "left"};color:#1a1a2e;background:#fff;font-size:13px;line-height:1.6}
.hd{background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);color:#fff;padding:28px 36px;display:flex;justify-content:space-between;align-items:center}
.hd h1{font-size:21px;font-weight:700;margin-bottom:3px}
.hd .sub{opacity:.75;font-size:12px}
.hd .rn{font-size:17px;font-weight:700;margin-bottom:3px}
.hd .ri{font-size:11px;opacity:.7}
.mb{background:#f8f9fa;padding:9px 36px;font-size:11px;color:#666;display:flex;justify-content:space-between;border-bottom:2px solid #e9ecef}
.g4{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;padding:18px 36px}
.sc{background:#f8f9fa;border-radius:10px;padding:14px;border:1px solid #e9ecef}
.sl{font-size:10px;color:#666;text-transform:uppercase;font-weight:600;letter-spacing:.3px}
.sv{font-size:19px;font-weight:700;color:#1a1a2e;margin:3px 0}
.ss{font-size:11px;color:#888}
.sec{padding:10px 36px 18px}
.sec h2{font-size:15px;font-weight:700;color:#1a1a2e;margin-bottom:10px;padding-bottom:5px;border-bottom:2px solid #f97316;display:inline-block}
table{width:100%;border-collapse:collapse;margin-bottom:10px;font-size:12px}
th{background:#1a1a2e;color:#fff;padding:7px 9px;font-weight:600;font-size:10.5px;text-transform:uppercase}
td{padding:6px 9px;border-bottom:1px solid #eee}
tr:nth-child(even){background:#f8f9fa}
.tot{background:#1a1a2e!important;color:#fff}
.tot td{border-bottom:none;font-weight:700}
.b{font-weight:700}
.red{color:#dc2626}
.brd{border:2px solid #dc2626}
.low td{background:#fef2f2!important}
.ft{text-align:center;padding:18px 36px;font-size:10px;color:#999;border-top:1px solid #eee;margin-top:16px}
@media print{body{padding:0}.hd,th,.tot,.sc{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="hd">
  <div><h1>${title}</h1>${opts.branchName ? `<p class="sub">${ar ? "فرع: " : "Branch: "}${opts.branchName}</p>` : ""}</div>
  <div style="text-align:${ar ? "left" : "right"}"><div class="rn">${opts.restaurantName}</div></div>
</div>
<div class="mb"><span>${ar ? "تقرير المخزون الشامل" : "Comprehensive Inventory Report"}</span><span>${ar ? "تاريخ التقرير" : "Generated"}: ${dateStr}</span></div>
${summaryCards}${lowStockSection}${stockTable}${catTable}
<div class="ft">${ar ? "تم إنشاء هذا التقرير آلياً بواسطة نظام" : "Auto-generated by"} ${opts.restaurantName} POS — ${dateStr}</div>
<script>window.onload=function(){window.print()}</script>
</body></html>`;

  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
}

/* ══════════════════════════════════════════════════════════
   Inventory Reports Component
   ══════════════════════════════════════════════════════════ */

function InventoryReports({ items }: { items: InventoryItem[] }) {
  const { language } = useLanguage();
  const { selectedBranch } = useBranch();
  const ar = language === "ar";

  const { data: restaurant } = useQuery<any>({ queryKey: ["/api/restaurant"] });

  const lowStockItems = useMemo(() => 
    items.filter(item => {
      const current = parseFloat(item.currentStock || "0");
      const min = parseFloat(item.minStock || "0");
      return current <= min && min > 0;
    }), [items]);

  const totalValue = useMemo(() => 
    items.reduce((acc, item) => {
      return acc + parseFloat(item.currentStock || "0") * parseFloat(item.costPerUnit || "0");
    }, 0), [items]);

  const categoryBreakdown = useMemo(() => {
    const map: Record<string, { count: number; value: number }> = {};
    items.forEach(item => {
      const cat = item.category || "other";
      const label = ar ? categoryLabels[cat]?.ar : categoryLabels[cat]?.en;
      if (!map[label]) map[label] = { count: 0, value: 0 };
      map[label].count++;
      map[label].value += parseFloat(item.currentStock || "0") * parseFloat(item.costPerUnit || "0");
    });
    return Object.entries(map)
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.value - a.value);
  }, [items, ar]);

  const stockDistribution = useMemo(() => {
    let good = 0, low = 0, out = 0;
    items.forEach(item => {
      const current = parseFloat(item.currentStock || "0");
      const min = parseFloat(item.minStock || "0");
      if (current <= 0) out++;
      else if (current <= min && min > 0) low++;
      else good++;
    });
    return { good, low, out };
  }, [items]);

  const exportData = useMemo(() => items.map(item => ({
    name: ar ? (item.nameAr || item.name) : item.name,
    category: item.category ? (ar ? categoryLabels[item.category]?.ar : categoryLabels[item.category]?.en) : "-",
    stock: item.currentStock,
    unit: ar ? unitLabels[item.unit]?.ar : unitLabels[item.unit]?.en,
    minStock: item.minStock || "0",
    costPerUnit: item.costPerUnit || "0",
    totalValue: (parseFloat(item.currentStock || "0") * parseFloat(item.costPerUnit || "0")).toFixed(2),
    status: (() => {
      const c = parseFloat(item.currentStock || "0");
      const m = parseFloat(item.minStock || "0");
      if (c <= 0) return ar ? "نفد" : "Out";
      if (c <= m && m > 0) return ar ? "منخفض" : "Low";
      return ar ? "جيد" : "OK";
    })(),
  })), [items, ar]);

  const headers = [
    { key: "name", label: ar ? "المادة" : "Item" },
    { key: "category", label: ar ? "الفئة" : "Category" },
    { key: "stock", label: ar ? "المخزون" : "Stock" },
    { key: "unit", label: ar ? "الوحدة" : "Unit" },
    { key: "minStock", label: ar ? "الحد الأدنى" : "Min Stock" },
    { key: "costPerUnit", label: ar ? "تكلفة الوحدة" : "Unit Cost" },
    { key: "totalValue", label: ar ? "القيمة" : "Value" },
    { key: "status", label: ar ? "الحالة" : "Status" },
  ];

  const handleExportCSV = () => exportToCSV(exportData, ar ? "تقرير-المخزون" : "inventory-report", headers);
  const handleExportExcel = () => exportToExcel(exportData, ar ? "تقرير-المخزون" : "inventory-report", headers);
  const handleExportPDF = () => generateInventoryPDF({
    language,
    restaurantName: restaurant?.name || "Restaurant",
    branchName: selectedBranch ? (ar ? selectedBranch.nameAr : selectedBranch.name) : undefined,
    items,
    lowStockItems,
    totalValue,
    categoryBreakdown,
  });

  return (
    <div className="space-y-6">
      {/* Header with export */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">{ar ? "تقرير المخزون" : "Inventory Report"}</h2>
          <p className="text-sm text-muted-foreground">{ar ? "نظرة شاملة على حالة المخزون" : "Comprehensive stock overview"}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline"><Download className="w-4 h-4 ltr:mr-2 rtl:ml-2" />{ar ? "تصدير" : "Export"}</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleExportPDF}><Printer className="w-4 h-4 ltr:mr-2 rtl:ml-2" />PDF</DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportCSV}><FileText className="w-4 h-4 ltr:mr-2 rtl:ml-2" />CSV</DropdownMenuItem>
            <DropdownMenuItem onClick={handleExportExcel}><FileSpreadsheet className="w-4 h-4 ltr:mr-2 rtl:ml-2" />Excel</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{ar ? "إجمالي المواد" : "Total Items"}</CardTitle>
            <Boxes className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{items.length}</div>
            <p className="text-xs text-muted-foreground">{ar ? "مادة في المخزون" : "items in inventory"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{ar ? "قيمة المخزون" : "Inventory Value"}</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalValue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">{ar ? "ر.س" : "SAR"}</p>
          </CardContent>
        </Card>
        <Card className={lowStockItems.length > 0 ? "border-orange-400" : ""}>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{ar ? "مخزون منخفض" : "Low Stock"}</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${lowStockItems.length > 0 ? "text-orange-500" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${lowStockItems.length > 0 ? "text-orange-500" : ""}`}>{lowStockItems.length}</div>
            <p className="text-xs text-muted-foreground">{ar ? "تحتاج إعادة طلب" : "need reorder"}</p>
          </CardContent>
        </Card>
        <Card className={stockDistribution.out > 0 ? "border-destructive" : ""}>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{ar ? "نفد المخزون" : "Out of Stock"}</CardTitle>
            <TrendingDown className={`h-4 w-4 ${stockDistribution.out > 0 ? "text-destructive" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stockDistribution.out > 0 ? "text-destructive" : ""}`}>{stockDistribution.out}</div>
            <p className="text-xs text-muted-foreground">{ar ? "مادة نفدت" : "items depleted"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Stock health bar */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{ar ? "صحة المخزون" : "Stock Health"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden flex">
              {items.length > 0 && (
                <>
                  <div className="bg-green-500 h-full transition-all" style={{ width: `${(stockDistribution.good / items.length) * 100}%` }} />
                  <div className="bg-orange-400 h-full transition-all" style={{ width: `${(stockDistribution.low / items.length) * 100}%` }} />
                  <div className="bg-red-500 h-full transition-all" style={{ width: `${(stockDistribution.out / items.length) * 100}%` }} />
                </>
              )}
            </div>
          </div>
          <div className="flex gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>{ar ? "جيد" : "Good"}: {stockDistribution.good}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-orange-400" />
              <span>{ar ? "منخفض" : "Low"}: {stockDistribution.low}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-red-500" />
              <span>{ar ? "نفد" : "Out"}: {stockDistribution.out}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low stock alerts */}
        {lowStockItems.length > 0 && (
          <Card className="border-orange-400">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                {ar ? "تنبيهات المخزون المنخفض" : "Low Stock Alerts"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{ar ? "المادة" : "Item"}</TableHead>
                    <TableHead>{ar ? "الحالي" : "Current"}</TableHead>
                    <TableHead>{ar ? "الأدنى" : "Min"}</TableHead>
                    <TableHead>{ar ? "النقص" : "Deficit"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStockItems.map(item => {
                    const current = parseFloat(item.currentStock || "0");
                    const min = parseFloat(item.minStock || "0");
                    const unitLabel = ar ? unitLabels[item.unit]?.ar : unitLabels[item.unit]?.en;
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{ar ? (item.nameAr || item.name) : item.name}</TableCell>
                        <TableCell className="text-destructive font-medium">{current} {unitLabel}</TableCell>
                        <TableCell>{min} {unitLabel}</TableCell>
                        <TableCell className="text-destructive font-bold">{(min - current).toFixed(2)} {unitLabel}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Category breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-500" />
              {ar ? "توزيع المخزون حسب الفئة" : "Stock by Category"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{ar ? "الفئة" : "Category"}</TableHead>
                  <TableHead>{ar ? "العدد" : "Count"}</TableHead>
                  <TableHead>{ar ? "القيمة" : "Value"}</TableHead>
                  <TableHead>{ar ? "النسبة" : "Share"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categoryBreakdown.map(c => (
                  <TableRow key={c.category}>
                    <TableCell className="font-medium">{c.category}</TableCell>
                    <TableCell>{c.count}</TableCell>
                    <TableCell className="font-medium">{c.value.toFixed(2)} {ar ? "ر.س" : "SAR"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full" style={{ width: `${totalValue > 0 ? (c.value / totalValue) * 100 : 0}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{totalValue > 0 ? ((c.value / totalValue) * 100).toFixed(1) : 0}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Full stock table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="h-4 w-4" />
            {ar ? "جرد المخزون الكامل" : "Full Stock Inventory"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>{ar ? "المادة" : "Item"}</TableHead>
                <TableHead>{ar ? "الفئة" : "Category"}</TableHead>
                <TableHead>{ar ? "المخزون" : "Stock"}</TableHead>
                <TableHead>{ar ? "الحد الأدنى" : "Min"}</TableHead>
                <TableHead>{ar ? "تكلفة الوحدة" : "Unit Cost"}</TableHead>
                <TableHead>{ar ? "إجمالي القيمة" : "Total Value"}</TableHead>
                <TableHead>{ar ? "الحالة" : "Status"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => {
                const current = parseFloat(item.currentStock || "0");
                const min = parseFloat(item.minStock || "0");
                const cost = parseFloat(item.costPerUnit || "0");
                const value = current * cost;
                const isLow = current <= min && min > 0;
                const isOut = current <= 0;
                const unitLabel = ar ? unitLabels[item.unit]?.ar : unitLabels[item.unit]?.en;
                return (
                  <TableRow key={item.id} className={isOut ? "bg-red-50 dark:bg-red-950/20" : isLow ? "bg-orange-50 dark:bg-orange-950/20" : ""}>
                    <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                    <TableCell className="font-medium">{ar ? (item.nameAr || item.name) : item.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">
                        {item.category ? (ar ? categoryLabels[item.category]?.ar : categoryLabels[item.category]?.en) : "-"}
                      </Badge>
                    </TableCell>
                    <TableCell className={isLow || isOut ? "text-destructive font-medium" : ""}>{current} {unitLabel}</TableCell>
                    <TableCell>{min} {unitLabel}</TableCell>
                    <TableCell>{cost.toFixed(2)} {ar ? "ر.س" : "SAR"}</TableCell>
                    <TableCell className="font-medium">{value.toFixed(2)} {ar ? "ر.س" : "SAR"}</TableCell>
                    <TableCell>
                      {isOut ? (
                        <Badge variant="destructive" className="text-xs">{ar ? "نفد" : "Out"}</Badge>
                      ) : isLow ? (
                        <Badge className="bg-orange-500 text-xs">{ar ? "منخفض" : "Low"}</Badge>
                      ) : (
                        <Badge className="bg-green-500 text-xs">{ar ? "جيد" : "OK"}</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <tfoot>
              <tr className="border-t-2">
                <td colSpan={6} className="p-2 font-bold text-sm">{ar ? "إجمالي قيمة المخزون" : "Total Inventory Value"}</td>
                <td className="p-2 font-bold text-sm">{totalValue.toFixed(2)} {ar ? "ر.س" : "SAR"}</td>
                <td></td>
              </tr>
            </tfoot>
          </Table>
        </CardContent>
      </Card>
    </div>
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

  const [activeTab, setActiveTab] = useState("management");

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
        <div className="flex gap-2">
          {activeTab === "management" && (
            <Button onClick={() => setIsAddDialogOpen(true)} data-testid="button-add-inventory">
              <Plus className="w-4 h-4 mr-2" />
              {language === "ar" ? "إضافة مادة" : "Add Item"}
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="management" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            {language === "ar" ? "المخزون" : "Inventory"}
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            {language === "ar" ? "التقارير" : "Reports"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="management" className="mt-4 space-y-4">

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
      </TabsContent>

      <TabsContent value="reports" className="mt-4">
        {items && items.length > 0 ? (
          <InventoryReports items={items} />
        ) : (
          <Card className="p-12 text-center">
            <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {language === "ar" ? "لا توجد بيانات" : "No data yet"}
            </h3>
            <p className="text-muted-foreground">
              {language === "ar" ? "أضف مواد المخزون أولاً لعرض التقارير" : "Add inventory items first to see reports"}
            </p>
          </Card>
        )}
      </TabsContent>
      </Tabs>

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

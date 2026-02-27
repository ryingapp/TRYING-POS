import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3, TrendingUp, Clock, ShoppingBag, DollarSign, Calendar,
  Download, FileSpreadsheet, FileText, Printer, Building2, CreditCard,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell,
  Legend, AreaChart, Area,
} from "recharts";
import { useLanguage } from "@/lib/i18n";
import { useBranch } from "@/lib/branch";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

/* ──────────────────── constants ──────────────────── */

const COLORS = [
  "#f97316", "#eab308", "#22c55e", "#3b82f6",
  "#8b5cf6", "#ec4899", "#14b8a6", "#ef4444",
];

const orderTypeLabels: Record<string, { en: string; ar: string }> = {
  dine_in: { en: "Dine-in", ar: "داخل المطعم" },
  pickup:  { en: "Pickup",  ar: "استلام" },
  delivery:{ en: "Delivery", ar: "توصيل" },
};

const paymentMethodLabels: Record<string, { en: string; ar: string }> = {
  cash:            { en: "Cash",            ar: "نقدي" },
  card:            { en: "Card",            ar: "بطاقة" },
  online:          { en: "Online",          ar: "إلكتروني" },
  mada:            { en: "Mada",            ar: "مدى" },
  visa:            { en: "Visa",            ar: "فيزا" },
  mastercard:      { en: "Mastercard",      ar: "ماستركارد" },
  apple_pay:       { en: "Apple Pay",       ar: "أبل باي" },
  stcpay:          { en: "STC Pay",         ar: "STC Pay" },
  bank_transfer:   { en: "Bank Transfer",   ar: "تحويل بنكي" },
  edfapay_online:  { en: "Online Payment",  ar: "دفع إلكتروني" },
  credit:          { en: "Credit",          ar: "آجل" },
};

/* ──────────────────── types ──────────────────── */

interface SummaryData {
  today: { sales: number; orders: number };
  week:  { sales: number; orders: number };
  month: { sales: number; orders: number };
  topItems: Array<{ id: string; name_en: string; name_ar: string; total_quantity: string; total_revenue: string }>;
  ordersByType: Array<{ order_type: string; count: string; total_revenue: string }>;
}

interface SalesReportRow {
  date: string; order_count: string; total_sales: string;
  total_tax: string; total_discount: string;
}

interface HourlyStatRow { hour: string; order_count: string; total_sales: string; }

interface TopItemRow {
  id: string; name_en: string; name_ar: string;
  total_quantity: string; total_revenue: string;
}

interface PaymentMethodRow { payment_method: string; count: string; total_revenue: string; }

interface BranchStat {
  branchId: string; branchName: string; branchNameAr: string; isMain: boolean;
  today: { sales: number; orders: number };
  week:  { sales: number; orders: number };
  month: { sales: number; orders: number; tax: number; discount: number };
  range: { sales: number; orders: number; tax: number; discount: number };
  topItems: TopItemRow[];
  ordersByType: Array<{ order_type: string; count: string; total_revenue: string }>;
}

interface AllBranchesData {
  branches: BranchStat[];
  totals: {
    today: { sales: number; orders: number };
    week:  { sales: number; orders: number };
    month: { sales: number; orders: number; tax: number; discount: number };
    range: { sales: number; orders: number; tax: number; discount: number };
  };
}

/* ──────────────────── CSV / Excel helpers ──────────────────── */

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

/* ──────────────────── Professional PDF generator ──────────────────── */

function generateProfessionalPDF(opts: {
  language: string;
  restaurantName: string;
  vatNumber?: string;
  crNumber?: string;
  branchName?: string;
  dateRange: { startDate: string; endDate: string };
  summary: SummaryData | null;
  salesData: { date: string; orders: number; sales: number; tax: number; discount: number }[];
  topItems: { name: string; quantity: number; revenue: number }[];
  orderTypeData: { name: string; value: number; revenue: number }[];
  paymentData: { name: string; count: number; revenue: number }[];
  hourlyData: { hour: string; orders: number; sales: number }[];
  allBranchesData?: AllBranchesData | null;
  isAllBranches?: boolean;
}) {
  const ar = opts.language === "ar";
  const dir = ar ? "rtl" : "ltr";
  const f = (v: number) => `${v.toFixed(2)} ${ar ? "ر.س" : "SAR"}`;
  const now = new Date();
  const dateStr = now.toLocaleDateString(ar ? "ar-SA" : "en-US", {
    year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  const title = opts.isAllBranches
    ? (ar ? "تقرير شامل - جميع الفروع" : "Comprehensive Report — All Branches")
    : (ar ? "تقرير الأداء" : "Performance Report");

  const period = ar
    ? `الفترة: ${opts.dateRange.startDate} إلى ${opts.dateRange.endDate}`
    : `Period: ${opts.dateRange.startDate} to ${opts.dateRange.endDate}`;

  /* summary cards */
  const summarySource = opts.isAllBranches && opts.allBranchesData
    ? opts.allBranchesData.totals : opts.summary;
  const summaryCards = summarySource ? `
    <div class="g4">
      <div class="sc"><div class="sl">${ar ? "مبيعات اليوم" : "Today"}</div><div class="sv">${f(summarySource.today.sales)}</div><div class="ss">${summarySource.today.orders} ${ar ? "طلب" : "orders"}</div></div>
      <div class="sc"><div class="sl">${ar ? "مبيعات الأسبوع" : "Week"}</div><div class="sv">${f(summarySource.week.sales)}</div><div class="ss">${summarySource.week.orders} ${ar ? "طلب" : "orders"}</div></div>
      <div class="sc"><div class="sl">${ar ? "مبيعات الشهر" : "Month"}</div><div class="sv">${f(summarySource.month.sales)}</div><div class="ss">${summarySource.month.orders} ${ar ? "طلب" : "orders"}</div></div>
      <div class="sc"><div class="sl">${ar ? "متوسط الطلب" : "Avg. Order"}</div><div class="sv">${summarySource.month.orders > 0 ? f(summarySource.month.sales / summarySource.month.orders) : f(0)}</div><div class="ss">${ar ? "هذا الشهر" : "this month"}</div></div>
    </div>` : "";

  /* sales table */
  const totalS = opts.salesData.reduce((a, r) => a + r.sales, 0);
  const totalO = opts.salesData.reduce((a, r) => a + r.orders, 0);
  const totalT = opts.salesData.reduce((a, r) => a + r.tax, 0);
  const totalD = opts.salesData.reduce((a, r) => a + r.discount, 0);
  const salesRows = opts.salesData.map(r =>
    `<tr><td>${r.date}</td><td>${r.orders}</td><td>${f(r.sales)}</td><td>${f(r.tax)}</td><td>${f(r.discount)}</td><td class="b">${f(r.sales - r.discount)}</td></tr>`
  ).join("");
  const salesTable = opts.salesData.length ? `
    <div class="sec"><h2>📊 ${ar ? "تفاصيل المبيعات اليومية" : "Daily Sales Details"}</h2>
    <table><thead><tr>
      <th>${ar ? "التاريخ" : "Date"}</th><th>${ar ? "الطلبات" : "Orders"}</th><th>${ar ? "المبيعات" : "Sales"}</th>
      <th>${ar ? "الضريبة" : "Tax"}</th><th>${ar ? "الخصم" : "Discount"}</th><th>${ar ? "الصافي" : "Net"}</th>
    </tr></thead><tbody>${salesRows}</tbody>
    <tfoot><tr class="tot"><td class="b">${ar ? "الإجمالي" : "Total"}</td><td class="b">${totalO}</td><td class="b">${f(totalS)}</td><td class="b">${f(totalT)}</td><td class="b">${f(totalD)}</td><td class="b">${f(totalS - totalD)}</td></tr></tfoot></table></div>` : "";

  /* top items */
  const itemRows = opts.topItems.map((it, i) =>
    `<tr><td>${i + 1}</td><td>${it.name}</td><td>${it.quantity}</td><td>${f(it.revenue)}</td></tr>`
  ).join("");
  const topItemsTable = itemRows ? `
    <div class="sec"><h2>🏆 ${ar ? "الأصناف الأكثر مبيعاً" : "Top Selling Items"}</h2>
    <table><thead><tr><th>#</th><th>${ar ? "الصنف" : "Item"}</th><th>${ar ? "الكمية" : "Qty"}</th><th>${ar ? "الإيرادات" : "Revenue"}</th></tr></thead><tbody>${itemRows}</tbody></table></div>` : "";

  /* order types */
  const otTotal = opts.orderTypeData.reduce((s, i) => s + i.value, 0);
  const otRows = opts.orderTypeData.map(i =>
    `<tr><td>${i.name}</td><td>${i.value}</td><td>${f(i.revenue)}</td><td>${otTotal ? ((i.value / otTotal) * 100).toFixed(1) : 0}%</td></tr>`
  ).join("");
  const orderTypeTable = otRows ? `
    <div class="sec"><h2>📋 ${ar ? "أنواع الطلبات" : "Order Types"}</h2>
    <table><thead><tr><th>${ar ? "النوع" : "Type"}</th><th>${ar ? "العدد" : "Count"}</th><th>${ar ? "الإيرادات" : "Revenue"}</th><th>${ar ? "النسبة" : "Share"}</th></tr></thead><tbody>${otRows}</tbody></table></div>` : "";

  /* payments */
  const pmTotal = opts.paymentData.reduce((s, i) => s + i.revenue, 0);
  const pmRows = opts.paymentData.map(i =>
    `<tr><td>${i.name}</td><td>${i.count}</td><td>${f(i.revenue)}</td><td>${pmTotal ? ((i.revenue / pmTotal) * 100).toFixed(1) : 0}%</td></tr>`
  ).join("");
  const paymentTable = pmRows ? `
    <div class="sec"><h2>💳 ${ar ? "طرق الدفع" : "Payment Methods"}</h2>
    <table><thead><tr><th>${ar ? "الطريقة" : "Method"}</th><th>${ar ? "العدد" : "Count"}</th><th>${ar ? "المبلغ" : "Amount"}</th><th>${ar ? "النسبة" : "Share"}</th></tr></thead><tbody>${pmRows}</tbody></table></div>` : "";

  /* peak hours */
  const peakRows = opts.hourlyData.filter(h => h.orders > 0).map(h =>
    `<tr><td>${h.hour}</td><td>${h.orders}</td><td>${f(h.sales)}</td></tr>`
  ).join("");
  const peakTable = peakRows ? `
    <div class="sec"><h2>⏰ ${ar ? "ساعات الذروة" : "Peak Hours"}</h2>
    <table><thead><tr><th>${ar ? "الساعة" : "Hour"}</th><th>${ar ? "الطلبات" : "Orders"}</th><th>${ar ? "المبيعات" : "Sales"}</th></tr></thead><tbody>${peakRows}</tbody></table></div>` : "";

  /* all branches section */
  let branchesSection = "";
  if (opts.isAllBranches && opts.allBranchesData) {
    const bd = opts.allBranchesData;
    const bRows = bd.branches.map(b => {
      const nm = ar ? b.branchNameAr : b.branchName;
      return `<tr><td class="b">${nm}${b.isMain ? (ar ? " (رئيسي)" : " (Main)") : ""}</td>
        <td>${f(b.today.sales)}</td><td>${b.today.orders}</td>
        <td>${f(b.week.sales)}</td><td>${b.week.orders}</td>
        <td>${f(b.month.sales)}</td><td>${b.month.orders}</td>
        <td>${f(b.month.tax)}</td>
        <td>${b.month.orders > 0 ? f(b.month.sales / b.month.orders) : f(0)}</td></tr>`;
    }).join("");
    const tt = bd.totals;
    branchesSection = `
      <div class="sec pb"><h2>🏢 ${ar ? "مقارنة الفروع" : "Branch Comparison"}</h2>
      <table class="sm"><thead><tr>
        <th>${ar ? "الفرع" : "Branch"}</th>
        <th>${ar ? "مبيعات اليوم" : "Today"}</th><th>${ar ? "طلبات" : "Ord."}</th>
        <th>${ar ? "الأسبوع" : "Week"}</th><th>${ar ? "طلبات" : "Ord."}</th>
        <th>${ar ? "الشهر" : "Month"}</th><th>${ar ? "طلبات" : "Ord."}</th>
        <th>${ar ? "الضريبة" : "Tax"}</th><th>${ar ? "متوسط" : "Avg."}</th>
      </tr></thead><tbody>${bRows}</tbody>
      <tfoot><tr class="tot"><td class="b">${ar ? "الإجمالي" : "Total"}</td>
        <td class="b">${f(tt.today.sales)}</td><td class="b">${tt.today.orders}</td>
        <td class="b">${f(tt.week.sales)}</td><td class="b">${tt.week.orders}</td>
        <td class="b">${f(tt.month.sales)}</td><td class="b">${tt.month.orders}</td>
        <td class="b">${f(tt.month.tax)}</td>
        <td class="b">${tt.month.orders > 0 ? f(tt.month.sales / tt.month.orders) : f(0)}</td>
      </tr></tfoot></table></div>`;

    /* per-branch detail blocks */
    branchesSection += bd.branches.map(b => {
      const nm = ar ? b.branchNameAr : b.branchName;
      const topR = (b.topItems || []).slice(0, 5).map((it: any, i: number) =>
        `<tr><td>${i + 1}</td><td>${ar && it.name_ar ? it.name_ar : it.name_en}</td><td>${it.total_quantity}</td><td>${f(parseFloat(it.total_revenue || "0"))}</td></tr>`
      ).join("");
      return `<div class="bd">
        <h3>📍 ${nm}</h3>
        <div class="g4m">
          <div class="mc"><span class="ml">${ar ? "اليوم" : "Today"}</span><span class="mv">${f(b.today.sales)}</span></div>
          <div class="mc"><span class="ml">${ar ? "الأسبوع" : "Week"}</span><span class="mv">${f(b.week.sales)}</span></div>
          <div class="mc"><span class="ml">${ar ? "الشهر" : "Month"}</span><span class="mv">${f(b.month.sales)}</span></div>
          <div class="mc"><span class="ml">${ar ? "ضريبة" : "Tax"}</span><span class="mv">${f(b.month.tax)}</span></div>
        </div>
        ${topR ? `<h4>${ar ? "أعلى الأصناف" : "Top Items"}</h4><table><thead><tr><th>#</th><th>${ar ? "الصنف" : "Item"}</th><th>${ar ? "الكمية" : "Qty"}</th><th>${ar ? "الإيرادات" : "Revenue"}</th></tr></thead><tbody>${topR}</tbody></table>` : ""}
      </div>`;
    }).join("");
  }

  /* assemble final HTML */
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
.sec h3{font-size:14px;font-weight:700;color:#0f3460;margin:14px 0 6px}
.sec h4{font-size:12px;font-weight:600;color:#444;margin:10px 0 5px}
table{width:100%;border-collapse:collapse;margin-bottom:10px;font-size:12px}
th{background:#1a1a2e;color:#fff;padding:7px 9px;font-weight:600;font-size:10.5px;text-transform:uppercase}
td{padding:6px 9px;border-bottom:1px solid #eee}
tr:nth-child(even){background:#f8f9fa}
.tot{background:#1a1a2e!important;color:#fff}
.tot td{border-bottom:none;font-weight:700}
.b{font-weight:700}
.sm{font-size:11px} .sm th{font-size:10px;padding:5px 7px} .sm td{padding:4px 7px}
.bd{page-break-inside:avoid;border:1px solid #e9ecef;border-radius:8px;margin:10px 36px;padding:14px}
.g4m{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin:6px 0 10px}
.mc{background:#f0f4ff;border-radius:6px;padding:7px 9px;text-align:center}
.ml{display:block;font-size:9px;color:#666} .mv{display:block;font-size:13px;font-weight:700;color:#1a1a2e}
.ft{text-align:center;padding:18px 36px;font-size:10px;color:#999;border-top:1px solid #eee;margin-top:16px}
.pb{page-break-before:always}
@media print{body{padding:0}.hd,th,.tot,.sc,.mc{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="hd">
  <div><h1>${title}</h1>${opts.branchName && !opts.isAllBranches ? `<p class="sub">${ar ? "فرع: " : "Branch: "}${opts.branchName}</p>` : ""}</div>
  <div style="text-align:${ar ? "left" : "right"}"><div class="rn">${opts.restaurantName}</div>
    ${opts.vatNumber ? `<div class="ri">${ar ? "الرقم الضريبي" : "VAT"}: ${opts.vatNumber}</div>` : ""}
    ${opts.crNumber ? `<div class="ri">${ar ? "السجل التجاري" : "CR"}: ${opts.crNumber}</div>` : ""}
  </div>
</div>
<div class="mb"><span>${period}</span><span>${ar ? "تاريخ التقرير" : "Generated"}: ${dateStr}</span></div>
${summaryCards}${salesTable}${topItemsTable}${orderTypeTable}${paymentTable}${peakTable}${branchesSection}
<div class="ft">${ar ? "تم إنشاء هذا التقرير آلياً بواسطة نظام" : "Auto-generated by"} ${opts.restaurantName} POS — ${dateStr}</div>
<script>window.onload=function(){window.print()}</script>
</body></html>`;

  const w = window.open("", "_blank");
  if (w) { w.document.write(html); w.document.close(); }
}

/* ──────────────────── ExportDropdown ──────────────────── */

function ExportDropdown({ onCSV, onExcel, onPDF, language }: {
  onCSV: () => void; onExcel: () => void; onPDF: () => void; language: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline"><Download className="w-4 h-4 ltr:mr-2 rtl:ml-2" />{language === "ar" ? "تصدير" : "Export"}</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onPDF}><Printer className="w-4 h-4 ltr:mr-2 rtl:ml-2" />PDF</DropdownMenuItem>
        <DropdownMenuItem onClick={onCSV}><FileText className="w-4 h-4 ltr:mr-2 rtl:ml-2" />CSV</DropdownMenuItem>
        <DropdownMenuItem onClick={onExcel}><FileSpreadsheet className="w-4 h-4 ltr:mr-2 rtl:ml-2" />Excel</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ══════════════════════════════════════════════════════════
   Main Reports Component
   ══════════════════════════════════════════════════════════ */

export default function Reports() {
  const { t, language } = useLanguage();
  const { selectedBranchId, selectedBranch } = useBranch();
  const { user: authUser } = useAuth();
  const isOwner = authUser?.role === "owner" || authUser?.role === "platform_admin";

  const [activeTab, setActiveTab] = useState("overview");
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
  });
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);
  const ar = language === "ar";

  /* ─── queries ─── */

  const { data: restaurant } = useQuery<any>({ queryKey: ["/api/restaurant"] });

  const { data: summary, isLoading: summaryLoading } = useQuery<SummaryData>({
    queryKey: ["/api/reports/summary", selectedBranchId],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (selectedBranchId) p.set("branch", selectedBranchId);
      return (await apiRequest("GET", `/api/reports/summary?${p}`)).json();
    },
  });

  const { data: salesData, isLoading: salesLoading } = useQuery<SalesReportRow[]>({
    queryKey: ["/api/reports/sales", dateRange.startDate, dateRange.endDate, selectedBranchId],
    queryFn: async () => {
      const p = new URLSearchParams({ startDate: dateRange.startDate, endDate: dateRange.endDate });
      if (selectedBranchId) p.set("branch", selectedBranchId);
      return (await apiRequest("GET", `/api/reports/sales?${p}`)).json();
    },
  });

  const { data: hourlyData, isLoading: hourlyLoading } = useQuery<HourlyStatRow[]>({
    queryKey: ["/api/reports/hourly-stats", todayStr, selectedBranchId],
    queryFn: async () => {
      const p = new URLSearchParams({ date: todayStr });
      if (selectedBranchId) p.set("branch", selectedBranchId);
      return (await apiRequest("GET", `/api/reports/hourly-stats?${p}`)).json();
    },
  });

  const { data: topItemsData, isLoading: topItemsLoading } = useQuery<TopItemRow[]>({
    queryKey: ["/api/reports/top-items", selectedBranchId],
    queryFn: async () => {
      const p = new URLSearchParams({ limit: "10" });
      if (selectedBranchId) p.set("branch", selectedBranchId);
      return (await apiRequest("GET", `/api/reports/top-items?${p}`)).json();
    },
  });

  const { data: paymentMethodsData } = useQuery<PaymentMethodRow[]>({
    queryKey: ["/api/reports/payment-methods", dateRange.startDate, dateRange.endDate, selectedBranchId],
    queryFn: async () => {
      const p = new URLSearchParams({ startDate: dateRange.startDate, endDate: dateRange.endDate });
      if (selectedBranchId) p.set("branch", selectedBranchId);
      return (await apiRequest("GET", `/api/reports/payment-methods?${p}`)).json();
    },
  });

  const { data: allBranchesData, isLoading: allBranchesLoading } = useQuery<AllBranchesData>({
    queryKey: ["/api/reports/all-branches-summary", dateRange.startDate, dateRange.endDate],
    queryFn: async () => {
      const p = new URLSearchParams({ startDate: dateRange.startDate, endDate: dateRange.endDate });
      return (await apiRequest("GET", `/api/reports/all-branches-summary?${p}`)).json();
    },
    enabled: isOwner,
  });

  /* ─── computed data ─── */

  const fmt = useCallback((v: number) => `${v.toFixed(2)} ${ar ? "ر.س" : "SAR"}`, [ar]);

  const salesChart = useMemo(() =>
    (salesData || []).map(r => ({
      date: new Date(r.date).toLocaleDateString(ar ? "ar-SA" : "en-US", { month: "short", day: "numeric" }),
      sales: parseFloat(r.total_sales || "0"),
      orders: parseInt(r.order_count || "0"),
      tax: parseFloat(r.total_tax || "0"),
      discount: parseFloat(r.total_discount || "0"),
    })), [salesData, ar]);

  const hourlyChart = useMemo(() =>
    Array.from({ length: 24 }, (_, i) => {
      const h = hourlyData?.find(r => parseInt(r.hour) === i);
      return { hour: `${String(i).padStart(2, "0")}:00`, orders: h ? parseInt(h.order_count) : 0, sales: h ? parseFloat(h.total_sales) : 0 };
    }), [hourlyData]);

  const orderTypeChart = useMemo(() =>
    (summary?.ordersByType || []).map(i => ({
      name: ar ? orderTypeLabels[i.order_type]?.ar || i.order_type : orderTypeLabels[i.order_type]?.en || i.order_type,
      value: parseInt(i.count || "0"),
      revenue: parseFloat(i.total_revenue || "0"),
    })), [summary, ar]);

  const topItemsChart = useMemo(() =>
    (topItemsData || summary?.topItems || []).map(i => ({
      name: ar && i.name_ar ? i.name_ar : i.name_en,
      quantity: parseInt(i.total_quantity || "0"),
      revenue: parseFloat(i.total_revenue || "0"),
    })), [topItemsData, summary, ar]);

  const paymentChart = useMemo(() =>
    (paymentMethodsData || []).map(i => ({
      name: ar ? paymentMethodLabels[i.payment_method]?.ar || i.payment_method : paymentMethodLabels[i.payment_method]?.en || i.payment_method,
      count: parseInt(i.count || "0"),
      revenue: parseFloat(i.total_revenue || "0"),
    })), [paymentMethodsData, ar]);

  const peakInfo = useMemo(() => {
    if (!hourlyChart.length) return null;
    const peak = hourlyChart.reduce((m, c) => c.orders > m.orders ? c : m, hourlyChart[0]);
    return { peakHour: peak.hour, peakOrders: peak.orders, totalOrders: hourlyChart.reduce((s, c) => s + c.orders, 0), totalSales: hourlyChart.reduce((s, c) => s + c.sales, 0) };
  }, [hourlyChart]);

  const avgOrder = useMemo(() => {
    if (!summary?.month?.orders) return 0;
    return summary.month.sales / summary.month.orders;
  }, [summary]);

  /* ─── export handlers ─── */

  const mkHeaders = (pairs: [string, string][]) =>
    pairs.map(([key, label]) => ({ key, label }));

  const handlePDF = useCallback((allBranches = false) => {
    const rn = ar ? restaurant?.nameAr : restaurant?.nameEn;
    const bn = ar ? (selectedBranch as any)?.nameAr || selectedBranch?.name : selectedBranch?.name;
    generateProfessionalPDF({
      language, restaurantName: rn || "Restaurant",
      vatNumber: restaurant?.vatNumber, crNumber: restaurant?.commercialRegistration,
      branchName: bn, dateRange, summary: summary || null,
      salesData: salesChart, topItems: topItemsChart, orderTypeData: orderTypeChart,
      paymentData: paymentChart, hourlyData: hourlyChart,
      allBranchesData: allBranches ? allBranchesData : null, isAllBranches: allBranches,
    });
  }, [language, restaurant, selectedBranch, dateRange, summary, salesChart, topItemsChart, orderTypeChart, paymentChart, hourlyChart, allBranchesData]);

  const exSales = useCallback((t: "csv" | "excel") => {
    const h = mkHeaders([["date", ar ? "التاريخ" : "Date"], ["orders", ar ? "الطلبات" : "Orders"], ["sales", ar ? "المبيعات" : "Sales"], ["tax", ar ? "الضريبة" : "Tax"], ["discount", ar ? "الخصم" : "Discount"], ["net", ar ? "الصافي" : "Net"]]);
    const d = salesChart.map(r => ({ ...r, sales: r.sales.toFixed(2), tax: r.tax.toFixed(2), discount: r.discount.toFixed(2), net: (r.sales - r.discount).toFixed(2) }));
    t === "csv" ? exportToCSV(d, "sales-report", h) : exportToExcel(d, "sales-report", h);
  }, [salesChart, ar]);

  const exItems = useCallback((t: "csv" | "excel") => {
    const h = mkHeaders([["rank", "#"], ["name", ar ? "الصنف" : "Item"], ["quantity", ar ? "الكمية" : "Qty"], ["revenue", ar ? "الإيرادات" : "Revenue"]]);
    const d = topItemsChart.map((r, i) => ({ rank: i + 1, name: r.name, quantity: r.quantity, revenue: r.revenue.toFixed(2) }));
    t === "csv" ? exportToCSV(d, "top-items", h) : exportToExcel(d, "top-items", h);
  }, [topItemsChart, ar]);

  const exHourly = useCallback((t: "csv" | "excel") => {
    const h = mkHeaders([["hour", ar ? "الساعة" : "Hour"], ["orders", ar ? "الطلبات" : "Orders"], ["sales", ar ? "المبيعات" : "Sales"]]);
    const d = hourlyChart.map(r => ({ ...r, sales: r.sales.toFixed(2) }));
    t === "csv" ? exportToCSV(d, "hourly", h) : exportToExcel(d, "hourly", h);
  }, [hourlyChart, ar]);

  const exPayments = useCallback((t: "csv" | "excel") => {
    const h = mkHeaders([["name", ar ? "الطريقة" : "Method"], ["count", ar ? "العدد" : "Count"], ["revenue", ar ? "المبلغ" : "Amount"]]);
    const d = paymentChart.map(r => ({ ...r, revenue: r.revenue.toFixed(2) }));
    t === "csv" ? exportToCSV(d, "payments", h) : exportToExcel(d, "payments", h);
  }, [paymentChart, ar]);

  const exBranches = useCallback((t: "csv" | "excel") => {
    if (!allBranchesData) return;
    const h = mkHeaders([
      ["branch", ar ? "الفرع" : "Branch"], ["todaySales", ar ? "مبيعات اليوم" : "Today"],
      ["todayOrders", ar ? "طلبات اليوم" : "Orders"], ["weekSales", ar ? "الأسبوع" : "Week"],
      ["monthSales", ar ? "الشهر" : "Month"], ["monthOrders", ar ? "طلبات الشهر" : "M.Orders"],
      ["monthTax", ar ? "الضريبة" : "Tax"], ["avg", ar ? "متوسط" : "Avg"],
    ]);
    const d = allBranchesData.branches.map(b => ({
      branch: ar ? b.branchNameAr : b.branchName,
      todaySales: b.today.sales.toFixed(2), todayOrders: b.today.orders,
      weekSales: b.week.sales.toFixed(2),
      monthSales: b.month.sales.toFixed(2), monthOrders: b.month.orders,
      monthTax: b.month.tax.toFixed(2),
      avg: b.month.orders > 0 ? (b.month.sales / b.month.orders).toFixed(2) : "0.00",
    }));
    t === "csv" ? exportToCSV(d, "all-branches", h) : exportToExcel(d, "all-branches", h);
  }, [allBranchesData, ar]);

  /* ─── loading skeleton ─── */
  if (summaryLoading) return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-32" />)}</div>
      <Skeleton className="h-96" />
    </div>
  );

  /* ═══════════════════ RENDER ═══════════════════ */

  return (
    <div className="p-6 space-y-6 print:p-2">

      {/* header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{ar ? "التقارير والتحليلات" : "Reports & Analytics"}</h1>
          <p className="text-muted-foreground">{ar ? "تتبع أداء مطعمك وتحليل البيانات التفصيلية" : "Track your restaurant performance with detailed analytics"}</p>
        </div>
        <div className="flex gap-2 items-end flex-wrap">
          <div><Label htmlFor="sd">{ar ? "من" : "From"}</Label><Input id="sd" type="date" value={dateRange.startDate} onChange={e => setDateRange(d => ({ ...d, startDate: e.target.value }))} /></div>
          <div><Label htmlFor="ed">{ar ? "إلى" : "To"}</Label><Input id="ed" type="date" value={dateRange.endDate} onChange={e => setDateRange(d => ({ ...d, endDate: e.target.value }))} /></div>
        </div>
      </div>

      {/* summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard icon={DollarSign} label={ar ? "مبيعات اليوم" : "Today's Sales"} value={fmt(summary?.today?.sales || 0)} sub={`${summary?.today?.orders || 0} ${ar ? "طلب" : "orders"}`} />
        <SummaryCard icon={TrendingUp} label={ar ? "مبيعات الأسبوع" : "Weekly Sales"} value={fmt(summary?.week?.sales || 0)} sub={`${summary?.week?.orders || 0} ${ar ? "طلب" : "orders"}`} />
        <SummaryCard icon={Calendar} label={ar ? "مبيعات الشهر" : "Monthly Sales"} value={fmt(summary?.month?.sales || 0)} sub={`${summary?.month?.orders || 0} ${ar ? "طلب" : "orders"}`} />
        <SummaryCard icon={ShoppingBag} label={ar ? "متوسط الطلب" : "Avg. Order"} value={fmt(avgOrder)} sub={ar ? "هذا الشهر" : "this month"} />
      </div>

      {/* tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview"><BarChart3 className="w-4 h-4 ltr:mr-2 rtl:ml-2" />{ar ? "نظرة عامة" : "Overview"}</TabsTrigger>
          <TabsTrigger value="sales"><TrendingUp className="w-4 h-4 ltr:mr-2 rtl:ml-2" />{ar ? "المبيعات" : "Sales"}</TabsTrigger>
          <TabsTrigger value="hourly"><Clock className="w-4 h-4 ltr:mr-2 rtl:ml-2" />{ar ? "أوقات الذروة" : "Peak Hours"}</TabsTrigger>
          <TabsTrigger value="items"><ShoppingBag className="w-4 h-4 ltr:mr-2 rtl:ml-2" />{ar ? "الأصناف" : "Items"}</TabsTrigger>
          <TabsTrigger value="payments"><CreditCard className="w-4 h-4 ltr:mr-2 rtl:ml-2" />{ar ? "طرق الدفع" : "Payments"}</TabsTrigger>
          {isOwner && <TabsTrigger value="all-branches"><Building2 className="w-4 h-4 ltr:mr-2 rtl:ml-2" />{ar ? "جميع الفروع" : "All Branches"}</TabsTrigger>}
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview" className="space-y-6">
          <div className="flex justify-end gap-2 print:hidden">
            <ExportDropdown language={language} onCSV={() => exSales("csv")} onExcel={() => exSales("excel")} onPDF={() => handlePDF(false)} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* sales trend */}
            <Card className="lg:col-span-2">
              <CardHeader><CardTitle>{ar ? "اتجاه المبيعات" : "Sales Trend"}</CardTitle></CardHeader>
              <CardContent>
                {salesLoading ? <Skeleton className="h-80 w-full" /> : salesChart.length > 0 ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <AreaChart data={salesChart}>
                      <defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f97316" stopOpacity={.3}/><stop offset="95%" stopColor="#f97316" stopOpacity={0}/></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" /><XAxis dataKey="date" fontSize={12}/><YAxis fontSize={12}/>
                      <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ borderRadius: 8 }} />
                      <Area type="monotone" dataKey="sales" stroke="#f97316" strokeWidth={2} fill="url(#sg)" name={ar ? "المبيعات" : "Sales"} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <Empty ar={ar} />}
              </CardContent>
            </Card>

            {/* order types pie */}
            <Card>
              <CardHeader><CardTitle>{ar ? "أنواع الطلبات" : "Order Types"}</CardTitle></CardHeader>
              <CardContent>
                {orderTypeChart.length > 0 ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart><Pie data={orderTypeChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={40} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {orderTypeChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie><Tooltip /><Legend /></PieChart>
                  </ResponsiveContainer>
                ) : <Empty ar={ar} />}
              </CardContent>
            </Card>
          </div>

          {/* payment + top items mini */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><CreditCard className="h-4 w-4" />{ar ? "طرق الدفع" : "Payment Methods"}</CardTitle></CardHeader>
              <CardContent>
                {paymentChart.length > 0 ? (
                  <div className="space-y-3">
                    {paymentChart.map((item, i) => {
                      const tot = paymentChart.reduce((s, x) => s + x.revenue, 0);
                      const pct = tot > 0 ? (item.revenue / tot) * 100 : 0;
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <span className="w-24 text-sm font-medium truncate">{item.name}</span>
                          <div className="flex-1 bg-muted rounded-full h-3 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} /></div>
                          <span className="w-20 text-sm text-end font-medium">{fmt(item.revenue)}</span>
                          <Badge variant="outline" className="text-xs">{pct.toFixed(0)}%</Badge>
                        </div>
                      );
                    })}
                  </div>
                ) : <Empty ar={ar} h="h-32" />}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><ShoppingBag className="h-4 w-4" />{ar ? "أعلى 5 أصناف" : "Top 5 Items"}</CardTitle></CardHeader>
              <CardContent>
                {topItemsChart.length > 0 ? (
                  <div className="space-y-3">
                    {topItemsChart.slice(0, 5).map((item, i) => (
                      <div key={i} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={i < 3 ? "default" : "secondary"} className="w-6 h-6 flex items-center justify-center rounded-full text-xs" style={i < 3 ? { backgroundColor: COLORS[i] } : {}}>{i + 1}</Badge>
                          <span className="text-sm font-medium">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">{item.quantity}x</Badge>
                          <span className="text-sm font-medium">{fmt(item.revenue)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <Empty ar={ar} h="h-32" />}
              </CardContent>
            </Card>
          </div>

          {/* overview sales table */}
          <SalesTable salesChart={salesChart} salesLoading={salesLoading} fmt={fmt} ar={ar} />
        </TabsContent>

        {/* ── Sales ── */}
        <TabsContent value="sales" className="space-y-6">
          <div className="flex justify-end print:hidden">
            <ExportDropdown language={language} onCSV={() => exSales("csv")} onExcel={() => exSales("excel")} onPDF={() => handlePDF(false)} />
          </div>
          <Card>
            <CardHeader><CardTitle>{ar ? "المبيعات اليومية" : "Daily Sales"}</CardTitle></CardHeader>
            <CardContent>
              {salesLoading ? <Skeleton className="h-80 w-full" /> : salesChart.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={salesChart}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" /><XAxis dataKey="date" fontSize={12}/><YAxis fontSize={12}/>
                    <Tooltip formatter={(v: number, n: string) => n === (ar ? "الطلبات" : "Orders") ? v : fmt(v)} contentStyle={{ borderRadius: 8 }} />
                    <Legend />
                    <Line type="monotone" dataKey="sales" stroke="#f97316" strokeWidth={2} dot={false} name={ar ? "المبيعات" : "Sales"} />
                    <Line type="monotone" dataKey="orders" stroke="#3b82f6" strokeWidth={2} dot={false} name={ar ? "الطلبات" : "Orders"} />
                  </LineChart>
                </ResponsiveContainer>
              ) : <Empty ar={ar} />}
            </CardContent>
          </Card>
          <SalesTable salesChart={salesChart} salesLoading={salesLoading} fmt={fmt} ar={ar} />
        </TabsContent>

        {/* ── Hourly ── */}
        <TabsContent value="hourly" className="space-y-6">
          <div className="flex justify-end print:hidden">
            <ExportDropdown language={language} onCSV={() => exHourly("csv")} onExcel={() => exHourly("excel")} onPDF={() => handlePDF(false)} />
          </div>
          <Card>
            <CardHeader><CardTitle>{ar ? "توزيع الطلبات حسب الساعة (اليوم)" : "Orders by Hour (Today)"}</CardTitle></CardHeader>
            <CardContent>
              {hourlyLoading ? <Skeleton className="h-80 w-full" /> : (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={hourlyChart}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" /><XAxis dataKey="hour" fontSize={11}/>
                    <YAxis yAxisId="left" orientation="left" stroke="#f97316" fontSize={12}/>
                    <YAxis yAxisId="right" orientation="right" stroke="#3b82f6" fontSize={12}/>
                    <Tooltip contentStyle={{ borderRadius: 8 }} formatter={(v: number, n: string) => n === (ar ? "المبيعات" : "Sales") ? fmt(v) : v} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="orders" fill="#f97316" radius={[4,4,0,0]} name={ar ? "الطلبات" : "Orders"} />
                    <Bar yAxisId="right" dataKey="sales" fill="#3b82f6" radius={[4,4,0,0]} name={ar ? "المبيعات" : "Sales"} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
          {peakInfo && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <SummaryCard icon={Clock} label={ar ? "ساعة الذروة" : "Peak Hour"} value={peakInfo.peakHour} sub={`${peakInfo.peakOrders} ${ar ? "طلب" : "orders"}`} color="#f97316" />
              <SummaryCard icon={ShoppingBag} label={ar ? "إجمالي الطلبات اليوم" : "Total Orders Today"} value={String(peakInfo.totalOrders)} />
              <SummaryCard icon={DollarSign} label={ar ? "إجمالي المبيعات اليوم" : "Total Sales Today"} value={fmt(peakInfo.totalSales)} />
            </div>
          )}
        </TabsContent>

        {/* ── Items ── */}
        <TabsContent value="items" className="space-y-6">
          <div className="flex justify-end print:hidden">
            <ExportDropdown language={language} onCSV={() => exItems("csv")} onExcel={() => exItems("excel")} onPDF={() => handlePDF(false)} />
          </div>
          <Card>
            <CardHeader><CardTitle>{ar ? "الأصناف الأكثر مبيعاً" : "Top Selling Items"}</CardTitle></CardHeader>
            <CardContent>
              {topItemsLoading ? <Skeleton className="h-80 w-full" /> : topItemsChart.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={topItemsChart} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" /><XAxis type="number" fontSize={12}/><YAxis dataKey="name" type="category" width={150} fontSize={12}/>
                    <Tooltip formatter={(v: number, n: string) => n === (ar ? "الإيرادات" : "Revenue") ? fmt(v) : v} contentStyle={{ borderRadius: 8 }} />
                    <Legend />
                    <Bar dataKey="quantity" fill="#f97316" radius={[0,4,4,0]} name={ar ? "الكمية" : "Quantity"} />
                    <Bar dataKey="revenue" fill="#22c55e" radius={[0,4,4,0]} name={ar ? "الإيرادات" : "Revenue"} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <Empty ar={ar} />}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{ar ? "تفاصيل الأصناف" : "Item Details"}</CardTitle></CardHeader>
            <CardContent>
              {topItemsLoading ? <Skeleton className="h-48 w-full" /> : topItemsChart.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b">
                      <th className="text-start p-2 font-medium text-muted-foreground">#</th>
                      <th className="text-start p-2 font-medium text-muted-foreground">{ar ? "الصنف" : "Item"}</th>
                      <th className="text-start p-2 font-medium text-muted-foreground">{ar ? "الكمية" : "Qty"}</th>
                      <th className="text-start p-2 font-medium text-muted-foreground">{ar ? "الإيرادات" : "Revenue"}</th>
                    </tr></thead>
                    <tbody>{topItemsChart.map((r, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="p-2"><Badge variant={i < 3 ? "default" : "secondary"} className="w-6 h-6 flex items-center justify-center rounded-full text-xs" style={i < 3 ? { backgroundColor: COLORS[i] } : {}}>{i + 1}</Badge></td>
                        <td className="p-2 font-medium">{r.name}</td>
                        <td className="p-2">{r.quantity}</td>
                        <td className="p-2 font-medium">{fmt(r.revenue)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              ) : <Empty ar={ar} h="h-24" />}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Payments ── */}
        <TabsContent value="payments" className="space-y-6">
          <div className="flex justify-end print:hidden">
            <ExportDropdown language={language} onCSV={() => exPayments("csv")} onExcel={() => exPayments("excel")} onPDF={() => handlePDF(false)} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>{ar ? "توزيع طرق الدفع" : "Payment Distribution"}</CardTitle></CardHeader>
              <CardContent>
                {paymentChart.length > 0 ? (
                  <ResponsiveContainer width="100%" height={350}>
                    <PieChart><Pie data={paymentChart} dataKey="revenue" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={50} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {paymentChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie><Tooltip formatter={(v: number) => fmt(v)} /><Legend /></PieChart>
                  </ResponsiveContainer>
                ) : <Empty ar={ar} />}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>{ar ? "تفاصيل طرق الدفع" : "Payment Details"}</CardTitle></CardHeader>
              <CardContent>
                {paymentChart.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b">
                        <th className="text-start p-2 font-medium text-muted-foreground">{ar ? "الطريقة" : "Method"}</th>
                        <th className="text-start p-2 font-medium text-muted-foreground">{ar ? "العدد" : "Count"}</th>
                        <th className="text-start p-2 font-medium text-muted-foreground">{ar ? "المبلغ" : "Amount"}</th>
                        <th className="text-start p-2 font-medium text-muted-foreground">{ar ? "النسبة" : "Share"}</th>
                      </tr></thead>
                      <tbody>{paymentChart.map((it, i) => {
                        const tot = paymentChart.reduce((s, x) => s + x.revenue, 0);
                        const pct = tot > 0 ? ((it.revenue / tot) * 100).toFixed(1) : "0.0";
                        return (
                          <tr key={i} className="border-b last:border-0">
                            <td className="p-2 font-medium flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />{it.name}</td>
                            <td className="p-2"><Badge variant="secondary">{it.count}</Badge></td>
                            <td className="p-2 font-medium">{fmt(it.revenue)}</td>
                            <td className="p-2">{pct}%</td>
                          </tr>
                        );
                      })}</tbody>
                      <tfoot><tr className="border-t-2 font-bold">
                        <td className="p-2">{ar ? "الإجمالي" : "Total"}</td>
                        <td className="p-2">{paymentChart.reduce((s, x) => s + x.count, 0)}</td>
                        <td className="p-2">{fmt(paymentChart.reduce((s, x) => s + x.revenue, 0))}</td>
                        <td className="p-2">100%</td>
                      </tr></tfoot>
                    </table>
                  </div>
                ) : <Empty ar={ar} h="h-24" />}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── All Branches (owner only) ── */}
        {isOwner && (
          <TabsContent value="all-branches" className="space-y-6">
            <div className="flex justify-end gap-2 print:hidden">
              <Button variant="default" onClick={() => handlePDF(true)} className="gap-2"><Printer className="w-4 h-4" />PDF</Button>
              <ExportDropdown language={language} onCSV={() => exBranches("csv")} onExcel={() => exBranches("excel")} onPDF={() => handlePDF(true)} />
            </div>

            {allBranchesLoading ? (
              <div className="space-y-4"><Skeleton className="h-32" /><Skeleton className="h-64" /></div>
            ) : allBranchesData ? (
              <>
                {/* totals */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card className="border-2 border-primary/20 bg-primary/5">
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">{ar ? "إجمالي اليوم" : "Total Today"}</CardTitle>
                      <DollarSign className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{fmt(allBranchesData.totals.today.sales)}</div>
                      <div className="text-xs text-muted-foreground">{allBranchesData.totals.today.orders} {ar ? "طلب" : "orders"}</div>
                    </CardContent>
                  </Card>
                  <Card className="border-2 border-primary/20 bg-primary/5">
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">{ar ? "إجمالي الأسبوع" : "Total Week"}</CardTitle>
                      <TrendingUp className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{fmt(allBranchesData.totals.week.sales)}</div>
                      <div className="text-xs text-muted-foreground">{allBranchesData.totals.week.orders} {ar ? "طلب" : "orders"}</div>
                    </CardContent>
                  </Card>
                  <Card className="border-2 border-primary/20 bg-primary/5">
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">{ar ? "إجمالي الشهر" : "Total Month"}</CardTitle>
                      <Calendar className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{fmt(allBranchesData.totals.month.sales)}</div>
                      <div className="text-xs text-muted-foreground">{allBranchesData.totals.month.orders} {ar ? "طلب" : "orders"}</div>
                    </CardContent>
                  </Card>
                  <Card className="border-2 border-primary/20 bg-primary/5">
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">{ar ? "ضريبة الشهر" : "Monthly Tax"}</CardTitle>
                      <BarChart3 className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{fmt(allBranchesData.totals.month.tax)}</div>
                      <div className="text-xs text-muted-foreground">{ar ? "خصومات" : "Discounts"}: {fmt(allBranchesData.totals.month.discount)}</div>
                    </CardContent>
                  </Card>
                </div>

                {/* branch comparison chart */}
                <Card>
                  <CardHeader><CardTitle>{ar ? "مقارنة الفروع - الشهر" : "Branch Comparison — Month"}</CardTitle></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={allBranchesData.branches.map(b => ({ name: ar ? b.branchNameAr : b.branchName, [ar ? "المبيعات" : "Sales"]: b.month.sales, [ar ? "الضريبة" : "Tax"]: b.month.tax, [ar ? "الطلبات" : "Orders"]: b.month.orders }))}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" /><XAxis dataKey="name" fontSize={12}/><YAxis fontSize={12}/>
                        <Tooltip formatter={(v: number, n: string) => n === (ar ? "الطلبات" : "Orders") ? v : fmt(v)} contentStyle={{ borderRadius: 8 }} /><Legend />
                        <Bar dataKey={ar ? "المبيعات" : "Sales"} fill="#f97316" radius={[4,4,0,0]} />
                        <Bar dataKey={ar ? "الضريبة" : "Tax"} fill="#3b82f6" radius={[4,4,0,0]} />
                        <Bar dataKey={ar ? "الطلبات" : "Orders"} fill="#22c55e" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* comparison table */}
                <Card>
                  <CardHeader><CardTitle>{ar ? "جدول مقارنة الفروع" : "Branch Comparison Table"}</CardTitle></CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr className="border-b bg-muted/50">
                          <th className="text-start p-3 font-semibold">{ar ? "الفرع" : "Branch"}</th>
                          <th className="text-start p-3 font-semibold">{ar ? "اليوم" : "Today"}</th>
                          <th className="text-start p-3 font-semibold">{ar ? "طلبات" : "Ord."}</th>
                          <th className="text-start p-3 font-semibold">{ar ? "الأسبوع" : "Week"}</th>
                          <th className="text-start p-3 font-semibold">{ar ? "الشهر" : "Month"}</th>
                          <th className="text-start p-3 font-semibold">{ar ? "طلبات" : "Ord."}</th>
                          <th className="text-start p-3 font-semibold">{ar ? "الضريبة" : "Tax"}</th>
                          <th className="text-start p-3 font-semibold">{ar ? "متوسط" : "Avg."}</th>
                        </tr></thead>
                        <tbody>{allBranchesData.branches.map((b, i) => (
                          <tr key={b.branchId} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="p-3 font-medium"><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />{ar ? b.branchNameAr : b.branchName}{b.isMain && <Badge variant="outline" className="text-xs">{ar ? "رئيسي" : "Main"}</Badge>}</div></td>
                            <td className="p-3 font-medium">{fmt(b.today.sales)}</td>
                            <td className="p-3"><Badge variant="secondary">{b.today.orders}</Badge></td>
                            <td className="p-3">{fmt(b.week.sales)}</td>
                            <td className="p-3 font-medium">{fmt(b.month.sales)}</td>
                            <td className="p-3"><Badge variant="secondary">{b.month.orders}</Badge></td>
                            <td className="p-3 text-muted-foreground">{fmt(b.month.tax)}</td>
                            <td className="p-3">{b.month.orders > 0 ? fmt(b.month.sales / b.month.orders) : "-"}</td>
                          </tr>
                        ))}</tbody>
                        <tfoot><tr className="border-t-2 font-bold bg-muted/30">
                          <td className="p-3">{ar ? "الإجمالي" : "Total"}</td>
                          <td className="p-3">{fmt(allBranchesData.totals.today.sales)}</td>
                          <td className="p-3">{allBranchesData.totals.today.orders}</td>
                          <td className="p-3">{fmt(allBranchesData.totals.week.sales)}</td>
                          <td className="p-3">{fmt(allBranchesData.totals.month.sales)}</td>
                          <td className="p-3">{allBranchesData.totals.month.orders}</td>
                          <td className="p-3">{fmt(allBranchesData.totals.month.tax)}</td>
                          <td className="p-3">{allBranchesData.totals.month.orders > 0 ? fmt(allBranchesData.totals.month.sales / allBranchesData.totals.month.orders) : "-"}</td>
                        </tr></tfoot>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* per-branch detail cards */}
                <h3 className="text-lg font-semibold">{ar ? "تفاصيل كل فرع" : "Branch Details"}</h3>
                {allBranchesData.branches.map((b, bi) => (
                  <Card key={b.branchId}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[bi % COLORS.length] }} />
                        {ar ? b.branchNameAr : b.branchName}
                        {b.isMain && <Badge variant="outline">{ar ? "رئيسي" : "Main"}</Badge>}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                        <MiniStat label={ar ? "اليوم" : "Today"} value={fmt(b.today.sales)} sub={`${b.today.orders} ${ar ? "طلب" : "orders"}`} />
                        <MiniStat label={ar ? "الأسبوع" : "Week"} value={fmt(b.week.sales)} sub={`${b.week.orders} ${ar ? "طلب" : "orders"}`} />
                        <MiniStat label={ar ? "الشهر" : "Month"} value={fmt(b.month.sales)} sub={`${b.month.orders} ${ar ? "طلب" : "orders"}`} />
                        <MiniStat label={ar ? "الضريبة" : "Tax"} value={fmt(b.month.tax)} sub={`${ar ? "خصم" : "Disc."}: ${fmt(b.month.discount)}`} />
                      </div>
                      {b.topItems && b.topItems.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2">{ar ? "أعلى الأصناف" : "Top Items"}</h4>
                          <div className="space-y-2">
                            {b.topItems.slice(0, 5).map((it: any, idx: number) => (
                              <div key={idx} className="flex items-center justify-between text-sm">
                                <span className="flex items-center gap-2">
                                  <Badge variant="secondary" className="w-5 h-5 flex items-center justify-center rounded-full text-xs">{idx + 1}</Badge>
                                  {ar && it.name_ar ? it.name_ar : it.name_en}
                                </span>
                                <span className="font-medium">{it.total_quantity}x — {fmt(parseFloat(it.total_revenue || "0"))}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </>
            ) : <Empty ar={ar} h="h-48" />}
          </TabsContent>
        )}
      </Tabs>

      {/* data export section */}
      <Card className="print:hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Download className="h-5 w-5" />{ar ? "تصدير البيانات" : "Data Export"}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">{ar ? "تصدير البيانات الكاملة للاستخدام في البرامج الأخرى" : "Export full data for use in other applications"}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Button variant="outline" className="justify-start gap-2" onClick={async () => {
              const p = new URLSearchParams();
              if (selectedBranchId) p.set("branchId", selectedBranchId);
              if (dateRange.startDate) p.set("startDate", dateRange.startDate);
              if (dateRange.endDate) p.set("endDate", dateRange.endDate);
              const resp = await apiRequest("GET", `/api/export/orders?${p}`);
              const blob = await resp.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = `orders_${new Date().toISOString().split("T")[0]}.csv`; a.click();
              URL.revokeObjectURL(url);
            }}><FileSpreadsheet className="h-4 w-4" />{ar ? "تصدير الطلبات" : "Export Orders"}</Button>
            <Button variant="outline" className="justify-start gap-2" onClick={async () => {
              const resp = await apiRequest("GET", "/api/export/inventory");
              const blob = await resp.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = `inventory_${new Date().toISOString().split("T")[0]}.csv`; a.click();
              URL.revokeObjectURL(url);
            }}><FileSpreadsheet className="h-4 w-4" />{ar ? "تصدير المخزون" : "Export Inventory"}</Button>
            <Button variant="outline" className="justify-start gap-2" onClick={async () => {
              const resp = await apiRequest("GET", "/api/export/customers");
              const blob = await resp.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = `customers_${new Date().toISOString().split("T")[0]}.csv`; a.click();
              URL.revokeObjectURL(url);
            }}><FileSpreadsheet className="h-4 w-4" />{ar ? "تصدير العملاء" : "Export Customers"}</Button>
            <Button variant="default" className="justify-start gap-2" onClick={() => handlePDF(isOwner)}><Printer className="h-4 w-4" />PDF</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ══════════════ Sub-components ══════════════ */

function SummaryCard({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string; sub?: string; color?: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold" style={color ? { color } : {}}>{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-muted/50 rounded-lg p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function Empty({ ar, h = "h-80" }: { ar: boolean; h?: string }) {
  return <div className={`${h} flex items-center justify-center text-muted-foreground`}>{ar ? "لا توجد بيانات" : "No data available"}</div>;
}

function SalesTable({ salesChart, salesLoading, fmt, ar }: {
  salesChart: { date: string; orders: number; sales: number; tax: number; discount: number }[];
  salesLoading: boolean; fmt: (v: number) => string; ar: boolean;
}) {
  if (salesLoading) return <Card><CardContent><Skeleton className="h-48 w-full" /></CardContent></Card>;
  if (!salesChart.length) return null;

  const totS = salesChart.reduce((s, r) => s + r.sales, 0);
  const totO = salesChart.reduce((s, r) => s + r.orders, 0);
  const totT = salesChart.reduce((s, r) => s + r.tax, 0);
  const totD = salesChart.reduce((s, r) => s + r.discount, 0);

  return (
    <Card>
      <CardHeader><CardTitle>{ar ? "جدول المبيعات" : "Sales Table"}</CardTitle></CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b">
              <th className="text-start p-2 font-medium text-muted-foreground">{ar ? "التاريخ" : "Date"}</th>
              <th className="text-start p-2 font-medium text-muted-foreground">{ar ? "الطلبات" : "Orders"}</th>
              <th className="text-start p-2 font-medium text-muted-foreground">{ar ? "المبيعات" : "Sales"}</th>
              <th className="text-start p-2 font-medium text-muted-foreground">{ar ? "الضريبة" : "Tax"}</th>
              <th className="text-start p-2 font-medium text-muted-foreground">{ar ? "الخصم" : "Discount"}</th>
              <th className="text-start p-2 font-medium text-muted-foreground">{ar ? "الصافي" : "Net"}</th>
            </tr></thead>
            <tbody>{salesChart.map((r, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="p-2">{r.date}</td>
                <td className="p-2"><Badge variant="secondary">{r.orders}</Badge></td>
                <td className="p-2 font-medium">{fmt(r.sales)}</td>
                <td className="p-2 text-muted-foreground">{fmt(r.tax)}</td>
                <td className="p-2 text-muted-foreground">{fmt(r.discount)}</td>
                <td className="p-2 font-bold">{fmt(r.sales - r.discount)}</td>
              </tr>
            ))}</tbody>
            <tfoot><tr className="border-t-2 font-bold">
              <td className="p-2">{ar ? "الإجمالي" : "Total"}</td>
              <td className="p-2">{totO}</td>
              <td className="p-2">{fmt(totS)}</td>
              <td className="p-2">{fmt(totT)}</td>
              <td className="p-2">{fmt(totD)}</td>
              <td className="p-2">{fmt(totS - totD)}</td>
            </tr></tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

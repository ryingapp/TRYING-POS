import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, TrendingUp, Clock, ShoppingBag, DollarSign, Calendar, Download, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend, AreaChart, Area } from "recharts";
import { useLanguage } from "@/lib/i18n";
import { useBranch } from "@/lib/branch";
import { apiRequest } from "@/lib/queryClient";

const COLORS = ["#f97316", "#eab308", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899"];

const orderTypeLabels: Record<string, { en: string; ar: string }> = {
  dine_in: { en: "Dine-in", ar: "داخل المطعم" },
  pickup: { en: "Pickup", ar: "استلام" },
  delivery: { en: "Delivery", ar: "توصيل" },
};

interface SummaryData {
  today: { sales: number; orders: number };
  week: { sales: number; orders: number };
  month: { sales: number; orders: number };
  topItems: Array<{ id: string; name_en: string; name_ar: string; total_quantity: string; total_revenue: string }>;
  ordersByType: Array<{ order_type: string; count: string; total_revenue: string }>;
}

interface SalesReportRow {
  date: string;
  order_count: string;
  total_sales: string;
  total_tax: string;
  total_discount: string;
}

interface HourlyStatRow {
  hour: string;
  order_count: string;
  total_sales: string;
}

interface TopItemRow {
  id: string;
  name_en: string;
  name_ar: string;
  total_quantity: string;
  total_revenue: string;
}

const exportToCSV = (data: any[], filename: string, headers: string[]) => {
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(h => `"${row[h] || ''}"`).join(','))
  ].join('\n');
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(url);
};

const exportToExcel = (data: any[], filename: string, headers: string[]) => {
  const csvContent = [
    headers.join('\t'),
    ...data.map(row => headers.map(h => `${row[h] || ''}`).join('\t'))
  ].join('\n');
  const blob = new Blob(['\ufeff' + csvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.xls`;
  link.click();
  URL.revokeObjectURL(url);
};

const exportToPDF = () => {
  window.print();
};

function ExportDropdown({ onExportCSV, onExportExcel, language }: { onExportCSV: () => void; onExportExcel: () => void; language: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" data-testid="button-export">
          <Download className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
          {language === "ar" ? "تصدير" : "Export"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onExportCSV} data-testid="button-export-csv">
          <FileText className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
          CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onExportExcel} data-testid="button-export-excel">
          <FileSpreadsheet className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
          Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToPDF} data-testid="button-export-pdf">
          <Printer className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
          PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function Reports() {
  const { t, language } = useLanguage();
  const { selectedBranchId } = useBranch();
  const [activeTab, setActiveTab] = useState("overview");
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
  });

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  const { data: summary, isLoading: summaryLoading } = useQuery<SummaryData>({
    queryKey: ['/api/reports/summary', selectedBranchId],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBranchId) params.set('branch', selectedBranchId);
      const res = await apiRequest('GET', `/api/reports/summary?${params.toString()}`);
      return res.json();
    },
  });

  const { data: salesData, isLoading: salesLoading } = useQuery<SalesReportRow[]>({
    queryKey: ['/api/reports/sales', dateRange.startDate, dateRange.endDate, selectedBranchId],
    queryFn: async () => {
      const params = new URLSearchParams({ startDate: dateRange.startDate, endDate: dateRange.endDate });
      if (selectedBranchId) params.set('branch', selectedBranchId);
      const res = await apiRequest('GET', `/api/reports/sales?${params.toString()}`);
      return res.json();
    },
  });

  const { data: hourlyData, isLoading: hourlyLoading } = useQuery<HourlyStatRow[]>({
    queryKey: ['/api/reports/hourly-stats', todayStr, selectedBranchId],
    queryFn: async () => {
      const params = new URLSearchParams({ date: todayStr });
      if (selectedBranchId) params.set('branch', selectedBranchId);
      const res = await apiRequest('GET', `/api/reports/hourly-stats?${params.toString()}`);
      return res.json();
    },
  });

  const { data: topItemsData, isLoading: topItemsLoading } = useQuery<TopItemRow[]>({
    queryKey: ['/api/reports/top-items', selectedBranchId],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '10' });
      if (selectedBranchId) params.set('branch', selectedBranchId);
      const res = await apiRequest('GET', `/api/reports/top-items?${params.toString()}`);
      return res.json();
    },
  });

  const formatCurrency = (value: number) => {
    return `${value.toFixed(2)} ${t("sar")}`;
  };

  const salesChartData = useMemo(() =>
    salesData?.map((row) => ({
      date: new Date(row.date).toLocaleDateString(language === "ar" ? "ar-SA" : "en-US", { month: "short", day: "numeric" }),
      sales: parseFloat(row.total_sales || "0"),
      orders: parseInt(row.order_count || "0"),
      tax: parseFloat(row.total_tax || "0"),
      discount: parseFloat(row.total_discount || "0"),
    })) || [],
    [salesData, language]
  );

  const hourlyChartData = useMemo(() =>
    Array.from({ length: 24 }, (_, i) => {
      const hourData = hourlyData?.find((h) => parseInt(h.hour) === i);
      return {
        hour: `${i.toString().padStart(2, "0")}:00`,
        orders: hourData ? parseInt(hourData.order_count) : 0,
        sales: hourData ? parseFloat(hourData.total_sales) : 0,
      };
    }),
    [hourlyData]
  );

  const orderTypeData = useMemo(() =>
    summary?.ordersByType?.map((item) => ({
      name: language === "ar"
        ? orderTypeLabels[item.order_type]?.ar || item.order_type
        : orderTypeLabels[item.order_type]?.en || item.order_type,
      value: parseInt(item.count || "0"),
      revenue: parseFloat(item.total_revenue || "0"),
    })) || [],
    [summary, language]
  );

  const topItemsChartData = useMemo(() =>
    (topItemsData || summary?.topItems || []).map((item) => ({
      name: language === "ar" && item.name_ar ? item.name_ar : item.name_en,
      quantity: parseInt(item.total_quantity || "0"),
      revenue: parseFloat(item.total_revenue || "0"),
    })),
    [topItemsData, summary, language]
  );

  const peakHourInfo = useMemo(() => {
    if (!hourlyChartData.length) return null;
    const peak = hourlyChartData.reduce((max, curr) => curr.orders > max.orders ? curr : max, hourlyChartData[0]);
    const totalOrders = hourlyChartData.reduce((sum, curr) => sum + curr.orders, 0);
    const totalSales = hourlyChartData.reduce((sum, curr) => sum + curr.sales, 0);
    return { peakHour: peak.hour, peakOrders: peak.orders, totalOrders, totalSales };
  }, [hourlyChartData]);

  const avgOrderValue = useMemo(() => {
    if (!summary?.month?.orders || summary.month.orders === 0) return 0;
    return (summary.month.sales || 0) / summary.month.orders;
  }, [summary]);

  const handleExportSales = (type: 'csv' | 'excel') => {
    const data = salesChartData.map(row => ({
      date: row.date,
      orders: row.orders,
      sales: row.sales.toFixed(2),
      tax: row.tax.toFixed(2),
      discount: row.discount.toFixed(2),
    }));
    const headers = ['date', 'orders', 'sales', 'tax', 'discount'];
    if (type === 'csv') exportToCSV(data, 'sales-report', headers);
    else exportToExcel(data, 'sales-report', headers);
  };

  const handleExportHourly = (type: 'csv' | 'excel') => {
    const data = hourlyChartData.map(row => ({
      hour: row.hour,
      orders: row.orders,
      sales: row.sales.toFixed(2),
    }));
    const headers = ['hour', 'orders', 'sales'];
    if (type === 'csv') exportToCSV(data, 'hourly-report', headers);
    else exportToExcel(data, 'hourly-report', headers);
  };

  const handleExportTopItems = (type: 'csv' | 'excel') => {
    const data = topItemsChartData.map((row, i) => ({
      rank: i + 1,
      name: row.name,
      quantity: row.quantity,
      revenue: row.revenue.toFixed(2),
    }));
    const headers = ['rank', 'name', 'quantity', 'revenue'];
    if (type === 'csv') exportToCSV(data, 'top-items-report', headers);
    else exportToExcel(data, 'top-items-report', headers);
  };

  if (summaryLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 print:p-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-reports-title">
            {language === "ar" ? "التقارير والتحليلات" : "Reports & Analytics"}
          </h1>
          <p className="text-muted-foreground">
            {language === "ar" ? "تتبع أداء مطعمك وتحليل البيانات" : "Track your restaurant performance and analyze data"}
          </p>
        </div>
        <div className="flex gap-2 items-end flex-wrap">
          <div>
            <Label htmlFor="startDate">{language === "ar" ? "من" : "From"}</Label>
            <Input
              id="startDate"
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              data-testid="input-start-date"
            />
          </div>
          <div>
            <Label htmlFor="endDate">{language === "ar" ? "إلى" : "To"}</Label>
            <Input
              id="endDate"
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              data-testid="input-end-date"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-today-sales">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "ar" ? "مبيعات اليوم" : "Today's Sales"}
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-today-sales">{formatCurrency(summary?.today?.sales || 0)}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <Badge variant="secondary">{summary?.today?.orders || 0}</Badge>
              {language === "ar" ? "طلب" : "orders"}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-week-sales">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "ar" ? "مبيعات الأسبوع" : "Weekly Sales"}
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-week-sales">{formatCurrency(summary?.week?.sales || 0)}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <Badge variant="secondary">{summary?.week?.orders || 0}</Badge>
              {language === "ar" ? "طلب" : "orders"}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-month-sales">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "ar" ? "مبيعات الشهر" : "Monthly Sales"}
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-month-sales">{formatCurrency(summary?.month?.sales || 0)}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <Badge variant="secondary">{summary?.month?.orders || 0}</Badge>
              {language === "ar" ? "طلب" : "orders"}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-avg-order">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              {language === "ar" ? "متوسط قيمة الطلب" : "Avg. Order Value"}
            </CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-order">{formatCurrency(avgOrderValue)}</div>
            <p className="text-xs text-muted-foreground">
              {language === "ar" ? "هذا الشهر" : "this month"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview" data-testid="tab-overview">
            <BarChart3 className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
            {language === "ar" ? "نظرة عامة" : "Overview"}
          </TabsTrigger>
          <TabsTrigger value="sales" data-testid="tab-sales">
            <TrendingUp className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
            {language === "ar" ? "المبيعات" : "Sales"}
          </TabsTrigger>
          <TabsTrigger value="hourly" data-testid="tab-hourly">
            <Clock className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
            {language === "ar" ? "أوقات الذروة" : "Peak Hours"}
          </TabsTrigger>
          <TabsTrigger value="items" data-testid="tab-items">
            <ShoppingBag className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
            {language === "ar" ? "الأصناف الأكثر مبيعاً" : "Top Items"}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="flex justify-end print:hidden">
            <ExportDropdown
              language={language}
              onExportCSV={() => handleExportSales('csv')}
              onExportExcel={() => handleExportSales('excel')}
            />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>{language === "ar" ? "اتجاه المبيعات" : "Sales Trend"}</CardTitle>
              </CardHeader>
              <CardContent>
                {salesLoading ? (
                  <Skeleton className="h-80 w-full" />
                ) : salesChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <AreaChart data={salesChartData}>
                      <defs>
                        <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                      <XAxis dataKey="date" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        labelFormatter={(label) => label}
                        contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                      />
                      <Area
                        type="monotone"
                        dataKey="sales"
                        stroke="#f97316"
                        strokeWidth={2}
                        fill="url(#salesGradient)"
                        name={language === "ar" ? "المبيعات" : "Sales"}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-80 flex items-center justify-center text-muted-foreground">
                    {language === "ar" ? "لا توجد بيانات" : "No data available"}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{language === "ar" ? "أنواع الطلبات" : "Order Types"}</CardTitle>
              </CardHeader>
              <CardContent>
                {orderTypeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart>
                      <Pie
                        data={orderTypeData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={40}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {orderTypeData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => value} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-80 flex items-center justify-center text-muted-foreground">
                    {language === "ar" ? "لا توجد بيانات" : "No data available"}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{language === "ar" ? "تفاصيل المبيعات" : "Sales Details"}</CardTitle>
            </CardHeader>
            <CardContent>
              {salesLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : salesChartData.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-overview-sales">
                    <thead>
                      <tr className="border-b">
                        <th className="text-start p-2 font-medium text-muted-foreground">{language === "ar" ? "التاريخ" : "Date"}</th>
                        <th className="text-start p-2 font-medium text-muted-foreground">{language === "ar" ? "الطلبات" : "Orders"}</th>
                        <th className="text-start p-2 font-medium text-muted-foreground">{language === "ar" ? "المبيعات" : "Sales"}</th>
                        <th className="text-start p-2 font-medium text-muted-foreground">{language === "ar" ? "الضريبة" : "Tax"}</th>
                        <th className="text-start p-2 font-medium text-muted-foreground">{language === "ar" ? "الخصم" : "Discount"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesChartData.slice(0, 10).map((row, idx) => (
                        <tr key={idx} className="border-b last:border-0">
                          <td className="p-2">{row.date}</td>
                          <td className="p-2"><Badge variant="secondary">{row.orders}</Badge></td>
                          <td className="p-2 font-medium">{formatCurrency(row.sales)}</td>
                          <td className="p-2 text-muted-foreground">{formatCurrency(row.tax)}</td>
                          <td className="p-2 text-muted-foreground">{formatCurrency(row.discount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="h-24 flex items-center justify-center text-muted-foreground">
                  {language === "ar" ? "لا توجد بيانات" : "No data available"}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales" className="space-y-6">
          <div className="flex justify-end print:hidden">
            <ExportDropdown
              language={language}
              onExportCSV={() => handleExportSales('csv')}
              onExportExcel={() => handleExportSales('excel')}
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{language === "ar" ? "المبيعات اليومية" : "Daily Sales"}</CardTitle>
            </CardHeader>
            <CardContent>
              {salesLoading ? (
                <Skeleton className="h-80 w-full" />
              ) : salesChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={salesChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="date" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip
                      formatter={(value: number, name: string) =>
                        name === (language === "ar" ? "الطلبات" : "Orders") ? value : formatCurrency(value)
                      }
                      contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="sales"
                      stroke="#f97316"
                      strokeWidth={2}
                      dot={false}
                      name={language === "ar" ? "المبيعات" : "Sales"}
                    />
                    <Line
                      type="monotone"
                      dataKey="orders"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                      name={language === "ar" ? "الطلبات" : "Orders"}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-80 flex items-center justify-center text-muted-foreground">
                  {language === "ar" ? "لا توجد بيانات" : "No data available"}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{language === "ar" ? "جدول المبيعات" : "Sales Table"}</CardTitle>
            </CardHeader>
            <CardContent>
              {salesLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : salesChartData.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-sales">
                    <thead>
                      <tr className="border-b">
                        <th className="text-start p-2 font-medium text-muted-foreground">{language === "ar" ? "التاريخ" : "Date"}</th>
                        <th className="text-start p-2 font-medium text-muted-foreground">{language === "ar" ? "الطلبات" : "Orders"}</th>
                        <th className="text-start p-2 font-medium text-muted-foreground">{language === "ar" ? "المبيعات" : "Sales"}</th>
                        <th className="text-start p-2 font-medium text-muted-foreground">{language === "ar" ? "الضريبة" : "Tax"}</th>
                        <th className="text-start p-2 font-medium text-muted-foreground">{language === "ar" ? "الخصم" : "Discount"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesChartData.map((row, idx) => (
                        <tr key={idx} className="border-b last:border-0">
                          <td className="p-2">{row.date}</td>
                          <td className="p-2"><Badge variant="secondary">{row.orders}</Badge></td>
                          <td className="p-2 font-medium">{formatCurrency(row.sales)}</td>
                          <td className="p-2 text-muted-foreground">{formatCurrency(row.tax)}</td>
                          <td className="p-2 text-muted-foreground">{formatCurrency(row.discount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="h-24 flex items-center justify-center text-muted-foreground">
                  {language === "ar" ? "لا توجد بيانات" : "No data available"}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hourly" className="space-y-6">
          <div className="flex justify-end print:hidden">
            <ExportDropdown
              language={language}
              onExportCSV={() => handleExportHourly('csv')}
              onExportExcel={() => handleExportHourly('excel')}
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{language === "ar" ? "توزيع الطلبات حسب الساعة (اليوم)" : "Orders by Hour (Today)"}</CardTitle>
            </CardHeader>
            <CardContent>
              {hourlyLoading ? (
                <Skeleton className="h-80 w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={hourlyChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="hour" fontSize={11} />
                    <YAxis yAxisId="left" orientation="left" stroke="#f97316" fontSize={12} />
                    <YAxis yAxisId="right" orientation="right" stroke="#3b82f6" fontSize={12} />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                      formatter={(value: number, name: string) =>
                        name === (language === "ar" ? "المبيعات" : "Sales") ? formatCurrency(value) : value
                      }
                    />
                    <Legend />
                    <Bar
                      yAxisId="left"
                      dataKey="orders"
                      fill="#f97316"
                      radius={[4, 4, 0, 0]}
                      name={language === "ar" ? "الطلبات" : "Orders"}
                    />
                    <Bar
                      yAxisId="right"
                      dataKey="sales"
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                      name={language === "ar" ? "المبيعات" : "Sales"}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {peakHourInfo && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card data-testid="card-peak-hour">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {language === "ar" ? "ساعة الذروة" : "Peak Hour"}
                  </CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" style={{ color: '#f97316' }}>{peakHourInfo.peakHour}</div>
                  <p className="text-xs text-muted-foreground">
                    {peakHourInfo.peakOrders} {language === "ar" ? "طلب" : "orders"}
                  </p>
                </CardContent>
              </Card>

              <Card data-testid="card-total-orders-today">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {language === "ar" ? "إجمالي الطلبات اليوم" : "Total Orders Today"}
                  </CardTitle>
                  <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{peakHourInfo.totalOrders}</div>
                </CardContent>
              </Card>

              <Card data-testid="card-total-sales-today">
                <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {language === "ar" ? "إجمالي المبيعات اليوم" : "Total Sales Today"}
                  </CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{formatCurrency(peakHourInfo.totalSales)}</div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="items" className="space-y-6">
          <div className="flex justify-end print:hidden">
            <ExportDropdown
              language={language}
              onExportCSV={() => handleExportTopItems('csv')}
              onExportExcel={() => handleExportTopItems('excel')}
            />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>{language === "ar" ? "الأصناف الأكثر مبيعاً" : "Top Selling Items"}</CardTitle>
            </CardHeader>
            <CardContent>
              {topItemsLoading ? (
                <Skeleton className="h-80 w-full" />
              ) : topItemsChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={topItemsChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis type="number" fontSize={12} />
                    <YAxis dataKey="name" type="category" width={150} fontSize={12} />
                    <Tooltip
                      formatter={(value: number, name: string) =>
                        name === (language === "ar" ? "الإيرادات" : "Revenue")
                          ? formatCurrency(value)
                          : value
                      }
                      contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                    />
                    <Legend />
                    <Bar
                      dataKey="quantity"
                      fill="#f97316"
                      radius={[0, 4, 4, 0]}
                      name={language === "ar" ? "الكمية" : "Quantity"}
                    />
                    <Bar
                      dataKey="revenue"
                      fill="#22c55e"
                      radius={[0, 4, 4, 0]}
                      name={language === "ar" ? "الإيرادات" : "Revenue"}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-80 flex items-center justify-center text-muted-foreground">
                  {language === "ar" ? "لا توجد بيانات" : "No data available"}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{language === "ar" ? "تفاصيل الأصناف" : "Item Details"}</CardTitle>
            </CardHeader>
            <CardContent>
              {topItemsLoading ? (
                <Skeleton className="h-48 w-full" />
              ) : topItemsChartData.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="table-top-items">
                    <thead>
                      <tr className="border-b">
                        <th className="text-start p-2 font-medium text-muted-foreground">#</th>
                        <th className="text-start p-2 font-medium text-muted-foreground">{language === "ar" ? "الصنف" : "Item"}</th>
                        <th className="text-start p-2 font-medium text-muted-foreground">{language === "ar" ? "الكمية" : "Quantity"}</th>
                        <th className="text-start p-2 font-medium text-muted-foreground">{language === "ar" ? "الإيرادات" : "Revenue"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topItemsChartData.map((row, idx) => (
                        <tr key={idx} className="border-b last:border-0">
                          <td className="p-2">
                            <Badge variant={idx < 3 ? "default" : "secondary"} style={idx < 3 ? { backgroundColor: COLORS[idx] } : {}}>
                              {idx + 1}
                            </Badge>
                          </td>
                          <td className="p-2 font-medium">{row.name}</td>
                          <td className="p-2">{row.quantity}</td>
                          <td className="p-2 font-medium">{formatCurrency(row.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="h-24 flex items-center justify-center text-muted-foreground">
                  {language === "ar" ? "لا توجد بيانات" : "No data available"}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="print:hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            {language === "ar" ? "تصدير البيانات" : "Data Export"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            {language === "ar" ? "تصدير البيانات الكاملة كملفات CSV لاستخدامها في Excel" : "Export full data as CSV files for use in Excel"}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button variant="outline" className="justify-start gap-2" onClick={() => {
              const params = new URLSearchParams();
              if (selectedBranchId) params.set("branchId", selectedBranchId);
              if (dateRange.startDate) params.set("startDate", dateRange.startDate);
              if (dateRange.endDate) params.set("endDate", dateRange.endDate);
              window.open(`/api/export/orders?${params.toString()}`, "_blank");
            }}>
              <FileSpreadsheet className="h-4 w-4" />
              {language === "ar" ? "تصدير الطلبات" : "Export Orders"}
            </Button>
            <Button variant="outline" className="justify-start gap-2" onClick={() => {
              window.open("/api/export/inventory", "_blank");
            }}>
              <FileSpreadsheet className="h-4 w-4" />
              {language === "ar" ? "تصدير المخزون" : "Export Inventory"}
            </Button>
            <Button variant="outline" className="justify-start gap-2" onClick={() => {
              window.open("/api/export/customers", "_blank");
            }}>
              <FileSpreadsheet className="h-4 w-4" />
              {language === "ar" ? "تصدير العملاء" : "Export Customers"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

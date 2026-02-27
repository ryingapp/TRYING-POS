import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, Edit2, Trash2, Users, Phone, Mail, ShoppingBag } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Customer } from "@shared/schema";

const customerSchema = z.object({
  name: z.string().optional(),
  phone: z.string().min(1, "Required"),
  email: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

export default function CustomersPage() {
  const { t, language, direction } = useLanguage();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<Customer | null>(null);

  const { data: customers, isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const form = useForm<z.infer<typeof customerSchema>>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: "",
      phone: "",
      email: "",
      address: "",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: z.infer<typeof customerSchema>) =>
      apiRequest("POST", "/api/customers", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: language === "ar" ? "تم إضافة العميل" : "Customer added successfully" });
      setIsAddDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({ title: language === "ar" ? "فشل في إضافة العميل" : "Failed to add customer", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: z.infer<typeof customerSchema>) =>
      apiRequest("PUT", `/api/customers/${editingCustomer?.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: language === "ar" ? "تم تحديث العميل" : "Customer updated successfully" });
      setEditingCustomer(null);
      form.reset();
    },
    onError: () => {
      toast({ title: language === "ar" ? "فشل في تحديث العميل" : "Failed to update customer", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/customers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: language === "ar" ? "تم حذف العميل" : "Customer deleted" });
      setDeletingCustomer(null);
    },
    onError: () => {
      toast({ title: language === "ar" ? "فشل في حذف العميل" : "Failed to delete customer", variant: "destructive" });
    },
  });

  const onSubmit = (data: z.infer<typeof customerSchema>) => {
    if (editingCustomer) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const openEditDialog = (customer: Customer) => {
    setEditingCustomer(customer);
    form.reset({
      name: customer.name || "",
      phone: customer.phone || "",
      email: customer.email || "",
      address: customer.address || "",
      notes: customer.notes || "",
    });
  };

  const openAddDialog = () => {
    setIsAddDialogOpen(true);
    form.reset({
      name: "",
      phone: "",
      email: "",
      address: "",
      notes: "",
    });
  };

  const filteredCustomers = customers?.filter((customer) => {
    const matchesSearch =
      (customer.name && customer.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (customer.phone && customer.phone.includes(searchQuery));
    return matchesSearch;
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {language === "ar" ? "العملاء" : "Customers"}
          </h1>
          <p className="text-muted-foreground">
            {language === "ar" ? "إدارة بيانات العملاء" : "Manage customer data"}
          </p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
          {language === "ar" ? "إضافة عميل" : "Add Customer"}
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{language === "ar" ? "إجمالي العملاء" : "Total Customers"}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customers?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{language === "ar" ? "إجمالي الطلبات" : "Total Orders"}</CardTitle>
            <ShoppingBag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{customers?.reduce((sum, c) => sum + (c.totalOrders || 0), 0) || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{language === "ar" ? "إجمالي الإيرادات" : "Total Revenue"}</CardTitle>
            <span className="text-sm text-muted-foreground">{language === "ar" ? "ر.س" : "SAR"}</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(customers?.reduce((sum, c) => sum + parseFloat(c.totalSpent || "0"), 0) || 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{language === "ar" ? "متوسط الإنفاق" : "Avg. Spend"}</CardTitle>
            <span className="text-sm text-muted-foreground">{language === "ar" ? "ر.س" : "SAR"}</span>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {customers && customers.length > 0
                ? (customers.reduce((sum, c) => sum + parseFloat(c.totalSpent || "0"), 0) / customers.length).toFixed(2)
                : "0.00"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute start-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder={language === "ar" ? "بحث بالاسم أو الهاتف..." : "Search by name or phone..."}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="ps-10"
        />
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 w-full bg-muted animate-pulse rounded" />
          ))}
        </div>
      ) : filteredCustomers && filteredCustomers.length > 0 ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{language === "ar" ? "الاسم" : "Name"}</TableHead>
                <TableHead>{language === "ar" ? "الهاتف" : "Phone"}</TableHead>
                <TableHead className="hidden md:table-cell">{language === "ar" ? "البريد" : "Email"}</TableHead>
                <TableHead className="text-center">{language === "ar" ? "الطلبات" : "Orders"}</TableHead>
                <TableHead>{language === "ar" ? "إجمالي الإنفاق" : "Total Spent"}</TableHead>
                <TableHead className="hidden sm:table-cell">{language === "ar" ? "آخر طلب" : "Last Order"}</TableHead>
                <TableHead className="text-center">{language === "ar" ? "الإجراءات" : "Actions"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.name || "-"}</TableCell>
                  <TableCell dir="ltr" className="text-start">{customer.phone}</TableCell>
                  <TableCell className="hidden md:table-cell">{customer.email || "-"}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{customer.totalOrders || 0}</Badge>
                  </TableCell>
                  <TableCell>
                    {parseFloat(customer.totalSpent || "0").toFixed(2)} {language === "ar" ? "ر.س" : "SAR"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {customer.lastOrderAt
                      ? new Date(customer.lastOrderAt).toLocaleDateString(language === "ar" ? "ar-SA" : "en-US")
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(customer)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingCustomer(customer)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <Card className="p-12 text-center">
          <Users className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">
            {language === "ar" ? "لا يوجد عملاء" : "No customers found"}
          </h3>
          <p className="text-muted-foreground mb-4">
            {language === "ar" ? "ابدأ بإضافة عملاء لتتبع طلباتهم" : "Start adding customers to track their orders"}
          </p>
          <Button onClick={openAddDialog}>
            <Plus className="w-4 h-4 ltr:mr-2 rtl:ml-2" />
            {language === "ar" ? "إضافة عميل" : "Add Customer"}
          </Button>
        </Card>
      )}

      <Dialog
        open={isAddDialogOpen || !!editingCustomer}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddDialogOpen(false);
            setEditingCustomer(null);
            form.reset();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCustomer
                ? (language === "ar" ? "تعديل عميل" : "Edit Customer")
                : (language === "ar" ? "إضافة عميل" : "Add Customer")}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "ar" ? "الاسم" : "Name"}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "ar" ? "رقم الهاتف" : "Phone Number"} *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "ar" ? "البريد الإلكتروني" : "Email"}</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "ar" ? "العنوان" : "Address"}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{language === "ar" ? "ملاحظات" : "Notes"}</FormLabel>
                    <FormControl>
                      <Textarea {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={isPending} className="w-full">
                {isPending
                  ? (language === "ar" ? "جاري الحفظ..." : "Saving...")
                  : (language === "ar" ? "حفظ" : "Save")}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deletingCustomer}
        onOpenChange={(open) => {
          if (!open) setDeletingCustomer(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {language === "ar" ? "حذف عميل" : "Delete Customer"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            {language === "ar" ? "هل أنت متأكد من حذف هذا العميل؟" : "Are you sure you want to delete this customer?"}
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeletingCustomer(null)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deletingCustomer) {
                  deleteMutation.mutate(deletingCustomer.id);
                }
              }}
            >
              {deleteMutation.isPending
                ? (language === "ar" ? "جاري الحذف..." : "Deleting...")
                : (language === "ar" ? "حذف" : "Delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

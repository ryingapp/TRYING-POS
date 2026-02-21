import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Search, Edit2, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
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
    <div className="p-6 space-y-6" dir={direction}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {t("customers") || (language === "ar" ? "العملاء" : "Customers")}
          </h1>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="w-4 h-4 mr-2" />
          {t("addCustomer") || (language === "ar" ? "إضافة عميل" : "Add Customer")}
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder={language === "ar" ? "بحث بالاسم أو الهاتف..." : "Search by name or phone..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
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
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("phone")}</TableHead>
                <TableHead>{t("email")}</TableHead>
                <TableHead>{t("totalOrders")}</TableHead>
                <TableHead>{t("totalSpent") || (language === "ar" ? "إجمالي المصروفات" : "Total Spent")}</TableHead>
                <TableHead>{t("lastOrder") || (language === "ar" ? "آخر طلب" : "Last Order")}</TableHead>
                <TableHead>{t("actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-medium">{customer.name || "-"}</TableCell>
                  <TableCell>{customer.phone}</TableCell>
                  <TableCell>{customer.email || "-"}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{customer.totalOrders || 0}</Badge>
                  </TableCell>
                  <TableCell>
                    {customer.totalSpent || "0"} {language === "ar" ? "ريال" : "SAR"}
                  </TableCell>
                  <TableCell>
                    {customer.lastOrderAt
                      ? new Date(customer.lastOrderAt).toLocaleDateString()
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
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
        <Card className="p-8">
          <p className="text-center text-muted-foreground">
            {t("noCustomers") || (language === "ar" ? "لا يوجد عملاء" : "No customers found")}
          </p>
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
                ? (t("editCustomer") || (language === "ar" ? "تعديل عميل" : "Edit Customer"))
                : (t("addCustomer") || (language === "ar" ? "إضافة عميل" : "Add Customer"))}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("name")}</FormLabel>
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
                    <FormLabel>{t("customerPhone") || (language === "ar" ? "رقم الهاتف" : "Phone Number")}</FormLabel>
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
                    <FormLabel>{t("email")}</FormLabel>
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
                    <FormLabel>{t("address")}</FormLabel>
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
                    <FormLabel>{t("notes")}</FormLabel>
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
              {t("deleteCustomer") || (language === "ar" ? "حذف عميل" : "Delete Customer")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            {t("confirmDeleteCustomer") || (language === "ar" ? "هل أنت متأكد من حذف هذا العميل؟" : "Are you sure you want to delete this customer?")}
          </p>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeletingCustomer(null)}>
              {t("cancel")}
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
                : t("delete")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

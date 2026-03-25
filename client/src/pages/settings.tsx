import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useRef, useEffect } from "react";
import { Store, Receipt, Building2, Users, LayoutGrid, Plus, Trash2, Edit2, Printer, CreditCard, Upload, ExternalLink, CheckCircle2, AlertCircle, Clock, RefreshCw, ImagePlus, X, Crown, FileText, Shield, Wifi, Link2, AlertTriangle } from "lucide-react";
import DeliverySettingsPage from "./delivery-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormDescription,
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
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";
import { useBranch } from "@/lib/branch";
import { useAuth } from "@/lib/auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Restaurant, InsertRestaurant, Branch, User, Printer as PrinterType } from "@shared/schema";
import { kitchenTypes, priceRanges, userRoles, menuHeaderTypes, menuThemeColors, menuDisplayStyles, printerTypes } from "@shared/schema";

const connectionTypes = ["network", "usb", "bluetooth"] as const;

const generalFormSchema = z.object({
  nameEn: z.string().min(1, "Required"),
  nameAr: z.string().min(1, "Required"),
  descriptionEn: z.string().optional(),
  descriptionAr: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  kitchenType: z.string().optional(),
  priceRange: z.string().optional(),
  openingTime: z.string().optional(),
  closingTime: z.string().optional(),
  logo: z.string().optional(),
  serviceDineIn: z.boolean().optional(),
  servicePickup: z.boolean().optional(),
  serviceDelivery: z.boolean().optional(),
  serviceTableBooking: z.boolean().optional(),
  serviceQueue: z.boolean().optional(),
  allowCashOnPublicQR: z.boolean().optional(),
  socialInstagram: z.string().optional(),
  socialTwitter: z.string().optional(),
  socialTiktok: z.string().optional(),
  socialSnapchat: z.string().optional(),
  socialFacebook: z.string().optional(),
});

const menuSettingsSchema = z.object({
  menuHeaderType: z.string().optional(),
  menuThemeColor: z.string().optional(),
  menuDisplayStyle: z.string().optional(),
  banner: z.string().optional(),
});

const billingFormSchema = z.object({
  taxEnabled: z.boolean().optional(),
  vatNumber: z.string().optional(),
  commercialRegistration: z.string().optional(),
  commercialRegistrationName: z.string().optional(),
  shortAddress: z.string().optional(),
  registrationType: z.string().optional(),
  industry: z.string().optional(),
  invoiceType: z.string().optional(),
  taxRate: z.string().optional(),
  ownerName: z.string().optional(),
  ownerPhone: z.string().optional(),
  postalCode: z.string().optional(),
  buildingNumber: z.string().optional(),
  streetName: z.string().optional(),
  district: z.string().optional(),
  city: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountHolder: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankSwift: z.string().optional(),
  bankIban: z.string().optional(),
  edfapayMerchantId: z.string().optional(),
  edfapayPassword: z.string().optional(),
});

const branchFormSchema = z.object({
  name: z.string().min(1, "Required"),
  nameAr: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  openingTime: z.string().optional(),
  closingTime: z.string().optional(),
  isActive: z.boolean().default(true),
});

const userFormSchema = z.object({
  email: z.string().email("Invalid email"),
  name: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  role: z.string().min(1, "Required"),
  branchId: z.string().optional(),
  isActive: z.boolean().default(true),
  permDashboard: z.boolean().default(false),
  permPos: z.boolean().default(false),
  permOrders: z.boolean().default(false),
  permMenu: z.boolean().default(false),
  permKitchen: z.boolean().default(false),
  permInventory: z.boolean().default(false),
  permReviews: z.boolean().default(false),
  permMarketing: z.boolean().default(false),
  permQr: z.boolean().default(false),
  permReports: z.boolean().default(false),
  permSettings: z.boolean().default(false),
  permTables: z.boolean().default(false),
});

const printerFormSchema = z.object({
  name: z.string().min(1, "Required"),
  type: z.string().min(1, "Required"),
  connectionType: z.string().min(1, "Required"),
  ipAddress: z.string().optional(),
  port: z.string().optional(),
  branchId: z.string().optional(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  paperWidth: z.string().default("80"),
}).refine((data) => {
  if (data.connectionType === "network") {
    return data.ipAddress && data.ipAddress.length > 0;
  }
  return true;
}, {
  message: "IP Address is required for network printers",
  path: ["ipAddress"],
});

const edfapayConfigSchema = z.object({
  edfapayMerchantId: z.string().optional(),
  edfapayPassword: z.string().optional(),
  edfapaySoftposAuthToken: z.string().optional(),
});

export default function SettingsPage() {
  const { t, language, getLocalizedName } = useLanguage();
  const { toast } = useToast();
  const { selectedBranch } = useBranch();
  const { user: authUser } = useAuth();
  const isPlatformAdmin = authUser?.role === 'platform_admin';
  const isOwnerOrAdmin = authUser?.role === 'owner' || isPlatformAdmin;
  const isMainBranch = selectedBranch?.isMain === true;
  const [activeTab, setActiveTab] = useState(() => {
    const saved = sessionStorage.getItem("settings-tab");
    if (saved) return saved;
    return isMainBranch ? "general" : "printers";
  });

  // Persist active tab so it survives re-mounts
  useEffect(() => {
    sessionStorage.setItem("settings-tab", activeTab);
  }, [activeTab]);
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [printerDialogOpen, setPrinterDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingPrinter, setEditingPrinter] = useState<PrinterType | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  const { data: restaurant, isLoading } = useQuery<Restaurant>({
    queryKey: ["/api/restaurant"],
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: printers = [] } = useQuery<PrinterType[]>({
    queryKey: ["/api/printers"],
  });

  const { data: restaurantsList = [] } = useQuery<any[]>({
    queryKey: ["/api/restaurants"],
    enabled: isPlatformAdmin,
  });

  const generalForm = useForm<z.infer<typeof generalFormSchema>>({
    resolver: zodResolver(generalFormSchema),
    values: {
      nameEn: restaurant?.nameEn || "",
      nameAr: restaurant?.nameAr || "",
      descriptionEn: restaurant?.descriptionEn || "",
      descriptionAr: restaurant?.descriptionAr || "",
      address: restaurant?.address || "",
      phone: restaurant?.phone || "",
      whatsapp: restaurant?.whatsapp || "",
      email: restaurant?.email || "",
      kitchenType: restaurant?.kitchenType || "",
      priceRange: restaurant?.priceRange || "",
      openingTime: restaurant?.openingTime || "",
      closingTime: restaurant?.closingTime || "",
      logo: restaurant?.logo || "",
      serviceDineIn: restaurant?.serviceDineIn ?? true,
      servicePickup: restaurant?.servicePickup ?? true,
      serviceDelivery: restaurant?.serviceDelivery ?? true,
      serviceTableBooking: restaurant?.serviceTableBooking ?? false,
      serviceQueue: restaurant?.serviceQueue ?? false,
      allowCashOnPublicQR: (restaurant as any)?.allowCashOnPublicQR ?? true,
      socialInstagram: (restaurant as any)?.socialInstagram || "",
      socialTwitter: (restaurant as any)?.socialTwitter || "",
      socialTiktok: (restaurant as any)?.socialTiktok || "",
      socialSnapchat: (restaurant as any)?.socialSnapchat || "",
      socialFacebook: (restaurant as any)?.socialFacebook || "",
    },
  });

  const menuForm = useForm<z.infer<typeof menuSettingsSchema>>({
    resolver: zodResolver(menuSettingsSchema),
    values: {
      menuHeaderType: restaurant?.menuHeaderType || "logo_banner",
      menuThemeColor: restaurant?.menuThemeColor || "red",
      menuDisplayStyle: restaurant?.menuDisplayStyle || "grid",
      banner: restaurant?.banner || "",
    },
  });

  const billingForm = useForm<z.infer<typeof billingFormSchema>>({
    resolver: zodResolver(billingFormSchema),
    values: {
      taxEnabled: restaurant?.taxEnabled !== false,
      vatNumber: restaurant?.vatNumber || "",
      commercialRegistration: restaurant?.commercialRegistration || "",
      commercialRegistrationName: (restaurant as any)?.commercialRegistrationName || "",
      shortAddress: (restaurant as any)?.shortAddress || "",
      registrationType: (restaurant as any)?.registrationType || "CRN",
      industry: (restaurant as any)?.industry || "Food",
      invoiceType: (restaurant as any)?.invoiceType || "1100",
      taxRate: restaurant?.taxRate || "15",
      ownerName: restaurant?.ownerName || "",
      ownerPhone: restaurant?.ownerPhone || "",
      postalCode: restaurant?.postalCode || "",
      buildingNumber: restaurant?.buildingNumber || "",
      streetName: restaurant?.streetName || "",
      district: restaurant?.district || "",
      city: restaurant?.city || "",
      bankName: restaurant?.bankName || "",
      bankAccountHolder: restaurant?.bankAccountHolder || "",
      bankAccountNumber: restaurant?.bankAccountNumber || "",
      bankSwift: restaurant?.bankSwift || "",
      bankIban: restaurant?.bankIban || "",
      edfapayMerchantId: (restaurant as any)?.edfapayMerchantId || "",
      edfapayPassword: (restaurant as any)?.edfapayPassword || "",
    },
  });

  const branchForm = useForm<z.infer<typeof branchFormSchema>>({
    resolver: zodResolver(branchFormSchema),
    defaultValues: {
      name: "",
      nameAr: "",
      address: "",
      phone: "",
      openingTime: "",
      closingTime: "",
      isActive: true,
    },
  });

  const userForm = useForm<z.infer<typeof userFormSchema>>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      email: "",
      name: "",
      password: "",
      role: "cashier",
      branchId: "",
      isActive: true,
      permDashboard: false,
      permPos: true,
      permOrders: true,
      permMenu: false,
      permKitchen: false,
      permInventory: false,
      permReviews: false,
      permMarketing: false,
      permQr: false,
      permReports: false,
      permSettings: false,
      permTables: false,
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: InsertRestaurant) => 
      apiRequest("PUT", "/api/restaurant", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant"] });
      toast({ title: t("save") + " ✓" });
    },
    onError: () => {
      toast({ title: t("error"), variant: "destructive" });
    },
  });

  const branchMutation = useMutation({
    mutationFn: async (data: z.infer<typeof branchFormSchema> & { id?: string }) => {
      if (data.id) {
        return apiRequest("PUT", `/api/branches/${data.id}`, data);
      }
      return apiRequest("POST", "/api/branches", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
      setBranchDialogOpen(false);
      setEditingBranch(null);
      branchForm.reset();
      toast({ title: t("save") + " ✓" });
    },
    onError: () => {
      toast({ title: t("error"), variant: "destructive" });
    },
  });

  const deleteBranchMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/branches/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
      toast({ title: t("delete") + " ✓" });
    },
  });

  const userMutation = useMutation({
    mutationFn: async (data: z.infer<typeof userFormSchema> & { id?: string }) => {
      const cleanedData = {
        ...data,
        branchId: data.branchId && data.branchId.trim() !== "" ? data.branchId : null,
      };
      if (data.id) {
        // Only include password if it's non-empty (for password reset)
        const updateData = { ...cleanedData };
        if (!updateData.password || updateData.password.trim() === "") {
          delete updateData.password;
        }
        return apiRequest("PUT", `/api/users/${data.id}`, updateData);
      }
      return apiRequest("POST", "/api/users", cleanedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] }); // Update current user if permissions changed
      setUserDialogOpen(false);
      setEditingUser(null);
      userForm.reset();
      toast({ title: t("save") + " ✓" });
    },
    onError: () => {
      toast({ title: t("error"), variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: t("delete") + " ✓" });
    },
  });

  const printerForm = useForm<z.infer<typeof printerFormSchema>>({
    resolver: zodResolver(printerFormSchema),
    defaultValues: {
      name: "",
      type: "receipt",
      connectionType: "network",
      ipAddress: "",
      port: "9100",
      branchId: "",
      isDefault: false,
      isActive: true,
      paperWidth: "80",
    },
  });

  const printerMutation = useMutation({
    mutationFn: async (data: z.infer<typeof printerFormSchema> & { id?: string }) => {
      const cleanedData = {
        ...data,
        port: data.port ? parseInt(data.port, 10) : 9100,
        paperWidth: data.paperWidth ? parseInt(data.paperWidth, 10) : 80,
        branchId: data.branchId && data.branchId.trim() !== "" ? data.branchId : null,
      };
      if (data.id) {
        return apiRequest("PUT", `/api/printers/${data.id}`, cleanedData);
      }
      return apiRequest("POST", "/api/printers", cleanedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/printers"] });
      setPrinterDialogOpen(false);
      setEditingPrinter(null);
      printerForm.reset();
      toast({ title: t("save") + " ✓" });
    },
    onError: () => {
      toast({ title: t("error"), variant: "destructive" });
    },
  });

  const deletePrinterMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/printers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/printers"] });
      toast({ title: t("delete") + " ✓" });
    },
  });

  const edfapayForm = useForm<z.infer<typeof edfapayConfigSchema>>({
    resolver: zodResolver(edfapayConfigSchema),
    values: {
      edfapayMerchantId: (restaurant as any)?.edfapayMerchantId || "",
      edfapayPassword: (restaurant as any)?.edfapayPassword || "",
      edfapaySoftposAuthToken: (restaurant as any)?.edfapaySoftposAuthToken || "",
    },
  });

  const { data: edfapayStatus, refetch: refetchEdfapayStatus } = useQuery<{ configured: boolean; merchantId?: string; softposConfigured?: boolean }>({
    queryKey: ["/api/edfapay/status"],
  });

  const edfapayMutation = useMutation({
    mutationFn: async (data: z.infer<typeof edfapayConfigSchema>) => {
      return apiRequest("PUT", "/api/restaurant", {
        nameEn: restaurant?.nameEn || "",
        nameAr: restaurant?.nameAr || "",
        edfapayMerchantId: data.edfapayMerchantId,
        edfapayPassword: data.edfapayPassword,
        edfapaySoftposAuthToken: data.edfapaySoftposAuthToken,
      } as InsertRestaurant);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/restaurant"] });
      queryClient.invalidateQueries({ queryKey: ["/api/edfapay/status"] });
      toast({ title: t("save") + " ✓" });
    },
    onError: () => {
      toast({ title: t("error"), variant: "destructive" });
    },
  });

  const onPrinterSubmit = (data: z.infer<typeof printerFormSchema>) => {
    printerMutation.mutate(editingPrinter ? { ...data, id: editingPrinter.id } : data);
  };

  const openPrinterEdit = (printer: PrinterType) => {
    setEditingPrinter(printer);
    printerForm.reset({
      name: printer.name,
      type: printer.type,
      connectionType: printer.connectionType,
      ipAddress: printer.ipAddress || "",
      port: printer.port?.toString() || "9100",
      branchId: printer.branchId || "",
      isDefault: printer.isDefault ?? false,
      isActive: printer.isActive ?? true,
      paperWidth: printer.paperWidth?.toString() || "80",
    });
    setPrinterDialogOpen(true);
  };

  const printerTypeLabels: Record<string, string> = {
    receipt: "receiptPrinter",
    kitchen: "kitchenPrinter",
    label: "labelPrinter",
  };

  const connectionTypeLabels: Record<string, string> = {
    network: "network",
    usb: "usb",
    bluetooth: "bluetooth",
  };

  const onGeneralSubmit = (data: z.infer<typeof generalFormSchema>) => {
    updateMutation.mutate(data as InsertRestaurant);
  };

  const onMenuSubmit = (data: z.infer<typeof menuSettingsSchema>) => {
    updateMutation.mutate({
      nameEn: restaurant?.nameEn || "",
      nameAr: restaurant?.nameAr || "",
      ...data,
    } as InsertRestaurant);
  };

  const onBillingSubmit = (data: z.infer<typeof billingFormSchema>) => {
    updateMutation.mutate({
      nameEn: restaurant?.nameEn || "",
      nameAr: restaurant?.nameAr || "",
      ...data,
    } as InsertRestaurant);
  };

  const onBranchSubmit = (data: z.infer<typeof branchFormSchema>) => {
    branchMutation.mutate(editingBranch ? { ...data, id: editingBranch.id } : data);
  };

  const onUserSubmit = (data: z.infer<typeof userFormSchema>) => {
    // Password required for new users
    if (!editingUser && (!data.password || data.password.length < 6)) {
      toast({ title: language === "ar" ? "كلمة المرور مطلوبة (6 أحرف على الأقل)" : "Password is required (at least 6 characters)", variant: "destructive" });
      return;
    }
    // Password validation for existing users (only if provided)
    if (editingUser && data.password && data.password.trim() !== "" && data.password.length < 6) {
      toast({ title: language === "ar" ? "كلمة المرور يجب أن تكون 6 أحرف على الأقل" : "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    userMutation.mutate(editingUser ? { ...data, id: editingUser.id } : data);
  };

  const openBranchEdit = (branch: Branch) => {
    setEditingBranch(branch);
    branchForm.reset({
      name: branch.name,
      nameAr: branch.nameAr || "",
      address: branch.address || "",
      phone: branch.phone || "",
      openingTime: branch.openingTime || "",
      closingTime: branch.closingTime || "",
      isActive: branch.isActive ?? true,
    });
    setBranchDialogOpen(true);
  };

  const openUserEdit = (user: User) => {
    setEditingUser(user);
    userForm.reset({
      email: user.email,
      name: user.name || "",
      role: user.role,
      branchId: user.branchId || "",
      isActive: user.isActive ?? true,
      permDashboard: user.permDashboard ?? false,
      permPos: user.permPos ?? false,
      permOrders: user.permOrders ?? false,
      permMenu: user.permMenu ?? false,
      permKitchen: user.permKitchen ?? false,
      permInventory: user.permInventory ?? false,
      permReviews: user.permReviews ?? false,
      permMarketing: user.permMarketing ?? false,
      permQr: user.permQr ?? false,
      permReports: user.permReports ?? false,
      permSettings: user.permSettings ?? false,
      permTables: user.permTables ?? false,
    });
    setUserDialogOpen(true);
  };

  const kitchenTypeLabels: Record<string, string> = {
    fast_food: "fastFood",
    casual_dining: "casualDining",
    fine_dining: "fineDining",
    cafe: "cafe",
    bakery: "bakery",
    other: "other",
  };

  const roleLabels: Record<string, string> = {
    owner: "owner",
    branch_manager: "branchManager",
    cashier: "cashier",
    kitchen: "kitchen",
    accountant: "accountant",
    platform_admin: "platformAdmin",
  };

  // Filter out platform_admin from role selection — it's a system-level role
  const selectableRoles = userRoles.filter(r => r !== "platform_admin");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">{t("settings")}</h2>
        <p className="text-muted-foreground">{t("restaurantInfo")}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="flex-wrap h-auto gap-1">
          {isMainBranch && (
            <>
              <TabsTrigger value="general" data-testid="tab-general">
                <Store className="h-4 w-4 me-2" />
                {t("general")}
              </TabsTrigger>
              <TabsTrigger value="menu" data-testid="tab-menu">
                <LayoutGrid className="h-4 w-4 me-2" />
                {t("menu")}
              </TabsTrigger>
              <TabsTrigger value="branches" data-testid="tab-branches">
                <Building2 className="h-4 w-4 me-2" />
                {t("branches")}
              </TabsTrigger>
              <TabsTrigger value="billing" data-testid="tab-billing">
                <Receipt className="h-4 w-4 me-2" />
                {t("billingTax")}
              </TabsTrigger>
            </>
          )}
          {isMainBranch && (
            <TabsTrigger value="permissions" data-testid="tab-permissions">
              <Users className="h-4 w-4 me-2" />
              {t("permissions")}
            </TabsTrigger>
          )}
          <TabsTrigger value="printers" data-testid="tab-printers">
            <Printer className="h-4 w-4 me-2" />
            {t("printers")}
          </TabsTrigger>
          {(isMainBranch || isPlatformAdmin) && (
            <TabsTrigger value="payments" data-testid="tab-payments">
              <CreditCard className="h-4 w-4 me-2" />
              {t("payments")}
            </TabsTrigger>
          )}
          {isMainBranch && (
            <TabsTrigger value="delivery" data-testid="tab-delivery">
              <Link2 className="h-4 w-4 me-2" />
              {language === "ar" ? "منصات التوصيل" : "Delivery"}
            </TabsTrigger>
          )}
          {isPlatformAdmin && (
            <TabsTrigger value="danger" data-testid="tab-danger" className="text-red-600 hover:text-red-700">
              <AlertTriangle className="h-4 w-4 me-2" />
              {language === "ar" ? "حذف مطعم" : "Delete Restaurant"}
            </TabsTrigger>
          )}

        </TabsList>

        {!isMainBranch && (
          <div className="mt-4 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
            <Crown className="h-4 w-4 shrink-0" />
            {language === "ar" 
              ? "أنت تعرض فرع فرعي. للوصول إلى جميع الإعدادات (عام، المنيو، الفوترة، المدفوعات، الصلاحيات)، انتقل إلى الفرع الرئيسي."
              : "You're viewing a sub-branch. To access all settings (General, Menu, Billing, Payments, Permissions), switch to the Main Branch."}
          </div>
        )}

        {/* General Tab */}
        <TabsContent value="general" className="mt-4">
          {isLoading ? (
            <Card>
              <CardContent className="p-6 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>{t("restaurantInfo")}</CardTitle>
              </CardHeader>
              <CardContent>
                <Form {...generalForm}>
                  <form onSubmit={generalForm.handleSubmit(onGeneralSubmit)} className="space-y-6">
                    {/* Logo */}
                    <FormField
                      control={generalForm.control}
                      name="logo"
                      render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("logo")}</FormLabel>
                            <div className="flex items-center gap-4">
                              <div className="relative h-20 w-20 rounded-md border border-border overflow-hidden bg-muted flex items-center justify-center">
                                {field.value ? (
                                  <>
                                    <img src={field.value} alt="Logo" className="h-full w-full object-contain" />
                                    <Button
                                      type="button"
                                      size="icon"
                                      variant="destructive"
                                      className="absolute top-0.5 right-0.5 h-5 w-5"
                                      onClick={() => field.onChange("")}
                                      data-testid="button-remove-logo"
                                    >
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </>
                                ) : (
                                  <ImagePlus className="h-8 w-8 text-muted-foreground" />
                                )}
                              </div>
                              <div className="flex flex-col gap-2">
                                <input
                                  ref={logoInputRef}
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    setLogoUploading(true);
                                    try {
                                      const formData = new FormData();
                                      formData.append("file", file);
                                      const res = await fetch("/api/upload", {
                                        method: "POST",
                                        body: formData,
                                      });
                                      if (!res.ok) throw new Error("Upload failed");
                                      const data = await res.json();
                                      field.onChange(data.url);
                                      toast({ title: t("success"), description: language === "ar" ? "تم رفع الشعار بنجاح" : "Logo uploaded successfully" });
                                    } catch {
                                      toast({ title: t("error"), description: language === "ar" ? "فشل رفع الشعار" : "Failed to upload logo", variant: "destructive" });
                                    } finally {
                                      setLogoUploading(false);
                                    }
                                  }}
                                  data-testid="input-logo-file"
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={logoUploading}
                                  onClick={() => logoInputRef.current?.click()}
                                  data-testid="button-upload-logo"
                                >
                                  <Upload className="h-4 w-4 me-2" />
                                  {logoUploading ? (language === "ar" ? "جاري الرفع..." : "Uploading...") : (language === "ar" ? "رفع شعار" : "Upload Logo")}
                                </Button>
                                <p className="text-xs text-muted-foreground">
                                  {language === "ar" ? "JPG, PNG, SVG - حد أقصى 5 ميجا" : "JPG, PNG, SVG - Max 5MB"}
                                </p>
                              </div>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                    />

                    {/* Names */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={generalForm.control}
                        name="nameEn"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("nameEn")} *</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-name-en" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={generalForm.control}
                        name="nameAr"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("nameAr")} *</FormLabel>
                            <FormControl>
                              <Input {...field} dir="rtl" data-testid="input-name-ar" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Kitchen Type & Price Range */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={generalForm.control}
                        name="kitchenType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("kitchenType")}</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-kitchen-type">
                                  <SelectValue placeholder={t("selectCategory")} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {kitchenTypes.map((type) => (
                                  <SelectItem key={type} value={type}>
                                    {t(kitchenTypeLabels[type] || type)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={generalForm.control}
                        name="priceRange"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("priceRange")}</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger data-testid="select-price-range">
                                  <SelectValue placeholder={t("selectCategory")} />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {priceRanges.map((range) => (
                                  <SelectItem key={range} value={range}>
                                    {range}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Contact Info */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={generalForm.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("phone")} *</FormLabel>
                            <FormControl>
                              <Input {...field} type="tel" data-testid="input-phone" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={generalForm.control}
                        name="whatsapp"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("whatsapp")}</FormLabel>
                            <FormControl>
                              <Input {...field} type="tel" data-testid="input-whatsapp" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={generalForm.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("email")}</FormLabel>
                            <FormControl>
                              <Input {...field} type="email" data-testid="input-email" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Social Media */}
                    <div className="border-t pt-4 mt-4">
                      <h3 className="text-sm font-semibold text-muted-foreground mb-4">{language === "ar" ? "حسابات التواصل الاجتماعي" : "Social Media Accounts"}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={generalForm.control}
                          name="socialInstagram"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Instagram</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="@restaurant" dir="ltr" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={generalForm.control}
                          name="socialTwitter"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>X (Twitter)</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="@restaurant" dir="ltr" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={generalForm.control}
                          name="socialTiktok"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>TikTok</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="@restaurant" dir="ltr" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={generalForm.control}
                          name="socialSnapchat"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Snapchat</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="@restaurant" dir="ltr" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={generalForm.control}
                          name="socialFacebook"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Facebook</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="facebook.com/restaurant" dir="ltr" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Working Hours */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={generalForm.control}
                        name="openingTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("openingTime")} *</FormLabel>
                            <FormControl>
                              <Input {...field} type="time" data-testid="input-opening-time" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={generalForm.control}
                        name="closingTime"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("closingTime")} *</FormLabel>
                            <FormControl>
                              <Input {...field} type="time" data-testid="input-closing-time" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Description */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={generalForm.control}
                        name="descriptionEn"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("descriptionEn")}</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-description-en" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={generalForm.control}
                        name="descriptionAr"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("descriptionAr")}</FormLabel>
                            <FormControl>
                              <Input {...field} dir="rtl" data-testid="input-description-ar" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Address */}
                    <FormField
                      control={generalForm.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("address")} *</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-address" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Services */}
                    <div className="space-y-4">
                      <h3 className="font-medium">{t("services")}</h3>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <FormField
                          control={generalForm.control}
                          name="serviceDineIn"
                          render={({ field }) => (
                            <FormItem className="flex items-center gap-2">
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-dine-in" />
                              </FormControl>
                              <FormLabel className="!mt-0">{t("serviceDineIn")}</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={generalForm.control}
                          name="servicePickup"
                          render={({ field }) => (
                            <FormItem className="flex items-center gap-2">
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-pickup" />
                              </FormControl>
                              <FormLabel className="!mt-0">{t("servicePickup")}</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={generalForm.control}
                          name="serviceDelivery"
                          render={({ field }) => (
                            <FormItem className="flex items-center gap-2">
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-delivery" />
                              </FormControl>
                              <FormLabel className="!mt-0">{t("serviceDelivery")}</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={generalForm.control}
                          name="serviceTableBooking"
                          render={({ field }) => (
                            <FormItem className="flex items-center gap-2">
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-table-booking" />
                              </FormControl>
                              <FormLabel className="!mt-0">{t("serviceTableBooking")}</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={generalForm.control}
                          name="serviceQueue"
                          render={({ field }) => (
                            <FormItem className="flex items-center gap-2">
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-queue" />
                              </FormControl>
                              <FormLabel className="!mt-0">{t("serviceQueue")}</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={generalForm.control}
                          name="allowCashOnPublicQR"
                          render={({ field }) => (
                            <FormItem className="flex items-center gap-2">
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-cash-qr" />
                              </FormControl>
                              <FormLabel className="!mt-0">{t("allowCashOnPublicQR") || "الدفع نقدي من QR العام"}</FormLabel>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-general">
                      {updateMutation.isPending ? "..." : t("save")}
                    </Button>
                  </form>
                </Form>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Menu Settings Tab */}
        <TabsContent value="menu" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("menuSettings")}</CardTitle>
              <CardDescription>
                {language === "ar" ? "تخصيص مظهر المنيو للعملاء" : "Customize menu appearance for customers"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...menuForm}>
                <form onSubmit={menuForm.handleSubmit(onMenuSubmit)} className="space-y-6">
                  <FormField
                    control={menuForm.control}
                    name="menuHeaderType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("headerType")}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-header-type">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="logo">{t("logoOnly")}</SelectItem>
                            <SelectItem value="banner">{t("bannerOnly")}</SelectItem>
                            <SelectItem value="logo_banner">{t("logoBanner")}</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={menuForm.control}
                    name="menuThemeColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("themeColor")}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-theme-color">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {menuThemeColors.map((color) => (
                              <SelectItem key={color} value={color}>
                                <div className="flex items-center gap-2">
                                  <div className={`w-4 h-4 rounded-full bg-${color}-500`} 
                                       style={{ backgroundColor: color === "red" ? "#ef4444" : color === "blue" ? "#3b82f6" : color === "purple" ? "#8b5cf6" : "#22c55e" }} />
                                  {t(color)}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={menuForm.control}
                    name="menuDisplayStyle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("displayStyle")}</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-display-style">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {menuDisplayStyles.map((style) => (
                              <SelectItem key={style} value={style}>
                                {t(style)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={menuForm.control}
                    name="banner"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("uploadBanner")} URL</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="https://..." data-testid="input-banner" />
                        </FormControl>
                        {field.value && (
                          <img src={field.value} alt="Banner" className="w-full h-32 object-cover rounded mt-2" />
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-menu">
                    {updateMutation.isPending ? "..." : t("save")}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Branches Tab */}
        <TabsContent value="branches" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t("branches")}</CardTitle>
                <CardDescription>
                  {language === "ar" ? "إدارة فروع المطعم" : "Manage restaurant branches"}
                </CardDescription>
              </div>
              <Dialog open={branchDialogOpen} onOpenChange={(open) => {
                setBranchDialogOpen(open);
                if (!open) {
                  setEditingBranch(null);
                  branchForm.reset();
                }
              }}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-add-branch">
                    <Plus className="h-4 w-4 me-2" />
                    {t("addBranch")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingBranch ? t("edit") : t("addBranch")}</DialogTitle>
                  </DialogHeader>
                  <Form {...branchForm}>
                    <form onSubmit={branchForm.handleSubmit(onBranchSubmit)} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={branchForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("branchName")} (EN) *</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-branch-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={branchForm.control}
                          name="nameAr"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("branchName")} (AR)</FormLabel>
                              <FormControl>
                                <Input {...field} dir="rtl" data-testid="input-branch-name-ar" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={branchForm.control}
                        name="address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("address")}</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-branch-address" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={branchForm.control}
                        name="phone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("phone")}</FormLabel>
                            <FormControl>
                              <Input {...field} type="tel" data-testid="input-branch-phone" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={branchForm.control}
                          name="openingTime"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("openingTime")}</FormLabel>
                              <FormControl>
                                <Input {...field} type="time" data-testid="input-branch-opening" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={branchForm.control}
                          name="closingTime"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("closingTime")}</FormLabel>
                              <FormControl>
                                <Input {...field} type="time" data-testid="input-branch-closing" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={branchForm.control}
                        name="isActive"
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-2">
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-branch-active" />
                            </FormControl>
                            <FormLabel className="!mt-0">{t("active")}</FormLabel>
                          </FormItem>
                        )}
                      />
                      <Button type="submit" disabled={branchMutation.isPending} data-testid="button-save-branch">
                        {branchMutation.isPending ? "..." : t("save")}
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {branches.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">{t("noBranches")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("name")}</TableHead>
                      <TableHead>{t("address")}</TableHead>
                      <TableHead>{t("phone")}</TableHead>
                      <TableHead>{t("status")}</TableHead>
                      <TableHead>{t("actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {branches.map((branch) => (
                      <TableRow key={branch.id} data-testid={`row-branch-${branch.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getLocalizedName(branch.name, branch.nameAr)}
                            {branch.isMain && (
                              <Badge variant="outline" className="text-xs gap-1 border-amber-500 text-amber-600">
                                <Crown className="h-3 w-3" />
                                {language === "ar" ? "رئيسي" : "Main"}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{branch.address}</TableCell>
                        <TableCell>{branch.phone}</TableCell>
                        <TableCell>
                          <Badge variant={branch.isActive ? "default" : "secondary"}>
                            {branch.isActive ? t("active") : t("unavailable")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="icon" variant="ghost" onClick={() => openBranchEdit(branch)} data-testid={`button-edit-branch-${branch.id}`}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            {!branch.isMain && (
                              <Button size="icon" variant="ghost" onClick={() => { if (window.confirm('هل أنت متأكد من حذف هذا الفرع؟')) deleteBranchMutation.mutate(branch.id); }} data-testid={`button-delete-branch-${branch.id}`}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing & Tax Tab */}
        <TabsContent value="billing" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                {language === "ar" ? "الضريبة وبيانات المنشأة" : "Tax & Business Details"}
              </CardTitle>
              <CardDescription>
                {language === "ar" ? "بيانات ضريبة القيمة المضافة، معلومات المنشأة، والحساب البنكي" : "VAT tax settings, business information, and bank account details"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...billingForm}>
                <form onSubmit={billingForm.handleSubmit(onBillingSubmit)} className="space-y-6">
                  {/* Tax Details Section */}
                  <div className="space-y-4">
                    <h3 className="font-medium border-b pb-2">{t("taxDetails")}</h3>
                    <FormField
                      control={billingForm.control}
                      name="taxEnabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">
                              {language === "ar" ? "مكلف بالضريبة" : "VAT Registered"}
                            </FormLabel>
                            <p className="text-sm text-muted-foreground">
                              {language === "ar" 
                                ? "فعّل إذا كانت المنشأة مسجلة في ضريبة القيمة المضافة. إذا غير مكلف، لن تُحسب ضريبة على الطلبات" 
                                : "Enable if your business is registered for VAT. If disabled, no tax will be calculated on orders"}
                            </p>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    {billingForm.watch("taxEnabled") && (
                    <><div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={billingForm.control}
                        name="vatNumber"
                        render={({ field }) => {
                          const isLocked = !isPlatformAdmin && !!restaurant?.vatNumber && restaurant.vatNumber.trim() !== '';
                          return (
                          <FormItem>
                            <FormLabel>{t("vatNumber")} {isLocked && <Badge variant="secondary" className="ms-2 text-xs">{language === 'ar' ? 'مقفل' : 'Locked'}</Badge>}</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="3XXXXXXXXXX0003" data-testid="input-vat-number" disabled={isLocked} className={isLocked ? 'bg-muted' : ''} />
                            </FormControl>
                            {isLocked && <FormDescription className="text-xs text-amber-600">{language === 'ar' ? 'تواصل مع إدارة المنصة للتعديل' : 'Contact platform admin to modify'}</FormDescription>}
                            <FormMessage />
                          </FormItem>
                          );
                        }}
                      />
                      <FormField
                        control={billingForm.control}
                        name="taxRate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("taxRate")}</FormLabel>
                            <FormControl>
                              <Input {...field} value="15" type="number" disabled className="bg-muted" data-testid="input-tax-rate" />
                            </FormControl>
                            <FormDescription className="text-xs">
                              {language === "ar" ? "نسبة الضريبة ثابتة 15% حسب نظام ضريبة القيمة المضافة" : "Tax rate is fixed at 15% per VAT regulations"}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div></>
                    )}
                  </div>

                  {/* Owner & Business Details Section */}
                  <div className="space-y-4">
                    <h3 className="font-medium border-b pb-2">
                      {language === "ar" ? "بيانات المالك والسجل التجاري" : "Owner & Commercial Registration"}
                    </h3>
                    {!isPlatformAdmin && restaurant?.ownerName && (
                      <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-md text-sm border border-amber-200 dark:border-amber-800">
                        <Shield className="h-4 w-4 text-amber-600 shrink-0" />
                        <p className="text-amber-700 dark:text-amber-400">
                          {language === "ar" 
                            ? "البيانات مقفلة بعد الحفظ الأول. للتعديل تواصل مع إدارة المنصة" 
                            : "Fields are locked after initial save. Contact platform admin to modify"}
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={billingForm.control}
                        name="ownerName"
                        render={({ field }) => {
                          const isLocked = !isPlatformAdmin && !!restaurant?.ownerName && (restaurant.ownerName as string).trim() !== '';
                          return (
                          <FormItem>
                            <FormLabel>{t("ownerName")} {isLocked && <Badge variant="secondary" className="ms-2 text-xs">{language === 'ar' ? 'مقفل' : 'Locked'}</Badge>}</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-owner-name" disabled={isLocked} className={isLocked ? 'bg-muted' : ''} />
                            </FormControl>
                            {isLocked && <FormDescription className="text-xs text-amber-600">{language === 'ar' ? 'تواصل مع إدارة المنصة للتعديل' : 'Contact platform admin to modify'}</FormDescription>}
                            <FormMessage />
                          </FormItem>
                          );
                        }}
                      />
                      <FormField
                        control={billingForm.control}
                        name="ownerPhone"
                        render={({ field }) => {
                          const isLocked = !isPlatformAdmin && !!restaurant?.ownerPhone && (restaurant.ownerPhone as string).trim() !== '';
                          return (
                          <FormItem>
                            <FormLabel>{t("ownerPhone")} {isLocked && <Badge variant="secondary" className="ms-2 text-xs">{language === 'ar' ? 'مقفل' : 'Locked'}</Badge>}</FormLabel>
                            <FormControl>
                              <Input {...field} type="tel" data-testid="input-owner-phone" disabled={isLocked} className={isLocked ? 'bg-muted' : ''} />
                            </FormControl>
                            {isLocked && <FormDescription className="text-xs text-amber-600">{language === 'ar' ? 'تواصل مع إدارة المنصة للتعديل' : 'Contact platform admin to modify'}</FormDescription>}
                            <FormMessage />
                          </FormItem>
                          );
                        }}
                      />
                      <FormField
                        control={billingForm.control}
                        name="commercialRegistration"
                        render={({ field }) => {
                          const isLocked = !isPlatformAdmin && !!restaurant?.commercialRegistration && (restaurant.commercialRegistration as string).trim() !== '';
                          return (
                          <FormItem>
                            <FormLabel>{t("commercialReg")} {isLocked && <Badge variant="secondary" className="ms-2 text-xs">{language === 'ar' ? 'مقفل' : 'Locked'}</Badge>}</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-commercial-reg" disabled={isLocked} className={isLocked ? 'bg-muted' : ''} />
                            </FormControl>
                            {isLocked && <FormDescription className="text-xs text-amber-600">{language === 'ar' ? 'تواصل مع إدارة المنصة للتعديل' : 'Contact platform admin to modify'}</FormDescription>}
                            <FormMessage />
                          </FormItem>
                          );
                        }}
                      />
                      <FormField
                        control={billingForm.control}
                        name="commercialRegistrationName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{language === 'ar' ? 'اسم السجل التجاري' : 'Commercial Registration Name'}</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder={language === 'ar' ? 'اسم السجل التجاري' : 'CR Name'} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <FormField
                        control={billingForm.control}
                        name="shortAddress"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{language === 'ar' ? 'العنوان المختصر الوطني' : 'Short Address'}</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder={language === 'ar' ? 'مثال: RRRD2929' : 'e.g. RRRD2929'} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={billingForm.control}
                        name="registrationType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{language === 'ar' ? 'نوع التسجيل' : 'Registration Type'}</FormLabel>
                            <FormControl>
                              <select {...field} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                                <option value="CRN">{language === 'ar' ? 'سجل تجاري (CRN)' : 'Commercial Registration (CRN)'}</option>
                                <option value="MOM">{language === 'ar' ? 'وزارة البلديات (MOM)' : 'Ministry of Municipality (MOM)'}</option>
                                <option value="MLS">{language === 'ar' ? 'رخصة وزارة العمل (MLS)' : 'Ministry of Labor (MLS)'}</option>
                                <option value="700">{language === 'ar' ? '700 سبعمائة (700)' : '700 Number'}</option>
                                <option value="SAG">{language === 'ar' ? 'وكيل سعودي (SAG)' : 'Saudi Agent (SAG)'}</option>
                                <option value="OTH">{language === 'ar' ? 'أخرى (OTH)' : 'Other (OTH)'}</option>
                              </select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={billingForm.control}
                        name="industry"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{language === 'ar' ? 'نوع النشاط' : 'Industry / Business Category'}</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder={language === 'ar' ? 'مثال: مطاعم' : 'e.g. Food'} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={billingForm.control}
                        name="invoiceType"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{language === 'ar' ? 'نوع الفاتورة' : 'Invoice Type'}</FormLabel>
                            <FormControl>
                              <select {...field} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                                <option value="1100">{language === 'ar' ? 'قياسية + مبسطة (1100)' : 'Standard + Simplified (1100)'}</option>
                                <option value="0100">{language === 'ar' ? 'قياسية فقط (0100)' : 'Standard Only (0100)'}</option>
                                <option value="1000">{language === 'ar' ? 'مبسطة فقط (1000)' : 'Simplified Only (1000)'}</option>
                              </select>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <FormField
                        control={billingForm.control}
                        name="buildingNumber"
                        render={({ field }) => {
                          const isLocked = !isPlatformAdmin && !!restaurant?.buildingNumber && (restaurant.buildingNumber as string).trim() !== '';
                          return (
                          <FormItem>
                            <FormLabel>{t("buildingNumber")} {isLocked && <Badge variant="secondary" className="ms-2 text-xs">{language === 'ar' ? 'مقفل' : 'Locked'}</Badge>}</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-building-number" disabled={isLocked} className={isLocked ? 'bg-muted' : ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                          );
                        }}
                      />
                      <FormField
                        control={billingForm.control}
                        name="streetName"
                        render={({ field }) => {
                          const isLocked = !isPlatformAdmin && !!restaurant?.streetName && (restaurant.streetName as string).trim() !== '';
                          return (
                          <FormItem>
                            <FormLabel>{t("street")} {isLocked && <Badge variant="secondary" className="ms-2 text-xs">{language === 'ar' ? 'مقفل' : 'Locked'}</Badge>}</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-street-name" disabled={isLocked} className={isLocked ? 'bg-muted' : ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                          );
                        }}
                      />
                      <FormField
                        control={billingForm.control}
                        name="district"
                        render={({ field }) => {
                          const isLocked = !isPlatformAdmin && !!restaurant?.district && (restaurant.district as string).trim() !== '';
                          return (
                          <FormItem>
                            <FormLabel>{t("district")} {isLocked && <Badge variant="secondary" className="ms-2 text-xs">{language === 'ar' ? 'مقفل' : 'Locked'}</Badge>}</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-district" disabled={isLocked} className={isLocked ? 'bg-muted' : ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                          );
                        }}
                      />
                      <FormField
                        control={billingForm.control}
                        name="postalCode"
                        render={({ field }) => {
                          const isLocked = !isPlatformAdmin && !!restaurant?.postalCode && (restaurant.postalCode as string).trim() !== '';
                          return (
                          <FormItem>
                            <FormLabel>{t("postalCode")} {isLocked && <Badge variant="secondary" className="ms-2 text-xs">{language === 'ar' ? 'مقفل' : 'Locked'}</Badge>}</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-postal-code" disabled={isLocked} className={isLocked ? 'bg-muted' : ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                          );
                        }}
                      />
                    </div>
                    <FormField
                      control={billingForm.control}
                      name="city"
                      render={({ field }) => {
                        const isLocked = !isPlatformAdmin && !!restaurant?.city && (restaurant.city as string).trim() !== '';
                        return (
                        <FormItem>
                          <FormLabel>{t("city")} {isLocked && <Badge variant="secondary" className="ms-2 text-xs">{language === 'ar' ? 'مقفل' : 'Locked'}</Badge>}</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-city" disabled={isLocked} className={isLocked ? 'bg-muted' : ''} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                        );
                      }}
                    />
                  </div>

                  {/* Bank Details Section */}
                  <div className="space-y-4">
                    <h3 className="font-medium border-b pb-2">{t("bankDetails")}</h3>
                    {!isPlatformAdmin && restaurant?.bankIban && (
                      <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-md text-sm border border-amber-200 dark:border-amber-800">
                        <Shield className="h-4 w-4 text-amber-600 shrink-0" />
                        <p className="text-amber-700 dark:text-amber-400">
                          {language === "ar" 
                            ? "البيانات البنكية مقفلة. للتعديل تواصل مع إدارة المنصة" 
                            : "Bank details are locked. Contact platform admin to modify"}
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={billingForm.control}
                        name="bankAccountHolder"
                        render={({ field }) => {
                          const isLocked = !isPlatformAdmin && !!restaurant?.bankAccountHolder && (restaurant.bankAccountHolder as string).trim() !== '';
                          return (
                          <FormItem>
                            <FormLabel>{t("accountHolder")} {isLocked && <Badge variant="secondary" className="ms-2 text-xs">{language === 'ar' ? 'مقفل' : 'Locked'}</Badge>}</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-account-holder" disabled={isLocked} className={isLocked ? 'bg-muted' : ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                          );
                        }}
                      />
                      <FormField
                        control={billingForm.control}
                        name="bankName"
                        render={({ field }) => {
                          const isLocked = !isPlatformAdmin && !!restaurant?.bankName && (restaurant.bankName as string).trim() !== '';
                          return (
                          <FormItem>
                            <FormLabel>{t("bankName")} {isLocked && <Badge variant="secondary" className="ms-2 text-xs">{language === 'ar' ? 'مقفل' : 'Locked'}</Badge>}</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-bank-name" disabled={isLocked} className={isLocked ? 'bg-muted' : ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                          );
                        }}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={billingForm.control}
                        name="bankAccountNumber"
                        render={({ field }) => {
                          const isLocked = !isPlatformAdmin && !!restaurant?.bankAccountNumber && (restaurant.bankAccountNumber as string).trim() !== '';
                          return (
                          <FormItem>
                            <FormLabel>{t("accountNumber")} {isLocked && <Badge variant="secondary" className="ms-2 text-xs">{language === 'ar' ? 'مقفل' : 'Locked'}</Badge>}</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-account-number" disabled={isLocked} className={isLocked ? 'bg-muted' : ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                          );
                        }}
                      />
                      <FormField
                        control={billingForm.control}
                        name="bankSwift"
                        render={({ field }) => {
                          const isLocked = !isPlatformAdmin && !!restaurant?.bankSwift && (restaurant.bankSwift as string).trim() !== '';
                          return (
                          <FormItem>
                            <FormLabel>{t("swift")} {isLocked && <Badge variant="secondary" className="ms-2 text-xs">{language === 'ar' ? 'مقفل' : 'Locked'}</Badge>}</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-swift" disabled={isLocked} className={isLocked ? 'bg-muted' : ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                          );
                        }}
                      />
                      <FormField
                        control={billingForm.control}
                        name="bankIban"
                        render={({ field }) => {
                          const isLocked = !isPlatformAdmin && !!restaurant?.bankIban && (restaurant.bankIban as string).trim() !== '';
                          return (
                          <FormItem>
                            <FormLabel>{t("iban")} {isLocked && <Badge variant="secondary" className="ms-2 text-xs">{language === 'ar' ? 'مقفل' : 'Locked'}</Badge>}</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="SA..." data-testid="input-iban" disabled={isLocked} className={isLocked ? 'bg-muted' : ''} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                          );
                        }}
                      />
                    </div>
                  </div>

                  <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-billing">
                    {updateMutation.isPending ? "..." : t("save")}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* E-Invoicing (ZATCA) Section - shown when tax is enabled */}
          {billingForm.watch("taxEnabled") && (
            <>
              <div className="mt-8 mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <h2 className="text-lg font-semibold flex items-center gap-2 text-muted-foreground shrink-0">
                    <FileText className="h-5 w-5" />
                    {language === "ar" ? "الفوترة الإلكترونية (ZATCA)" : "E-Invoicing (ZATCA)"}
                  </h2>
                  <div className="h-px flex-1 bg-border" />
                </div>
                <p className="text-sm text-muted-foreground text-center mt-1">
                  {language === "ar"
                    ? "ربط نظام الفوترة الإلكترونية مع هيئة الزكاة والضريبة والجمارك"
                    : "Connect your e-invoicing system with ZATCA"}
                </p>
              </div>
              <ZatcaSettingsTab language={language} restaurantId={restaurant?.id} />
            </>
          )}
        </TabsContent>



        {/* Permissions Tab */}
        <TabsContent value="permissions" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t("permissions")}</CardTitle>
                <CardDescription>
                  {language === "ar" ? "إدارة المستخدمين والصلاحيات" : "Manage users and permissions"}
                </CardDescription>
              </div>
              <Dialog open={userDialogOpen} onOpenChange={(open) => {
                setUserDialogOpen(open);
                if (!open) {
                  setEditingUser(null);
                  userForm.reset();
                }
              }}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-add-user">
                    <Plus className="h-4 w-4 me-2" />
                    {t("addUser")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{editingUser ? t("edit") : t("addUser")}</DialogTitle>
                  </DialogHeader>
                  <Form {...userForm}>
                    <form onSubmit={userForm.handleSubmit(onUserSubmit)} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={userForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("email")} *</FormLabel>
                              <FormControl>
                                <Input {...field} type="email" data-testid="input-user-email" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={userForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("name")}</FormLabel>
                              <FormControl>
                                <Input {...field} data-testid="input-user-name" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={userForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              {t("password")} {!editingUser && "*"}
                              {editingUser && <span className="text-xs text-muted-foreground mr-2">(اتركه فارغاً للإبقاء على كلمة المرور الحالية)</span>}
                            </FormLabel>
                            <FormControl>
                              <Input {...field} type="password" placeholder={editingUser ? "••••••••" : ""} data-testid="input-user-password" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={userForm.control}
                          name="role"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("role")} *</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-user-role">
                                    <SelectValue placeholder={t("selectRole")} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {selectableRoles.map((role) => (
                                    <SelectItem key={role} value={role}>
                                      {t(roleLabels[role] || role)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={userForm.control}
                          name="branchId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("selectBranch")}</FormLabel>
                              <Select onValueChange={(val) => { const v = val === "all" ? "" : val; if (v !== field.value) field.onChange(v); }} value={field.value || "all"}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-user-branch">
                                    <SelectValue placeholder={t("allBranches")} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="all">{t("allBranches")}</SelectItem>
                                  {branches.map((branch) => (
                                    <SelectItem key={branch.id} value={branch.id}>
                                      {getLocalizedName(branch.name, branch.nameAr)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Permissions Grid */}
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-medium">{t("permissions")}</h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {language === "ar" 
                              ? "💡 ملاحظة: المالك ومدير الفرع لديهم جميع الصلاحيات تلقائياً. الصلاحيات تتحكم في ظهور القوائم الجانبية والوصول للصفحات."
                              : "💡 Note: Owner and Branch Manager have all permissions automatically. Permissions control sidebar menu visibility and page access."}
                          </p>
                        </div>
                        <div className="grid gap-3">
                          {[
                            { 
                              key: "permDashboard", 
                              label: "permDashboard",
                              desc: language === "ar" ? "الصفحة الرئيسية والإحصائيات" : "Dashboard & Statistics"
                            },
                            { 
                              key: "permPos", 
                              label: "permPos",
                              desc: language === "ar" ? "نقطة البيع وإنشاء الطلبات" : "Point of Sale & Create Orders"
                            },
                            { 
                              key: "permOrders", 
                              label: "permOrders",
                              desc: language === "ar" ? "عرض وإدارة الطلبات" : "View & Manage Orders"
                            },
                            { 
                              key: "permMenu", 
                              label: "permMenu",
                              desc: language === "ar" ? "تعديل المنيو والأصناف" : "Edit Menu & Items"
                            },
                            { 
                              key: "permKitchen", 
                              label: "permKitchen",
                              desc: language === "ar" ? "شاشة المطبخ" : "Kitchen Display"
                            },
                            { 
                              key: "permInventory", 
                              label: "permInventory",
                              desc: language === "ar" ? "المخزون والمواد" : "Inventory & Stock"
                            },
                            { 
                              key: "permReviews", 
                              label: "permReviews",
                              desc: language === "ar" ? "التقييمات والمراجعات" : "Reviews & Ratings"
                            },
                            { 
                              key: "permMarketing", 
                              label: "permMarketing",
                              desc: language === "ar" ? "العروض والعملاء" : "Promotions & Customers"
                            },
                            { 
                              key: "permQr", 
                              label: "permQr",
                              desc: language === "ar" ? "رموز QR للطلب الذاتي" : "QR Codes for Self-Order"
                            },
                            { 
                              key: "permReports", 
                              label: "permReports",
                              desc: language === "ar" ? "التقارير والأرشيف" : "Reports & Archive"
                            },
                            { 
                              key: "permSettings", 
                              label: "permSettings",
                              desc: language === "ar" ? "الإعدادات والطابعات" : "Settings & Printers"
                            },
                            { 
                              key: "permTables", 
                              label: "permTables",
                              desc: language === "ar" ? "الطاولات والحجوزات والانتظار" : "Tables, Reservations & Queue"
                            },
                          ].map(({ key, label, desc }) => (
                            <FormField
                              key={key}
                              control={userForm.control}
                              name={key as keyof z.infer<typeof userFormSchema>}
                              render={({ field }) => (
                                <FormItem className="flex items-start gap-3 space-y-0 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value as boolean}
                                      onCheckedChange={field.onChange}
                                      data-testid={`checkbox-${key}`}
                                      className="mt-1"
                                    />
                                  </FormControl>
                                  <div className="flex-1 space-y-0.5">
                                    <FormLabel className="text-sm font-medium cursor-pointer">{t(label)}</FormLabel>
                                    <p className="text-xs text-muted-foreground">{desc}</p>
                                  </div>
                                </FormItem>
                              )}
                            />
                          ))}
                        </div>
                      </div>

                      <FormField
                        control={userForm.control}
                        name="isActive"
                        render={({ field }) => (
                          <FormItem className="flex items-center gap-2">
                            <FormControl>
                              <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-user-active" />
                            </FormControl>
                            <FormLabel className="!mt-0">{t("active")}</FormLabel>
                          </FormItem>
                        )}
                      />

                      <Button type="submit" disabled={userMutation.isPending} data-testid="button-save-user">
                        {userMutation.isPending ? "..." : t("save")}
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {users.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">{t("noUsers")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("email")}</TableHead>
                      <TableHead>{t("name")}</TableHead>
                      <TableHead>{t("role")}</TableHead>
                      <TableHead>{t("status")}</TableHead>
                      <TableHead>{t("actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.name || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {t(roleLabels[user.role] || user.role)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={user.isActive ? "default" : "secondary"}>
                            {user.isActive ? t("active") : t("unavailable")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="icon" variant="ghost" onClick={() => openUserEdit(user)} data-testid={`button-edit-user-${user.id}`}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => { if (window.confirm('هل أنت متأكد من حذف هذا المستخدم؟')) deleteUserMutation.mutate(user.id); }} data-testid={`button-delete-user-${user.id}`}>
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
        </TabsContent>

        {/* Printers Tab */}
        <TabsContent value="printers" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>{t("printers")}</CardTitle>
                <CardDescription>
                  {language === "ar" ? "إعدادات الطابعات للفواتير وطلبات المطبخ" : "Printer settings for receipts and kitchen orders"}
                </CardDescription>
              </div>
              <Dialog open={printerDialogOpen} onOpenChange={(open) => {
                setPrinterDialogOpen(open);
                if (!open) {
                  setEditingPrinter(null);
                  printerForm.reset();
                }
              }}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-add-printer">
                    <Plus className="h-4 w-4 me-2" />
                    {t("addPrinter")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{editingPrinter ? t("edit") : t("addPrinter")}</DialogTitle>
                  </DialogHeader>
                  <Form {...printerForm}>
                    <form onSubmit={printerForm.handleSubmit(onPrinterSubmit)} className="space-y-4">
                      <FormField
                        control={printerForm.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("printerName")} *</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-printer-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={printerForm.control}
                          name="type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("printerType")} *</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-printer-type">
                                    <SelectValue placeholder={t("selectCategory")} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {printerTypes.map((type) => (
                                    <SelectItem key={type} value={type}>
                                      {t(printerTypeLabels[type] || type)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={printerForm.control}
                          name="connectionType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("connectionType")} *</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-connection-type">
                                    <SelectValue placeholder={t("selectCategory")} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {connectionTypes.map((type) => (
                                    <SelectItem key={type} value={type}>
                                      {t(connectionTypeLabels[type] || type)}
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
                          control={printerForm.control}
                          name="ipAddress"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("ipAddress")}</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="192.168.1.100" data-testid="input-ip-address" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={printerForm.control}
                          name="port"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("port")}</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="9100" data-testid="input-port" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={printerForm.control}
                          name="paperWidth"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("paperWidth")}</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-paper-width">
                                    <SelectValue placeholder="80mm" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="58">58mm</SelectItem>
                                  <SelectItem value="80">80mm</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={printerForm.control}
                          name="branchId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("selectBranch")}</FormLabel>
                              <Select onValueChange={(val) => { const v = val === "all" ? "" : val; if (v !== field.value) field.onChange(v); }} value={field.value || "all"}>
                                <FormControl>
                                  <SelectTrigger data-testid="select-printer-branch">
                                    <SelectValue placeholder={t("allBranches")} />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="all">{t("allBranches")}</SelectItem>
                                  {branches.map((branch) => (
                                    <SelectItem key={branch.id} value={branch.id}>
                                      {getLocalizedName(branch.name, branch.nameAr)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="flex items-center gap-6">
                        <FormField
                          control={printerForm.control}
                          name="isDefault"
                          render={({ field }) => (
                            <FormItem className="flex items-center gap-2">
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-default-printer" />
                              </FormControl>
                              <FormLabel className="!mt-0">{t("defaultPrinter")}</FormLabel>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={printerForm.control}
                          name="isActive"
                          render={({ field }) => (
                            <FormItem className="flex items-center gap-2">
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} data-testid="switch-printer-active" />
                              </FormControl>
                              <FormLabel className="!mt-0">{t("active")}</FormLabel>
                            </FormItem>
                          )}
                        />
                      </div>
                      <Button type="submit" disabled={printerMutation.isPending} data-testid="button-save-printer">
                        {printerMutation.isPending ? "..." : t("save")}
                      </Button>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {printers.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">{t("noPrinters")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("printerName")}</TableHead>
                      <TableHead>{t("printerType")}</TableHead>
                      <TableHead>{t("connectionType")}</TableHead>
                      <TableHead>{t("ipAddress")}</TableHead>
                      <TableHead>{t("status")}</TableHead>
                      <TableHead>{t("actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {printers.map((printer) => (
                      <TableRow key={printer.id} data-testid={`row-printer-${printer.id}`}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {printer.name}
                            {printer.isDefault && (
                              <Badge variant="secondary" className="text-xs">{t("defaultPrinter")}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {t(printerTypeLabels[printer.type] || printer.type)}
                          </Badge>
                        </TableCell>
                        <TableCell>{t(connectionTypeLabels[printer.connectionType] || printer.connectionType)}</TableCell>
                        <TableCell>{printer.ipAddress || "-"}</TableCell>
                        <TableCell>
                          <Badge variant={printer.isActive ? "default" : "secondary"}>
                            {printer.isActive ? t("active") : t("unavailable")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="icon" variant="ghost" onClick={() => openPrinterEdit(printer)} data-testid={`button-edit-printer-${printer.id}`}>
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => deletePrinterMutation.mutate(printer.id)} data-testid={`button-delete-printer-${printer.id}`}>
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
        </TabsContent>

        {/* Payments Tab */}
        <TabsContent value="payments" className="mt-4">
          <div className="space-y-6">
            {/* EdfaPay Configuration */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      {language === "ar"
                        ? (isPlatformAdmin ? "إعدادات بوابة الدفع - أدفع باي" : "المدفوعات")
                        : (isPlatformAdmin ? "Payment Gateway - EdfaPay" : "Payments")}
                    </CardTitle>
                    <CardDescription>
                      {language === "ar"
                        ? (isPlatformAdmin
                          ? "إعدادات بوابة الدفع التقنية"
                          : "حالة طرق الدفع المتاحة لمطعمك")
                        : (isPlatformAdmin
                          ? "Technical payment gateway settings"
                          : "Payment methods available for your restaurant")}
                    </CardDescription>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => refetchEdfapayStatus()}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">

                {isPlatformAdmin ? (
                  /* ════════ PLATFORM ADMIN VIEW — Full technical form ════════ */
                  <>
                    {/* Status Badge */}
                    {edfapayStatus?.configured ? (
                      <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                        <div className="flex items-center gap-3">
                          <CheckCircle2 className="h-8 w-8 text-green-600" />
                          <div>
                            <p className="font-semibold text-green-800 dark:text-green-200">
                              {language === "ar" ? "بوابة الدفع مفعّلة" : "Payment Gateway Active"}
                            </p>
                            <p className="text-sm text-green-700 dark:text-green-300 mt-0.5">
                              {language === "ar" ? "الموقع جاهز لاستقبال المدفوعات" : "Web payments are active"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800">
                        <div className="flex items-center gap-3">
                          <AlertCircle className="h-6 w-6 text-amber-600" />
                          <p className="text-sm text-amber-800 dark:text-amber-200">
                            {language === "ar" ? "أدخل بيانات أدفع باي لتفعيل الدفع الإلكتروني" : "Enter EdfaPay credentials to activate payments"}
                          </p>
                        </div>
                      </div>
                    )}

                    <Form {...edfapayForm}>
                      <form onSubmit={edfapayForm.handleSubmit((data) => edfapayMutation.mutate(data))} className="space-y-4">
                        <FormField
                          control={edfapayForm.control}
                          name="edfapayMerchantId"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Merchant ID (CLIENT_KEY)</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" dir="ltr" className="font-mono text-sm" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={edfapayForm.control}
                          name="edfapayPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Password</FormLabel>
                              <FormControl>
                                <Input {...field} type="password" dir="ltr" className="font-mono text-sm" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div className="pt-4 border-t">
                          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            📱 SoftPOS / NFC Token
                          </h4>
                          <FormField
                            control={edfapayForm.control}
                            name="edfapaySoftposAuthToken"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>SoftPOS Auth Token</FormLabel>
                                <FormControl>
                                  <Input {...field} type="password" dir="ltr" className="font-mono text-sm" placeholder="eyJhbG..." />
                                </FormControl>
                                <FormDescription className="text-xs">
                                  {language === "ar"
                                    ? "من لوحة تحكم EdfaPay Partner — خاص بكل مطعم"
                                    : "From EdfaPay Partner Portal — per restaurant"}
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <Button type="submit" disabled={edfapayMutation.isPending} className="w-full">
                          {edfapayMutation.isPending ? "..." : (language === "ar" ? "حفظ إعدادات الدفع" : "Save Payment Settings")}
                        </Button>
                      </form>
                    </Form>
                  </>
                ) : (
                  /* ════════ RESTAURANT OWNER VIEW — Clear status only ════════ */
                  <div className="space-y-4">

                    {/* 💳 Web Payment Status */}
                    <div className={`p-5 rounded-xl border-2 ${edfapayStatus?.configured
                        ? "bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800"
                        : "bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700"}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${edfapayStatus?.configured
                            ? "bg-green-100 dark:bg-green-900"
                            : "bg-gray-100 dark:bg-gray-800"}`}>
                          💳
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-base">
                            {language === "ar" ? "الدفع الإلكتروني (الموقع)" : "Online Payments (Website)"}
                          </p>
                          {edfapayStatus?.configured ? (
                            <p className="text-sm text-green-700 dark:text-green-300 mt-0.5">
                              {language === "ar"
                                ? "✅ مفعّل — عملاؤك يقدرون يدفعون مدى، فيزا، وماستركارد من الموقع"
                                : "✅ Active — Customers can pay with Mada, Visa, Mastercard online"}
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {language === "ar"
                                ? "❌ غير مفعّل — تواصل مع إدارة المنصة لتفعيله"
                                : "❌ Not active — Contact platform admin to enable"}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* 📱 NFC / Mobile Payment Status */}
                    <div className={`p-5 rounded-xl border-2 ${edfapayStatus?.softposConfigured
                        ? "bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800"
                        : "bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700"}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${edfapayStatus?.softposConfigured
                            ? "bg-green-100 dark:bg-green-900"
                            : "bg-gray-100 dark:bg-gray-800"}`}>
                          📱
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-base">
                            {language === "ar" ? "الدفع بالبطاقة من الجوال (NFC)" : "Tap-to-Pay from Mobile (NFC)"}
                          </p>
                          {edfapayStatus?.softposConfigured ? (
                            <p className="text-sm text-green-700 dark:text-green-300 mt-0.5">
                              {language === "ar"
                                ? "✅ مفعّل — موظفيك يقدرون يستقبلون الدفع بتقريب البطاقة على جوالهم"
                                : "✅ Active — Staff can accept payments by tapping cards on their phone"}
                            </p>
                          ) : (
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {language === "ar"
                                ? "❌ غير مفعّل — تواصل مع إدارة المنصة لتفعيله"
                                : "❌ Not active — Contact platform admin to enable"}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Help text */}
                    <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800">
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        {language === "ar"
                          ? "💡 لتفعيل أو تعديل إعدادات الدفع، تواصل مع إدارة المنصة وسيتم تفعيلها لك."
                          : "💡 To enable or change payment settings, contact platform admin and they'll set it up for you."}
                      </p>
                    </div>

                  </div>
                )}

              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ZATCA E-Invoicing Tab */}

        {/* Delivery Platforms Tab */}
        <TabsContent value="delivery" className="mt-4">
          <DeliverySettingsPage />
        </TabsContent>

        {/* Danger Zone - Delete Restaurant (Platform Admin Only) */}
        {isPlatformAdmin && (
          <TabsContent value="danger" className="mt-4">
            <DangerZoneTab restaurantsList={restaurantsList} />
          </TabsContent>
        )}

      </Tabs>
    </div>
  );
}

// ===================== ZATCA E-Invoicing Settings Component =====================
function ZatcaSettingsTab({ language, restaurantId }: { language: string; restaurantId?: string }) {
  const { toast } = useToast();
  const [otp, setOtp] = useState("");
  const [csr, setCsr] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");
  const [newDeviceName, setNewDeviceName] = useState("");

  // Fetch ZATCA status
  const { data: zatcaStatus, refetch: refetchStatus } = useQuery({
    queryKey: ["/api/zatca/status"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/zatca/status");
      return res.json();
    },
    enabled: !!restaurantId,
    staleTime: 30000,
  });

  // Fetch devices for selected branch
  const { data: branchDevices, refetch: refetchDevices } = useQuery({
    queryKey: ["/api/zatca/devices", selectedBranchId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/zatca/devices?branchId=${selectedBranchId}`);
      return res.json();
    },
    enabled: !!selectedBranchId,
    staleTime: 10000,
  });

  // Fetch ZATCA dashboard stats
  const { data: dashboardStats } = useQuery({
    queryKey: ["/api/zatca/dashboard"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/zatca/dashboard");
      return res.json();
    },
    enabled: !!restaurantId,
    staleTime: 30000,
  });

  const updateEnvironment = useMutation({
    mutationFn: async (environment: string) => {
      const res = await apiRequest("PUT", "/api/zatca/environment", { environment });
      return res.json();
    },
    onSuccess: () => {
      refetchStatus();
      toast({
        title: language === "ar" ? "تم تحديث البيئة" : "Environment Updated",
      });
    },
  });

  const registerComplianceCsid = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/zatca/compliance-csid", {
        otp,
        csr,
        branchId: selectedBranchId || undefined,
        egsDeviceId: selectedDeviceId || undefined,
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(language === "ar" && errorData.errorAr ? errorData.errorAr : errorData.error || "Registration failed");
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      refetchStatus();
      refetchDevices();
      if (data.egsDeviceId) setSelectedDeviceId(data.egsDeviceId);
      setOtp("");
      toast({
        title: language === "ar" ? "تم التسجيل بنجاح" : "Registration Successful",
        description: data.dispositionMessage || "Compliance CSID obtained",
      });
    },
    onError: (err: any) => {
      toast({
        title: language === "ar" ? "فشل التسجيل" : "Registration Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const runComplianceCheck = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/zatca/compliance-check", {
        branchId: selectedBranchId || undefined,
        egsDeviceId: selectedDeviceId || undefined,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: data.success
          ? (language === "ar" ? "فحص الامتثال ناجح" : "Compliance Check Passed")
          : (language === "ar" ? "فشل فحص الامتثال" : "Compliance Check Failed"),
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (err: any) => {
      toast({
        title: language === "ar" ? "خطأ في الفحص" : "Check Error",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const getProductionCsid = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/zatca/production-csid", {
        branchId: selectedBranchId || undefined,
        egsDeviceId: selectedDeviceId || undefined,
      });
      return res.json();
    },
    onSuccess: () => {
      refetchStatus();
      refetchDevices();
      toast({
        title: language === "ar" ? "تم الحصول على شهادة الإنتاج" : "Production CSID Obtained",
      });
    },
    onError: (err: any) => {
      toast({
        title: language === "ar" ? "فشل الحصول على شهادة الإنتاج" : "Failed to get Production CSID",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const batchSubmit = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/zatca/submit-batch");
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/zatca/dashboard"] });
      toast({
        title: language === "ar" ? "تم الإرسال" : "Batch Submitted",
        description: language === "ar"
          ? `مقبول: ${data.accepted} | مرفوض: ${data.rejected} | أخطاء: ${data.errors}`
          : `Accepted: ${data.accepted} | Rejected: ${data.rejected} | Errors: ${data.errors}`,
      });
    },
    onError: (err: any) => {
      toast({
        title: language === "ar" ? "فشل الإرسال" : "Submission Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const createDevice = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/zatca/devices", {
        branchId: selectedBranchId,
        name: newDeviceName || `كاشير ${(branchDevices?.length || 0) + 1}`,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      refetchDevices();
      refetchStatus();
      setSelectedDeviceId(data.id);
      setNewDeviceName("");
      toast({
        title: isAr ? "تم إضافة الجهاز" : "Device Added",
      });
    },
    onError: (err: any) => {
      toast({
        title: isAr ? "فشل إضافة الجهاز" : "Failed to add device",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const deleteDevice = useMutation({
    mutationFn: async (deviceId: string) => {
      const res = await apiRequest("DELETE", `/api/zatca/devices/${deviceId}`);
      return res.json();
    },
    onSuccess: () => {
      refetchDevices();
      refetchStatus();
      setSelectedDeviceId("");
      toast({
        title: isAr ? "تم حذف الجهاز" : "Device Deleted",
      });
    },
  });

  // Get selected device status for the registration steps
  const selectedDevice = branchDevices?.find((d: any) => d.id === selectedDeviceId);
  const deviceHasComplianceCsid = selectedDeviceId ? selectedDevice?.hasComplianceCsid : zatcaStatus?.hasComplianceCsid;
  const deviceHasProductionCsid = selectedDeviceId ? selectedDevice?.hasProductionCsid : zatcaStatus?.hasProductionCsid;

  const isAr = language === "ar";

  // Auto-select first branch if only one
  useEffect(() => {
    if (!selectedBranchId && zatcaStatus?.branches?.length === 1) {
      setSelectedBranchId(zatcaStatus.branches[0].id);
    }
  }, [zatcaStatus?.branches, selectedBranchId]);

  const requirementsMet = [
    zatcaStatus?.hasVatNumber,
    zatcaStatus?.taxEnabled,
    zatcaStatus?.isFullyConfigured,
    zatcaStatus?.hasProductionCsid,
  ].filter(Boolean).length;

  return (
    <div className="space-y-5">

      {/* ═══════ 1. Overview Bar — compact status + environment + stats ═══════ */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          {/* Top row: VAT + Environment + Readiness */}
          <div className="flex flex-wrap items-center gap-3">
            {/* VAT */}
            <Badge variant={zatcaStatus?.hasVatNumber ? "default" : "destructive"} className="text-xs px-3 py-1">
              {zatcaStatus?.hasVatNumber
                ? `VAT ${zatcaStatus.vatNumber}`
                : (isAr ? "الرقم الضريبي مطلوب" : "VAT Required")}
            </Badge>
            {/* Environment selector — inline */}
            <Select
              value={zatcaStatus?.environment || "sandbox"}
              onValueChange={(val) => updateEnvironment.mutate(val)}
            >
              <SelectTrigger className="w-auto h-7 text-xs gap-1 border-dashed px-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sandbox">{isAr ? "تجريبي (Sandbox)" : "Sandbox"}</SelectItem>
                <SelectItem value="simulation">{isAr ? "محاكاة (Simulation)" : "Simulation"}</SelectItem>
                <SelectItem value="production">{isAr ? "إنتاج (Production)" : "Production"}</SelectItem>
              </SelectContent>
            </Select>
            {/* Readiness */}
            <Badge variant={requirementsMet === 4 ? "default" : "secondary"} className="text-xs px-3 py-1 ms-auto">
              {requirementsMet}/4 {isAr ? "جاهز" : "Ready"}
            </Badge>
          </div>

          {/* Invoice stats — single compact row */}
          {dashboardStats && (
            <div className="flex flex-wrap gap-2">
              {[
                { label: isAr ? "إجمالي" : "Total", value: dashboardStats.total, color: "text-foreground" },
                { label: isAr ? "معلقة" : "Pending", value: dashboardStats.pending, color: "text-amber-600" },
                { label: isAr ? "مقبولة" : "Accepted", value: dashboardStats.accepted, color: "text-green-600" },
                { label: isAr ? "مرفوضة" : "Rejected", value: dashboardStats.rejected, color: "text-red-600" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/50 text-xs">
                  <span className={`font-bold ${s.color}`}>{s.value}</span>
                  <span className="text-muted-foreground">{s.label}</span>
                </div>
              ))}
              {dashboardStats.pending > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs ms-auto"
                  onClick={() => batchSubmit.mutate()}
                  disabled={batchSubmit.isPending}
                >
                  <Wifi className="h-3 w-3 me-1" />
                  {batchSubmit.isPending
                    ? (isAr ? "إرسال..." : "Sending...")
                    : (isAr ? `إرسال ${dashboardStats.pending} معلقة` : `Submit ${dashboardStats.pending}`)}
                </Button>
              )}
            </div>
          )}

          {/* Requirements — single row of icons */}
          <div className="flex flex-wrap gap-2 pt-1 border-t">
            {[
              { labelAr: "رقم ضريبي", labelEn: "VAT", done: zatcaStatus?.hasVatNumber },
              { labelAr: "الضريبة 15%", labelEn: "Tax 15%", done: zatcaStatus?.taxEnabled },
              { labelAr: "العنوان الكامل", labelEn: "Address", done: zatcaStatus?.isFullyConfigured },
              { labelAr: "شهادة الإنتاج", labelEn: "Production CSID", done: zatcaStatus?.hasProductionCsid },
            ].map((r) => (
              <div key={r.labelEn} className="flex items-center gap-1 text-xs">
                {r.done
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  : <AlertCircle className="h-3.5 w-3.5 text-amber-500" />}
                <span className={r.done ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"}>
                  {isAr ? r.labelAr : r.labelEn}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ═══════ 2. Device Management + Registration — single card ═══════ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            {isAr ? "تسجيل الأجهزة" : "Device Registration"}
          </CardTitle>
          <CardDescription className="text-xs">
            {isAr
              ? "اختر الفرع، أضف جهاز كاشير، ثم سجّله لدى ZATCA"
              : "Select a branch, add a cashier device, then register it with ZATCA"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">

          {/* Branch + Device selector row */}
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">{isAr ? "الفرع" : "Branch"}</label>
              <Select value={selectedBranchId} onValueChange={(val) => { setSelectedBranchId(val); setSelectedDeviceId(""); }}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={isAr ? "اختر الفرع..." : "Select branch..."} />
                </SelectTrigger>
                <SelectContent>
                  {zatcaStatus?.branches?.map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>
                      {isAr ? (b.nameAr || b.name) : b.name}
                      {b.isMain ? (isAr ? " (رئيسي)" : " (Main)") : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedBranchId && (
              <div className="flex items-end gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">{isAr ? "جهاز جديد" : "New device"}</label>
                  <Input
                    placeholder={isAr ? "اسم الكاشير" : "Cashier name"}
                    value={newDeviceName}
                    onChange={(e) => setNewDeviceName(e.target.value)}
                    className="h-9 w-40 text-sm"
                  />
                </div>
                <Button size="sm" className="h-9" onClick={() => createDevice.mutate()} disabled={createDevice.isPending}>
                  <Plus className="h-3.5 w-3.5 me-1" />
                  {isAr ? "إضافة" : "Add"}
                </Button>
              </div>
            )}
          </div>

          {/* Devices list */}
          {selectedBranchId && (
            <>
              {branchDevices && branchDevices.length > 0 ? (
                <div className="grid gap-2">
                  {branchDevices.map((device: any) => (
                    <div
                      key={device.id}
                      onClick={() => setSelectedDeviceId(device.id)}
                      className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition-all ${
                        selectedDeviceId === device.id
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${device.registrationStep >= 3 ? 'bg-green-500' : device.registrationStep >= 1 ? 'bg-amber-500' : 'bg-gray-300'}`} />
                        <span className="font-medium text-sm">{device.name}</span>
                        <span className="text-[10px] text-muted-foreground font-mono">{device.serialNumber?.slice(-8)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge variant={device.registrationStep >= 3 ? "default" : device.registrationStep >= 1 ? "secondary" : "outline"} className="text-[10px] h-5">
                          {device.registrationStep >= 3
                            ? (isAr ? "مسجّل ✓" : "Active ✓")
                            : device.registrationStep >= 1
                              ? (isAr ? `خطوة ${device.registrationStep}/3` : `Step ${device.registrationStep}/3`)
                              : (isAr ? "جديد" : "New")}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 w-5 p-0 text-muted-foreground hover:text-destructive"
                          onClick={(e) => { e.stopPropagation(); deleteDevice.mutate(device.id); }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-sm text-muted-foreground border rounded-lg border-dashed">
                  {isAr
                    ? "لا توجد أجهزة. أضف كاشير أعلاه لبدء التسجيل."
                    : "No devices yet. Add a cashier above to start."}
                </div>
              )}
            </>
          )}

          {/* ─── Registration Steps ─── */}
          {selectedBranchId && (
            <div className="border-t pt-4 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">
                {isAr ? "خطوات التسجيل" : "Registration Steps"}
                {selectedDevice && <span className="font-bold text-foreground ms-1">— {selectedDevice.name}</span>}
              </p>

              {/* Step 1 */}
              <div className={`p-3 rounded-lg border transition-all ${deviceHasComplianceCsid ? 'bg-green-50/50 dark:bg-green-950/10 border-green-200 dark:border-green-900' : 'bg-card'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${deviceHasComplianceCsid ? 'bg-green-600 text-white' : 'bg-primary text-primary-foreground'}`}>1</span>
                  <span className="text-sm font-semibold">{isAr ? "شهادة الامتثال" : "Compliance CSID"}</span>
                  {deviceHasComplianceCsid && <CheckCircle2 className="h-4 w-4 text-green-600 ms-auto" />}
                </div>
                {!deviceHasComplianceCsid && (
                  <div className="space-y-3 ms-7">
                    {!zatcaStatus?.hasVatNumber && (
                      <p className="text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        {isAr ? "أدخل الرقم الضريبي أولاً في إعدادات المطعم" : "Enter VAT number first in restaurant settings"}
                      </p>
                    )}
                    <div className="p-2.5 rounded bg-blue-50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900 text-xs text-blue-700 dark:text-blue-400">
                      {isAr ? (
                        <p>ادخل بوابة <a href="https://fatoora.zatca.gov.sa" target="_blank" rel="noopener noreferrer" className="underline font-bold">fatoora.zatca.gov.sa</a> ← إضافة جهاز ← Generate OTP ← انسخ الرمز هنا</p>
                      ) : (
                        <p>Go to <a href="https://fatoora.zatca.gov.sa" target="_blank" rel="noopener noreferrer" className="underline font-bold">fatoora.zatca.gov.sa</a> → Add Device → Generate OTP → Paste below</p>
                      )}
                      {zatcaStatus?.environment === 'sandbox' && (
                        <p className="mt-1 text-amber-600 dark:text-amber-400">
                          {isAr ? "💡 بيئة تجريبية: استخدم الرمز 123456" : "💡 Sandbox: use code 123456"}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="OTP"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        className="h-9 w-32 text-center tracking-[0.3em] font-mono"
                        maxLength={6}
                        disabled={!zatcaStatus?.hasVatNumber}
                      />
                      <Button
                        size="sm"
                        className="h-9"
                        onClick={() => registerComplianceCsid.mutate()}
                        disabled={registerComplianceCsid.isPending || !otp || !zatcaStatus?.hasVatNumber}
                      >
                        {registerComplianceCsid.isPending
                          ? (isAr ? "جاري..." : "...")
                          : (isAr ? "تسجيل" : "Register")}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2 */}
              <div className={`p-3 rounded-lg border transition-all ${!deviceHasComplianceCsid ? 'opacity-40 pointer-events-none' : deviceHasProductionCsid ? 'bg-green-50/50 dark:bg-green-950/10 border-green-200 dark:border-green-900' : 'bg-card'}`}>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${deviceHasComplianceCsid ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>2</span>
                  <span className="text-sm font-semibold">{isAr ? "فحص الامتثال" : "Compliance Check"}</span>
                  {deviceHasComplianceCsid && !deviceHasProductionCsid && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs ms-auto"
                      onClick={() => runComplianceCheck.mutate()}
                      disabled={runComplianceCheck.isPending}
                    >
                      {runComplianceCheck.isPending ? (isAr ? "جاري..." : "...") : (isAr ? "بدء الفحص" : "Run Check")}
                    </Button>
                  )}
                </div>
              </div>

              {/* Step 3 */}
              <div className={`p-3 rounded-lg border transition-all ${!deviceHasComplianceCsid ? 'opacity-40 pointer-events-none' : deviceHasProductionCsid ? 'bg-green-50/50 dark:bg-green-950/10 border-green-200 dark:border-green-900' : 'bg-card'}`}>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${deviceHasProductionCsid ? 'bg-green-600 text-white' : deviceHasComplianceCsid ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>3</span>
                  <span className="text-sm font-semibold">{isAr ? "شهادة الإنتاج" : "Production CSID"}</span>
                  {deviceHasProductionCsid && <CheckCircle2 className="h-4 w-4 text-green-600 ms-auto" />}
                  {deviceHasComplianceCsid && !deviceHasProductionCsid && (
                    <Button
                      size="sm"
                      className="h-7 text-xs ms-auto"
                      onClick={() => getProductionCsid.mutate()}
                      disabled={getProductionCsid.isPending}
                    >
                      {getProductionCsid.isPending ? (isAr ? "جاري..." : "...") : (isAr ? "الحصول على الشهادة" : "Get CSID")}
                    </Button>
                  )}
                </div>
                {deviceHasProductionCsid && (
                  <p className="text-xs text-green-600 ms-7 mt-1">
                    {isAr ? "الجهاز مسجل وجاهز لإرسال الفواتير ✓" : "Device registered and ready to submit invoices ✓"}
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ===================== Platform Admin - Danger Zone =====================
function DangerZoneTab({ restaurantsList }: { restaurantsList?: any[] }) {
  const { toast } = useToast();
  const { language } = useLanguage();
  const [selectedRestaurant, setSelectedRestaurant] = useState("");
  const [confirmText, setConfirmText] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const isAr = language === "ar";

  const deleteRestaurant = useMutation({
    mutationFn: async (restaurantId: string) => {
      const res = await apiRequest("DELETE", `/api/restaurants/${restaurantId}`);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: isAr ? "تم الحذف" : "Deleted",
        description: isAr ? "تم حذف المطعم وجميع بيانات له" : "Restaurant and all data deleted",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/restaurants"] });
      setSelectedRestaurant("");
      setConfirmText("");
      setShowConfirmDialog(false);
    },
    onError: (err: any) => {
      toast({
        title: isAr ? "فشل الحذف" : "Delete Failed",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  return (
    <Card className="border-red-200 dark:border-red-900">
      <CardHeader>
        <CardTitle className="text-red-600 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          {isAr ? "منطقة الخطر - حذف مطعم" : "Danger Zone - Delete Restaurant"}
        </CardTitle>
        <CardDescription className="text-red-600 dark:text-red-400">
          {isAr 
            ? "حذف أي مطعم من المنصة مع جميع بياناته (الفروع، الأوامر، المنيو)"
            : "Delete any restaurant from the platform with all its data (branches, orders, menu)"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">
              {isAr ? "اختر المطعم" : "Select Restaurant"}
            </label>
            <select
              value={selectedRestaurant}
              onChange={(e) => {
                setSelectedRestaurant(e.target.value);
                setConfirmText("");
              }}
              className="w-full mt-2 px-3 py-2 border rounded-md bg-background"
            >
              <option value="">{isAr ? "-- اختر مطعم --" : "-- Select a restaurant --"}</option>
              {restaurantsList?.map((r: any) => (
                <option key={r.id} value={r.id}>
                  {r.nameEn} {r.nameAr ? `(${r.nameAr})` : ""}
                </option>
              ))}
            </select>
          </div>

          {selectedRestaurant && (
            <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
              <Button
                variant="destructive"
                className="w-full md:w-auto"
                onClick={() => setShowConfirmDialog(true)}
              >
                <Trash2 className="h-4 w-4 me-2" />
                {isAr ? "حذف المطعم" : "Delete Restaurant"}
              </Button>

              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="text-red-600">
                    {isAr ? "تأكيد حذف المطعم" : "Confirm Restaurant Deletion"}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                    <p className="text-sm text-red-700 dark:text-red-300">
                      {isAr
                        ? "⚠️ هذا سيحذف المطعم بشكل نهائي. كل البيانات ستُفقد للأبد."
                        : "⚠️ This will permanently delete the restaurant. All data will be lost forever."}
                    </p>
                  </div>

                  <div>
                    <label className="text-sm font-medium">
                      {isAr ? "اكتب اسم المطعم للتأكيد" : "Type restaurant name to confirm"}
                    </label>
                    <Input
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder={restaurantsList?.find((r: any) => r.id === selectedRestaurant)?.nameEn}
                      className="mt-2"
                      autoFocus
                    />
                  </div>

                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowConfirmDialog(false);
                        setConfirmText("");
                      }}
                    >
                      {isAr ? "إلغاء" : "Cancel"}
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={
                        confirmText !== restaurantsList?.find((r: any) => r.id === selectedRestaurant)?.nameEn ||
                        deleteRestaurant.isPending
                      }
                      onClick={() => {
                        deleteRestaurant.mutate(selectedRestaurant);
                      }}
                    >
                      {deleteRestaurant.isPending ? (
                        <span>{isAr ? "جاري الحذف..." : "Deleting..."}</span>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4 me-2" />
                          {isAr ? "نعم، احذف" : "Yes, Delete"}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

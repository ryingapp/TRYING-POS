import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useRef } from "react";
import { Store, Palette, Globe, Receipt, Building2, Users, LayoutGrid, Plus, Trash2, Edit2, Printer, CreditCard, Upload, ExternalLink, CheckCircle2, AlertCircle, Clock, RefreshCw, ImagePlus, X, Crown, FileText, Shield, Wifi } from "lucide-react";
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
import { useTheme } from "@/lib/theme";
import { useBranch } from "@/lib/branch";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Restaurant, InsertRestaurant, Branch, User, Printer as PrinterType, MoyasarMerchant, MoyasarDocument } from "@shared/schema";
import { kitchenTypes, priceRanges, userRoles, menuHeaderTypes, menuThemeColors, menuDisplayStyles, printerTypes } from "@shared/schema";

type MerchantWithDocuments = MoyasarMerchant & { documents: MoyasarDocument[] };

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

const merchantFormSchema = z.object({
  name: z.string().min(1, "Required"),
  publicName: z.string().min(1, "Required"),
  merchantType: z.string().default("establishment"),
  adminEmail: z.string().email("Invalid email"),
  email: z.string().email("Invalid email"),
  country: z.string().default("SA"),
  timeZone: z.string().default("Asia/Riyadh"),
  website: z.string().url("Invalid URL"),
  statementDescriptor: z.string().optional(),
  ownersCount: z.number().min(1).default(1),
  signatory: z.string().default("owner"),
  signatoryCount: z.number().min(1).default(1),
  activityLicenseRequired: z.boolean().default(false),
  enabledSchemes: z.array(z.string()).default(["mada", "visa", "master"]),
  paymentMethods: z.array(z.string()).default(["creditcard"]),
  fees: z.object({
    tax_inclusive: z.boolean().default(true),
    mada_charge_rate: z.number().default(1.70),
    mada_charge_fixed: z.number().default(1.00),
    mada_refund_rate: z.number().default(0),
    mada_refund_fixed: z.number().default(1.00),
    cc_charge_rate: z.number().default(2.70),
    cc_charge_fixed: z.number().default(1.00),
    cc_refund_rate: z.number().default(0),
    cc_refund_fixed: z.number().default(1.00),
  }).default({}),
});

const documentFormSchema = z.object({
  documentType: z.string().min(1, "Required"),
  idNumber: z.string().optional(),
  dateOfBirth: z.string().optional(),
  mobile: z.string().optional(),
  holder: z.string().optional(),
  ibanNumber: z.string().optional(),
  crNumber: z.string().optional(),
  vatNumber: z.string().optional(),
  expiryDate: z.string().optional(),
  addressName: z.string().optional(),
  addressStreet: z.string().optional(),
  addressDistrict: z.string().optional(),
  addressBuildingNumber: z.string().optional(),
  addressSecondaryNumber: z.string().optional(),
  addressPostalCode: z.string().optional(),
  addressCity: z.string().optional(),
  addressCountry: z.string().optional(),
});

const documentTypes = [
  { value: "owner_id", labelKey: "ownerId", descKey: "ownerIdDesc", required: true, needsIdInfo: true },
  { value: "signatory_id", labelKey: "signatoryId", descKey: "signatoryIdDesc", required: false, needsIdInfo: true },
  { value: "commercial_registration", labelKey: "commercialRegistration", descKey: "commercialRegDesc", required: true, needsCrNumber: true },
  { value: "bank_iban_certificate", labelKey: "bankIbanCertificate", descKey: "bankIbanDesc", required: true, needsIban: true },
  { value: "vat_certificate", labelKey: "vatCertificate", descKey: "vatCertDesc", required: false, needsVat: true },
  { value: "freelance_certificate", labelKey: "freelanceCertificate", descKey: "freelanceCertDesc", required: false, needsCrNumber: true, needsExpiry: true },
  { value: "company_address", labelKey: "companyAddress", descKey: "companyAddressDesc", required: false, needsAddress: true },
  { value: "owner_address", labelKey: "ownerAddress", descKey: "ownerAddressDesc", required: false, needsAddress: true },
  { value: "signatory_address", labelKey: "signatoryAddress", descKey: "signatoryAddressDesc", required: false, needsAddress: true },
  { value: "power_of_attorney", labelKey: "powerOfAttorney", descKey: "poaDesc", required: false, needsCrNumber: true },
  { value: "activity_license", labelKey: "activityLicense", descKey: "activityLicenseDesc", required: false, needsCrNumber: true },
  { value: "memorandum_of_association", labelKey: "memorandumOfAssociation", descKey: "memorandumDesc", required: false },
  { value: "other", labelKey: "otherDocument", descKey: "otherDocDesc", required: false },
];

export default function SettingsPage() {
  const { t, language, setLanguage, getLocalizedName } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { toast } = useToast();
  const { selectedBranch } = useBranch();
  const isMainBranch = selectedBranch?.isMain === true;
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [printerDialogOpen, setPrinterDialogOpen] = useState(false);
  const [documentDialogOpen, setDocumentDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingPrinter, setEditingPrinter] = useState<PrinterType | null>(null);
  const [selectedDocType, setSelectedDocType] = useState<string>("owner_id");
  const [uploadedFile, setUploadedFile] = useState<{ name: string; data: string; type: string } | null>(null);
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

  const { data: merchant, isLoading: merchantLoading, refetch: refetchMerchant } = useQuery<MerchantWithDocuments | null>({
    queryKey: ["/api/moyasar/merchant"],
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
      moyasarPublishableKey: restaurant?.moyasarPublishableKey || "",
      moyasarSecretKey: restaurant?.moyasarSecretKey || "",
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
        const { password, ...updateData } = cleanedData;
        return apiRequest("PUT", `/api/users/${data.id}`, updateData);
      }
      return apiRequest("POST", "/api/users/register", cleanedData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
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

  const merchantForm = useForm<z.infer<typeof merchantFormSchema>>({
    resolver: zodResolver(merchantFormSchema),
    values: {
      name: restaurant?.nameEn?.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase() || "",
      publicName: restaurant?.nameEn || restaurant?.nameAr || "",
      merchantType: "establishment",
      adminEmail: restaurant?.email || "",
      email: restaurant?.email || "",
      country: restaurant?.country || "SA",
      timeZone: "Asia/Riyadh",
      website: "",
      statementDescriptor: restaurant?.nameEn || "",
      ownersCount: 1,
      signatory: "owner",
      signatoryCount: 1,
      activityLicenseRequired: false,
      enabledSchemes: ["mada", "visa", "master"],
      paymentMethods: ["creditcard"],
      fees: {
        tax_inclusive: true,
        mada_charge_rate: 1.70,
        mada_charge_fixed: 1.00,
        mada_refund_rate: 0,
        mada_refund_fixed: 1.00,
        cc_charge_rate: 2.70,
        cc_charge_fixed: 1.00,
        cc_refund_rate: 0,
        cc_refund_fixed: 1.00,
      },
    },
  });

  const documentForm = useForm<z.infer<typeof documentFormSchema>>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: {
      documentType: "owner_id",
      idNumber: "",
      dateOfBirth: "",
      mobile: "",
      holder: "",
      ibanNumber: "",
      crNumber: "",
      vatNumber: "",
      expiryDate: "",
      addressName: "",
      addressStreet: "",
      addressDistrict: "",
      addressBuildingNumber: "",
      addressSecondaryNumber: "",
      addressPostalCode: "",
      addressCity: "",
      addressCountry: "SA",
    },
  });

  const selectedDocConfig = documentTypes.find(d => d.value === selectedDocType);

  const merchantMutation = useMutation({
    mutationFn: async (data: z.infer<typeof merchantFormSchema>) => {
      return apiRequest("POST", "/api/moyasar/merchant", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/moyasar/merchant"] });
      toast({ title: t("save") + " ✓" });
    },
    onError: () => {
      toast({ title: t("error"), variant: "destructive" });
    },
  });

  const documentMutation = useMutation({
    mutationFn: async (data: z.infer<typeof documentFormSchema> & { fileData?: string; fileName?: string; fileMimeType?: string }) => {
      const docConfig = documentTypes.find(d => d.value === data.documentType);
      const documentInfo: Record<string, string | undefined> = {};
      
      if (docConfig?.needsIdInfo) {
        documentInfo.id = data.idNumber;
        documentInfo.date_of_birth = data.dateOfBirth;
      }
      if (docConfig?.needsCrNumber) {
        documentInfo.number = data.crNumber;
      }
      if (docConfig?.needsIban) {
        documentInfo.holder = data.holder;
        documentInfo.iban = data.ibanNumber;
      }
      if (docConfig?.needsVat) {
        documentInfo.number = data.vatNumber;
      }
      if ((docConfig as any)?.needsExpiry) {
        documentInfo.expiry_date = data.expiryDate;
      }
      if ((docConfig as any)?.needsAddress) {
        documentInfo.name = data.addressName;
        documentInfo.street = data.addressStreet;
        documentInfo.district = data.addressDistrict;
        documentInfo.building_number = data.addressBuildingNumber;
        documentInfo.secondary_number = data.addressSecondaryNumber;
        documentInfo.postal_code = data.addressPostalCode;
        documentInfo.city = data.addressCity;
        documentInfo.country = data.addressCountry;
      }
      
      return apiRequest("POST", "/api/moyasar/merchant/documents", {
        documentType: data.documentType,
        documentInfo,
        fileData: data.fileData,
        fileName: data.fileName,
        fileMimeType: data.fileMimeType,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/moyasar/merchant"] });
      setDocumentDialogOpen(false);
      setUploadedFile(null);
      documentForm.reset();
      toast({ title: t("save") + " ✓" });
    },
    onError: (error: any) => {
      toast({ title: error?.message || t("error"), variant: "destructive" });
    },
  });

  const submitReviewMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/moyasar/merchant/submit-review", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/moyasar/merchant"] });
      toast({ title: language === "ar" ? "تم الإرسال للمراجعة" : "Submitted for review" });
    },
    onError: (error: any) => {
      toast({ title: error?.message || t("error"), variant: "destructive" });
    },
  });

  const syncStatusMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/moyasar/merchant/sync-status", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/moyasar/merchant"] });
      toast({ title: language === "ar" ? "تم تحديث الحالة" : "Status updated" });
    },
    onError: (error: any) => {
      toast({ title: error?.message || t("error"), variant: "destructive" });
    },
  });

  const onMerchantSubmit = (data: z.infer<typeof merchantFormSchema>) => {
    merchantMutation.mutate(data);
  };

  const onDocumentSubmit = (data: z.infer<typeof documentFormSchema>) => {
    documentMutation.mutate({
      ...data,
      fileData: uploadedFile?.data,
      fileName: uploadedFile?.name,
      fileMimeType: uploadedFile?.type,
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setUploadedFile({
          name: file.name,
          data: reader.result as string,
          type: file.type,
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const getSignatureStatusBadge = (status: string | null | undefined) => {
    switch (status) {
      case "signed":
        return <Badge variant="default" className="bg-green-600"><CheckCircle2 className="h-3 w-3 me-1" />{t("signatureSigned")}</Badge>;
      case "initiated":
        return <Badge variant="secondary" className="bg-amber-500 text-white"><Clock className="h-3 w-3 me-1" />{t("signatureInitiated")}</Badge>;
      case "rejected":
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 me-1" />{t("signatureRejected")}</Badge>;
      default:
        return <Badge variant="outline">{t("signatureUnsigned")}</Badge>;
    }
  };

  const getMerchantStatusBadge = (status: string | null | undefined) => {
    switch (status) {
      case "active":
        return <Badge variant="default" className="bg-green-600">{t("merchantActive")}</Badge>;
      case "pending":
        return <Badge variant="secondary">{t("merchantPending")}</Badge>;
      case "rejected":
        return <Badge variant="destructive">{t("merchantRejected")}</Badge>;
      default:
        return <Badge variant="outline">{t("merchantInactive")}</Badge>;
    }
  };

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
    if (!editingUser && (!data.password || data.password.length < 6)) {
      toast({ title: language === "ar" ? "كلمة المرور مطلوبة (6 أحرف على الأقل)" : "Password is required (at least 6 characters)", variant: "destructive" });
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
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">{t("settings")}</h2>
        <p className="text-muted-foreground">{t("restaurantInfo")}</p>
      </div>

      <Tabs defaultValue={isMainBranch ? "general" : "language"} className="w-full">
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
              <TabsTrigger value="appearance" data-testid="tab-appearance">
                <Palette className="h-4 w-4 me-2" />
                {t("appearance")}
              </TabsTrigger>
            </>
          )}
          <TabsTrigger value="language" data-testid="tab-language">
            <Globe className="h-4 w-4 me-2" />
            {t("language")}
          </TabsTrigger>
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
          {isMainBranch && (
            <TabsTrigger value="payments" data-testid="tab-payments">
              <CreditCard className="h-4 w-4 me-2" />
              {t("payments")}
            </TabsTrigger>
          )}

        </TabsList>

        {!isMainBranch && (
          <div className="mt-4 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
            <Crown className="h-4 w-4 shrink-0" />
            {language === "ar" 
              ? "أنت تعرض فرع فرعي. للوصول إلى جميع الإعدادات (عام، القائمة، الفوترة، المدفوعات، الصلاحيات)، انتقل إلى الفرع الرئيسي."
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
                {language === "ar" ? "تخصيص مظهر القائمة للعملاء" : "Customize menu appearance for customers"}
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
                    <><div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={billingForm.control}
                        name="vatNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("vatNumber")}</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="3XXXXXXXXXX0003" data-testid="input-vat-number" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={billingForm.control}
                        name="commercialRegistration"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("commercialReg")}</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-commercial-reg" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
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

                  {/* Owner & Address Section */}
                  <div className="space-y-4">
                    <h3 className="font-medium border-b pb-2">
                      {language === "ar" ? "معلومات المالك والعنوان" : "Owner & Address"}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={billingForm.control}
                        name="ownerName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("ownerName")}</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-owner-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={billingForm.control}
                        name="ownerPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("ownerPhone")}</FormLabel>
                            <FormControl>
                              <Input {...field} type="tel" data-testid="input-owner-phone" />
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
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("buildingNumber")}</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-building-number" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={billingForm.control}
                        name="streetName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("street")}</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-street-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={billingForm.control}
                        name="district"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("district")}</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-district" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={billingForm.control}
                        name="postalCode"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("postalCode")}</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-postal-code" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <FormField
                      control={billingForm.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("city")}</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-city" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Bank Details Section */}
                  <div className="space-y-4">
                    <h3 className="font-medium border-b pb-2">{t("bankDetails")}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={billingForm.control}
                        name="bankAccountHolder"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("accountHolder")}</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-account-holder" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={billingForm.control}
                        name="bankName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("bankName")}</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-bank-name" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <FormField
                        control={billingForm.control}
                        name="bankAccountNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("accountNumber")}</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-account-number" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={billingForm.control}
                        name="bankSwift"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("swift")}</FormLabel>
                            <FormControl>
                              <Input {...field} data-testid="input-swift" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={billingForm.control}
                        name="bankIban"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("iban")}</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="SA..." data-testid="input-iban" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
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

        {/* Appearance Tab */}
        <TabsContent value="appearance" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("appearance")}</CardTitle>
              <CardDescription>
                {language === "ar" ? "تخصيص مظهر لوحة التحكم" : "Customize dashboard appearance"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="font-medium">{t("theme")}</div>
                  <div className="text-sm text-muted-foreground">
                    {t("dark")} / {t("light")}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{t("light")}</span>
                  <Switch
                    checked={theme === "dark"}
                    onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                    data-testid="switch-theme"
                  />
                  <span className="text-sm text-muted-foreground">{t("dark")}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Language Tab */}
        <TabsContent value="language" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("language")}</CardTitle>
              <CardDescription>
                {language === "ar" ? "اختر لغة النظام" : "Choose system language"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="font-medium">{t("language")}</div>
                  <div className="text-sm text-muted-foreground">
                    {language === "en" ? "Left-to-Right (LTR)" : "Right-to-Left (RTL)"}
                  </div>
                </div>
                <Select value={language} onValueChange={(val) => setLanguage(val as "en" | "ar")}>
                  <SelectTrigger className="w-[180px]" data-testid="select-language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">{t("english")} (English)</SelectItem>
                    <SelectItem value="ar">{t("arabic")} (العربية)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
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
                      {!editingUser && (
                        <FormField
                          control={userForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("password")} *</FormLabel>
                              <FormControl>
                                <Input {...field} type="password" data-testid="input-user-password" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
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
                                  {userRoles.map((role) => (
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
                      <div className="space-y-2">
                        <h4 className="font-medium">{t("permissions")}</h4>
                        <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                          {[
                            { key: "permDashboard", label: "permDashboard" },
                            { key: "permPos", label: "permPos" },
                            { key: "permOrders", label: "permOrders" },
                            { key: "permMenu", label: "permMenu" },
                            { key: "permKitchen", label: "permKitchen" },
                            { key: "permInventory", label: "permInventory" },
                            { key: "permReviews", label: "permReviews" },
                            { key: "permMarketing", label: "permMarketing" },
                            { key: "permQr", label: "permQr" },
                            { key: "permReports", label: "permReports" },
                            { key: "permSettings", label: "permSettings" },
                          ].map(({ key, label }) => (
                            <FormField
                              key={key}
                              control={userForm.control}
                              name={key as keyof z.infer<typeof userFormSchema>}
                              render={({ field }) => (
                                <FormItem className="flex items-center gap-2 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value as boolean}
                                      onCheckedChange={field.onChange}
                                      data-testid={`checkbox-${key}`}
                                    />
                                  </FormControl>
                                  <FormLabel className="text-sm font-normal">{t(label)}</FormLabel>
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


            {/* Progress Overview Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      {t("onboardingProgress")}
                    </CardTitle>
                    <CardDescription>{t("completeAllSteps")}</CardDescription>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => refetchMerchant()} data-testid="button-refresh-merchant">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {merchantLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Step 1: Create Merchant */}
                    <div className={`p-4 rounded-lg border-2 ${merchant ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-primary bg-primary/5'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full text-white font-bold ${merchant ? 'bg-green-600' : 'bg-primary'}`}>
                          {merchant ? <CheckCircle2 className="h-5 w-5" /> : "1"}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold">{t("step1CreateMerchant")}</h3>
                          {merchant ? (
                            <div className="text-sm text-muted-foreground flex items-center gap-2">{merchant.name} {getMerchantStatusBadge(merchant.status)}</div>
                          ) : (
                            <div className="text-sm text-muted-foreground">{t("noMerchantYet")}</div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Step 2: Upload Documents */}
                    <div className={`p-4 rounded-lg border-2 ${
                      merchant && documentTypes.filter(d => d.required).every(d => merchant.documents?.some(doc => doc.documentType === d.value)) 
                        ? 'border-green-500 bg-green-50 dark:bg-green-950' 
                        : merchant ? 'border-primary bg-primary/5' : 'border-muted bg-muted/20'
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full text-white font-bold ${
                          merchant && documentTypes.filter(d => d.required).every(d => merchant.documents?.some(doc => doc.documentType === d.value))
                            ? 'bg-green-600' 
                            : merchant ? 'bg-primary' : 'bg-muted-foreground'
                        }`}>
                          {merchant && documentTypes.filter(d => d.required).every(d => merchant.documents?.some(doc => doc.documentType === d.value)) 
                            ? <CheckCircle2 className="h-5 w-5" /> : "2"}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold">{t("step2UploadDocs")}</h3>
                          <p className="text-sm text-muted-foreground">
                            {merchant?.documents?.length || 0} / {documentTypes.filter(d => d.required).length} {t("requiredDocs")}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Step 3: Nafath Signing */}
                    <div className={`p-4 rounded-lg border-2 ${
                      merchant?.signatureStatus === 'signed' 
                        ? 'border-green-500 bg-green-50 dark:bg-green-950' 
                        : merchant?.signatureStatus === 'initiated' ? 'border-amber-500 bg-amber-50 dark:bg-amber-950'
                        : merchant ? 'border-primary bg-primary/5' : 'border-muted bg-muted/20'
                    }`}>
                      <div className="flex items-center gap-3">
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full text-white font-bold ${
                          merchant?.signatureStatus === 'signed' ? 'bg-green-600' 
                            : merchant?.signatureStatus === 'initiated' ? 'bg-amber-500'
                            : merchant ? 'bg-primary' : 'bg-muted-foreground'
                        }`}>
                          {merchant?.signatureStatus === 'signed' ? <CheckCircle2 className="h-5 w-5" /> : "3"}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold">{t("step3NafathSign")}</h3>
                          <div className="text-sm">{getSignatureStatusBadge(merchant?.signatureStatus)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {!merchant && (
              <Card>
                <CardHeader>
                  <CardTitle>{language === "ar" ? "تفعيل الدفع الإلكتروني" : "Activate Online Payments"}</CardTitle>
                  <CardDescription>
                    {language === "ar"
                      ? "أكمل البيانات التالية لتفعيل استقبال المدفوعات الإلكترونية في مطعمك"
                      : "Complete the following to start accepting online payments"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...merchantForm}>
                    <form onSubmit={merchantForm.handleSubmit(onMerchantSubmit)} className="space-y-6">
                      {/* Business Type */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={merchantForm.control}
                          name="merchantType"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{language === "ar" ? "نوع النشاط" : "Business Type"} *</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="freelancer">{language === "ar" ? "عمل حر" : "Freelancer"}</SelectItem>
                                  <SelectItem value="establishment">{language === "ar" ? "مؤسسة" : "Establishment"}</SelectItem>
                                  <SelectItem value="company">{t("company")}</SelectItem>
                                  <SelectItem value="foreign_company">{language === "ar" ? "شركة أجنبية" : "Foreign Company"}</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={merchantForm.control}
                          name="website"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{language === "ar" ? "رابط الموقع أو التطبيق" : "Website / App URL"} *</FormLabel>
                              <FormControl>
                                <Input {...field} type="url" placeholder="https://" dir="ltr" />
                              </FormControl>
                              <FormDescription className="text-xs">
                                {language === "ar" ? "رابط موقعك أو متجرك الإلكتروني" : "Your website or online store URL"}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={merchantForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{language === "ar" ? "البريد الإلكتروني للتواصل" : "Contact Email"} *</FormLabel>
                              <FormControl>
                                <Input {...field} type="email" dir="ltr" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={merchantForm.control}
                          name="ownersCount"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{language === "ar" ? "عدد الملاك (حسب السجل التجاري)" : "Number of Owners (as in CR)"}</FormLabel>
                              <FormControl>
                                <Input {...field} type="number" min={1} onChange={e => field.onChange(parseInt(e.target.value) || 1)} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={merchantForm.control}
                          name="signatory"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{language === "ar" ? "المخوّل بالتوقيع" : "Authorized Signatory"}</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="owner">{language === "ar" ? "المالك" : "Owner"}</SelectItem>
                                  <SelectItem value="commercial_contract">{language === "ar" ? "عقد تأسيس" : "Commercial Contract"}</SelectItem>
                                  <SelectItem value="power_of_attorney">{language === "ar" ? "توكيل رسمي" : "Power of Attorney"}</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        {merchantForm.watch("signatory") !== "owner" && (
                          <FormField
                            control={merchantForm.control}
                            name="signatoryCount"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{language === "ar" ? "عدد الموقعين المخوّلين" : "Number of Signatories"}</FormLabel>
                                <FormControl>
                                  <Input {...field} type="number" min={1} onChange={e => field.onChange(parseInt(e.target.value) || 1)} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        )}
                        <FormField
                          control={merchantForm.control}
                          name="activityLicenseRequired"
                          render={({ field }) => (
                            <FormItem className="flex items-center gap-3 space-y-0 rounded-lg border p-3">
                              <FormControl>
                                <Switch checked={field.value} onCheckedChange={field.onChange} />
                              </FormControl>
                              <FormLabel className="cursor-pointer">
                                {language === "ar" ? "النشاط يتطلب رخصة خاصة" : "Business requires activity license"}
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="p-4 rounded-lg bg-muted/50 border">
                        <p className="text-sm text-muted-foreground">
                          {language === "ar"
                            ? "سيتم تفعيل جميع طرق الدفع (مدى، فيزا، ماستركارد) تلقائياً. باقي البيانات مثل اسم المطعم والبريد الإلكتروني ستُسحب من إعدادات مطعمك."
                            : "All payment methods (Mada, Visa, Mastercard) will be enabled automatically. Restaurant name, email and other details will be pulled from your restaurant settings."}
                        </p>
                      </div>

                      {Object.keys(merchantForm.formState.errors).length > 0 && (
                        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
                          {language === "ar" ? "يرجى تعبئة جميع الحقول المطلوبة:" : "Please fill all required fields:"}
                          <ul className="list-disc list-inside mt-1">
                            {Object.entries(merchantForm.formState.errors).map(([key, err]) => (
                              <li key={key}>{key}: {(err as any)?.message}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <Button type="submit" disabled={merchantMutation.isPending || isLoading} className="w-full">
                        {merchantMutation.isPending ? "..." : isLoading ? (language === "ar" ? "جاري التحميل..." : "Loading...") : (language === "ar" ? "تفعيل الدفع الإلكتروني" : "Activate Online Payments")}
                      </Button>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            )}

            {/* Step 2: Documents Checklist */}
            {merchant && (
              <Card>
                <CardHeader>
                  <CardTitle>{t("step2UploadDocs")}</CardTitle>
                  <CardDescription>{t("requiredForNafath")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h4 className="font-semibold text-destructive mb-3 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      {t("requiredDocs")}
                    </h4>
                    <div className="space-y-3">
                      {(() => {
                        const requiredDocValues = (merchant as any).requiredDocuments as string[] | undefined;
                        const requiredDocs = requiredDocValues && requiredDocValues.length > 0
                          ? documentTypes.filter(d => requiredDocValues.includes(d.value))
                          : documentTypes.filter(d => d.required);
                        return requiredDocs.map((docType) => {
                          const uploadedDoc = merchant.documents?.find(d => d.documentType === docType.value);
                          return (
                            <div key={docType.value} className={`p-4 rounded-lg border ${uploadedDoc ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-destructive/50 bg-destructive/5'}`}>
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    {uploadedDoc ? (
                                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                                    ) : (
                                      <div className="h-5 w-5 rounded-full border-2 border-muted-foreground" />
                                    )}
                                    <span className="font-medium">{t(docType.labelKey)}</span>
                                  </div>
                                  <p className="text-sm text-muted-foreground ms-7">{t(docType.descKey)}</p>
                                  {uploadedDoc && (
                                    <p className="text-xs text-green-600 ms-7 mt-1">
                                      {(uploadedDoc.documentInfo as any)?.id || 
                                       (uploadedDoc.documentInfo as any)?.number || 
                                       (uploadedDoc.documentInfo as any)?.iban || ""}
                                    </p>
                                  )}
                                </div>
                                {!uploadedDoc && (
                                  <Button 
                                    size="sm" 
                                    onClick={() => { setSelectedDocType(docType.value); documentForm.setValue('documentType', docType.value); setDocumentDialogOpen(true); }}
                                  >
                                    {t("clickToUpload")}
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                      {t("optionalDocs")}
                    </h4>
                    <div className="space-y-3">
                      {(() => {
                        const requiredDocValues = (merchant as any).requiredDocuments as string[] | undefined;
                        const optionalDocs = requiredDocValues && requiredDocValues.length > 0
                          ? documentTypes.filter(d => !requiredDocValues.includes(d.value))
                          : documentTypes.filter(d => !d.required);
                        return optionalDocs.map((docType) => {
                          const uploadedDoc = merchant.documents?.find(d => d.documentType === docType.value);
                          return (
                            <div key={docType.value} className={`p-4 rounded-lg border ${uploadedDoc ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-muted'}`}>
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    {uploadedDoc ? (
                                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                                    ) : (
                                      <div className="h-5 w-5 rounded-full border-2 border-muted" />
                                    )}
                                    <span className="font-medium">{t(docType.labelKey)}</span>
                                    <Badge variant="outline" className="text-xs">{t("optional")}</Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground ms-7">{t(docType.descKey)}</p>
                                </div>
                                {!uploadedDoc && (
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={() => { setSelectedDocType(docType.value); documentForm.setValue('documentType', docType.value); setDocumentDialogOpen(true); }}
                                  >
                                    {t("clickToUpload")}
                                  </Button>
                                )}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Document Upload Dialog */}
            <Dialog open={documentDialogOpen} onOpenChange={setDocumentDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("uploadDocuments")}</DialogTitle>
                </DialogHeader>
                <Form {...documentForm}>
                  <form onSubmit={documentForm.handleSubmit(onDocumentSubmit)} className="space-y-4">
                    <FormField
                      control={documentForm.control}
                      name="documentType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("documentType")} *</FormLabel>
                          <Select onValueChange={(val) => { field.onChange(val); setSelectedDocType(val); }} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-document-type">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {documentTypes.map((doc) => (
                                <SelectItem key={doc.value} value={doc.value}>
                                  {t(doc.labelKey)}
                                  {doc.required && <span className="text-destructive ms-1">*</span>}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {selectedDocConfig && (
                            <p className="text-sm text-muted-foreground">{t(selectedDocConfig.descKey)}</p>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    {/* ID Info Fields - for owner_id and signatory_id */}
                    {selectedDocConfig?.needsIdInfo && (
                      <>
                        <FormField
                          control={documentForm.control}
                          name="idNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("idNumber")} *</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="1xxxxxxxxx" data-testid="input-id-number" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={documentForm.control}
                          name="dateOfBirth"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("dateOfBirth")} *</FormLabel>
                              <FormControl>
                                <Input {...field} type="date" data-testid="input-date-of-birth" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={documentForm.control}
                          name="mobile"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("mobile")} *</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="05xxxxxxxx" data-testid="input-mobile" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}

                    {/* CR Number Field */}
                    {selectedDocConfig?.needsCrNumber && (
                      <FormField
                        control={documentForm.control}
                        name="crNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("crNumber")} *</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="10xxxxxxxx" data-testid="input-cr-number" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {selectedDocConfig?.needsIban && (
                      <>
                        <FormField
                          control={documentForm.control}
                          name="holder"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{language === "ar" ? "اسم صاحب الحساب" : "Account Holder"} *</FormLabel>
                              <FormControl>
                                <Input {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={documentForm.control}
                          name="ibanNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t("ibanNumber")} *</FormLabel>
                              <FormControl>
                                <Input {...field} placeholder="SA..." />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </>
                    )}

                    {selectedDocConfig?.needsVat && (
                      <FormField
                        control={documentForm.control}
                        name="vatNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("vatNumber")}</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="3xxxxxxxxxxxxxx3" data-testid="input-vat-number" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {(selectedDocConfig as any)?.needsExpiry && (
                      <FormField
                        control={documentForm.control}
                        name="expiryDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{language === "ar" ? "تاريخ الانتهاء" : "Expiry Date"}</FormLabel>
                            <FormControl>
                              <Input {...field} type="date" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    {(selectedDocConfig as any)?.needsAddress && (
                      <div className="space-y-3 border-t pt-3">
                        <FormLabel className="text-sm font-semibold">{language === "ar" ? "معلومات العنوان" : "Address Info"}</FormLabel>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <FormField control={documentForm.control} name="addressName" render={({ field }) => (
                            <FormItem><FormLabel>{t("name")}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={documentForm.control} name="addressStreet" render={({ field }) => (
                            <FormItem><FormLabel>{t("street")}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={documentForm.control} name="addressDistrict" render={({ field }) => (
                            <FormItem><FormLabel>{t("district")}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={documentForm.control} name="addressBuildingNumber" render={({ field }) => (
                            <FormItem><FormLabel>{t("buildingNumber")}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={documentForm.control} name="addressSecondaryNumber" render={({ field }) => (
                            <FormItem><FormLabel>{language === "ar" ? "الرقم الإضافي" : "Secondary Number"}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={documentForm.control} name="addressPostalCode" render={({ field }) => (
                            <FormItem><FormLabel>{t("postalCode")}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={documentForm.control} name="addressCity" render={({ field }) => (
                            <FormItem><FormLabel>{t("city")}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                          <FormField control={documentForm.control} name="addressCountry" render={({ field }) => (
                            <FormItem><FormLabel>{language === "ar" ? "الدولة" : "Country"}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                          )} />
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <FormLabel>{t("uploadFile")} *</FormLabel>
                      <Input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={handleFileUpload}
                      />
                      {uploadedFile && (
                        <p className="text-sm text-green-600 flex items-center gap-1">
                          <CheckCircle2 className="h-4 w-4" />
                          {uploadedFile.name}
                        </p>
                      )}
                    </div>
                    <Button type="submit" className="w-full" disabled={documentMutation.isPending}>
                      {documentMutation.isPending ? "..." : t("save")}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>

            {merchant && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {t("step3NafathSign")}
                    {getMerchantStatusBadge(merchant.status)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(merchant.status === "unsigned" || merchant.status === "draft" || !merchant.status) && (
                    <div className="text-center py-6">
                      <p className="text-muted-foreground mb-4">{t("requiredForNafath")}</p>
                      <Button
                        size="lg"
                        onClick={() => submitReviewMutation.mutate()}
                        disabled={submitReviewMutation.isPending || (() => {
                          const requiredDocValues = (merchant as any).requiredDocuments as string[] | undefined;
                          const reqDocs = requiredDocValues && requiredDocValues.length > 0
                            ? documentTypes.filter(d => requiredDocValues.includes(d.value))
                            : documentTypes.filter(d => d.required);
                          return !reqDocs.every(d => merchant.documents?.some(doc => doc.documentType === d.value));
                        })()}
                      >
                        {submitReviewMutation.isPending ? "..." : (language === "ar" ? "إرسال للمراجعة" : "Submit for Review")}
                      </Button>
                      {(() => {
                        const requiredDocValues = (merchant as any).requiredDocuments as string[] | undefined;
                        const reqDocs = requiredDocValues && requiredDocValues.length > 0
                          ? documentTypes.filter(d => requiredDocValues.includes(d.value))
                          : documentTypes.filter(d => d.required);
                        return !reqDocs.every(d => merchant.documents?.some(doc => doc.documentType === d.value));
                      })() && (
                        <p className="text-sm text-destructive mt-2">{t("documentsRequired")}</p>
                      )}
                    </div>
                  )}

                  {(merchant.status === "pending" || merchant.status === "under_review") && (
                    <div className="text-center py-6 space-y-4">
                      <div className="p-6 bg-amber-50 dark:bg-amber-950 rounded-lg">
                        <Clock className="h-12 w-12 text-amber-500 mx-auto mb-4" />
                        <p className="text-amber-800 dark:text-amber-200 font-medium">{language === "ar" ? "طلبك قيد المراجعة" : "Your application is under review"}</p>
                      </div>
                      <Button variant="outline" onClick={() => syncStatusMutation.mutate()} disabled={syncStatusMutation.isPending}>
                        <RefreshCw className="h-4 w-4 me-2" />
                        {syncStatusMutation.isPending ? "..." : t("refreshStatus")}
                      </Button>
                    </div>
                  )}

                  {merchant.signatureUrl && merchant.signatureStatus === "initiated" && (
                    <div className="text-center py-6 space-y-4">
                      <div className="p-6 bg-amber-50 dark:bg-amber-950 rounded-lg">
                        <Clock className="h-12 w-12 text-amber-500 mx-auto mb-4" />
                        <p className="text-amber-800 dark:text-amber-200 mb-4">{t("openNafath")}</p>
                        <Button size="lg" asChild>
                          <a href={merchant.signatureUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4 me-2" />
                            {t("signNow")}
                          </a>
                        </Button>
                      </div>
                      <Button variant="outline" onClick={() => syncStatusMutation.mutate()} disabled={syncStatusMutation.isPending}>
                        <RefreshCw className="h-4 w-4 me-2" />
                        {syncStatusMutation.isPending ? "..." : t("refreshStatus")}
                      </Button>
                    </div>
                  )}

                  {merchant.signatureStatus === "signed" && merchant.status !== "active" && merchant.status !== "semi_active" && (
                    <div className="text-center py-6">
                      <div className="inline-flex flex-col items-center gap-3 p-6 bg-green-50 dark:bg-green-950 rounded-lg">
                        <CheckCircle2 className="h-12 w-12 text-green-600" />
                        <span className="text-green-800 dark:text-green-200 font-medium text-lg">{t("signatureSigned")}</span>
                      </div>
                    </div>
                  )}

                  {merchant.status === "missing_docs" && (
                    <div className="text-center py-6 space-y-4">
                      <div className="p-6 bg-red-50 dark:bg-red-950 rounded-lg">
                        <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
                        <p className="text-red-800 dark:text-red-200 font-medium mb-2">{language === "ar" ? "مستندات ناقصة" : "Missing Documents"}</p>
                        {(merchant as any).rejectionReasons && ((merchant as any).rejectionReasons as string[]).length > 0 && (
                          <div className="text-start mt-3">
                            <p className="text-sm font-medium text-red-700 dark:text-red-300 mb-1">{language === "ar" ? "الأسباب:" : "Reasons:"}</p>
                            <ul className="text-sm text-red-600 dark:text-red-400 list-disc list-inside">
                              {((merchant as any).rejectionReasons as string[]).map((reason: string, i: number) => (
                                <li key={i}>{reason}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{language === "ar" ? "يرجى إعادة رفع المستندات المطلوبة" : "Please re-upload the required documents"}</p>
                    </div>
                  )}

                  {(merchant.status === "active" || merchant.status === "semi_active") && (
                    <div className="text-center py-6">
                      <div className="inline-flex flex-col items-center gap-3 p-6 bg-green-50 dark:bg-green-950 rounded-lg">
                        <CheckCircle2 className="h-12 w-12 text-green-600" />
                        <span className="text-green-800 dark:text-green-200 font-medium text-lg">{t("merchantActive")}</span>
                        <Badge className="bg-green-600">{merchant.status === "semi_active" ? (language === "ar" ? "نشط جزئياً" : "Semi-Active") : t("merchantActive")}</Badge>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-center pt-2">
                    <Button variant="outline" size="sm" onClick={() => syncStatusMutation.mutate()} disabled={syncStatusMutation.isPending}>
                      <RefreshCw className="h-4 w-4 me-2" />
                      {syncStatusMutation.isPending ? "..." : (language === "ar" ? "مزامنة الحالة" : "Sync Status")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {merchant && (merchant.status === "active" || merchant.status === "semi_active") && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    {language === "ar" ? "الدفع الإلكتروني مفعّل" : "Online Payments Active"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-6 bg-green-50 dark:bg-green-950 rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="h-8 w-8 text-green-600" />
                      <div>
                        <p className="font-semibold text-green-800 dark:text-green-200">
                          {language === "ar" ? "مطعمك جاهز لاستقبال المدفوعات الإلكترونية!" : "Your restaurant is ready to accept online payments!"}
                        </p>
                        <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                          {language === "ar"
                            ? "يمكن لعملائك الآن الدفع عبر مدى، فيزا، ماستركارد، وApple Pay"
                            : "Your customers can now pay via Mada, Visa, Mastercard, and Apple Pay"}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ZATCA E-Invoicing Tab */}


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
      const res = await apiRequest("POST", "/api/zatca/compliance-csid", { otp, csr });
      return res.json();
    },
    onSuccess: (data: any) => {
      refetchStatus();
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
      const res = await apiRequest("POST", "/api/zatca/compliance-check");
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
      const res = await apiRequest("POST", "/api/zatca/production-csid");
      return res.json();
    },
    onSuccess: () => {
      refetchStatus();
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

  const isAr = language === "ar";

  return (
    <div className="space-y-6">
      {/* ZATCA Status Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {isAr ? "حالة الفوترة الإلكترونية (ZATCA)" : "E-Invoicing Status (ZATCA)"}
          </CardTitle>
          <CardDescription>
            {isAr
              ? "هيئة الزكاة والضريبة والجمارك - نظام فاتورة"
              : "Zakat, Tax and Customs Authority - FATOORA System"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-3 rounded-lg border bg-card">
              <p className="text-xs text-muted-foreground">{isAr ? "رقم ضريبي" : "VAT Number"}</p>
              <p className="font-semibold text-sm mt-1">
                {zatcaStatus?.vatNumber || (isAr ? "غير مسجل" : "Not Set")}
              </p>
              {zatcaStatus?.hasVatNumber ? (
                <Badge variant="default" className="mt-1 text-[10px]">
                  <CheckCircle2 className="h-3 w-3 me-1" />
                  {isAr ? "مسجل" : "Registered"}
                </Badge>
              ) : (
                <Badge variant="destructive" className="mt-1 text-[10px]">
                  <AlertCircle className="h-3 w-3 me-1" />
                  {isAr ? "مطلوب" : "Required"}
                </Badge>
              )}
            </div>

            <div className="p-3 rounded-lg border bg-card">
              <p className="text-xs text-muted-foreground">{isAr ? "شهادة الامتثال" : "Compliance CSID"}</p>
              <p className="font-semibold text-sm mt-1">
                {zatcaStatus?.hasComplianceCsid ? (isAr ? "مثبتة" : "Installed") : (isAr ? "غير مثبتة" : "Not Set")}
              </p>
              <Badge variant={zatcaStatus?.hasComplianceCsid ? "default" : "outline"} className="mt-1 text-[10px]">
                {zatcaStatus?.hasComplianceCsid ? "✓" : "—"} {isAr ? "الخطوة 1" : "Step 1"}
              </Badge>
            </div>

            <div className="p-3 rounded-lg border bg-card">
              <p className="text-xs text-muted-foreground">{isAr ? "شهادة الإنتاج" : "Production CSID"}</p>
              <p className="font-semibold text-sm mt-1">
                {zatcaStatus?.hasProductionCsid ? (isAr ? "مفعّلة" : "Active") : (isAr ? "غير مفعّلة" : "Not Active")}
              </p>
              <Badge variant={zatcaStatus?.hasProductionCsid ? "default" : "outline"} className="mt-1 text-[10px]">
                {zatcaStatus?.hasProductionCsid ? "✓" : "—"} {isAr ? "الخطوة 3" : "Step 3"}
              </Badge>
            </div>

            <div className="p-3 rounded-lg border bg-card">
              <p className="text-xs text-muted-foreground">{isAr ? "البيئة" : "Environment"}</p>
              <p className="font-semibold text-sm mt-1 capitalize">{zatcaStatus?.environment || "sandbox"}</p>
              <Badge variant={zatcaStatus?.environment === "production" ? "default" : "secondary"} className="mt-1 text-[10px]">
                {zatcaStatus?.environment === "production"
                  ? (isAr ? "إنتاج" : "Production")
                  : (isAr ? "تجريبي" : "Sandbox")}
              </Badge>
            </div>
          </div>

          {zatcaStatus?.isFullyConfigured && (
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <span className="font-semibold text-green-800 dark:text-green-200">
                  {isAr ? "النظام جاهز للفوترة الإلكترونية" : "System Ready for E-Invoicing"}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dashboard Stats */}
      {dashboardStats && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {isAr ? "إحصائيات الفواتير" : "Invoice Statistics"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{dashboardStats.total}</p>
                <p className="text-xs text-blue-600 dark:text-blue-400">{isAr ? "إجمالي" : "Total"}</p>
              </div>
              <div className="text-center p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{dashboardStats.pending}</p>
                <p className="text-xs text-amber-600 dark:text-amber-400">{isAr ? "معلقة" : "Pending"}</p>
              </div>
              <div className="text-center p-3 bg-green-50 dark:bg-green-950/30 rounded-lg">
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">{dashboardStats.accepted}</p>
                <p className="text-xs text-green-600 dark:text-green-400">{isAr ? "مقبولة" : "Accepted"}</p>
              </div>
              <div className="text-center p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                <p className="text-2xl font-bold text-red-700 dark:text-red-300">{dashboardStats.rejected}</p>
                <p className="text-xs text-red-600 dark:text-red-400">{isAr ? "مرفوضة" : "Rejected"}</p>
              </div>
              <div className="text-center p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{dashboardStats.creditNotes}</p>
                <p className="text-xs text-purple-600 dark:text-purple-400">{isAr ? "إشعارات دائنة" : "Credit Notes"}</p>
              </div>
            </div>

            {dashboardStats.pending > 0 && (
              <div className="mt-4">
                <Button
                  variant="outline"
                  onClick={() => batchSubmit.mutate()}
                  disabled={batchSubmit.isPending}
                  className="w-full"
                >
                  <Wifi className="h-4 w-4 me-2" />
                  {batchSubmit.isPending
                    ? (isAr ? "جاري الإرسال..." : "Submitting...")
                    : (isAr ? `إرسال ${dashboardStats.pending} فاتورة معلقة إلى ZATCA` : `Submit ${dashboardStats.pending} Pending Invoices to ZATCA`)}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Environment Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{isAr ? "بيئة ZATCA" : "ZATCA Environment"}</CardTitle>
          <CardDescription>
            {isAr
              ? "اختر بيئة الاتصال مع منصة فاتورة"
              : "Select the FATOORA platform connection environment"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={zatcaStatus?.environment || "sandbox"}
            onValueChange={(val) => updateEnvironment.mutate(val)}
          >
            <SelectTrigger className="w-full max-w-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sandbox">
                {isAr ? "بيئة تجريبية (Sandbox)" : "Sandbox (Testing)"}
              </SelectItem>
              <SelectItem value="simulation">
                {isAr ? "بيئة المحاكاة (Simulation)" : "Simulation"}
              </SelectItem>
              <SelectItem value="production">
                {isAr ? "بيئة الإنتاج (Production)" : "Production (Live)"}
              </SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Device Registration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{isAr ? "تسجيل الجهاز" : "Device Registration"}</CardTitle>
          <CardDescription>
            {isAr
              ? "سجّل جهازك لدى هيئة الزكاة والضريبة والجمارك للبدء بإصدار الفواتير الإلكترونية"
              : "Register your device with ZATCA to start issuing electronic invoices"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step 1: Compliance CSID */}
          <div className={`p-4 rounded-lg border ${zatcaStatus?.hasComplianceCsid ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' : 'bg-card'}`}>
            <h4 className="font-semibold flex items-center gap-2 mb-3">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
              {isAr ? "الحصول على شهادة الامتثال (Compliance CSID)" : "Get Compliance CSID"}
              {zatcaStatus?.hasComplianceCsid && <CheckCircle2 className="h-4 w-4 text-green-600" />}
            </h4>
            {!zatcaStatus?.hasComplianceCsid && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">{isAr ? "رمز OTP" : "OTP Code"}</label>
                  <Input
                    placeholder={isAr ? "أدخل رمز OTP من ZATCA" : "Enter OTP from ZATCA"}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {isAr ? "ستحصل على رمز OTP من بوابة فاتورة" : "You'll get the OTP from the FATOORA portal"}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">{isAr ? "طلب توقيع الشهادة (CSR)" : "Certificate Signing Request (CSR)"}</label>
                  <textarea
                    placeholder={isAr ? "الصق محتوى CSR هنا" : "Paste CSR content here"}
                    value={csr}
                    onChange={(e) => setCsr(e.target.value)}
                    className="mt-1 w-full p-2 rounded-md border bg-background text-sm font-mono min-h-[80px]"
                  />
                </div>
                <Button
                  onClick={() => registerComplianceCsid.mutate()}
                  disabled={registerComplianceCsid.isPending || !otp || !csr}
                >
                  {registerComplianceCsid.isPending
                    ? (isAr ? "جاري التسجيل..." : "Registering...")
                    : (isAr ? "تسجيل" : "Register")}
                </Button>
              </div>
            )}
          </div>

          {/* Step 2: Compliance Check */}
          <div className={`p-4 rounded-lg border ${zatcaStatus?.hasComplianceCsid && !zatcaStatus?.hasProductionCsid ? 'bg-card' : 'opacity-60'}`}>
            <h4 className="font-semibold flex items-center gap-2 mb-3">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
              {isAr ? "فحص الامتثال" : "Compliance Check"}
            </h4>
            {zatcaStatus?.hasComplianceCsid && !zatcaStatus?.hasProductionCsid && (
              <div>
                <p className="text-sm text-muted-foreground mb-3">
                  {isAr
                    ? "يتم إرسال فاتورة تجريبية للتأكد من امتثال النظام"
                    : "A test invoice will be sent to verify system compliance"}
                </p>
                <Button
                  onClick={() => runComplianceCheck.mutate()}
                  disabled={runComplianceCheck.isPending}
                  variant="outline"
                >
                  {runComplianceCheck.isPending
                    ? (isAr ? "جاري الفحص..." : "Checking...")
                    : (isAr ? "بدء الفحص" : "Run Check")}
                </Button>
              </div>
            )}
          </div>

          {/* Step 3: Production CSID */}
          <div className={`p-4 rounded-lg border ${zatcaStatus?.hasProductionCsid ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' : zatcaStatus?.hasComplianceCsid ? 'bg-card' : 'opacity-60'}`}>
            <h4 className="font-semibold flex items-center gap-2 mb-3">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
              {isAr ? "الحصول على شهادة الإنتاج (Production CSID)" : "Get Production CSID"}
              {zatcaStatus?.hasProductionCsid && <CheckCircle2 className="h-4 w-4 text-green-600" />}
            </h4>
            {zatcaStatus?.hasComplianceCsid && !zatcaStatus?.hasProductionCsid && (
              <div>
                <p className="text-sm text-muted-foreground mb-3">
                  {isAr
                    ? "الخطوة الأخيرة للحصول على شهادة الإنتاج وبدء إرسال الفواتير"
                    : "Final step to get the production certificate and start submitting invoices"}
                </p>
                <Button
                  onClick={() => getProductionCsid.mutate()}
                  disabled={getProductionCsid.isPending}
                >
                  {getProductionCsid.isPending
                    ? (isAr ? "جاري الحصول..." : "Getting...")
                    : (isAr ? "الحصول على شهادة الإنتاج" : "Get Production CSID")}
                </Button>
              </div>
            )}
            {zatcaStatus?.hasProductionCsid && (
              <p className="text-sm text-green-700 dark:text-green-300">
                {isAr ? "جهازك مسجل وجاهز لإرسال الفواتير" : "Your device is registered and ready to submit invoices"}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Requirements Checklist */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{isAr ? "متطلبات الفوترة الإلكترونية" : "E-Invoicing Requirements"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { key: "vatNumber", labelAr: "رقم ضريبي (VAT)", labelEn: "VAT Number", done: zatcaStatus?.hasVatNumber },
              { key: "tax", labelAr: "تفعيل الضريبة (15%)", labelEn: "Tax Enabled (15%)", done: zatcaStatus?.taxEnabled },
              { key: "config", labelAr: "الإعدادات الكاملة (عنوان، رقم مبنى، رمز بريدي)", labelEn: "Full Config (address, building no, postal)", done: zatcaStatus?.isFullyConfigured },
              { key: "csid", labelAr: "شهادة الإنتاج CSID", labelEn: "Production CSID", done: zatcaStatus?.hasProductionCsid },
            ].map((item) => (
              <div key={item.key} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50">
                {item.done ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                )}
                <span className={`text-sm ${item.done ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300'}`}>
                  {isAr ? item.labelAr : item.labelEn}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

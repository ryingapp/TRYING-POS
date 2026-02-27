import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Trash2, Truck, Power, PowerOff, Settings, Save, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/lib/i18n";
import { useBranch } from "@/lib/branch";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { DeliveryIntegration, Branch } from "@shared/schema";

const PLATFORM_INFO: Record<string, { name: string; nameAr: string; color: string; logo: string }> = {
  hungerstation: { name: "HungerStation", nameAr: "هنقرستيشن", color: "bg-orange-500", logo: "/platforms/hungerstation.png" },
  jahez: { name: "Jahez", nameAr: "جاهز", color: "bg-purple-500", logo: "/platforms/jahez.png" },
  keeta: { name: "Keeta", nameAr: "كيتا", color: "bg-green-500", logo: "/platforms/keeta.png" },
  ninja: { name: "Ninja", nameAr: "نينجا", color: "bg-red-500", logo: "/platforms/ninja.png" },
};

interface IntegrationFormData {
  platform: string;
  branchId: string;
  chainId: string;
  vendorId: string;
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
  autoAccept: boolean;
}

const EMPTY_FORM: IntegrationFormData = {
  platform: "hungerstation",
  branchId: "",
  chainId: "",
  vendorId: "",
  clientId: "",
  clientSecret: "",
  webhookSecret: "",
  autoAccept: false,
};

export default function DeliverySettingsPage() {
  const { toast } = useToast();
  const { direction } = useLanguage();
  const { selectedBranch } = useBranch();
  const isRtl = direction === "rtl";

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState<IntegrationFormData>(EMPTY_FORM);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [closeDialogId, setCloseDialogId] = useState<string | null>(null);
  const [closeReason, setCloseReason] = useState("CLOSED");
  const [closeUntil, setCloseUntil] = useState("");

  // Fetch integrations — filtered by selected branch
  const selectedBranchId = selectedBranch?.id;
  const { data: integrations = [], isLoading } = useQuery<DeliveryIntegration[]>({
    queryKey: ["/api/delivery/integrations", { branch: selectedBranchId }],
    queryFn: async () => {
      const url = selectedBranchId
        ? `/api/delivery/integrations?branchId=${selectedBranchId}`
        : "/api/delivery/integrations";
      const res = await apiRequest("GET", url);
      return res.json();
    },
  });

  // Fetch branches
  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: IntegrationFormData) => {
      const res = await apiRequest("POST", "/api/delivery/integrations", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/delivery/integrations") });
      setShowForm(false);
      setFormData(EMPTY_FORM);
      toast({ title: isRtl ? "تم الإضافة بنجاح" : "Integration added successfully" });
    },
    onError: (e: Error) => {
      toast({ title: isRtl ? "خطأ" : "Error", description: e.message, variant: "destructive" });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<IntegrationFormData> }) => {
      const res = await apiRequest("PUT", `/api/delivery/integrations/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/delivery/integrations") });
      setShowForm(false);
      setEditId(null);
      setFormData(EMPTY_FORM);
      toast({ title: isRtl ? "تم التحديث بنجاح" : "Integration updated successfully" });
    },
    onError: (e: Error) => {
      toast({ title: isRtl ? "خطأ" : "Error", description: e.message, variant: "destructive" });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/delivery/integrations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/delivery/integrations") });
      setDeleteId(null);
      toast({ title: isRtl ? "تم الحذف بنجاح" : "Integration deleted" });
    },
    onError: (e: Error) => {
      toast({ title: isRtl ? "خطأ" : "Error", description: e.message, variant: "destructive" });
    },
  });

  // Toggle status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, status, closed_reason, closed_until }: { id: string; status: string; closed_reason?: string; closed_until?: string }) => {
      const res = await apiRequest("PUT", `/api/delivery/integrations/${id}/status`, { status, closed_reason, closed_until });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/delivery/integrations") });
    },
    onError: (e: Error) => {
      toast({ title: isRtl ? "خطأ" : "Error", description: e.message, variant: "destructive" });
    },
  });

  // Test connection mutation
  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/delivery/integrations/${id}/test`);
      return res.json();
    },
    onSuccess: (result: any) => {
      if (result.success) {
        toast({ title: isRtl ? "الاتصال ناجح ✅" : "Connection successful ✅" });
      } else {
        toast({ title: isRtl ? "فشل الاتصال" : "Connection failed", description: result.message, variant: "destructive" });
      }
    },
    onError: (e: Error) => {
      toast({ title: isRtl ? "خطأ" : "Error", description: e.message, variant: "destructive" });
    },
  });

  // Toggle isActive
  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest("PUT", `/api/delivery/integrations/${id}`, { isActive });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/delivery/integrations") });
    },
  });

  // Sync menu mutation
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const syncMenuMutation = useMutation({
    mutationFn: async (id: string) => {
      setSyncingId(id);
      const res = await apiRequest("POST", `/api/delivery/integrations/${id}/sync-menu`);
      return res.json();
    },
    onSuccess: (result: any) => {
      setSyncingId(null);
      queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/delivery/integrations") });
      const synced = result.synced;
      const msg = synced?.categories
        ? `${synced.categories} categories, ${synced.products} products`
        : `${synced?.products || 0} products`;
      toast({
        title: isRtl ? `تم مزامنة المنيو ✅` : `Menu synced ✅`,
        description: msg,
      });
    },
    onError: (e: Error) => {
      setSyncingId(null);
      toast({ title: isRtl ? "خطأ" : "Error", description: e.message, variant: "destructive" });
    },
  });

  const handleEdit = (integration: DeliveryIntegration) => {
    setEditId(integration.id);
    setFormData({
      platform: integration.platform,
      branchId: integration.branchId || "",
      chainId: integration.chainId || "",
      vendorId: integration.vendorId || "",
      clientId: integration.clientId || "",
      clientSecret: (integration as any).clientSecret || "",
      webhookSecret: integration.webhookSecret || "",
      autoAccept: integration.autoAccept || false,
    });
    setShowForm(true);
  };

  const handleSubmit = () => {
    if (!formData.branchId) {
      toast({ title: isRtl ? "يجب اختيار فرع" : "Branch is required", variant: "destructive" });
      return;
    }
    if (editId) {
      updateMutation.mutate({ id: editId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const getBranchName = (branchId: string | null) => {
    if (!branchId) return isRtl ? "كل الفروع" : "All Branches";
    const branch = branches.find(b => b.id === branchId);
    return branch ? (isRtl ? branch.nameAr || branch.name : branch.name) : branchId;
  };

  const getWebhookUrl = (platform: string) => {
    const base = typeof window !== 'undefined' ? window.location.origin : '';
    if (platform === 'jahez') return `${base}/api/webhooks/jahez`;
    if (platform === 'hungerstation') return `${base}/api/webhooks/hungerstation`;
    return `${base}/api/webhooks/${platform}`;
  };
  const jahezWebhookUrl = getWebhookUrl('jahez');

  return (
    <div className="p-6 space-y-6" dir={direction}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {isRtl ? "منصات التوصيل" : "Delivery Platforms"}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isRtl 
              ? "إدارة ربط المطعم بمنصات التوصيل"
              : "Manage delivery platform connections"}
          </p>
        </div>
        <Button onClick={() => { setEditId(null); setFormData({ ...EMPTY_FORM, branchId: selectedBranchId || "" }); setShowForm(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          {isRtl ? "إضافة منصة" : "Add Platform"}
        </Button>
      </div>

      {/* Integrations List */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <Card key={i} className="animate-pulse">
              <div className="h-1.5 bg-muted rounded-t-lg" />
              <CardContent className="pt-5 pb-4 px-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-muted" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-muted rounded w-1/2" />
                    <div className="h-3 bg-muted rounded w-1/3" />
                  </div>
                </div>
                <div className="h-8 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : integrations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Truck className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {isRtl ? "لا توجد منصات مربوطة" : "No Platforms Connected"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {isRtl
                ? "اربط مطعمك بمنصات التوصيل مثل هنقرستيشن، جاهز، كيتا، أو نينجا"
                : "Connect your restaurant to delivery platforms like HungerStation, Jahez, Keeta, or Ninja"}
            </p>
            <Button onClick={() => { setEditId(null); setFormData({ ...EMPTY_FORM, branchId: selectedBranchId || "" }); setShowForm(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              {isRtl ? "إضافة منصة" : "Add Platform"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {integrations.map((integration) => {
            const info = PLATFORM_INFO[integration.platform] || { name: integration.platform, nameAr: integration.platform, color: "bg-gray-500", logo: "" };
            const isOpen = integration.outletStatus === "open";
            const active = integration.isActive || false;

            return (
              <Card key={integration.id} className={`relative transition-all duration-200 hover:shadow-lg border ${active ? 'border-border' : 'border-dashed border-muted opacity-50'}`}>
                {/* Top color bar */}
                <div className={`h-1 rounded-t-lg ${active ? (isOpen ? 'bg-green-500' : 'bg-orange-400') : 'bg-gray-300'}`} />

                <CardContent className="pt-5 pb-4 px-5">
                  {/* Platform header */}
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <img 
                        src={info.logo} 
                        alt={info.name} 
                        className="w-11 h-11 rounded-xl object-cover shadow-sm"
                        onError={(e) => {
                          const target = e.currentTarget;
                          target.style.display = 'none';
                          const fallback = document.createElement('div');
                          fallback.className = 'w-11 h-11 rounded-xl flex items-center justify-center text-white text-lg font-bold shadow-sm';
                          fallback.style.backgroundColor = integration.platform === 'hungerstation' ? '#FF5A00' : integration.platform === 'jahez' ? '#8BC34A' : integration.platform === 'keeta' ? '#FFD600' : '#E91E63';
                          fallback.textContent = info.name.charAt(0);
                          target.parentElement?.insertBefore(fallback, target);
                        }}
                      />
                      <div>
                        <h3 className="font-bold text-base">{isRtl ? info.nameAr : info.name}</h3>
                        <p className="text-xs text-muted-foreground">{getBranchName(integration.branchId)}</p>
                      </div>
                    </div>
                    {active && (
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${isOpen ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 ring-1 ring-green-200 dark:ring-green-800' : 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 ring-1 ring-orange-200 dark:ring-orange-800'}`}>
                        <span className={`w-2 h-2 rounded-full ${isOpen ? 'bg-green-500 animate-pulse' : 'bg-orange-500'}`} />
                        {isOpen ? (isRtl ? "مفتوح" : "Open") : (isRtl ? "مغلق" : "Closed")}
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  {active && (
                    <div className="flex gap-2 mb-4">
                      <Button
                        size="sm"
                        variant={isOpen ? "outline" : "default"}
                        className={`flex-1 h-9 ${!isOpen ? 'bg-green-600 hover:bg-green-700 text-white' : 'hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-950'}`}
                        onClick={() => {
                          if (isOpen && integration.platform === "hungerstation") {
                            setCloseDialogId(integration.id);
                            setCloseReason("CLOSED");
                            setCloseUntil("");
                          } else {
                            toggleStatusMutation.mutate({
                              id: integration.id,
                              status: isOpen ? "closed" : "open",
                            });
                          }
                        }}
                        disabled={toggleStatusMutation.isPending}
                      >
                        {isOpen ? <PowerOff className="h-3.5 w-3.5 me-1.5" /> : <Power className="h-3.5 w-3.5 me-1.5" />}
                        {isOpen ? (isRtl ? "إغلاق المتجر" : "Close Store") : (isRtl ? "فتح المتجر" : "Open Store")}
                      </Button>
                      {(integration.platform === "jahez" || integration.platform === "hungerstation") && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-9"
                          onClick={() => syncMenuMutation.mutate(integration.id)}
                          disabled={syncMenuMutation.isPending && syncingId === integration.id}
                        >
                          <RefreshCw className={`h-3.5 w-3.5 me-1.5 ${syncingId === integration.id ? 'animate-spin' : ''}`} />
                          {syncingId === integration.id
                            ? (isRtl ? "مزامنة..." : "Syncing...")
                            : (isRtl ? "مزامنة المنيو" : "Sync Menu")}
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Footer: toggle + settings + delete */}
                  <div className="flex items-center justify-between pt-3 border-t">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <Switch
                        checked={active}
                        onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: integration.id, isActive: checked })}
                      />
                      <span className={`text-xs font-medium ${active ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                        {active ? (isRtl ? "مفعّل" : "Active") : (isRtl ? "معطّل" : "Disabled")}
                      </span>
                    </label>
                    <div className="flex items-center gap-0.5">
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => handleEdit(integration)}>
                        <Settings className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteId(integration.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); setEditId(null); } }}>
        <DialogContent className="max-w-lg" dir={direction}>
          <DialogHeader>
            <DialogTitle>
              {editId
                ? (isRtl ? "تعديل التكامل" : "Edit Integration")
                : (isRtl ? "إضافة منصة جديدة" : "Add New Platform")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Platform */}
            <div className="space-y-2">
              <Label>{isRtl ? "المنصة" : "Platform"}</Label>
              <Select
                value={formData.platform}
                onValueChange={(v) => setFormData(prev => ({ ...prev, platform: v }))}
                disabled={!!editId}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hungerstation">🟠 HungerStation - هنقرستيشن</SelectItem>
                  <SelectItem value="jahez">🟣 Jahez - جاهز</SelectItem>
                  <SelectItem value="keeta">🟢 Keeta - كيتا</SelectItem>
                  <SelectItem value="ninja">🔴 Ninja - نينجا</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Branch */}
            <div className="space-y-2">
              <Label>{isRtl ? "الفرع" : "Branch"} <span className="text-destructive">*</span></Label>
              <Select
                value={formData.branchId || ""}
                onValueChange={(v) => setFormData(prev => ({ ...prev, branchId: v }))}
              >
                <SelectTrigger className={!formData.branchId ? 'border-destructive' : ''}>
                  <SelectValue placeholder={isRtl ? "اختر الفرع" : "Select branch"} />
                </SelectTrigger>
                <SelectContent>
                  {branches.map(b => (
                    <SelectItem key={b.id} value={b.id}>
                      {isRtl ? b.nameAr || b.name : b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!formData.branchId && (
                <p className="text-xs text-destructive">{isRtl ? "يجب اختيار فرع" : "Branch is required"}</p>
              )}
            </div>

            {/* Chain ID / API Base URL */}
            <div className="space-y-2">
              <Label>
                {formData.platform === 'jahez' 
                  ? (isRtl ? 'معرف السلسلة (اختياري)' : 'Chain ID (Optional)')
                  : `Chain ID ${isRtl ? '(معرف السلسلة)' : ''}`}
              </Label>
              <Input
                value={formData.chainId}
                onChange={(e) => setFormData(prev => ({ ...prev, chainId: e.target.value }))}
                placeholder={formData.platform === 'jahez'
                  ? (isRtl ? 'اختياري - معرف السلسلة' : 'Optional - chain identifier')
                  : (isRtl ? 'معرف السلسلة من المنصة' : 'Chain identifier from platform')}
                dir="ltr"
              />
            </div>

            {/* Vendor ID / Jahez Branch ID */}
            <div className="space-y-2">
              <Label>
                {formData.platform === 'jahez'
                  ? (isRtl ? 'معرف فرع جاهز (Branch ID)' : 'Jahez Branch ID')
                  : `Vendor ID ${isRtl ? '(معرف الفرع)' : ''}`}
              </Label>
              <Input
                value={formData.vendorId}
                onChange={(e) => setFormData(prev => ({ ...prev, vendorId: e.target.value }))}
                placeholder={formData.platform === 'jahez'
                  ? (isRtl ? 'معرف الفرع في جاهز' : 'Your Jahez branch_id')
                  : (isRtl ? 'معرف الفرع/المنفذ من المنصة' : 'Vendor/outlet ID from platform')}
                dir="ltr"
              />
            </div>

            {/* Client ID / Jahez API Base URL */}
            <div className="space-y-2">
              <Label>
                {formData.platform === 'jahez'
                  ? (isRtl ? 'رابط API جاهز (Base URL)' : 'Jahez API Base URL')
                  : 'Client ID'}
              </Label>
              <Input
                value={formData.clientId}
                onChange={(e) => setFormData(prev => ({ ...prev, clientId: e.target.value }))}
                placeholder={formData.platform === 'jahez'
                  ? 'https://partner-api.jahez.net'
                  : 'OAuth client_id'}
                dir="ltr"
              />
              {formData.platform === 'jahez' && (
                <p className="text-xs text-muted-foreground">
                  {isRtl ? 'رابط API الخاص بجاهز (يعطيك إياه فريق جاهز)' : 'Jahez Partner API base URL (provided by Jahez team)'}
                </p>
              )}
            </div>

            {/* Client Secret / Jahez API Token */}
            <div className="space-y-2">
              <Label>
                {formData.platform === 'jahez'
                  ? (isRtl ? 'توكن API جاهز (API Token)' : 'Jahez API Token')
                  : 'Client Secret'}
              </Label>
              <Input
                type="password"
                value={formData.clientSecret}
                onChange={(e) => setFormData(prev => ({ ...prev, clientSecret: e.target.value }))}
                placeholder={formData.platform === 'jahez'
                  ? (isRtl ? 'التوكن من جاهز' : 'Bearer token from Jahez')
                  : 'OAuth client_secret'}
                dir="ltr"
              />
            </div>

            {/* Webhook Secret */}
            <div className="space-y-2">
              <Label>Webhook Secret {isRtl ? '(اختياري)' : '(Optional)'}</Label>
              <Input
                type="password"
                value={formData.webhookSecret}
                onChange={(e) => setFormData(prev => ({ ...prev, webhookSecret: e.target.value }))}
                placeholder={isRtl ? 'للتحقق من صحة الطلبات الواردة' : 'For verifying incoming requests'}
                dir="ltr"
              />
            </div>

            {/* Jahez Webhook URL Info */}
            {formData.platform === 'jahez' && (
              <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 rounded-lg p-3">
                <p className="text-xs font-medium text-purple-900 dark:text-purple-100 mb-1">
                  {isRtl ? 'روابط Webhook لجاهز:' : 'Jahez Webhook URLs:'}
                </p>
                <code className="text-xs bg-purple-100 dark:bg-purple-900 px-2 py-0.5 rounded block mb-1 break-all select-all">
                  {isRtl ? 'إنشاء طلب: ' : 'Create Order: '}{jahezWebhookUrl}
                </code>
                <code className="text-xs bg-purple-100 dark:bg-purple-900 px-2 py-0.5 rounded block break-all select-all">
                  {isRtl ? 'تحديث طلب: ' : 'Order Update: '}{jahezWebhookUrl}/update
                </code>
              </div>
            )}

            {/* Auto Accept */}
            <div className="flex items-center justify-between">
              <div>
                <Label>{isRtl ? "قبول تلقائي للطلبات" : "Auto-Accept Orders"}</Label>
                <p className="text-xs text-muted-foreground">
                  {isRtl
                    ? "قبول الطلبات الواردة تلقائياً بدون تأكيد يدوي"
                    : "Automatically accept incoming orders without manual confirmation"}
                </p>
              </div>
              <Switch
                checked={formData.autoAccept}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, autoAccept: checked }))}
              />
            </div>
          </div>

          <DialogFooter className="flex-row gap-2 sm:justify-between">
            <div>
              {editId && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => editId && testMutation.mutate(editId)}
                  disabled={testMutation.isPending}
                >
                  {testMutation.isPending
                    ? (isRtl ? "جاري الاختبار..." : "Testing...")
                    : (isRtl ? "اختبار الاتصال" : "Test Connection")}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setShowForm(false); setEditId(null); }}>
                {isRtl ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                <Save className="h-4 w-4 mr-2" />
                {editId
                  ? (isRtl ? "تحديث" : "Update")
                  : (isRtl ? "إضافة" : "Add")}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent dir={direction}>
          <AlertDialogHeader>
            <AlertDialogTitle>{isRtl ? "حذف التكامل" : "Delete Integration"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isRtl
                ? "هل أنت متأكد من حذف هذا التكامل؟ لن يتم استقبال طلبات من هذه المنصة بعد الحذف."
                : "Are you sure you want to delete this integration? You will no longer receive orders from this platform."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isRtl ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              {isRtl ? "حذف" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* HungerStation Close Outlet Dialog */}
      <Dialog open={!!closeDialogId} onOpenChange={() => setCloseDialogId(null)}>
        <DialogContent dir={direction}>
          <DialogHeader>
            <DialogTitle>{isRtl ? "إغلاق الفرع" : "Close Outlet"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{isRtl ? "نوع الإغلاق" : "Close Type"}</Label>
              <Select value={closeUntil ? "CLOSED_UNTIL" : "CLOSED_TODAY"} onValueChange={(val) => {
                if (val === "CLOSED_TODAY") setCloseUntil("");
                else setCloseUntil(new Date(Date.now() + 3600000).toISOString().slice(0, 16));
              }}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLOSED_TODAY">{isRtl ? "مغلق اليوم كامل" : "Closed for today"}</SelectItem>
                  <SelectItem value="CLOSED_UNTIL">{isRtl ? "مغلق حتى وقت محدد" : "Closed until specific time"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {closeUntil && (
              <div>
                <Label>{isRtl ? "مفتوح عند" : "Reopen at"}</Label>
                <Input
                  type="datetime-local"
                  value={closeUntil}
                  onChange={(e) => setCloseUntil(e.target.value)}
                  className="mt-1"
                />
              </div>
            )}

            <div>
              <Label>{isRtl ? "سبب الإغلاق" : "Close Reason"}</Label>
              <Select value={closeReason} onValueChange={setCloseReason}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLOSED">{isRtl ? "مغلق" : "Closed"}</SelectItem>
                  <SelectItem value="TOO_BUSY_KITCHEN">{isRtl ? "المطبخ مشغول" : "Kitchen too busy"}</SelectItem>
                  <SelectItem value="TOO_BUSY_NO_DRIVERS">{isRtl ? "لا يوجد سائقين" : "No drivers available"}</SelectItem>
                  <SelectItem value="TECHNICAL_PROBLEM">{isRtl ? "مشكلة تقنية" : "Technical problem"}</SelectItem>
                  <SelectItem value="UPDATES_IN_MENU">{isRtl ? "تحديث المنيو" : "Menu updates"}</SelectItem>
                  <SelectItem value="BAD_WEATHER">{isRtl ? "طقس سيء" : "Bad weather"}</SelectItem>
                  <SelectItem value="HOLIDAY_SPECIAL_DAY">{isRtl ? "إجازة / يوم خاص" : "Holiday / Special day"}</SelectItem>
                  <SelectItem value="OTHER">{isRtl ? "أخرى" : "Other"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDialogId(null)}>
              {isRtl ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (closeDialogId) {
                  const status = closeUntil ? "CLOSED_UNTIL" : "CLOSED_TODAY";
                  toggleStatusMutation.mutate({
                    id: closeDialogId,
                    status,
                    closed_reason: closeReason,
                    closed_until: closeUntil ? new Date(closeUntil).toISOString() : undefined,
                  });
                  setCloseDialogId(null);
                }
              }}
              disabled={toggleStatusMutation.isPending}
            >
              <PowerOff className="h-4 w-4 mr-1" />
              {isRtl ? "إغلاق الفرع" : "Close Outlet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

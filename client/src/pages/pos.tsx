import { useState, useMemo, useCallback, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLanguage } from "@/lib/i18n";
import { useBranch } from "@/lib/branch";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { InvoiceModal } from "@/components/invoice-modal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, 
  Banknote, Smartphone, Apple, Building2, UtensilsCrossed,
  Car, Bike, X, Check, Receipt, Nfc, CheckCircle,
  Play, Square, Clock, Wallet, DollarSign, Users, CircleDollarSign, Printer
} from "lucide-react";
import type { MenuItem, Category, Table, Order, OrderItem, Invoice, DaySession, CashTransaction } from "@shared/schema";

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  notes?: string;
}

export default function POSPage() {
  const { t, getLocalizedName, direction, language } = useLanguage();
  const { toast } = useToast();
  const { selectedBranchId } = useBranch();
  
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<"dine_in" | "pickup" | "delivery">("dine_in");
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [kitchenNotes, setKitchenNotes] = useState("");
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [splitCashAmount, setSplitCashAmount] = useState(0);
  const [splitCardAmount, setSplitCardAmount] = useState(0);
  const [cashReceived, setCashReceived] = useState(0);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const phoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [autoPrintTriggered, setAutoPrintTriggered] = useState(false);
  const [settleDialogOpen, setSettleDialogOpen] = useState(false);
  const [settleTableId, setSettleTableId] = useState<string | null>(null);
  const [settleOrder, setSettleOrder] = useState<(Order & { items?: OrderItem[] }) | null>(null);
  const [settlePaymentMethod, setSettlePaymentMethod] = useState("cash");
  const [settleSplitCash, setSettleSplitCash] = useState(0);
  const [settleSplitCard, setSettleSplitCard] = useState(0);
  const [settleLoading, setSettleLoading] = useState(false);
  const [depositInfo, setDepositInfo] = useState<{ hasDeposit: boolean; depositAmount: string; reservationId: string; customerName: string } | null>(null);

  const handlePhoneChange = useCallback((phone: string) => {
    setCustomerPhone(phone);
    setDepositInfo(null);
    if (phoneTimerRef.current) clearTimeout(phoneTimerRef.current);
    const normalized = phone.replace(/\s/g, '');
    if (normalized.length >= 5) {
      phoneTimerRef.current = setTimeout(async () => {
        try {
          const authUser = localStorage.getItem("auth_user");
          const authHeaders: Record<string, string> = {};
          if (authUser) {
            try {
              const u = JSON.parse(authUser);
              if (u.id) authHeaders["X-User-Id"] = u.id;
              if (u.restaurantId) authHeaders["X-Restaurant-Id"] = u.restaurantId;
            } catch {}
          }
          const [customerRes, depositRes] = await Promise.all([
            fetch(`/api/customers/lookup/${encodeURIComponent(normalized)}`, {
              headers: authHeaders,
            }),
            fetch(`/api/reservations/check-deposit?phone=${encodeURIComponent(normalized)}`, {
              headers: authHeaders,
            })
          ]);
          if (customerRes.ok) {
            const customer = await customerRes.json();
            if (customer) {
              if (customer.name && !customerName) setCustomerName(customer.name);
              if (customer.address && !customerAddress) setCustomerAddress(customer.address);
              toast({
                title: direction === "rtl" ? "تم العثور على العميل" : "Customer found",
                description: customer.name || customer.phone,
              });
            }
          }
          if (depositRes.ok) {
            const depositData = await depositRes.json();
            if (depositData.hasDeposit) {
              setDepositInfo(depositData);
              const depositAmt = parseFloat(depositData.depositAmount || "20");
              setDiscount(depositAmt);
              toast({
                title: direction === "rtl" ? "تم العثور على رسوم حجز" : "Booking fee found",
                description: direction === "rtl" 
                  ? `سيتم خصم ${depositAmt} ريال من قيمة الطلب`
                  : `${depositAmt} SAR will be deducted from the order`,
              });
            }
          }
        } catch {}
      }, 500);
    }
  }, [customerName, customerAddress, direction, toast]);

  const [openDialogOpen, setOpenDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [closeSummaryOpen, setCloseSummaryOpen] = useState(false);
  const [closeSummaryData, setCloseSummaryData] = useState<any>(null);
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [openingBalance, setOpeningBalance] = useState("");
  const [closingBalance, setClosingBalance] = useState("");
  const [closeNotes, setCloseNotes] = useState("");
  const [paymentConfirmOpen, setPaymentConfirmOpen] = useState(false);
  const [transactionType, setTransactionType] = useState<"deposit" | "withdrawal">("deposit");
  const [transactionAmount, setTransactionAmount] = useState("");
  const [transactionReason, setTransactionReason] = useState("");

  const branchParam = selectedBranchId ? `?branch=${selectedBranchId}` : "";

  const { data: currentSession } = useQuery<DaySession | null>({
    queryKey: [`/api/day-sessions/current${branchParam}`],
  });

  const { data: allOrders } = useQuery<Order[]>({
    queryKey: [`/api/orders${branchParam}`],
  });

  const todayOrders = useMemo(() => {
    return allOrders?.filter(o => {
      const orderDate = new Date(o.createdAt!).toDateString();
      const today = new Date().toDateString();
      return orderDate === today && o.status !== "cancelled";
    }) || [];
  }, [allOrders]);

  const todaySales = useMemo(() => todayOrders.reduce((sum, o) => sum + parseFloat(o.total || "0"), 0), [todayOrders]);
  const cashSales = useMemo(() => todayOrders.filter(o => o.paymentMethod === "cash").reduce((sum, o) => sum + parseFloat(o.total || "0"), 0), [todayOrders]);
  const expectedBalance = parseFloat(currentSession?.openingBalance || "0") + cashSales;

  const formatCurrency = (amount: string | number | null | undefined) => {
    const num = parseFloat(String(amount || 0));
    return `${num.toFixed(2)} ${language === "ar" ? "ريال" : "SAR"}`;
  };

  const openSessionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/day-sessions/open${branchParam}`, {
        openingBalance: openingBalance || "0",
        date: new Date().toISOString().split("T")[0],
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/day-sessions") });
      toast({ title: language === "ar" ? "تم بدء اليوم بنجاح" : "Day started successfully" });
      setOpenDialogOpen(false);
      setOpeningBalance("");
    },
    onError: (error: any) => {
      toast({ 
        title: language === "ar" ? "خطأ" : "Error", 
        description: error?.message || (language === "ar" ? "فشل في بدء اليوم" : "Failed to start day"),
        variant: "destructive" 
      });
    },
  });

  const closeSessionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/day-sessions/${currentSession?.id}/close`, {
        closingBalance,
        notes: closeNotes,
      });
      return res.json();
    },
    onSuccess: () => {
      const splitSales = todayOrders.filter(o => o.paymentMethod === "split").reduce((sum, o) => sum + parseFloat(o.total || "0"), 0);
      const tapSales = todayOrders.filter(o => o.paymentMethod === "tap_to_pay").reduce((sum, o) => sum + parseFloat(o.total || "0"), 0);
      const cardMachineSales = todayOrders.filter(o => o.paymentMethod === "card_machine").reduce((sum, o) => sum + parseFloat(o.total || "0"), 0);
      const onlineSales = todayOrders.filter(o => o.paymentMethod === "edfapay_online" || o.paymentMethod === "mobile_pay").reduce((sum, o) => sum + parseFloat(o.total || "0"), 0);
      const dineInOrders = todayOrders.filter(o => o.orderType === "dine_in");
      const pickupOrders = todayOrders.filter(o => o.orderType === "pickup");
      const deliveryOrders = todayOrders.filter(o => o.orderType === "delivery");
      const totalDiscount = todayOrders.reduce((sum, o) => sum + parseFloat(o.discount || "0"), 0);
      const totalTax = todayOrders.reduce((sum, o) => sum + parseFloat(o.tax || "0"), 0);
      const paidOrders = todayOrders.filter(o => o.isPaid);
      const unpaidOrders = todayOrders.filter(o => !o.isPaid);
      const cancelledOrders = allOrders?.filter(o => {
        const orderDate = new Date(o.createdAt!).toDateString();
        const today = new Date().toDateString();
        return orderDate === today && o.status === "cancelled";
      }) || [];
      const summaryData = {
        openingBalance: currentSession?.openingBalance || "0",
        closingBalance,
        totalSales: todaySales,
        cashSales,
        cardSales: tapSales + cardMachineSales,
        splitSales,
        onlineSales,
        totalOrders: todayOrders.length,
        dineInCount: dineInOrders.length,
        dineInSales: dineInOrders.reduce((sum, o) => sum + parseFloat(o.total || "0"), 0),
        pickupCount: pickupOrders.length,
        pickupSales: pickupOrders.reduce((sum, o) => sum + parseFloat(o.total || "0"), 0),
        deliveryCount: deliveryOrders.length,
        deliverySales: deliveryOrders.reduce((sum, o) => sum + parseFloat(o.total || "0"), 0),
        totalDiscount,
        totalTax,
        paidCount: paidOrders.length,
        unpaidCount: unpaidOrders.length,
        unpaidTotal: unpaidOrders.reduce((sum, o) => sum + parseFloat(o.total || "0"), 0),
        cancelledCount: cancelledOrders.length,
        expectedBalance,
        difference: parseFloat(closingBalance) - expectedBalance,
        notes: closeNotes,
        date: new Date().toLocaleDateString(language === "ar" ? "ar-SA" : "en-US", { year: "numeric", month: "long", day: "numeric" }),
      };
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/day-sessions") });
      setCloseDialogOpen(false);
      setClosingBalance("");
      setCloseNotes("");
      setCloseSummaryData(summaryData);
      setCloseSummaryOpen(true);
    },
    onError: (error: any) => {
      toast({ 
        title: language === "ar" ? "خطأ" : "Error", 
        description: error?.message,
        variant: "destructive" 
      });
    },
  });

  const addTransactionMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/day-sessions/${currentSession?.id}/transactions`, {
        type: transactionType,
        amount: transactionAmount,
        reason: transactionReason,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/day-sessions", currentSession?.id, "transactions"] });
      toast({ title: language === "ar" ? "تم إضافة العملية" : "Transaction added" });
      setTransactionDialogOpen(false);
      setTransactionAmount("");
      setTransactionReason("");
    },
    onError: (error: any) => {
      toast({ 
        title: language === "ar" ? "خطأ" : "Error", 
        description: error?.message,
        variant: "destructive" 
      });
    },
  });

  const { data: menuItems, isLoading: loadingItems } = useQuery<MenuItem[]>({
    queryKey: ["/api/menu-items"],
  });

  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: tables } = useQuery<Table[]>({
    queryKey: [`/api/tables${branchParam}`],
  });

  const availableTables = useMemo(() => 
    tables?.filter(t => t.status === "available") || [], 
    [tables]
  );

  const occupiedTables = useMemo(() => 
    tables?.filter(t => t.status === "occupied") || [], 
    [tables]
  );

  const isDineInWithTable = orderType === "dine_in" && selectedTable && selectedTable !== "none";

  const handleOpenSettle = async (tableId: string) => {
    setSettleTableId(tableId);
    setSettlePaymentMethod("cash");
    setSettleSplitCash(0);
    setSettleSplitCard(0);
    setSettleLoading(true);
    setSettleDialogOpen(true);
    try {
      const res = await fetch(`/api/tables/${tableId}/active-order`, {
        headers: { "x-user-id": localStorage.getItem("userId") || "" },
      });
      if (res.ok) {
        const data = await res.json();
        setSettleOrder(data);
      } else {
        setSettleOrder(null);
      }
    } catch {
      setSettleOrder(null);
    }
    setSettleLoading(false);
  };

  const handleSettleTable = async () => {
    if (!settleTableId || !settleOrder) return;
    const settleTotal = parseFloat(settleOrder.total || "0");
    if (settlePaymentMethod === "split") {
      if (Math.abs(settleSplitCash + settleSplitCard - settleTotal) > 0.01) {
        toast({
          title: language === "ar" ? "خطأ في المبلغ" : "Amount Error",
          description: language === "ar" ? "مجموع الكاش والشبكة يجب أن يساوي المبلغ الإجمالي" : "Cash and card amounts must equal the total",
          variant: "destructive",
        });
        return;
      }
    }
    setSettleLoading(true);
    try {
      await apiRequest("POST", `/api/tables/${settleTableId}/settle`, {
        paymentMethod: settlePaymentMethod,
        splitCashAmount: settleSplitCash.toFixed(2),
        splitCardAmount: settleSplitCard.toFixed(2),
      });
      if (settlePaymentMethod === "cash" || settlePaymentMethod === "split") {
        sendCashDrawerCommand();
      }
      setLastOrderId(settleOrder.id);
      setAutoPrintTriggered(true);
      setShowInvoice(true);
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/orders") });
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/tables") });
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/invoices") });
      toast({
        title: language === "ar" ? "تم تحصيل الحساب" : "Table Settled",
        description: language === "ar" ? `تم الدفع: ${settleTotal.toFixed(2)} ريال` : `Paid: ${settleTotal.toFixed(2)} SAR`,
      });
      setSettleDialogOpen(false);
      setSettleOrder(null);
    } catch (error) {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: language === "ar" ? "فشل في تحصيل الحساب" : "Failed to settle table",
        variant: "destructive",
      });
    }
    setSettleLoading(false);
  };

  const filteredItems = useMemo(() => {
    if (!menuItems) return [];
    return menuItems.filter(item => {
      const matchesSearch = search === "" || 
        item.nameEn.toLowerCase().includes(search.toLowerCase()) ||
        item.nameAr.includes(search);
      const matchesCategory = !selectedCategory || item.categoryId === selectedCategory;
      return matchesSearch && matchesCategory && item.isAvailable;
    });
  }, [menuItems, search, selectedCategory]);

  const { data: restaurant } = useQuery<any>({
    queryKey: ["/api/restaurant"],
  });
  const isTaxEnabled = restaurant?.taxEnabled !== false;
  const taxRate = isTaxEnabled ? 0.15 : 0;
  const deliveryFee = orderType === "delivery" ? 15 : 0;
  
  const subtotal = cart.reduce((sum, item) => 
    sum + (parseFloat(item.menuItem.price) * item.quantity), 0
  );
  const discountAmount = discount;
  const taxableAmount = subtotal - discountAmount;
  const tax = taxableAmount * taxRate;
  const total = taxableAmount + tax + deliveryFee;

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.menuItem.id === item.id);
      if (existing) {
        return prev.map(c => 
          c.menuItem.id === item.id 
            ? { ...c, quantity: c.quantity + 1 }
            : c
        );
      }
      return [...prev, { menuItem: item, quantity: 1 }];
    });
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart(prev => {
      return prev.map(c => {
        if (c.menuItem.id === itemId) {
          const newQty = c.quantity + delta;
          return newQty > 0 ? { ...c, quantity: newQty } : c;
        }
        return c;
      }).filter(c => c.quantity > 0);
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(c => c.menuItem.id !== itemId));
  };

  const sendCashDrawerCommand = () => {
    try {
      const drawerKickCommand = new Uint8Array([27, 112, 0, 25, 250]);
      const blob = new Blob([drawerKickCommand]);
      const url = URL.createObjectURL(blob);
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = url;
      document.body.appendChild(iframe);
      setTimeout(() => {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (e) {}
  };

  const clearCart = () => {
    setCart([]);
    setDiscount(0);
    setNotes("");
    setKitchenNotes("");
    setCustomerName("");
    setCustomerPhone("");
    setCashReceived(0);
    setCustomerAddress("");
    setSelectedTable(null);
    setShowCheckout(false);
    setSplitCashAmount(0);
    setSplitCardAmount(0);
  };

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      const orderNumber = `ORD-${Date.now().toString().slice(-6)}`;
      const orderData = {
        orderNumber,
        orderType,
        tableId: orderType === "dine_in" && selectedTable && selectedTable !== "none" ? selectedTable : null,
        branchId: selectedBranchId || null,
        customerName: customerName || null,
        customerPhone: customerPhone || null,
        customerAddress: orderType === "delivery" ? customerAddress : null,
        kitchenNotes: kitchenNotes || null,
        subtotal: subtotal.toFixed(2),
        discount: discountAmount.toFixed(2),
        deliveryFee: deliveryFee.toFixed(2),
        tax: tax.toFixed(2),
        total: total.toFixed(2),
        paymentMethod: isDineInWithTable ? "pending" : paymentMethod,
        isPaid: isDineInWithTable ? false : true,
        status: "pending",
        notes: isDineInWithTable 
          ? (notes || null)
          : (paymentMethod === "split" 
            ? `${notes || ""}${notes ? " | " : ""}${t("cashAmount")}: ${splitCashAmount.toFixed(2)} ${t("sar")} - ${t("cardAmount")}: ${splitCardAmount.toFixed(2)} ${t("sar")}`.trim()
            : (notes || null)),
      };
      
      const orderRes = await apiRequest("POST", "/api/orders", orderData);
      const order = await orderRes.json() as Order;
      
      for (const cartItem of cart) {
        await apiRequest("POST", `/api/orders/${order.id}/items`, {
          menuItemId: cartItem.menuItem.id,
          quantity: cartItem.quantity,
          unitPrice: cartItem.menuItem.price,
          totalPrice: (parseFloat(cartItem.menuItem.price) * cartItem.quantity).toFixed(2),
          notes: cartItem.notes || null,
        });
      }
      
      const effectivePaymentMethod = isDineInWithTable ? "pending" : paymentMethod;
      const invoiceData = {
        orderId: order.id,
        subtotal: subtotal.toFixed(2),
        discount: discountAmount.toFixed(2),
        deliveryFee: deliveryFee.toFixed(2),
        customerName: customerName || null,
        customerPhone: customerPhone || null,
        paymentMethod: effectivePaymentMethod === "split" ? "split" : effectivePaymentMethod,
        isPaid: isDineInWithTable ? false : true,
        invoiceType: "simplified",
      };
      
      await apiRequest("POST", "/api/invoices", invoiceData);
      
      return order;
    },
    onSuccess: async (order) => {
      if (depositInfo?.hasDeposit && depositInfo.reservationId) {
        try {
          const authUser = localStorage.getItem("auth_user");
          const dHeaders: Record<string, string> = { "Content-Type": "application/json" };
          if (authUser) {
            try {
              const u = JSON.parse(authUser);
              if (u.id) dHeaders["X-User-Id"] = u.id;
              if (u.restaurantId) dHeaders["X-Restaurant-Id"] = u.restaurantId;
            } catch {}
          }
          await fetch(`/api/reservations/${depositInfo.reservationId}/deposit-applied`, {
            method: "PUT",
            headers: dHeaders,
            body: JSON.stringify({ orderId: order.id }),
          });
        } catch {}
        setDepositInfo(null);
      }
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/orders") });
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/tables") });
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/kitchen") });
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/invoices") });
      const wasDineInTable = order.orderType === "dine_in" && order.tableId;
      if (wasDineInTable) {
        toast({
          title: language === "ar" ? "تم إرسال الطلب للمطبخ" : "Order Sent to Kitchen",
          description: language === "ar" ? "سيتم الدفع عند انتهاء العميل" : "Payment will be collected when customer finishes",
        });
      } else {
        setLastOrderId(order.id);
        setAutoPrintTriggered(true);
        setShowInvoice(true);
        if (paymentMethod === "cash" || paymentMethod === "split") {
          sendCashDrawerCommand();
        }
        const changeAmount = cashReceived > 0 && cashReceived > total ? cashReceived - total : 0;
        toast({
          title: t("orderPlaced"),
          description: paymentMethod === "cash" && changeAmount > 0
            ? `${t("total")}: ${total.toFixed(2)} ${t("sar")} | ${t("changeToReturn")}: ${changeAmount.toFixed(2)} ${t("sar")}`
            : `${t("total")}: ${total.toFixed(2)} ${t("sar")}`,
        });
      }
      clearCart();
    },
    onError: (error) => {
      toast({
        title: language === "ar" ? "خطأ" : "Error",
        description: error instanceof Error ? error.message : (language === "ar" ? "فشل في إنشاء الطلب" : "Failed to place order"),
        variant: "destructive",
      });
    },
  });

  const handlePlaceOrder = () => {
    if (cart.length === 0) return;
    if (!currentSession || currentSession.status === "closed") {
      toast({
        title: language === "ar" ? "اليوم غير مفتوح" : "Day is not open",
        description: language === "ar" ? "يجب بدء اليوم أولاً قبل إنشاء الطلبات" : "You must start the day first before creating orders",
        variant: "destructive",
      });
      return;
    }
    if (orderType === "delivery" && !customerAddress) {
      toast({
        title: t("address"),
        description: language === "ar" ? "مطلوب للتوصيل" : "Required for delivery",
        variant: "destructive",
      });
      return;
    }
    if (isDineInWithTable) {
      createOrderMutation.mutate();
      return;
    }
    if (paymentMethod === "split") {
      const splitTotal = splitCashAmount + splitCardAmount;
      if (Math.abs(splitTotal - total) > 0.01) {
        toast({
          title: language === "ar" ? "خطأ في المبلغ" : "Amount Error",
          description: language === "ar" ? "مجموع الكاش والشبكة يجب أن يساوي المبلغ الإجمالي" : "Cash and card amounts must equal the total",
          variant: "destructive",
        });
        return;
      }
    }
    if (paymentMethod === "tap_to_pay" || paymentMethod === "card_machine") {
      setPaymentConfirmOpen(true);
      return;
    }
    createOrderMutation.mutate();
  };

  const handleConfirmPayment = () => {
    setPaymentConfirmOpen(false);
    createOrderMutation.mutate();
  };

  const paymentMethodOptions = [
    { id: "cash", icon: Banknote, label: t("cash") },
    { id: "tap_to_pay", icon: Nfc, label: t("tapToPay") },
    { id: "card_machine", icon: CreditCard, label: language === "ar" ? "جهاز شبكة" : "Card Machine" },
    { id: "split", icon: Wallet, label: t("splitPayment") },
  ];

  return (
    <div className="h-full flex flex-col" dir={direction}>
      <div className="flex items-center justify-between gap-4 px-4 pt-4 pb-2 border-b flex-wrap" data-testid="session-bar">
        <div className="flex items-center gap-3 flex-wrap">
          {currentSession && currentSession.status === "open" ? (
            <Badge variant="default" data-testid="badge-session-open" className="gap-1">
              <Clock className="h-3 w-3" />
              {language === "ar" ? "اليوم جاري" : "Day Active"}
            </Badge>
          ) : (
            <Badge variant="secondary" data-testid="badge-session-closed" className="gap-1">
              <Clock className="h-3 w-3" />
              {language === "ar" ? "اليوم لم يبدأ" : "Day Not Started"}
            </Badge>
          )}
          {currentSession && currentSession.status === "open" && (
            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1">
                <Wallet className="h-3 w-3" />
                {language === "ar" ? "افتتاحي" : "Opening"}: {formatCurrency(currentSession.openingBalance)}
              </span>
              <span className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                {language === "ar" ? "المبيعات" : "Sales"}: {formatCurrency(todaySales)}
              </span>
              <span data-testid="text-session-orders">
                {todayOrders.length} {language === "ar" ? "طلب" : "orders"}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!currentSession || currentSession.status !== "open" ? (
            <Button data-testid="button-open-day" size="sm" onClick={() => setOpenDialogOpen(true)} className="gap-1">
              <Play className="h-3.5 w-3.5" />
              {language === "ar" ? "بدأ اليوم" : "Start Day"}
            </Button>
          ) : (
            <>
              <Button data-testid="button-add-transaction" variant="outline" size="sm" onClick={() => setTransactionDialogOpen(true)} className="gap-1">
                <Plus className="h-3.5 w-3.5" />
                {language === "ar" ? "عملية صندوق" : "Cash Transaction"}
              </Button>
              <Button data-testid="button-close-day" variant="destructive" size="sm" onClick={() => setCloseDialogOpen(true)} className="gap-1">
                <Square className="h-3.5 w-3.5" />
                {language === "ar" ? "إنهاء اليوم" : "End Day"}
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 flex gap-4 p-4 overflow-hidden relative">
      {(!currentSession || currentSession.status === "closed") && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm" data-testid="overlay-day-closed">
          <Card className="max-w-md mx-auto text-center">
            <CardContent className="p-8 space-y-4">
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <Clock className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-bold">
                {language === "ar" ? "اليوم لم يبدأ بعد" : "Day Has Not Started"}
              </h2>
              <p className="text-muted-foreground">
                {language === "ar" 
                  ? "يجب بدء اليوم أولاً قبل إنشاء الطلبات. اضغط على زر بدأ اليوم للبدء."
                  : "You must start the day before creating orders. Click the Start Day button to begin."}
              </p>
              <Button data-testid="button-open-day-overlay" onClick={() => setOpenDialogOpen(true)} className="gap-2">
                <Play className="h-4 w-4" />
                {language === "ar" ? "بدأ اليوم" : "Start Day"}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
      <div className="flex-1 flex flex-col gap-4">
        <div className="flex gap-4 items-center flex-wrap">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              data-testid="input-pos-search"
              placeholder={t("searchMenu")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 flex-wrap">
          <Button
            data-testid="button-category-all"
            variant={selectedCategory === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(null)}
          >
            {t("allCategories")}
          </Button>
          {categories?.map((cat) => (
            <Button
              key={cat.id}
              data-testid={`button-category-${cat.id}`}
              variant={selectedCategory === cat.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(cat.id)}
            >
              {getLocalizedName(cat.nameEn, cat.nameAr)}
            </Button>
          ))}
        </div>

        {occupiedTables.length > 0 && (
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-semibold">
                {language === "ar" ? `طاولات مشغولة (${occupiedTables.length})` : `Occupied Tables (${occupiedTables.length})`}
              </span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {occupiedTables.map((table) => (
                <Button
                  key={table.id}
                  variant="outline"
                  size="sm"
                  className="border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950/30 hover:bg-orange-100 dark:hover:bg-orange-900/40 text-orange-700 dark:text-orange-300 whitespace-nowrap gap-1.5"
                  onClick={() => handleOpenSettle(table.id)}
                >
                  <CircleDollarSign className="h-3.5 w-3.5" />
                  {table.tableNumber}
                  <span className="text-xs">({language === "ar" ? "تحصيل" : "Settle"})</span>
                </Button>
              ))}
            </div>
          </div>
        )}

        {loadingItems ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 flex-1 overflow-auto">
            {filteredItems.map((item) => (
              <Card 
                key={item.id}
                data-testid={`card-menu-item-${item.id}`}
                className="cursor-pointer hover-elevate transition-all"
                onClick={() => addToCart(item)}
              >
                <CardContent className="p-3">
                  {item.image && (
                    <img 
                      src={item.image} 
                      alt={item.nameEn}
                      className="w-full h-24 object-cover rounded-md mb-2"
                    />
                  )}
                  <h3 className="font-medium text-sm line-clamp-1">
                    {getLocalizedName(item.nameEn, item.nameAr)}
                  </h3>
                  <p className="font-bold mt-1 text-orange-600 dark:text-orange-400">
                    {parseFloat(item.price).toFixed(2)} {t("sar")}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Card className="w-96 flex flex-col">
        <CardHeader className="pb-2 border-b">
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            {t("cart")} ({cart.length})
          </CardTitle>
        </CardHeader>
        
        {!showCheckout ? (
          <>
            <CardContent className="flex-1 overflow-auto p-4">
              {cart.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  {t("emptyCart")}
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={item.menuItem.id} className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {getLocalizedName(item.menuItem.nameEn, item.menuItem.nameAr)}
                        </p>
                        <p className="text-sm font-medium text-orange-600 dark:text-orange-400">
                          {(parseFloat(item.menuItem.price) * item.quantity).toFixed(2)} {t("sar")}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-wrap">
                        <Button
                          data-testid={`button-decrease-${item.menuItem.id}`}
                          size="icon"
                          variant="outline"
                          onClick={() => updateQuantity(item.menuItem.id, -1)}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                        <Button
                          data-testid={`button-increase-${item.menuItem.id}`}
                          size="icon"
                          variant="outline"
                          onClick={() => updateQuantity(item.menuItem.id, 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <Button
                          data-testid={`button-remove-${item.menuItem.id}`}
                          size="icon"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => removeFromCart(item.menuItem.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>

            <div className="p-4 border-t space-y-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>{t("subtotal")}</span>
                  <span>{subtotal.toFixed(2)} {t("sar")}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>{t("discount")}</span>
                    <span>-{discountAmount.toFixed(2)} {t("sar")}</span>
                  </div>
                )}
                <div className="flex justify-between text-muted-foreground">
                  <span>{t("tax")} (15%)</span>
                  <span>{tax.toFixed(2)} {t("sar")}</span>
                </div>
                {deliveryFee > 0 && (
                  <div className="flex justify-between">
                    <span>{t("deliveryFee")}</span>
                    <span>{deliveryFee.toFixed(2)} {t("sar")}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>{t("total")}</span>
                  <span className="text-orange-600 dark:text-orange-400">{total.toFixed(2)} {t("sar")}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  data-testid="button-clear-cart"
                  variant="outline"
                  className="flex-1"
                  onClick={clearCart}
                  disabled={cart.length === 0}
                >
                  <Trash2 className="h-4 w-4 me-2" />
                  {t("clearCart")}
                </Button>
                <Button
                  data-testid="button-checkout"
                  className="flex-1"
                  onClick={() => setShowCheckout(true)}
                  disabled={cart.length === 0}
                >
                  {t("checkout")}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <>
            <CardContent className="flex-1 overflow-auto p-4 space-y-4">
              <div className="space-y-2">
                <Label>{t("selectOrderType")}</Label>
                <div className="flex gap-2">
                  {[
                    { type: "dine_in", icon: UtensilsCrossed, label: t("dineIn") },
                    { type: "pickup", icon: Car, label: t("pickup") },
                    { type: "delivery", icon: Bike, label: t("delivery") },
                  ].map(({ type, icon: Icon, label }) => (
                    <Button
                      key={type}
                      data-testid={`button-order-type-${type}`}
                      variant={orderType === type ? "default" : "outline"}
                      className="flex-1 flex-col h-auto py-3"
                      onClick={() => setOrderType(type as any)}
                    >
                      <Icon className="h-5 w-5 mb-1" />
                      <span className="text-xs">{label}</span>
                    </Button>
                  ))}
                </div>
              </div>

              {orderType === "dine_in" && (
                <div className="space-y-2">
                  <Label>{t("selectTable")} <span className="text-muted-foreground text-xs">({language === "ar" ? "اختياري" : "optional"})</span></Label>
                  <Select value={selectedTable || "none"} onValueChange={(v) => setSelectedTable(v === "none" ? null : v)}>
                    <SelectTrigger data-testid="select-table">
                      <SelectValue placeholder={language === "ar" ? "اختر طاولة (اختياري)" : "Select table (optional)"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{language === "ar" ? "بدون طاولة" : "No table"}</SelectItem>
                      {availableTables.map((table) => (
                        <SelectItem key={table.id} value={table.id}>
                          {table.tableNumber} - {table.capacity} {t("guests")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label>{t("customerInfo")}</Label>
                <Input
                  data-testid="input-customer-name"
                  placeholder={t("customer")}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
                <Input
                  data-testid="input-customer-phone"
                  placeholder={t("phone")}
                  value={customerPhone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                />
                {orderType === "delivery" && (
                  <Textarea
                    data-testid="input-customer-address"
                    placeholder={t("address")}
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label>{t("notes")}</Label>
                <Textarea
                  data-testid="input-notes"
                  placeholder={t("notes")}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("kitchenNotes")}</Label>
                <Textarea
                  data-testid="input-kitchen-notes"
                  placeholder={t("kitchenNotes")}
                  value={kitchenNotes}
                  onChange={(e) => setKitchenNotes(e.target.value)}
                />
              </div>

              {depositInfo?.hasDeposit && (
                <div className="p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-sm font-medium text-green-700 dark:text-green-300 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" />
                    {language === "ar" ? "رسوم حجز مدفوعة" : "Booking Fee Paid"}
                  </p>
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                    {language === "ar" 
                      ? `سيتم خصم ${depositInfo.depositAmount} ريال من قيمة الطلب (${depositInfo.customerName})`
                      : `${depositInfo.depositAmount} SAR will be deducted from the order (${depositInfo.customerName})`}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>{t("discount")} ({t("sar")})</Label>
                <Input
                  data-testid="input-discount"
                  type="number"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                />
              </div>

              {isDineInWithTable ? (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {language === "ar" ? "الدفع لاحقاً - بعد انتهاء العميل" : "Pay Later - After customer finishes"}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    {language === "ar" 
                      ? "سيتم إرسال الطلب للمطبخ مباشرة. يمكنك تحصيل الحساب من قسم الطاولات المشغولة."
                      : "Order will be sent to kitchen directly. You can settle the bill from the occupied tables section."}
                  </p>
                </div>
              ) : (
              <>
              <div className="space-y-2">
                <Label>{t("paymentMethod")}</Label>
                <div className="grid grid-cols-4 gap-2">
                  {paymentMethodOptions.map(({ id, icon: Icon, label }) => (
                    <Button
                      key={id}
                      data-testid={`button-payment-${id}`}
                      variant={paymentMethod === id ? "default" : "outline"}
                      size="sm"
                      className="flex-col h-auto py-2"
                      onClick={() => setPaymentMethod(id)}
                    >
                      <Icon className="h-4 w-4 mb-1" />
                      <span className="text-xs">{label}</span>
                    </Button>
                  ))}
                </div>
              </div>

              {paymentMethod === "cash" && (
                <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                  <div>
                    <Label className="text-xs">{t("cashReceived")}</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={cashReceived || ""}
                      onChange={(e) => setCashReceived(parseFloat(e.target.value) || 0)}
                      placeholder={total.toFixed(2)}
                      className="text-lg font-bold"
                    />
                  </div>
                  {cashReceived > 0 && (
                    <div className={`flex justify-between items-center p-2 rounded-lg ${cashReceived >= total ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
                      <span className="font-medium text-sm">{t("changeToReturn")}:</span>
                      <span className={`text-lg font-bold ${cashReceived >= total ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {cashReceived >= total 
                          ? `${(cashReceived - total).toFixed(2)} ${t("sar")}`
                          : `${(total - cashReceived).toFixed(2)}- ${t("sar")}`
                        }
                      </span>
                    </div>
                  )}
                  <div className="flex gap-1 flex-wrap">
                    {[1, 5, 10, 20, 50, 100, 200, 500].map((amount) => (
                      <Button
                        key={amount}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs px-2 py-1 h-7"
                        onClick={() => setCashReceived(amount)}
                      >
                        {amount}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {paymentMethod === "split" && (
                <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                  {/* Quick split buttons */}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs h-8"
                      onClick={() => {
                        const half = parseFloat((total / 2).toFixed(2));
                        setSplitCashAmount(half);
                        setSplitCardAmount(parseFloat((total - half).toFixed(2)));
                      }}
                    >
                      50/50
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs h-8"
                      onClick={() => {
                        const amount = parseFloat((total * 0.25).toFixed(2));
                        setSplitCashAmount(amount);
                        setSplitCardAmount(parseFloat((total - amount).toFixed(2)));
                      }}
                    >
                      25/75
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs h-8"
                      onClick={() => {
                        const amount = parseFloat((total * 0.75).toFixed(2));
                        setSplitCashAmount(amount);
                        setSplitCardAmount(parseFloat((total - amount).toFixed(2)));
                      }}
                    >
                      75/25
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs flex items-center gap-1">
                        <Banknote className="h-3 w-3" />
                        {t("cashAmount")}
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        max={total}
                        step="0.01"
                        value={splitCashAmount || ""}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setSplitCashAmount(val);
                          setSplitCardAmount(Math.max(0, parseFloat((total - val).toFixed(2))));
                        }}
                        placeholder="0.00"
                        className="text-lg font-bold"
                      />
                    </div>
                    <div>
                      <Label className="text-xs flex items-center gap-1">
                        <CreditCard className="h-3 w-3" />
                        {t("cardAmount")}
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        max={total}
                        step="0.01"
                        value={splitCardAmount || ""}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setSplitCardAmount(val);
                          setSplitCashAmount(Math.max(0, parseFloat((total - val).toFixed(2))));
                        }}
                        placeholder="0.00"
                        className="text-lg font-bold"
                      />
                    </div>
                  </div>

                  {/* Visual split bar */}
                  {(splitCashAmount > 0 || splitCardAmount > 0) && (
                    <div className="space-y-1">
                      <div className="flex rounded-full overflow-hidden h-3">
                        <div 
                          className="bg-green-500 transition-all duration-300" 
                          style={{ width: `${Math.min(100, (splitCashAmount / total) * 100)}%` }} 
                        />
                        <div 
                          className="bg-blue-500 transition-all duration-300" 
                          style={{ width: `${Math.min(100, (splitCardAmount / total) * 100)}%` }} 
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                          {language === "ar" ? "كاش" : "Cash"}: {splitCashAmount.toFixed(2)}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                          {language === "ar" ? "شبكة" : "Card"}: {splitCardAmount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}

                  {splitCashAmount + splitCardAmount > 0 && Math.abs(splitCashAmount + splitCardAmount - total) > 0.01 && (
                    <div className="flex items-center gap-2 p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                      <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                        {language === "ar" ? "المتبقي" : "Remaining"}: {(total - splitCashAmount - splitCardAmount).toFixed(2)} {t("sar")}
                      </span>
                    </div>
                  )}
                  {splitCashAmount + splitCardAmount > 0 && Math.abs(splitCashAmount + splitCardAmount - total) <= 0.01 && (
                    <div className="flex items-center gap-2 p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                      <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                        {language === "ar" ? "المبلغ مكتمل" : "Amount complete"}
                      </span>
                    </div>
                  )}
                </div>
              )}
              </>
              )}
            </CardContent>

            <div className="p-4 border-t space-y-3">
              <div className="flex justify-between font-bold text-lg">
                <span>{t("total")}</span>
                <span className="text-orange-600 dark:text-orange-400">{total.toFixed(2)} {t("sar")}</span>
              </div>
              <div className="flex gap-2">
                <Button
                  data-testid="button-back-to-cart"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowCheckout(false)}
                >
                  <X className="h-4 w-4 me-2" />
                  {t("cancel")}
                </Button>
                <Button
                  data-testid="button-place-order"
                  className="flex-1"
                  onClick={handlePlaceOrder}
                  disabled={createOrderMutation.isPending}
                >
                  <Check className="h-4 w-4 me-2" />
                  {createOrderMutation.isPending ? "..." : (isDineInWithTable 
                    ? (language === "ar" ? "إرسال للمطبخ" : "Send to Kitchen") 
                    : t("placeOrder"))}
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      </div>

      <InvoiceModal
        open={showInvoice}
        onClose={() => { setShowInvoice(false); setAutoPrintTriggered(false); }}
        orderId={lastOrderId || undefined}
        autoPrint={autoPrintTriggered}
        onAutoPrintDone={() => setAutoPrintTriggered(false)}
      />

      <Dialog open={settleDialogOpen} onOpenChange={(open) => { if (!open) { setSettleDialogOpen(false); setSettleOrder(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CircleDollarSign className="h-5 w-5 text-orange-500" />
              {language === "ar" ? "تحصيل حساب الطاولة" : "Settle Table Bill"}
            </DialogTitle>
            <DialogDescription>
              {language === "ar" 
                ? "اختر طريقة الدفع لتحصيل الحساب وتحرير الطاولة"
                : "Choose payment method to settle the bill and free the table"}
            </DialogDescription>
          </DialogHeader>
          {settleLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              {language === "ar" ? "جاري التحميل..." : "Loading..."}
            </div>
          ) : !settleOrder ? (
            <div className="py-8 text-center text-muted-foreground">
              {language === "ar" ? "لا يوجد طلب نشط لهذه الطاولة" : "No active order for this table"}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{language === "ar" ? "رقم الطلب" : "Order #"}</span>
                  <span className="font-mono">{settleOrder.orderNumber}</span>
                </div>
                {settleOrder.customerName && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{language === "ar" ? "العميل" : "Customer"}</span>
                    <span>{settleOrder.customerName}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{language === "ar" ? "الحالة" : "Status"}</span>
                  <Badge variant={settleOrder.status === "ready" ? "default" : "secondary"}>
                    {settleOrder.status === "pending" ? (language === "ar" ? "قيد الانتظار" : "Pending") :
                     settleOrder.status === "preparing" ? (language === "ar" ? "قيد التحضير" : "Preparing") :
                     settleOrder.status === "ready" ? (language === "ar" ? "جاهز" : "Ready") :
                     settleOrder.status}
                  </Badge>
                </div>
              </div>

              {settleOrder.items && settleOrder.items.length > 0 && (
                <div className="space-y-1 max-h-40 overflow-auto">
                  {settleOrder.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm py-1 border-b last:border-0">
                      <span>{item.quantity}x {language === "ar" ? (item.nameAr || item.nameEn) : (item.nameEn || item.nameAr)}</span>
                      <span>{parseFloat(item.totalPrice || "0").toFixed(2)} {language === "ar" ? "ريال" : "SAR"}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t pt-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{language === "ar" ? "المجموع الفرعي" : "Subtotal"}</span>
                  <span>{parseFloat(settleOrder.subtotal || "0").toFixed(2)}</span>
                </div>
                {parseFloat(settleOrder.discount || "0") > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>{language === "ar" ? "الخصم" : "Discount"}</span>
                    <span>-{parseFloat(settleOrder.discount || "0").toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{language === "ar" ? "الضريبة" : "Tax"} (15%)</span>
                  <span>{parseFloat(settleOrder.tax || "0").toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>{language === "ar" ? "الإجمالي" : "Total"}</span>
                  <span className="text-orange-600 dark:text-orange-400">{parseFloat(settleOrder.total || "0").toFixed(2)} {language === "ar" ? "ريال" : "SAR"}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{language === "ar" ? "طريقة الدفع" : "Payment Method"}</Label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: "cash", icon: Banknote, label: language === "ar" ? "كاش" : "Cash" },
                    { id: "tap_to_pay", icon: Nfc, label: language === "ar" ? "شبكة" : "Card" },
                    { id: "card_machine", icon: CreditCard, label: language === "ar" ? "جهاز شبكة" : "Card Machine" },
                    { id: "split", icon: Wallet, label: language === "ar" ? "تقسيم" : "Split" },
                  ].map(({ id, icon: Icon, label }) => (
                    <Button
                      key={id}
                      variant={settlePaymentMethod === id ? "default" : "outline"}
                      size="sm"
                      className="flex-col h-auto py-2"
                      onClick={() => setSettlePaymentMethod(id)}
                    >
                      <Icon className="h-4 w-4 mb-1" />
                      <span className="text-xs">{label}</span>
                    </Button>
                  ))}
                </div>
              </div>

              {settlePaymentMethod === "split" && (
                <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                  {/* Quick split buttons */}
                  <div className="flex gap-2">
                    {[
                      { label: "50/50", cash: 0.5 },
                      { label: "25/75", cash: 0.25 },
                      { label: "75/25", cash: 0.75 },
                    ].map(({ label, cash }) => (
                      <Button
                        key={label}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1 text-xs h-8"
                        onClick={() => {
                          const stTotal = parseFloat(settleOrder.total || "0");
                          const cashAmt = parseFloat((stTotal * cash).toFixed(2));
                          setSettleSplitCash(cashAmt);
                          setSettleSplitCard(parseFloat((stTotal - cashAmt).toFixed(2)));
                        }}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs flex items-center gap-1">
                        <Banknote className="h-3 w-3" />
                        {language === "ar" ? "مبلغ الكاش" : "Cash Amount"}
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={settleSplitCash || ""}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setSettleSplitCash(val);
                          setSettleSplitCard(Math.max(0, parseFloat((parseFloat(settleOrder.total || "0") - val).toFixed(2))));
                        }}
                        placeholder="0.00"
                        className="text-lg font-bold"
                      />
                    </div>
                    <div>
                      <Label className="text-xs flex items-center gap-1">
                        <CreditCard className="h-3 w-3" />
                        {language === "ar" ? "مبلغ الشبكة" : "Card Amount"}
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={settleSplitCard || ""}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setSettleSplitCard(val);
                          setSettleSplitCash(Math.max(0, parseFloat((parseFloat(settleOrder.total || "0") - val).toFixed(2))));
                        }}
                        placeholder="0.00"
                        className="text-lg font-bold"
                      />
                    </div>
                  </div>
                  {/* Visual split bar */}
                  {(settleSplitCash > 0 || settleSplitCard > 0) && (
                    <div className="space-y-1">
                      <div className="flex rounded-full overflow-hidden h-3">
                        <div className="bg-green-500 transition-all duration-300" style={{ width: `${Math.min(100, (settleSplitCash / parseFloat(settleOrder.total || "1")) * 100)}%` }} />
                        <div className="bg-blue-500 transition-all duration-300" style={{ width: `${Math.min(100, (settleSplitCard / parseFloat(settleOrder.total || "1")) * 100)}%` }} />
                      </div>
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                          {language === "ar" ? "كاش" : "Cash"}: {settleSplitCash.toFixed(2)}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                          {language === "ar" ? "شبكة" : "Card"}: {settleSplitCard.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}
                  {(() => {
                    const stTotal = parseFloat(settleOrder.total || "0");
                    const splitSum = settleSplitCash + settleSplitCard;
                    if (splitSum > 0 && Math.abs(splitSum - stTotal) > 0.01) {
                      return (
                        <div className="flex items-center gap-2 p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                          <span className="text-xs text-red-600 dark:text-red-400 font-medium">
                            {language === "ar" ? "المتبقي" : "Remaining"}: {(stTotal - splitSum).toFixed(2)} {language === "ar" ? "ريال" : "SAR"}
                          </span>
                        </div>
                      );
                    }
                    if (splitSum > 0 && Math.abs(splitSum - stTotal) <= 0.01) {
                      return (
                        <div className="flex items-center gap-2 p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                            {language === "ar" ? "المبلغ مكتمل" : "Amount complete"}
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSettleDialogOpen(false); setSettleOrder(null); }}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button 
              onClick={handleSettleTable} 
              disabled={settleLoading || !settleOrder}
              className="gap-2"
            >
              <Check className="h-4 w-4" />
              {settleLoading ? "..." : (language === "ar" ? "تحصيل الحساب" : "Settle Bill")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openDialogOpen} onOpenChange={setOpenDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "بدأ اليوم" : "Start Day"}</DialogTitle>
            <DialogDescription>
              {language === "ar" 
                ? "أدخل الرصيد الافتتاحي للصندوق" 
                : "Enter the opening cash drawer balance"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{language === "ar" ? "الرصيد الافتتاحي" : "Opening Balance"}</Label>
              <Input
                data-testid="input-opening-balance"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button data-testid="button-cancel-open-day" variant="outline" onClick={() => setOpenDialogOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button data-testid="button-confirm-open-day" onClick={() => openSessionMutation.mutate()} disabled={openSessionMutation.isPending}>
              {language === "ar" ? "بدأ اليوم" : "Start Day"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "إنهاء اليوم" : "End Day"}</DialogTitle>
            <DialogDescription>
              {language === "ar" 
                ? "عد النقود في الصندوق وأدخل المبلغ الفعلي" 
                : "Count the cash in the drawer and enter the actual amount"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg space-y-2">
              <div className="flex justify-between">
                <span>{language === "ar" ? "الرصيد الافتتاحي" : "Opening Balance"}</span>
                <span>{formatCurrency(currentSession?.openingBalance)}</span>
              </div>
              <div className="flex justify-between">
                <span>{language === "ar" ? "المبيعات النقدية" : "Cash Sales"}</span>
                <span className="text-green-600">+{formatCurrency(cashSales)}</span>
              </div>
              <div className="flex justify-between font-bold border-t pt-2">
                <span>{language === "ar" ? "الرصيد المتوقع" : "Expected Balance"}</span>
                <span>{formatCurrency(expectedBalance)}</span>
              </div>
            </div>
            <div>
              <Label>{language === "ar" ? "الرصيد الفعلي" : "Actual Balance"}</Label>
              <Input
                data-testid="input-closing-balance"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={closingBalance}
                onChange={(e) => setClosingBalance(e.target.value)}
              />
              {closingBalance && (
                <p className={`text-sm mt-1 ${
                  parseFloat(closingBalance) === expectedBalance ? "text-green-600" : "text-orange-600"
                }`}>
                  {language === "ar" ? "الفرق" : "Difference"}: {formatCurrency(parseFloat(closingBalance) - expectedBalance)}
                </p>
              )}
            </div>
            <div>
              <Label>{language === "ar" ? "ملاحظات" : "Notes"}</Label>
              <Textarea
                data-testid="input-close-notes"
                placeholder={language === "ar" ? "أي ملاحظات إضافية..." : "Any additional notes..."}
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button data-testid="button-cancel-close-day" variant="outline" onClick={() => setCloseDialogOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button 
              data-testid="button-confirm-close-day"
              variant="destructive" 
              onClick={() => closeSessionMutation.mutate()} 
              disabled={closeSessionMutation.isPending || !closingBalance}
            >
              {language === "ar" ? "إنهاء اليوم" : "End Day"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={transactionDialogOpen} onOpenChange={setTransactionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "ar" ? "إضافة عملية صندوق" : "Add Cash Transaction"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{language === "ar" ? "نوع العملية" : "Transaction Type"}</Label>
              <Select value={transactionType} onValueChange={(v: any) => setTransactionType(v)}>
                <SelectTrigger data-testid="select-transaction-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deposit">{language === "ar" ? "إيداع" : "Deposit"}</SelectItem>
                  <SelectItem value="withdrawal">{language === "ar" ? "سحب" : "Withdrawal"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{language === "ar" ? "المبلغ" : "Amount"}</Label>
              <Input
                data-testid="input-transaction-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={transactionAmount}
                onChange={(e) => setTransactionAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>{language === "ar" ? "السبب" : "Reason"}</Label>
              <Input
                data-testid="input-transaction-reason"
                placeholder={language === "ar" ? "سبب العملية..." : "Reason for transaction..."}
                value={transactionReason}
                onChange={(e) => setTransactionReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button data-testid="button-cancel-transaction" variant="outline" onClick={() => setTransactionDialogOpen(false)}>
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
            <Button 
              data-testid="button-confirm-transaction"
              onClick={() => addTransactionMutation.mutate()} 
              disabled={addTransactionMutation.isPending || !transactionAmount}
            >
              {language === "ar" ? "إضافة" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {paymentConfirmOpen && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background" data-testid="screen-payment-customer">
          <div className="flex-1 flex flex-col items-center justify-center w-full max-w-lg px-8 text-center space-y-8">
            <div className="w-28 h-28 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              {paymentMethod === "card_machine" 
                ? <CreditCard className="h-14 w-14 text-orange-600 dark:text-orange-400 animate-pulse" />
                : <Nfc className="h-14 w-14 text-orange-600 dark:text-orange-400 animate-pulse" />
              }
            </div>
            <div>
              <p className="text-lg text-muted-foreground mb-2">
                {language === "ar" ? "المبلغ المطلوب" : "Amount Due"}
              </p>
              <div className="text-6xl font-bold text-orange-600 dark:text-orange-400">
                {total.toFixed(2)}
              </div>
              <p className="text-2xl text-muted-foreground mt-1">{t("sar")}</p>
            </div>
            <p className="text-xl text-muted-foreground">
              {paymentMethod === "card_machine"
                ? (language === "ar" 
                  ? "يرجى إتمام الدفع عبر جهاز الشبكة"
                  : "Please complete payment on the card machine")
                : (language === "ar" 
                  ? "يرجى تمرير البطاقة أو الجوال على جهاز الدفع"
                  : "Please tap your card or phone on the payment terminal")
              }
            </p>
          </div>
          <div className="w-full max-w-lg px-8 pb-8">
            <Button 
              onClick={handleConfirmPayment} 
              disabled={createOrderMutation.isPending} 
              data-testid="button-confirm-payment" 
              className="w-full h-14 text-lg gap-2"
            >
              <Check className="h-5 w-5" />
              {createOrderMutation.isPending 
                ? (language === "ar" ? "جاري التأكيد..." : "Confirming...") 
                : (language === "ar" ? "تم الدفع" : "Payment Received")}
            </Button>
            <Button 
              variant="ghost" 
              onClick={() => setPaymentConfirmOpen(false)} 
              data-testid="button-cancel-payment"
              className="w-full mt-2 text-muted-foreground"
            >
              {language === "ar" ? "إلغاء" : "Cancel"}
            </Button>
          </div>
        </div>
      )}

      <Dialog open={closeSummaryOpen} onOpenChange={setCloseSummaryOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              {language === "ar" ? "تقرير نهاية اليوم" : "End of Day Report"}
            </DialogTitle>
            <DialogDescription>
              {closeSummaryData?.date}
            </DialogDescription>
          </DialogHeader>
          {closeSummaryData && (
            <div id="day-end-report" className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <div className="flex justify-between gap-4 items-center">
                  <span className="text-muted-foreground">{language === "ar" ? "إجمالي الطلبات" : "Total Orders"}</span>
                  <span className="font-bold text-lg" data-testid="text-summary-orders">{closeSummaryData.totalOrders}</span>
                </div>
                <div className="flex justify-between gap-4 items-center">
                  <span className="text-muted-foreground">{language === "ar" ? "إجمالي المبيعات" : "Total Sales"}</span>
                  <span className="font-bold text-lg text-green-600" data-testid="text-summary-sales">{formatCurrency(closeSummaryData.totalSales)}</span>
                </div>
              </div>

              <div className="border rounded-lg p-3 space-y-2">
                <h4 className="font-semibold text-sm mb-2">{language === "ar" ? "حسب طريقة الدفع" : "By Payment Method"}</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="flex items-center gap-2">
                      <Banknote className="h-4 w-4 text-muted-foreground" />
                      {language === "ar" ? "نقدي (كاش)" : "Cash"}
                    </span>
                    <span className="font-medium" data-testid="text-summary-cash">{formatCurrency(closeSummaryData.cashSales)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      {language === "ar" ? "شبكة" : "Card (Tap)"}
                    </span>
                    <span className="font-medium" data-testid="text-summary-card">{formatCurrency(closeSummaryData.cardSales)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="flex items-center gap-2">
                      <Wallet className="h-4 w-4 text-muted-foreground" />
                      {language === "ar" ? "دفع مقسم" : "Split Payment"}
                    </span>
                    <span className="font-medium">{formatCurrency(closeSummaryData.splitSales)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-muted-foreground" />
                      {language === "ar" ? "دفع إلكتروني" : "Online Payment"}
                    </span>
                    <span className="font-medium">{formatCurrency(closeSummaryData.onlineSales)}</span>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-3 space-y-2">
                <h4 className="font-semibold text-sm mb-2">{language === "ar" ? "حسب نوع الطلب" : "By Order Type"}</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between gap-4">
                    <span>{language === "ar" ? `داخل المطعم (${closeSummaryData.dineInCount})` : `Dine-in (${closeSummaryData.dineInCount})`}</span>
                    <span className="font-medium">{formatCurrency(closeSummaryData.dineInSales)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>{language === "ar" ? `استلام (${closeSummaryData.pickupCount})` : `Pickup (${closeSummaryData.pickupCount})`}</span>
                    <span className="font-medium">{formatCurrency(closeSummaryData.pickupSales)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>{language === "ar" ? `توصيل (${closeSummaryData.deliveryCount})` : `Delivery (${closeSummaryData.deliveryCount})`}</span>
                    <span className="font-medium">{formatCurrency(closeSummaryData.deliverySales)}</span>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-3 space-y-2">
                <h4 className="font-semibold text-sm mb-2">{language === "ar" ? "تفاصيل مالية" : "Financial Details"}</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between gap-4">
                    <span>{language === "ar" ? "إجمالي الخصومات" : "Total Discounts"}</span>
                    <span className="font-medium text-orange-600">{formatCurrency(closeSummaryData.totalDiscount)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>{language === "ar" ? "إجمالي الضريبة" : "Total Tax"}</span>
                    <span className="font-medium">{formatCurrency(closeSummaryData.totalTax)}</span>
                  </div>
                  {closeSummaryData.unpaidCount > 0 && (
                    <div className="flex justify-between gap-4 text-red-600">
                      <span>{language === "ar" ? `طلبات غير مدفوعة (${closeSummaryData.unpaidCount})` : `Unpaid Orders (${closeSummaryData.unpaidCount})`}</span>
                      <span className="font-medium">{formatCurrency(closeSummaryData.unpaidTotal)}</span>
                    </div>
                  )}
                  {closeSummaryData.cancelledCount > 0 && (
                    <div className="flex justify-between gap-4 text-muted-foreground">
                      <span>{language === "ar" ? `طلبات ملغاة` : `Cancelled Orders`}</span>
                      <span className="font-medium">{closeSummaryData.cancelledCount}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="border rounded-lg p-3 space-y-2">
                <h4 className="font-semibold text-sm mb-2">{language === "ar" ? "الصندوق" : "Cash Drawer"}</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between gap-4">
                    <span>{language === "ar" ? "الرصيد الافتتاحي" : "Opening Balance"}</span>
                    <span>{formatCurrency(closeSummaryData.openingBalance)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>{language === "ar" ? "الرصيد المتوقع" : "Expected Balance"}</span>
                    <span>{formatCurrency(closeSummaryData.expectedBalance)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>{language === "ar" ? "الرصيد الفعلي" : "Actual Balance"}</span>
                    <span className="font-medium">{formatCurrency(closeSummaryData.closingBalance)}</span>
                  </div>
                  <div className={`flex justify-between gap-4 font-bold pt-2 border-t ${
                    closeSummaryData.difference === 0 ? "text-green-600" : 
                    closeSummaryData.difference > 0 ? "text-blue-600" : "text-destructive"
                  }`}>
                    <span>{language === "ar" ? "الفرق" : "Difference"}</span>
                    <span data-testid="text-summary-diff">{formatCurrency(closeSummaryData.difference)}</span>
                  </div>
                </div>
              </div>

              {closeSummaryData.notes && (
                <div className="border-t pt-3">
                  <span className="text-sm text-muted-foreground">{language === "ar" ? "ملاحظات" : "Notes"}</span>
                  <p className="text-sm mt-1">{closeSummaryData.notes}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="flex gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => {
              const el = document.getElementById("day-end-report");
              if (!el) return;
              const printWindow = window.open("", "_blank");
              if (!printWindow) return;
              printWindow.document.write(`<html><head><title>${language === "ar" ? "تقرير نهاية اليوم" : "End of Day Report"}</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',Tahoma,sans-serif;padding:24px;direction:${direction};max-width:80mm;margin:0 auto}.space-y-4>*+*{margin-top:16px}.space-y-3>*+*{margin-top:12px}.space-y-2>*+*{margin-top:8px}.space-y-1>*+*{margin-top:4px}.p-4,.p-3{padding:12px}.rounded-lg{border-radius:8px}.border{border:1px solid #e5e7eb}.bg-muted{background:#f3f4f6}.font-bold{font-weight:700}.font-semibold{font-weight:600}.font-medium{font-weight:500}.text-lg{font-size:18px}.text-sm{font-size:14px}.text-muted-foreground{color:#6b7280}.text-green-600{color:#16a34a}.text-orange-600{color:#ea580c}.text-red-600{color:#dc2626}.text-blue-600{color:#2563eb}.text-destructive{color:#dc2626}.flex{display:flex}.justify-between{justify-content:space-between}.items-center{align-items:center}.gap-4{gap:16px}.gap-2{gap:8px}.border-t{border-top:1px solid #e5e7eb}.pt-2,.pt-3{padding-top:8px}.mb-2{margin-bottom:8px}h4{margin-bottom:8px}@media print{body{padding:0}}</style></head><body>${el.innerHTML}</body></html>`);
              printWindow.document.close();
              setTimeout(() => printWindow.print(), 250);
            }}>
              <Printer className="h-4 w-4 me-2" />
              {language === "ar" ? "طباعة" : "Print"}
            </Button>
            <Button data-testid="button-close-summary" onClick={() => setCloseSummaryOpen(false)} className="flex-1">
              {language === "ar" ? "حسناً" : "OK"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

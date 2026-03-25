import { useState, useEffect, useCallback, useRef, Fragment, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, Plus, Minus, Trash2, ChefHat, Search, MapPin, Banknote, Globe, Smartphone, Check, Loader2, User, Phone, LogOut, ClipboardList, UtensilsCrossed, Flame, Leaf, X, AlertTriangle, CalendarCheck, Clock, Star, ArrowLeft, Heart, Sparkles, Sun, Moon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/lib/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { MenuItem, Category, Table as TableType } from "@shared/schema";

interface SelectedCustomization {
  groupId: string;
  optionId: string;
  nameEn: string;
  nameAr: string;
  priceAdjustment: number;
}

interface SelectedVariant {
  id: string;
  nameEn: string;
  nameAr: string;
  priceAdjustment: number;
}

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  notes: string;
  cartKey: string;
  selectedVariant?: SelectedVariant | null;
  selectedCustomizations?: SelectedCustomization[];
}

interface CustomerInfo {
  id: string;
  name: string;
  phone: string;
  address?: string;
}

function getStoredCustomer(restaurantId: string): CustomerInfo | null {
  try {
    const stored = localStorage.getItem(`customer_${restaurantId}`);
    if (stored) return JSON.parse(stored);
  } catch {}
  return null;
}

function storeCustomer(restaurantId: string, customer: CustomerInfo) {
  localStorage.setItem(`customer_${restaurantId}`, JSON.stringify(customer));
}

function clearStoredCustomer(restaurantId: string) {
  localStorage.removeItem(`customer_${restaurantId}`);
}

export default function CustomerMenuPage() {
  const params = useParams<{ restaurantId?: string; tableId?: string }>();
  const [, setLocation] = useLocation();
  const { t, direction, language, setLanguage, getLocalizedName } = useLanguage();
  const { toast } = useToast();

  const urlParams = new URLSearchParams(window.location.search);
  const urlBranchParam = urlParams.get("b");

  const restaurantId = params.restaurantId || "default";
  const tableId = params.tableId;
  const isPublic = !!params.restaurantId;

  const apiBase = isPublic ? `/api/public/${restaurantId}` : "/api";

  // Fetch branches to resolve branch slug → ID
  const { data: publicBranches } = useQuery<{ id: string; slug?: string; name: string }[]>({
    queryKey: [`${apiBase}/branches`],
    enabled: isPublic && !!urlBranchParam,
  });

  // Resolve branch param: could be a slug or an ID
  const urlBranchId = useMemo(() => {
    if (!urlBranchParam) return null;
    if (!publicBranches) return urlBranchParam; // fallback to raw param until branches load
    const bySlug = publicBranches.find(b => b.slug === urlBranchParam);
    if (bySlug) return bySlug.id;
    const byId = publicBranches.find(b => b.id === urlBranchParam);
    if (byId) return byId.id;
    return urlBranchParam; // fallback
  }, [urlBranchParam, publicBranches]);

  const toggleLanguage = () => {
    setLanguage(language === "ar" ? "en" : "ar");
  };

  const [loggedInCustomer, setLoggedInCustomer] = useState<CustomerInfo | null>(null);

  useEffect(() => {
    const stored = getStoredCustomer(restaurantId);
    if (stored) {
      setLoggedInCustomer(stored);
    }
  }, [restaurantId]);

  const handleLogout = () => {
    clearStoredCustomer(restaurantId);
    setLoggedInCustomer(null);
  };

  const [cart, setCart] = useState<CartItem[]>([]);

  // Load cart items from localStorage (set by menu-item-detail page)
  useEffect(() => {
    const stored = localStorage.getItem(`cart_${restaurantId}`);
    if (stored) {
      try {
        const items = JSON.parse(stored) as CartItem[];
        if (items.length > 0) {
          setCart(prev => {
            const merged = [...prev];
            for (const item of items) {
              const idx = merged.findIndex(c => c.cartKey === item.cartKey);
              if (idx >= 0) {
                merged[idx] = { ...merged[idx], quantity: merged[idx].quantity + item.quantity };
              } else {
                merged.push(item);
              }
            }
            return merged;
          });
          localStorage.removeItem(`cart_${restaurantId}`);
        }
      } catch { localStorage.removeItem(`cart_${restaurantId}`); }
    }
  }, [restaurantId]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isUserScrolling, setIsUserScrolling] = useState(true); // true = allow scroll-spy
  const [showCheckout, setShowCheckout] = useState(false);
  const categoryTabsRef = useRef<HTMLDivElement>(null);
  const userClickedCategoryRef = useRef(false);
  const clickTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scrollSpyCategory, setScrollSpyCategory] = useState<string | null>(null);

  // Light/Dark mode for customer menu
  const [menuDark, setMenuDark] = useState(() => {
    try { return localStorage.getItem('menu_theme') !== 'light'; } catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem('menu_theme', menuDark ? 'dark' : 'light'); } catch {}
  }, [menuDark]);

  // Theme shorthand
  const d = menuDark;

  const [orderType, setOrderType] = useState<string>(tableId ? "dine_in" : "");
  const [depositInfo, setDepositInfo] = useState<{ hasDeposit: boolean; depositAmount: string; reservationId: string; customerName: string } | null>(null);
  const depositCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [kitchenNotes, setKitchenNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("tap_to_pay");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showOrderHistory, setShowOrderHistory] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponError, setCouponError] = useState("");
  const [couponApplied, setCouponApplied] = useState<string | null>(null);
  const [depositReservationId, setDepositReservationId] = useState<string | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [showItemDetail, setShowItemDetail] = useState<MenuItem | null>(null);
  const [detailVariant, setDetailVariant] = useState<SelectedVariant | null>(null);
  const [detailCustomizations, setDetailCustomizations] = useState<SelectedCustomization[]>([]);
  const [detailQuantity, setDetailQuantity] = useState(1);

  useEffect(() => {
    if (loggedInCustomer) {
      setCustomerName(loggedInCustomer.name);
      setCustomerPhone(loggedInCustomer.phone);
      if (loggedInCustomer.address) setCustomerAddress(loggedInCustomer.address);
    }
  }, [loggedInCustomer]);

  // Sync orderType when tableId changes (e.g., navigation)
  useEffect(() => {
    if (tableId) setOrderType("dine_in");
  }, [tableId]);

  // Check for paid deposit when phone number changes
  useEffect(() => {
    if (depositCheckTimer.current) clearTimeout(depositCheckTimer.current);
    setDepositInfo(null);
    setDepositReservationId(null);
    const phone = customerPhone.replace(/\s/g, '');
    if (phone.length >= 8 && isPublic) {
      depositCheckTimer.current = setTimeout(async () => {
        try {
          const res = await fetch(`${apiBase}/check-deposit?phone=${encodeURIComponent(phone)}`);
          if (res.ok) {
            const data = await res.json();
            if (data.hasDeposit) {
              setDepositInfo(data);
            }
          }
        } catch {}
      }, 500);
    }
    return () => { if (depositCheckTimer.current) clearTimeout(depositCheckTimer.current); };
  }, [customerPhone, apiBase, isPublic]);

  const { data: table } = useQuery<TableType | null>({
    queryKey: [isPublic ? `${apiBase}/tables/${tableId}` : "/api/tables", tableId],
    enabled: !!tableId,
  });

  // Auto-detect branchId from URL param or from the table's branch
  const branchId = urlBranchId || (table as any)?.branchId || null;

  const { data: activeOrderData, refetch: refetchActiveOrder } = useQuery<any>({
    queryKey: [`${apiBase}/tables/${tableId}/active-order`],
    enabled: !!tableId && isPublic,
    refetchInterval: 10000,
  });

  const { data: categories, isLoading: categoriesLoading } = useQuery<Category[]>({
    queryKey: [`${apiBase}/categories`],
  });

  const { data: menuItems, isLoading: itemsLoading } = useQuery<MenuItem[]>({
    queryKey: [`${apiBase}/menu-items`],
  });

  const { data: restaurant } = useQuery<any>({
    queryKey: [`${apiBase}/restaurant`],
  });

  // Day session check
  const { data: daySessionStatus } = useQuery<any>({
    queryKey: [`${apiBase}/day-session/status${branchId ? `?branch=${branchId}` : ""}`],
    enabled: isPublic,
  });

  // Fetch all variants and customizations for the menu
  const { data: allVariants } = useQuery<Record<string, any[]>>({
    queryKey: [`${apiBase}/all-variants`],
    enabled: isPublic,
  });

  const { data: allCustomizations } = useQuery<Record<string, any[]>>({
    queryKey: [`${apiBase}/all-customizations`],
    enabled: isPublic,
  });

  const { data: customerOrders } = useQuery<any[]>({
    queryKey: [`${apiBase}/customers/${loggedInCustomer?.id}/orders`],
    enabled: isPublic && !!loggedInCustomer?.id,
  });

  const isDayOpen = !isPublic || daySessionStatus?.isOpen !== false;

  const isRestaurantOpen = (): boolean => {
    if (!restaurant?.openingTime || !restaurant?.closingTime) return true;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [openH, openM] = restaurant.openingTime.split(":").map(Number);
    const [closeH, closeM] = restaurant.closingTime.split(":").map(Number);
    const openMinutes = openH * 60 + (openM || 0);
    const closeMinutes = closeH * 60 + (closeM || 0);
    if (closeMinutes > openMinutes) {
      return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
    }
    return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
  };

  const restaurantOpen = isRestaurantOpen();
  const canOrder = restaurantOpen && isDayOpen;
  const isTaxEnabled = restaurant?.taxEnabled !== false;
  const taxRate = isTaxEnabled ? 15 : 0;

  const getItemPrice = (cartItem: CartItem): number => {
    let price = parseFloat(cartItem.menuItem.price || "0");
    if (cartItem.selectedVariant) {
      price += Number(cartItem.selectedVariant.priceAdjustment || 0);
    }
    if (cartItem.selectedCustomizations?.length) {
      price += cartItem.selectedCustomizations.reduce((s, c) => s + Number(c.priceAdjustment || 0), 0);
    }
    return price;
  };

  const subtotal = cart.reduce((sum, item) => sum + getItemPrice(item) * item.quantity, 0);
  const discountedSubtotal = Math.max(0, subtotal - couponDiscount);
  const taxAmount = discountedSubtotal * (taxRate / 100);
  const totalWithTax = discountedSubtotal + taxAmount;

  const validateCoupon = async () => {
    if (!couponCode.trim()) return;
    setValidatingCoupon(true);
    setCouponError("");
    try {
      const res = await fetch(`${apiBase}/validate-coupon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCode.trim(), orderTotal: subtotal, customerPhone: customerPhone || undefined }),
      });
      const data = await res.json();
      if (data.valid && data.discount) {
        setCouponDiscount(data.discount);
        setCouponApplied(couponCode.trim());
        setCouponError("");
        // Store reservation ID if this is a reservation deposit code
        if (data.isReservationDeposit && data.reservationId) {
          setDepositReservationId(data.reservationId);
        } else {
          setDepositReservationId(null);
        }
      } else {
        setCouponError(data.error || (language === "ar" ? "كود غير صالح" : "Invalid code"));
        setCouponDiscount(0);
        setCouponApplied(null);
        setDepositReservationId(null);
      }
    } catch {
      setCouponError(language === "ar" ? "فشل التحقق" : "Validation failed");
    }
    setValidatingCoupon(false);
  };

  const removeCoupon = () => {
    setCouponCode("");
    setCouponDiscount(0);
    setCouponApplied(null);
    setCouponError("");
    setDepositReservationId(null);
  };

  const placeOrderMutation = useMutation({
    mutationFn: async (orderData: {
      orderType: string;
      tableId: string | null;
      customerName: string;
      customerPhone: string;
      customerAddress: string;
      kitchenNotes: string;
      paymentMethod: string;
      items: { menuItemId: string; quantity: number; notes: string; unitPrice: string; totalPrice: string; selectedVariant?: SelectedVariant | null; selectedCustomizations?: SelectedCustomization[] }[];
    }) => {
      // Register/lookup customer if phone is provided
      let customerId: string | null = null;
      if (orderData.customerPhone && isPublic) {
        try {
          const loginRes = await apiRequest("POST", `${apiBase}/customer/login`, {
            phone: orderData.customerPhone.trim(),
            name: orderData.customerName?.trim() || orderData.customerPhone.trim(),
          });
          if (loginRes.ok) {
            const loginData = await loginRes.json();
            const customer: CustomerInfo = {
              id: loginData.customer.id,
              name: loginData.customer.name || orderData.customerName,
              phone: loginData.customer.phone,
              address: loginData.customer.address || undefined,
            };
            storeCustomer(restaurantId, customer);
            setLoggedInCustomer(customer);
            customerId = customer.id;
          }
        } catch { /* continue without customer */ }
      }

      const cartSubtotal = cart.reduce((sum, item) => getItemPrice(item) * item.quantity + sum, 0);
      const cartDiscountedSubtotal = Math.max(0, cartSubtotal - couponDiscount);
      const cartTax = cartDiscountedSubtotal * (taxRate / 100);
      const cartTotal = cartDiscountedSubtotal + cartTax;

      // For EdfaPay online payment: DON'T create order yet — send data to create-session
      // Order will be created only after payment is confirmed
      if (orderData.paymentMethod === "edfapay_online") {
        const baseUrl = window.location.origin;
        const sessionId = crypto.randomUUID ? crypto.randomUUID() : `sess_${Date.now()}`;
        const callbackUrl = `${baseUrl}/payment-callback/${sessionId}`;

        const sessionRes = await fetch("/api/payments/create-session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderData: {
              restaurantId,
              branchId: branchId || null,
              orderNumber: `ORD-${Date.now().toString().slice(-6)}`,
              orderType: orderData.orderType,
              tableId: orderData.tableId,
              customerId: customerId || loggedInCustomer?.id || null,
              customerName: orderData.customerName || null,
              customerPhone: orderData.customerPhone || null,
              customerAddress: orderData.customerAddress || null,
              kitchenNotes: orderData.kitchenNotes || null,
              subtotal: cartSubtotal.toFixed(2),
              discount: couponDiscount.toFixed(2),
              tax: cartTax.toFixed(2),
              total: cartTotal.toFixed(2),
            },
            items: orderData.items.map(item => ({
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              notes: item.notes || null,
            })),
            callbackUrl,
          }),
        });

        if (!sessionRes.ok) {
          const errData = await sessionRes.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to create payment session");
        }

        const session = await sessionRes.json();

        if (session.action === "redirect" && session.redirectUrl) {
          // Return a special marker so onSuccess knows to redirect to EdfaPay
          return { _edfapayRedirect: true, redirectUrl: session.redirectUrl, sessionId: session.sessionId };
        } else if (session.action === "success") {
          // Rare: direct success without redirect
          return { id: session.orderId, _edfapayDirect: true };
        } else {
          throw new Error(language === "ar"
            ? "فشل في إنشاء جلسة الدفع"
            : "Failed to create payment session");
        }
      }

      // For cash / other payment methods: create order normally
      const orderEndpoint = isPublic ? `${apiBase}/orders` : "/api/orders";
      const response = await apiRequest("POST", orderEndpoint, {
        restaurantId,
        branchId: branchId || null,
        orderNumber: `ORD-${Date.now().toString().slice(-6)}`,
        orderType: orderData.orderType,
        tableId: orderData.tableId,
        customerId: customerId || loggedInCustomer?.id || null,
        customerName: orderData.customerName || null,
        customerPhone: orderData.customerPhone || null,
        customerAddress: orderData.customerAddress || null,
        kitchenNotes: orderData.kitchenNotes || null,
        paymentMethod: orderData.paymentMethod,
        subtotal: cartSubtotal.toFixed(2),
        discount: couponDiscount.toFixed(2),
        tax: cartTax.toFixed(2),
        total: cartTotal.toFixed(2),
        status: "pending",
        isPaid: false,
        depositReservationId: depositReservationId || undefined,
        // Include items for invoice generation (server needs them before separate item API calls)
        items: orderData.items.map(item => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          notes: item.notes || null,
        })),
      });

      const order = await response.json();

      // Note: for public orders, items are saved atomically by the server during order creation.
      // For authenticated cashier orders, items are saved by createOrderAtomicPipeline.
      // No separate item POSTs needed — they caused false failure messages.

      return order;
    },
    onSuccess: (order) => {
      // Handle EdfaPay redirect (no order created yet)
      if (order._edfapayRedirect) {
        setCart([]);
        window.location.href = order.redirectUrl;
        return;
      }

      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/orders") });
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).startsWith("/api/kitchen") });
      queryClient.invalidateQueries({ predicate: (query) => String(query.queryKey[0]).includes("/active-order") });
      setCart([]);

      const isDineInTable = orderType === "dine_in" && !!tableId;
      const orderHasDeposit = order.depositApplied || depositInfo?.hasDeposit;
      const depositAmt = order.depositAmount || depositInfo?.depositAmount;

      // Clear deposit info after order
      if (depositInfo) setDepositInfo(null);

      if (isDineInTable) {
        toast({
          title: language === "ar" ? "تم إرسال طلبك للمطبخ!" : "Order sent to kitchen!",
          description: orderHasDeposit
            ? (language === "ar" ? `تم خصم ${depositAmt} ر.س (رسوم الحجز) من فاتورتك` : `${depositAmt} SAR booking fee deducted from your bill`)
            : (language === "ar" ? "بتقدر تدفع بعد ما تخلص أكلك" : "You can pay after you finish your meal"),
        });
        refetchActiveOrder();
      } else {
        toast({
          title: t("orderPlaced"),
          description: `${t("orderNumber")} ${order.orderNumber}`,
        });
        setLocation(isPublic ? `/m/${restaurantId}/order-status/${order.id}` : `/order-status/${order.id}`);
      }
    },
    onError: (error: any) => {
      let errData = error;
      try {
        if (error instanceof Error) {
           let msg = error.message;
           // If message starts with "400: {" or similar, strip the status code
           if (msg.match(/^\d{3}: /)) {
              msg = msg.substring(5);
           }
           if (msg.trim().startsWith('{')) {
             errData = JSON.parse(msg);
           }
        }
      } catch {}

      // Deal with specific errors
      if (errData?.error === "Table has an active order") {
        toast({
          variant: "destructive",
          title: language === "ar" ? "الطاولة مشغولة" : "Table Occupied",
          description: language === "ar" 
            ? "الطاولة لديها طلب نشط. يرجى الانتظار أو التواصل مع الموظف." 
            : "This table has an active order. Please wait or contact staff.",
        });
        refetchActiveOrder();
      } else if (errData?.error === "daySessionClosed") {
        toast({
          variant: "destructive",
          title: language === "ar" ? "المطعم مغلق حالياً" : "Restaurant Closed",
          description: language === "ar" 
            ? "نأسف، لم يتم فتح الوردية اليومية بعد. يرجى الطلب لاحقاً." 
            : "Sorry, the daily session hasn't started yet. Please order later.",
        });
      } else if (errData?.error === "cashNotAllowed") {
        toast({
          variant: "destructive",
          title: language === "ar" ? "الدفع النقدي غير متاح" : "Cash Not Accepted",
          description: language === "ar"
            ? "الدفع النقدي غير مقبول للطلبات الإلكترونية في هذا المطعم"
            : "Cash payment is not accepted for online orders at this restaurant",
        });
      } else {
        toast({
          variant: "destructive",
          title: t("error"),
          description: errData?.message || errData?.error || t("orderFailed"),
        });
      }
    },
  });

  const openItemDetail = (item: MenuItem) => {
    const variants = allVariants?.[item.id] || [];
    const custs = allCustomizations?.[item.id] || [];
    setShowItemDetail(item);
    setDetailQuantity(1);
    if (variants.length > 0) {
      const first = variants[0];
      setDetailVariant({ id: first.id, nameEn: first.nameEn, nameAr: first.nameAr, priceAdjustment: parseFloat(first.priceAdjustment || "0") });
    } else {
      setDetailVariant(null);
    }
    setDetailCustomizations([]);
  };

  const addToCartFromDetail = () => {
    if (!showItemDetail) return;
    const item = showItemDetail;
    if (item.isAvailable === false) return;
    // Normalize customization key: sort by groupId then optionId to ensure order-independence
    const sortedCustKey = [...detailCustomizations]
      .sort((a, b) => a.groupId.localeCompare(b.groupId) || a.optionId.localeCompare(b.optionId))
      .map(c => `${c.groupId}:${c.optionId}`)
      .join(",");
    const cartKey = `${item.id}_${detailVariant?.id || "none"}_${sortedCustKey}`;
    setCart((prev) => {
      const existing = prev.find((c) => c.cartKey === cartKey);
      if (existing) {
        return prev.map((c) =>
          c.cartKey === cartKey ? { ...c, quantity: c.quantity + detailQuantity } : c
        );
      }
      return [...prev, {
        menuItem: item,
        quantity: detailQuantity,
        notes: "",
        cartKey,
        selectedVariant: detailVariant,
        selectedCustomizations: [...detailCustomizations],
      }];
    });
    setShowItemDetail(null);
  };

  const addToCart = (item: MenuItem) => {
    const variants = allVariants?.[item.id] || [];
    const custs = allCustomizations?.[item.id] || [];
    if (variants.length > 0 || custs.length > 0) {
      openItemDetail(item);
      return;
    }
    const cartKey = `${item.id}_none_`;
    setCart((prev) => {
      const existing = prev.find((c) => c.cartKey === cartKey);
      if (existing) {
        return prev.map((c) =>
          c.cartKey === cartKey ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, { menuItem: item, quantity: 1, notes: "", cartKey }];
    });
  };

  const updateQuantity = (cartKey: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) =>
          c.cartKey === cartKey
            ? { ...c, quantity: Math.max(0, c.quantity + delta) }
            : c
        )
        .filter((c) => c.quantity > 0)
    );
  };

  const updateItemNotes = (cartKey: string, notes: string) => {
    setCart((prev) =>
      prev.map((c) =>
        c.cartKey === cartKey ? { ...c, notes } : c
      )
    );
  };

  const removeFromCart = (cartKey: string) => {
    setCart((prev) => prev.filter((c) => c.cartKey !== cartKey));
  };

  const total = totalWithTax;

  // Scroll-spy: observe category section headers and update active tab
  useEffect(() => {
    if (selectedCategory || searchQuery) return; // Only spy when showing all categories
    const sectionEls = document.querySelectorAll('[data-category-section]');
    if (!sectionEls.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (userClickedCategoryRef.current) return; // skip if user just clicked a tab
        // Find the topmost visible section
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          const catId = visible[0].target.getAttribute('data-category-section');
          if (catId) {
            setSelectedCategory(null); // keep null so all items show
            // Update which tab looks active via a separate state
            setScrollSpyCategory(catId);
            // Auto-scroll the tab bar to make the active tab visible
            const tabEl = document.querySelector(`[data-tab-category="${catId}"]`) as HTMLElement;
            if (tabEl && categoryTabsRef.current) {
              const container = categoryTabsRef.current;
              const tabLeft = tabEl.offsetLeft;
              const tabWidth = tabEl.offsetWidth;
              const containerWidth = container.offsetWidth;
              const scrollLeft = container.scrollLeft;
              if (tabLeft < scrollLeft || tabLeft + tabWidth > scrollLeft + containerWidth) {
                container.scrollTo({ left: tabLeft - containerWidth / 2 + tabWidth / 2, behavior: 'smooth' });
              }
            }
          }
        }
      },
      { rootMargin: '-120px 0px -60% 0px', threshold: 0 }
    );

    sectionEls.forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, [selectedCategory, searchQuery, categories, menuItems]);

  // When user clicks a category tab, scroll to that section
  const handleCategoryClick = useCallback((catId: string | null) => {
    // Clear any pending timeout from a previous click to avoid race conditions
    if (clickTimeoutRef.current) clearTimeout(clickTimeoutRef.current);
    userClickedCategoryRef.current = true;
    // Only update the visual highlight — never filter items via selectedCategory,
    // because setting selectedCategory hides data-category-section elements from the DOM,
    // which causes the scroll target to not exist and the menu to jump to the wrong category.
    setScrollSpyCategory(catId);
    if (catId) {
      setTimeout(() => {
        const el = document.querySelector(`[data-category-section="${catId}"]`) as HTMLElement;
        if (el) {
          const offset = 160;
          const top = el.getBoundingClientRect().top + window.scrollY - offset;
          window.scrollTo({ top, behavior: 'smooth' });
        }
        clickTimeoutRef.current = setTimeout(() => {
          userClickedCategoryRef.current = false;
        }, 700);
      }, 50);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      clickTimeoutRef.current = setTimeout(() => {
        userClickedCategoryRef.current = false;
      }, 700);
    }
  }, []);

  // The visually active category = selectedCategory (when filtering) || scrollSpyCategory (when scrolling)
  const activeCategoryId = selectedCategory || scrollSpyCategory;

  const filteredItems = menuItems?.filter((item) => {
    const matchesSearch =
      !searchQuery ||
      getLocalizedName(item.nameEn, item.nameAr)
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
    const matchesCategory =
      !selectedCategory || item.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  })?.sort((a, b) => {
    if (!selectedCategory && !searchQuery) {
      const catAIdx = categories?.findIndex(c => c.id === a.categoryId) ?? 999;
      const catBIdx = categories?.findIndex(c => c.id === b.categoryId) ?? 999;
      if (catAIdx !== catBIdx) return catAIdx - catBIdx;
    }
    return a.isAvailable === b.isAvailable ? 0 : a.isAvailable ? -1 : 1;
  });

  const handlePlaceOrder = () => {
    if (cart.length === 0) {
      toast({ variant: "destructive", title: t("emptyCart") });
      return;
    }
    if (!orderType) {
      toast({ variant: "destructive", title: t("selectOrderType") });
      return;
    }
    if (orderType === "delivery" && !customerAddress) {
      toast({ variant: "destructive", title: t("address") });
      return;
    }
    const phoneClean = customerPhone.replace(/\s/g, '');
    if (phoneClean.length < 8) {
      toast({
        variant: "destructive",
        title: language === "ar" ? "رقم الجوال غير صحيح" : "Invalid phone number",
        description: language === "ar"
          ? (phoneClean.length === 0 ? "أدخل رقم الجوال" : "يجب أن يكون رقم الجوال 8 أرقام على الأقل")
          : (phoneClean.length === 0 ? "Enter your phone number" : "Phone number must be at least 8 digits"),
      });
      return;
    }
    setShowConfirmation(true);
  };

  const submitOrder = () => {
    setShowConfirmation(false);
    // Table dine-in orders: always sent as "pending" cash orders — the cashier
    // collects payment (cash or card) after the customer finishes eating.
    // We never redirect table QR orders to an online payment gateway upfront.
    const isDineInTable = orderType === "dine_in" && tableId;
    const finalPaymentMethod = isDineInTable
      ? "cash"   // placeholder: real payment happens after kitchen marks ready
      : (paymentMethod === "tap_to_pay" ? "edfapay_online" : "cash");
    
    placeOrderMutation.mutate({
      orderType,
      tableId: tableId || null,
      customerName,
      customerPhone,
      customerAddress,
      kitchenNotes,
      paymentMethod: finalPaymentMethod,
      items: cart.map((c) => {
        const unitPrice = getItemPrice(c);
        return {
          menuItemId: c.menuItem.id,
          quantity: c.quantity,
          notes: c.notes,
          unitPrice: unitPrice.toFixed(2),
          totalPrice: (unitPrice * c.quantity).toFixed(2),
          selectedVariant: c.selectedVariant,
          selectedCustomizations: c.selectedCustomizations,
        };
      }),
    });
  };

  const isLoading = categoriesLoading || itemsLoading;

  const activeOrder = activeOrderData?.hasActiveOrder ? activeOrderData.order : null;

  // Show active order view if there's an active order (don't require loggedInCustomer)
  if (isPublic && tableId && activeOrder && !activeOrder.isPaid) {
    const orderTotal = parseFloat(activeOrder.total || "0");
    const statusText = (s: string) => {
      const map: Record<string, { en: string; ar: string }> = {
        pending: { en: "Waiting", ar: "بالانتظار" },
        preparing: { en: "Preparing", ar: "جاري التحضير" },
        ready: { en: "Ready", ar: "جاهز" },
      };
      return map[s] ? (language === "ar" ? map[s].ar : map[s].en) : s;
    };

    return (
      <div className={`min-h-screen ${d ? 'bg-[#111]' : 'bg-gray-50'}`} dir={direction}>
        <header className={`sticky top-0 z-10 ${d ? 'bg-[#111]/90 border-white/[0.04]' : 'bg-gray-50/90 border-gray-100'} backdrop-blur-xl border-b p-4`}>
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#8B1A1A] flex items-center justify-center">
                <ChefHat className="h-4 w-4 text-white" />
              </div>
              <span className={`font-bold ${d ? 'text-white' : 'text-gray-900'}`}>
                {getLocalizedName(restaurant?.nameEn, restaurant?.nameAr) || "Restaurant"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {loggedInCustomer && (
                <div className={`flex items-center gap-1.5 text-sm ${d ? 'text-white/60' : 'text-gray-500'}`}>
                  <User className="h-3.5 w-3.5" />
                  <span className="max-w-[60px] truncate font-medium text-xs">{loggedInCustomer.name}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 rounded-lg" onClick={handleLogout}>
                    <LogOut className="h-3 w-3" />
                  </Button>
                </div>
              )}
              <Button variant="outline" size="sm" onClick={toggleLanguage} className={`gap-1.5 h-8 text-xs rounded-xl ${d ? 'border-white/[0.06] text-white/80 hover:bg-white/[0.05]' : 'border-gray-200/60 text-gray-600 hover:bg-gray-50'}`}>
                <Globe className="h-3.5 w-3.5" />
                {language === "ar" ? "EN" : "عربي"}
              </Button>
            </div>
          </div>
        </header>

        <main className="max-w-lg mx-auto px-4 pb-8 space-y-4">
          {/* Status pill */}
          <div className="flex items-center justify-center pt-2 pb-1">
            <div className={`inline-flex items-center gap-3 px-5 py-2.5 rounded-2xl border ${
              activeOrder.status === "ready"
                ? d ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                : activeOrder.status === "pending"
                ? d ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 'bg-amber-50 border-amber-200 text-amber-700'
                : d ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-700'
            }`}>
              <div className={`w-2 h-2 rounded-full animate-pulse ${
                activeOrder.status === "ready" ? 'bg-emerald-500' : activeOrder.status === "pending" ? 'bg-amber-500' : 'bg-blue-500'
              }`} />
              {table && (
                <span className={`font-bold text-[13px]`}>
                  {language === "ar" ? "طاولة" : "Table"} {table.tableNumber}
                </span>
              )}
              <span className="text-[13px] font-medium">{statusText(activeOrder.status)}</span>
            </div>
          </div>

          {/* Order card */}
          <div className={`${d ? 'bg-[#1a1a1a] border-white/[0.06]' : 'bg-white border-gray-200/60 shadow-sm'} rounded-2xl border overflow-hidden`}>
            <div className={`px-5 py-4 border-b ${d ? 'border-white/[0.05]' : 'border-gray-100'} flex items-center justify-between`}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#8B1A1A] flex items-center justify-center">
                  <ChefHat className="h-4 w-4 text-white" />
                </div>
                <h2 className={`text-[15px] font-bold ${d ? 'text-white' : 'text-gray-900'}`}>
                  {language === "ar" ? "طلبك الحالي" : "Your Current Order"}
                </h2>
              </div>
              <span className={`text-xs font-mono font-semibold ${d ? 'text-white/30 bg-white/[0.04]' : 'text-gray-400 bg-gray-50'} px-2.5 py-1 rounded-lg`}>#{activeOrder.orderNumber}</span>
            </div>
            <div className="px-5 py-3 space-y-0 divide-y">
              {activeOrder.items?.map((item: any, idx: number) => (
                <div key={idx} className={`flex items-center justify-between py-3 ${d ? 'divide-white/5' : 'divide-gray-50'}`}>
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${d ? 'bg-white/[0.05]' : 'bg-gray-50'}`}>
                      <span className={`text-[11px] font-bold ${d ? 'text-white/50' : 'text-gray-500'}`}>×{item.quantity}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold text-[13px] ${d ? 'text-white' : 'text-gray-900'} truncate`}>
                        {getLocalizedName(item.menuItem?.nameEn, item.menuItem?.nameAr) || (language === "ar" ? "عنصر" : "Item")}
                      </p>
                      <p className={`text-[11px] ${d ? 'text-white/35' : 'text-gray-400'}`}>
                        {parseFloat(item.unitPrice || "0").toFixed(2)} {language === "ar" ? "ر.س" : "SAR"} {language === "ar" ? "للواحد" : "each"}
                      </p>
                    </div>
                  </div>
                  <span className={`font-bold text-[13px] text-[#8B1A1A] tabular-nums flex-shrink-0`}>
                    {parseFloat(item.totalPrice || "0").toFixed(2)} <span className={`text-[10px] font-normal ${d ? 'text-white/25' : 'text-gray-400'}`}>{language === "ar" ? "ر.س" : "SAR"}</span>
                  </span>
                </div>
              ))}
            </div>
            <div className={`px-5 py-4 border-t ${d ? 'border-white/[0.07] bg-white/[0.02]' : 'border-gray-100 bg-gray-50/50'} flex items-center justify-between`}>
              <span className={`text-[15px] font-bold ${d ? 'text-white' : 'text-gray-900'}`}>{language === "ar" ? "المجموع الكلي" : "Total"}</span>
              <div className="flex items-baseline gap-1">
                <span className="text-[22px] font-bold text-[#8B1A1A] tabular-nums">{orderTotal.toFixed(2)}</span>
                <span className={`text-[12px] font-medium ${d ? 'text-white/40' : 'text-gray-400'}`}>{language === "ar" ? "ر.س" : "SAR"}</span>
              </div>
            </div>
          </div>

          {/* Status action */}
          {activeOrder.status === "ready" ? (
            <div className="space-y-3">
              <div className={`w-full p-4 rounded-2xl text-center ${d ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-emerald-50 border border-emerald-200'}`}>
                <div className="flex items-center justify-center gap-2 mb-1.5">
                  <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                  <span className={`font-bold text-sm ${d ? 'text-emerald-400' : 'text-emerald-700'}`}>
                    {language === "ar" ? "طلبك جاهز!" : "Your order is ready!"}
                  </span>
                </div>
                <p className={`text-xs ${d ? 'text-white/45' : 'text-gray-500'}`}>
                  {language === "ar" ? "ادفع من خلال هاتفك أو من الكاشير" : "Pay via your phone or at the cashier"}
                </p>
              </div>
              <Button
                className="w-full h-14 text-[15px] font-bold bg-[#8B1A1A] hover:bg-[#A02020] text-white gap-3 rounded-2xl shadow-sm"
                onClick={async () => {
                  try {
                    const baseUrl = window.location.origin;
                    const callbackUrl = `${baseUrl}/payment-callback/${activeOrder.id}`;
                    const res = await fetch("/api/payments/create-session", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ orderId: activeOrder.id, callbackUrl }),
                    });
                    if (!res.ok) {
                      const err = await res.json().catch(() => ({}));
                      throw new Error(err.error || "فشل إنشاء جلسة الدفع");
                    }
                    const data = await res.json();
                    if (data.redirect_url || data.redirectUrl) {
                      window.location.href = data.redirect_url || data.redirectUrl;
                    } else {
                      throw new Error("لم يُعد رابط الدفع");
                    }
                  } catch (e: any) {
                    alert(e.message || "حدث خطأ");
                  }
                }}
              >
                <Smartphone className="h-5 w-5" />
                {language === "ar" ? `ادفع ${orderTotal.toFixed(2)} ر.س` : `Pay ${orderTotal.toFixed(2)} SAR`}
              </Button>
            </div>
          ) : activeOrder.status === "pending" ? (
            <div className={`w-full px-5 py-4 rounded-2xl text-center ${d ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'}`}>
              <div className="flex items-center justify-center gap-2.5 mb-1.5">
                <div className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-pulse" />
                <span className={`font-bold text-sm ${d ? 'text-amber-400' : 'text-amber-700'}`}>
                  {language === "ar" ? "بانتظار تأكيد الكاشير" : "Waiting for cashier confirmation"}
                </span>
              </div>
              <p className={`text-xs ${d ? 'text-white/45' : 'text-gray-500'}`}>
                {language === "ar" ? "سيتم تحضير طلبك فور تأكيده" : "Your order will be prepared once confirmed"}
              </p>
            </div>
          ) : (
            <div className={`w-full px-5 py-4 rounded-2xl text-center ${d ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-200'}`}>
              <div className="flex items-center justify-center gap-2.5 mb-1.5">
                <div className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-pulse" />
                <span className={`font-bold text-sm ${d ? 'text-blue-400' : 'text-blue-700'}`}>
                  {activeOrder.status === "confirmed"
                    ? (language === "ar" ? "تم تأكيد طلبك، جاري إرساله للمطبخ" : "Order confirmed, sending to kitchen")
                    : (language === "ar" ? "جاري تحضير طلبك في المطبخ" : "Your order is being prepared")}
                </span>
              </div>
              <p className={`text-xs ${d ? 'text-white/45' : 'text-gray-500'}`}>
                {language === "ar" ? "سيظهر زر الدفع عندما يصبح طلبك جاهزاً" : "Payment button will appear when your order is ready"}
              </p>
            </div>
          )}
        </main>
      </div>
    );
  }



  if (isLoading) {
    return (
      <div className={`min-h-screen ${d ? 'bg-[#111]' : 'bg-gray-50'}`} dir={direction}>
        {/* Skeleton hero */}
        <div className="relative">
          <Skeleton className={`h-36 sm:h-44 w-full rounded-none ${d ? 'bg-white/[0.03]' : 'bg-gray-200'}`} />
          <div className="max-w-lg mx-auto px-4 -mt-10 relative z-10">
            <div className={`${d ? 'bg-[#1a1a1a]' : 'bg-white'} rounded-xl p-3.5 flex items-center gap-3 border ${d ? 'border-white/[0.06]' : 'border-gray-100'}`}>
              <Skeleton className={`w-14 h-14 rounded-xl ${d ? 'bg-white/[0.05]' : 'bg-gray-100'}`} />
              <div className="flex-1">
                <Skeleton className={`h-5 w-32 ${d ? 'bg-white/[0.04]' : 'bg-gray-100'}`} />
                <Skeleton className={`h-3 w-20 mt-1.5 ${d ? 'bg-white/[0.04]' : 'bg-gray-100'}`} />
              </div>
            </div>
          </div>
        </div>
        <div className="pt-12 pb-2 px-5">
          <Skeleton className={`h-5 w-40 ${d ? 'bg-white/[0.04]' : 'bg-gray-100'}`} />
          <Skeleton className={`h-3 w-28 mt-2 ${d ? 'bg-white/[0.04]' : 'bg-gray-100'}`} />
        </div>
        <div className="max-w-lg mx-auto px-4 pt-3">
          <Skeleton className={`h-10 w-full rounded-lg ${d ? 'bg-white/[0.04]' : 'bg-gray-100'}`} />
          <div className="flex gap-4 mt-3 overflow-hidden border-b ${d ? 'border-white/[0.04]' : 'border-gray-200/60'} pb-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className={`h-4 w-16 flex-shrink-0 ${d ? 'bg-white/[0.04]' : 'bg-gray-100'}`} />
            ))}
          </div>
          <div className="space-y-2 mt-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className={`flex gap-3 p-3 rounded-xl ${d ? 'bg-[#1a1a1a]' : 'bg-white'}`}>
                <Skeleton className={`w-20 h-20 rounded-lg flex-shrink-0 ${d ? 'bg-white/[0.04]' : 'bg-gray-100'}`} />
                <div className="flex-1 space-y-2 py-1">
                  <Skeleton className={`h-4 w-3/4 ${d ? 'bg-white/[0.04]' : 'bg-gray-100'}`} />
                  <Skeleton className={`h-3 w-1/2 ${d ? 'bg-white/[0.04]' : 'bg-gray-100'}`} />
                  <Skeleton className={`h-4 w-16 ${d ? 'bg-white/[0.04]' : 'bg-gray-100'}`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (showCheckout) {
    return (
      <div className={`min-h-screen ${d ? 'bg-[#111]' : 'bg-gray-50'}`} dir={direction}>
        {/* Premium header */}
        <header className={`sticky top-0 z-10 ${d ? 'bg-[#111]/90 border-white/[0.04]' : 'bg-gray-50/90 border-gray-100'} backdrop-blur-xl border-b px-4 py-3`}>
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                data-testid="button-back-to-menu"
                onClick={() => setShowCheckout(false)}
                className={`w-9 h-9 rounded-xl ${d ? 'bg-white/[0.06] hover:bg-white/[0.1] text-white' : 'bg-white hover:bg-gray-100 text-gray-700 shadow-sm ring-1 ring-gray-200/60'} flex items-center justify-center transition-all`}
              >
                {direction === "rtl" ? <ArrowLeft className="h-4 w-4 rotate-180" /> : <ArrowLeft className="h-4 w-4" />}
              </button>
              <h1 className={`text-lg font-bold ${d ? 'text-white' : 'text-gray-900'}`} data-testid="text-checkout-title">{t("checkout")}</h1>
            </div>
            <button
              onClick={toggleLanguage}
              className={`px-3 h-8 rounded-full text-xs font-semibold ${d ? 'bg-white/[0.06] hover:bg-white/[0.1] text-white/80 border border-white/[0.06]' : 'bg-white hover:bg-gray-100 text-gray-600 ring-1 ring-gray-200/60 shadow-sm'} transition-all`}
              data-testid="button-checkout-toggle-language"
            >
              {language === "ar" ? "EN" : "عربي"}
            </button>
          </div>
        </header>

        <main className="max-w-lg mx-auto px-4 pt-4 pb-28 space-y-5">
          {/* Table info */}
          {table && (
            <div className={`flex items-center gap-3.5 ${d ? 'bg-[#8B1A1A]/10 border-[#8B1A1A]/20' : 'bg-[#8B1A1A]/5 border-[#8B1A1A]/15'} border rounded-2xl p-4`} data-testid="card-table-info">
              <div className={`w-11 h-11 rounded-xl ${d ? 'bg-[#8B1A1A]/30' : 'bg-[#8B1A1A]/10'} flex items-center justify-center flex-shrink-0`}>
                <MapPin className="h-5 w-5 text-[#8B1A1A]" />
              </div>
              <div>
                <p className={`font-bold text-[14px] ${d ? 'text-white' : 'text-gray-900'}`} data-testid="text-table-number">{t("youAreAtTable")} {table.tableNumber}</p>
                {table.location && (
                  <p className={`text-xs mt-0.5 ${d ? 'text-white/40' : 'text-gray-400'}`}>{table.location}</p>
                )}
              </div>
            </div>
          )}

          {/* Cart items */}
          <div className="space-y-3">
            <h2 className={`text-[11px] font-bold ${d ? 'text-white/45' : 'text-gray-400'} uppercase tracking-[0.12em]`}>{t("orderItems")}</h2>
            <div className={`${d ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-gray-200/60 shadow-sm'} rounded-2xl border overflow-hidden divide-y ${d ? 'divide-white/[0.05]' : 'divide-gray-100'}`}>
            {cart.map((item) => (
              <div key={item.cartKey} className="p-4" data-testid={`card-checkout-item-${item.cartKey}`}>
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-[15px] ${d ? 'text-white' : 'text-gray-900'}`} data-testid={`text-checkout-item-name-${item.cartKey}`}>
                      {getLocalizedName(item.menuItem.nameEn, item.menuItem.nameAr)}
                    </p>
                    {item.selectedVariant && (
                      <p className={`text-xs mt-0.5 ${d ? 'text-white/40' : 'text-gray-400'}`}>
                        {getLocalizedName(item.selectedVariant.nameEn, item.selectedVariant.nameAr)}
                      </p>
                    )}
                    {item.selectedCustomizations && item.selectedCustomizations.length > 0 && (
                      <p className={`text-xs mt-0.5 ${d ? 'text-white/40' : 'text-gray-400'}`}>
                        {item.selectedCustomizations.map(c => getLocalizedName(c.nameEn, c.nameAr)).join(", ")}
                      </p>
                    )}
                    <p className="text-sm font-bold text-[#8B1A1A] mt-1.5" data-testid={`text-checkout-item-price-${item.cartKey}`}>
                      {(getItemPrice(item) * item.quantity).toFixed(2)} <span className={`text-[11px] font-normal ${d ? 'text-white/30' : 'text-gray-400'}`}>{t("sar")}</span>
                    </p>
                  </div>
                  <div className={`flex items-center gap-0 ${d ? 'bg-white/5' : 'bg-gray-100'} rounded-lg`}>
                    <button
                      className={`w-8 h-8 flex items-center justify-center ${d ? 'text-white/60 hover:text-white' : 'text-gray-400 hover:text-gray-700'} transition-colors`}
                      onClick={() => updateQuantity(item.cartKey, -1)}
                      data-testid={`button-decrease-${item.cartKey}`}
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className={`w-7 text-center text-sm font-bold tabular-nums ${d ? 'text-white' : 'text-gray-900'}`} data-testid={`text-checkout-item-qty-${item.cartKey}`}>{item.quantity}</span>
                    <button
                      className={`w-8 h-8 flex items-center justify-center ${d ? 'text-white/60 hover:text-white' : 'text-gray-400 hover:text-gray-700'} transition-colors`}
                      onClick={() => updateQuantity(item.cartKey, 1)}
                      data-testid={`button-increase-${item.cartKey}`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <Input
                  placeholder={t("specialRequests")}
                  value={item.notes}
                  onChange={(e) => updateItemNotes(item.cartKey, e.target.value)}
                  className={`mt-2.5 h-9 text-xs rounded-xl border-0 ${d ? 'bg-white/[0.04] text-white placeholder:text-white/20 ring-1 ring-white/[0.06]' : 'bg-gray-50/80 text-gray-900 placeholder:text-gray-400 ring-1 ring-gray-200/60'}`}
                  data-testid={`input-notes-${item.cartKey}`}
                />
              </div>
            ))}
            </div>
          </div>

          {/* Order Type */}
          {!tableId && (
            <div className="space-y-3">
              <h2 className={`text-[11px] font-bold ${d ? 'text-white/45' : 'text-gray-400'} uppercase tracking-[0.12em]`}>{t("selectOrderType")}</h2>
              <div className="grid grid-cols-3 gap-2">
                {["dine_in", "pickup", "delivery"].map((type) => (
                  <button
                    key={type}
                    onClick={() => setOrderType(type)}
                    className={`h-11 rounded-xl text-sm font-semibold transition-all duration-200 ${
                      orderType === type
                        ? 'bg-[#8B1A1A] text-white'
                        : d ? 'bg-white/[0.04] text-white/60 hover:bg-white/[0.08] ring-1 ring-white/[0.06]' : 'bg-white text-gray-600 hover:bg-gray-100 ring-1 ring-gray-200/60 shadow-sm'
                    }`}
                    data-testid={`button-order-type-${type}`}
                  >
                    {t(type === "dine_in" ? "dineIn" : type)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Customer Info */}
          <div className="space-y-3">
            <h2 className={`text-[11px] font-bold ${d ? 'text-white/45' : 'text-gray-400'} uppercase tracking-[0.12em]`}>{t("customerInfo")}</h2>
            <div className={`${d ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-gray-200/60 shadow-sm'} rounded-2xl border p-4 space-y-3`}>
              <div className="relative">
                <Phone className={`absolute ${direction === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 h-4 w-4 ${d ? 'text-white/20' : 'text-gray-400'}`} />
                <Input
                  placeholder={language === "ar" ? "05xxxxxxxx" : "05xxxxxxxx"}
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={13}
                  value={customerPhone}
                  onChange={(e) => {
                    // فقط أرقام وعلامة + في البداية
                    const value = e.target.value.replace(/[^\d+]/g, '');
                    // لو بدأ بـ + خله، غير كذا أرقام فقط
                    const cleaned = value.startsWith('+') ? '+' + value.slice(1).replace(/\D/g, '') : value.replace(/\D/g, '');
                    setCustomerPhone(cleaned);
                  }}
                  data-testid="input-customer-phone"
                  dir="ltr"
                  className={`${direction === 'rtl' ? 'pr-10' : 'pl-10'} h-11 rounded-xl border-0 ${d ? 'bg-white/[0.04] text-white placeholder:text-white/20 ring-1 ring-white/[0.06]' : 'bg-gray-50/80 text-gray-900 placeholder:text-gray-400 ring-1 ring-gray-200/60'} focus:ring-[#8B1A1A]/50`}
                />
              </div>
              <div className="relative">
                <User className={`absolute ${direction === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 h-4 w-4 ${d ? 'text-white/25' : 'text-gray-400'}`} />
                <Input
                  placeholder={t("name")}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  data-testid="input-customer-name"
                  className={`${direction === 'rtl' ? 'pr-10' : 'pl-10'} h-11 rounded-xl border-0 ${d ? 'bg-white/[0.04] text-white placeholder:text-white/20 ring-1 ring-white/[0.06]' : 'bg-gray-50/80 text-gray-900 placeholder:text-gray-400 ring-1 ring-gray-200/60'} focus:ring-[#8B1A1A]/50`}
                />
              </div>
              {orderType === "delivery" && (
                <div className="relative">
                  <MapPin className={`absolute ${direction === 'rtl' ? 'right-3' : 'left-3'} top-3 h-4 w-4 ${d ? 'text-white/20' : 'text-gray-400'}`} />
                  <Textarea
                    placeholder={t("address")}
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    data-testid="input-customer-address"
                    className={`${direction === 'rtl' ? 'pr-10' : 'pl-10'} rounded-xl border-0 min-h-[80px] ${d ? 'bg-white/[0.04] text-white placeholder:text-white/20 ring-1 ring-white/[0.06]' : 'bg-gray-50/80 text-gray-900 placeholder:text-gray-400 ring-1 ring-gray-200/60'} focus:ring-[#8B1A1A]/50`}
                  />
                </div>
              )}
            </div>

            {depositInfo?.hasDeposit && (
              <div className={`flex items-center gap-3 ${d ? 'bg-emerald-950/40 border-emerald-800/30' : 'bg-emerald-50 border-emerald-200'} border rounded-xl p-3.5`}>
                <div className={`w-9 h-9 rounded-lg ${d ? 'bg-emerald-900/40' : 'bg-emerald-100'} flex items-center justify-center flex-shrink-0`}>
                  <CalendarCheck className={`h-4 w-4 ${d ? 'text-emerald-400' : 'text-emerald-600'}`} />
                </div>
                <div>
                  <p className={`font-semibold text-sm ${d ? 'text-emerald-300' : 'text-emerald-700'}`}>
                    {language === "ar" 
                      ? `رسوم حجز مدفوعة: ${depositInfo.depositAmount} ر.س`
                      : `Paid booking fee: ${depositInfo.depositAmount} SAR`}
                  </p>
                  <p className={`text-xs mt-0.5 ${d ? 'text-emerald-400/60' : 'text-emerald-600/70'}`}>
                    {language === "ar"
                      ? "ستُخصم تلقائياً من فاتورتك"
                      : "Will be automatically deducted from your bill"}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Kitchen Notes */}
          <div className="space-y-3">
            <h2 className={`text-[11px] font-bold ${d ? 'text-white/45' : 'text-gray-400'} uppercase tracking-[0.12em]`}>{t("kitchenNotes")}</h2>
            <Textarea
              placeholder={t("specialRequests")}
              value={kitchenNotes}
              onChange={(e) => setKitchenNotes(e.target.value)}
              data-testid="input-kitchen-notes"
              className={`rounded-xl border-0 min-h-[80px] ${d ? 'bg-white/[0.03] text-white placeholder:text-white/20 ring-1 ring-white/[0.06]' : 'bg-white text-gray-900 placeholder:text-gray-400 ring-1 ring-gray-200/60 shadow-sm'} focus:ring-[#8B1A1A]/50`}
            />
          </div>

          {/* Coupon Code */}
          <div className="space-y-3">
            <h2 className={`text-[11px] font-bold ${d ? 'text-white/45' : 'text-gray-400'} uppercase tracking-[0.12em]`}>{language === "ar" ? "كود الخصم" : "Discount Code"}</h2>
            {couponApplied ? (
              <div className={`flex items-center justify-between ${d ? 'bg-emerald-950/40 border-emerald-800/30' : 'bg-emerald-50 border-emerald-200'} border rounded-xl p-3.5`}>
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white text-xs">{couponApplied}</Badge>
                  <span className={`text-sm ${d ? 'text-emerald-300' : 'text-emerald-600'} font-semibold`}>
                    -{couponDiscount.toFixed(2)} {t("sar")}
                  </span>
                </div>
                <button onClick={removeCoupon} className="text-red-400 hover:text-red-300 text-xs font-medium">
                  {language === "ar" ? "إزالة" : "Remove"}
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  placeholder={language === "ar" ? "أدخل كود الخصم" : "Enter promo code"}
                  value={couponCode}
                  onChange={(e) => { setCouponCode(e.target.value.toUpperCase()); setCouponError(""); }}
                  dir="ltr"
                  className={`font-mono tracking-wider h-11 rounded-xl border-0 ${d ? 'bg-white/[0.03] text-white placeholder:text-white/20 ring-1 ring-white/[0.06]' : 'bg-white text-gray-900 placeholder:text-gray-400 ring-1 ring-gray-200/60 shadow-sm'} focus:ring-[#8B1A1A]/50`}
                />
                <button
                  onClick={validateCoupon}
                  disabled={validatingCoupon || !couponCode.trim()}
                  className="shrink-0 h-11 px-5 rounded-xl bg-[#8B1A1A] hover:bg-[#A02020] disabled:opacity-40 text-white text-sm font-semibold transition-colors"
                >
                  {validatingCoupon ? "..." : (language === "ar" ? "تطبيق" : "Apply")}
                </button>
              </div>
            )}
            {couponError && (
              <p className="text-sm text-red-400">{couponError}</p>
            )}
          </div>

          {/* Payment Method */}
          {(() => {
            const isDineInTable = orderType === "dine_in" && !!tableId;
            if (isDineInTable) {
              // Table QR orders: no upfront payment — customer pays after kitchen marks ready
              return (
                <div className={`w-full p-4 rounded-xl text-center ${d ? 'bg-white/[0.03] border border-white/[0.06]' : 'bg-gray-50 border border-gray-200'}`}>
                  <Smartphone className={`h-6 w-6 mx-auto mb-2 ${d ? 'text-white/60' : 'text-gray-500'}`} />
                  <p className={`text-sm font-medium ${d ? 'text-white/80' : 'text-gray-700'}`}>
                    {language === "ar" ? "الدفع بعد تحضير طلبك" : "Pay after your order is ready"}
                  </p>
                  <p className={`text-xs mt-1 ${d ? 'text-white/40' : 'text-gray-400'}`}>
                    {language === "ar" ? "ستظهر لك زر الدفع عبر الجوال عندما يصبح طلبك جاهزًا" : "A pay button will appear when your order is ready"}
                  </p>
                </div>
              );
            }
            const cashAllowed = restaurant?.allowCashOnPublicQR !== false;
            return (
              <div className="space-y-3">
                <h2 className={`text-[11px] font-bold ${d ? 'text-white/45' : 'text-gray-400'} uppercase tracking-[0.12em]`}>{language === "ar" ? "طريقة الدفع" : "Payment Method"}</h2>
                <div className={`grid gap-3 ${cashAllowed ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  <button
                    onClick={() => setPaymentMethod("tap_to_pay")}
                    className={`flex flex-col items-center gap-2 h-20 rounded-xl transition-all duration-200 ${
                      paymentMethod === "tap_to_pay"
                        ? 'bg-[#8B1A1A] text-white ring-2 ring-[#8B1A1A]'
                        : d ? 'bg-white/[0.04] text-white/60 hover:bg-white/[0.08] ring-1 ring-white/[0.06]' : 'bg-white text-gray-600 hover:bg-gray-50 ring-1 ring-gray-200/60 shadow-sm'
                    }`}
                    data-testid="button-payment-tap-to-pay"
                  >
                    <Smartphone className="h-5 w-5" />
                    <span className="text-xs font-semibold">{language === "ar" ? "الدفع بالجوال" : "Mobile Pay"}</span>
                  </button>
                  {cashAllowed && (
                    <button
                      onClick={() => setPaymentMethod("cash")}
                      className={`flex flex-col items-center gap-2 h-20 rounded-xl transition-all duration-200 ${
                        paymentMethod === "cash"
                          ? 'bg-[#8B1A1A] text-white ring-2 ring-[#8B1A1A]'
                          : d ? 'bg-white/[0.04] text-white/60 hover:bg-white/[0.08] ring-1 ring-white/[0.06]' : 'bg-white text-gray-600 hover:bg-gray-50 ring-1 ring-gray-200/60 shadow-sm'
                      }`}
                      data-testid="button-payment-cash"
                    >
                      <Banknote className="h-5 w-5" />
                      <span className="text-xs font-semibold">{language === "ar" ? "نقد" : "Cash"}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Order Summary - in scrollable area */}
          <div className="space-y-3">
            <h2 className={`text-[11px] font-bold ${d ? 'text-white/45' : 'text-gray-400'} uppercase tracking-[0.12em]`}>{language === "ar" ? "ملخص الطلب" : "Order Summary"}</h2>
            <div className={`${d ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-gray-200/60 shadow-sm'} rounded-2xl border p-4 space-y-2.5 text-sm`}>
              <div className={`flex justify-between ${d ? 'text-white/50' : 'text-gray-500'}`}>
                <span>{t("subtotal")}</span>
                <span className="tabular-nums">{subtotal.toFixed(2)} {t("sar")}</span>
              </div>
              <div className={`flex justify-between ${d ? 'text-white/50' : 'text-gray-500'}`}>
                <span>{language === "ar" ? `ضريبة (${taxRate}%)` : `VAT (${taxRate}%)`}</span>
                <span className="tabular-nums">{taxAmount.toFixed(2)} {t("sar")}</span>
              </div>
              {depositInfo?.hasDeposit && (
                <div className={`flex justify-between font-medium ${d ? 'text-emerald-400' : 'text-emerald-600'}`}>
                  <span>{language === "ar" ? "رسوم الحجز (خصم)" : "Booking fee (discount)"}</span>
                  <span className="tabular-nums">-{parseFloat(depositInfo.depositAmount).toFixed(2)} {t("sar")}</span>
                </div>
              )}
              {couponDiscount > 0 && (
                <div className={`flex justify-between font-medium ${d ? 'text-emerald-400' : 'text-emerald-600'}`}>
                  <span>{language === "ar" ? `خصم (${couponApplied})` : `Discount (${couponApplied})`}</span>
                  <span className="tabular-nums">-{couponDiscount.toFixed(2)} {t("sar")}</span>
                </div>
              )}
              <div className={`flex justify-between font-bold text-base pt-2.5 mt-1 border-t ${d ? 'border-white/10 text-white' : 'border-gray-200 text-gray-900'}`}>
                <span>{t("total")}</span>
                <span className="text-[#8B1A1A] tabular-nums">
                  {depositInfo?.hasDeposit
                    ? Math.max(0, totalWithTax - parseFloat(depositInfo.depositAmount)).toFixed(2)
                    : totalWithTax.toFixed(2)} {t("sar")}
                </span>
              </div>
            </div>
          </div>

          {!canOrder && (
            <div className={`flex items-center gap-2 ${d ? 'bg-red-950/40 text-red-400' : 'bg-red-50 text-red-600'} rounded-xl p-3 text-xs font-medium`}>
              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
              <span>{!restaurantOpen ? (language === "ar" ? "المطعم مغلق حالياً" : "Restaurant is currently closed") : (language === "ar" ? "المطعم لم يبدأ يوم العمل بعد" : "Restaurant has not started yet")}</span>
            </div>
          )}
        </main>

        {/* Bottom bar - total + place order */}
        <div className={`fixed bottom-0 left-0 right-0 z-20 ${d ? 'bg-[#111]/97 border-white/[0.05]' : 'bg-white/97 border-gray-100'} backdrop-blur-xl border-t`}>
          <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
            <div className={`flex-shrink-0 ${d ? 'bg-white/[0.04] border-white/[0.06]' : 'bg-gray-50 border-gray-200/60'} border rounded-xl px-3.5 py-2`}>
              <p className={`text-[10px] font-medium ${d ? 'text-white/35' : 'text-gray-400'} mb-0`}>{t("total")}</p>
              <p className="text-[18px] font-bold text-[#8B1A1A] tabular-nums leading-tight">
                {depositInfo?.hasDeposit
                  ? Math.max(0, totalWithTax - parseFloat(depositInfo.depositAmount)).toFixed(2)
                  : totalWithTax.toFixed(2)} <span className={`text-[10px] font-normal ${d ? 'text-white/25' : 'text-gray-400'}`}>{t("sar")}</span>
              </p>
            </div>
            <button
              data-testid="button-place-order"
              className="flex-1 h-[52px] bg-[#8B1A1A] hover:bg-[#9e1f1f] disabled:opacity-40 text-white rounded-2xl text-[15px] font-bold transition-all active:scale-[0.98] shadow-sm"
              onClick={handlePlaceOrder}
              disabled={placeOrderMutation.isPending || cart.length === 0 || !canOrder}
            >
              {placeOrderMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin mx-auto" />
              ) : (orderType === "dine_in" && tableId) ? (language === "ar" ? "أرسل للمطبخ" : "Send to Kitchen") : t("confirmOrder")}
            </button>
          </div>
        </div>

        {/* Confirmation modal */}
        {showConfirmation && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className={`w-full sm:max-w-sm ${d ? 'bg-[#1a1a1a]' : 'bg-white'} rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden`}>
              {/* Header */}
              <div className="bg-[#8B1A1A] px-6 py-5 text-center">
                <div className="w-12 h-12 rounded-full bg-white/20 mx-auto flex items-center justify-center mb-2">
                  <Check className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-lg font-bold text-white">
                  {language === "ar" ? "تأكيد الطلب" : "Confirm Order"}
                </h2>
              </div>
              <div className="p-5 space-y-4">
                <div className={`space-y-2 text-sm ${d ? 'text-white/50' : 'text-gray-500'}`}>
                  <div className="flex justify-between">
                    <span>{language === "ar" ? "عدد الأصناف" : "Items"}</span>
                    <span className={`font-medium ${d ? 'text-white' : 'text-gray-900'}`}>{cart.reduce((s, c) => s + c.quantity, 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{t("subtotal")}</span>
                    <span className={`font-medium tabular-nums ${d ? 'text-white' : 'text-gray-900'}`}>{subtotal.toFixed(2)} {t("sar")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{language === "ar" ? `ضريبة (${taxRate}%)` : `VAT (${taxRate}%)`}</span>
                    <span className={`font-medium tabular-nums ${d ? 'text-white' : 'text-gray-900'}`}>{taxAmount.toFixed(2)} {t("sar")}</span>
                  </div>
                  {depositInfo?.hasDeposit && (
                    <div className={`flex justify-between ${d ? 'text-emerald-400' : 'text-emerald-600'}`}>
                      <span>{language === "ar" ? "رسوم الحجز (خصم)" : "Booking fee (discount)"}</span>
                      <span className="font-medium tabular-nums">-{parseFloat(depositInfo.depositAmount).toFixed(2)} {t("sar")}</span>
                    </div>
                  )}
                  {couponDiscount > 0 && (
                    <div className={`flex justify-between ${d ? 'text-emerald-400' : 'text-emerald-600'}`}>
                      <span>{language === "ar" ? `خصم (${couponApplied})` : `Discount (${couponApplied})`}</span>
                      <span className="font-medium tabular-nums">-{couponDiscount.toFixed(2)} {t("sar")}</span>
                    </div>
                  )}
                  <div className={`flex justify-between font-bold text-base border-t ${d ? 'border-white/10' : 'border-gray-200'} pt-2`}>
                    <span className={d ? 'text-white' : 'text-gray-900'}>{t("total")}</span>
                    <span className="text-[#8B1A1A] tabular-nums">
                      {depositInfo?.hasDeposit
                        ? Math.max(0, totalWithTax - parseFloat(depositInfo.depositAmount)).toFixed(2)
                        : totalWithTax.toFixed(2)} {t("sar")}
                    </span>
                  </div>
                  <div className={`flex justify-between pt-1 border-t ${d ? 'border-white/5' : 'border-gray-100'}`}>
                    <span>{t("orderType")}</span>
                    <span className={`font-medium ${d ? 'text-white' : 'text-gray-900'}`}>{t(orderType === "dine_in" ? "dineIn" : orderType)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>{language === "ar" ? "الدفع" : "Payment"}</span>
                    <span className={`font-medium ${d ? 'text-white' : 'text-gray-900'}`}>
                      {paymentMethod === "tap_to_pay"
                        ? (language === "ar" ? "الدفع بالجوال" : "Mobile Pay")
                        : (language === "ar" ? "نقد" : "Cash")}
                    </span>
                  </div>
                </div>
                <div className="flex gap-3 pt-1">
                  <button
                    className={`flex-1 h-12 rounded-xl font-semibold text-sm transition-colors ${d ? 'bg-white/5 text-white/80 hover:bg-white/10' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                    onClick={() => setShowConfirmation(false)}
                  >
                    {language === "ar" ? "رجوع" : "Back"}
                  </button>
                  <button
                    className="flex-1 h-12 rounded-xl bg-[#8B1A1A] hover:bg-[#A02020] text-white font-bold text-sm shadow-sm transition-all disabled:opacity-50 flex items-center justify-center"
                    onClick={submitOrder}
                    disabled={placeOrderMutation.isPending}
                  >
                    {placeOrderMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : (language === "ar" ? "تأكيد" : "Confirm")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  return (
    <div className={`min-h-screen ${d ? 'bg-[#111]' : 'bg-gray-50'}`} dir={direction}>
      {/* Hero Banner */}
      <div className="relative">
        {restaurant?.banner ? (
          <div className="h-40 sm:h-52 w-full overflow-hidden">
            <img src={restaurant.banner} alt="" className="w-full h-full object-cover scale-105" />
            <div className={`absolute inset-0 ${d ? 'bg-gradient-to-b from-black/40 via-black/10 to-[#111]' : 'bg-gradient-to-b from-black/25 via-transparent to-gray-50'}`} />
          </div>
        ) : (
          <div className={`h-32 sm:h-40 w-full ${d ? 'bg-[#1a1a1a]' : 'bg-[#8B1A1A]'} relative overflow-hidden`}>
            <div className={`absolute inset-0 ${d ? 'bg-gradient-to-br from-[#8B1A1A]/30 to-transparent' : 'bg-gradient-to-br from-white/10 to-transparent'}`} />
            <div className={`absolute inset-0 ${d ? 'bg-gradient-to-b from-transparent to-[#111]' : 'bg-gradient-to-b from-transparent to-gray-50'}`} />
          </div>
        )}
        
        {/* Top controls */}
        <div className="absolute top-0 left-0 right-0 px-3 pt-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-1.5">
            {loggedInCustomer && (
              <div className="flex items-center gap-1 bg-black/30 backdrop-blur-sm rounded-full px-2 py-1 border border-white/10">
                <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
                  <User className="h-2.5 w-2.5 text-white" />
                </div>
                <span className="max-w-[60px] truncate text-[10px] text-white/90 font-medium">{loggedInCustomer.name}</span>
                <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-white/10 rounded-full" onClick={() => setShowOrderHistory(true)}>
                  <ClipboardList className="h-2.5 w-2.5 text-white/60" />
                </Button>
                <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-red-500/20 rounded-full" onClick={handleLogout}>
                  <LogOut className="h-2.5 w-2.5 text-red-300" />
                </Button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setMenuDark(!menuDark)}
              className="w-8 h-8 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center border border-white/10"
            >
              {menuDark ? <Sun className="h-3.5 w-3.5 text-amber-300" /> : <Moon className="h-3.5 w-3.5 text-white" />}
            </button>
            <button
              onClick={toggleLanguage}
              className="h-8 px-2.5 rounded-full bg-black/30 backdrop-blur-sm text-[10px] font-semibold border border-white/10 text-white/90 flex items-center gap-1"
              data-testid="button-toggle-language"
            >
              <Globe className="h-3 w-3 text-white/50" />
              {language === "ar" ? "EN" : "عربي"}
            </button>
          </div>
        </div>
      </div>

      {/* Restaurant Info Card */}
      <div className="max-w-lg mx-auto px-4 -mt-12 relative z-10">
        <div className={`${d ? 'bg-[#1a1a1a] border-white/[0.07]' : 'bg-white border-gray-100/80'} border rounded-2xl p-4 shadow-xl flex items-start gap-4`}>
          {restaurant?.logo ? (
            <div className={`w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 ${d ? 'bg-[#222] ring-2 ring-white/[0.06]' : 'bg-gray-50 ring-2 ring-gray-100'} shadow-lg`}>
              <img src={restaurant.logo} alt="" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-xl flex-shrink-0 bg-[#8B1A1A] flex items-center justify-center shadow-lg ring-2 ring-[#8B1A1A]/30">
              <UtensilsCrossed className="h-6 w-6 text-white/90" />
            </div>
          )}
          <div className="flex-1 min-w-0 pt-0.5">
            <h1 className={`text-[17px] font-bold ${d ? 'text-white' : 'text-gray-900'} truncate leading-tight`} data-testid="text-restaurant-name">
              {getLocalizedName(restaurant?.nameEn, restaurant?.nameAr) || "Restaurant"}
            </h1>
            <div className="flex items-center flex-wrap gap-2 mt-1.5">
              {table && (
                <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${d ? 'text-[#e88]' : 'text-[#8B1A1A]'} ${d ? 'bg-[#8B1A1A]/10' : 'bg-[#8B1A1A]/8'} px-2 py-0.5 rounded-full`} data-testid="badge-table-number">
                  <MapPin className="h-2.5 w-2.5" />
                  {t("youAreAtTable")} {table.tableNumber}
                </span>
              )}
              {restaurant?.openingTime && restaurant?.closingTime && (
                <span className={`inline-flex items-center gap-1 text-[11px] ${d ? 'text-white/35' : 'text-gray-400'}`}>
                  <Clock className="h-2.5 w-2.5" />
                  {restaurant.openingTime} – {restaurant.closingTime}
                </span>
              )}
            </div>
            {(restaurant?.phone || restaurant?.whatsapp || restaurant?.address) && (
              <div className="flex items-center flex-wrap gap-2 mt-2">
                {restaurant?.phone && (
                  <a
                    href={`tel:${restaurant.phone}`}
                    className={`inline-flex items-center gap-1 text-[11px] font-medium ${d ? 'text-white/45 hover:text-white/75' : 'text-gray-500 hover:text-gray-800'} transition-colors`}
                  >
                    <Phone className="h-2.5 w-2.5" />
                    {restaurant.phone}
                  </a>
                )}
                {restaurant?.whatsapp && (
                  <a
                    href={`https://wa.me/${restaurant.whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1 text-[11px] font-medium ${d ? 'text-green-400/70 hover:text-green-400' : 'text-green-600 hover:text-green-700'} transition-colors`}
                  >
                    <Smartphone className="h-2.5 w-2.5" />
                    WhatsApp
                  </a>
                )}
                {restaurant?.address && (
                  <span className={`inline-flex items-center gap-1 text-[11px] ${d ? 'text-white/30' : 'text-gray-400'}`}>
                    <MapPin className="h-2.5 w-2.5" />
                    {restaurant.address}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Social Media Links */}
        {(restaurant?.socialInstagram || restaurant?.socialTwitter || restaurant?.socialTiktok || restaurant?.socialSnapchat || restaurant?.socialFacebook) && (
          <div className={`mt-2 flex items-center gap-2 flex-wrap`}>
            {restaurant?.socialInstagram && (
              <a
                href={`https://instagram.com/${restaurant.socialInstagram.replace('@','')}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${d ? 'bg-white/[0.05] text-white/50 hover:bg-white/[0.1] hover:text-white/80' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-800'} transition-colors`}
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                @{restaurant.socialInstagram.replace('@','')}
              </a>
            )}
            {restaurant?.socialTwitter && (
              <a
                href={`https://x.com/${restaurant.socialTwitter.replace('@','')}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${d ? 'bg-white/[0.05] text-white/50 hover:bg-white/[0.1] hover:text-white/80' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-800'} transition-colors`}
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.259 5.63 5.905-5.63zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                @{restaurant.socialTwitter.replace('@','')}
              </a>
            )}
            {restaurant?.socialTiktok && (
              <a
                href={`https://tiktok.com/@${restaurant.socialTiktok.replace('@','')}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${d ? 'bg-white/[0.05] text-white/50 hover:bg-white/[0.1] hover:text-white/80' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-800'} transition-colors`}
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.27 8.27 0 004.84 1.56V6.79a4.85 4.85 0 01-1.07-.1z"/></svg>
                @{restaurant.socialTiktok.replace('@','')}
              </a>
            )}
            {restaurant?.socialSnapchat && (
              <a
                href={`https://snapchat.com/add/${restaurant.socialSnapchat.replace('@','')}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${d ? 'bg-white/[0.05] text-white/50 hover:bg-white/[0.1] hover:text-white/80' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-800'} transition-colors`}
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12.922-.271.143-.082.291-.123.437-.123.259 0 .5.1.678.285.178.186.264.439.237.7-.073.568-.582.884-1.105 1.066-.209.073-.426.127-.59.178-.241.073-.448.135-.61.207-.31.137-.497.346-.592.58-.097.249-.094.562-.089.875v.033c.022.601.07 1.215.331 1.756.264.557.704.964 1.378 1.285.342.16.704.283 1.069.396.229.07.455.138.671.216.402.147.635.326.745.543.113.223.053.489-.084.694-.21.316-.58.534-1.141.63-.56.097-1.25.089-1.983-.041-.358-.063-.89-.195-1.364-.316-.326-.083-.64-.163-.877-.2-.149-.023-.32.005-.537.056.068 1.159.197 2.362-.133 3.364-.401 1.215-1.198 2.207-2.364 2.946C14.675 23.594 13.454 24 12.19 24c-1.264 0-2.485-.406-3.626-1.208-1.166-.739-1.963-1.731-2.364-2.946-.33-1.002-.199-2.205-.131-3.364a2.268 2.268 0 00-.542-.059l-.074.008c-.236.036-.544.113-.864.194-.474.121-1.009.253-1.369.316-.728.131-1.419.138-1.978.042-.561-.097-.931-.315-1.141-.63-.138-.207-.197-.472-.084-.695.11-.218.343-.396.745-.543.218-.078.444-.146.672-.216.367-.113.728-.236 1.071-.397.674-.32 1.114-.727 1.378-1.284.263-.545.31-1.16.332-1.768v-.022c.004-.251.005-.504-.003-.75-.008-.234-.088-.543-.294-.797-.155-.191-.389-.344-.638-.45-.162-.072-.369-.134-.61-.208-.164-.05-.381-.105-.59-.177-.523-.183-1.032-.499-1.105-1.067-.026-.261.059-.514.237-.7.178-.186.419-.284.678-.284.146 0 .294.04.437.122.263.152.622.287.922.272.195 0 .325-.046.401-.091-.008-.165-.018-.33-.03-.51l-.003-.06c-.104-1.628-.23-3.654.299-4.847C6.86 1.069 10.216.793 11.206.793h1z"/></svg>
                @{restaurant.socialSnapchat.replace('@','')}
              </a>
            )}
            {restaurant?.socialFacebook && (
              <a
                href={`https://facebook.com/${restaurant.socialFacebook.replace('@','')}`}
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${d ? 'bg-white/[0.05] text-white/50 hover:bg-white/[0.1] hover:text-white/80' : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-800'} transition-colors`}
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                {restaurant.socialFacebook.replace('@','')}
              </a>
            )}
          </div>
        )}
      </div>

      {/* Search & Category tabs - sticky */}
      <div className={`sticky top-0 z-20 ${d ? 'bg-[#111]/96' : 'bg-gray-50/96'} backdrop-blur-xl border-b ${d ? 'border-white/[0.05]' : 'border-gray-200/70'}`}>
        <div className="max-w-lg mx-auto px-4 pt-3 pb-2.5">
          <div className="relative">
            <Search className={`absolute ${direction === 'rtl' ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 h-4 w-4 ${d ? 'text-white/25' : 'text-gray-400'}`} />
            <Input
              placeholder={t("searchMenu")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`${direction === 'rtl' ? 'pr-10' : 'pl-10'} h-11 rounded-xl border-0 ${d ? 'bg-white/[0.07] text-white placeholder:text-white/25 ring-1 ring-white/[0.07] focus:bg-white/[0.09] focus:ring-white/10' : 'bg-white text-gray-900 placeholder:text-gray-400 ring-1 ring-gray-200 shadow-sm focus:ring-[#8B1A1A]/30'} text-sm transition-all`}
              data-testid="input-search-menu"
            />
            {searchQuery && (
              <Button variant="ghost" size="icon" className={`absolute ${direction === 'rtl' ? 'left-1.5' : 'right-1.5'} top-1/2 -translate-y-1/2 h-7 w-7 rounded-full ${d ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`} onClick={() => setSearchQuery("")}>
                <X className={`h-3.5 w-3.5 ${d ? 'text-white/40' : 'text-gray-400'}`} />
              </Button>
            )}
          </div>
        </div>
        {/* Category tabs - pill chip style */}
        <div ref={categoryTabsRef} className="max-w-lg mx-auto px-3 pb-3 flex gap-1.5 overflow-x-auto scrollbar-hide">
          <button
            className={`flex-shrink-0 px-3.5 h-7 rounded-full text-[12px] font-semibold whitespace-nowrap transition-all duration-200 ${activeCategoryId === null
              ? 'bg-[#8B1A1A] text-white shadow-sm'
              : d ? 'bg-white/[0.06] text-white/45 hover:bg-white/[0.1] hover:text-white/70 ring-1 ring-white/[0.06]' : 'bg-white text-gray-500 hover:bg-gray-100 ring-1 ring-gray-200/60 shadow-sm'}`}
            onClick={() => handleCategoryClick(null)}
            data-testid="button-category-all"
            data-tab-category="all"
          >
            {t("allCategories")}
          </button>
          {categories?.map((cat) => (
            <button
              key={cat.id}
              className={`flex-shrink-0 px-3.5 h-7 rounded-full text-[12px] font-semibold whitespace-nowrap transition-all duration-200 ${activeCategoryId === cat.id
                ? 'bg-[#8B1A1A] text-white shadow-sm'
                : d ? 'bg-white/[0.06] text-white/45 hover:bg-white/[0.1] hover:text-white/70 ring-1 ring-white/[0.06]' : 'bg-white text-gray-500 hover:bg-gray-100 ring-1 ring-gray-200/60 shadow-sm'}`}
              onClick={() => handleCategoryClick(cat.id)}
              data-testid={`button-category-${cat.id}`}
              data-tab-category={cat.id}
            >
              {getLocalizedName(cat.nameEn, cat.nameAr)}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-lg mx-auto px-4 pb-36 pt-4">
        {!canOrder && (
          <div className={`flex items-center gap-2.5 ${d ? 'bg-red-950/30 text-red-300' : 'bg-red-50 text-red-600'} rounded-lg p-3 mb-4 text-xs font-medium`}>
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>
              {!restaurantOpen
                ? (language === "ar" ? "المطعم مغلق حالياً" : "Restaurant is currently closed")
                : (language === "ar" ? "المطعم لم يبدأ يوم العمل بعد" : "Restaurant has not started yet")
              }
            </span>
          </div>
        )}

        {/* Menu items */}
        <div className="space-y-2">
          {filteredItems?.map((item, index) => {
            const itemVariants = allVariants?.[item.id] || [];
            const hasVariants = itemVariants.length > 0;
            const cartItem = cart.find(c => c.menuItem.id === item.id);
            const inCart = !!cartItem;
            const prevItem = index > 0 ? filteredItems[index - 1] : null;
            const showCatHeader = !selectedCategory && !searchQuery && (!prevItem || prevItem.categoryId !== item.categoryId);
            const catHeader = showCatHeader ? categories?.find(c => c.id === item.categoryId) : null;
            return (
              <Fragment key={item.id}>
                {catHeader && (
                  <div className="pt-6 pb-2 first:pt-0" data-category-section={catHeader.id}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-1 h-4 rounded-full bg-[#8B1A1A] flex-shrink-0" />
                      <h2 className={`text-[13px] font-bold ${d ? 'text-white/70' : 'text-gray-600'} uppercase tracking-widest`}>
                        {getLocalizedName(catHeader.nameEn, catHeader.nameAr)}
                      </h2>
                    </div>
                  </div>
                )}
                {/* Menu item card */}
                <div
                  className={`flex gap-3.5 ${d ? 'bg-[#1a1a1a] border-white/[0.05] hover:border-white/[0.09]' : 'bg-white border-gray-100/80 shadow-[0_1px_4px_rgba(0,0,0,0.06)] hover:shadow-[0_2px_10px_rgba(0,0,0,0.1)]'} border rounded-2xl p-3.5 ${!item.isAvailable ? "opacity-30 pointer-events-none" : "cursor-pointer active:scale-[0.99]"} transition-all duration-200`}
                  onClick={() => {
                    if (!item.isAvailable) return;
                    const currentUrl = tableId 
                      ? `/m/${restaurantId}/table/${tableId}${window.location.search}`
                      : `/m/${restaurantId}/menu`;
                    localStorage.setItem(`return_url_${restaurantId}`, currentUrl);
                    setLocation(`/m/${restaurantId}/item/${item.id}`);
                  }}
                  data-testid={`card-menu-item-${item.id}`}
                >
                  {/* Image */}
                  <div className={`w-[88px] h-[88px] rounded-xl overflow-hidden flex-shrink-0 relative ${d ? 'bg-white/[0.04]' : 'bg-gray-100'}`}>
                    {item.image ? (
                      <img src={item.image} alt="" className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center ${d ? 'bg-white/[0.03]' : 'bg-gray-50'}`}>
                        <UtensilsCrossed className={`h-6 w-6 ${d ? 'text-white/[0.08]' : 'text-gray-200'}`} />
                      </div>
                    )}
                    {item.isBestseller && (
                      <div className="absolute top-1.5 left-1.5">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${d ? 'bg-amber-500/80 text-white' : 'bg-amber-400 text-white'} shadow-sm`}>★</span>
                      </div>
                    )}
                    {item.isNew && (
                      <div className="absolute top-1.5 right-1.5">
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${d ? 'bg-emerald-500/80 text-white' : 'bg-emerald-500 text-white'} shadow-sm`}>{language === "ar" ? "جديد" : "NEW"}</span>
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                    <div>
                      <h3 className={`font-semibold text-[14px] ${d ? 'text-white' : 'text-gray-900'} leading-snug line-clamp-1`} data-testid={`text-item-name-${item.id}`}>
                        {getLocalizedName(item.nameEn, item.nameAr)}
                      </h3>
                      {(item.descriptionEn || item.descriptionAr) && (
                        <p className={`text-[11.5px] ${d ? 'text-white/30' : 'text-gray-400'} mt-0.5 line-clamp-2 leading-relaxed`}>
                          {getLocalizedName(item.descriptionEn || "", item.descriptionAr || "")}
                        </p>
                      )}
                      {(item.isSpicy || item.isVegetarian || item.calories) && (
                        <div className="flex items-center gap-1.5 mt-1.5">
                          {item.isSpicy && (
                            <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${d ? 'text-red-400/70' : 'text-red-500'}`}>
                              <Flame className="h-2.5 w-2.5" />
                              {language === "ar" ? "حار" : "Spicy"}
                            </span>
                          )}
                          {item.isVegetarian && (
                            <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${d ? 'text-green-400/70' : 'text-green-600'}`}>
                              <Leaf className="h-2.5 w-2.5" />
                              {language === "ar" ? "نباتي" : "Veg"}
                            </span>
                          )}
                          {item.calories && <span className={`text-[10px] ${d ? 'text-white/20' : 'text-gray-300'}`}>{item.calories} cal</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div>
                        {hasVariants && <p className={`text-[10px] font-medium ${d ? 'text-white/30' : 'text-gray-400'} mb-0.5`}>{language === "ar" ? "يبدأ من" : "From"}</p>}
                        <p className={`font-bold text-[15px] text-[#8B1A1A] tabular-nums leading-none`} data-testid={`text-item-price-${item.id}`}>
                          {parseFloat(item.price).toFixed(2)}
                          <span className={`text-[11px] font-normal ${d ? 'text-white/25' : 'text-gray-400'} ${direction === 'rtl' ? 'mr-0.5' : 'ml-0.5'}`}>{t("sar")}</span>
                        </p>
                      </div>
                      {inCart ? (
                        <div className={`flex items-center gap-0.5 ${d ? 'bg-white/[0.08] ring-1 ring-white/[0.06]' : 'bg-gray-100 ring-1 ring-gray-200/50'} rounded-xl px-1`} onClick={(e) => e.stopPropagation()}>
                          <button className={`w-7 h-7 flex items-center justify-center rounded-lg ${d ? 'text-white/50 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200'} transition-colors`} onClick={() => updateQuantity(cart.find(c => c.menuItem.id === item.id)!.cartKey, -1)}>
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className={`w-6 text-center text-[13px] font-bold ${d ? 'text-white' : 'text-gray-900'} tabular-nums`}>
                            {cart.filter(c => c.menuItem.id === item.id).reduce((s, c) => s + c.quantity, 0)}
                          </span>
                          <button className={`w-7 h-7 flex items-center justify-center rounded-lg ${d ? 'text-white/50 hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200'} transition-colors`} onClick={() => updateQuantity(cart.find(c => c.menuItem.id === item.id)!.cartKey, 1)}>
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      ) : item.isAvailable && canOrder ? (
                        <button
                          className={`w-8 h-8 rounded-xl ${d ? 'bg-white/90 text-[#111] hover:bg-white' : 'bg-[#8B1A1A] text-white hover:bg-[#9e1f1f]'} flex items-center justify-center transition-all active:scale-90 shadow-sm`}
                          onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                        >
                          <Plus className="h-4 w-4" strokeWidth={2.5} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Fragment>
            );
          })}
        </div>

        {filteredItems?.length === 0 && (
          <div className="text-center py-20" data-testid="empty-menu-state">
            <div className={`w-16 h-16 rounded-2xl ${d ? 'bg-white/[0.04]' : 'bg-gray-100'} flex items-center justify-center mx-auto mb-4`}>
              <Search className={`h-7 w-7 ${d ? 'text-white/15' : 'text-gray-300'}`} />
            </div>
            <p className={`${d ? 'text-white/40' : 'text-gray-400'} text-[14px] font-medium`} data-testid="text-no-items">{t("noItems")}</p>
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className={`mt-3 text-[12px] font-semibold ${d ? 'text-white/30 hover:text-white/50' : 'text-gray-400 hover:text-gray-600'} transition-colors`}>
                {language === "ar" ? "مسح البحث" : "Clear search"}
              </button>
            )}
          </div>
        )}
      </main>

      {/* Cart bar */}
      {cart.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-30" data-testid="cart-footer">
          <div className="max-w-lg mx-auto">
            <button
              onClick={() => canOrder && setShowCheckout(true)}
              disabled={!canOrder}
              className={`w-full ${d ? 'bg-white text-[#111] disabled:bg-white/20 disabled:text-white/30' : 'bg-[#8B1A1A] text-white disabled:bg-gray-300 disabled:text-gray-500'} rounded-2xl h-[60px] px-5 flex items-center justify-between shadow-xl transition-all active:scale-[0.98]`}
              data-testid="button-checkout"
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl ${d ? 'bg-[#111]/15' : 'bg-white/20'} flex items-center justify-center relative`}>
                  <ShoppingCart className="h-[18px] w-[18px]" />
                  <span className={`absolute -top-1 ${direction === 'rtl' ? '-left-1' : '-right-1'} h-4.5 min-w-[18px] w-[18px] px-0 ${d ? 'bg-[#8B1A1A] text-white' : 'bg-white text-[#8B1A1A]'} rounded-full text-[9px] font-bold flex items-center justify-center`} data-testid="badge-cart-count">
                    {cart.reduce((sum, item) => sum + item.quantity, 0)}
                  </span>
                </div>
                <span className="font-bold text-[15px]">{t("checkout")}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-bold text-[18px] tabular-nums leading-none" data-testid="text-cart-total">{totalWithTax.toFixed(2)}</span>
                <span className="text-[11px] font-normal opacity-70">{t("sar")}</span>
              </div>
            </button>
          </div>
        </div>
      )}

      <Dialog open={showOrderHistory} onOpenChange={setShowOrderHistory}>
        <DialogContent className={`max-w-md max-h-[80vh] overflow-y-auto rounded-2xl border ${d ? 'bg-[#1a1a1a] border-white/[0.08]' : 'bg-white border-gray-200/60'}`} dir={direction}>
          <DialogHeader>
            <DialogTitle className={d ? 'text-white' : 'text-gray-900'}>{language === "ar" ? "طلباتي السابقة" : "My Previous Orders"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {customerOrders && customerOrders.length > 0 ? (
              customerOrders.map((o: any) => (
                <div
                  key={o.id}
                  className={`rounded-xl p-3.5 cursor-pointer transition-colors ${d ? 'bg-white/5 hover:bg-white/10 border border-white/5' : 'bg-gray-50 hover:bg-gray-100 border border-gray-100'}`}
                  onClick={() => { setShowOrderHistory(false); setLocation(isPublic ? `/m/${restaurantId}/order-status/${o.id}` : `/order-status/${o.id}`); }}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-semibold text-sm ${d ? 'text-white' : 'text-gray-900'}`}>#{o.orderNumber}</span>
                    <Badge className={`text-[10px] h-5 ${
                      o.status === 'completed' ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20' :
                      o.status === 'cancelled' ? 'bg-red-500/20 text-red-400 hover:bg-red-500/20' :
                      o.status === 'ready' ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/20' :
                      'bg-amber-500/20 text-amber-400 hover:bg-amber-500/20'
                    }`}>
                      {o.status === "pending" ? (language === "ar" ? "بالانتظار" : "Pending") :
                       o.status === "preparing" ? (language === "ar" ? "جاري التحضير" : "Preparing") :
                       o.status === "ready" ? (language === "ar" ? "جاهز" : "Ready") :
                       o.status === "completed" ? (language === "ar" ? "مكتمل" : "Completed") :
                       o.status === "cancelled" ? (language === "ar" ? "ملغي" : "Cancelled") : o.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <span className={`text-xs ${d ? 'text-white/40' : 'text-gray-400'}`}>
                      {new Date(o.createdAt).toLocaleDateString(language === "ar" ? "ar-SA" : "en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <span className="text-sm font-bold text-[#8B1A1A]">
                      {parseFloat(o.total || "0").toFixed(2)} {t("sar")}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className={`text-center py-8 ${d ? 'text-white/40' : 'text-gray-400'}`}>
                {language === "ar" ? "لا توجد طلبات سابقة" : "No previous orders"}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Item Detail Dialog with Variants & Customizations */}
      <Dialog open={!!showItemDetail} onOpenChange={(open) => { if (!open) setShowItemDetail(null); }}>
        <DialogContent className={`max-w-md max-h-[90vh] overflow-y-auto p-0 rounded-2xl border ${d ? 'border-white/[0.08] bg-[#1a1a1a]' : 'border-gray-200/60 bg-white'} shadow-lg`} dir={direction}>
          {showItemDetail && (() => {
            const item = showItemDetail;
            const variants = allVariants?.[item.id] || [];
            const custGroups = allCustomizations?.[item.id] || [];
            const basePrice = parseFloat(item.price);
            const variantAdj = detailVariant?.priceAdjustment || 0;
            const custAdj = detailCustomizations.reduce((s, c) => s + c.priceAdjustment, 0);
            const totalPrice = (basePrice + variantAdj + custAdj) * detailQuantity;

            return (
              <>
                {item.image ? (
                  <div className="w-full h-52 sm:h-60 overflow-hidden relative">
                    <img src={item.image} alt={getLocalizedName(item.nameEn, item.nameAr)} className="w-full h-full object-cover" />
                    <div className={`absolute inset-0 bg-gradient-to-t ${d ? 'from-[#1c1c1c]' : 'from-white'} via-transparent to-black/20`} />
                  </div>
                ) : (
                  <div className={`w-full h-40 bg-gradient-to-br ${d ? 'from-[#2a1a1a] to-[#1c1c1c]' : 'from-gray-100 to-white'} flex items-center justify-center`}>
                    <span className={`text-7xl font-black ${d ? 'text-white/5' : 'text-gray-200'}`}>{getLocalizedName(item.nameEn, item.nameAr).charAt(0)}</span>
                  </div>
                )}

                <div className="p-5 sm:p-6 space-y-5">
                  <div>
                    <h2 className={`text-[22px] sm:text-2xl font-bold ${d ? 'text-white' : 'text-gray-900'} leading-snug`}>{getLocalizedName(item.nameEn, item.nameAr)}</h2>
                    {(item.descriptionEn || item.descriptionAr) && (
                      <p className={`text-[13px] ${d ? 'text-white/40' : 'text-gray-500'} mt-1.5 leading-relaxed`}>{getLocalizedName(item.descriptionEn || "", item.descriptionAr || "")}</p>
                    )}
                    <div className="flex items-center justify-between mt-3">
                      <p className="text-[22px] font-bold text-[#8B1A1A] tabular-nums">
                        {(basePrice + variantAdj + custAdj).toFixed(2)} <span className={`text-[13px] font-medium ${d ? 'text-white/40' : 'text-gray-400'}`}>{t("sar")}</span>
                      </p>
                      <div className="flex gap-1.5">
                        {item.isSpicy && <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full ${d ? 'bg-red-950/40 text-red-400 border border-red-800/30' : 'bg-red-50 text-red-500 border border-red-100'}`}><Flame className="h-3 w-3" />{language === "ar" ? "حار" : "Spicy"}</span>}
                        {item.isVegetarian && <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full ${d ? 'bg-green-950/40 text-green-400 border border-green-800/30' : 'bg-green-50 text-green-600 border border-green-100'}`}><Leaf className="h-3 w-3" />{language === "ar" ? "نباتي" : "Veg"}</span>}
                        {item.calories && <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${d ? 'bg-white/[0.04] text-white/40 border border-white/[0.07]' : 'bg-gray-50 text-gray-400 border border-gray-100'}`}>{item.calories} cal</span>}
                      </div>
                    </div>
                  </div>

                  {/* Variants (Sizes) */}
                  {variants.length > 0 && (
                    <div className="space-y-3">
                      <h3 className={`font-bold text-sm ${d ? 'text-white' : 'text-gray-900'}`}>{language === "ar" ? "اختر الحجم" : "Choose Size"}</h3>
                      <RadioGroup
                        value={detailVariant?.id || ""}
                        onValueChange={(val) => {
                          const v = variants.find((vr: any) => vr.id === val);
                          if (v) {
                            setDetailVariant({
                              id: v.id,
                              nameEn: v.nameEn,
                              nameAr: v.nameAr,
                              priceAdjustment: parseFloat(v.priceAdjustment || "0"),
                            });
                          }
                        }}
                        className="space-y-2"
                      >
                        {variants.map((v: any) => (
                          <div
                            key={v.id}
                            className={`flex items-center justify-between rounded-xl p-3.5 cursor-pointer transition-all duration-200 ${detailVariant?.id === v.id ? "bg-[#8B1A1A]/20 ring-2 ring-[#8B1A1A]" : d ? "bg-white/5 ring-1 ring-white/10 hover:ring-[#8B1A1A]/50" : "bg-gray-50 ring-1 ring-gray-200 hover:ring-[#8B1A1A]/50"}`}
                            onClick={() => setDetailVariant({
                              id: v.id,
                              nameEn: v.nameEn,
                              nameAr: v.nameAr,
                              priceAdjustment: parseFloat(v.priceAdjustment || "0"),
                            })}
                          >
                            <div className="flex items-center gap-3">
                              <RadioGroupItem value={v.id} id={`variant-${v.id}`} />
                              <Label htmlFor={`variant-${v.id}`} className="cursor-pointer font-medium text-sm">
                                {getLocalizedName(v.nameEn, v.nameAr)}
                              </Label>
                            </div>
                            <span className={`text-sm font-semibold ${d ? 'text-white' : 'text-gray-900'}`}>
                              {parseFloat(v.priceAdjustment || "0") > 0
                                ? `+${parseFloat(v.priceAdjustment).toFixed(2)}`
                                : parseFloat(v.priceAdjustment || "0") < 0
                                ? parseFloat(v.priceAdjustment).toFixed(2)
                                : (language === "ar" ? "مجاناً" : "Free")
                              } {parseFloat(v.priceAdjustment || "0") !== 0 ? t("sar") : ""}
                            </span>
                          </div>
                        ))}
                      </RadioGroup>
                    </div>
                  )}

                  {/* Customizations */}
                  {custGroups.map((group: any) => (
                    <div key={group.id} className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className={`font-bold text-sm ${d ? 'text-white' : 'text-gray-900'}`}>{getLocalizedName(group.nameEn, group.nameAr)}</h3>
                        {group.isRequired && (
                          <Badge className="text-[10px] h-5 bg-[#8B1A1A] hover:bg-[#8B1A1A] text-white rounded-md">{language === "ar" ? "مطلوب" : "Required"}</Badge>
                        )}
                      </div>
                      {group.selectionType === "single" ? (
                        <RadioGroup
                          value={detailCustomizations.find(c => c.groupId === group.id)?.optionId || ""}
                          onValueChange={(val) => {
                            const opt = group.options?.find((o: any) => o.id === val);
                            if (opt) {
                              setDetailCustomizations(prev => [
                                ...prev.filter(c => c.groupId !== group.id),
                                {
                                  groupId: group.id,
                                  optionId: opt.id,
                                  nameEn: opt.nameEn,
                                  nameAr: opt.nameAr,
                                  priceAdjustment: parseFloat(opt.priceAdjustment || "0"),
                                },
                              ]);
                            }
                          }}
                          className="space-y-2"
                        >
                          {group.options?.map((opt: any) => (
                            <div
                              key={opt.id}
                              className={`flex items-center justify-between rounded-xl p-3.5 cursor-pointer transition-all duration-200 ${detailCustomizations.find(c => c.optionId === opt.id) ? "bg-[#8B1A1A]/20 ring-2 ring-[#8B1A1A]" : d ? "bg-white/5 ring-1 ring-white/10 hover:ring-[#8B1A1A]/50" : "bg-gray-50 ring-1 ring-gray-200 hover:ring-[#8B1A1A]/50"}`}
                              onClick={() => {
                                setDetailCustomizations(prev => [
                                  ...prev.filter(c => c.groupId !== group.id),
                                  {
                                    groupId: group.id,
                                    optionId: opt.id,
                                    nameEn: opt.nameEn,
                                    nameAr: opt.nameAr,
                                    priceAdjustment: parseFloat(opt.priceAdjustment || "0"),
                                  },
                                ]);
                              }}
                            >
                              <div className="flex items-center gap-3">
                                <RadioGroupItem value={opt.id} id={`opt-${opt.id}`} />
                                <Label htmlFor={`opt-${opt.id}`} className="cursor-pointer text-sm">
                                  {getLocalizedName(opt.nameEn, opt.nameAr)}
                                </Label>
                              </div>
                              {parseFloat(opt.priceAdjustment || "0") !== 0 && (
                                <span className={`text-sm font-semibold ${d ? 'text-white' : 'text-gray-900'}`}>
                                  +{parseFloat(opt.priceAdjustment).toFixed(2)} {t("sar")}
                                </span>
                              )}
                            </div>
                          ))}
                        </RadioGroup>
                      ) : (
                        <div className="space-y-2">
                          {group.options?.map((opt: any) => {
                            const isChecked = detailCustomizations.some(c => c.optionId === opt.id);
                            return (
                              <div
                                key={opt.id}
                                className={`flex items-center justify-between rounded-xl p-3.5 cursor-pointer transition-all duration-200 ${isChecked ? "bg-[#8B1A1A]/20 ring-2 ring-[#8B1A1A]" : d ? "bg-white/5 ring-1 ring-white/10 hover:ring-[#8B1A1A]/50" : "bg-gray-50 ring-1 ring-gray-200 hover:ring-[#8B1A1A]/50"}`}
                                onClick={() => {
                                  setDetailCustomizations(prev =>
                                    isChecked
                                      ? prev.filter(c => c.optionId !== opt.id)
                                      : [...prev, {
                                          groupId: group.id,
                                          optionId: opt.id,
                                          nameEn: opt.nameEn,
                                          nameAr: opt.nameAr,
                                          priceAdjustment: parseFloat(opt.priceAdjustment || "0"),
                                        }]
                                  );
                                }}
                              >
                                <div className="flex items-center gap-3">
                                  <Checkbox checked={isChecked} id={`cust-${opt.id}`} />
                                  <Label htmlFor={`cust-${opt.id}`} className="cursor-pointer text-sm">
                                    {getLocalizedName(opt.nameEn, opt.nameAr)}
                                  </Label>
                                </div>
                                {parseFloat(opt.priceAdjustment || "0") !== 0 && (
                                  <span className={`text-sm font-semibold ${d ? 'text-white' : 'text-gray-900'}`}>
                                    +{parseFloat(opt.priceAdjustment).toFixed(2)} {t("sar")}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Quantity & Add to Cart */}
                  <div className={`flex items-center gap-3 pt-5 border-t ${d ? 'border-white/10' : 'border-gray-200'}`}>
                    <div className={`flex items-center gap-1 ${d ? 'bg-white/[0.06] ring-1 ring-white/[0.08]' : 'bg-gray-100 ring-1 ring-gray-200/60'} rounded-xl p-1`}>
                      <Button size="icon" variant="ghost" className={`h-10 w-10 rounded-lg ${d ? 'hover:bg-white/10 text-white/80' : 'hover:bg-gray-200 text-gray-700'}`} onClick={() => setDetailQuantity(Math.max(1, detailQuantity - 1))}>
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className={`text-lg font-bold w-10 text-center tabular-nums ${d ? 'text-white' : 'text-gray-900'}`}>{detailQuantity}</span>
                      <Button size="icon" variant="ghost" className={`h-10 w-10 rounded-lg ${d ? 'hover:bg-white/10 text-white/80' : 'hover:bg-gray-200 text-gray-700'}`} onClick={() => setDetailQuantity(detailQuantity + 1)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button
                      className="flex-1 gap-2.5 bg-[#8B1A1A] hover:bg-[#9e1f1f] text-white h-12 rounded-xl shadow-md text-[15px] font-bold border-0 active:scale-[0.98] transition-all"
                      onClick={addToCartFromDetail}
                    >
                      <ShoppingCart className="h-4 w-4" />
                      <span>
                        {language === "ar" ? "أضف للسلة" : "Add to Cart"} · {totalPrice.toFixed(2)} <span className="text-[11px] font-normal opacity-70">{t("sar")}</span>
                      </span>
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

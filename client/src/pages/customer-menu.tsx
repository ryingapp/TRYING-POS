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

  // Check for paid deposit when phone number changes
  useEffect(() => {
    if (depositCheckTimer.current) clearTimeout(depositCheckTimer.current);
    setDepositInfo(null);
    const phone = customerPhone.replace(/\s/g, '');
    if (phone.length >= 5 && isPublic) {
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
    let price = parseFloat(cartItem.menuItem.price);
    if (cartItem.selectedVariant) {
      price += cartItem.selectedVariant.priceAdjustment;
    }
    if (cartItem.selectedCustomizations?.length) {
      price += cartItem.selectedCustomizations.reduce((s, c) => s + c.priceAdjustment, 0);
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
      } else {
        setCouponError(data.error || (language === "ar" ? "كود غير صالح" : "Invalid code"));
        setCouponDiscount(0);
        setCouponApplied(null);
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
        status: orderData.paymentMethod === "tap_to_pay" ? "payment_pending" : "pending",
        isPaid: false,
      });

      const order = await response.json();

      for (const item of orderData.items) {
        const itemEndpoint = isPublic ? `${apiBase}/orders/${order.id}/items` : `/api/orders/${order.id}/items`;
        await apiRequest("POST", itemEndpoint, {
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          notes: item.notes || null,
        });
      }

      return order;
    },
    onSuccess: (order) => {
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
            ? (language === "ar" ? `تم خصم ${depositAmt} ريال (رسوم الحجز) من فاتورتك` : `${depositAmt} SAR booking fee deducted from your bill`)
            : (language === "ar" ? "بتقدر تدفع بعد ما تخلص أكلك" : "You can pay after you finish your meal"),
        });
        refetchActiveOrder();
      } else if (paymentMethod === "tap_to_pay") {
        setLocation(`/payment/${order.id}`);
      } else {
        toast({
          title: t("orderPlaced"),
          description: `${t("orderNumber")} ${order.orderNumber}`,
        });
        setLocation(isPublic ? `/m/${restaurantId}/order-status/${order.id}` : `/order-status/${order.id}`);
      }
    },
    onError: (error: any) => {
      // التعامل مع خطأ تعارض الطاولة
      if (error?.error === "Table has an active order") {
        toast({
          variant: "destructive",
          title: language === "ar" ? "الطاولة مشغولة" : "Table Occupied",
          description: language === "ar" 
            ? "الطاولة لديها طلب نشط. يرجى الانتظار أو التواصل مع الموظف." 
            : "This table has an active order. Please wait or contact staff.",
        });
        refetchActiveOrder();
      } else {
        toast({
          variant: "destructive",
          title: t("error"),
          description: t("orderFailed"),
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
    const cartKey = `${item.id}_${detailVariant?.id || "none"}_${detailCustomizations.map(c => c.optionId).sort().join(",")}`;
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

  const [scrollSpyCategory, setScrollSpyCategory] = useState<string | null>(null);

  // When user clicks a category tab, scroll to that section
  const handleCategoryClick = useCallback((catId: string | null) => {
    userClickedCategoryRef.current = true;
    setSelectedCategory(catId);
    setScrollSpyCategory(catId);
    if (catId) {
      // scroll to the section
      setTimeout(() => {
        const el = document.querySelector(`[data-category-section="${catId}"]`) as HTMLElement;
        if (el) {
          const offset = 160; // account for sticky header + tabs
          const top = el.getBoundingClientRect().top + window.scrollY - offset;
          window.scrollTo({ top, behavior: 'smooth' });
        }
        // Re-enable scroll spy after scroll animation finishes
        setTimeout(() => {
          userClickedCategoryRef.current = false;
          setSelectedCategory(null); // back to showing all, but scrollSpyCategory tracks the visual highlight
        }, 600);
      }, 50);
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => { userClickedCategoryRef.current = false; }, 600);
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
    if (!customerPhone.trim()) {
      toast({
        variant: "destructive",
        title: language === "ar" ? "أدخل رقم الجوال" : "Enter phone number",
      });
      return;
    }
    setShowConfirmation(true);
  };

  const submitOrder = () => {
    setShowConfirmation(false);
    placeOrderMutation.mutate({
      orderType,
      tableId: tableId || null,
      customerName,
      customerPhone,
      customerAddress,
      kitchenNotes,
      paymentMethod: paymentMethod === "tap_to_pay" ? "edfapay_online" : "cash",
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

  if (isPublic && tableId && loggedInCustomer && activeOrder && !activeOrder.isPaid) {
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

        <main className="max-w-lg mx-auto p-4 space-y-4">
          <div className="text-center py-4">
            <div className={`inline-flex items-center gap-2 ${d ? 'bg-[#8B1A1A]/15 text-[#e88]' : 'bg-[#8B1A1A]/8 text-[#8B1A1A]'} px-4 py-2 rounded-full text-sm font-medium`}>
              <Badge variant="secondary" className="bg-[#8B1A1A] text-white">
                {table ? `${language === "ar" ? "طاولة" : "Table"} ${table.tableNumber}` : ""}
              </Badge>
              <span>{statusText(activeOrder.status)}</span>
            </div>
          </div>

          <div className={`${d ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-gray-200/60 shadow-sm'} rounded-2xl border p-5`}>
              <div className="flex items-center justify-between mb-4">
                <h2 className={`text-lg font-bold ${d ? 'text-white' : 'text-gray-900'}`}>
                  {language === "ar" ? "طلبك الحالي" : "Your Current Order"}
                </h2>
                <span className={`text-sm ${d ? 'text-white/40' : 'text-gray-400'}`}>#{activeOrder.orderNumber}</span>
              </div>

              <div className="space-y-3">
                {activeOrder.items?.map((item: any, idx: number) => (
                  <div key={idx} className={`flex items-center justify-between py-2 border-b last:border-0 ${d ? 'border-white/5' : 'border-gray-100'}`}>
                    <div className="flex-1">
                      <p className={`font-medium text-sm ${d ? 'text-white' : 'text-gray-900'}`}>
                        {getLocalizedName(item.menuItem?.nameEn, item.menuItem?.nameAr) || (language === "ar" ? "عنصر" : "Item")}
                      </p>
                      <p className={`text-xs ${d ? 'text-white/40' : 'text-gray-400'}`}>
                        x{item.quantity} • {parseFloat(item.unitPrice || "0").toFixed(2)} {language === "ar" ? "ريال" : "SAR"}
                      </p>
                    </div>
                    <span className={`font-medium text-sm ${d ? 'text-white' : 'text-gray-900'}`}>
                      {parseFloat(item.totalPrice || "0").toFixed(2)} {language === "ar" ? "ريال" : "SAR"}
                    </span>
                  </div>
                ))}
              </div>

              <div className={`mt-4 pt-4 border-t ${d ? 'border-white/10' : 'border-gray-200'} flex items-center justify-between`}>
                <span className={`text-lg font-bold ${d ? 'text-white' : 'text-gray-900'}`}>{language === "ar" ? "المجموع" : "Total"}</span>
                <span className="text-lg font-bold text-[#8B1A1A]">
                  {orderTotal.toFixed(2)} {language === "ar" ? "ريال" : "SAR"}
                </span>
              </div>
          </div>

          {/* إذا الطلب pending - انتظر موافقة الكاشير */}
          {activeOrder.status === "pending" ? (
            <div className={`w-full p-4 rounded-xl text-center ${d ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'}`}>
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                <span className={`font-medium ${d ? 'text-amber-400' : 'text-amber-700'}`}>
                  {language === "ar" ? "بانتظار تأكيد الكاشير" : "Waiting for cashier confirmation"}
                </span>
              </div>
              <p className={`text-sm ${d ? 'text-white/50' : 'text-gray-500'}`}>
                {language === "ar" ? "سيتم تفعيل الدفع بعد مراجعة طلبك" : "Payment will be enabled after your order is reviewed"}
              </p>
            </div>
          ) : (
            <>
              <Button
                className="w-full h-12 text-base bg-[#8B1A1A] hover:bg-[#A02020] text-white gap-2 rounded-xl shadow-sm"
                onClick={() => setLocation(`/payment/${activeOrder.id}`)}
              >
                <Smartphone className="h-5 w-5" />
                {language === "ar" ? "ادفع الآن" : "Pay Now"}
              </Button>

              <p className={`text-center text-xs ${d ? 'text-white/40' : 'text-gray-400'}`}>
                {language === "ar" ? "أو ادفع عند الكاشير" : "Or pay at the cashier"}
              </p>
            </>
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
            <div className={`flex items-center gap-3 ${d ? 'bg-[#8B1A1A]/10 border-[#8B1A1A]/20' : 'bg-[#8B1A1A]/5 border-[#8B1A1A]/15'} border rounded-2xl p-3.5`} data-testid="card-table-info">
              <div className={`w-10 h-10 rounded-xl ${d ? 'bg-[#8B1A1A]/25' : 'bg-[#8B1A1A]/10'} flex items-center justify-center flex-shrink-0`}>
                <MapPin className="h-4 w-4 text-[#8B1A1A]" />
              </div>
              <div>
                <p className={`font-semibold text-sm ${d ? 'text-white' : 'text-gray-900'}`} data-testid="text-table-number">{t("youAreAtTable")} {table.tableNumber}</p>
                {table.location && (
                  <p className={`text-xs ${d ? 'text-white/40' : 'text-gray-400'}`}>{table.location}</p>
                )}
              </div>
            </div>
          )}

          {/* Cart items */}
          <div className="space-y-3">
            <h2 className={`font-bold text-sm ${d ? 'text-white/60' : 'text-gray-500'} uppercase tracking-wider`}>{t("orderItems")}</h2>
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
              <h2 className={`font-bold text-sm ${d ? 'text-white/60' : 'text-gray-500'} uppercase tracking-wider`}>{t("selectOrderType")}</h2>
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
            <h2 className={`font-bold text-sm ${d ? 'text-white/60' : 'text-gray-500'} uppercase tracking-wider`}>{t("customerInfo")}</h2>
            <div className={`${d ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white border-gray-200/60 shadow-sm'} rounded-2xl border p-4 space-y-3`}>
              <div className="relative">
                <Phone className={`absolute ${direction === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 h-4 w-4 ${d ? 'text-white/20' : 'text-gray-400'}`} />
                <Input
                  placeholder={language === "ar" ? "رقم الجوال *" : "Phone Number *"}
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
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
                      ? `رسوم حجز مدفوعة: ${depositInfo.depositAmount} ريال`
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
            <h2 className={`font-bold text-sm ${d ? 'text-white/60' : 'text-gray-500'} uppercase tracking-wider`}>{t("kitchenNotes")}</h2>
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
            <h2 className={`font-bold text-sm ${d ? 'text-white/60' : 'text-gray-500'} uppercase tracking-wider`}>{language === "ar" ? "كود الخصم" : "Discount Code"}</h2>
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
          {!(orderType === "dine_in" && tableId) && (
            <div className="space-y-3">
              <h2 className={`font-bold text-sm ${d ? 'text-white/60' : 'text-gray-500'} uppercase tracking-wider`}>{language === "ar" ? "طريقة الدفع" : "Payment Method"}</h2>
              <div className="grid grid-cols-2 gap-3">
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
              </div>
            </div>
          )}

          {orderType === "dine_in" && tableId && (
            <div className={`${d ? 'bg-blue-950/30 border-blue-800/30' : 'bg-blue-50 border-blue-200'} border rounded-xl p-4 text-center`}>
              <p className={`text-sm ${d ? 'text-blue-300' : 'text-blue-700'}`}>
                {language === "ar" ? "الدفع يكون بعد ما تخلص أكلك - من الكاشير أو من جوالك" : "Pay after you finish your meal - at the cashier or from your phone"}
              </p>
            </div>
          )}

          {/* Order Summary - in scrollable area */}
          <div className="space-y-3">
            <h2 className={`font-bold text-sm ${d ? 'text-white/60' : 'text-gray-500'} uppercase tracking-wider`}>{language === "ar" ? "ملخص الطلب" : "Order Summary"}</h2>
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

        {/* Slim fixed bottom bar - just total + button */}
        <div className={`fixed bottom-0 left-0 right-0 z-20 ${d ? 'bg-[#111]/95 border-white/[0.04]' : 'bg-white/95 border-gray-100'} backdrop-blur-xl border-t`}>
          <div className="max-w-lg mx-auto px-4 py-3.5 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className={`text-[11px] font-medium ${d ? 'text-white/35' : 'text-gray-400'}`}>{t("total")}</p>
              <p className="text-xl font-bold text-[#8B1A1A] tabular-nums leading-tight">
                {depositInfo?.hasDeposit
                  ? Math.max(0, totalWithTax - parseFloat(depositInfo.depositAmount)).toFixed(2)
                  : totalWithTax.toFixed(2)} <span className={`text-[10px] font-normal ${d ? 'text-white/25' : 'text-gray-300'}`}>{t("sar")}</span>
              </p>
            </div>
            <button
              data-testid="button-place-order"
              className="flex-1 h-12 bg-[#8B1A1A] hover:bg-[#A02020] disabled:opacity-40 text-white rounded-xl text-sm font-bold transition-colors active:scale-[0.98]"
              onClick={handlePlaceOrder}
              disabled={placeOrderMutation.isPending || cart.length === 0 || !canOrder}
            >
              {placeOrderMutation.isPending ? "..." : (orderType === "dine_in" && tableId) ? (language === "ar" ? "أرسل للمطبخ" : "Send to Kitchen") : t("confirmOrder")}
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
      {/* Compact Hero Banner */}
      <div className="relative">
        {restaurant?.banner ? (
          <div className="h-36 sm:h-44 w-full overflow-hidden">
            <img src={restaurant.banner} alt="" className="w-full h-full object-cover" />
            <div className={`absolute inset-0 ${d ? 'bg-gradient-to-b from-black/50 to-[#111]' : 'bg-gradient-to-b from-black/30 to-gray-50'}`} />
          </div>
        ) : (
          <div className={`h-28 sm:h-36 w-full ${d ? 'bg-[#1a1a1a]' : 'bg-[#8B1A1A]'}`}>
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
      <div className="max-w-lg mx-auto px-4 -mt-10 relative z-10">
        <div className={`${d ? 'bg-[#1a1a1a] border-white/[0.06]' : 'bg-white border-gray-100 shadow-sm'} border rounded-xl p-3.5 flex items-center gap-3`}>
          {restaurant?.logo ? (
            <div className={`w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 ${d ? 'bg-[#222]' : 'bg-gray-50'}`}>
              <img src={restaurant.logo} alt="" className="w-full h-full object-cover" />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-xl flex-shrink-0 bg-[#8B1A1A] flex items-center justify-center">
              <UtensilsCrossed className="h-5 w-5 text-white/90" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className={`text-base font-bold ${d ? 'text-white' : 'text-gray-900'} truncate`} data-testid="text-restaurant-name">
              {getLocalizedName(restaurant?.nameEn, restaurant?.nameAr) || "Restaurant"}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              {table && (
                <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${d ? 'text-[#e88]' : 'text-[#8B1A1A]'}`} data-testid="badge-table-number">
                  <MapPin className="h-2.5 w-2.5" />
                  {t("youAreAtTable")} {table.tableNumber}
                </span>
              )}
              {restaurant?.openingTime && restaurant?.closingTime && (
                <span className={`inline-flex items-center gap-0.5 text-[10px] ${d ? 'text-white/30' : 'text-gray-400'}`}>
                  <Clock className="h-2.5 w-2.5" />
                  {restaurant.openingTime} - {restaurant.closingTime}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Search & Category tabs - sticky */}
      <div className={`sticky top-0 z-20 ${d ? 'bg-[#111]/95' : 'bg-gray-50/95'} backdrop-blur-xl border-b ${d ? 'border-white/[0.04]' : 'border-gray-200/60'}`}>
        <div className="max-w-lg mx-auto px-4 pt-3 pb-2">
          <div className="relative">
            <Search className={`absolute ${direction === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 h-4 w-4 ${d ? 'text-white/20' : 'text-gray-300'}`} />
            <Input
              placeholder={t("searchMenu")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`${direction === 'rtl' ? 'pr-10' : 'pl-10'} h-10 rounded-lg border-0 ${d ? 'bg-white/[0.06] text-white placeholder:text-white/20 focus:bg-white/[0.08]' : 'bg-white text-gray-900 placeholder:text-gray-400 ring-1 ring-gray-200/80 focus:ring-gray-300'} text-sm`}
              data-testid="input-search-menu"
            />
            {searchQuery && (
              <Button variant="ghost" size="icon" className={`absolute ${direction === 'rtl' ? 'left-1' : 'right-1'} top-1/2 -translate-y-1/2 h-7 w-7 rounded-full ${d ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`} onClick={() => setSearchQuery("")}>
                <X className={`h-3.5 w-3.5 ${d ? 'text-white/40' : 'text-gray-400'}`} />
              </Button>
            )}
          </div>
        </div>
        {/* Category tabs - underline style */}
        <div ref={categoryTabsRef} className="max-w-lg mx-auto px-4 flex gap-0 overflow-x-auto scrollbar-hide">
          <button
            className={`flex-shrink-0 px-3.5 pb-2.5 text-[13px] font-medium border-b-2 transition-colors ${activeCategoryId === null ? `border-[#8B1A1A] ${d ? 'text-white' : 'text-[#8B1A1A]'}` : `border-transparent ${d ? 'text-white/30 hover:text-white/50' : 'text-gray-400 hover:text-gray-600'}`}`}
            onClick={() => handleCategoryClick(null)}
            data-testid="button-category-all"
            data-tab-category="all"
          >
            {t("allCategories")}
          </button>
          {categories?.map((cat) => (
            <button
              key={cat.id}
              className={`flex-shrink-0 px-3.5 pb-2.5 text-[13px] font-medium whitespace-nowrap border-b-2 transition-colors ${activeCategoryId === cat.id ? `border-[#8B1A1A] ${d ? 'text-white' : 'text-[#8B1A1A]'}` : `border-transparent ${d ? 'text-white/30 hover:text-white/50' : 'text-gray-400 hover:text-gray-600'}`}`}
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
                  <div className="pt-5 pb-1.5 first:pt-0" data-category-section={catHeader.id}>
                    <h2 className={`text-sm font-bold ${d ? 'text-white/60' : 'text-gray-500'} uppercase tracking-wide`}>
                      {getLocalizedName(catHeader.nameEn, catHeader.nameAr)}
                    </h2>
                  </div>
                )}
                {/* Menu item row */}
                <div
                  className={`flex gap-3 ${d ? 'bg-[#1a1a1a] border-white/[0.04]' : 'bg-white border-gray-100 shadow-sm'} border rounded-xl p-3 ${!item.isAvailable ? "opacity-30 pointer-events-none" : "cursor-pointer active:scale-[0.99]"} transition-transform`}
                  onClick={() => item.isAvailable && setLocation(`/m/${restaurantId}/item/${item.id}`)}
                  data-testid={`card-menu-item-${item.id}`}
                >
                  {/* Image */}
                  <div className={`w-20 h-20 sm:w-[88px] sm:h-[88px] rounded-lg overflow-hidden flex-shrink-0 ${d ? 'bg-white/[0.04]' : 'bg-gray-100'}`}>
                    {item.image ? (
                      <img src={item.image} alt="" className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center ${d ? 'bg-white/[0.03]' : 'bg-gray-50'}`}>
                        <UtensilsCrossed className={`h-5 w-5 ${d ? 'text-white/[0.08]' : 'text-gray-200'}`} />
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className={`font-semibold text-sm ${d ? 'text-white' : 'text-gray-900'} leading-snug line-clamp-1`} data-testid={`text-item-name-${item.id}`}>
                          {getLocalizedName(item.nameEn, item.nameAr)}
                        </h3>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {item.isNew && <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${d ? 'bg-emerald-500/15 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>{language === "ar" ? "جديد" : "NEW"}</span>}
                          {item.isBestseller && <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${d ? 'bg-amber-500/15 text-amber-400' : 'bg-amber-50 text-amber-600'}`}>★</span>}
                        </div>
                      </div>
                      {(item.descriptionEn || item.descriptionAr) && (
                        <p className={`text-[12px] ${d ? 'text-white/25' : 'text-gray-400'} mt-0.5 line-clamp-2 leading-snug`}>
                          {getLocalizedName(item.descriptionEn || "", item.descriptionAr || "")}
                        </p>
                      )}
                      {(item.isSpicy || item.isVegetarian || item.calories) && (
                        <div className="flex items-center gap-1.5 mt-1">
                          {item.isSpicy && <Flame className={`h-3 w-3 ${d ? 'text-red-400/60' : 'text-red-400'}`} />}
                          {item.isVegetarian && <Leaf className={`h-3 w-3 ${d ? 'text-green-400/60' : 'text-green-500'}`} />}
                          {item.calories && <span className={`text-[10px] ${d ? 'text-white/15' : 'text-gray-300'}`}>{item.calories} cal</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <p className={`font-bold text-sm ${d ? 'text-white' : 'text-gray-900'} tabular-nums`} data-testid={`text-item-price-${item.id}`}>
                        {hasVariants && <span className={`text-[10px] font-normal ${d ? 'text-white/25' : 'text-gray-400'}`}>{language === "ar" ? "من " : "From "}</span>}
                        {parseFloat(item.price).toFixed(2)}
                        <span className={`text-[10px] font-normal ${d ? 'text-white/20' : 'text-gray-300'} ${direction === 'rtl' ? 'mr-0.5' : 'ml-0.5'}`}>{t("sar")}</span>
                      </p>
                      {inCart ? (
                        <div className={`flex items-center ${d ? 'bg-white/[0.06]' : 'bg-gray-100'} rounded-full`} onClick={(e) => e.stopPropagation()}>
                          <button className={`w-7 h-7 flex items-center justify-center rounded-full ${d ? 'text-white/50 hover:bg-white/10' : 'text-gray-500 hover:bg-gray-200'} transition-colors`} onClick={() => updateQuantity(cart.find(c => c.menuItem.id === item.id)!.cartKey, -1)}>
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className={`w-6 text-center text-xs font-bold ${d ? 'text-white' : 'text-gray-900'} tabular-nums`}>
                            {cart.filter(c => c.menuItem.id === item.id).reduce((s, c) => s + c.quantity, 0)}
                          </span>
                          <button className={`w-7 h-7 flex items-center justify-center rounded-full ${d ? 'text-white/50 hover:bg-white/10' : 'text-gray-500 hover:bg-gray-200'} transition-colors`} onClick={() => updateQuantity(cart.find(c => c.menuItem.id === item.id)!.cartKey, 1)}>
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      ) : item.isAvailable && canOrder ? (
                        <button
                          className={`w-7 h-7 rounded-full ${d ? 'bg-white text-[#111]' : 'bg-[#8B1A1A] text-white'} flex items-center justify-center transition-transform active:scale-90`}
                          onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                        >
                          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
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
          <div className="text-center py-16" data-testid="empty-menu-state">
            <Search className={`h-8 w-8 mx-auto mb-3 ${d ? 'text-white/10' : 'text-gray-200'}`} />
            <p className={`${d ? 'text-white/30' : 'text-gray-400'} text-sm`} data-testid="text-no-items">{t("noItems")}</p>
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
              className={`w-full ${d ? 'bg-white text-[#111] disabled:bg-white/20 disabled:text-white/30' : 'bg-[#8B1A1A] text-white disabled:bg-gray-300 disabled:text-gray-500'} rounded-xl h-14 px-4 flex items-center justify-between shadow-lg transition-colors active:scale-[0.98]`}
              data-testid="button-checkout"
            >
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg ${d ? 'bg-[#111]/10' : 'bg-white/20'} flex items-center justify-center relative`}>
                  <ShoppingCart className="h-4 w-4" />
                  <span className={`absolute -top-1 -right-1 h-4 min-w-[16px] px-0.5 ${d ? 'bg-[#8B1A1A] text-white' : 'bg-white text-[#8B1A1A]'} rounded-full text-[9px] font-bold flex items-center justify-center`} data-testid="badge-cart-count">
                    {cart.reduce((sum, item) => sum + item.quantity, 0)}
                  </span>
                </div>
                <span className="font-semibold text-sm">{t("checkout")}</span>
              </div>
              <span className="font-bold text-base tabular-nums" data-testid="text-cart-total">
                {totalWithTax.toFixed(2)} <span className="text-xs font-normal opacity-60">{t("sar")}</span>
              </span>
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
                    <h2 className={`text-xl sm:text-2xl font-bold ${d ? 'text-white' : 'text-gray-900'}`}>{getLocalizedName(item.nameEn, item.nameAr)}</h2>
                    {(item.descriptionEn || item.descriptionAr) && (
                      <p className={`text-sm ${d ? 'text-white/40' : 'text-gray-500'} mt-1.5 leading-relaxed`}>{getLocalizedName(item.descriptionEn || "", item.descriptionAr || "")}</p>
                    )}
                    <p className={`text-xl font-bold ${d ? 'text-white' : 'text-gray-900'} mt-3`}>
                      {(basePrice + variantAdj + custAdj).toFixed(2)} <span className={`text-sm font-medium ${d ? 'text-white/40' : 'text-gray-400'}`}>{t("sar")}</span>
                    </p>
                    <div className="flex gap-2 mt-3">
                      {item.isSpicy && <Badge variant="outline" className="text-red-400 border-red-800/50 bg-red-950/30 rounded-lg"><Flame className="h-3 w-3 mr-1" />{language === "ar" ? "حار" : "Spicy"}</Badge>}
                      {item.isVegetarian && <Badge variant="outline" className="text-green-400 border-green-800/50 bg-green-950/30 rounded-lg"><Leaf className="h-3 w-3 mr-1" />{language === "ar" ? "نباتي" : "Vegetarian"}</Badge>}
                      {item.calories && <Badge variant="outline" className={`${d ? 'text-white/50 border-white/10' : 'text-gray-500 border-gray-200'} rounded-lg`}>{item.calories} {t("calories")}</Badge>}
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
                  <div className={`flex items-center justify-between pt-5 border-t ${d ? 'border-white/10' : 'border-gray-200'}`}>
                    <div className={`flex items-center gap-1 ${d ? 'bg-white/5' : 'bg-gray-100'} rounded-xl p-1`}>
                      <Button size="icon" variant="ghost" className={`h-10 w-10 rounded-lg ${d ? 'hover:bg-white/10 text-white' : 'hover:bg-gray-200 text-gray-900'}`} onClick={() => setDetailQuantity(Math.max(1, detailQuantity - 1))}>
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className={`text-lg font-bold w-10 text-center tabular-nums ${d ? 'text-white' : 'text-gray-900'}`}>{detailQuantity}</span>
                      <Button size="icon" variant="ghost" className={`h-10 w-10 rounded-lg ${d ? 'hover:bg-white/10 text-white' : 'hover:bg-gray-200 text-gray-900'}`} onClick={() => setDetailQuantity(detailQuantity + 1)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <Button
                      className="gap-2 bg-[#8B1A1A] hover:bg-[#A02020] text-white min-w-[160px] h-12 rounded-xl shadow-lg shadow-[#8B1A1A]/25 text-[15px] font-bold border-0"
                      onClick={addToCartFromDetail}
                    >
                      <ShoppingCart className="h-4 w-4" />
                      {language === "ar" ? "أضف" : "Add"} · {totalPrice.toFixed(2)} {t("sar")}
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

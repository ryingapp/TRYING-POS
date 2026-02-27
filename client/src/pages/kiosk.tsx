import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ShoppingCart, Plus, Minus, Trash2, ChevronRight, CheckCircle2, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import type { MenuItem, Category } from "@shared/schema";

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  notes?: string;
}

type KioskStep = "menu" | "summary" | "confirm";

export default function KioskPage() {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const { toast } = useToast();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [step, setStep] = useState<KioskStep>("menu");
  const [customerName, setCustomerName] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [orderNotes, setOrderNotes] = useState("");

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: [`/api/public/${restaurantId}/categories`],
    queryFn: async () => {
      const res = await fetch(`/api/public/${restaurantId}/categories`);
      return res.json();
    },
    enabled: !!restaurantId,
  });

  const { data: menuItems = [] } = useQuery<MenuItem[]>({
    queryKey: [`/api/public/${restaurantId}/menu-items`],
    queryFn: async () => {
      const res = await fetch(`/api/public/${restaurantId}/menu-items`);
      return res.json();
    },
    enabled: !!restaurantId,
  });

  const activeCategories = categories.filter((c) => c.isActive !== false);
  const activeCategoryId = selectedCategory ?? activeCategories[0]?.id ?? null;

  const visibleItems = menuItems.filter(
    (item) => item.isAvailable !== false && (activeCategoryId === null || item.categoryId === activeCategoryId)
  );

  function addToCart(item: MenuItem) {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItem.id === item.id);
      if (existing) {
        return prev.map((c) => c.menuItem.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { menuItem: item, quantity: 1 }];
    });
  }

  function removeFromCart(itemId: string) {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuItem.id === itemId);
      if (existing && existing.quantity > 1) {
        return prev.map((c) => c.menuItem.id === itemId ? { ...c, quantity: c.quantity - 1 } : c);
      }
      return prev.filter((c) => c.menuItem.id !== itemId);
    });
  }

  function deleteFromCart(itemId: string) {
    setCart((prev) => prev.filter((c) => c.menuItem.id !== itemId));
  }

  const cartCount = cart.reduce((s, c) => s + c.quantity, 0);
  const subtotal = cart.reduce((s, c) => s + (parseFloat(String(c.menuItem.price)) * c.quantity), 0);
  const cartItemFor = (id: string) => cart.find((c) => c.menuItem.id === id);

  const placeOrderMutation = useMutation({
    mutationFn: async () => {
      // Build notes: include table number as text since tableId needs a valid UUID
      const notesArr = [];
      if (tableNumber) notesArr.push(`طاولة / Table: ${tableNumber}`);
      if (orderNotes) notesArr.push(orderNotes);

      const orderBody = {
        orderType: "dine_in",
        orderNumber: `KSK-${Date.now().toString().slice(-6)}`,
        customerName: customerName || undefined,
        notes: notesArr.join(" | ") || undefined,
        // Pass items so server can recalculate totals server-side
        items: cart.map((c) => ({
          menuItemId: c.menuItem.id,
          quantity: c.quantity,
          unitPrice: String(c.menuItem.price),
          totalPrice: (parseFloat(String(c.menuItem.price)) * c.quantity).toFixed(2),
        })),
        subtotal: subtotal.toFixed(2),
        tax: "0",
        total: subtotal.toFixed(2),
        discount: "0",
        deliveryFee: "0",
      };

      const res = await fetch(`/api/public/${restaurantId}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderBody),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || "Failed to place order");
      }
      const order = await res.json();

      // Add items separately
      for (const c of cart) {
        const itemRes = await fetch(`/api/public/${restaurantId}/orders/${order.id}/items`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            menuItemId: c.menuItem.id,
            quantity: c.quantity,
            unitPrice: String(c.menuItem.price),
            totalPrice: (parseFloat(String(c.menuItem.price)) * c.quantity).toFixed(2),
            notes: c.notes || null,
          }),
        });
        if (!itemRes.ok) {
          const err = await itemRes.json().catch(() => ({}));
          console.error("Failed to add item:", err);
        }
      }

      return order;
    },
    onSuccess: () => {
      setStep("confirm");
      setTimeout(() => {
        setCart([]);
        setCustomerName("");
        setTableNumber("");
        setOrderNotes("");
        setStep("menu");
      }, 5000);
    },
    onError: (err: Error) => {
      const msg = err.message === "daySessionClosed"
        ? "المطعم لم يفتح جلسة اليوم بعد. يرجى المحاولة لاحقاً.\nRestaurant session is not open yet."
        : err.message;
      toast({ title: msg, variant: "destructive" });
    },
  });

  // ── Order Confirmed Screen ───────────────────────────────────────────────
  if (step === "confirm") {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <div className="text-center space-y-6 px-8">
          <CheckCircle2 className="h-24 w-24 text-green-500 mx-auto animate-bounce" />
          <h1 className="text-4xl font-black">تم استلام طلبك!</h1>
          <p className="text-xl text-muted-foreground">Your order has been placed successfully.</p>
          <p className="text-sm text-muted-foreground">يتم تحضير طلبك الآن • Your order is being prepared</p>
        </div>
      </div>
    );
  }

  // ── Order Summary Screen ─────────────────────────────────────────────────
  if (step === "summary") {
    return (
      <div className="fixed inset-0 bg-background flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-4 p-6 border-b bg-card">
          <Button variant="ghost" size="lg" onClick={() => setStep("menu")} className="text-lg">
            ← Back / رجوع
          </Button>
          <h1 className="text-2xl font-bold flex-1 text-center">Order Summary / ملخص الطلب</h1>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Customer info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Name (optional) / الاسم</label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Your name"
                className="h-14 text-lg"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Table Number / رقم الطاولة</label>
              <Input
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="e.g. 5"
                className="h-14 text-lg"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">Order Notes / ملاحظات</label>
            <Input
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              placeholder="Any special requests?"
              className="h-14 text-lg"
            />
          </div>

          <Separator />

          {/* Cart items */}
          <div className="space-y-3">
            {cart.map((item) => (
              <div key={item.menuItem.id} className="flex items-center gap-4 bg-card rounded-xl p-4 border">
                {item.menuItem.image && (
                  <img
                    src={item.menuItem.image}
                    alt={item.menuItem.nameEn || ""}
                    className="h-16 w-16 rounded-lg object-cover shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-lg truncate">
                    {item.menuItem.nameAr || item.menuItem.nameEn}
                  </p>
                  <p className="text-muted-foreground">
                    {parseFloat(String(item.menuItem.price)).toFixed(2)} × {item.quantity}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="outline" className="h-10 w-10" onClick={() => removeFromCart(item.menuItem.id)}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-8 text-center font-bold text-xl">{item.quantity}</span>
                  <Button size="icon" variant="outline" className="h-10 w-10" onClick={() => addToCart(item.menuItem)}>
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-10 w-10 text-destructive" onClick={() => deleteFromCart(item.menuItem.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <p className="font-bold text-lg w-20 text-right">
                  {(parseFloat(String(item.menuItem.price)) * item.quantity).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t bg-card p-6">
          <div className="max-w-lg mx-auto space-y-4">
            <div className="flex justify-between text-2xl font-bold">
              <span>Total / المجموع</span>
              <span>{subtotal.toFixed(2)}</span>
            </div>
            <Button
              className="w-full h-16 text-xl"
              onClick={() => placeOrderMutation.mutate()}
              disabled={placeOrderMutation.isPending || cart.length === 0}
            >
              {placeOrderMutation.isPending ? "Placing order..." : "تأكيد الطلب • Confirm Order"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Menu Screen ─────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-background flex">
      {/* Category sidebar */}
      <div className="w-48 border-r bg-card overflow-y-auto shrink-0">
        <div className="p-3 border-b">
          <div className="flex items-center gap-2 text-primary">
            <UtensilsCrossed className="h-5 w-5" />
            <span className="font-bold text-sm">Menu</span>
          </div>
        </div>
        {activeCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`w-full text-right px-4 py-3 text-sm font-medium border-b transition-colors ${
              activeCategoryId === cat.id
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-foreground"
            }`}
          >
            <span className="block text-right">{cat.nameAr || cat.nameEn}</span>
            <span className="block text-left text-xs opacity-70">{cat.nameEn}</span>
          </button>
        ))}
      </div>

      {/* Items grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {visibleItems.map((item) => {
            const inCart = cartItemFor(item.id);
            return (
              <Card
                key={item.id}
                className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-primary"
                onClick={() => addToCart(item)}
              >
                <div className="aspect-square bg-muted relative">
                  {item.image ? (
                    <img src={item.image} alt={item.nameEn || ""} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <UtensilsCrossed className="h-12 w-12 opacity-30" />
                    </div>
                  )}
                  {inCart && (
                    <Badge className="absolute top-2 right-2 text-sm h-7 w-7 rounded-full flex items-center justify-center p-0">
                      {inCart.quantity}
                    </Badge>
                  )}
                </div>
                <div className="p-3 space-y-1">
                  <p className="font-bold text-sm leading-tight">{item.nameAr || item.nameEn}</p>
                  {item.nameAr && item.nameEn && (
                    <p className="text-xs text-muted-foreground truncate">{item.nameEn}</p>
                  )}
                  {(item.descriptionAr || item.descriptionEn) && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{item.descriptionAr || item.descriptionEn}</p>
                  )}
                  <div className="flex items-center justify-between pt-1">
                    <span className="font-black text-primary">{parseFloat(String(item.price)).toFixed(2)}</span>
                    <Button
                      size="icon"
                      className="h-8 w-8 rounded-full"
                      onClick={(e) => { e.stopPropagation(); addToCart(item); }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
          {visibleItems.length === 0 && (
            <div className="col-span-full text-center py-16 text-muted-foreground">
              No items available
            </div>
          )}
        </div>
      </div>

      {/* Cart button */}
      {cartCount > 0 && (
        <div className="absolute bottom-6 right-6 left-6 max-w-sm ml-auto">
          <Button
            className="w-full h-16 text-lg shadow-xl"
            onClick={() => setStep("summary")}
          >
            <ShoppingCart className="h-5 w-5 mr-2" />
            <span>View Cart ({cartCount}) • {subtotal.toFixed(2)}</span>
            <ChevronRight className="h-5 w-5 ml-auto" />
          </Button>
        </div>
      )}
    </div>
  );
}

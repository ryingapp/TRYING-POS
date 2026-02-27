import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n";
import { useTheme } from "@/lib/theme";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, LogIn, Sun, Moon, Globe, Loader2 } from "lucide-react";


export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const { language, setLanguage, t, direction } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const texts = {
    welcome: { en: "Welcome Back", ar: "مرحباً بعودتك" },
    subtitle: { en: "Sign in to your account", ar: "سجل الدخول إلى حسابك" },
    email: { en: "Email Address", ar: "البريد الإلكتروني" },
    emailPlaceholder: { en: "Enter your email", ar: "أدخل بريدك الإلكتروني" },
    password: { en: "Password", ar: "كلمة المرور" },
    passwordPlaceholder: { en: "Enter your password", ar: "أدخل كلمة المرور" },
    signIn: { en: "Sign In", ar: "تسجيل الدخول" },
    signingIn: { en: "Signing in...", ar: "جاري تسجيل الدخول..." },
    noAccount: { en: "Don't have an account?", ar: "ليس لديك حساب؟" },
    createAccount: { en: "Create Account", ar: "إنشاء حساب" },
    loginError: { en: "Login failed. Please check your credentials.", ar: "فشل تسجيل الدخول. يرجى التحقق من بياناتك." },
    accountDisabled: { en: "Your account has been suspended. Please contact the administrator.", ar: "تم تعطيل حسابك. يرجى التواصل مع المسؤول." },
    restaurantInactive: { en: "Your restaurant subscription is inactive. Please contact the platform administrator.", ar: "اشتراك مطعمك غير نشط. يرجى التواصل مع مسؤول المنصة." },
  };

  const tx = (key: keyof typeof texts) => texts[key][language];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    try {
      await login(email, password);
      setLocation("/");
    } catch (error: any) {
      const msg = error?.message || "";
      let errorMsg = tx("loginError");
      if (msg.includes("disabled") || msg.includes("Account is disabled")) {
        errorMsg = tx("accountDisabled");
      } else if (msg.includes("inactive") || msg.includes("subscription")) {
        errorMsg = tx("restaurantInactive");
      }
      toast({ title: language === "ar" ? "خطأ" : "Error", description: errorMsg, variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir={direction}>
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <Button
          size="icon"
          variant="ghost"
          onClick={toggleTheme}
          data-testid="button-theme-toggle"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setLanguage(language === "en" ? "ar" : "en")}
          data-testid="button-language-toggle"
        >
          <Globe className="h-4 w-4" />
        </Button>
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="w-48 h-20 mx-auto mb-2 flex items-center justify-center"><div className="w-16 h-16 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-3xl">T</div></div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold" data-testid="text-welcome">{tx("welcome")}</h2>
              <p className="text-sm text-muted-foreground mt-1">{tx("subtitle")}</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{tx("email")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={tx("emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  data-testid="input-email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{tx("password")}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder={tx("passwordPlaceholder")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className={direction === "rtl" ? "pl-10" : "pr-10"}
                    data-testid="input-password"
                  />
                  <button
                    type="button"
                    className={`absolute top-1/2 -translate-y-1/2 ${direction === "rtl" ? "left-3" : "right-3"} text-muted-foreground hover:text-foreground`}
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !email || !password}
                data-testid="button-login"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className={direction === "rtl" ? "mr-2" : "ml-2"}>{tx("signingIn")}</span>
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    <span className={direction === "rtl" ? "mr-2" : "ml-2"}>{tx("signIn")}</span>
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">{tx("noAccount")} </span>
              <Link
                href="/register"
                className="text-primary font-medium hover:underline"
                data-testid="link-register"
              >
                {tx("createAccount")}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

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
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff, UserPlus, Sun, Moon, Globe, Loader2 } from "lucide-react";
import logoImg from "@assets/logo.jpg";

export default function RegisterPage() {
  const { register, isLoading } = useAuth();
  const { language, setLanguage, t, direction } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [name, setName] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const texts = {
    title: { en: "Create Account", ar: "إنشاء حساب" },
    subtitle: { en: "Your complete restaurant management solution", ar: "الحل المتكامل لإدارة مطعمك" },
    restaurantName: { en: "Restaurant Name", ar: "اسم المطعم" },
    restaurantNamePlaceholder: { en: "e.g. Mama Noura", ar: "مثال: ماما نورة" },
    restaurantNameRequired: { en: "Restaurant name is required", ar: "اسم المطعم مطلوب" },
    name: { en: "Your Full Name", ar: "اسمك الكامل" },
    namePlaceholder: { en: "Enter your full name", ar: "أدخل اسمك الكامل" },
    email: { en: "Email Address", ar: "البريد الإلكتروني" },
    emailPlaceholder: { en: "example@email.com", ar: "example@email.com" },
    invalidEmail: { en: "Please enter a valid email address", ar: "يرجى إدخال بريد إلكتروني صحيح" },
    phone: { en: "Phone Number", ar: "رقم الجوال" },
    phonePlaceholder: { en: "5XXXXXXXX", ar: "5XXXXXXXX" },
    countryCode: { en: "+966", ar: "966+" },
    phoneRequired: { en: "Phone number is required", ar: "رقم الجوال مطلوب" },
    password: { en: "Password", ar: "كلمة المرور" },
    passwordPlaceholder: { en: "Strong password required", ar: "كلمة مرور قوية مطلوبة" },
    confirmPassword: { en: "Confirm Password", ar: "تأكيد كلمة المرور" },
    confirmPasswordPlaceholder: { en: "Repeat your password", ar: "أعد كتابة كلمة المرور" },
    register: { en: "Create Account", ar: "إنشاء الحساب" },
    registering: { en: "Creating account...", ar: "جاري إنشاء الحساب..." },
    hasAccount: { en: "Already have an account?", ar: "لديك حساب بالفعل؟" },
    signIn: { en: "Sign In", ar: "تسجيل الدخول" },
    passwordMismatch: { en: "Passwords do not match", ar: "كلمات المرور غير متطابقة" },
    passwordWeak: {
      en: "Password must be at least 8 characters and include uppercase, lowercase, number, and special character",
      ar: "كلمة المرور يجب أن تكون 8 أحرف على الأقل وتحتوي على حرف كبير وحرف صغير ورقم ورمز خاص"
    },
    registerError: { en: "Registration failed. Please try again.", ar: "فشل التسجيل. يرجى المحاولة مرة أخرى." },
    emailExists: { en: "This email is already registered", ar: "هذا البريد الإلكتروني مسجل بالفعل" },
    success: { en: "Account created successfully!", ar: "تم إنشاء الحساب بنجاح!" },
    weak: { en: "Weak", ar: "ضعيفة" },
    medium: { en: "Medium", ar: "متوسطة" },
    strong: { en: "Strong", ar: "قوية" },
    agreeTerms: { en: "I agree to the", ar: "أوافق على" },
    termsLink: { en: "Terms & Privacy Policy", ar: "الشروط وسياسة الخصوصية" },
    termsRequired: { en: "You must agree to the terms and privacy policy", ar: "يجب الموافقة على الشروط وسياسة الخصوصية" },
  };

  const tx = (key: keyof typeof texts) => texts[key][language];

  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  const hasMinLength = password.length >= 8;
  const isStrongPassword = hasUppercase && hasLowercase && hasNumber && hasSpecial && hasMinLength;

  const getPasswordStrength = () => {
    if (!password) return { level: 0, label: "", color: "" };
    let score = 0;
    if (hasMinLength) score++;
    if (hasUppercase) score++;
    if (hasLowercase) score++;
    if (hasNumber) score++;
    if (hasSpecial) score++;
    if (score <= 2) return { level: 1, label: tx("weak"), color: "bg-red-500" };
    if (score <= 4) return { level: 2, label: tx("medium"), color: "bg-yellow-500" };
    return { level: 3, label: tx("strong"), color: "bg-green-500" };
  };

  const strength = getPasswordStrength();

  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const isEmailValid = emailRegex.test(email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEmailValid) {
      toast({ title: language === "ar" ? "خطأ" : "Error", description: tx("invalidEmail"), variant: "destructive" });
      return;
    }
    if (!phone.trim()) {
      toast({ title: language === "ar" ? "خطأ" : "Error", description: tx("phoneRequired"), variant: "destructive" });
      return;
    }
    if (!agreedToTerms) {
      toast({ title: language === "ar" ? "خطأ" : "Error", description: tx("termsRequired"), variant: "destructive" });
      return;
    }
    if (!isStrongPassword) {
      toast({ title: language === "ar" ? "خطأ" : "Error", description: tx("passwordWeak"), variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: language === "ar" ? "خطأ" : "Error", description: tx("passwordMismatch"), variant: "destructive" });
      return;
    }
    try {
      await register({ name, email, password, phone: `+966${phone}`, role: "owner", restaurantName });
      toast({ title: language === "ar" ? "نجاح" : "Success", description: tx("success") });
      setLocation("/");
    } catch (error: any) {
      const msg = error?.message || "";
      let errorMsg = tx("registerError");
      if (msg.includes("already exists") || msg.includes("Email")) {
        errorMsg = tx("emailExists");
      }
      toast({ title: language === "ar" ? "خطأ" : "Error", description: errorMsg, variant: "destructive" });
    }
  };

  const isValid = name && restaurantName && isEmailValid && phone.trim() && isStrongPassword && password === confirmPassword && agreedToTerms;

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
          <img src={logoImg} alt="Trying" className="w-48 h-auto mx-auto mb-2 object-contain" data-testid="img-logo" />
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="text-center mb-6">
              <h2 className="text-xl font-semibold" data-testid="text-title">{tx("title")}</h2>
              <p className="text-sm text-muted-foreground mt-1">{tx("subtitle")}</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="restaurantName">{tx("restaurantName")}</Label>
                <Input
                  id="restaurantName"
                  type="text"
                  placeholder={tx("restaurantNamePlaceholder")}
                  value={restaurantName}
                  onChange={(e) => setRestaurantName(e.target.value)}
                  required
                  data-testid="input-restaurant-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">{tx("name")}</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder={tx("namePlaceholder")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                  data-testid="input-name"
                />
              </div>

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
                  className={email && !isEmailValid ? "border-red-500 focus-visible:ring-red-500" : ""}
                  data-testid="input-email"
                />
                {email && !isEmailValid && (
                  <p className="text-xs text-red-500" data-testid="text-email-error">{tx("invalidEmail")}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">{tx("phone")}</Label>
                <div className={`flex items-center gap-0 ${direction === "rtl" ? "flex-row-reverse" : ""}`}>
                  <div className="flex items-center justify-center min-h-9 px-3 border border-input bg-muted text-sm font-medium text-muted-foreground rounded-md rounded-r-none border-r-0 select-none" style={direction === "rtl" ? { borderRadius: "0 calc(var(--radius) - 2px) calc(var(--radius) - 2px) 0", borderRight: "1px solid hsl(var(--input))", borderLeft: 0 } : {}}>
                    <span className="flex items-center gap-1.5">
                      <span>🇸🇦</span>
                      <span>{tx("countryCode")}</span>
                    </span>
                  </div>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder={tx("phonePlaceholder")}
                    value={phone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, "");
                      if (val.length <= 9) setPhone(val);
                    }}
                    required
                    autoComplete="tel"
                    className={direction === "rtl" ? "rounded-l-none border-l-0 rounded-r-md" : "rounded-l-none border-l-0"}
                    style={direction === "rtl" ? { borderRadius: "calc(var(--radius) - 2px) 0 0 calc(var(--radius) - 2px)" } : {}}
                    data-testid="input-phone"
                  />
                </div>
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
                    minLength={8}
                    autoComplete="new-password"
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
                {password && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 flex gap-1">
                        {[1, 2, 3].map((i) => (
                          <div
                            key={i}
                            className={`h-1.5 flex-1 rounded-full transition-colors ${
                              i <= strength.level ? strength.color : "bg-muted"
                            }`}
                          />
                        ))}
                      </div>
                      <span className={`text-xs font-medium ${
                        strength.level === 1 ? "text-red-500" :
                        strength.level === 2 ? "text-yellow-500" : "text-green-500"
                      }`} data-testid="text-password-strength">
                        {strength.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                      <span className={hasMinLength ? "text-green-600 dark:text-green-400" : ""}>
                        {hasMinLength ? "\u2713" : "\u2717"} {language === "ar" ? "8 أحرف على الأقل" : "8+ characters"}
                      </span>
                      <span className={hasUppercase ? "text-green-600 dark:text-green-400" : ""}>
                        {hasUppercase ? "\u2713" : "\u2717"} {language === "ar" ? "حرف كبير" : "Uppercase"}
                      </span>
                      <span className={hasLowercase ? "text-green-600 dark:text-green-400" : ""}>
                        {hasLowercase ? "\u2713" : "\u2717"} {language === "ar" ? "حرف صغير" : "Lowercase"}
                      </span>
                      <span className={hasNumber ? "text-green-600 dark:text-green-400" : ""}>
                        {hasNumber ? "\u2713" : "\u2717"} {language === "ar" ? "رقم" : "Number"}
                      </span>
                      <span className={hasSpecial ? "text-green-600 dark:text-green-400" : ""}>
                        {hasSpecial ? "\u2713" : "\u2717"} {language === "ar" ? "رمز خاص (!@#$)" : "Special (!@#$)"}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{tx("confirmPassword")}</Label>
                <Input
                  id="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder={tx("confirmPasswordPlaceholder")}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  data-testid="input-confirm-password"
                />
              </div>

              <div className="flex items-start gap-2">
                <Checkbox
                  id="terms"
                  checked={agreedToTerms}
                  onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
                  data-testid="checkbox-terms"
                />
                <label htmlFor="terms" className="text-sm leading-5 cursor-pointer select-none">
                  {tx("agreeTerms")}{" "}
                  <a
                    href="https://tryingapp.com/privacy-policy.html"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary font-medium hover:underline"
                    data-testid="link-terms"
                  >
                    {tx("termsLink")}
                  </a>
                </label>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !isValid}
                data-testid="button-register"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className={direction === "rtl" ? "mr-2" : "ml-2"}>{tx("registering")}</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    <span className={direction === "rtl" ? "mr-2" : "ml-2"}>{tx("register")}</span>
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">{tx("hasAccount")} </span>
              <Link
                href="/login"
                className="text-primary font-medium hover:underline"
                data-testid="link-login"
              >
                {tx("signIn")}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

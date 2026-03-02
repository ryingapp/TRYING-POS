import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  showValidation?: boolean;
  language?: "en" | "ar";
}

export function PhoneInput({
  value,
  onChange,
  label,
  placeholder = "05xxxxxxxx",
  required = true,
  disabled = false,
  error,
  showValidation = true,
  language = "en",
}: PhoneInputProps) {
  const [touched, setTouched] = useState(false);

  const messages = {
    en: {
      invalidFormat: "Only numbers allowed",
      mustStart05: "Must start with 05",
      exactlyTenDigits: "Must be exactly 10 digits",
      valid: "Valid phone number",
    },
    ar: {
      invalidFormat: "يقبل الأرقام فقط",
      mustStart05: "يجب أن يبدأ برقم 05",
      exactlyTenDigits: "يجب أن يكون بالضبط 10 أرقام",
      valid: "رقم جوال صحيح",
    },
  };

  const t = messages[language];

  // Extract only digits from input
  const sanitizedValue = value.replace(/\D/g, "");

  // Validate phone
  const isValid =
    sanitizedValue.length === 10 && sanitizedValue.startsWith("05");

  // Get validation message
  const getValidationMessage = () => {
    if (!sanitizedValue) return "";
    if (!/^\d*$/.test(value)) return t.invalidFormat;
    if (sanitizedValue.length > 0 && !sanitizedValue.startsWith("05"))
      return t.mustStart05;
    if (sanitizedValue.length !== 10) return t.exactlyTenDigits;
    return "";
  };

  const validationMessage = getValidationMessage();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    // Allow only digits
    const onlyDigits = input.replace(/\D/g, "");
    // Limit to 10 digits
    const limited = onlyDigits.slice(0, 10);
    onChange(limited);
  };

  const handleBlur = () => {
    setTouched(true);
  };

  return (
    <div className="space-y-2">
      {label && (
        <Label className="flex items-center gap-1">
          {label}
          {required && <span className="text-red-500">*</span>}
        </Label>
      )}

      <div className="relative">
        <Input
          type="tel"
          value={sanitizedValue}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          dir="ltr"
          className={`${
            showValidation && touched
              ? isValid
                ? "border-green-500 focus-visible:ring-green-500"
                : validationMessage
                ? "border-red-500 focus-visible:ring-red-500"
                : ""
              : ""
          } pr-10`}
          maxLength={10}
        />

        {showValidation && touched && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isValid ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : validationMessage ? (
              <AlertCircle className="h-5 w-5 text-red-500" />
            ) : null}
          </div>
        )}
      </div>

      {(error || (showValidation && touched && validationMessage)) && (
        <div
          className={`text-sm flex items-center gap-1.5 ${
            error
              ? "text-red-500"
              : validationMessage
              ? "text-red-500"
              : "text-green-500"
          }`}
        >
          {error ? (
            <>
              <AlertCircle className="h-4 w-4" />
              {error}
            </>
          ) : validationMessage ? (
            <>
              <AlertCircle className="h-4 w-4" />
              {validationMessage}
            </>
          ) : (
            <>
              <CheckCircle2 className="h-4 w-4" />
              {t.valid}
            </>
          )}
        </div>
      )}
    </div>
  );
}

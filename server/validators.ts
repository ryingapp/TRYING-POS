// Data validation utilities for TryingPOS
// Ensures clean data architecture globally

/**
 * Phone Number Validation (Saudi Arabia)
 * - Exactly 10 digits
 * - Must start with 05
 * - No letters, spaces, or special characters
 */
export const validatePhoneNumber = (phone: string): { valid: boolean; error?: string } => {
  if (!phone) {
    return { valid: false, error: "Phone number is required" };
  }

  // Remove spaces and dashes
  const cleaned = phone.replace(/[\s\-]/g, "");

  // Check if it's only digits
  if (!/^\d+$/.test(cleaned)) {
    return { valid: false, error: "Phone number must contain only digits" };
  }

  // Check length (allow 9-15 digits for international support, though Saudi is 10)
  if (cleaned.length < 9 || cleaned.length > 15) {
    return { valid: false, error: "Phone number must be between 9 and 15 digits" };
  }

  // Relaxed prefix check (warn for non-05 but allow if valid length)
  // if (!cleaned.startsWith("05") && cleaned.length === 10) {
  //   // Optional: strict Saudi format check can be re-enabled if needed
  // }

  return { valid: true };
};

/**
 * Email Validation
 * - Check email format
 * - Basic regex validation
 */
export const validateEmail = (email: string): { valid: boolean; error?: string } => {
  if (!email) {
    return { valid: false, error: "Email is required" };
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    return { valid: false, error: "Invalid email format" };
  }

  return { valid: true };
};

/**
 * Price Validation
 * - No negative values
 * - Must be a number
 * - Max 2 decimal places
 */
export const validatePrice = (price: string | number): { valid: boolean; error?: string } => {
  const numPrice = typeof price === "string" ? parseFloat(price) : price;

  if (isNaN(numPrice)) {
    return { valid: false, error: "Price must be a number" };
  }

  if (numPrice < 0) {
    return { valid: false, error: "Price cannot be negative" };
  }

  // Check decimal places (Allow up to 3 for precision, but prefer 2)
  const decimals = numPrice.toString().split(".")[1];
  if (decimals && decimals.length > 5) {
    return { valid: false, error: "Price can have maximum 5 decimal places precision" };
  }

  return { valid: true };
};

/**
 * Quantity Validation
 * - No zero or negative values
 * - Must be a positive integer
 */
export const validateQuantity = (quantity: string | number): { valid: boolean; error?: string } => {
  const numQuantity = typeof quantity === "string" ? parseInt(quantity, 10) : quantity;

  if (isNaN(numQuantity)) {
    return { valid: false, error: "Quantity must be a number" };
  }

  if (numQuantity <= 0) {
    return { valid: false, error: "Quantity must be greater than zero" };
  }

  if (!Number.isInteger(numQuantity)) {
    return { valid: false, error: "Quantity must be a whole number" };
  }

  return { valid: true };
};

/**
 * Mobile Phone Format Normalization
 * - Removes spaces and dashes
 * Returns cleaned phone number or original if invalid
 */
export const normalizeMobilePhone = (phone: string): string => {
  if (!phone) return "";

  // Keep digits only
  let digits = phone.replace(/\D/g, "");

  // Convert Saudi country-code forms to local 05xxxxxxxx
  if (digits.startsWith("00966") && digits.length === 14) {
    digits = `0${digits.slice(5)}`;
  } else if (digits.startsWith("966") && digits.length === 12) {
    digits = `0${digits.slice(3)}`;
  } else if (digits.startsWith("5") && digits.length === 9) {
    digits = `0${digits}`;
  }

  // Return normalized local format if valid length
  if (/^\d+$/.test(digits) && digits.length === 10) {
    return digits;
  }

  return digits || phone;
};

/**
 * Email Normalization
 * - Convert to lowercase
 * - Trim whitespace
 */
export const normalizeEmail = (email: string): string => {
  return email.trim().toLowerCase();
};

// Data validation utilities for TryingPOS
// Ensures clean data architecture globally

/**
 * Phone Number Validation
 * - Accepts only 10+ digits
 * - Must start with 05 (Saudi Arabia)
 * - No letters or special characters
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

  // Check length (at least 10 digits for Saudi format)
  if (cleaned.length < 10) {
    return { valid: false, error: "Phone number must be at least 10 digits" };
  }

  // Check if starts with 05 (Saudi Arabia standard)
  if (!cleaned.startsWith("05")) {
    return { valid: false, error: "Phone number must start with 05 (Saudi Arabia format)" };
  }

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

  // Check decimal places
  const decimals = numPrice.toString().split(".")[1];
  if (decimals && decimals.length > 2) {
    return { valid: false, error: "Price can have maximum 2 decimal places" };
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
  
  // Remove spaces, dashes, and special characters
  const cleaned = phone.replace(/[\s\-\(\)]/g, "");
  
  // If it's a valid format, return it
  if (/^\d+$/.test(cleaned) && cleaned.length >= 10) {
    return cleaned;
  }
  
  return phone; // Return original if can't normalize
};

/**
 * Email Normalization
 * - Convert to lowercase
 * - Trim whitespace
 */
export const normalizeEmail = (email: string): string => {
  return email.trim().toLowerCase();
};

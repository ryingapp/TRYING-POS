-- Add SoftPOS auth token field to restaurants table
-- This stores the EdfaPay SoftPOS SDK auth token per restaurant
-- Used by the mobile app for NFC Tap-to-Pay payments
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS edfapay_softpos_auth_token TEXT;

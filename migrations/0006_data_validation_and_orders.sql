-- Migration: Add data validation, day sessions, and order archiving (0006)

-- 1. Add unique constraints on users (email)
ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE(email);

-- 2. Add unique constraint on restaurants (email)
ALTER TABLE restaurants ADD CONSTRAINT restaurants_email_unique UNIQUE(email);

-- 3. Add day session tracking to orders
-- Each "day session" groups orders by date and helps organize them
ALTER TABLE orders ADD COLUMN IF NOT EXISTS day_session_id VARCHAR;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS day_session_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- Create day_sessions table to track daily operations
CREATE TABLE IF NOT EXISTS day_sessions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id VARCHAR NOT NULL REFERENCES restaurants(id),
  branch_id VARCHAR REFERENCES branches(id),
  session_date DATE NOT NULL,
  opened_at TIMESTAMP DEFAULT NOW(),
  closed_at TIMESTAMP,
  is_closed BOOLEAN DEFAULT FALSE,
  notes TEXT,
  CONSTRAINT unique_day_session UNIQUE(restaurant_id, branch_id, session_date)
);

-- Add phone validation (move to check constraints in future)
-- Phone should be 10+ digits, no letters
-- Email validation is handled by application layer

-- Create archived_orders table for historical data
CREATE TABLE IF NOT EXISTS archived_orders (
  id VARCHAR PRIMARY KEY,
  restaurant_id VARCHAR NOT NULL,
  branch_id VARCHAR,
  day_session_id VARCHAR,
  order_number TEXT NOT NULL,
  order_type TEXT NOT NULL,
  status TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  customer_address TEXT,
  subtotal DECIMAL(10, 2),
  discount DECIMAL(10, 2),
  delivery_fee DECIMAL(10, 2),
  tax DECIMAL(10, 2),
  total DECIMAL(10, 2),
  payment_method TEXT,
  is_paid BOOLEAN,
  created_at TIMESTAMP,
  archived_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance on queries
CREATE INDEX IF NOT EXISTS idx_orders_day_session ON orders(day_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_day_session_date ON orders(day_session_date);
CREATE INDEX IF NOT EXISTS idx_orders_is_archived ON orders(is_archived);
CREATE INDEX IF NOT EXISTS idx_day_sessions_restaurant ON day_sessions(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_day_sessions_date ON day_sessions(session_date);
CREATE INDEX IF NOT EXISTS idx_archived_orders_restaurant ON archived_orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_archived_orders_date ON archived_orders(archived_at);

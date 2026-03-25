const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log('Running schema fixes for missing columns...');

    // Fix ORDERS table
    try { await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS waiter_id VARCHAR REFERENCES users(id)`); } catch(e) { console.error('orders.waiter_id error:', e.message); }
    try { await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS cashier_id VARCHAR REFERENCES users(id)`); } catch(e) { console.error('orders.cashier_id error:', e.message); }
    try { await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending'`); } catch(e) { console.error('orders.payment_status error:', e.message); }
    try { await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false`); } catch(e) { console.error('orders.is_archived error:', e.message); }
    try { await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS day_session_id VARCHAR`); } catch(e) { console.error('orders.day_session_id error:', e.message); }
    try { await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS day_session_date VARCHAR`); } catch(e) { console.error('orders.day_session_date error:', e.message); }

    // Fix INVOICES table
    try { await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cashier_name TEXT`); } catch(e) { console.error('invoices.cashier_name error:', e.message); }
    try { await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS refund_reason TEXT`); } catch(e) { console.error('invoices.refund_reason error:', e.message); }
    try { await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS uuid TEXT`); } catch(e) { console.error('invoices.uuid error:', e.message); }

    // Fix ORDER_ITEMS table
    try { await pool.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_id TEXT`); } catch(e) { console.error('order_items.variant_id error:', e.message); }
    try { await pool.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS customizations JSONB DEFAULT '[]'`); } catch(e) { console.error('order_items.customizations error:', e.message); }

    // Fix RECIPES table
    try { await pool.query(`ALTER TABLE recipes ADD COLUMN IF NOT EXISTS variant_id TEXT`); } catch(e) { console.error('recipes.variant_id error:', e.message); }
    try { await pool.query(`ALTER TABLE recipes ADD COLUMN IF NOT EXISTS customization_option_id TEXT`); } catch(e) { console.error('recipes.customization_option_id error:', e.message); }


    console.log('✓ Applied schema fixes');
  } catch(e) {
    console.log('Critical error:', e.message);
  } finally {
    await pool.end();
  }
}

main();
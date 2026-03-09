const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    console.log('Running robust schema check/fix...');

    // Invoices
    try { await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS cashier_name TEXT`); } catch(e) { console.error('invoices.cashier_name error:', e.message); }
    try { await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS refund_reason TEXT`); } catch(e) { console.error('invoices.refund_reason error:', e.message); }
    try { await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "uuid" TEXT`); } catch(e) { console.error('invoices.uuid error:', e.message); }
    try { await pool.query(`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS "zatca_status" TEXT DEFAULT 'pending'`); } catch(e) { console.error('invoices.zatca_status error:', e.message); }

    // Orders
    try { await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false`); } catch(e) { console.error('orders.is_archived error:', e.message); }
    try { await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS day_session_id VARCHAR`); } catch(e) { console.error('orders.day_session_id error:', e.message); }
    try { await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS day_session_date VARCHAR`); } catch(e) { console.error('orders.day_session_date error:', e.message); }
    try { await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending'`); } catch(e) { console.error('orders.payment_status error:', e.message); }
    try { await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS cashier_id VARCHAR`); } catch(e) { console.error('orders.cashier_id error:', e.message); } // Just in case user meant orders.cashier_id

    // Check waiter_id foreign key or user roles?
    
    console.log('✓ Applied critical schema fixes to invoices/orders');
  } catch(e) {
    console.log('Critical error applying schema fixes:', e.message);
  } finally {
    await pool.end();
  }
}

main();

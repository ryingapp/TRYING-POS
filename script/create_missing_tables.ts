import pkg from 'pg';
const { Pool } = pkg;

const connectionString = "postgresql://postgres.htgpnsovlixhiscraixd:Wsc7WryfUyvqgWy9@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";

const pool = new Pool({
  connectionString,
});

async function main() {
  const client = await pool.connect();
  try {
    console.log("Connected to database. Creating tables...");

    // Create loyalty_transactions
    await client.query(`
      CREATE TABLE IF NOT EXISTS loyalty_transactions (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        restaurant_id varchar NOT NULL,
        customer_id varchar,
        order_id varchar,
        type text NOT NULL,
        points integer NOT NULL,
        description text,
        created_at timestamp DEFAULT now()
      );
    `);
    console.log("Created loyalty_transactions");

    // Create invoice_audit_log
    await client.query(`
      CREATE TABLE IF NOT EXISTS invoice_audit_log (
        id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
        restaurant_id varchar NOT NULL,
        invoice_id varchar,
        action text NOT NULL,
        user_id varchar,
        user_name text,
        details text,
        ip_address text,
        created_at timestamp DEFAULT now()
      );
    `);
    console.log("Created invoice_audit_log");

  } catch (e) {
    console.error("Error creating tables:", e);
  } finally {
    client.release();
    await pool.end();
  }
}

main();

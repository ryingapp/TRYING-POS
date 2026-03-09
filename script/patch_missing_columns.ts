import pkg from 'pg';
const { Pool } = pkg;

const connectionString = "postgresql://postgres.htgpnsovlixhiscraixd:Wsc7WryfUyvqgWy9@aws-1-ap-south-1.pooler.supabase.com:6543/postgres";

const pool = new Pool({
  connectionString,
});

async function main() {
  const client = await pool.connect();
  try {
    console.log("Connected to database. Checking for missing columns in restaurants...");

    // Add missing service columns
    try {
      await client.query(`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS service_kitchen_screen boolean DEFAULT true;`);
      console.log("Added service_kitchen_screen");
    } catch (e) {
      console.error("Failed to add service_kitchen_screen", e);
    }
    
    try {
      await client.query(`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS service_quick_order boolean DEFAULT false;`);
      console.log("Added service_quick_order");
    } catch (e) {
      console.error("Failed to add service_quick_order", e);
    }

    try {
      await client.query(`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS service_queue boolean DEFAULT false;`);
      console.log("Added service_queue");
    } catch (e) {
      console.error("Failed to add service_queue", e);
    }

    // Add missing VAT/ZATCA/Bank columns (just in case)
    const columns = [
      "zakat_manager_name text",
      "zakat_manager_phone text",
      "zakat_manager_email text",
      "bank_name text",
      "bank_account_holder text",
      "bank_account_number text", 
      "bank_swift text", 
      "bank_iban text",
      "owner_name text",
      "owner_phone text",
      "registration_type text DEFAULT 'CRN'",
      "industry text DEFAULT 'Food'",
      "invoice_type text DEFAULT '1100'",
      "short_address text",
      "commercial_registration_name text"
    ];

    for (const col of columns) {
      try {
        const [name] = col.split(' ');
        await client.query(`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS ${col};`);
        console.log(`Added column ${name} if not exists`);
      } catch (e) {
        // Ignore duplicate or error
      }
    }

    console.log("Database patch complete.");

  } catch (e) {
    console.error("Error patching database:", e);
  } finally {
    client.release();
    await pool.end();
  }
}

main();

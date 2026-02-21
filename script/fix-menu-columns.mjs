import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_41htWOCBVKyn@ep-blue-bush-aibgf4j4-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require"
});

async function fix() {
  const client = await pool.connect();
  try {
    // Check if column exists in menu_items
    const check = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'menu_items' AND column_name = 'kitchen_section_id'
    `);
    console.log('menu_items.kitchen_section_id exists:', check.rows.length > 0);
    
    if (check.rows.length === 0) {
      await client.query('ALTER TABLE "menu_items" ADD COLUMN "kitchen_section_id" varchar');
      console.log('✓ Added kitchen_section_id column to menu_items');
    }
    
    // Check printers too
    const checkPrinters = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'printers' AND column_name = 'kitchen_section_id'
    `);
    console.log('printers.kitchen_section_id exists:', checkPrinters.rows.length > 0);
    
    if (checkPrinters.rows.length === 0) {
      await client.query('ALTER TABLE "printers" ADD COLUMN "kitchen_section_id" varchar');
      console.log('✓ Added kitchen_section_id to printers');
    }
    
    // Verify
    const verify = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'menu_items' AND column_name = 'kitchen_section_id'
    `);
    console.log('\nVerification - kitchen_section_id now exists:', verify.rows.length > 0);
    
  } finally {
    client.release();
    await pool.end();
  }
}

fix().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});

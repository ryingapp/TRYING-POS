const { Pool } = require('pg');

async function main() {
  console.log("Connecting using DATABASE_URL from env...");
  // We assume this runs in an environment where DATABASE_URL is set (via export $(cat .env | xargs))
  if (!process.env.DATABASE_URL) {
      console.error("DATABASE_URL is missing!");
      process.exit(1);
  }
  
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log("Checking columns for table 'order_items'...");
    
    const res = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'order_items';
    `);
    
    console.log("Found columns:");
    res.rows.forEach(row => {
        console.log(` - ${row.column_name} (${row.data_type})`);
    });

    const hasVariantId = res.rows.some(r => r.column_name === 'variant_id');
    console.log(`\nHas 'variant_id'? ${hasVariantId ? 'YES' : 'NO'}`);

    if (!hasVariantId) {
        console.log("Attempting to force add variant_id...");
        await pool.query(`ALTER TABLE order_items ADD COLUMN variant_id VARCHAR`);
        console.log("Column added.");
    }

  } catch(e) {
    console.error('Error:', e);
  } finally {
    await pool.end();
  }
}

main();

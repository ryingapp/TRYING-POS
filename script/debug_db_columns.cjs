const { Pool } = require('pg');

async function main() {
  console.log('--- DEBUG DB COLUMNS START ---');
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL is not set!');
    process.exit(1);
  }

  // Mask password for logging
  const maskedUrl = process.env.DATABASE_URL.replace(/:([^:@]+)@/, ':****@');
  console.log('Connecting to:', maskedUrl);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    // 1. Check existing columns in order_items
    console.log('\nChecking columns in "order_items" table:');
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'order_items'
      ORDER BY ordinal_position;
    `);
    
    const columns = res.rows.map(r => r.column_name);
    console.log('Found columns:', columns.join(', '));

    const hasVariantId = columns.includes('variant_id');
    console.log('Has "variant_id"?', hasVariantId ? 'YES' : 'NO');

    // Check Recipes table columns
    console.log('\nChecking columns in "recipes" table:');
    const resRecipes = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'recipes'
      ORDER BY ordinal_position;
    `);
    console.log('Found columns (recipes):', resRecipes.rows.map(r => r.column_name).join(', '));
    
    // Check menuItemVariants table columns
    console.log('\nChecking columns in "menu_item_variants" table:');
    const resVariants = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'menu_item_variants'
      ORDER BY ordinal_position;
    `);
    console.log('Found columns (menu_item_variants):', resVariants.rows.map(r => r.column_name).join(', '));

    // Check triggers on order_items
    console.log('\nChecking triggers on "order_items":');
    const resTriggers = await pool.query(`
      SELECT trigger_name, event_manipulation, action_statement
      FROM information_schema.triggers
      WHERE event_object_table = 'order_items';
    `);
    if(resTriggers.rows.length > 0) {
        console.log('Found triggers:', JSON.stringify(resTriggers.rows, null, 2));
    } else {
        console.log('No triggers found.');
    }

    // 2. If missing, try to add it again with detailed error logging
    if (!hasVariantId) {
      console.log('\nAttempting to ADD "variant_id" column...');
      try {
        await pool.query(`ALTER TABLE order_items ADD COLUMN variant_id TEXT`);
        console.log('SUCCESS: Column "variant_id" added.');
      } catch (err) {
        console.error('ERROR adding column:', err.message);
        console.error('Full error:', JSON.stringify(err, null, 2));
      }
    } else {
      console.log('\nColumn "variant_id" already exists. No action needed.');
    }

  } catch (err) {
    console.error('CRITICAL ERROR:', err);
  } finally {
    await pool.end();
    console.log('--- DEBUG DB COLUMNS END ---');
  }
}

main();

import pkg from 'pg';
const { Pool } = pkg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

try {
  const res = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='menu_items' AND column_name='kitchen_section_id'");
  console.log('kitchen_section_id exists:', res.rows.length > 0);
  
  const res2 = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='menu_items'");
  console.log('All columns in menu_items:', res2.rows.map(r => r.column_name).join(', '));
} finally {
  await pool.end();
}

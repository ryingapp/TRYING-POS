const { Pool } = require('/opt/trying/node_modules/pg');
require('/opt/trying/node_modules/dotenv').config({ path: '/opt/trying/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const names = ['سارة الحربي', 'خالد العتيبي', 'فهد القحطاني'];
  
  // Show before deleting
  const before = await pool.query(
    `SELECT id, name, role, branch_id FROM users WHERE name = ANY($1)`,
    [names]
  );
  console.log('Found users to delete:', JSON.stringify(before.rows, null, 2));
  
  if (before.rows.length === 0) {
    console.log('No users found with those names.');
    await pool.end();
    return;
  }

  const ids = before.rows.map(u => u.id);
  
  // Delete
  const result = await pool.query(
    `DELETE FROM users WHERE id = ANY($1) RETURNING name, role`,
    [ids]
  );
  
  console.log('Deleted:', JSON.stringify(result.rows, null, 2));
  console.log(`Total deleted: ${result.rowCount}`);
  
  await pool.end();
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });

const { Pool } = require('/opt/trying/node_modules/pg');
require('/opt/trying/node_modules/dotenv').config({ path: '/opt/trying/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function go() {
  const b = await pool.query('SELECT id, name FROM branches LIMIT 20');
  console.log('BRANCHES:', JSON.stringify(b.rows, null, 2));
  const u = await pool.query("SELECT id, name, role, branch_id FROM users WHERE role != 'platform_admin' LIMIT 20");
  console.log('USERS:', JSON.stringify(u.rows, null, 2));
  const o = await pool.query('SELECT branch_id, COUNT(*) as cnt FROM orders GROUP BY branch_id ORDER BY cnt DESC');
  console.log('ORDERS_BY_BRANCH:', JSON.stringify(o.rows, null, 2));
  const recent = await pool.query('SELECT id, branch_id, created_at FROM orders ORDER BY created_at DESC LIMIT 5');
  console.log('RECENT_ORDERS:', JSON.stringify(recent.rows, null, 2));
  await pool.end();
}
go().catch(e => { console.error('ERROR:', e.message); process.exit(1); });

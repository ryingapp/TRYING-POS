const { Pool } = require('pg');
const p = new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_41htWOCBVKyn@ep-blue-bush-aibgf4j4-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require' });
p.query('SELECT id, email, role, is_active, restaurant_id FROM users LIMIT 20')
  .then(r => { console.log(JSON.stringify(r.rows, null, 2)); p.end(); })
  .catch(e => { console.error(e); p.end(); });

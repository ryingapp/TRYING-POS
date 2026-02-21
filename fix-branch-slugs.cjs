const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

async function main() {
  const { rows } = await pool.query('SELECT id, restaurant_id, slug, name FROM branches');
  console.log('All branches:', rows);
  
  for (const b of rows) {
    if (!b.slug) {
      let slug = generateSlug(b.name || 'branch');
      if (!slug) slug = 'branch-' + b.id.substring(0, 6);
      
      // Check uniqueness within same restaurant
      const { rows: existing } = await pool.query(
        'SELECT id FROM branches WHERE slug = $1 AND restaurant_id = $2',
        [slug, b.restaurant_id]
      );
      if (existing.length > 0) {
        slug = slug + '-' + b.id.substring(0, 6);
      }
      
      await pool.query('UPDATE branches SET slug = $1 WHERE id = $2', [slug, b.id]);
      console.log(`Set slug for branch ${b.id} (${b.name}): ${slug}`);
    } else {
      console.log(`Already has slug: ${b.id} -> ${b.slug}`);
    }
  }
  
  // Verify
  const { rows: after } = await pool.query('SELECT id, restaurant_id, slug, name FROM branches');
  console.log('\nAfter update:', after);
  
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });

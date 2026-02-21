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
  const { rows } = await pool.query('SELECT id, slug, name_en FROM restaurants');
  console.log('All restaurants:', rows);
  
  for (const r of rows) {
    if (!r.slug) {
      let slug = generateSlug(r.name_en || 'restaurant');
      if (!slug) slug = 'restaurant-' + r.id.substring(0, 6);
      
      // Check uniqueness
      const { rows: existing } = await pool.query('SELECT id FROM restaurants WHERE slug = $1', [slug]);
      if (existing.length > 0) {
        slug = slug + '-' + r.id.substring(0, 6);
      }
      
      await pool.query('UPDATE restaurants SET slug = $1 WHERE id = $2', [slug, r.id]);
      console.log(`Set slug for ${r.id} (${r.name_en}): ${slug}`);
    } else {
      console.log(`Already has slug: ${r.id} -> ${r.slug}`);
    }
  }
  
  // Verify
  const { rows: after } = await pool.query('SELECT id, slug, name_en FROM restaurants');
  console.log('\nAfter update:', after);
  
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });

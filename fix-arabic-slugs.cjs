const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function generateCleanSlug(name) {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]+/g, '') // strip Arabic
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return slug;
}

function randomSuffix() {
  return Math.random().toString(36).substring(2, 8);
}

async function main() {
  // Fix restaurants with Arabic/empty slugs
  const { rows: restaurants } = await pool.query('SELECT id, slug, name_en, name_ar FROM restaurants');
  console.log('=== Restaurants ===');
  for (const r of restaurants) {
    const hasNonLatin = r.slug && /[^\x00-\x7F]/.test(r.slug);
    const isEmpty = !r.slug || r.slug.trim() === '';
    if (hasNonLatin || isEmpty) {
      let newSlug = generateCleanSlug(r.name_en || '');
      if (!newSlug) newSlug = 'r-' + randomSuffix();
      // Check uniqueness
      const { rows: existing } = await pool.query('SELECT id FROM restaurants WHERE slug = $1 AND id != $2', [newSlug, r.id]);
      if (existing.length > 0) newSlug = newSlug + '-' + randomSuffix();
      await pool.query('UPDATE restaurants SET slug = $1 WHERE id = $2', [newSlug, r.id]);
      console.log(`Fixed: ${r.slug || '(empty)'} -> ${newSlug} (${r.name_en || r.name_ar})`);
    } else {
      console.log(`OK: ${r.slug} (${r.name_en})`);
    }
  }

  // Fix branches with Arabic/empty slugs
  const { rows: branches } = await pool.query('SELECT id, restaurant_id, slug, name FROM branches');
  console.log('\n=== Branches ===');
  for (const b of branches) {
    const hasNonLatin = b.slug && /[^\x00-\x7F]/.test(b.slug);
    const isEmpty = !b.slug || b.slug.trim() === '';
    if (hasNonLatin || isEmpty) {
      let newSlug = generateCleanSlug(b.name || '');
      if (!newSlug) newSlug = 'b-' + randomSuffix();
      // Check uniqueness within restaurant
      const { rows: existing } = await pool.query(
        'SELECT id FROM branches WHERE slug = $1 AND restaurant_id = $2 AND id != $3',
        [newSlug, b.restaurant_id, b.id]
      );
      if (existing.length > 0) newSlug = newSlug + '-' + randomSuffix();
      await pool.query('UPDATE branches SET slug = $1 WHERE id = $2', [newSlug, b.id]);
      console.log(`Fixed: ${b.slug || '(empty)'} -> ${newSlug} (${b.name})`);
    } else {
      console.log(`OK: ${b.slug} (${b.name})`);
    }
  }

  // Show final state
  const { rows: finalR } = await pool.query('SELECT id, slug, name_en FROM restaurants ORDER BY slug');
  const { rows: finalB } = await pool.query('SELECT id, restaurant_id, slug, name FROM branches ORDER BY slug');
  console.log('\n=== Final Restaurants ===');
  finalR.forEach(r => console.log(`  ${r.slug} -> ${r.name_en}`));
  console.log('\n=== Final Branches ===');
  finalB.forEach(b => console.log(`  ${b.slug} -> ${b.name} (restaurant: ${b.restaurant_id.substring(0,8)})`));

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });

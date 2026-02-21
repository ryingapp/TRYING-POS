const { Pool } = require("pg");
const p = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  try {
    await p.query("ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS slug VARCHAR UNIQUE");
    console.log("restaurants.slug added");
    await p.query("ALTER TABLE branches ADD COLUMN IF NOT EXISTS slug VARCHAR");
    console.log("branches.slug added");
    await p.query("UPDATE restaurants SET slug = 'al-majlis' WHERE slug IS NULL");
    console.log("slug set to al-majlis");
    const r = await p.query("SELECT id, slug FROM restaurants");
    console.log("Rows:", r.rows);
  } catch(e) { console.error("ERROR:", e.message); }
  finally { await p.end(); }
})();

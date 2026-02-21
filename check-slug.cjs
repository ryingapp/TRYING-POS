const { Pool } = require("pg");
const p = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  try {
    const r = await p.query("SELECT id, slug FROM restaurants");
    console.log("Restaurants:", r.rows);
    const b = await p.query("SELECT id, slug, name FROM branches");
    console.log("Branches:", b.rows);
  } catch(e) { console.error("ERROR:", e.message); }
  finally { await p.end(); }
})();

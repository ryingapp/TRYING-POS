const { Pool } = require("pg");
const p = new Pool({ connectionString: process.env.DATABASE_URL });
(async () => {
  try {
    await p.query("UPDATE restaurants SET slug = 'al-majlis' WHERE id = 'default'");
    console.log("Set slug for default restaurant to al-majlis");
    const r = await p.query("SELECT id, slug FROM restaurants WHERE id = 'default'");
    console.log("Result:", r.rows);
  } catch(e) { console.error("ERROR:", e.message); }
  finally { await p.end(); }
})();

import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_41htWOCBVKyn@ep-blue-bush-aibgf4j4-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require"
});

async function check() {
  try {
    const r = await pool.query("SELECT * FROM menu_items LIMIT 1");
    console.log("Direct query columns:", Object.keys(r.rows[0] || {}));
    
    // Try selecting with explicit kitchen_section_id
    const r2 = await pool.query("SELECT id, name_en, kitchen_section_id FROM menu_items LIMIT 1");
    console.log("With kitchen_section_id:", r2.rows[0]);
  } catch (e) {
    console.error("Error:", e.message);
  }
  await pool.end();
}

check();

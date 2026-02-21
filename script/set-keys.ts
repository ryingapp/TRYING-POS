import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  // First list all restaurants
  const list = await pool.query(`SELECT id, name_en, moyasar_publishable_key FROM restaurants`);
  console.log("Restaurants found:", list.rows);
  
  // Update ALL restaurants with test keys
  const res = await pool.query(
    `UPDATE restaurants SET moyasar_publishable_key = $1, moyasar_secret_key = $2`,
    [
      "pk_test_rB9wRvYd2MJ8dzqCimEtMYSxtijdtfPRfjFxd9Gu",
      "sk_test_QSi3TuSjLytiX9WWv5rQVwJm5HrFctXCTZa9SU2E",
    ]
  );
  console.log("Updated rows:", res.rowCount);
  await pool.end();
}

main().catch(console.error);

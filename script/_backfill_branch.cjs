/**
 * Backfill: assign orders with branch_id = NULL to each restaurant's main branch.
 * 
 * Logic:
 * 1. Find restaurants that have null-branchId orders
 * 2. For each restaurant, find the main branch (is_main=true, or name like 'main', or first branch)
 * 3. Update null-branchId orders to point to that main branch
 */
const { Pool } = require('/opt/trying/node_modules/pg');
require('/opt/trying/node_modules/dotenv').config({ path: '/opt/trying/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get restaurants that have null-branchId orders
    const restaurantsRes = await client.query(`
      SELECT DISTINCT restaurant_id FROM orders WHERE branch_id IS NULL
    `);
    const restaurantIds = restaurantsRes.rows.map(r => r.restaurant_id);
    console.log(`Found ${restaurantIds.length} restaurants with null-branchId orders`);

    let totalUpdated = 0;

    for (const restaurantId of restaurantIds) {
      // Find the main branch for this restaurant
      // Priority: id='main-branch', then is_main=true, then name ilike '%main%', then first branch
      const branchRes = await client.query(`
        SELECT id, name, is_main FROM branches
        WHERE restaurant_id = $1
        ORDER BY
          CASE WHEN id = 'main-branch' THEN 0
               WHEN is_main = true THEN 1
               WHEN LOWER(name) LIKE '%main%' THEN 2
               ELSE 3
          END,
          created_at ASC
        LIMIT 1
      `, [restaurantId]);

      if (branchRes.rows.length === 0) {
        console.log(`  [SKIP] Restaurant ${restaurantId}: no branches found, leaving orders as null`);
        continue;
      }

      const mainBranch = branchRes.rows[0];
      
      // Count orders to update
      const countRes = await client.query(
        `SELECT COUNT(*) as cnt FROM orders WHERE restaurant_id = $1 AND branch_id IS NULL`,
        [restaurantId]
      );
      const count = parseInt(countRes.rows[0].cnt);
      
      // Update
      await client.query(
        `UPDATE orders SET branch_id = $1 WHERE restaurant_id = $2 AND branch_id IS NULL`,
        [mainBranch.id, restaurantId]
      );
      
      console.log(`  [OK] Restaurant ${restaurantId}: assigned ${count} orders to branch "${mainBranch.name}" (${mainBranch.id})`);
      totalUpdated += count;
    }

    await client.query('COMMIT');
    console.log(`\nDone. Total orders updated: ${totalUpdated}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('ERROR - rolled back:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error(e.message); process.exit(1); });

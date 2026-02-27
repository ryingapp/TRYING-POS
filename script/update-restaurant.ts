import pg from "pg";
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_41htWOCBVKyn@ep-blue-bush-aibgf4j4-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require",
});

async function main() {
  const result = await pool.query(
    `UPDATE restaurants SET 
      name_en = $1,
      name_ar = $2,
      description_en = $3,
      description_ar = $4,
      logo = $5,
      banner = $6,
      kitchen_type = $7,
      price_range = $8
    WHERE id = $9
    RETURNING id, name_en, name_ar`,
    [
      "Washel",
      "واصل",
      "The best burgers, sandwiches, wraps and fresh drinks in town. Made with premium ingredients and served with love.",
      "أفضل البرجرات والساندويتشات والرابات والمشروبات الطازجة. مصنوعة من أجود المكونات ومقدمة بحب.",
      "https://images.unsplash.com/photo-1586816001966-79b736744398?w=400",
      "https://images.unsplash.com/photo-1550547660-d9450f859349?w=800",
      "fast_food",
      "$$",
      "2a1a1bcf-b9bc-4991-ae74-a258b922c61b",
    ]
  );

  console.log("Updated restaurant:", JSON.stringify(result.rows[0], null, 2));
  await pool.end();
}

main().catch(console.error);

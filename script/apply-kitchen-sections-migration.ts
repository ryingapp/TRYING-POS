import pkg from "pg";
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function applyMigration() {
  console.log("Applying kitchen sections migration...");
  
  const client = await pool.connect();
  
  try {
    // Create kitchen_sections table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "kitchen_sections" (
        "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "restaurant_id" varchar NOT NULL,
        "branch_id" varchar,
        "name_en" text NOT NULL,
        "name_ar" text NOT NULL,
        "icon" text,
        "color" text DEFAULT '#8B1A1A',
        "sort_order" integer DEFAULT 0,
        "is_active" boolean DEFAULT true,
        "created_at" timestamp DEFAULT now()
      )
    `);
    console.log("✓ Created kitchen_sections table");

    // Add kitchen_section_id to menu_items
    await client.query(`
      ALTER TABLE "menu_items" 
      ADD COLUMN IF NOT EXISTS "kitchen_section_id" varchar
    `);
    console.log("✓ Added kitchen_section_id to menu_items");

    // Add kitchen_section_id to printers
    await client.query(`
      ALTER TABLE "printers" 
      ADD COLUMN IF NOT EXISTS "kitchen_section_id" varchar
    `);
    console.log("✓ Added kitchen_section_id to printers");

    // Add foreign key constraints (will fail if they already exist, but that's ok)
    try {
      await client.query(`
        ALTER TABLE "kitchen_sections" 
        ADD CONSTRAINT "kitchen_sections_restaurant_id_restaurants_id_fk" 
        FOREIGN KEY ("restaurant_id") REFERENCES "public"."restaurants"("id") 
        ON DELETE no action ON UPDATE no action
      `);
      console.log("✓ Added kitchen_sections->restaurants FK");
    } catch (e: any) {
      if (e.message?.includes("already exists")) {
        console.log("⊘ FK kitchen_sections->restaurants already exists");
      } else throw e;
    }

    try {
      await client.query(`
        ALTER TABLE "kitchen_sections" 
        ADD CONSTRAINT "kitchen_sections_branch_id_branches_id_fk" 
        FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") 
        ON DELETE no action ON UPDATE no action
      `);
      console.log("✓ Added kitchen_sections->branches FK");
    } catch (e: any) {
      if (e.message?.includes("already exists")) {
        console.log("⊘ FK kitchen_sections->branches already exists");
      } else throw e;
    }

    try {
      await client.query(`
        ALTER TABLE "menu_items" 
        ADD CONSTRAINT "menu_items_kitchen_section_id_kitchen_sections_id_fk" 
        FOREIGN KEY ("kitchen_section_id") REFERENCES "public"."kitchen_sections"("id") 
        ON DELETE no action ON UPDATE no action
      `);
      console.log("✓ Added menu_items->kitchen_sections FK");
    } catch (e: any) {
      if (e.message?.includes("already exists")) {
        console.log("⊘ FK menu_items->kitchen_sections already exists");
      } else throw e;
    }

    try {
      await client.query(`
        ALTER TABLE "printers" 
        ADD CONSTRAINT "printers_kitchen_section_id_kitchen_sections_id_fk" 
        FOREIGN KEY ("kitchen_section_id") REFERENCES "public"."kitchen_sections"("id") 
        ON DELETE no action ON UPDATE no action
      `);
      console.log("✓ Added printers->kitchen_sections FK");
    } catch (e: any) {
      if (e.message?.includes("already exists")) {
        console.log("⊘ FK printers->kitchen_sections already exists");
      } else throw e;
    }

    console.log("\n✅ Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

applyMigration();

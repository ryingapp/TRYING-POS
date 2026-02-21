import "dotenv/config";
import { db } from "../server/db";
import { branches } from "../shared/schema";
import { eq, asc, sql } from "drizzle-orm";

async function main() {
  // Get all distinct restaurant IDs
  const allBranches = await db.select().from(branches).orderBy(asc(branches.createdAt));
  
  const restaurantIds = [...new Set(allBranches.map(b => b.restaurantId))];
  
  for (const rid of restaurantIds) {
    const rBranches = allBranches.filter(b => b.restaurantId === rid);
    const hasMain = rBranches.some(b => b.isMain);
    
    if (!hasMain && rBranches.length > 0) {
      // Set the oldest branch as main
      await db.update(branches)
        .set({ isMain: true })
        .where(eq(branches.id, rBranches[0].id));
      console.log(`Set branch "${rBranches[0].name}" (${rBranches[0].id}) as main for restaurant ${rid}`);
    } else if (hasMain) {
      console.log(`Restaurant ${rid} already has a main branch`);
    }
  }
  
  // Show result
  const result = await db.select().from(branches).orderBy(asc(branches.createdAt));
  console.log("\nAll branches:");
  console.table(result.map(b => ({ id: b.id, name: b.name, isMain: b.isMain, restaurantId: b.restaurantId })));
  
  process.exit(0);
}

main().catch(console.error);

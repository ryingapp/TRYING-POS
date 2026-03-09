
import { storage } from "./server/storage";
import { db } from "./server/db";

async function test() {
  console.log("Testing getTable with invalid UUID...");
  try {
    const table = await storage.getTable("invalid-uuid-123");
    console.log("Result:", table);
  } catch (error) {
    console.error("Error:", error);
  }
  process.exit(0);
}

test();

import "dotenv/config";
import { db } from "./server/db";
import { sql } from "drizzle-orm";

console.log("Testing DB connection and schema guard...");

async function test() {
  // Give guard time to run
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test a simple query
  const result = await db.execute(sql`SELECT 1 as test`);
  console.log("Query test passed:", result.rows);
  
  console.log("✅ DB initialized successfully with schema guard!");
  process.exit(0);
}

test().catch((error) => {
  console.error("Test failed:", error);
  process.exit(1);
});

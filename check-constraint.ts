import "dotenv/config";
import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function checkConstraint() {
  // Check as index (unique indexes show up here)
  const indexCheck = await db.execute(sql`
    SELECT indexname 
    FROM pg_indexes 
    WHERE tablename = 'wp_pull_jobs' 
    AND indexname = 'wp_pull_jobs_target_hash_unique'
  `);

  console.log("Checking wp_pull_jobs_target_hash_unique...");
  
  if (indexCheck.rows.length > 0) {
    console.log("✅ EXISTS as index");
  } else {
    console.log("❌ NOT FOUND as index");
    
    // Try as constraint
    const constraintCheck = await db.execute(sql`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'wp_pull_jobs' 
      AND constraint_name = 'wp_pull_jobs_target_hash_unique'
    `);
    
    if (constraintCheck.rows.length > 0) {
      console.log("✅ EXISTS as constraint");
    } else {
      console.log("❌ NOT FOUND as constraint");
    }
  }

  process.exit(0);
}

checkConstraint();

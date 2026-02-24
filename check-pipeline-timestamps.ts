import "dotenv/config";
import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function checkTimestamps() {
  const result = await db.execute(sql`
    SELECT 
      id,
      created_at,
      updated_at,
      story_hash,
      canonical_source_url
    FROM pipeline_items 
    WHERE story_hash IS NOT NULL 
    ORDER BY created_at DESC 
    LIMIT 10
  `);

  console.log("\n📅 Pipeline items with story_hash:\n");
  
  for (const row of result.rows as any[]) {
    console.log(`ID: ${row.id.substring(0, 8)}...`);
    console.log(`  Created: ${row.created_at}`);
    console.log(`  Updated: ${row.updated_at}`);
    console.log(`  Story Hash: ${row.story_hash ? "Present" : "NULL"}`);
    console.log(`  Canonical URL: ${row.canonical_source_url ? "Present" : "NULL"}`);
    console.log("");
  }

  process.exit(0);
}

checkTimestamps();

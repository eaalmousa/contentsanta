import "dotenv/config";
import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function checkSourceMetadata() {
  // Get a sample source_item with metadata
  const result = await db.execute(sql`
    SELECT 
      id,
      url,
      metadata_json
    FROM source_items 
    WHERE metadata_json IS NOT NULL 
    LIMIT 3
  `);

  console.log("\n📋 Sample source_items metadata_json structures:\n");
  
  for (const row of result.rows as any[]) {
    console.log(`Source ID: ${row.id.substring(0, 8)}...`);
    console.log(`URL: ${row.url.substring(0, 80)}`);
    console.log(`Metadata keys: ${Object.keys(row.metadata_json || {}).join(", ")}`);
    
    const meta = row.metadata_json;
    console.log(`   - canonicalUrl: ${meta?.canonicalUrl || "NOT PRESENT"}`);
    console.log(`   - url: ${meta?.url || "NOT PRESENT"}`);
    console.log(`   - link: ${meta?.link || "NOT PRESENT"}`);
    console.log("");
  }

  process.exit(0);
}

checkSourceMetadata();

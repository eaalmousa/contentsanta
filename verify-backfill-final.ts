import "dotenv/config";
import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function verifyBackfill() {
  const total = await db.execute(sql`
    SELECT COUNT(*) as count 
    FROM pipeline_items 
    WHERE story_hash IS NOT NULL
  `);

  const nulls = await db.execute(sql`
    SELECT COUNT(*) as count 
    FROM pipeline_items 
    WHERE story_hash IS NOT NULL 
    AND canonical_source_url IS NULL
  `);

  const totalCount = parseInt((total.rows[0] as any).count, 10);
  const nullCount = parseInt((nulls.rows[0] as any).count, 10);

  console.log("\n📊 Backfill Verification:\n");
  console.log(`Total items with story_hash: ${totalCount}`);
  console.log(`Items with NULL canonical_source_url: ${nullCount}`);
  console.log(`Items with populated canonical_source_url: ${totalCount - nullCount}`);
  console.log(`\nBackfill status: ${nullCount === 0 ? '✅ COMPLETE (100%)' : '⚠️ INCOMPLETE'}`);

  process.exit(nullCount === 0 ? 0 : 1);
}

verifyBackfill();

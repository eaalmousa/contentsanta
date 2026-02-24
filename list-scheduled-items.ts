import "dotenv/config";
import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function listScheduledItems() {
  const items = await db.execute(sql`
    SELECT 
      id,
      generated_title,
      status,
      scheduled_for,
      target_id,
      story_hash,
      canonical_source_url,
      featured_image_url
    FROM pipeline_items
    WHERE status = 'scheduled'
    ORDER BY created_at DESC
    LIMIT 10
  `);

  console.log("\n📦 Scheduled Pipeline Items:\n");
  console.log(`Found ${items.rows.length} item(s)\n`);

  for (const item of items.rows as any[]) {
    console.log(`ID: ${item.id.substring(0, 8)}...`);
    console.log(`  Title: ${item.generated_title?.substring(0, 60)}`);
    console.log(`  Status: ${item.status}`);
    console.log(`  Scheduled For: ${item.scheduled_for}`);
    console.log(`  Target: ${item.target_id ? item.target_id.substring(0, 8) + "..." : "NULL"}`);
    console.log(`  Story Hash: ${item.story_hash ? "Present" : "NULL"}`);
    console.log(`  Canonical URL: ${item.canonical_source_url ? "Present" : "NULL"}`);
    console.log(`  Featured Image: ${item.featured_image_url ? "Present" : "NULL"}`);
    console.log("");
  }

  process.exit(0);
}

listScheduledItems();

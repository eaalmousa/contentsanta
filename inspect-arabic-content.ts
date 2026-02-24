import "dotenv/config";
import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function inspectArabicContent() {
  console.log("\n🔍 Inspecting Gulf Estate Gazette scheduled items for Arabic content...\n");

  const targetResult = await db.execute(sql`
    SELECT id FROM publishing_targets WHERE name ILIKE '%Gulf Estate%'
  `);

  if (targetResult.rows.length === 0) {
    console.log("❌ Target not found");
    return;
  }

  const targetId = (targetResult.rows[0] as any).id;

  // Get a few scheduled items
  const itemsResult = await db.execute(sql`
    SELECT 
      id,
      generated_title,
      status,
      quarantine_reason,
      LENGTH(generated_title) as title_len,
      LENGTH(generated_body) as body_len
    FROM pipeline_items
    WHERE target_id = ${targetId}
      AND status IN ('scheduled', 'quarantined')
    ORDER BY created_at DESC
    LIMIT 5
  `);

  console.log("📦 Sample items:");
  for (const row of itemsResult.rows) {
    const item = row as any;
    console.log(`\n[${item.id.substring(0, 8)}] Status: ${item.status}`);
    console.log(`  Title: ${item.generated_title}`);
    console.log(`  Title length: ${item.title_len} | Body length: ${item.body_len}`);
    
    // Check for Arabic characters in title
    const arabicMatch = /[\u0600-\u06FF]/.test(item.generated_title || "");
    console.log(`  Contains Arabic: ${arabicMatch ? "✅ YES" : "❌ NO"}`);
    
    if (item.quarantine_reason) {
      console.log(`  Quarantine reason: ${item.quarantine_reason}`);
    }
  }

  console.log("\n✅ Inspection complete");
}

inspectArabicContent().catch(console.error);

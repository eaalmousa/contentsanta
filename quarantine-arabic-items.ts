
import * as dotenv from "dotenv";
dotenv.config();

import { db } from "./server/db";
import { pipelineItems } from "./shared/schema";
import { sql, eq, or, and } from "drizzle-orm";

async function quarantineArabic() {
  console.log("🧹 Cleaning up Arabic items...");

  // Regex for Arabic characters
  const arabicRegex = '[\u0600-\u06FF]';

  // Find items to skip
  const itemsToSkip = await db.execute(sql`
    SELECT id, generated_title, status 
    FROM pipeline_items 
    WHERE generated_title ~ ${arabicRegex}
    AND status IN ('ranked', 'generated', 'quarantined', 'retrying', 'scheduled')
  `);

  console.log(`Found ${itemsToSkip.rows.length} Arabic items to skip.`);

  if (itemsToSkip.rows.length > 0) {
    const ids = itemsToSkip.rows.map((row: any) => row.id);
    
    await db.update(pipelineItems)
      .set({
        status: "skipped",
        skipReason: "Language mismatch (Manual Cleanup)",
        lastErrorMessage: "Cleaned up by quarantine-arabic-items.ts"
      })
      .where(sql`id IN ${ids}`);
      
    console.log("✅ Moved items to skipped.");
  } else {
    console.log("No items needed cleanup.");
  }

  process.exit(0);
}

quarantineArabic().catch(console.error);

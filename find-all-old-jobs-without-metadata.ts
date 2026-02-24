import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function findOldJobsWithoutImageMetadata() {
  console.log("🔍 Finding old jobs missing image metadata...\n");

  const result = await db.execute(
    sql`SELECT id, title, status, created_at, attempts,
               payload_json->>'featuredImageUrl' as image_url,
               payload_json->>'featuredImageCredit' as image_credit,
               payload_json->>'featuredImageCaption' as image_caption
        FROM wp_pull_jobs
        WHERE status IN ('queued', 'leased')
          AND payload_json->>'featuredImageUrl' IS NOT NULL
          AND payload_json->>'featuredImageCredit' IS NULL
        ORDER BY created_at DESC
        LIMIT 20`
  );

  console.log(`Found ${result.rows.length} jobs with images but no metadata:\n`);
  
  for (const job of result.rows) {
    console.log(`  ${job.title}`);
    console.log(`    Status: ${job.status}`);
    console.log(`    Created: ${job.created_at}`);
    console.log(`    Image: ${job.image_url ? "Yes" : "No"}`);
    console.log(`    Credit: ${job.image_credit || "(missing)"}`);
    console.log(`    Caption: ${job.image_caption || "(missing)"}`);
    console.log("");
  }

  if (result.rows.length > 1) {
    console.log(`\n⚠️ Found ${result.rows.length} old jobs that need fixing`);
    console.log(`Would you like me to batch-fix all of them?`);
  }
}

findOldJobsWithoutImageMetadata().catch(console.error);

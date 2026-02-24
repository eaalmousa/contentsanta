import { db } from "./server/db";
import { wpPullJobs } from "./shared/schema";
import { sql } from "drizzle-orm";

async function batchFixOldJobs() {
  console.log("🔧 Batch-fixing old jobs with missing image metadata...\n");

  // Find all jobs needing fixes
  const result = await db.execute(
    sql`SELECT id, title, payload_json
        FROM wp_pull_jobs
        WHERE status IN ('queued', 'leased')
          AND payload_json->>'featuredImageUrl' IS NOT NULL
          AND payload_json->>'featuredImageCredit' IS NULL
        ORDER BY created_at DESC`
  );

  console.log(`Found ${result.rows.length} jobs to fix\n`);

  let fixed = 0;
  for (const row of result.rows) {
    const payload = row.payload_json as any;
    
    // Update payload with metadata
    const updatedPayload = {
      ...payload,
      featuredImageCredit: payload.sourceName || "Source Article",
      featuredImageCaption: payload.title || "",
    };

    // Update job
    await db.execute(
      sql`UPDATE wp_pull_jobs
          SET payload_json = ${JSON.stringify(updatedPayload)},
              status = 'queued',
              attempts = 0,
              lease_expires_at = NULL,
              updated_at = NOW()
          WHERE id = ${row.id}`
    );

    console.log(`✅ Fixed: ${row.title.substring(0, 60)}...`);
    fixed++;
  }

  console.log(`\n✅ Batch-fix complete: ${fixed} jobs updated`);
  console.log(`\n⚠️ CRITICAL: These jobs will be processed by the plugin within 2 minutes`);
  console.log(`⚠️ Make sure you've uploaded content-santa-connector-v2.php (v0.3.0) to WordPress!`);
  console.log(`\nWithout the V0.3.0 plugin, images will NOT be downloaded/uploaded to WordPress.`);
}

batchFixOldJobs().catch(console.error);

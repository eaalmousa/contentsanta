import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function cleanupShellShockJob() {
  console.log("🧹 Cleaning up stuck Shell Shock job...\n");

  const jobId = "82617bcf-9d16-4554-9151-a5a37ae655ae";

  // Mark the job as completed to prevent further polling
  await db.execute(
    sql`UPDATE wp_pull_jobs
        SET status = 'completed',
            updated_at = NOW(),
            result_wp_url = 'https://gulfestate.com/shell-shock-kuwait-gripped-by-surge-in-egg-prices/'
        WHERE id = ${jobId}`
  );

  console.log(`✅ Job ${jobId} marked as completed`);
  console.log("✅ This will prevent the plugin from pulling it again\n");

  // Check current status
  const result = await db.execute(
    sql`SELECT id, status, updated_at, result_wp_url
        FROM wp_pull_jobs
        WHERE id = ${jobId}`
  );

  if (result.rows.length > 0) {
    const job = result.rows[0];
    console.log("Current job status:");
    console.log(`  ID: ${job.id}`);
    console.log(`  Status: ${job.status}`);
    console.log(`  Updated: ${job.updated_at}`);
    console.log(`  WP URL: ${job.result_wp_url}`);
  }

  console.log("\n✅ Cleanup complete!");
  console.log("\n⚠️ IMPORTANT: Make sure you've uploaded content-santa-connector-v2.php to WordPress!");
}

cleanupShellShockJob().catch(console.error);

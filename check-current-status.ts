import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function checkCurrentStatus() {
  const workspaceId = "6830ca7f-cf7b-4d6c-97bc-3615fa563be9";

  console.log("📊 Current Pipeline Status:\n");

  const items = await db.execute(
    sql`SELECT id, generated_title, status, updated_at, 
               EXTRACT(EPOCH FROM (NOW() - updated_at))/60 as minutes_ago,
               target_post_id, target_permalink
        FROM pipeline_items
        WHERE workspace_id = ${workspaceId}
          AND status IN ('publishing', 'published', 'quarantined')
        ORDER BY updated_at DESC
        LIMIT 15`
  );

  console.log(`Total items: ${items.rows.length}\n`);

  for (const item of items.rows) {
    const status = String(item.status).toUpperCase().padEnd(12);
    const mins = Math.round(Number(item.minutes_ago));
    const title = String(item.generated_title).substring(0, 70);
    console.log(`${status} ${mins}m ago - ${title}`);
    if (item.target_post_id) console.log(`           → WP Post ID: ${item.target_post_id}`);
    if (item.target_permalink) console.log(`           → WP URL: ${item.target_permalink}`);
  }

  // Check WP jobs status
  console.log("\n📋 WP Pull Jobs Status:\n");
  const jobs = await db.execute(
    sql`SELECT status, COUNT(*) as count
        FROM wp_pull_jobs
        WHERE target_id = '8be2881b-9b51-4ef4-9ab1-94a3b05d5398'
        GROUP BY status`
  );

  for (const job of jobs.rows) {
    console.log(`  ${String(job.status).padEnd(15)}: ${job.count} jobs`);
  }
}

checkCurrentStatus().catch(console.error);

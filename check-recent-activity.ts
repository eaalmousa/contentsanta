import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function checkRecent() {
  console.log("🔍 Recent Activity (Last 15 Minutes):\n");

  // Check recent plugin requests
  const logs = await db.execute(
    sql`SELECT endpoint, method, http_status, reason, created_at
        FROM wp_plugin_request_logs
        WHERE target_id = '8be2881b-9b51-4ef4-9ab1-94a3b05d5398'
          AND created_at > NOW() - INTERVAL '15 minutes'
        ORDER BY created_at DESC`
  );

  console.log(`Plugin requests: ${logs.rows.length}\n`);

  if (logs.rows.length > 0) {
    for (const log of logs.rows) {
      const time = new Date(log.created_at).toLocaleTimeString();
      console.log(`${time} - ${log.method} ${log.endpoint} → ${log.http_status} (${log.reason})`);
    }
  } else {
    console.log("❌ No recent plugin activity detected");
    console.log("   Plugin may not be activated or configured correctly");
  }

  // Check recent pipeline item updates
  console.log("\n📋 Recent Pipeline Updates:\n");
  const items = await db.execute(
    sql`SELECT generated_title, status, updated_at, target_post_id, target_permalink
        FROM pipeline_items
        WHERE workspace_id = '6830ca7f-cf7b-4d6c-97bc-3615fa563be9'
          AND updated_at > NOW() - INTERVAL '15 minutes'
        ORDER BY updated_at DESC`
  );

  console.log(`Updated items: ${items.rows.length}\n`);

  if (items.rows.length > 0) {
    for (const item of items.rows) {
      const time = new Date(item.updated_at).toLocaleTimeString();
      const title = item.generated_title ? item.generated_title.substring(0, 60) : "(no title)";
      console.log(`${time} - ${item.status.toUpperCase()}: ${title}...`);
      if (item.target_post_id) console.log(`           WP Post ID: ${item.target_post_id}`);
    }
  }

  // Check WP jobs
  console.log("\n📦 WP Pull Jobs:\n");
  const jobs = await db.execute(
    sql`SELECT id, status, created_at, updated_at, result_wp_post_id, result_wp_url
        FROM wp_pull_jobs
        WHERE target_id = '8be2881b-9b51-4ef4-9ab1-94a3b05d5398'
        ORDER BY updated_at DESC
        LIMIT 5`
  );

  for (const job of jobs.rows) {
    console.log(`Job ${job.id.substring(0, 8)}... - ${job.status}`);
    console.log(`  Created: ${new Date(job.created_at).toLocaleTimeString()}`);
    console.log(`  Updated: ${new Date(job.updated_at).toLocaleTimeString()}`);
    if (job.result_wp_post_id) {
      console.log(`  ✅ Published: Post ID ${job.result_wp_post_id}`);
      console.log(`  ✅ URL: ${job.result_wp_url}`);
    }
    console.log("");
  }
}

checkRecent().catch(console.error);

import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function monitorProgress() {
  console.log("📊 Publishing Progress Monitor\n");
  console.log("=".repeat(80));

  const workspaceId = "6830ca7f-cf7b-4d6c-97bc-3615fa563be9";
  const targetId = "8be2881b-9b51-4ef4-9ab1-94a3b05d5398"; // Gulf Estate Gazette

  // Pipeline items status
  const pipelineStatus = await db.execute(
    sql`SELECT status, COUNT(*) as count
        FROM pipeline_items
        WHERE workspace_id = ${workspaceId}
        GROUP BY status
        ORDER BY count DESC`
  );

  console.log("\n📋 Pipeline Items Status:");
  for (const row of pipelineStatus.rows) {
    const emoji = row.status === "published" ? "✅" : 
                  row.status === "scheduled" ? "⏰" :
                  row.status === "generated" ? "📝" :
                  row.status === "skipped" ? "⏭️" : "📊";
    console.log(`  ${emoji} ${row.status}: ${row.count}`);
  }

  // WP Pull Jobs status
  const wpJobsStatus = await db.execute(
    sql`SELECT status, COUNT(*) as count
        FROM wp_pull_jobs
        WHERE target_id = ${targetId}
        GROUP BY status
        ORDER BY count DESC`
  );

  console.log("\n🔄 WP Pull Jobs Status:");
  for (const row of wpJobsStatus.rows) {
    const emoji = row.status === "completed" ? "✅" :
                  row.status === "queued" ? "⏳" :
                  row.status === "leased" ? "🔒" :
                  row.status === "failed" ? "❌" : "📊";
    console.log(`  ${emoji} ${row.status}: ${row.count}`);
  }

  // Recently published items (should start appearing after plugin upload)
  const recentlyPublished = await db.execute(
    sql`SELECT 
          generated_title,
          target_post_id,
          published_at,
          DATE_TRUNC('second', NOW() - published_at) as time_ago
        FROM pipeline_items
        WHERE workspace_id = ${workspaceId}
          AND status = 'published'
          AND target_post_id IS NOT NULL
        ORDER BY published_at DESC
        LIMIT 10`
  );

  console.log(`\n✅ Recently Published (${recentlyPublished.rows.length}):`);
  if (recentlyPublished.rows.length === 0) {
    console.log("  ⚠️  No published items yet. Waiting for plugin to complete jobs...");
    console.log("  💡 Check WordPress plugin settings and ensure it's polling every 2 minutes.");
  } else {
    for (const item of recentlyPublished.rows) {
      console.log(`  • ${item.generated_title}`);
      console.log(`    WP Post ID: ${item.target_post_id}`);
      console.log(`    Published: ${item.published_at} (${item.time_ago} ago)`);
      console.log("");
    }
  }

  // Queued jobs (waiting for plugin to pull)
  const queuedJobs = await db.execute(
    sql`SELECT id, title, created_at
        FROM wp_pull_jobs
        WHERE target_id = ${targetId}
          AND status = 'queued'
        ORDER BY created_at ASC
        LIMIT 5`
  );

  console.log(`\n⏳ Queued Jobs (${queuedJobs.rows.length}):`);
  if (queuedJobs.rows.length === 0) {
    console.log("  ✅ No jobs in queue. All processed!");
  } else {
    console.log("  ℹ️  Plugin will pull these one-by-one every 2 minutes:");
    for (const job of queuedJobs.rows) {
      console.log(`  • ${job.title}`);
    }
  }

  // Health check
  const hasCompletedJobs = wpJobsStatus.rows.some(
    (r: any) => r.status === "completed" && Number(r.count) > 0
  );
  const hasPublishedItems = recentlyPublished.rows.length > 0;

  console.log("\n" + "=".repeat(80));
  console.log("\n🏥 Health Check:");
  if (hasCompletedJobs && hasPublishedItems) {
    console.log("  ✅ System healthy! Publishing pipeline is working correctly.");
  } else if (!hasCompletedJobs) {
    console.log("  ⚠️  No completed WP jobs yet.");
    console.log("  📌 Action: Upload content-santa-connector-v2.php (v0.3.0) to WordPress");
    console.log("  ⏱️  Expected: First job completes within 2-4 minutes after upload");
  } else if (!hasPublishedItems) {
    console.log("  ⚠️  WP jobs completed but items not marked as published.");
    console.log("  📌 Action: Check server logs for webhook errors");
  }

  console.log("\n💡 Run this script every 2-3 minutes to monitor progress.");
  console.log("   Command: npx tsx --env-file=.env monitor-publishing-progress.ts\n");
}

monitorProgress().catch(console.error);

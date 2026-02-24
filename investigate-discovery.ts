import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function investigateDiscovery() {
  console.log("🔍 Investigating Topic Discovery Issue\n");
  console.log("=".repeat(80));

  const workspaceId = "6830ca7f-cf7b-4d6c-97bc-3615fa563be9";
  const topicId = "3b028e16-1aed-408b-ad7a-f69e6ab4a541"; // Real Estate

  // 1. Check topic status
  console.log("\n📋 TOPIC STATUS:\n");
  const topic = await db.execute(
    sql`SELECT id, name, status, run_interval_minutes, source_mode
        FROM topics WHERE id = ${topicId}`
  );
  
  if (topic.rows.length === 0) {
    console.log("  ❌ Topic not found!");
    return;
  }

  const t = topic.rows[0];
  console.log(`  Name: ${t.name}`);
  console.log(`  Status: ${t.status}`);
  console.log(`  Discovery Interval: Every ${t.run_interval_minutes} minutes`);
  console.log(`  Source Mode: ${t.source_mode}`);

  // 2. Check enabled sources for this topic
  console.log("\n📡 ENABLED SOURCES:\n");
  const enabledSources = await db.execute(
    sql`SELECT ts.source_id, s.name, s.feed_url, s.language, s.last_fetched_at
        FROM topic_sources ts
        JOIN sources s ON ts.source_id = s.id
        WHERE ts.topic_id = ${topicId} AND ts.is_enabled = true`
  );

  console.log(`  Total Enabled: ${enabledSources.rows.length}`);
  for (const src of enabledSources.rows.slice(0, 5)) {
    console.log(`  • ${src.name} (${src.language})`);
    console.log(`    Last Fetched: ${src.last_fetched_at || "Never"}`);
  }

  // 3. Check if sources have items
  console.log("\n📰 SOURCE ITEMS AVAILABLE:\n");
  const sourceItemCounts = await db.execute(
    sql`SELECT COUNT(*) as count
        FROM source_items si
        WHERE si.workspace_id = ${workspaceId}
          AND si.source_id IN (
            SELECT ts.source_id FROM topic_sources ts 
            WHERE ts.topic_id = ${topicId} AND ts.is_enabled = true
          )`
  );

  console.log(`  Total Source Items: ${sourceItemCounts.rows[0].count}`);

  if (Number(sourceItemCounts.rows[0].count) === 0) {
    console.log("\n  ⚠️  NO SOURCE ITEMS FOUND!");
    console.log("  📌 Root Cause: RSS feeds haven't been fetched yet");
    console.log("  📌 Solution: RSS fetch job runs every 30 minutes");
    console.log("  📌 Workaround: Manually trigger RSS fetch from Sources page");
  }

  // 4. Check recent automation job runs
  console.log("\n🤖 RECENT AUTOMATION JOBS:\n");
  const recentJobs = await db.execute(
    sql`SELECT job_type, status, started_at, ended_at, 
               processed_count, success_count, fail_count
        FROM automation_job_runs
        WHERE topic_id = ${topicId}
        ORDER BY started_at DESC
        LIMIT 5`
  );

  if (recentJobs.rows.length === 0) {
    console.log("  ⚠️  No automation jobs found");
    console.log("  📌 Discovery hasn't run yet, or jobs were cleaned up");
  } else {
    for (const job of recentJobs.rows) {
      console.log(`  ${job.job_type} (${job.status})`);
      console.log(`    Started: ${job.started_at}`);
      console.log(`    Processed: ${job.processed_count}, Success: ${job.success_count}, Fail: ${job.fail_count}`);
    }
  }

  // 5. Check pipeline items
  console.log("\n📦 PIPELINE ITEMS:\n");
  const pipelineItems = await db.execute(
    sql`SELECT status, COUNT(*) as count
        FROM pipeline_items
        WHERE topic_id = ${topicId}
        GROUP BY status`
  );

  if (pipelineItems.rows.length === 0) {
    console.log("  ✅ No pipeline items (as expected after cleanup)");
  } else {
    for (const item of pipelineItems.rows) {
      console.log(`  ${item.status}: ${item.count}`);
    }
  }

  // 6. Check scheduler status
  console.log("\n⏰ SCHEDULER STATUS:\n");
  console.log("  Pipeline Automation: Runs every 10 minutes");
  console.log("  Topic Discovery: Runs every 20 minutes");
  console.log("  RSS Fetch: Runs every 30 minutes");

  console.log("\n" + "=".repeat(80));
  console.log("\n🔍 DIAGNOSIS:\n");

  if (Number(sourceItemCounts.rows[0].count) === 0) {
    console.log("  ❌ PROBLEM: No RSS feed items in database");
    console.log("\n  ✅ SOLUTION:");
    console.log("     1. Go to Sources page");
    console.log("     2. Click 'Fetch Now' on a few sources");
    console.log("     3. Wait 1-2 minutes for items to populate");
    console.log("     4. Come back to Topics and click 'Run Now'");
    console.log("\n  ⏱️  OR: Wait 30 minutes for automatic RSS fetch");
  } else {
    console.log("  ℹ️  Source items exist, checking other issues...");
    if (recentJobs.rows.length === 0) {
      console.log("  📌 Discovery job hasn't run yet");
      console.log("  📌 Click 'Run Now' or wait for automatic cycle");
    }
  }

  console.log("");
}

investigateDiscovery().catch(console.error);

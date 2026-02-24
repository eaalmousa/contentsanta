import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function completeCleanup() {
  console.log("🧹 COMPLETE PIPELINE CLEANUP\n");
  console.log("=".repeat(80));

  const workspaceId = "6830ca7f-cf7b-4d6c-97bc-3615fa563be9";
  const targetId = "8be2881b-9b51-4ef4-9ab1-94a3b05d5398"; // Gulf Estate Gazette

  // Show before state
  console.log("\n📊 BEFORE CLEANUP:\n");

  const counts = await Promise.all([
    db.execute(sql`SELECT COUNT(*) as count FROM pipeline_items WHERE workspace_id = ${workspaceId}`),
    db.execute(sql`SELECT COUNT(*) as count FROM wp_pull_jobs WHERE target_id = ${targetId}`),
    db.execute(sql`SELECT COUNT(*) as count FROM source_items WHERE workspace_id = ${workspaceId}`),
    db.execute(sql`SELECT COUNT(*) as count FROM automation_job_runs WHERE workspace_id = ${workspaceId}`),
  ]);

  console.log(`  Pipeline Items: ${counts[0].rows[0].count}`);
  console.log(`  WP Pull Jobs: ${counts[1].rows[0].count}`);
  console.log(`  Source Items (RSS cache): ${counts[2].rows[0].count}`);
  console.log(`  Automation Job Runs: ${counts[3].rows[0].count}`);

  // Perform cleanup
  console.log("\n" + "=".repeat(80));
  console.log("\n🗑️  DELETING ALL PIPELINE DATA...\n");

  const results = await Promise.all([
    db.execute(sql`DELETE FROM automation_job_runs WHERE workspace_id = ${workspaceId}`),
    db.execute(sql`DELETE FROM wp_pull_jobs WHERE target_id = ${targetId}`),
    db.execute(sql`DELETE FROM pipeline_items WHERE workspace_id = ${workspaceId}`),
    db.execute(sql`DELETE FROM source_items WHERE workspace_id = ${workspaceId}`),
  ]);

  console.log(`  ✅ Deleted ${results[0].rowCount || 0} automation job runs`);
  console.log(`  ✅ Deleted ${results[1].rowCount || 0} WP pull jobs`);
  console.log(`  ✅ Deleted ${results[2].rowCount || 0} pipeline items`);
  console.log(`  ✅ Deleted ${results[3].rowCount || 0} source items`);

  // Reset topic counters
  await db.execute(
    sql`UPDATE topics 
        SET published_today = 0,
            published_today_reset_at = NOW()
        WHERE workspace_id = ${workspaceId}`
  );
  console.log(`  ✅ Reset topic counters`);

  // Verify cleanup
  console.log("\n" + "=".repeat(80));
  console.log("\n📊 AFTER CLEANUP:\n");

  const afterCounts = await Promise.all([
    db.execute(sql`SELECT COUNT(*) as count FROM pipeline_items WHERE workspace_id = ${workspaceId}`),
    db.execute(sql`SELECT COUNT(*) as count FROM wp_pull_jobs WHERE target_id = ${targetId}`),
    db.execute(sql`SELECT COUNT(*) as count FROM source_items WHERE workspace_id = ${workspaceId}`),
    db.execute(sql`SELECT COUNT(*) as count FROM automation_job_runs WHERE workspace_id = ${workspaceId}`),
  ]);

  console.log(`  Pipeline Items: ${afterCounts[0].rows[0].count} ✅`);
  console.log(`  WP Pull Jobs: ${afterCounts[1].rows[0].count} ✅`);
  console.log(`  Source Items: ${afterCounts[2].rows[0].count} ✅`);
  console.log(`  Automation Job Runs: ${afterCounts[3].rows[0].count} ✅`);

  // Show preserved data
  const topics = await db.execute(
    sql`SELECT name, status, run_interval_minutes, publish_interval_minutes, daily_cap
        FROM topics WHERE workspace_id = ${workspaceId}`
  );

  const sources = await db.execute(
    sql`SELECT COUNT(*) as count FROM sources WHERE workspace_id = ${workspaceId}`
  );

  const targets = await db.execute(
    sql`SELECT name, type FROM publishing_targets WHERE workspace_id = ${workspaceId}`
  );

  console.log("\n✅ PRESERVED CONFIGURATION:\n");
  console.log(`  Sources: ${sources.rows[0].count}`);
  console.log(`  Publishing Targets: ${targets.rows.length}`);
  console.log(`  Topics: ${topics.rows.length}`);

  console.log("\n📋 Active Topics:");
  for (const topic of topics.rows) {
    const emoji = topic.status === "active" ? "🟢" : "⏸️";
    console.log(`  ${emoji} ${topic.name} (${topic.status})`);
    console.log(`     Discovery: Every ${topic.run_interval_minutes} min`);
    console.log(`     Publishing: Every ${topic.publish_interval_minutes} min`);
    console.log(`     Daily Cap: ${topic.daily_cap} articles`);
  }

  console.log("\n" + "=".repeat(80));
  console.log("\n🎉 CLEANUP COMPLETE!\n");
  console.log("📌 CRITICAL NEXT STEP:");
  console.log("   1. Hard refresh browser: Ctrl+Shift+R (clears React Query cache)");
  console.log("   2. Or open Incognito window");
  console.log("   3. UI will now show: 0 Published Today, 0 Generated, 0 Quarantined\n");
  console.log("🚀 System ready for fresh start with WordPress Plugin v0.3.0!\n");
}

completeCleanup().catch(console.error);

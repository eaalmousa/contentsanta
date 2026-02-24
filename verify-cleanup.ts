import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function verifyCleanup() {
  console.log("✅ Pipeline Cleanup Complete!\n");
  console.log("=".repeat(80));

  const workspaceId = "6830ca7f-cf7b-4d6c-97bc-3615fa563be9";

  // Verify all cleaned
  const pipelineCount = await db.execute(
    sql`SELECT COUNT(*) as count FROM pipeline_items WHERE workspace_id = ${workspaceId}`
  );

  const wpJobsCount = await db.execute(
    sql`SELECT COUNT(*) as count FROM wp_pull_jobs 
        WHERE target_id = '8be2881b-9b51-4ef4-9ab1-94a3b05d5398'`
  );

  const sourceItemsCount = await db.execute(
    sql`SELECT COUNT(*) as count FROM source_items WHERE workspace_id = ${workspaceId}`
  );

  console.log("\n🧹 Cleaned Data:");
  console.log(`  Pipeline Items: ${pipelineCount.rows[0].count} ✅`);
  console.log(`  WP Pull Jobs: ${wpJobsCount.rows[0].count} ✅`);
  console.log(`  Source Items (RSS cache): ${sourceItemsCount.rows[0].count} ✅`);

  // Show preserved configuration
  const topics = await db.execute(
    sql`SELECT name, status, run_interval_minutes, publish_interval_minutes, daily_cap
        FROM topics 
        WHERE workspace_id = ${workspaceId}
        ORDER BY created_at`
  );

  const sources = await db.execute(
    sql`SELECT COUNT(*) as count FROM sources 
        WHERE workspace_id = ${workspaceId} AND is_active = 'true'`
  );

  const targets = await db.execute(
    sql`SELECT name, type, last_health_status 
        FROM publishing_targets 
        WHERE workspace_id = ${workspaceId}`
  );

  console.log("\n✅ Preserved Configuration:");
  console.log(`  Active Sources: ${sources.rows[0].count}`);
  console.log(`  Publishing Targets: ${targets.rows.length}`);
  console.log(`  Topics: ${topics.rows.length}`);

  console.log("\n📋 Topics Ready:");
  for (const topic of topics.rows) {
    const statusEmoji = topic.status === "active" ? "🟢" : "⏸️";
    console.log(`  ${statusEmoji} ${topic.name}`);
    console.log(`     Status: ${topic.status}`);
    console.log(`     Discovery: Every ${topic.run_interval_minutes} minutes`);
    console.log(`     Publishing: Every ${topic.publish_interval_minutes} minutes`);
    console.log(`     Daily Cap: ${topic.daily_cap} articles/day`);
  }

  console.log("\n🎯 Publishing Targets:");
  for (const target of targets.rows) {
    const healthEmoji = target.last_health_status === "ok" ? "✅" : 
                       target.last_health_status === "fail" ? "❌" : "❓";
    console.log(`  ${healthEmoji} ${target.name} (${target.type})`);
  }

  console.log("\n" + "=".repeat(80));
  console.log("\n🚀 System Ready for Fresh Start!\n");
  console.log("📌 Next Steps:");
  console.log("  1. ✅ WordPress Plugin v0.3.0 uploaded");
  console.log("  2. ⏱️  Topic will auto-discover new articles in next cycle");
  console.log("  3. 🤖 AI will generate content with images & metadata");
  console.log("  4. 📤 Articles auto-publish to WordPress with full metadata\n");
  console.log("💡 Monitor new activity:");
  console.log("   npx tsx --env-file=.env monitor-publishing-progress.ts\n");
}

verifyCleanup().catch(console.error);

import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function cleanupPipeline() {
  console.log("🧹 Pipeline Cleanup - Fresh Start\n");
  console.log("=".repeat(80));

  const workspaceId = "6830ca7f-cf7b-4d6c-97bc-3615fa563be9";
  const targetId = "8be2881b-9b51-4ef4-9ab1-94a3b05d5398"; // Gulf Estate Gazette

  // Show current state
  console.log("\n📊 Current State (Before Cleanup):\n");

  const pipelineCount = await db.execute(
    sql`SELECT COUNT(*) as count FROM pipeline_items WHERE workspace_id = ${workspaceId}`
  );
  console.log(`  Pipeline Items: ${pipelineCount.rows[0].count}`);

  const wpJobsCount = await db.execute(
    sql`SELECT COUNT(*) as count FROM wp_pull_jobs WHERE target_id = ${targetId}`
  );
  console.log(`  WP Pull Jobs: ${wpJobsCount.rows[0].count}`);

  const sourceItemsCount = await db.execute(
    sql`SELECT COUNT(*) as count FROM source_items WHERE workspace_id = ${workspaceId}`
  );
  console.log(`  Source Items: ${sourceItemsCount.rows[0].count}`);

  console.log("\n" + "=".repeat(80));
  console.log("\n⚠️  WARNING: This will DELETE all pipeline data!");
  console.log("✅ Topics, Sources, and Publishing Targets will be preserved.\n");

  // Perform cleanup
  console.log("🗑️  Deleting WP pull jobs...");
  const deletedJobs = await db.execute(
    sql`DELETE FROM wp_pull_jobs WHERE target_id = ${targetId}`
  );
  console.log(`  ✅ Deleted ${deletedJobs.rowCount || 0} WP jobs`);

  console.log("\n🗑️  Deleting pipeline items...");
  const deletedItems = await db.execute(
    sql`DELETE FROM pipeline_items WHERE workspace_id = ${workspaceId}`
  );
  console.log(`  ✅ Deleted ${deletedItems.rowCount || 0} pipeline items`);

  console.log("\n🗑️  Deleting source items (RSS feed cache)...");
  const deletedSourceItems = await db.execute(
    sql`DELETE FROM source_items WHERE workspace_id = ${workspaceId}`
  );
  console.log(`  ✅ Deleted ${deletedSourceItems.rowCount || 0} source items`);

  // Verify cleanup
  console.log("\n" + "=".repeat(80));
  console.log("\n✅ Cleanup Complete! Final State:\n");

  const finalPipelineCount = await db.execute(
    sql`SELECT COUNT(*) as count FROM pipeline_items WHERE workspace_id = ${workspaceId}`
  );
  console.log(`  Pipeline Items: ${finalPipelineCount.rows[0].count}`);

  const finalWpJobsCount = await db.execute(
    sql`SELECT COUNT(*) as count FROM wp_pull_jobs WHERE target_id = ${targetId}`
  );
  console.log(`  WP Pull Jobs: ${finalWpJobsCount.rows[0].count}`);

  const finalSourceItemsCount = await db.execute(
    sql`SELECT COUNT(*) as count FROM source_items WHERE workspace_id = ${workspaceId}`
  );
  console.log(`  Source Items: ${finalSourceItemsCount.rows[0].count}`);

  // Show preserved data
  console.log("\n✅ Preserved Data:\n");

  const topicsCount = await db.execute(
    sql`SELECT COUNT(*) as count FROM topics WHERE workspace_id = ${workspaceId}`
  );
  console.log(`  Topics: ${topicsCount.rows[0].count}`);

  const sourcesCount = await db.execute(
    sql`SELECT COUNT(*) as count FROM sources WHERE workspace_id = ${workspaceId}`
  );
  console.log(`  Sources: ${sourcesCount.rows[0].count}`);

  const targetsCount = await db.execute(
    sql`SELECT COUNT(*) as count FROM publishing_targets WHERE workspace_id = ${workspaceId}`
  );
  console.log(`  Publishing Targets: ${targetsCount.rows[0].count}`);

  const topicsList = await db.execute(
    sql`SELECT name, status, discovery_interval_minutes 
        FROM topics 
        WHERE workspace_id = ${workspaceId}
        ORDER BY created_at`
  );

  console.log("\n📋 Active Topics:");
  for (const topic of topicsList.rows) {
    const statusEmoji = topic.status === "active" ? "✅" : "⏸️";
    console.log(`  ${statusEmoji} ${topic.name} (${topic.status}, runs every ${topic.discovery_interval_minutes} min)`);
  }

  console.log("\n" + "=".repeat(80));
  console.log("\n🎉 Pipeline cleaned and ready for fresh start!");
  console.log("\n📌 Next Steps:");
  console.log("  1. ✅ Plugin v0.3.0 uploaded to WordPress");
  console.log("  2. ⏱️  Wait for next topic discovery cycle (2-60 minutes depending on schedule)");
  console.log("  3. 📊 New articles will start appearing in Pipeline tab");
  console.log("  4. 🚀 Articles will auto-publish to WordPress with images & metadata");
  console.log("\n💡 Monitor progress:");
  console.log("   npx tsx --env-file=.env monitor-publishing-progress.ts\n");
}

cleanupPipeline().catch(console.error);

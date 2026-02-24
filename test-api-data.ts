import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function testApiData() {
  console.log("🧪 Testing API Endpoint Data\n");
  console.log("=".repeat(80));

  const topicId = "3b028e16-1aed-408b-ad7a-f69e6ab4a541"; // Real Estate

  // Simulate what the /api/topics/:topicId/automation-activity endpoint does
  const jobRuns = await db.execute(
    sql`SELECT * FROM automation_job_runs 
        WHERE topic_id = ${topicId}
        ORDER BY started_at DESC
        LIMIT 100`
  );

  console.log(`\n📊 Automation Job Runs: ${jobRuns.rows.length}`);

  const recentRuns = jobRuns.rows;

  const publishRuns = recentRuns.filter((r: any) => r.job_type === "publish" && r.status === "success");
  console.log(`\n📤 Publish Runs (success): ${publishRuns.length}`);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayPublishRuns = publishRuns.filter((r: any) => r.started_at && new Date(r.started_at) >= today);
  const todayPublished = todayPublishRuns.reduce((sum: number, r: any) => sum + (r.success_count || 0), 0);

  console.log(`\n✅ Today's Publish Runs: ${todayPublishRuns.length}`);
  console.log(`✅ Today's Published Count: ${todayPublished}`);

  const pipelineItems = await db.execute(
    sql`SELECT COUNT(*) as count FROM pipeline_items WHERE topic_id = ${topicId}`
  );

  console.log(`\n📋 Pipeline Items: ${pipelineItems.rows[0].count}`);

  const quarantined = await db.execute(
    sql`SELECT COUNT(*) as count FROM pipeline_items 
        WHERE topic_id = ${topicId} AND status = 'quarantined'`
  );

  console.log(`🚫 Quarantined Items: ${quarantined.rows[0].count}`);

  console.log("\n" + "=".repeat(80));
  console.log("\n✅ Expected API Response:");
  console.log("  {");
  console.log(`    totalGenerated: 0,`);
  console.log(`    totalPublished: 0,`);
  console.log(`    todayPublished: ${todayPublished},  ← Should be 0`);
  console.log(`    currentQuarantined: ${quarantined.rows[0].count},`);
  console.log("  }");

  if (todayPublished === 0 && Number(pipelineItems.rows[0].count) === 0 && Number(quarantined.rows[0].count) === 0) {
    console.log("\n🎉 SUCCESS: All counters are at ZERO!");
    console.log("📌 Frontend will show 0 after hard refresh (Ctrl+Shift+R)\n");
  } else {
    console.log("\n⚠️  WARNING: Some counters are not zero");
    console.log("📌 You may need to clear more data\n");
  }
}

testApiData().catch(console.error);

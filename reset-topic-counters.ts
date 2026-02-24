import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function resetTopicCounters() {
  console.log("🔄 Resetting Topic Counters\n");
  console.log("=".repeat(80));

  const workspaceId = "6830ca7f-cf7b-4d6c-97bc-3615fa563be9";

  // Check current topic counters
  console.log("\n📊 Current Topic State:\n");

  const beforeReset = await db.execute(
    sql`SELECT name, published_today, published_today_reset_at 
        FROM topics 
        WHERE workspace_id = ${workspaceId}`
  );

  for (const topic of beforeReset.rows) {
    console.log(`  Topic: ${topic.name}`);
    console.log(`    Published Today: ${topic.published_today || 0}`);
    console.log(`    Last Reset: ${topic.published_today_reset_at || "(never)"}`);
  }

  // Reset counters
  console.log("\n🔄 Resetting counters to 0...\n");

  const result = await db.execute(
    sql`UPDATE topics 
        SET published_today = 0,
            published_today_reset_at = NOW()
        WHERE workspace_id = ${workspaceId}`
  );

  console.log(`  ✅ Updated ${result.rowCount || 0} topics`);

  // Verify reset
  console.log("\n📊 After Reset:\n");

  const afterReset = await db.execute(
    sql`SELECT name, published_today, published_today_reset_at 
        FROM topics 
        WHERE workspace_id = ${workspaceId}`
  );

  for (const topic of afterReset.rows) {
    console.log(`  Topic: ${topic.name}`);
    console.log(`    Published Today: ${topic.published_today || 0} ✅`);
    console.log(`    Reset At: ${topic.published_today_reset_at}`);
  }

  console.log("\n" + "=".repeat(80));
  console.log("\n✅ Topic counters reset successfully!");
  console.log("\n📌 Next Step: Hard refresh browser (Ctrl+Shift+R) to clear frontend cache\n");
}

resetTopicCounters().catch(console.error);

import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function checkStaleData() {
  console.log("🔍 Investigating Stale UI Data\n");
  console.log("=".repeat(80));

  const workspaceId = "6830ca7f-cf7b-4d6c-97bc-3615fa563be9";
  const topicId = "3b028e16-1aed-408b-ad7a-f69e6ab4a541"; // Real Estate

  // Check actual database counts
  console.log("\n📊 Actual Database State:\n");

  const allItems = await db.execute(
    sql`SELECT COUNT(*) as count FROM pipeline_items 
        WHERE workspace_id = ${workspaceId}`
  );
  console.log(`  Total Pipeline Items: ${allItems.rows[0].count}`);

  const publishedItems = await db.execute(
    sql`SELECT COUNT(*) as count FROM pipeline_items 
        WHERE workspace_id = ${workspaceId} 
          AND status = 'published'`
  );
  console.log(`  Published Items: ${publishedItems.rows[0].count}`);

  const publishedToday = await db.execute(
    sql`SELECT COUNT(*) as count FROM pipeline_items 
        WHERE workspace_id = ${workspaceId}
          AND status = 'published'
          AND DATE(published_at) = CURRENT_DATE`
  );
  console.log(`  Published Today: ${publishedToday.rows[0].count}`);

  const itemsWithPublishedAt = await db.execute(
    sql`SELECT COUNT(*) as count FROM pipeline_items 
        WHERE workspace_id = ${workspaceId}
          AND published_at IS NOT NULL`
  );
  console.log(`  Items with published_at timestamp: ${itemsWithPublishedAt.rows[0].count}`);

  const generatedItems = await db.execute(
    sql`SELECT COUNT(*) as count FROM pipeline_items 
        WHERE workspace_id = ${workspaceId}
          AND status = 'generated'`
  );
  console.log(`  Generated Items: ${generatedItems.rows[0].count}`);

  const scheduledItems = await db.execute(
    sql`SELECT COUNT(*) as count FROM pipeline_items 
        WHERE workspace_id = ${workspaceId}
          AND status = 'scheduled'`
  );
  console.log(`  Scheduled Items: ${scheduledItems.rows[0].count}`);

  // Check topic stats
  console.log("\n📋 Topic Database State:\n");

  const topicStats = await db.execute(
    sql`SELECT id, name, status FROM topics 
        WHERE workspace_id = ${workspaceId}`
  );

  for (const topic of topicStats.rows) {
    console.log(`  Topic: ${topic.name} (${topic.status})`);
  }

  // Check if there are any automation jobs
  const automationJobs = await db.execute(
    sql`SELECT COUNT(*) as count FROM automation_jobs 
        WHERE workspace_id = ${workspaceId}`
  );
  console.log(`\n🤖 Automation Jobs: ${automationJobs.rows[0].count}`);

  console.log("\n" + "=".repeat(80));
  console.log("\n🔍 Diagnosis:\n");
  
  if (allItems.rows[0].count === 0) {
    console.log("  ✅ Database is CLEAN (0 pipeline items)");
    console.log("  ⚠️  UI showing '16 Published Today' is STALE/CACHED data");
    console.log("\n📌 Issue: Frontend query cache or server cache not cleared");
    console.log("\n✅ Solution: Hard refresh browser (Ctrl+Shift+R) or clear React Query cache");
  } else {
    console.log(`  ⚠️  Found ${allItems.rows[0].count} items still in database`);
    console.log("  📌 Cleanup script may not have completed properly");
  }

  console.log("");
}

checkStaleData().catch(console.error);

import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function cleanupJobRuns() {
  console.log("🧹 Cleaning Up Automation Job Runs\n");
  console.log("=".repeat(80));

  const workspaceId = "6830ca7f-cf7b-4d6c-97bc-3615fa563be9";
  const topicId = "3b028e16-1aed-408b-ad7a-f69e6ab4a541"; // Real Estate

  // Check current job runs
  console.log("\n📊 Current Job Runs:\n");

  const beforeCleanup = await db.execute(
    sql`SELECT job_type, status, COUNT(*) as count
        FROM automation_job_runs
        WHERE topic_id = ${topicId}
        GROUP BY job_type, status
        ORDER BY job_type, status`
  );

  let totalBefore = 0;
  for (const row of beforeCleanup.rows) {
    console.log(`  ${row.job_type} (${row.status}): ${row.count}`);
    totalBefore += Number(row.count);
  }

  console.log(`\n  Total Job Runs: ${totalBefore}`);

  // Delete job runs
  console.log("\n🗑️  Deleting all automation job runs...\n");

  const result = await db.execute(
    sql`DELETE FROM automation_job_runs WHERE topic_id = ${topicId}`
  );

  console.log(`  ✅ Deleted ${result.rowCount || 0} job runs`);

  // Also delete for workspace-level
  const workspaceJobs = await db.execute(
    sql`DELETE FROM automation_job_runs WHERE workspace_id = ${workspaceId}`
  );

  console.log(`  ✅ Deleted ${workspaceJobs.rowCount || 0} workspace-level job runs`);

  // Verify cleanup
  console.log("\n📊 After Cleanup:\n");

  const afterCleanup = await db.execute(
    sql`SELECT COUNT(*) as count
        FROM automation_job_runs
        WHERE topic_id = ${topicId} OR workspace_id = ${workspaceId}`
  );

  console.log(`  Remaining Job Runs: ${afterCleanup.rows[0].count} ✅`);

  console.log("\n" + "=".repeat(80));
  console.log("\n✅ Automation job runs cleaned!");
  console.log("\n📌 Next Step: Hard refresh browser (Ctrl+Shift+R) to clear frontend cache\n");
}

cleanupJobRuns().catch(console.error);

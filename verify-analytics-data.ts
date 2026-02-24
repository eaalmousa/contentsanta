import { db } from "./server/db";
import { pipelineItems, topics, automationJobs } from "./shared/schema";
import { eq, and, gte, sql } from "drizzle-orm";

async function main() {
  console.log("🔍 Verifying Analytics Data...\n");

  const workspaceId = "6830ca7f-cf7b-4d6c-97bc-3615fa563be9";

  // 1. Total Pipeline Items
  const allItems = await db
    .select()
    .from(pipelineItems)
    .where(eq(pipelineItems.workspaceId, workspaceId));

  console.log("📊 Total Pipeline Items:", allItems.length);

  // 2. Items by Status
  const byStatus: Record<string, number> = {};
  allItems.forEach((item) => {
    byStatus[item.status] = (byStatus[item.status] || 0) + 1;
  });

  console.log("\n📋 Items by Status:");
  Object.entries(byStatus)
    .sort(([, a], [, b]) => b - a)
    .forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });

  // 3. Published Items
  const published = allItems.filter((i) => i.status === "published");
  console.log("\n✅ Published:", published.length);

  // 4. Quarantined Items
  const quarantined = allItems.filter((i) => i.status === "quarantined");
  console.log("⚠️ Quarantined:", quarantined.length);

  // 5. Items currently in progress (not terminal states)
  const inProgress = allItems.filter((i) =>
    ["fetched", "matched", "ranked", "generated", "gated", "scheduled", "publishing"].includes(
      i.status
    )
  );
  console.log("🔄 Currently in Progress:", inProgress.length);

  // 6. Success Rate
  const completed = allItems.filter((i) =>
    ["published", "skipped", "quarantined"].includes(i.status)
  );
  const successRate =
    completed.length > 0 ? (published.length / completed.length) * 100 : 0;
  console.log("\n📈 Success Rate:", successRate.toFixed(1) + "%");
  console.log(`   (${published.length} published / ${completed.length} completed)`);

  // 7. Active Topics
  const allTopics = await db.select().from(topics).where(eq(topics.workspaceId, workspaceId));
  const activeTopics = allTopics.filter((t) => t.automationEnabled);
  console.log("\n📚 Topics:");
  console.log(`   Total: ${allTopics.length}`);
  console.log(`   Active (automation enabled): ${activeTopics.length}`);

  // 8. Today's Activity
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayItems = allItems.filter((i) => {
    const created = new Date(i.createdAt);
    return created >= today;
  });
  console.log("\n📅 Today's Activity:", todayItems.length, "items processed");

  // 9. Recent Job Runs
  const recentJobs = await db
    .select()
    .from(automationJobs)
    .where(eq(automationJobs.workspaceId, workspaceId))
    .limit(10);

  console.log("\n⚙️ Recent Job Runs:", recentJobs.length);
  if (recentJobs.length > 0) {
    console.log("   Sample:");
    recentJobs.slice(0, 3).forEach((job) => {
      console.log(`   - ${job.jobType}: ${job.status} (${job.startedAt?.toISOString()})`);
    });
  }

  // 10. Processing Time Analysis
  const completedWithTime = allItems.filter((i) => i.createdAt && i.updatedAt);
  if (completedWithTime.length > 0) {
    const times = completedWithTime.map((i) => {
      const start = new Date(i.createdAt).getTime();
      const end = new Date(i.updatedAt).getTime();
      return (end - start) / 1000 / 60; // minutes
    });
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    console.log("\n⏱️ Average Processing Time:", avgTime.toFixed(1), "minutes");
  }

  console.log("\n✅ Analytics Data Verification Complete");
  process.exit(0);
}

main();

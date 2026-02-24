import { db } from "./server/db";
import { pipelineItems, topics, automationJobRuns } from "./shared/schema";
import { eq, desc } from "drizzle-orm";

async function main() {
  console.log("🔍 Testing Analytics Data Retrieval...\n");

  const workspaceId = "6830ca7f-cf7b-4d6c-97bc-3615fa563be9";

  // 1. Get all pipeline items
  const allItems = await db
    .select()
    .from(pipelineItems)
    .where(eq(pipelineItems.workspaceId, workspaceId));

  console.log("📊 Total Pipeline Items:", allItems.length);

  // 2. Status counts
  const statusCounts: Record<string, number> = {};
  for (const item of allItems) {
    statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
  }

  console.log("\n📋 Status Distribution:");
  Object.entries(statusCounts)
    .sort(([, a], [, b]) => b - a)
    .forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });

  // 3. Success rate calculation
  const publishedCount = (statusCounts["published"] || 0) + (statusCounts["verified"] || 0);
  const quarantinedCount = statusCounts["quarantined"] || 0;
  const completedCount = publishedCount + quarantinedCount;
  const successRate = completedCount > 0 ? (publishedCount / completedCount) * 100 : 0;

  console.log("\n✅ Published:", publishedCount);
  console.log("⚠️ Quarantined:", quarantinedCount);
  console.log("📈 Success Rate:", successRate.toFixed(1) + "%");

  // 4. Currently in progress
  const inProgress = allItems.filter((i) =>
    ["fetched", "matched", "ranked", "generated", "gated", "scheduled", "publishing"].includes(
      i.status
    )
  ).length;

  console.log("🔄 Currently in Progress:", inProgress);

  // 5. Topics
  const workspaceTopics = await db
    .select()
    .from(topics)
    .where(eq(topics.workspaceId, workspaceId));

  console.log("\n📚 Topics:", workspaceTopics.length);
  workspaceTopics.forEach((t) => {
    console.log(`  - ${t.name} (automation: ${t.automationEnabled || false})`);
  });

  // 6. Today's activity
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayItems = allItems.filter((i) => {
    const created = new Date(i.createdAt);
    return created >= today;
  });

  console.log("\n📅 Today's Activity:", todayItems.length, "items");

  // 7. Job runs
  const recentJobRuns = await db
    .select()
    .from(automationJobRuns)
    .where(eq(automationJobRuns.workspaceId, workspaceId))
    .orderBy(desc(automationJobRuns.startedAt))
    .limit(10);

  console.log("\n⚙️ Recent Job Runs:", recentJobRuns.length);
  if (recentJobRuns.length > 0) {
    console.log("   Sample:");
    recentJobRuns.slice(0, 3).forEach((job) => {
      console.log(`   - ${job.jobType}: ${job.status} (${job.startedAt?.toISOString()})`);
    });
  }

  // 8. Processing time
  const itemsWithTimes = allItems.filter((i) => i.createdAt && i.publishedAt);
  if (itemsWithTimes.length > 0) {
    const totalMs = itemsWithTimes.reduce((sum, i) => {
      const start = new Date(i.createdAt!).getTime();
      const end = new Date(i.publishedAt!).getTime();
      return sum + (end - start);
    }, 0);
    const avgMinutes = Math.round(totalMs / itemsWithTimes.length / 1000 / 60);
    console.log("\n⏱️ Average Processing Time:", avgMinutes, "minutes");
  } else {
    console.log("\n⏱️ Average Processing Time: N/A (no published items yet)");
  }

  console.log("\n✅ Analytics Data Test Complete");
  console.log("\n📌 Expected Dashboard Values:");
  console.log(`   Total Pipeline Items: ${allItems.length}`);
  console.log(`   Published: ${publishedCount}`);
  console.log(`   Success Rate: ${successRate.toFixed(0)}%`);
  console.log(`   Quarantined: ${quarantinedCount}`);
  console.log(`   Total Job Runs: ${recentJobRuns.length}`);
  console.log(`   Active Topics: ${workspaceTopics.filter((t) => t.automationEnabled).length}`);
  console.log(`   Today's Activity: ${todayItems.length}`);

  process.exit(0);
}

main();

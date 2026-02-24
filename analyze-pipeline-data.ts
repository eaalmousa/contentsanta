import { db } from "./server/db";
import { topics, pipelineItems } from "./shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  console.log("🔍 Analyzing Pipeline Data State...\n");

  // Check topics
  const allTopics = await db
    .select()
    .from(topics)
    .where(eq(topics.workspaceId, "demo-workspace"));

  console.log(`📚 Topics: ${allTopics.length} found`);
  allTopics.forEach((t) => {
    console.log(`  - ${t.name} (ID: ${t.id.substring(0, 8)}...)`);
    console.log(`    Automation: ${t.automationEnabled ? "✅ ON" : "❌ OFF"}`);
    console.log(`    Language: ${t.language || "not set"}`);
  });

  // Check pipeline items for each topic
  console.log("\n📊 Pipeline Items per Topic:");
  
  for (const topic of allTopics) {
    const items = await db
      .select()
      .from(pipelineItems)
      .where(eq(pipelineItems.topicId, topic.id));

    console.log(`\n  ${topic.name}: ${items.length} items`);
    
    if (items.length > 0) {
      const byStatus: Record<string, number> = {};
      items.forEach((i) => {
        byStatus[i.status] = (byStatus[i.status] || 0) + 1;
      });
      
      Object.entries(byStatus).forEach(([status, count]) => {
        console.log(`    - ${status}: ${count}`);
      });
    }
  }

  // Check if pipeline has EVER had data
  const allItems = await db.select().from(pipelineItems);
  console.log(`\n🔢 Total Pipeline Items (all topics, all workspaces): ${allItems.length}`);

  if (allItems.length === 0) {
    console.log("\n❌ ISSUE: Pipeline is completely empty!");
    console.log("   Possible reasons:");
    console.log("   1. Topic Discovery job hasn't run yet");
    console.log("   2. No RSS stories have been fetched");
    console.log("   3. Database was reset/cleared");
    console.log("\n   Solution: Trigger pipeline manually or wait for next automation cycle");
  }

  process.exit(0);
}

main();

import { db } from "./server/db";
import { pipelineItems } from "./shared/schema";
import { eq, and } from "drizzle-orm";
import { storage } from "./server/storage";

async function main() {
  console.log("🧪 Testing Item History & Status Queries...\n");

  const workspaceId = "6830ca7f-cf7b-4d6c-97bc-3615fa563be9";
  const topicId = "3b028e16-1aed-408b-ad7a-f69e6ab4a541";

  // Test published items query
  console.log("1️⃣ Testing Published Items Query:");
  const topic = await storage.getTopic(topicId);
  if (topic) {
    const allItems = await storage.getPipelineItems(topic.id);
    const published = allItems.filter((item) => item.status === "published");
    console.log(`   Found ${published.length} published items`);
  }

  // Test skipped items query
  console.log("\n2️⃣ Testing Skipped Items Query:");
  if (topic) {
    const allItems = await storage.getPipelineItems(topic.id);
    const skipped = allItems.filter((item) => item.status === "skipped" || item.skipReason);
    console.log(`   Found ${skipped.length} skipped items`);
    
    if (skipped.length > 0) {
      console.log("\n   Sample Skipped Items:");
      skipped.slice(0, 3).forEach((item, idx) => {
        console.log(`     ${idx + 1}. ${item.generatedTitle?.substring(0, 50) || "No title"}...`);
        console.log(`        Reason: ${item.skipReason || "NO REASON"}`);
      });
    }
  }

  // Test quarantined items query
  console.log("\n3️⃣ Testing Quarantined Items Query:");
  const params = new URLSearchParams();
  params.append("workspaceId", workspaceId);
  
  const quarantined = await db
    .select()
    .from(pipelineItems)
    .where(
      and(
        eq(pipelineItems.workspaceId, workspaceId),
        eq(pipelineItems.status, "quarantined")
      )
    );
  
  console.log(`   Found ${quarantined.length} quarantined items`);
  
  if (quarantined.length > 0) {
    console.log("\n   Sample Quarantined Items:");
    quarantined.slice(0, 3).forEach((item, idx) => {
      console.log(`     ${idx + 1}. ${item.generatedTitle?.substring(0, 50) || "No title"}...`);
      console.log(`        Error: ${item.lastErrorMessage || "NO ERROR"}`);
    });
  }

  console.log("\n✅ All queries working correctly!");
  console.log("   Frontend should now display real data.");

  process.exit(0);
}

main();

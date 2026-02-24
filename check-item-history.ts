import { db } from "./server/db";
import { pipelineItems } from "./shared/schema";
import { eq, and, isNotNull } from "drizzle-orm";

async function main() {
  console.log("🔍 Checking Item History & Status Data...\n");

  const workspaceId = "demo-workspace";

  // Check skipped items
  const skippedItems = await db
    .select()
    .from(pipelineItems)
    .where(and(
      eq(pipelineItems.workspaceId, workspaceId),
      eq(pipelineItems.status, "skipped")
    ))
    .limit(5);

  console.log(`📋 Skipped Items: ${skippedItems.length} found`);
  skippedItems.forEach((item, idx) => {
    console.log(`  ${idx + 1}. ID: ${item.id.substring(0, 8)}...`);
    console.log(`     Reason: ${item.skipReason || "NO REASON SET"}`);
    console.log(`     Updated: ${item.updatedAt}\n`);
  });

  // Check published items
  const publishedItems = await db
    .select()
    .from(pipelineItems)
    .where(and(
      eq(pipelineItems.workspaceId, workspaceId),
      eq(pipelineItems.status, "published")
    ))
    .limit(5);

  console.log(`\n✅ Published Items: ${publishedItems.length} found`);
  publishedItems.forEach((item, idx) => {
    console.log(`  ${idx + 1}. ID: ${item.id.substring(0, 8)}...`);
    console.log(`     Status: ${item.status}`);
    console.log(`     Published: ${item.publishedAt || "N/A"}\n`);
  });

  // Check quarantined items
  const quarantinedItems = await db
    .select()
    .from(pipelineItems)
    .where(and(
      eq(pipelineItems.workspaceId, workspaceId),
      eq(pipelineItems.status, "quarantined")
    ))
    .limit(5);

  console.log(`\n⚠️ Quarantined Items: ${quarantinedItems.length} found`);
  quarantinedItems.forEach((item, idx) => {
    console.log(`  ${idx + 1}. ID: ${item.id.substring(0, 8)}...`);
    console.log(`     Error: ${item.lastErrorMessage || "NO ERROR MESSAGE"}\n`);
  });

  // Total count by status
  console.log("\n📊 Status Summary:");
  const allStatuses = ["skipped", "published", "quarantined", "scheduled", "generated", "matched", "ranked"];
  
  for (const status of allStatuses) {
    const count = await db
      .select()
      .from(pipelineItems)
      .where(and(
        eq(pipelineItems.workspaceId, workspaceId),
        eq(pipelineItems.status, status)
      ));
    
    if (count.length > 0) {
      console.log(`  ${status}: ${count.length}`);
    }
  }

  await db.$client.end();
}

main();

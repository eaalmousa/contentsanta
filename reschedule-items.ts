import { db } from "./server/db";
import { pipelineItems } from "./shared/schema";
import { eq, and, or, isNull } from "drizzle-orm";

async function rescheduleAllQuarantinedItems() {
  console.log("🔧 Rescheduling ALL quarantined items in Real Estate topic...\n");

  const workspaceId = "6830ca7f-cf7b-4d6c-97bc-3615fa563be9";
  const topicId = "3b028e16-1aed-408b-ad7a-f69e6ab4a541"; // Real Estate
  const targetId = "8be2881b-9b51-4ef4-9ab1-94a3b05d5398"; // Gulf Estate Gazette

  // Find ALL quarantined items (regardless of reason)
  const items = await db
    .select()
    .from(pipelineItems)
    .where(
      and(
        eq(pipelineItems.workspaceId, workspaceId),
        eq(pipelineItems.topicId, topicId),
        eq(pipelineItems.status, "quarantined")
      )
    )
    .limit(100);

  console.log(`Found ${items.length} quarantined items\n`);

  if (items.length === 0) {
    console.log("✅ No quarantined items found");
    return;
  }

  // Show first few
  console.log("Sample items:");
  for (const item of items.slice(0, 5)) {
    console.log(`  ${item.generatedTitle || "(no title)"}`);
    console.log(`    Status: ${item.status}`);
    console.log(`    Quarantine Reason: ${item.quarantineReason || "(none)"}`);
    console.log(`    Last Error: ${item.lastErrorMessage || "(none)"}`);
    console.log("");
  }

  // Update all to scheduled
  const result = await db
    .update(pipelineItems)
    .set({
      status: "scheduled",
      quarantineReason: null,
      lastErrorMessage: null,
      lastErrorCode: null,
      retryCount: 0,
      publishAttempts: 0,
      scheduledFor: new Date(), // Schedule immediately
    })
    .where(
      and(
        eq(pipelineItems.workspaceId, workspaceId),
        eq(pipelineItems.topicId, topicId),
        eq(pipelineItems.status, "quarantined")
      )
    );

  console.log(`✅ Rescheduled ${items.length} items`);
  console.log(`\nThey will be published in the next automation cycle (within 2-10 minutes)`);
  console.log(`\nNote: The server is already running, so automation will pick these up automatically.`);
}

rescheduleAllQuarantinedItems().catch(console.error);

import { db } from "./server/db";
import { pipelineItems } from "./shared/schema";
import { eq, and } from "drizzle-orm";

async function releaseQuarantinedItems() {
  console.log("🔓 Releasing quarantined items with policy_block reason...\n");

  const workspaceId = "6830ca7f-cf7b-4d6c-97bc-3615fa563be9";
  const targetId = "8be2881b-9b51-4ef4-9ab1-94a3b05d5398";

  // Find items quarantined due to missing default_category_id
  const items = await db
    .select()
    .from(pipelineItems)
    .where(
      and(
        eq(pipelineItems.workspaceId, workspaceId),
        eq(pipelineItems.targetId, targetId),
        eq(pipelineItems.status, "quarantined"),
        eq(pipelineItems.quarantineReason, "policy_block")
      )
    )
    .limit(100);

  console.log(`Found ${items.length} quarantined items with policy_block reason\n`);

  if (items.length === 0) {
    console.log("✅ No items to release");
    return;
  }

  // Show first few items
  console.log("Sample items:");
  for (const item of items.slice(0, 5)) {
    console.log(`  ${item.id}: ${item.generatedTitle || "(no title)"}`);
    console.log(`    Status: ${item.status}`);
    console.log(`    Reason: ${item.quarantineReason}`);
    console.log(`    Error: ${item.lastErrorMessage}`);
    console.log("");
  }

  // Update all to scheduled status so they'll be retried
  const result = await db
    .update(pipelineItems)
    .set({
      status: "scheduled",
      quarantineReason: null,
      lastErrorMessage: null,
      retryCount: 0,
      publishAttempts: 0,
    })
    .where(
      and(
        eq(pipelineItems.workspaceId, workspaceId),
        eq(pipelineItems.targetId, targetId),
        eq(pipelineItems.status, "quarantined"),
        eq(pipelineItems.quarantineReason, "policy_block")
      )
    );

  console.log(`✅ Released ${items.length} items - status changed to "scheduled"`);
  console.log(`✅ They will be retried in the next publishing cycle`);
  console.log(`\n⚠️ Make sure your topic is set to "active" status for publishing to proceed`);
}

releaseQuarantinedItems().catch(console.error);

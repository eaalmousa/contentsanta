import { db } from "./server/db";
import { pipelineItems } from "./shared/schema";
import { eq, and } from "drizzle-orm";

async function releaseImageQuarantinedItem() {
  console.log("🔓 Releasing item quarantined due to missing_featured_image...\n");

  const workspaceId = "6830ca7f-cf7b-4d6c-97bc-3615fa563be9";
  const topicId = "3b028e16-1aed-408b-ad7a-f69e6ab4a541"; // Real Estate

  // Find items quarantined for missing_featured_image
  const items = await db
    .select()
    .from(pipelineItems)
    .where(
      and(
        eq(pipelineItems.workspaceId, workspaceId),
        eq(pipelineItems.topicId, topicId),
        eq(pipelineItems.status, "quarantined"),
        eq(pipelineItems.quarantineReason, "missing_featured_image")
      )
    )
    .limit(50);

  console.log(`Found ${items.length} items quarantined for missing featured image\n`);

  if (items.length === 0) {
    console.log("✅ No items to release");
    return;
  }

  // Show items
  for (const item of items) {
    console.log(`  ${item.generatedTitle || "(no title)"}`);
    console.log(`    Status: ${item.status}`);
    console.log(`    Reason: ${item.quarantineReason}`);
    console.log(`    Error: ${item.lastErrorMessage}`);
    console.log("");
  }

  // Update to scheduled status - AI image generation will be attempted
  await db
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
        eq(pipelineItems.status, "quarantined"),
        eq(pipelineItems.quarantineReason, "missing_featured_image")
      )
    );

  console.log(`✅ Released ${items.length} items - status changed to "scheduled"`);
  console.log(`✅ Server will now attempt:`);
  console.log(`   1. Extract image from source article`);
  console.log(`   2. If no source image, generate AI image with DALL-E 3`);
  console.log(`   3. Only quarantine if BOTH fail`);
  console.log(`\nPublishing will happen within the next 2-10 minutes`);
}

releaseImageQuarantinedItem().catch(console.error);

import "dotenv/config";
import { db } from "./server/db";
import { pipelineItems } from "./shared/schema";
import { eq } from "drizzle-orm";

async function inspectScheduledItem() {
  const itemId = "f94b59a7-d83d-4002-bfc4-fc96330fd6c9";
  
  const [item] = await db
    .select()
    .from(pipelineItems)
    .where(eq(pipelineItems.id, itemId));

  if (!item) {
    console.log("❌ Item not found");
    process.exit(1);
  }

  console.log("\n📦 Scheduled Pipeline Item:\n");
  console.log(`ID: ${item.id}`);
  console.log(`Title: ${item.generatedTitle}`);
  console.log(`Status: ${item.status}`);
  console.log(`Scheduled At: ${item.scheduledAt}`);
  console.log(`Target ID: ${item.targetId}`);
  console.log(`Story Hash: ${item.storyHash}`);
  console.log(`Canonical URL: ${item.canonicalSourceUrl}`);
  console.log(`Featured Image: ${item.featuredImageUrl || "NULL"}`);
  console.log(`Featured Image Media ID: ${item.featuredImageMediaId || "NULL"}`);
  console.log(`Quarantine Reason: ${item.quarantineReason || "none"}`);
  console.log(`Last Error: ${item.lastErrorMessage || "none"}`);

  process.exit(0);
}

inspectScheduledItem();

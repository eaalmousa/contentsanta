import { db } from "./server/db";
import { pipelineItems } from "./shared/schema";
import { eq } from "drizzle-orm";

async function checkItemStatus() {
  const itemId = "50b930c1-4d42-4fc3-b134-2d989f0a47c1"; // From your error log
  
  const [item] = await db
    .select()
    .from(pipelineItems)
    .where(eq(pipelineItems.id, itemId))
    .limit(1);

  if (!item) {
    console.log("❌ Item not found");
    return;
  }

  console.log("Item Details:");
  console.log(`  ID: ${item.id}`);
  console.log(`  Title: ${item.generatedTitle || "(no title)"}`);
  console.log(`  Status: ${item.status}`);
  console.log(`  Quarantine Reason: ${item.quarantineReason}`);
  console.log(`  Last Error: ${item.lastErrorMessage}`);
  console.log(`  Target ID: ${item.targetId}`);
  console.log(`  Topic ID: ${item.topicId}`);
  console.log(`  Scheduled For: ${item.scheduledFor}`);
  console.log(`  Publish Attempts: ${item.publishAttempts}`);
  console.log(`  Retry Count: ${item.retryCount}`);
}

checkItemStatus().catch(console.error);

import { db } from "./server/db";
import { topics } from "./shared/schema";
import { eq } from "drizzle-orm";

async function activateRealEstateTopic() {
  console.log("🚀 Activating 'Real Estate' topic...\n");

  const topicId = "3b028e16-1aed-408b-ad7a-f69e6ab4a541";

  // Get current topic
  const [topic] = await db
    .select()
    .from(topics)
    .where(eq(topics.id, topicId))
    .limit(1);

  if (!topic) {
    console.error("❌ Topic not found");
    return;
  }

  console.log(`Topic: ${topic.name}`);
  console.log(`Current status: ${topic.status}`);
  console.log(`Automation mode: ${topic.automationMode}`);
  console.log(`Publishing target: ${topic.publishingTargetId}`);

  // Update to active
  await db
    .update(topics)
    .set({
      status: "active",
    })
    .where(eq(topics.id, topicId));

  console.log(`\n✅ Topic activated!`);
  console.log(`\nThe pipeline automation will now:`);
  console.log(`  1. Run topic discovery every ${topic.runIntervalMinutes || 5} minutes`);
  console.log(`  2. Generate content for fetched items`);
  console.log(`  3. Publish to WordPress every ${topic.publishIntervalMinutes || 2} minutes`);
  console.log(`\n⚠️ Make sure the server is running to process the pipeline`);
}

activateRealEstateTopic().catch(console.error);

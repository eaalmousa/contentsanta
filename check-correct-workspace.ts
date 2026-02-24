import { db } from "./server/db";
import { pipelineItems } from "./shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  const workspaceId = "6830ca7f-cf7b-4d6c-97bc-3615fa563be9";
  const topicId = "3b028e16-1aed-408b-ad7a-f69e6ab4a541";

  console.log("📊 Item History & Status for Real Estate Topic\n");

  // Check skipped items
  const skipped = await db
    .select()
    .from(pipelineItems)
    .where(eq(pipelineItems.workspaceId, workspaceId))
    .limit(100);

  const skippedFiltered = skipped.filter((i) => i.status === "skipped" || i.skipReason);
  const published = skipped.filter((i) => i.status === "published");
  const quarantined = skipped.filter((i) => i.status === "quarantined");

  console.log(`✅ Published: ${published.length}`);
  console.log(`⏭️  Skipped: ${skippedFiltered.length}`);
  console.log(`⚠️  Quarantined: ${quarantined.length}\n`);

  console.log("Sample Skipped Items:");
  skippedFiltered.slice(0, 5).forEach((i, idx) => {
    console.log(`  ${idx + 1}. Status: ${i.status}`);
    console.log(`     Reason: ${i.skipReason || "NO REASON"}`);
  });

  console.log("\nSample Quarantined Items:");
  quarantined.slice(0, 3).forEach((i, idx) => {
    console.log(`  ${idx + 1}. Status: ${i.status}`);
    console.log(`     Error: ${i.lastErrorMessage || "NO ERROR"}`);
  });

  process.exit(0);
}

main();

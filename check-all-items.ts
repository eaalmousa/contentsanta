import { db } from "./server/db";
import { pipelineItems } from "./shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  const all = await db
    .select()
    .from(pipelineItems)
    .where(eq(pipelineItems.workspaceId, "demo-workspace"));

  console.log("Total pipeline items:", all.length);

  const byStatus: Record<string, number> = {};
  all.forEach((i) => {
    byStatus[i.status] = (byStatus[i.status] || 0) + 1;
  });

  console.log("\nBy status:");
  Object.entries(byStatus).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });

  console.log("\n✅ Done");
  process.exit(0);
}

main();

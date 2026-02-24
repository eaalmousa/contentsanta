import { db } from "./server/db";
import { topics, pipelineItems } from "./shared/schema";

async function main() {
  // Check all topics
  const allTopics = await db.select().from(topics);
  console.log("All Topics:", allTopics.length);
  
  allTopics.forEach((t) => {
    console.log(`  - ${t.name}`);
    console.log(`    Workspace: ${t.workspaceId}`);
    console.log(`    ID: ${t.id}`);
  });

  // Check sample items
  const items = await db.select().from(pipelineItems).limit(5);
  console.log("\nSample Pipeline Items:", items.length);
  
  items.forEach((i) => {
    console.log(`  - Topic: ${i.topicId.substring(0, 8)}...`);
    console.log(`    Status: ${i.status}`);
    console.log(`    Workspace: ${i.workspaceId}`);
  });

  process.exit(0);
}

main();

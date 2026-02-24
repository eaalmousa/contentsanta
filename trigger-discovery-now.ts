import { storage } from "./server/storage";
import { runTopicDiscoveryJob } from "./server/services/topic-discovery-job-service";

async function triggerDiscovery() {
  console.log("=== TRIGGERING TOPIC DISCOVERY ===\n");

  // Get workspace
  const workspaces = await storage.getAllWorkspaces();
  if (!workspaces || workspaces.length === 0) {
    console.error("❌ No workspaces found");
    process.exit(1);
  }
  const workspace = workspaces[0];
  console.log(`✅ Using workspace: ${workspace.name}`);

  // Get active topics
  const topics = await storage.getTopicsByWorkspace(workspace.id);
  const activeTopics = topics.filter((t: any) => t.status === 'active');
  
  if (activeTopics.length === 0) {
    console.error("❌ No active topics found");
    process.exit(1);
  }

  console.log(`\n📋 Found ${activeTopics.length} active topic(s):`);
  for (const topic of activeTopics) {
    console.log(`  - ${topic.name}`);
  }

  // Trigger discovery for first active topic
  const topic = activeTopics[0];
  console.log(`\n🚀 Triggering discovery for: ${topic.name}`);
  console.log(`   Topic ID: ${topic.id}`);
  console.log(`   Query: ${topic.query}`);
  console.log(`   Language: ${topic.language || "en"}`);

  try {
    const result = await runTopicDiscoveryJob(topic.id);
    console.log("\n✅ Discovery job completed!");
    console.log(`   Result:`, JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.error("\n❌ Discovery failed:", error.message);
    throw error;
  }

  console.log("\n=== DONE ===");
  process.exit(0);
}

triggerDiscovery().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

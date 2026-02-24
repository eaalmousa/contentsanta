import "dotenv/config";
import { db } from "./server/db";
import { workspaces } from "./shared/schema";
import { eq } from "drizzle-orm";

async function testTopicCreation() {
  console.log("\n🧪 Testing topic creation prerequisites...\n");

  // Get dev workspace
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.name, "dev's Workspace"));

  if (!workspace) {
    console.log("❌ Workspace 'dev's Workspace' not found");
    process.exit(1);
  }

  console.log(`Workspace: ${workspace.name}`);
  console.log(`  ID: ${workspace.id}`);
  console.log(`  Active Site ID: ${workspace.activeSiteId || "NULL"}`);

  if (!workspace.activeSiteId) {
    console.log("\n❌ No active site ID set - this will cause 400 error");
    console.log("   Topic creation requires an active site");
    process.exit(1);
  }

  console.log("\n✅ Prerequisites met:");
  console.log("   - Workspace exists");
  console.log("   - Active site is set");
  console.log("\nTopic creation should work. If it's failing, check:");
  console.log("   1. Browser console for actual error message");
  console.log("   2. Network tab for the exact 400 response body");
  console.log("   3. Server logs for validation errors");

  process.exit(0);
}

testTopicCreation();

import { storage } from "./server/storage";

async function main() {
  console.log("🔍 Testing /api/me/context Response...\n");

  const userId = "dev-user-123";

  // Simulate what the endpoint does
  const memberships = await storage.getUserWorkspaceMemberships(userId);
  console.log("Memberships:", memberships.length);
  
  memberships.forEach((m: any) => {
    console.log(`  - Workspace: ${m.workspaceId}`);
    console.log(`    Name: ${m.name}`);
    console.log(`    Role: ${m.role}`);
  });

  const activeWorkspaceId = memberships[0]?.workspaceId;
  console.log(`\n✅ Active Workspace ID: ${activeWorkspaceId}`);

  if (activeWorkspaceId) {
    const topics = await storage.getTopics(activeWorkspaceId);
    console.log(`\n📚 Topics in active workspace: ${topics.length}`);
    topics.forEach((t: any) => {
      console.log(`  - ${t.name} (automation: ${t.automationEnabled})`);
    });
  }

  process.exit(0);
}

main();

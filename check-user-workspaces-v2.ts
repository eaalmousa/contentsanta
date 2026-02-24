import { db } from "./server/db";
import { workspaces, workspaceUsers, users } from "./shared/schema";
import { eq } from "drizzle-orm";

async function main() {
  console.log("🔍 Checking User & Workspace State...\n");

  // Check users
  const allUsers = await db.select().from(users);
  console.log(`👥 Users: ${allUsers.length}`);
  allUsers.forEach((u) => {
    console.log(`  - ${u.email || u.username} (ID: ${u.id})`);
  });

  // Check workspaces
  const allWorkspaces = await db.select().from(workspaces);
  console.log(`\n🏢 Workspaces: ${allWorkspaces.length}`);
  allWorkspaces.forEach((w) => {
    console.log(`  - ${w.name} (ID: ${w.id})`);
  });

  // Check workspace_users
  const allWorkspaceUsers = await db.select().from(workspaceUsers);
  console.log(`\n🔗 Workspace Users: ${allWorkspaceUsers.length}`);
  allWorkspaceUsers.forEach((m) => {
    console.log(`  - User ${m.userId} → Workspace ${m.workspaceId}`);
    console.log(`    Role: ${m.role}`);
  });

  // Check dev-user-123 specifically
  console.log("\n🔎 Dev User Check:");
  const devMemberships = await db
    .select()
    .from(workspaceUsers)
    .where(eq(workspaceUsers.userId, "dev-user-123"));

  if (devMemberships.length === 0) {
    console.log("  ❌ dev-user-123 has NO workspace memberships!");
    console.log("     This is why context returns demo-workspace (fallback)");
    
    // Check if there's a workspace that matches the topic
    console.log("\n  💡 Solution: Create membership for dev-user-123");
    console.log("     Target workspace: 6830ca7f-cf7b-4d6c-97bc-3615fa563be9");
  } else {
    console.log(`  ✅ dev-user-123 has ${devMemberships.length} memberships:`);
    devMemberships.forEach((m) => {
      console.log(`     - Workspace: ${m.workspaceId}`);
      console.log(`       Role: ${m.role}`);
    });
  }

  process.exit(0);
}

main();

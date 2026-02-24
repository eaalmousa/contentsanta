import { db } from "./server/db";
import { workspaces, workspaceMemberships, users } from "./shared/schema";
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

  // Check memberships
  const allMemberships = await db.select().from(workspaceMemberships);
  console.log(`\n🔗 Memberships: ${allMemberships.length}`);
  allMemberships.forEach((m) => {
    console.log(`  - User ${m.userId} → Workspace ${m.workspaceId}`);
    console.log(`    Role: ${m.role}`);
  });

  // Check dev-user-123 specifically
  console.log("\n🔎 Dev User Check:");
  const devMemberships = await db
    .select()
    .from(workspaceMemberships)
    .where(eq(workspaceMemberships.userId, "dev-user-123"));

  if (devMemberships.length === 0) {
    console.log("  ❌ dev-user-123 has NO workspace memberships!");
    console.log("     This is why the frontend shows 'demo-workspace' (fallback)");
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

import { db } from './server/db';
import { workspaceUsers, workspaces } from './shared/schema';
import { eq } from 'drizzle-orm';

async function testContextEndpoint() {
  console.log("Testing /api/me/context logic...\n");
  
  const userId = '320d64eb-7ad3-4e35-929f-ceb0938f431e'; // Admin user
  
  try {
    // 1. Get memberships (same query as storage.getUserWorkspaceMemberships)
    console.log("1. Testing getUserWorkspaceMemberships query:");
    const result = await db
      .select({
        workspaceId: workspaceUsers.workspaceId,
        workspaceName: workspaces.name,
        role: workspaceUsers.role,
      })
      .from(workspaceUsers)
      .innerJoin(workspaces, eq(workspaceUsers.workspaceId, workspaces.id))
      .where(eq(workspaceUsers.userId, userId));
    
    console.log(`   ✅ Found ${result.length} workspace(s)`);
    result.forEach((m, idx) => {
      console.log(`   ${idx + 1}. ${m.workspaceName} (${m.workspaceId}) - Role: ${m.role}`);
    });
    
    if (result.length === 0) {
      console.log("\n❌ PROBLEM: User has no workspace memberships!");
      console.log("   This will cause /api/me/context to fail.");
      console.log("\n   FIX: Need to create workspace membership for admin user");
      return;
    }
    
    console.log("\n✅ Context endpoint should work!");
    
  } catch (error: any) {
    console.error("\n❌ ERROR:", error.message);
    console.error("Stack:", error.stack);
  }
}

testContextEndpoint().then(() => process.exit(0));

import { db } from './server/db';
import { createUser } from './server/services/auth-service';
import { publishingTargets, topics, workspaces } from './shared/schema';
import { eq, like } from 'drizzle-orm';

async function createAccessAccount() {
  console.log("═══════════════════════════════════════════════");
  console.log("CREATING ACCESS ACCOUNT:");
  console.log("═══════════════════════════════════════════════\n");
  
  const email = "admin@contentsanta.local";
  const password = "contentsanta123";
  const firstName = "Admin";
  const lastName = "User";
  
  try {
    // Create user account
    console.log("Creating user account...");
    const user = await createUser({
      email,
      password,
      firstName,
      lastName
    });
    console.log(`✅ User created: ${user.email}`);
    console.log(`   User ID: ${user.id}`);
    
    // Get user's workspace (should be auto-created)
    const userWorkspaces = await db.select().from(workspaces).where(eq(workspaces.ownerId, user.id));
    
    if (userWorkspaces.length === 0) {
      console.log("❌ No workspace found for user");
      return;
    }
    
    const workspace = userWorkspaces[0];
    console.log(`✅ Workspace ready: ${workspace.name}`);
    console.log(`   Workspace ID: ${workspace.id}`);
    
    // Get Gulf Estate Gazette target
    const targets = await db.select().from(publishingTargets)
      .where(like(publishingTargets.name, '%Gulf%'))
      .limit(1);
    
    if (targets.length > 0) {
      const target = targets[0];
      const oldWorkspaceId = target.workspaceId;
      
      console.log(`\nFound Gulf Estate Gazette in workspace: ${oldWorkspaceId}`);
      
      if (oldWorkspaceId !== workspace.id) {
        console.log("Moving Gulf Estate Gazette to your new workspace...");
        await db.update(publishingTargets)
          .set({ workspaceId: workspace.id })
          .where(eq(publishingTargets.workspaceId, oldWorkspaceId));
        
        // Also move topics
        await db.update(topics)
          .set({ workspaceId: workspace.id })
          .where(eq(topics.workspaceId, oldWorkspaceId));
        
        console.log("✅ Gulf Estate Gazette moved successfully!");
      }
    }
    
    console.log("\n═══════════════════════════════════════════════");
    console.log("LOGIN CREDENTIALS:");
    console.log("═══════════════════════════════════════════════");
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log("\nGo to: http://localhost:5000/login");
    console.log("═══════════════════════════════════════════════");
    
  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      console.log("\n✅ Account already exists! Use these credentials:");
      console.log(`   Email: ${email}`);
      console.log(`   Password: ${password}`);
    } else {
      throw error;
    }
  }
}

createAccessAccount().then(() => process.exit(0)).catch(console.error);

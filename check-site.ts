import "dotenv/config";
import { db } from "./server/db";
import { workspaces, sites } from "./shared/schema";
import { eq, sql } from "drizzle-orm";

async function checkAndFixSite() {
  console.log("\n🔍 Checking sites and workspace configuration...\n");

  // Get all workspaces
  const allWorkspaces = await db.select().from(workspaces);
  
  for (const workspace of allWorkspaces) {
    console.log(`Workspace: ${workspace.name} (${workspace.id.substring(0, 8)}...)`);
    console.log(`  Active Site ID: ${workspace.activeSiteId || "NULL"}`);
    
    // Get sites for this workspace
    const workspaceSites = await db
      .select()
      .from(sites)
      .where(eq(sites.workspaceId, workspace.id));
    
    console.log(`  Sites: ${workspaceSites.length}`);
    
    if (workspaceSites.length > 0) {
      for (const site of workspaceSites) {
        console.log(`    - ${site.name} (${site.id.substring(0, 8)}...) Status: ${site.connectionStatus}`);
      }
      
      // If no active site set, set the first site as active
      if (!workspace.activeSiteId) {
        const firstSite = workspaceSites[0];
        console.log(`\n  ⚠️  No active site set. Setting ${firstSite.name} as active...`);
        
        await db
          .update(workspaces)
          .set({ activeSiteId: firstSite.id })
          .where(eq(workspaces.id, workspace.id));
        
        console.log(`  ✅ Set ${firstSite.name} as active site`);
      } else {
        console.log(`  ✅ Active site already set`);
      }
    } else {
      console.log(`  ⚠️  No sites found. User needs to create a site first.`);
    }
    
    console.log("");
  }

  console.log("=".repeat(60));
  console.log("✅ Check complete");
  console.log("=".repeat(60));

  process.exit(0);
}

checkAndFixSite();

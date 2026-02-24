/**
 * Check database connection and content
 */

import { storage } from "./server/storage";

async function checkDatabase() {
  console.log("\n=== Database Connection Check ===\n");
  
  try {
    // Get workspace count
    const workspaces = await storage.getWorkspaces();
    console.log(`Workspaces: ${workspaces.length}`);
    
    if (workspaces.length > 0) {
      const ws = workspaces[0];
      console.log(`  First workspace: ${ws.name} (${ws.id})`);
      
      // Get topics for this workspace
      const topics = await storage.getTopicsByWorkspace(ws.id);
      console.log(`  Topics in workspace: ${topics.length}`);
      
      if (topics.length > 0) {
        topics.slice(0, 3).forEach(t => {
          console.log(`    - ${t.name} (status: ${t.status}, isLive: ${t.isLive})`);
        });
      }
      
      // Get sources
      const sources = await storage.getSourcesByWorkspace(ws.id);
      console.log(`  Sources in workspace: ${sources.length}`);
    }
    
    console.log("\n✅ Database connection working\n");
  } catch (error: any) {
    console.error("\n❌ Database error:", error.message, "\n");
  }
  
  process.exit(0);
}

checkDatabase();

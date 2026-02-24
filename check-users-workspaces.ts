import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function checkWorkspaces() {
  console.log("═══════════════════════════════════════════════");
  console.log("EXISTING USERS & WORKSPACES:");
  console.log("═══════════════════════════════════════════════\n");
  
  // Get all users
  const usersResult = await db.execute(sql`
    SELECT id, email, first_name, last_name, created_at 
    FROM users 
    ORDER BY created_at DESC
  `);
  
  console.log(`Found ${usersResult.rows.length} users:\n`);
  
  for (const user of usersResult.rows as any[]) {
    console.log(`User: ${user.email || '(no email)'}`);
    console.log(`  ID: ${user.id}`);
    console.log(`  Name: ${user.first_name || ''} ${user.last_name || ''}`);
    console.log(`  Created: ${user.created_at}`);
    
    // Get workspaces for this user
    const workspacesResult = await db.execute(sql`
      SELECT w.id, w.name, w.slug, wm.role
      FROM workspaces w
      JOIN workspace_members wm ON w.id = wm.workspace_id
      WHERE wm.user_id = ${user.id}
    `);
    
    if (workspacesResult.rows.length > 0) {
      console.log(`  Workspaces:`);
      for (const ws of workspacesResult.rows as any[]) {
        console.log(`    - ${ws.name} (${ws.slug}) - Role: ${ws.role}`);
      }
    } else {
      console.log(`  Workspaces: None`);
    }
    console.log('');
  }
  
  // Get all publishing targets
  const targetsResult = await db.execute(sql`
    SELECT id, name, workspace_id, type, site_id, base_url
    FROM publishing_targets
    WHERE name LIKE '%Gulf%'
  `);
  
  console.log("\n═══════════════════════════════════════════════");
  console.log("GULF ESTATE GAZETTE:");
  console.log("═══════════════════════════════════════════════\n");
  
  if (targetsResult.rows.length > 0) {
    const target = targetsResult.rows[0] as any;
    console.log(`Target: ${target.name}`);
    console.log(`  Workspace ID: ${target.workspace_id}`);
    console.log(`  Site ID: ${target.site_id}`);
    console.log(`  Base URL: ${target.base_url || 'Not set'}`);
    
    // Find which user owns this workspace
    const ownerResult = await db.execute(sql`
      SELECT u.id, u.email, wm.role
      FROM users u
      JOIN workspace_members wm ON u.id = wm.user_id
      WHERE wm.workspace_id = ${target.workspace_id}
      AND wm.role = 'owner'
    `);
    
    if (ownerResult.rows.length > 0) {
      const owner = ownerResult.rows[0] as any;
      console.log(`\nOwner: ${owner.email || owner.id}`);
      console.log(`  User ID: ${owner.id}`);
    }
  } else {
    console.log("No Gulf Estate Gazette target found!");
  }
}

checkWorkspaces().then(() => process.exit(0)).catch(console.error);

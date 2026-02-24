import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function diagnoseContextEndpoint() {
  console.log("════════════════════════════════════════════════");
  console.log("DIAGNOSING /api/me/context ERROR");
  console.log("════════════════════════════════════════════════\n");
  
  try {
    const userId = '320d64eb-7ad3-4e35-929f-ceb0938f431e'; // Admin user
    
    // 1. Check user exists
    console.log("1. CHECKING USER:");
    const user = await db.execute(sql`
      SELECT id, email, is_site_admin FROM users WHERE id = ${userId}
    `);
    
    if (user.rows.length === 0) {
      console.log("   ❌ User not found!");
      return;
    }
    
    console.log(`   ✅ User exists: ${(user.rows[0] as any).email}`);
    
    // 2. Check workspace memberships
    console.log("\n2. CHECKING WORKSPACE MEMBERSHIPS:");
    const memberships = await db.execute(sql`
      SELECT 
        wm.workspace_id,
        w.name as workspace_name,
        wm.role
      FROM workspace_memberships wm
      JOIN workspaces w ON w.id = wm.workspace_id
      WHERE wm.user_id = ${userId}
    `);
    
    console.log(`   Found ${memberships.rows.length} memberships`);
    if (memberships.rows.length > 0) {
      memberships.rows.forEach((m: any, idx) => {
        console.log(`   ${idx + 1}. ${m.workspace_name} (${m.workspace_id}) - Role: ${m.role}`);
      });
    } else {
      console.log("   ❌ No workspace memberships found!");
    }
    
    // 3. Check if workspaces table has issues
    console.log("\n3. CHECKING WORKSPACES TABLE:");
    const workspaces = await db.execute(sql`
      SELECT id, name, slug, active_site_id, created_at
      FROM workspaces
      WHERE id IN (
        SELECT workspace_id FROM workspace_memberships WHERE user_id = ${userId}
      )
    `);
    
    if (workspaces.rows.length > 0) {
      workspaces.rows.forEach((w: any, idx) => {
        console.log(`   ${idx + 1}. ${w.name} (${w.slug})`);
        console.log(`      ID: ${w.id}`);
        console.log(`      Active Site ID: ${w.active_site_id || 'null'}`);
      });
    }
    
    // 4. Try to get topics count
    console.log("\n4. TESTING TOPICS QUERY:");
    try {
      const activeWorkspaceId = (memberships.rows[0] as any)?.workspace_id;
      if (activeWorkspaceId) {
        const topics = await db.execute(sql`
          SELECT COUNT(*) as count FROM topics WHERE workspace_id = ${activeWorkspaceId}
        `);
        console.log(`   ✅ Topics count: ${(topics.rows[0] as any).count}`);
      }
    } catch (error: any) {
      console.log(`   ❌ Topics query failed: ${error.message}`);
    }
    
    // 5. Try to get targets count
    console.log("\n5. TESTING TARGETS QUERY:");
    try {
      const activeWorkspaceId = (memberships.rows[0] as any)?.workspace_id;
      if (activeWorkspaceId) {
        const targets = await db.execute(sql`
          SELECT COUNT(*) as count FROM publishing_targets WHERE workspace_id = ${activeWorkspaceId}
        `);
        console.log(`   ✅ Targets count: ${(targets.rows[0] as any).count}`);
      }
    } catch (error: any) {
      console.log(`   ❌ Targets query failed: ${error.message}`);
    }
    
    // 6. Try to get sources count
    console.log("\n6. TESTING SOURCES QUERY:");
    try {
      const activeWorkspaceId = (memberships.rows[0] as any)?.workspace_id;
      if (activeWorkspaceId) {
        const sources = await db.execute(sql`
          SELECT COUNT(*) as count FROM sources WHERE workspace_id = ${activeWorkspaceId} OR workspace_id IS NULL
        `);
        console.log(`   ✅ Sources count: ${(sources.rows[0] as any).count}`);
      }
    } catch (error: any) {
      console.log(`   ❌ Sources query failed: ${error.message}`);
    }
    
    // 7. Try to get sites
    console.log("\n7. TESTING SITES QUERY:");
    try {
      const activeWorkspaceId = (memberships.rows[0] as any)?.workspace_id;
      if (activeWorkspaceId) {
        const sites = await db.execute(sql`
          SELECT id, name, url, connection_status FROM sites WHERE workspace_id = ${activeWorkspaceId}
        `);
        console.log(`   ✅ Sites count: ${sites.rows.length}`);
        if (sites.rows.length > 0) {
          sites.rows.forEach((s: any, idx) => {
            console.log(`   ${idx + 1}. ${s.name} - ${s.connection_status}`);
          });
        }
      }
    } catch (error: any) {
      console.log(`   ❌ Sites query failed: ${error.message}`);
      console.log(`   Error stack:`, error.stack);
    }
    
    console.log("\n════════════════════════════════════════════════");
    console.log("DIAGNOSIS COMPLETE");
    console.log("════════════════════════════════════════════════");
    
  } catch (error: any) {
    console.error("\n❌ FATAL ERROR:", error.message);
    console.error("Stack:", error.stack);
  }
}

diagnoseContextEndpoint().then(() => process.exit(0)).catch(console.error);

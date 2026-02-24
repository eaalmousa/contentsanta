import { db } from './server/db';
import { publishingTargets, topics, sources, workspaces, users, workspaceUsers } from './shared/schema';
import { eq, and } from 'drizzle-orm';

async function transferToAdmin() {
  console.log("═══════════════════════════════════════════════");
  console.log("TRANSFERRING DATA TO ADMIN WORKSPACE:");
  console.log("═══════════════════════════════════════════════\n");
  
  // Get admin user
  const [adminUser] = await db.select().from(users)
    .where(eq(users.email, 'admin@contentsanta.local'));
  
  if (!adminUser) {
    console.log("❌ Admin user not found!");
    return;
  }
  
  console.log(`✅ Found admin user: ${adminUser.email}`);
  console.log(`   User ID: ${adminUser.id}`);
  
  // Get admin's workspace membership (owner role)
  const [adminMembership] = await db.select().from(workspaceUsers)
    .where(and(
      eq(workspaceUsers.userId, adminUser.id),
      eq(workspaceUsers.role, 'owner')
    ));
  
  if (!adminMembership) {
    console.log("❌ Admin workspace membership not found!");
    return;
  }
  
  const [adminWorkspace] = await db.select().from(workspaces)
    .where(eq(workspaces.id, adminMembership.workspaceId));
  
  if (!adminWorkspace) {
    console.log("❌ Admin workspace not found!");
    return;
  }
  
  console.log(`✅ Admin workspace: ${adminWorkspace.name}`);
  console.log(`   Workspace ID: ${adminWorkspace.id}\n`);
  
  // Get all publishing targets NOT in admin workspace
  const allTargets = await db.select().from(publishingTargets);
  const targetsToMove = allTargets.filter(t => t.workspaceId !== adminWorkspace.id);
  
  console.log(`Found ${targetsToMove.length} publishing targets to transfer:`);
  
  for (const target of targetsToMove) {
    console.log(`  - ${target.name} (${target.type})`);
  }
  
  if (targetsToMove.length > 0) {
    console.log("\nTransferring publishing targets...");
    for (const target of targetsToMove) {
      await db.update(publishingTargets)
        .set({ workspaceId: adminWorkspace.id })
        .where(eq(publishingTargets.id, target.id));
      console.log(`  ✅ Moved: ${target.name}`);
    }
  }
  
  // Get all topics NOT in admin workspace
  const allTopics = await db.select().from(topics);
  const topicsToMove = allTopics.filter(t => t.workspaceId !== adminWorkspace.id);
  
  console.log(`\nFound ${topicsToMove.length} topics to transfer:`);
  
  for (const topic of topicsToMove) {
    console.log(`  - ${topic.name}`);
  }
  
  if (topicsToMove.length > 0) {
    console.log("\nTransferring topics...");
    for (const topic of topicsToMove) {
      await db.update(topics)
        .set({ workspaceId: adminWorkspace.id })
        .where(eq(topics.id, topic.id));
      console.log(`  ✅ Moved: ${topic.name}`);
    }
  }
  
  // Get all sources NOT in admin workspace
  const allSources = await db.select().from(sources);
  const sourcesToMove = allSources.filter(s => s.workspaceId !== adminWorkspace.id);
  
  console.log(`\nFound ${sourcesToMove.length} sources to transfer:`);
  
  for (const source of sourcesToMove) {
    console.log(`  - ${source.name || source.url}`);
  }
  
  if (sourcesToMove.length > 0) {
    console.log("\nTransferring sources...");
    for (const source of sourcesToMove) {
      await db.update(sources)
        .set({ workspaceId: adminWorkspace.id })
        .where(eq(sources.id, source.id));
      console.log(`  ✅ Moved: ${source.name || source.url}`);
    }
  }
  
  console.log("\n═══════════════════════════════════════════════");
  console.log("✅ TRANSFER COMPLETE!");
  console.log("═══════════════════════════════════════════════");
  console.log("\nRefresh your browser and you should see:");
  console.log("  - Publishing: Gulf Estate Gazette, Minerals Meridian");
  console.log("  - Topics: Real Estate, Minerals");
  console.log("  - Sources: All your configured RSS feeds");
}

transferToAdmin().then(() => process.exit(0)).catch(console.error);

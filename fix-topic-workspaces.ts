import { db } from "./server/storage";
import { sql } from "drizzle-orm";

// Check topic workspace IDs
const topics = await db.execute(sql`
  SELECT id, name, workspace_id FROM topics WHERE is_live = 'true' LIMIT 3
`);

console.log("\n=== LIVE TOPICS ===");
topics.rows.forEach((t: any) => {
  console.log(`${t.name}: workspace_id = ${t.workspace_id}`);
});

// Check actual workspaces
const workspaces = await db.execute(sql`
  SELECT id, name FROM workspaces
`);

console.log("\n=== WORKSPACES ===");
workspaces.rows.forEach((w: any) => {
  console.log(`${w.name}: id = ${w.id}`);
});

// Check if there's a mismatch
const validWorkspaceIds = workspaces.rows.map((w: any) => w.id);
const invalidTopics = topics.rows.filter((t: any) => !validWorkspaceIds.includes(t.workspace_id));

if (invalidTopics.length > 0) {
  console.log("\n❌ TOPICS WITH INVALID WORKSPACE_ID:");
  invalidTopics.forEach((t: any) => {
    console.log(`   ${t.name}: ${t.workspace_id}`);
  });
  
  console.log("\n🔧 Fixing by updating to first valid workspace...");
  const firstWorkspaceId = workspaces.rows[0].id;
  
  for (const topic of invalidTopics) {
    await db.execute(sql`
      UPDATE topics SET workspace_id = ${firstWorkspaceId} WHERE id = ${topic.id}
    `);
    console.log(`   Fixed: ${topic.name}`);
  }
  
  console.log("\n✅ All topics now have valid workspace_id");
} else {
  console.log("\n✅ All topics have valid workspace_id");
}

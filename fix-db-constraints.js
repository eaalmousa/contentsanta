/**
 * Fix final orphaned topic and add FK constraint
 */

import { db } from "./server/storage";
import { sql } from "drizzle-orm";

console.log("\n=== FIX ORPHANED TOPICS & ADD FK CONSTRAINT ===\n");

// 1. Find orphaned topics
const orphaned = await db.execute(sql`
  SELECT t.id, t.name, t.workspace_id
  FROM topics t
  WHERE t.workspace_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM workspaces w WHERE w.id = t.workspace_id
    )
`);

if (orphaned.rows.length > 0) {
  console.log(`Found ${orphaned.rows.length} orphaned topic(s):\n`);
  orphaned.rows.forEach((t) => {
    console.log(`  - ${t.name} (${t.id}) → workspace_id: ${t.workspace_id}`);
  });
  
  // Get first valid workspace
  const workspaces = await db.execute(sql`SELECT id, name FROM workspaces LIMIT 1`);
  const firstWorkspace = workspaces.rows[0];
  
  console.log(`\nMigrating to workspace: ${firstWorkspace.name} (${firstWorkspace.id})\n`);
  
  // Fix each orphaned topic
  for (const topic of orphaned.rows) {
    await db.execute(sql`
      UPDATE topics SET workspace_id = ${firstWorkspace.id} WHERE id = ${topic.id}
    `);
    console.log(`  ✅ Fixed: ${topic.name}`);
  }
  
  console.log("\n✅ All orphaned topics migrated\n");
} else {
  console.log("✅ No orphaned topics found\n");
}

// 2. Add FK constraint if not exists
console.log("Adding FK constraint...");

try {
  await db.execute(sql`
    ALTER TABLE topics
    ADD CONSTRAINT topics_workspace_id_fkey
    FOREIGN KEY (workspace_id)
    REFERENCES workspaces(id)
    ON DELETE CASCADE
  `);
  console.log("✅ FK constraint added successfully\n");
} catch (error) {
  if (error.message?.includes('already exists')) {
    console.log("✅ FK constraint already exists\n");
  } else {
    console.error("❌ Failed to add FK constraint:", error.message, "\n");
  }
}

// 3. Verify
const fkCheck = await db.execute(sql`
  SELECT rc.constraint_name, rc.delete_rule
  FROM information_schema.referential_constraints rc
  JOIN information_schema.table_constraints tc
    ON rc.constraint_name = tc.constraint_name
  WHERE tc.table_name = 'topics'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND rc.constraint_name LIKE '%workspace_id%'
`);

if (fkCheck.rows.length > 0) {
  console.log("=== VERIFICATION ===");
  console.log(`✅ FK constraint: ${fkCheck.rows[0].constraint_name}`);
  console.log(`   ON DELETE: ${fkCheck.rows[0].delete_rule}`);
  console.log("\n🎉 Database is now protected from invalid workspace references!");
} else {
  console.log("⚠️ FK constraint verification failed - check manually");
}

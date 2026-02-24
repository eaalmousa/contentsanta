/**
 * Change FK constraint from CASCADE to RESTRICT
 * Safer for production: prevent accidental workspace deletion from wiping topics
 */

import { db } from "./server/storage";
import { sql } from "drizzle-orm";

console.log("\n=== CHANGE FK CONSTRAINT TO RESTRICT ===\n");

console.log("Current constraint behavior:");
const currentFK = await db.execute(sql`
  SELECT rc.constraint_name, rc.delete_rule, rc.update_rule
  FROM information_schema.referential_constraints rc
  WHERE rc.constraint_name = 'topics_workspace_id_fkey'
`);

if (currentFK.rows.length > 0) {
  console.log(`  ON DELETE: ${currentFK.rows[0].delete_rule}`);
  console.log(`  ON UPDATE: ${currentFK.rows[0].update_rule}\n`);
  
  if (currentFK.rows[0].delete_rule === 'CASCADE') {
    console.log("⚠️ CASCADE means: deleting workspace will DELETE ALL topics");
    console.log("   This is risky in production!\n");
    
    console.log("Changing to RESTRICT (safer)...\n");
    
    // Drop existing constraint
    await db.execute(sql`
      ALTER TABLE topics
      DROP CONSTRAINT topics_workspace_id_fkey
    `);
    console.log("✅ Dropped CASCADE constraint");
    
    // Add RESTRICT constraint
    await db.execute(sql`
      ALTER TABLE topics
      ADD CONSTRAINT topics_workspace_id_fkey
      FOREIGN KEY (workspace_id)
      REFERENCES workspaces(id)
      ON DELETE RESTRICT
      ON UPDATE CASCADE
    `);
    console.log("✅ Added RESTRICT constraint\n");
    
    // Verify
    const newFK = await db.execute(sql`
      SELECT delete_rule, update_rule
      FROM information_schema.referential_constraints
      WHERE constraint_name = 'topics_workspace_id_fkey'
    `);
    
    console.log("New constraint behavior:");
    console.log(`  ON DELETE: ${newFK.rows[0].delete_rule}`);
    console.log(`  ON UPDATE: ${newFK.rows[0].update_rule}\n`);
    
    console.log("✅ Workspaces can no longer be deleted if topics exist");
    console.log("   (Must delete topics first, or use explicit CASCADE)");
  } else {
    console.log("✅ Already using safe delete behavior:", currentFK.rows[0].delete_rule);
  }
} else {
  console.log("❌ FK constraint not found!");
}

/**
 * Verify topics.workspace_id has proper FK constraint and type
 */

import { db } from "./server/storage";
import { sql } from "drizzle-orm";

console.log("\n=== TOPICS.WORKSPACE_ID CONSTRAINT CHECK ===\n");

// 1. Check column type
const columnInfo = await db.execute(sql`
  SELECT column_name, data_type, udt_name, is_nullable
  FROM information_schema.columns
  WHERE table_name = 'topics' AND column_name = 'workspace_id'
`);

console.log("Column Type:");
if (columnInfo.rows.length > 0) {
  const col = columnInfo.rows[0];
  console.log(`  data_type: ${col.data_type}`);
  console.log(`  udt_name: ${col.udt_name}`);
  console.log(`  nullable: ${col.is_nullable}`);
  
  if (col.data_type === 'uuid' || col.udt_name === 'uuid') {
    console.log("  ✅ Column is UUID type (type-safe)\n");
  } else if (col.data_type === 'character varying' || col.udt_name === 'varchar') {
    console.log("  ⚠️ Column is VARCHAR/TEXT (no type safety - consider migrating to UUID)\n");
  }
} else {
  console.log("  ❌ workspace_id column not found!\n");
}

// 2. Check FK constraint
const fkInfo = await db.execute(sql`
  SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    rc.update_rule,
    rc.delete_rule
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
  JOIN information_schema.referential_constraints AS rc
    ON rc.constraint_name = tc.constraint_name
  WHERE tc.table_name = 'topics' 
    AND kcu.column_name = 'workspace_id'
    AND tc.constraint_type = 'FOREIGN KEY'
`);

console.log("Foreign Key Constraint:");
if (fkInfo.rows.length > 0) {
  const fk = fkInfo.rows[0];
  console.log(`  ✅ FK constraint exists: ${fk.constraint_name}`);
  console.log(`  References: ${fk.foreign_table_name}(${fk.foreign_column_name})`);
  console.log(`  ON UPDATE: ${fk.update_rule}`);
  console.log(`  ON DELETE: ${fk.delete_rule}\n`);
} else {
  console.log("  ❌ NO FK CONSTRAINT FOUND");
  console.log("  This means workspace_id is not enforced at DB level!");
  console.log("  Recommendation: Add FK constraint\n");
}

// 3. Check for orphaned topics
const orphanedCheck = await db.execute(sql`
  SELECT COUNT(*) as count
  FROM topics t
  WHERE t.workspace_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM workspaces w WHERE w.id = t.workspace_id
    )
`);

const orphanedCount = parseInt(orphanedCheck.rows[0]?.count || '0');
console.log("Data Integrity Check:");
if (orphanedCount === 0) {
  console.log("  ✅ No orphaned topics (all workspace_ids valid)\n");
} else {
  console.log(`  ⚠️ ${orphanedCount} topics have invalid workspace_id`);
  console.log("  These topics will fail FK constraint if you add one\n");
  
  // Show examples
  const orphaned = await db.execute(sql`
    SELECT t.id, t.name, t.workspace_id
    FROM topics t
    WHERE t.workspace_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM workspaces w WHERE w.id = t.workspace_id
      )
    LIMIT 5
  `);
  
  console.log("  Examples:");
  orphaned.rows.forEach((t) => {
    console.log(`    - ${t.name} (${t.id}) → workspace_id: ${t.workspace_id}`);
  });
  console.log();
}

// 4. Summary
console.log("=== SUMMARY ===");
const hasUuidType = columnInfo.rows[0]?.udt_name === 'uuid';
const hasFkConstraint = fkInfo.rows.length > 0;
const hasOrphans = orphanedCount > 0;

if (hasUuidType && hasFkConstraint && !hasOrphans) {
  console.log("✅ OPTIMAL: UUID type + FK constraint + no orphans");
} else if (hasFkConstraint && !hasOrphans) {
  console.log("✅ GOOD: FK constraint exists, no orphans");
  if (!hasUuidType) {
    console.log("⚠️ Consider: Migrate to UUID type for better type safety");
  }
} else if (hasFkConstraint && hasOrphans) {
  console.log("⚠️ FK exists but orphaned data needs cleanup");
} else {
  console.log("❌ NEEDS ATTENTION: Add FK constraint and/or clean orphans");
}

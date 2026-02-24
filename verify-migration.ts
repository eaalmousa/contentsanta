import "dotenv/config";
import { db } from "./server/storage";
import { sql } from "drizzle-orm";

async function verifyMigration() {
  console.log("🔍 Verifying multi-site migration...\n");

  try {
    // 1. Check each workspace has at least one site
    const workspaceSites = await db.execute(sql`
      SELECT 
        w.id as workspace_id,
        w.name as workspace_name,
        w.active_site_id,
        COUNT(s.id) as site_count
      FROM workspaces w
      LEFT JOIN sites s ON s.workspace_id = w.id
      GROUP BY w.id, w.name, w.active_site_id
    `);

    console.log("✅ Workspace & Sites:");
    for (const ws of workspaceSites.rows) {
      console.log(`  • ${ws.workspace_name}: ${ws.site_count} site(s), active_site_id=${ws.active_site_id || 'NULL'}`);
    }

    // 2. Check all topics have site_id
    const topicsCheck = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        COUNT(site_id) as with_site_id
      FROM topics
    `);

    console.log(`\n✅ Topics: ${topicsCheck.rows[0]?.total || 0} total, ${topicsCheck.rows[0]?.with_site_id || 0} with site_id`);

    // 3. Check FK constraints exist
    const fkConstraints = await db.execute(sql`
      SELECT 
        tc.constraint_name,
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND (
          (tc.table_name = 'sites' AND kcu.column_name = 'workspace_id')
          OR (tc.table_name = 'topics' AND kcu.column_name = 'site_id')
          OR (tc.table_name = 'workspaces' AND kcu.column_name = 'active_site_id')
        )
    `);

    console.log("\n✅ Foreign Key Constraints:");
    for (const fk of fkConstraints.rows) {
      console.log(`  • ${fk.table_name}.${fk.column_name} → ${fk.foreign_table_name}`);
    }

    // 4. Check unique constraint on topics
    const uniqueConstraints = await db.execute(sql`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'topics' 
        AND indexname LIKE '%unique%'
    `);

    console.log("\n✅ Unique Constraints on Topics:");
    for (const idx of uniqueConstraints.rows) {
      console.log(`  • ${idx.indexname}`);
      console.log(`    ${idx.indexdef}`);
    }

    // 5. Check topic-site workspace alignment
    const mismatchCheck = await db.execute(sql`
      SELECT COUNT(*) as mismatches
      FROM topics t
      JOIN sites s ON t.site_id = s.id
      WHERE t.workspace_id != s.workspace_id
    `);

    console.log(`\n✅ Topic-Site Workspace Alignment: ${mismatchCheck.rows[0]?.mismatches || 0} mismatches`);

    console.log("\n✅ Verification complete!");
  } catch (error) {
    console.error("❌ Verification failed:", error);
    throw error;
  }
}

verifyMigration()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));

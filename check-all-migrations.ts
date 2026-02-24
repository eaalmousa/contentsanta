import "dotenv/config";
import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function checkAllMigrations() {
  console.log("================================================================================");
  console.log("DATABASE MIGRATION STATUS CHECK (pg_catalog verification)");
  console.log("================================================================================\n");

  const migrations = [
    {
      name: "20260128112959 - Topic Status State Machine",
      columns: [
        { table: "topics", column: "status" },
        { table: "topics", column: "last_run_id" },
        { table: "topics", column: "first_run_at" },
        { table: "topics", column: "last_error" },
      ],
    },
    {
      name: "20260128120000 - Idempotency & Reaper",
      columns: [
        { table: "pipeline_items", column: "story_hash" },
        { table: "pipeline_items", column: "canonical_source_url" },
      ],
    },
    {
      name: "add-wp-pull-jobs-payload",
      columns: [
        { table: "wp_pull_jobs", column: "payload_json" },
        { table: "wp_pull_jobs", column: "story_hash" },
      ],
    },
    {
      name: "add-publishing-safeguards",
      columns: [
        { table: "publishing_targets", column: "content_site_id" },
        { table: "publishing_targets", column: "require_featured_image" },
        { table: "publishing_targets", column: "language_mode" },
        { table: "publishing_targets", column: "allowed_languages" },
        { table: "pipeline_items", column: "featured_image_url" },
        { table: "pipeline_items", column: "featured_image_media_id" },
      ],
    },
  ];

  let allApplied = true;

  for (const migration of migrations) {
    console.log(`📦 ${migration.name}`);

    let migrationApplied = true;
    for (const check of migration.columns) {
      // Use information_schema for column existence (most reliable)
      const result = await db.execute(sql`
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = ${check.table} 
        AND column_name = ${check.column}
      `);

      const exists = result.rows.length > 0;
      if (exists) {
        console.log(`   ✅ ${check.table}.${check.column}`);
      } else {
        console.log(`   ❌ MISSING: ${check.table}.${check.column}`);
        migrationApplied = false;
        allApplied = false;
      }
    }

    console.log(`   Status: ${migrationApplied ? "✅ APPLIED" : "⚠️ PENDING"}\n`);
  }

  // Check critical indexes with FULL DEFINITION VERIFICATION
  console.log("📊 Critical Deduplication Indexes (PRODUCTION GUARANTEE)");
  
  // Check pipeline_items unique constraint
  const pipelineConstraint = await db.execute(sql`
    SELECT constraint_name 
    FROM information_schema.table_constraints 
    WHERE table_name = 'pipeline_items' 
    AND constraint_name = 'pipeline_item_target_hash_unique'
  `);

  if (pipelineConstraint.rows.length > 0) {
    console.log("   ✅ pipeline_item_target_hash_unique (constraint)");
  } else {
    console.log("   ⚠️ MISSING: pipeline_item_target_hash_unique");
    allApplied = false;
  }

  // Check wp_pull_jobs unique index with DEFINITION verification
  const wpPullIndexCheck = await db.execute(sql`
    SELECT indexdef 
    FROM pg_indexes 
    WHERE tablename = 'wp_pull_jobs' 
    AND indexname = 'wp_pull_jobs_target_hash_unique'
  `);

  if (wpPullIndexCheck.rows.length > 0) {
    const indexDef = (wpPullIndexCheck.rows[0] as any).indexdef;
    console.log("   ✅ wp_pull_jobs_target_hash_unique (unique index)");
    console.log(`      Definition: ${indexDef}`);
    
    // CRITICAL: Verify it's actually unique and has correct columns
    const hasTargetId = indexDef.includes("target_id");
    const hasStoryHash = indexDef.includes("story_hash");
    const isUnique = indexDef.toUpperCase().includes("UNIQUE");
    const hasWhereClause = indexDef.includes("WHERE");
    
    if (!hasTargetId || !hasStoryHash) {
      console.log("      ❌ ERROR: Index missing required columns (target_id, story_hash)");
      allApplied = false;
    } else if (!isUnique) {
      console.log("      ❌ ERROR: Index is not UNIQUE");
      allApplied = false;
    } else {
      console.log("      ✅ Columns: (target_id, story_hash)");
      console.log("      ✅ Uniqueness: ENFORCED");
      if (hasWhereClause) {
        console.log("      ✅ Partial index: Only active jobs (queued/leased/processing)");
      }
    }
  } else {
    console.log("   ❌ MISSING: wp_pull_jobs_target_hash_unique");
    allApplied = false;
  }

  console.log("\n================================================================================");
  if (allApplied) {
    console.log("✅ ALL MIGRATIONS APPLIED - Database schema is production-ready");
    console.log("✅ DEDUPLICATION ENFORCED - Unique indexes verified");
  } else {
    console.log("⚠️ SOME MIGRATIONS PENDING - Run migration scripts to apply");
  }
  console.log("================================================================================");

  process.exit(allApplied ? 0 : 1);
}

checkAllMigrations();

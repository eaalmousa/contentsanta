import "dotenv/config";
import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function checkAllTables() {
  console.log("📋 Checking database schema...\n");

  // Get all tables
  const tables = await db.execute(sql`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE' 
    ORDER BY table_name
  `);

  console.log("Database tables:");
  for (const row of tables.rows as any[]) {
    console.log(`  - ${row.table_name}`);
  }

  // Check critical fields that should exist post-migration
  const checks = [
    { table: "pipeline_items", column: "story_hash" },
    { table: "pipeline_items", column: "canonical_source_url" },
    { table: "pipeline_items", column: "featured_image_url" },
    { table: "pipeline_items", column: "featured_image_media_id" },
    { table: "publishing_targets", column: "require_featured_image" },
    { table: "publishing_targets", column: "language_mode" },
    { table: "publishing_targets", column: "allowed_languages" },
    { table: "wp_pull_jobs", column: "payload_json" },
    { table: "topics", column: "status" },
  ];

  console.log("\n✅ Critical column checks:");
  for (const check of checks) {
    const result = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = ${check.table} 
      AND column_name = ${check.column}
    `);

    if (result.rows.length > 0) {
      console.log(`  ✅ ${check.table}.${check.column}`);
    } else {
      console.log(`  ❌ MISSING: ${check.table}.${check.column}`);
    }
  }

  // Check constraint
  const constraint = await db.execute(sql`
    SELECT constraint_name 
    FROM information_schema.table_constraints 
    WHERE table_name = 'pipeline_items' 
    AND constraint_name = 'pipeline_item_target_hash_unique'
  `);

  console.log("\n📊 Constraints:");
  if (constraint.rows.length > 0) {
    console.log("  ✅ pipeline_item_target_hash_unique exists");
  } else {
    console.log("  ⚠️  pipeline_item_target_hash_unique NOT found");
  }

  console.log("\n✅ Schema check complete");
  process.exit(0);
}

checkAllTables();

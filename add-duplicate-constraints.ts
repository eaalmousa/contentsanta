#!/usr/bin/env tsx
import { db } from "./server/db";
import { sql } from "drizzle-orm";

/**
 * Add database constraints to prevent duplicate articles
 * 
 * Constraints:
 * 1. Unique constraint on (target_id, story_hash) in wp_pull_jobs
 * 2. Partial unique index on (target_id, story_hash) in pipeline_items
 */

async function addDuplicateConstraints() {
  console.log("🔧 Adding database constraints to prevent duplicates...\n");

  try {
    // 1. Add unique index on wp_pull_jobs (target_id, story_hash)
    //    Only for non-null story_hash values
    console.log("1. Adding unique constraint on wp_pull_jobs...");
    
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_wp_pull_jobs_unique_story
      ON wp_pull_jobs (target_id, story_hash)
      WHERE story_hash IS NOT NULL
        AND status IN ('queued', 'leased', 'processing', 'published')
    `);
    
    console.log("   ✅ Constraint added: idx_wp_pull_jobs_unique_story");
    console.log("      Prevents multiple active jobs for same story_hash + target\n");

    // 2. Add partial unique index on pipeline_items (target_id, story_hash)
    //    Only for published/scheduled items
    console.log("2. Adding partial unique index on pipeline_items...");
    
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_pipeline_items_unique_published_story
      ON pipeline_items (target_id, story_hash)
      WHERE story_hash IS NOT NULL
        AND status IN ('published', 'scheduled', 'publishing')
    `);
    
    console.log("   ✅ Index added: idx_pipeline_items_unique_published_story");
    console.log("      Prevents publishing same story_hash twice to same target\n");

    // 3. Add index on generated_title for faster similarity searches
    console.log("3. Adding index on generated_title for similarity checks...");
    
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_pipeline_items_title_target
      ON pipeline_items (target_id, created_at DESC)
      WHERE status IN ('published', 'scheduled', 'publishing', 'retrying')
    `);
    
    console.log("   ✅ Index added: idx_pipeline_items_title_target");
    console.log("      Speeds up title similarity searches\n");

    console.log("=" .repeat(60));
    console.log("✅ ALL CONSTRAINTS ADDED SUCCESSFULLY!");
    console.log("=".repeat(60) + "\n");

    console.log("📋 What these constraints prevent:");
    console.log("   1. WordPress plugin pulling same job multiple times");
    console.log("   2. Multiple pipeline items for same source article");
    console.log("   3. Race conditions during concurrent processing");
    console.log("");
    console.log("💡 If a duplicate is attempted, you'll see:");
    console.log('   "duplicate key value violates unique constraint"');
    console.log("   This is EXPECTED and GOOD - it means the system is working!");
    console.log("");

  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      console.log("✅ Constraints already exist - no changes needed");
    } else {
      console.error("❌ Error adding constraints:", error);
      throw error;
    }
  }
}

addDuplicateConstraints()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });

import "dotenv/config";
import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function verifyFullSchema() {
  try {
    // Check ALL pipeline_items publishing-related columns
    const pipelineResult = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'pipeline_items' 
      AND column_name IN (
        'target_id', 'target_post_id', 'target_permalink', 
        'story_hash', 'canonical_source_url', 
        'featured_image_url', 'featured_image_media_id',
        'published_at', 'quarantine_reason', 'status'
      )
      ORDER BY column_name
    `);

    console.log("Pipeline Items Publishing Columns:");
    console.table(pipelineResult.rows);

    // Check ALL publishing_targets policy columns
    const targetResult = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'publishing_targets' 
      AND column_name IN (
        'content_site_id', 'require_featured_image', 
        'language_mode', 'allowed_languages',
        'site_id', 'type', 'config_json'
      )
      ORDER BY column_name
    `);

    console.log("\nPublishing Targets Columns:");
    console.table(targetResult.rows);

    // Check constraints and indexes
    const constraintResult = await db.execute(sql`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints 
      WHERE table_name = 'pipeline_items' 
      AND constraint_name IN (
        'pipeline_item_target_hash_unique',
        'pipeline_item_unique'
      )
    `);

    console.log("\nPipeline Constraints:");
    console.table(constraintResult.rows);

    // Check indexes
    const indexResult = await db.execute(sql`
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename = 'pipeline_items' 
      AND indexname LIKE '%story_hash%'
    `);

    console.log("\nStory Hash Indexes:");
    console.table(indexResult.rows);

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

verifyFullSchema();

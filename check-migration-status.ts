import "dotenv/config";
import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function checkMigrationStatus() {
  try {
    // Check pipeline_items columns
    const pipelineResult = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'pipeline_items' 
      AND column_name IN ('story_hash', 'canonical_source_url', 'featured_image_url', 'featured_image_media_id')
      ORDER BY column_name
    `);

    console.log("Pipeline Items Columns:");
    console.log(JSON.stringify(pipelineResult.rows, null, 2));

    // Check publishing_targets columns
    const targetResult = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'publishing_targets' 
      AND column_name IN ('content_site_id', 'require_featured_image', 'language_mode', 'allowed_languages')
      ORDER BY column_name
    `);

    console.log("\nPublishing Targets Columns:");
    console.log(JSON.stringify(targetResult.rows, null, 2));

    // Check unique constraint
    const constraintResult = await db.execute(sql`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'pipeline_items' 
      AND constraint_name = 'pipeline_item_target_hash_unique'
    `);

    console.log("\nUnique Constraint:");
    console.log(JSON.stringify(constraintResult.rows, null, 2));

    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

checkMigrationStatus();

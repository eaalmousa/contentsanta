import "dotenv/config";
import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function checkGulfEstatePublishPath() {
  console.log("\n🔍 Checking Gulf Estate Gazette publishing configuration...\n");

  // Find Gulf Estate Gazette target
  const targetResult = await db.execute(sql`
    SELECT 
      id,
      name,
      type,
      workspace_id,
      site_id,
      is_active,
      require_featured_image,
      language_mode,
      allowed_languages
    FROM publishing_targets
    WHERE name ILIKE '%Gulf Estate%'
  `);

  if (targetResult.rows.length === 0) {
    console.log("❌ Gulf Estate Gazette target not found");
    return;
  }

  const target = targetResult.rows[0] as any;
  console.log("📋 Gulf Estate Gazette Target:");
  console.table([{
    id: target.id,
    name: target.name,
    type: target.type,
    site_id: target.site_id,
    is_active: target.is_active,
    require_featured_image: target.require_featured_image,
    language_mode: target.language_mode,
    allowed_languages: target.allowed_languages,
  }]);

  // Check recent pipeline items for this target
  const pipelineResult = await db.execute(sql`
    SELECT 
      id,
      status,
      generated_title,
      target_post_id,
      target_permalink,
      published_at,
      quarantine_reason,
      story_hash,
      featured_image_url,
      created_at
    FROM pipeline_items
    WHERE target_id = ${target.id}
    ORDER BY created_at DESC
    LIMIT 10
  `);

  console.log("\n📦 Recent Pipeline Items (last 10):");
  if (pipelineResult.rows.length === 0) {
    console.log("  No pipeline items found");
  } else {
    console.table(pipelineResult.rows.map((row: any) => ({
      id: row.id.substring(0, 8),
      status: row.status,
      title: row.generated_title?.substring(0, 50) + "...",
      has_wp_id: !!row.target_post_id,
      has_hash: !!row.story_hash,
      has_image: !!row.featured_image_url,
      published_at: row.published_at ? new Date(row.published_at).toISOString().split('T')[0] : null,
      quarantined: row.quarantine_reason,
    })));
  }

  // Check for WP Pull jobs
  const jobsResult = await db.execute(sql`
    SELECT 
      id,
      site_id,
      status,
      title,
      result_wp_post_id,
      created_at
    FROM wp_pull_jobs
    WHERE site_id = ${target.site_id}
    ORDER BY created_at DESC
    LIMIT 10
  `);

  console.log("\n🔄 WordPress Pull Jobs (last 10):");
  if (jobsResult.rows.length === 0) {
    console.log("  No WP pull jobs found");
  } else {
    console.table(jobsResult.rows.map((row: any) => ({
      id: row.id.substring(0, 8),
      status: row.status,
      title: row.title?.substring(0, 50) + "...",
      wp_post_id: row.result_wp_post_id,
      created: new Date(row.created_at).toISOString().split('T')[0],
    })));
  }

  // Check for automations using this target
  const automationResult = await db.execute(sql`
    SELECT 
      id,
      name,
      is_active,
      auto_publish,
      publishing_target_id
    FROM automations
    WHERE publishing_target_id = ${target.id}
  `);

  console.log("\n⚙️  Automations linked to Gulf Estate Gazette:");
  if (automationResult.rows.length === 0) {
    console.log("  No automations found");
  } else {
    console.table(automationResult.rows);
  }

  console.log("\n✅ Analysis complete");
}

checkGulfEstatePublishPath().catch(console.error);

import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function diagnose() {
  console.log("=== IMAGE PIPELINE DIAGNOSTIC ===\n");

  // 1. Check publishing targets configuration
  console.log("1. PUBLISHING TARGETS CONFIGURATION:");
  const targets = await db.execute(sql`
    SELECT 
      id, 
      name, 
      type, 
      require_featured_image,
      config_json->'default_category_id' as default_cat_id,
      config_json->'default_category_id_confirmed' as cat_confirmed
    FROM publishing_targets 
    WHERE workspace_id = (SELECT id FROM workspaces LIMIT 1)
  `);
  
  for (const target of targets.rows) {
    console.log(`  ${target.name} (${target.type}):`);
    console.log(`    require_featured_image: ${target.require_featured_image}`);
    console.log(`    default_category_id: ${target.default_cat_id}`);
    console.log(`    category_confirmed: ${target.cat_confirmed}`);
  }
  console.log();

  // 2. Check recent pipeline items without images
  console.log("2. RECENT PIPELINE ITEMS WITHOUT IMAGES:");
  const itemsWithoutImages = await db.execute(sql`
    SELECT 
      id,
      generated_title,
      status,
      featured_image_url,
      quarantine_reason,
      last_error_message,
      created_at
    FROM pipeline_items
    WHERE workspace_id = (SELECT id FROM workspaces LIMIT 1)
      AND created_at > NOW() - INTERVAL '24 hours'
      AND (featured_image_url IS NULL OR featured_image_url = '')
    ORDER BY created_at DESC
    LIMIT 10
  `);
  
  console.log(`  Found ${itemsWithoutImages.rows.length} items without images in last 24h`);
  for (const item of itemsWithoutImages.rows) {
    console.log(`    ${item.generated_title?.substring(0, 50)}...`);
    console.log(`      Status: ${item.status}`);
    console.log(`      Quarantine: ${item.quarantine_reason || "none"}`);
    console.log(`      Error: ${item.last_error_message?.substring(0, 80) || "none"}`);
  }
  console.log();

  // 3. Check wp_pull_jobs without images
  console.log("3. WP PULL JOBS WITHOUT IMAGES:");
  const jobsWithoutImages = await db.execute(sql`
    SELECT 
      id,
      title,
      status,
      featured_image_url,
      created_at
    FROM wp_pull_jobs
    WHERE created_at > NOW() - INTERVAL '24 hours'
      AND (featured_image_url IS NULL OR featured_image_url = '')
    ORDER BY created_at DESC
    LIMIT 10
  `);
  
  console.log(`  Found ${jobsWithoutImages.rows.length} WP jobs without images in last 24h`);
  for (const job of jobsWithoutImages.rows) {
    console.log(`    ${job.title?.substring(0, 50)}...`);
    console.log(`      Status: ${job.status}`);
  }
  console.log();

  // 4. Check published articles (via wp_pull_jobs with result_wp_post_id)
  console.log("4. RECENTLY PUBLISHED ARTICLES:");
  const published = await db.execute(sql`
    SELECT 
      id,
      title,
      status,
      featured_image_url,
      result_wp_post_id,
      result_wp_url,
      updated_at
    FROM wp_pull_jobs
    WHERE updated_at > NOW() - INTERVAL '48 hours'
      AND result_wp_post_id IS NOT NULL
    ORDER BY updated_at DESC
    LIMIT 20
  `);
  
  console.log(`  Found ${published.rows.length} published articles in last 48h`);
  let withImages = 0;
  let withoutImages = 0;
  for (const pub of published.rows) {
    const hasImage = pub.featured_image_url && pub.featured_image_url.trim() !== '';
    if (hasImage) withImages++;
    else withoutImages++;
    
    console.log(`    ${pub.title?.substring(0, 50)}...`);
    console.log(`      Status: ${pub.status}`);
    console.log(`      WP Post ID: ${pub.result_wp_post_id}`);
    console.log(`      Has Image: ${hasImage ? "✅ YES" : "❌ NO"}`);
    if (hasImage) {
      console.log(`      Image URL: ${pub.featured_image_url?.substring(0, 80)}...`);
    }
    if (pub.result_wp_url) {
      console.log(`      WP URL: ${pub.result_wp_url}`);
    }
  }
  console.log(`\n  Summary: ${withImages} with images, ${withoutImages} without images`);
  console.log();

  // 5. Check AI-generated images
  console.log("5. AI-GENERATED IMAGES:");
  const aiImages = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM pipeline_items
    WHERE workspace_id = (SELECT id FROM workspaces LIMIT 1)
      AND created_at > NOW() - INTERVAL '24 hours'
      AND featured_image_url LIKE '%oaidalleapiprodscus%'
  `);
  console.log(`  AI-generated images in last 24h: ${aiImages.rows[0]?.count || 0}`);
  console.log();

  // 6. Check OpenAI API key
  console.log("6. OPENAI API KEY:");
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    console.log(`  Status: ✅ Configured (${apiKey.substring(0, 10)}...)`);
  } else {
    console.log(`  Status: ❌ NOT CONFIGURED`);
  }
  console.log();

  console.log("=== DIAGNOSIS COMPLETE ===");
  process.exit(0);
}

diagnose().catch((error) => {
  console.error("Diagnosis failed:", error);
  process.exit(1);
});

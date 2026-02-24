import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function checkWPResult() {
  console.log("=== CHECKING WORDPRESS RESULT ===\n");

  const job = await db.execute(sql`
    SELECT 
      id,
      title,
      status,
      featured_image_url,
      result_wp_post_id,
      result_wp_url,
      error,
      created_at,
      updated_at
    FROM wp_pull_jobs
    WHERE title LIKE 'TEST: Image Download Verification%'
    ORDER BY created_at DESC
    LIMIT 1
  `);

  if (job.rows.length === 0) {
    console.log("❌ No test job found!\n");
    process.exit(1);
  }

  const j = job.rows[0];
  
  console.log("📊 TEST JOB DETAILS:\n");
  console.log(`Title: ${j.title}`);
  console.log(`Status: ${j.status}`);
  console.log(`Has Image URL: ${j.featured_image_url ? "✅ YES" : "❌ NO"}`);
  
  if (j.featured_image_url) {
    console.log(`Image URL: ${j.featured_image_url}\n`);
  }
  
  console.log(`Created: ${new Date(j.created_at).toLocaleString()}`);
  console.log(`Updated: ${new Date(j.updated_at).toLocaleString()}\n`);

  if (j.result_wp_post_id) {
    console.log("✅ WORDPRESS POST CREATED!");
    console.log(`   WP Post ID: ${j.result_wp_post_id}`);
    if (j.result_wp_url) {
      console.log(`   WP URL: ${j.result_wp_url}\n`);
      console.log(`🎯 GO TO THIS URL TO SEE THE POST:`);
      console.log(`   ${j.result_wp_url}\n`);
      console.log(`✅ CHECK: Does the post have a featured image?\n`);
    }
  } else {
    console.log("❌ NO WORDPRESS POST ID");
    console.log("   The job was marked as published but no WP post ID was saved\n");
  }

  if (j.error) {
    console.log(`❌ ERROR: ${j.error}\n`);
  }

  console.log("═══════════════════════════════════════════════\n");

  process.exit(0);
}

checkWPResult().catch(console.error);

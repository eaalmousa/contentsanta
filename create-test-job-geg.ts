import { db } from "./server/db";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";

async function createTestJob() {
  console.log("=== CREATING TEST JOB FOR GULF ESTATE GAZETTE ===\n");
  
  // Get all publishing targets
  const targetsResult = await db.execute(sql`
    SELECT id, name, type, site_id FROM publishing_targets WHERE type = 'wordpress_pull'
  `);
  const allTargets = targetsResult.rows as any[];
  
  console.log("Available targets:");
  allTargets.forEach((t, i) => {
    console.log(`  [${i + 1}] ${t.name} (${t.type}) - Site ID: ${t.site_id || 'N/A'}`);
  });
  console.log();
  
  // Find Gulf Estate Gazette
  const gegTarget = allTargets.find(t => t.name.toLowerCase().includes('gulf estate gazette'));
  
  if (!gegTarget) {
    console.error("❌ Gulf Estate Gazette target not found!");
    console.log("\nAvailable targets:", allTargets.map(t => t.name));
    process.exit(1);
  }
  
  console.log(`✓ Selected: ${gegTarget.name}`);
  console.log(`  Target ID: ${gegTarget.id}`);
  console.log(`  Site ID: ${gegTarget.site_id}`);
  console.log(`  Type: ${gegTarget.type}\n`);
  
  // Use stable Unsplash image URL
  const testImageUrl = "https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=1200&h=800&fit=crop";
  
  const jobId = randomUUID();
  const now = new Date();
  
  const title = `Test Article - Image Pipeline Verification ${now.toISOString()}`;
  const contentHtml = `<p>This is a test article created at ${now.toLocaleString()} to verify the image pipeline with callback evidence logging.</p>
<p>The featured image should be sourced from: ${testImageUrl}</p>
<p>Expected behavior:</p>
<ul>
  <li>Image downloaded from Unsplash (stable URL)</li>
  <li>Uploaded to WordPress media library</li>
  <li>Set as featured image</li>
  <li>Callback reports: HTTP code, bytes, attachment ID, thumbnail status</li>
</ul>`;
  const excerpt = "Test article for image pipeline verification with callback evidence";
  const slug = `test-image-pipeline-${Date.now()}`;
  const metadataJson = JSON.stringify({
    test: true,
    createdBy: "create-test-job-geg.ts",
    purpose: "image_pipeline_verification",
    imageSource: "unsplash_stable",
  });
  
  await db.execute(sql`
    INSERT INTO wp_pull_jobs (
      id, target_id, site_id, title, content_html, post_status, status,
      featured_image_url, excerpt, slug, categories, tags, metadata_json,
      attempts, created_at, updated_at
    ) VALUES (
      ${jobId}, ${gegTarget.id}, ${gegTarget.site_id}, ${title}, ${contentHtml}, 
      'publish', 'queued', ${testImageUrl}, ${excerpt}, ${slug}, 
      ARRAY['Test']::text[], ARRAY['test', 'image-pipeline']::text[], ${metadataJson}, 
      0, ${now}, ${now}
    )
  `);
  
  console.log("✅ Test job created successfully!\n");
  console.log("═══════════════════════════════════════════════");
  console.log("JOB DETAILS:");
  console.log("═══════════════════════════════════════════════");
  console.log(`Job ID: ${jobId}`);
  console.log(`Target: ${gegTarget.name}`);
  console.log(`Site ID: ${gegTarget.site_id}`);
  console.log(`Title: ${title}`);
  console.log(`Image URL: ${testImageUrl}`);
  console.log(`Status: queued`);
  console.log("═══════════════════════════════════════════════\n");
  
  console.log("NEXT STEPS:");
  console.log("1. Ensure Content Santa Connector v0.8.0 is active in WordPress");
  console.log("2. Go to WordPress Admin → Settings → Content Santa Connector");
  console.log("3. Click 'Run Now (Manual Pull)' button");
  console.log("4. Run: npx tsx --env-file=.env simple-wp-check.ts");
  console.log("5. Check callback_wp_attachment_id is populated (proves image was set)");
  console.log("6. Visit the WordPress post URL and verify featured image is visible\n");
}

createTestJob().catch(console.error);

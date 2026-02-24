import { db } from "./server/db";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import * as readline from "readline";

async function createTestJobInteractive() {
  console.log("=== CREATE TEST JOB (INTERACTIVE) ===\n");

  try {
    // 1. Get all WordPress targets
    const targets = await db.execute(sql`
      SELECT 
        id,
        name,
        type,
        site_id,
        config_json
      FROM publishing_targets
      WHERE type = 'wordpress_pull'
      ORDER BY name
    `);

    if (targets.rows.length === 0) {
      console.error("❌ No WordPress publishing targets found!");
      process.exit(1);
    }

    console.log("📋 AVAILABLE WORDPRESS TARGETS:\n");
    targets.rows.forEach((target, index) => {
      console.log(`[${index + 1}] ${target.name}`);
      console.log(`    Target ID: ${target.id}`);
      console.log(`    Site ID: ${target.site_id}`);
      console.log(`    Default Category: ${target.config_json?.default_category_id || 'Not set'}\n`);
    });

    // 2. Prompt user to select target
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise<string>((resolve) => {
      rl.question('Select target number: ', (ans) => {
        rl.close();
        resolve(ans);
      });
    });

    const selectedIndex = parseInt(answer) - 1;
    if (selectedIndex < 0 || selectedIndex >= targets.rows.length) {
      console.error("❌ Invalid selection!");
      process.exit(1);
    }

    const target = targets.rows[selectedIndex];
    console.log(`\n✅ Selected: ${target.name}\n`);

    // 3. Use stable image URLs
    const testImages = [
      {
        url: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200&q=80",
        type: "jpg",
        desc: "Unsplash real estate image"
      },
      {
        url: "https://via.placeholder.com/1200x800.jpg/0066cc/FFFFFF?text=Test+Featured+Image",
        type: "jpg", 
        desc: "Placeholder JPG"
      }
    ];

    const selectedImage = testImages[0]; // Use Unsplash by default

    // 4. Create WP pull job
    const wpJobId = randomUUID();
    const timestamp = Date.now();

    console.log("📦 Creating WordPress pull job...");
    console.log(`   Job ID: ${wpJobId}`);
    console.log(`   Target: ${target.name}`);
    console.log(`   Target ID: ${target.id}`);
    console.log(`   Site ID: ${target.site_id}`);
    console.log(`   Image URL: ${selectedImage.url}`);
    console.log(`   Image Type: ${selectedImage.type}\n`);

    await db.execute(sql`
      INSERT INTO wp_pull_jobs (
        id,
        target_id,
        site_id,
        title,
        content_html,
        post_status,
        status,
        featured_image_url,
        excerpt,
        slug,
        categories,
        tags,
        metadata_json,
        created_at,
        updated_at
      ) VALUES (
        ${wpJobId},
        ${target.id},
        ${target.site_id},
        'IMAGE TEST: ' || ${target.name} || ' - ' || ${timestamp},
        '<h1>Featured Image Test Article</h1>
        <p>This test article verifies the complete image pipeline for <strong>' || ${target.name} || '</strong>.</p>
        
        <h2>🎯 Test Objectives:</h2>
        <ul>
          <li>✅ Verify WordPress plugin downloads image from URL</li>
          <li>✅ Verify image is optimized (resize + compression)</li>
          <li>✅ Verify image is uploaded to WordPress media library</li>
          <li>✅ Verify featured image is set on post</li>
          <li>✅ Verify callback reports success with attachment ID</li>
        </ul>
        
        <h2>📊 Test Details:</h2>
        <ul>
          <li><strong>Job ID:</strong> ' || ${wpJobId} || '</li>
          <li><strong>Target:</strong> ' || ${target.name} || '</li>
          <li><strong>Site ID:</strong> ' || ${target.site_id} || '</li>
          <li><strong>Image Source:</strong> ' || ${selectedImage.desc} || '</li>
          <li><strong>Timestamp:</strong> ' || NOW() || '</li>
        </ul>
        
        <h2>✅ Expected Results:</h2>
        <p>When this article is published:</p>
        <ol>
          <li>Post should have a visible featured image</li>
          <li>Image should appear in WordPress Media Library</li>
          <li>Image should be optimized (file size reduced)</li>
          <li>Server should receive callback with attachment_id</li>
          <li>Job status should be marked as "published"</li>
        </ol>
        
        <hr>
        <p><em>This is an automated test. If the featured image is visible above, the test passed!</em></p>',
        'publish',
        'queued',
        ${selectedImage.url},
        'Test article to verify WordPress plugin image download, optimization, and featured image functionality for ' || ${target.name} || '.',
        'image-test-' || ${target.site_id} || '-' || ${timestamp},
        ARRAY['Test', 'Featured Image']::text[],
        ARRAY['test', 'image', 'verification', 'automated']::text[],
        jsonb_build_object(
          'test_job', true,
          'target_name', ${target.name},
          'image_type', ${selectedImage.type},
          'created_by', 'interactive_script',
          'test_timestamp', ${timestamp}
        ),
        NOW(),
        NOW()
      )
    `);

    console.log("✅ WP pull job created successfully!\n");

    console.log("═══════════════════════════════════════════════");
    console.log("✅ TEST JOB READY FOR WORDPRESS PULL!");
    console.log("═══════════════════════════════════════════════\n");

    console.log("📋 JOB DETAILS:");
    console.log(`   Job ID: ${wpJobId}`);
    console.log(`   Target: ${target.name}`);
    console.log(`   Target ID: ${target.id}`);
    console.log(`   Site ID: ${target.site_id}`);
    console.log(`   Image URL: ${selectedImage.url}`);
    console.log(`   Post Title: IMAGE TEST: ${target.name} - ${timestamp}\n`);

    console.log("📋 NEXT STEPS:\n");
    console.log(`1. Go to WordPress for ${target.name}`);
    console.log("2. Navigate to: Settings → Content Santa Connector");
    console.log("3. Verify Site ID matches: " + target.site_id);
    console.log("4. Click 'Run Now (Manual Pull)'");
    console.log("5. Wait 10-15 seconds");
    console.log("6. Check WordPress → Posts for the new test article");
    console.log("7. ✅ VERIFY: Post has visible featured image\n");

    console.log("🔍 TO VERIFY ON SERVER SIDE:");
    console.log(`   Run: npx tsx --env-file=.env wait-and-check-plugin.ts\n`);

    console.log("═══════════════════════════════════════════════\n");

  } catch (error: any) {
    console.error("\n❌ ERROR:", error.message);
    console.error(error);
    process.exit(1);
  }

  process.exit(0);
}

createTestJobInteractive().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

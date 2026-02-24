import { db } from "./server/db";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";

async function createTestWPJob() {
  console.log("=== CREATING TEST WORDPRESS JOB WITH IMAGE ===\n");

  try {
    // 1. Get publishing target
    const targetResult = await db.execute(sql`
      SELECT pt.id, pt.name, pt.type, pt.site_id
      FROM publishing_targets pt
      INNER JOIN workspaces w ON w.id = pt.workspace_id
      WHERE pt.type = 'wordpress_pull'
      LIMIT 1
    `);
    
    if (!targetResult.rows || targetResult.rows.length === 0) {
      console.error("❌ No WordPress publishing target found");
      process.exit(1);
    }
    
    const target = targetResult.rows[0];
    console.log(`✅ Using target: ${target.name}`);
    console.log(`   Site ID: ${target.site_id}\n`);

    // 2. Use a publicly accessible test image
    const testImageUrl = "https://picsum.photos/1200/800"; // Random test image service
    
    // 3. Create WP pull job immediately
    const wpJobId = randomUUID();
    const timestamp = Date.now();
    
    console.log("📦 Creating WordPress pull job...");
    console.log(`   Job ID: ${wpJobId}`);
    console.log(`   Title: TEST: Image Download Verification`);
    console.log(`   Image URL: ${testImageUrl}\n`);
    
    await db.execute(sql`
      INSERT INTO wp_pull_jobs (
        id,
        target_id,
        site_id,
        title,
        content_html,
        status,
        featured_image_url,
        excerpt,
        slug,
        categories,
        tags,
        created_at,
        updated_at
      ) VALUES (
        ${wpJobId},
        ${target.id},
        ${target.site_id},
        'TEST: Image Download Verification - ' || ${timestamp},
        '<h1>Test Article for Image Download Verification</h1>
        <p>This is a test article created to verify that WordPress plugin correctly downloads, optimizes, and sets featured images.</p>
        <h2>Testing Objectives:</h2>
        <ul>
          <li>✅ Verify image download from URL</li>
          <li>✅ Verify image optimization (resize to 1200px max width)</li>
          <li>✅ Verify JPEG compression at 85% quality</li>
          <li>✅ Verify upload to WordPress media library</li>
          <li>✅ Verify featured image is set on post</li>
        </ul>
        <h2>Expected Results:</h2>
        <p>When this article is published to WordPress, it should have a visible featured image that was optimized for web delivery.</p>
        <p><strong>Test Job ID:</strong> ' || ${wpJobId} || '</p>
        <p><strong>Test Date:</strong> ' || NOW() || '</p>
        <p><strong>Image Source:</strong> Lorem Picsum (test image service)</p>
        <hr>
        <p><em>This is an automated test post. If you see a featured image above, the test was successful!</em></p>',
        'queued',
        ${testImageUrl},
        'Test article to verify WordPress plugin image download and optimization functionality. Check if the post has a visible featured image.',
        'test-image-download-' || ${timestamp},
        ARRAY['Test', 'Image Verification']::text[],
        ARRAY['test', 'featured-image', 'verification', 'automated']::text[],
        NOW(),
        NOW()
      )
    `);

    console.log(`✅ WP pull job created successfully!\n`);

    console.log("═══════════════════════════════════════════════");
    console.log("✅ TEST JOB CREATED AND READY!");
    console.log("═══════════════════════════════════════════════\n");

    console.log("📋 NEXT STEPS TO TEST:\n");
    console.log("1. Go to WordPress Admin");
    console.log("   URL: Your WordPress site admin panel\n");
    
    console.log("2. Navigate to: Settings → Content Santa Connector\n");
    
    console.log("3. Click the 'Run Now (Manual Pull)' button\n");
    
    console.log("4. Wait 5-10 seconds for processing\n");
    
    console.log("5. Check WordPress error log for these messages:");
    console.log("   ✅ 'Content Santa: Attempting to download image from...'");
    console.log("   ✅ 'Content Santa: Downloaded image - Size: XX KB'");
    console.log("   ✅ 'Content Santa: Optimized image - Size: XX KB, Saved: XX%'");
    console.log("   ✅ 'Content Santa: Featured image attachment created successfully'\n");
    
    console.log("6. Go to WordPress → Posts → All Posts\n");
    
    console.log("7. Find the post: 'TEST: Image Download Verification - " + timestamp + "'\n");
    
    console.log("8. ✅ VERIFY: Post has a visible featured image\n");
    
    console.log("9. Click 'Edit' on the post and check:");
    console.log("   ✅ Featured image is set in the Featured Image panel");
    console.log("   ✅ Image appears in WordPress Media Library");
    console.log("   ✅ Image file size is optimized (should be < 500KB)\n");

    console.log("═══════════════════════════════════════════════");
    console.log("📊 TEST JOB DETAILS:");
    console.log("═══════════════════════════════════════════════");
    console.log(`   Job ID: ${wpJobId}`);
    console.log(`   Target: ${target.name} (${target.type})`);
    console.log(`   Site ID: ${target.site_id}`);
    console.log(`   Image URL: ${testImageUrl}`);
    console.log(`   Post Title: TEST: Image Download Verification - ${timestamp}`);
    console.log(`   Slug: test-image-download-${timestamp}`);
    console.log("═══════════════════════════════════════════════\n");

    console.log("🔍 TO CHECK WORDPRESS ERROR LOG:");
    console.log("   Location: /wp-content/debug.log");
    console.log("   Or check in your hosting control panel → Error Logs\n");

    console.log("💡 TIP: If image doesn't appear:");
    console.log("   1. Check WordPress error log for specific errors");
    console.log("   2. Verify GD library is installed (php -m | grep gd)");
    console.log("   3. Check memory_limit in php.ini (recommend 256M)");
    console.log("   4. Verify WordPress can write to wp-content/uploads/\n");

    console.log("═══════════════════════════════════════════════");
    console.log("✅ READY TO TEST! Click 'Run Now' in WordPress!");
    console.log("═══════════════════════════════════════════════\n");

  } catch (error: any) {
    console.error("\n❌ ERROR:", error.message);
    console.error(error);
    process.exit(1);
  }

  process.exit(0);
}

createTestWPJob().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

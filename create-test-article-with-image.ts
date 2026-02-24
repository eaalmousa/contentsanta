import { db } from "./server/db";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";

async function createTestArticleWithImage() {
  console.log("=== CREATING TEST ARTICLE WITH IMAGE ===\n");

  try {
    // 1. Get workspace
    const workspaceResult = await db.execute(sql`
      SELECT id, name FROM workspaces LIMIT 1
    `);
    
    if (!workspaceResult.rows || workspaceResult.rows.length === 0) {
      console.error("❌ No workspace found");
      process.exit(1);
    }
    
    const workspace = workspaceResult.rows[0];
    console.log(`✅ Using workspace: ${workspace.name}`);

    // 2. Get active topic
    const topicResult = await db.execute(sql`
      SELECT id, name FROM topics 
      WHERE workspace_id = ${workspace.id} 
        AND status = 'active'
      LIMIT 1
    `);
    
    if (!topicResult.rows || topicResult.rows.length === 0) {
      console.error("❌ No active topic found");
      process.exit(1);
    }
    
    const topic = topicResult.rows[0];
    console.log(`✅ Using topic: ${topic.name}\n`);

    // 3. Get publishing target
    const targetResult = await db.execute(sql`
      SELECT id, name, type FROM publishing_targets 
      WHERE workspace_id = ${workspace.id}
      LIMIT 1
    `);
    
    if (!targetResult.rows || targetResult.rows.length === 0) {
      console.error("❌ No publishing target found");
      process.exit(1);
    }
    
    const target = targetResult.rows[0];
    console.log(`✅ Using target: ${target.name} (${target.type})\n`);

    // 4. Create test pipeline item with image
    const pipelineItemId = randomUUID();
    const testImageUrl = "https://oaidalleapiprodscus.blob.core.windows.net/private/org-test/user-test/img-test.png?st=2026-02-15T00%3A00%3A00Z&se=2026-02-15T23%3A59%3A00Z&sp=r&sv=2021-08-06&sr=b&rscd=inline&rsct=image/png&skoid=test&sktid=test&skt=2026-02-15T00%3A00%3A00Z&ske=2026-02-15T23%3A59%3A00Z&sks=b&skv=2021-08-06&sig=test123";
    
    // Use a simpler, publicly accessible test image instead
    const simpleTestImageUrl = "https://picsum.photos/1200/800"; // Random test image service
    
    console.log("📝 Creating test pipeline item...");
    console.log(`   Title: "TEST: Image Download Verification"`);
    console.log(`   Image URL: ${simpleTestImageUrl}\n`);

    await db.execute(sql`
      INSERT INTO pipeline_items (
        id,
        workspace_id,
        topic_id,
        generated_title,
        generated_html,
        status,
        featured_image_url,
        language,
        created_at,
        updated_at
      ) VALUES (
        ${pipelineItemId},
        ${workspace.id},
        ${topic.id},
        'TEST: Image Download Verification - Featured Image Test',
        '<h1>Test Article for Image Download Verification</h1>
        <p>This is a test article created to verify that WordPress plugin correctly downloads, optimizes, and sets featured images.</p>
        <h2>Testing Objectives:</h2>
        <ul>
          <li>Verify image download from URL</li>
          <li>Verify image optimization (resize to 1200px max width)</li>
          <li>Verify JPEG compression at 85% quality</li>
          <li>Verify upload to WordPress media library</li>
          <li>Verify featured image is set on post</li>
        </ul>
        <h2>Expected Results:</h2>
        <p>When this article is published to WordPress, it should have a visible featured image that was optimized for web delivery.</p>
        <p><strong>Test ID:</strong> ${pipelineItemId}</p>
        <p><strong>Test Date:</strong> ${new Date().toISOString()}</p>',
        'generated',
        ${simpleTestImageUrl},
        'en',
        NOW(),
        NOW()
      )
    `);

    console.log(`✅ Pipeline item created: ${pipelineItemId}\n`);

    // 5. Hand off to publishing
    const publishingItemId = randomUUID();
    console.log("📤 Handing off to publishing pipeline...");
    
    await db.execute(sql`
      INSERT INTO publishing_items (
        id,
        pipeline_item_id,
        status,
        handed_off_at,
        created_at,
        updated_at
      ) VALUES (
        ${publishingItemId},
        ${pipelineItemId},
        'draft_ready',
        NOW(),
        NOW(),
        NOW()
      )
    `);

    console.log(`✅ Publishing item created: ${publishingItemId}\n`);

    // 6. Create WP pull job immediately
    const wpJobId = randomUUID();
    console.log("📦 Creating WordPress pull job...");
    
    await db.execute(sql`
      INSERT INTO wp_pull_jobs (
        id,
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
        'TEST: Image Download Verification - Featured Image Test',
        '<h1>Test Article for Image Download Verification</h1>
        <p>This is a test article created to verify that WordPress plugin correctly downloads, optimizes, and sets featured images.</p>
        <h2>Testing Objectives:</h2>
        <ul>
          <li>Verify image download from URL</li>
          <li>Verify image optimization (resize to 1200px max width)</li>
          <li>Verify JPEG compression at 85% quality</li>
          <li>Verify upload to WordPress media library</li>
          <li>Verify featured image is set on post</li>
        </ul>
        <h2>Expected Results:</h2>
        <p>When this article is published to WordPress, it should have a visible featured image that was optimized for web delivery.</p>
        <p><strong>Test ID:</strong> ${pipelineItemId}</p>
        <p><strong>Test Date:</strong> ${new Date().toISOString()}</p>',
        'queued',
        ${simpleTestImageUrl},
        'Test article to verify WordPress plugin image download and optimization functionality.',
        'test-image-download-verification-' || ${Date.now()},
        ARRAY['Test', 'Image Verification'],
        ARRAY['test', 'featured-image', 'verification'],
        NOW(),
        NOW()
      )
    `);

    console.log(`✅ WP pull job created: ${wpJobId}\n`);

    console.log("═══════════════════════════════════════════════");
    console.log("✅ TEST ARTICLE CREATED SUCCESSFULLY!");
    console.log("═══════════════════════════════════════════════\n");

    console.log("📋 NEXT STEPS:\n");
    console.log("1. Go to WordPress → Settings → Content Santa Connector");
    console.log("2. Click 'Run Now (Manual Pull)' button");
    console.log("3. Wait 5-10 seconds");
    console.log("4. Check WordPress error log for:");
    console.log("   - 'Content Santa: Attempting to download image from...'");
    console.log("   - 'Content Santa: Downloaded image - Size: XX KB'");
    console.log("   - 'Content Santa: Optimized image - Size: XX KB, Saved: XX%'");
    console.log("5. Go to WordPress → Posts");
    console.log("6. Find post: 'TEST: Image Download Verification'");
    console.log("7. ✅ VERIFY: Post has featured image visible\n");

    console.log("📊 TEST DETAILS:");
    console.log(`   Pipeline Item ID: ${pipelineItemId}`);
    console.log(`   Publishing Item ID: ${publishingItemId}`);
    console.log(`   WP Job ID: ${wpJobId}`);
    console.log(`   Image URL: ${simpleTestImageUrl}`);
    console.log(`   Target: ${target.name}\n`);

    console.log("🔍 TO CHECK WORDPRESS ERROR LOG:");
    console.log("   - Location: /wp-content/debug.log");
    console.log("   - Or check in your hosting control panel\n");

    console.log("═══════════════════════════════════════════════");
    console.log("✅ READY TO TEST!");
    console.log("═══════════════════════════════════════════════\n");

  } catch (error: any) {
    console.error("\n❌ ERROR:", error.message);
    console.error(error);
    process.exit(1);
  }

  process.exit(0);
}

createTestArticleWithImage().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

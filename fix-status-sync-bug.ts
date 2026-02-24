import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function fixStatusSyncBug() {
  console.log("🔧 Fixing Status Synchronization Bug\n");
  console.log("=".repeat(80));

  const workspaceId = "6830ca7f-cf7b-4d6c-97bc-3615fa563be9";

  // Find all items with status sync issues
  console.log("\n🔍 Finding items with sync issues...\n");

  // Issue 1: Status is "published" but no target_post_id (WordPress hasn't published yet)
  const falsePublished = await db.execute(
    sql`SELECT id, generated_title, status, published_at, target_post_id
        FROM pipeline_items
        WHERE workspace_id = ${workspaceId}
          AND status = 'published'
          AND target_post_id IS NULL`
  );

  console.log(`  Found ${falsePublished.rows.length} items marked "published" but not actually published`);

  // Issue 2: Status is "quarantined" but has published_at (was published despite quarantine)
  const quarantinedButPublished = await db.execute(
    sql`SELECT id, generated_title, status, published_at, target_post_id
        FROM pipeline_items
        WHERE workspace_id = ${workspaceId}
          AND status = 'quarantined'
          AND published_at IS NOT NULL`
  );

  console.log(`  Found ${quarantinedButPublished.rows.length} items "quarantined" but have published_at`);

  // Fix false "published" items
  if (falsePublished.rows.length > 0) {
    console.log("\n📝 Fixing false 'published' items...\n");
    
    for (const item of falsePublished.rows) {
      // Check if WP job exists and its status
      const wpJob = await db.execute(
        sql`SELECT status FROM wp_pull_jobs WHERE pipeline_item_id = ${item.id} LIMIT 1`
      );

      if (wpJob.rows.length > 0 && wpJob.rows[0].status === "queued") {
        // Job is queued, change status back to "publishing"
        await db.execute(
          sql`UPDATE pipeline_items
              SET status = 'publishing', published_at = NULL
              WHERE id = ${item.id}`
        );
        console.log(`  ✅ Fixed: ${item.generated_title.substring(0, 80)}...`);
        console.log(`     Status: published → publishing, cleared published_at`);
      } else {
        console.log(`  ⚠️  Skipped: ${item.generated_title.substring(0, 80)}...`);
        console.log(`     Reason: WP job not in queued state`);
      }
    }
  }

  // Fix quarantined but published items
  if (quarantinedButPublished.rows.length > 0) {
    console.log("\n📝 Fixing 'quarantined' items with published_at...\n");
    
    for (const item of quarantinedButPublished.rows) {
      // Clear published_at since item is quarantined
      await db.execute(
        sql`UPDATE pipeline_items
            SET published_at = NULL
            WHERE id = ${item.id}`
      );
      console.log(`  ✅ Fixed: ${item.generated_title.substring(0, 80)}...`);
      console.log(`     Cleared published_at (item remains quarantined)`);
    }
  }

  // Verify fixes
  console.log("\n" + "=".repeat(80));
  console.log("\n✅ Verification:\n");

  const afterFix = await db.execute(
    sql`SELECT 
          COUNT(CASE WHEN status = 'published' AND target_post_id IS NULL THEN 1 END) as false_published,
          COUNT(CASE WHEN status = 'quarantined' AND published_at IS NOT NULL THEN 1 END) as quarantined_with_timestamp,
          COUNT(CASE WHEN status = 'publishing' THEN 1 END) as currently_publishing
        FROM pipeline_items
        WHERE workspace_id = ${workspaceId}`
  );

  const counts = afterFix.rows[0];
  console.log(`  False "published" items: ${counts.false_published} (should be 0)`);
  console.log(`  Quarantined with published_at: ${counts.quarantined_with_timestamp} (should be 0)`);
  console.log(`  Currently publishing: ${counts.currently_publishing}`);

  console.log("\n" + "=".repeat(80));
  console.log("\n🎉 Status synchronization fixed!");
  console.log("\n📌 Next Steps:");
  console.log("  1. Restart server to apply code fix");
  console.log("  2. Hard refresh browser (Ctrl+Shift+R)");
  console.log("  3. Navigate to Pipeline tab");
  console.log("  4. Items should now show correct statuses:\n");
  console.log("     - 'publishing' = WP job in progress");
  console.log("     - 'published' = Successfully published with post ID");
  console.log("     - 'quarantined' = Blocked from publishing\n");
}

fixStatusSyncBug().catch(console.error);

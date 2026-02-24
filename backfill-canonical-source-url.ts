import "dotenv/config";
import { db } from "./server/db";
import { pipelineItems } from "./shared/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Backfill canonical_source_url for existing pipeline_items
 * 
 * Strategy:
 * 1. Find pipeline_items where canonical_source_url IS NULL
 * 2. For each, get story_items → source_items to infer canonical URL
 * 3. Precedence: source_items.url (primary item) → story.source_url
 * 4. Update pipeline_item with inferred canonical URL
 */

async function backfillCanonicalUrls() {
  console.log("\n🔄 Backfilling canonical_source_url for existing pipeline_items...\n");

  // Get all pipeline items with NULL canonical_source_url
  const itemsToBackfill = await db.execute(sql`
    SELECT 
      pi.id,
      pi.story_id,
      pi.generated_title
    FROM pipeline_items pi
    WHERE pi.canonical_source_url IS NULL
      AND pi.story_hash IS NOT NULL
    ORDER BY pi.created_at DESC
  `);

  console.log(`Found ${itemsToBackfill.rows.length} item(s) to backfill\n`);

  if (itemsToBackfill.rows.length === 0) {
    console.log("✅ No items need backfill - all have canonical_source_url");
    process.exit(0);
  }

  let successCount = 0;
  let failCount = 0;

  for (const item of itemsToBackfill.rows as any[]) {
    const itemId = item.id;
    const storyId = item.story_id;

    // Get story_items for this story (prioritize primary)
    const storyItems = await db.execute(sql`
      SELECT 
        si.source_url,
        si.is_primary,
        src.url as source_item_url,
        src.metadata_json
      FROM story_items si
      LEFT JOIN source_items src ON src.id = si.source_item_id
      WHERE si.story_id = ${storyId}
      ORDER BY si.is_primary DESC
      LIMIT 5
    `);

    if (storyItems.rows.length === 0) {
      console.log(`  ⚠️  ${itemId.substring(0, 8)}: No story_items found`);
      failCount++;
      continue;
    }

    // Infer canonical URL (precedence: metadata.canonicalUrl → source_item.url → story_item.source_url)
    let canonicalUrl: string | null = null;

    for (const si of storyItems.rows as any[]) {
      const metadata = si.metadata_json;
      
      // Check metadata for canonical URL
      if (metadata?.canonicalUrl) {
        canonicalUrl = metadata.canonicalUrl;
        break;
      }
      
      // Fall back to source_item.url or story_item.source_url
      if (!canonicalUrl && si.source_item_url) {
        canonicalUrl = si.source_item_url;
      }
      
      if (!canonicalUrl && si.source_url) {
        canonicalUrl = si.source_url;
      }
      
      // Stop at primary item if found
      if (si.is_primary === "true" && canonicalUrl) {
        break;
      }
    }

    if (!canonicalUrl) {
      console.log(`  ⚠️  ${itemId.substring(0, 8)}: No canonical URL found`);
      failCount++;
      continue;
    }

    // Update pipeline_item
    await db
      .update(pipelineItems)
      .set({ 
        canonicalSourceUrl: canonicalUrl,
        updatedAt: new Date()
      })
      .where(eq(pipelineItems.id, itemId));

    console.log(`  ✅ ${itemId.substring(0, 8)}: ${canonicalUrl.substring(0, 60)}...`);
    successCount++;
  }

  console.log("\n" + "=".repeat(60));
  console.log(`✅ Success: ${successCount} item(s)`);
  console.log(`⚠️  Failed: ${failCount} item(s)`);
  console.log("=".repeat(60));

  // Verify backfill
  const remainingNulls = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM pipeline_items
    WHERE canonical_source_url IS NULL
      AND story_hash IS NOT NULL
  `);

  const nullCount = parseInt((remainingNulls.rows[0] as any).count, 10);
  
  if (nullCount === 0) {
    console.log("\n✅ BACKFILL COMPLETE: All pipeline_items have canonical_source_url");
  } else {
    console.log(`\n⚠️  ${nullCount} item(s) still have NULL canonical_source_url`);
  }

  process.exit(nullCount === 0 ? 0 : 1);
}

backfillCanonicalUrls();

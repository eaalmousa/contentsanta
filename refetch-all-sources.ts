import { db } from "./server/db";
import { sql } from "drizzle-orm";
import { fetchRSSSource } from "./server/services/rss-service";

async function refetchAllSources() {
  console.log("🔄 Refetching RSS Items for All Enabled Sources\n");
  console.log("=".repeat(80));

  const workspaceId = "6830ca7f-cf7b-4d6c-97bc-3615fa563be9";
  const topicId = "3b028e16-1aed-408b-ad7a-f69e6ab4a541"; // Real Estate

  // Get all enabled sources for this topic
  const enabledSources = await db.execute(
    sql`SELECT s.id, s.name, s.feed_url, s.language
        FROM topic_sources ts
        JOIN sources s ON ts.source_id = s.id
        WHERE ts.topic_id = ${topicId} 
          AND ts.is_enabled = true
          AND s.feed_url IS NOT NULL
        ORDER BY s.name`
  );

  console.log(`\n📡 Found ${enabledSources.rows.length} enabled sources\n`);

  let totalFetched = 0;
  let successCount = 0;
  let failCount = 0;

  for (const source of enabledSources.rows) {
    try {
      console.log(`📥 Fetching: ${source.name} (${source.language})`);
      
      const result = await fetchRSSSource({
        id: source.id,
        name: source.name,
        feedUrl: source.feed_url,
        language: source.language,
        workspaceId: workspaceId,
      } as any);

      if (result.success && result.newItems > 0) {
        console.log(`   ✅ Fetched ${result.newItems} new items (${result.totalItems} total)`);
        totalFetched += result.newItems;
        successCount++;
      } else if (result.success) {
        console.log(`   ✅ Success (${result.totalItems} items, no new ones)`);
        totalFetched += result.totalItems;
        successCount++;
      } else {
        console.log(`   ⚠️  No items found`);
      }
    } catch (error: any) {
      console.log(`   ❌ Error: ${error.message}`);
      failCount++;
    }
  }

  console.log("\n" + "=".repeat(80));
  console.log("\n📊 FETCH SUMMARY:\n");
  console.log(`  Total Sources: ${enabledSources.rows.length}`);
  console.log(`  Success: ${successCount} ✅`);
  console.log(`  Failed: ${failCount} ❌`);
  console.log(`  Total Items Fetched: ${totalFetched} 📰`);

  if (totalFetched > 0) {
    // Verify items in database
    const itemCount = await db.execute(
      sql`SELECT COUNT(*) as count FROM source_items 
          WHERE workspace_id = ${workspaceId}`
    );

    console.log(`\n✅ Verified: ${itemCount.rows[0].count} items now in database`);
    
    console.log("\n🚀 NEXT STEPS:");
    console.log("  1. Go to Topics page");
    console.log("  2. Click 'Run Now' on Real Estate topic");
    console.log("  3. Discovery will now find and process articles");
    console.log("  4. Check Pipeline tab to see discovered items\n");
  } else {
    console.log("\n⚠️  WARNING: No items were fetched");
    console.log("📌 Possible reasons:");
    console.log("   • RSS feeds are down or slow");
    console.log("   • Network connectivity issues");
    console.log("   • Feeds have no new content");
    console.log("\n💡 Try again in a few minutes or check Sources page manually\n");
  }
}

refetchAllSources().catch(console.error);

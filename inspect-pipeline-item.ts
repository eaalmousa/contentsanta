import "dotenv/config";
import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function inspectPipelineItem() {
  // Get one pipeline item with story_hash
  const items = await db.execute(sql`
    SELECT 
      pi.id,
      pi.story_id,
      pi.generated_title,
      pi.status,
      pi.story_hash,
      pi.canonical_source_url,
      pi.quarantine_reason,
      s.canonical_title as story_title
    FROM pipeline_items pi
    LEFT JOIN stories s ON s.id = pi.story_id
    WHERE pi.story_hash IS NOT NULL
    LIMIT 1
  `);

  if (items.rows.length === 0) {
    console.log("No pipeline items with story_hash found");
    process.exit(0);
  }

  const item = items.rows[0] as any;
  
  console.log("\n📦 Sample pipeline_item:");
  console.log(`   ID: ${item.id}`);
  console.log(`   Story ID: ${item.story_id}`);
  console.log(`   Title: ${item.generated_title || item.story_title}`);
  console.log(`   Status: ${item.status}`);
  console.log(`   Quarantine: ${item.quarantine_reason || "N/A"}`);
  console.log(`   Story Hash: ${item.story_hash ? item.story_hash.substring(0, 40) + "..." : "NULL"}`);
  console.log(`   Canonical URL: ${item.canonical_source_url || "NULL"}`);

  // Get story_items and source_items for this item
  const storyItems = await db.execute(sql`
    SELECT 
      si.id,
      si.story_id,
      si.source_item_id,
      si.source_url,
      si.is_primary,
      src.url as source_item_url,
      src.metadata_json
    FROM story_items si
    LEFT JOIN source_items src ON src.id = si.source_item_id
    WHERE si.story_id = ${item.story_id}
    ORDER BY si.is_primary DESC
    LIMIT 3
  `);

  console.log("\n📋 Related story_items → source_items:");
  for (const si of storyItems.rows as any[]) {
    console.log(`\n   Story Item ID: ${si.id}`);
    console.log(`   Primary: ${si.is_primary}`);
    console.log(`   Story Item source_url: ${si.source_url || "NULL"}`);
    console.log(`   Source Item URL: ${si.source_item_url || "NULL"}`);
    
    if (si.metadata_json) {
      const meta = si.metadata_json;
      console.log(`   Metadata:`);
      if (meta.canonicalUrl) console.log(`      canonicalUrl: ${meta.canonicalUrl}`);
      if (meta.url) console.log(`      url: ${meta.url}`);
      if (meta.link) console.log(`      link: ${meta.link}`);
      if (meta.thumbnail) console.log(`      thumbnail: ${meta.thumbnail}`);
      if (meta.images) console.log(`      images: ${meta.images.length} image(s)`);
    }
  }

  console.log("\n💡 Canonical URL inference:");
  const primary = storyItems.rows.find((si: any) => si.is_primary === "true") || storyItems.rows[0];
  if (primary) {
    const meta = (primary as any).metadata_json;
    const inferredCanonical = 
      meta?.canonicalUrl || 
      meta?.url || 
      meta?.link || 
      (primary as any).source_url ||
      (primary as any).source_item_url;
    
    console.log(`   Best candidate: ${inferredCanonical || "NONE FOUND"}`);
    console.log(`   Source: ${meta?.canonicalUrl ? "metadata.canonicalUrl" : meta?.url ? "metadata.url" : meta?.link ? "metadata.link" : (primary as any).source_url ? "story_item.source_url" : "source_item.url"}`);
  }

  process.exit(0);
}

inspectPipelineItem();

#!/usr/bin/env tsx
import { db } from "./server/db";
import { sql } from "drizzle-orm";

/**
 * Investigate duplicate "US consumer price index" articles
 */

async function investigateDuplicates() {
  console.log("🔍 Investigating duplicate articles in WordPress...\n");

  // Find all pipeline items for this specific article
  const items = await db.execute(
    sql`SELECT id, generated_title, status, story_hash, 
               target_post_id, target_permalink, created_at, updated_at,
               canonical_source_url
        FROM pipeline_items
        WHERE generated_title LIKE '%US consumer price index%'
        ORDER BY created_at DESC`
  );

  console.log(`Found ${items.rows.length} pipeline items matching the title:\n`);
  
  const uniqueHashes = new Map<string, any[]>();
  
  for (const item of items.rows) {
    const data = item as any;
    const hash = data.story_hash || "NO_HASH";
    
    if (!uniqueHashes.has(hash)) {
      uniqueHashes.set(hash, []);
    }
    uniqueHashes.get(hash)!.push(data);
  }

  // Group by story_hash
  console.log(`📊 Grouped by story_hash:\n`);
  for (const [hash, itemsGroup] of uniqueHashes) {
    console.log(`Story Hash: ${hash.substring(0, 40)}...`);
    console.log(`Items with this hash: ${itemsGroup.length}\n`);
    
    for (const item of itemsGroup) {
      console.log(`  ID: ${item.id}`);
      console.log(`  Title: ${item.generated_title}`);
      console.log(`  Status: ${item.status}`);
      console.log(`  WP Post ID: ${item.target_post_id || "N/A"}`);
      console.log(`  WP URL: ${item.target_permalink || "N/A"}`);
      console.log(`  Canonical URL: ${item.canonical_source_url || "N/A"}`);
      console.log(`  Created: ${item.created_at}`);
      console.log(`  Updated: ${item.updated_at}`);
      console.log("");
    }
  }

  // Find wp_pull_jobs for these items
  console.log("\n📦 WP Pull Jobs:\n");
  
  const jobs = await db.execute(
    sql`SELECT wpj.id, wpj.pipeline_item_id, wpj.story_hash, wpj.status, 
               wpj.created_at, wpj.result_wp_post_id, wpj.result_wp_url
        FROM wp_pull_jobs wpj
        INNER JOIN pipeline_items pi ON wpj.pipeline_item_id = pi.id
        WHERE pi.generated_title LIKE '%US consumer price index%'
        ORDER BY wpj.created_at DESC`
  );

  console.log(`Found ${jobs.rows.length} wp_pull_jobs:\n`);
  
  for (const job of jobs.rows) {
    const data = job as any;
    console.log(`Job ID: ${data.id}`);
    console.log(`  Pipeline Item ID: ${data.pipeline_item_id}`);
    console.log(`  Story Hash: ${data.story_hash ? data.story_hash.substring(0, 40) + "..." : "N/A"}`);
    console.log(`  Status: ${data.status}`);
    console.log(`  WP Post ID: ${data.result_wp_post_id || "N/A"}`);
    console.log(`  WP URL: ${data.result_wp_url || "N/A"}`);
    console.log(`  Created: ${data.created_at}`);
    console.log("");
  }

  // Analyze the issue
  console.log("\n" + "=".repeat(70));
  console.log("🔍 ROOT CAUSE ANALYSIS");
  console.log("=".repeat(70) + "\n");

  if (uniqueHashes.size > 1) {
    console.log("⚠️  ISSUE: Multiple story_hash values for the SAME article!");
    console.log("   This means the canonical URL is different across pipeline items.");
    console.log("   Duplicate detection relies on consistent story_hash.\n");
    
    console.log("   Story hashes found:");
    for (const [hash, items] of uniqueHashes) {
      console.log(`   - ${hash.substring(0, 40)}... (${items.length} items)`);
      if (items[0].canonical_source_url) {
        console.log(`     Canonical URL: ${items[0].canonical_source_url}`);
      }
    }
  } else if (uniqueHashes.size === 1 && items.rows.length > 1) {
    console.log("⚠️  ISSUE: Same story_hash but multiple pipeline items created!");
    console.log("   This indicates a race condition or duplicate detection failure.\n");
    
    const timestamps = items.rows.map((r: any) => new Date(r.created_at).getTime());
    const timeDiffs = [];
    for (let i = 1; i < timestamps.length; i++) {
      timeDiffs.push((timestamps[i - 1] - timestamps[i]) / 1000);
    }
    
    console.log("   Time between item creations:");
    timeDiffs.forEach((diff, i) => {
      console.log(`   Item ${i + 1} → Item ${i + 2}: ${Math.abs(diff).toFixed(1)}s apart`);
    });
    
    if (timeDiffs.some(d => Math.abs(d) < 5)) {
      console.log("\n   ⚠️  Items created within 5 seconds = RACE CONDITION likely");
    }
  }

  console.log("\n🔧 RECOMMENDED FIXES:");
  console.log("   1. Add database UNIQUE constraint on (target_id, story_hash)");
  console.log("   2. Add transaction locks during duplicate checking");
  console.log("   3. Expand duplicate check to include 'publishing' status");
  console.log("   4. Add content similarity check (not just hash-based)");
  console.log("");
}

investigateDuplicates()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });

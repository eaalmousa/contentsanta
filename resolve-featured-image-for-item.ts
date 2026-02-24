import "dotenv/config";
import { db } from "./server/db";
import { pipelineItems } from "./shared/schema";
import { eq, sql } from "drizzle-orm";

/**
 * Resolve featured image for one English pipeline item
 * Extracts og:image or twitter:image from canonical URL HTML
 */

function extractMeta(html: string, property: string): string | null {
  // Extract meta tag with property or name attribute
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["'][^>]*>`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return null;
}

async function resolveFinalUrl(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent": "ContentSantaBot/1.0 (+https://contentsanta.com)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });
    return res.url; // Final URL after redirects
  } catch (error) {
    console.error(`Failed to resolve URL: ${error}`);
    return url; // Return original if resolution fails
  }
}

async function main() {
  console.log("\n🔍 Finding English pipeline item missing featured image...\n");

  // 1) Find 1 candidate English item missing featured image
  const result = await db.execute(sql`
    SELECT 
      id,
      generated_title,
      canonical_source_url,
      status,
      quarantine_reason
    FROM pipeline_items
    WHERE canonical_source_url IS NOT NULL
      AND featured_image_url IS NULL
      AND status IN ('scheduled', 'pending', 'quarantined', 'skipped')
    ORDER BY updated_at DESC
    LIMIT 10
  `);

  if (result.rows.length === 0) {
    console.log("❌ No candidate pipeline_item found.");
    process.exit(0);
  }

  // Find English item (no Arabic characters)
  let item: any = null;
  for (const candidate of result.rows as any[]) {
    const title = candidate.generated_title || "";
    const hasArabic = /[\u0600-\u06FF]/.test(title);
    
    if (!hasArabic) {
      item = candidate;
      break;
    }
  }

  if (!item) {
    console.log("❌ No English pipeline_item found.");
    console.log("   All candidates contain Arabic text.");
    process.exit(1);
  }

  const itemId = item.id;
  const title = item.generated_title;
  let url = item.canonical_source_url;

  console.log("✅ Found candidate:");
  console.log(`   ID: ${itemId.substring(0, 8)}...`);
  console.log(`   Title: ${title.substring(0, 70)}`);
  console.log(`   Status: ${item.status}`);
  console.log(`   Canonical URL: ${url.substring(0, 80)}`);
  console.log("");

  // 2) Resolve final URL if it's a Google News redirect
  if (url.includes("news.google.com/rss/articles/")) {
    console.log("🔄 Resolving Google News redirect...");
    const finalUrl = await resolveFinalUrl(url);
    
    if (finalUrl !== url) {
      console.log(`   ✅ Resolved to: ${finalUrl.substring(0, 80)}`);
      url = finalUrl;
      
      // Update canonical_source_url with resolved URL
      await db
        .update(pipelineItems)
        .set({
          canonicalSourceUrl: finalUrl,
          updatedAt: new Date()
        })
        .where(eq(pipelineItems.id, itemId));
      
      console.log("   ✅ Updated canonical_source_url to resolved URL\n");
    } else {
      console.log("   ⚠️  Could not resolve redirect, using original URL\n");
    }
  }

  // 3) Fetch HTML
  console.log("📄 Fetching article HTML...");
  
  let html: string;
  try {
    const res = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent": "ContentSantaBot/1.0 (+https://contentsanta.com)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });

    if (!res.ok) {
      console.log(`❌ HTTP error: ${res.status} ${res.statusText}`);
      process.exit(1);
    }

    html = await res.text();
    console.log(`   ✅ Fetched ${html.length} bytes\n`);
  } catch (error: any) {
    console.log(`❌ Fetch failed: ${error.message}`);
    process.exit(1);
  }

  // 4) Extract image
  console.log("🖼️  Extracting featured image...");
  
  const og = extractMeta(html, "og:image");
  const twitter = extractMeta(html, "twitter:image");
  const img = og || twitter;

  if (!img) {
    console.log("   ⚠️  No og:image or twitter:image found.");
    console.log("   ⚠️  Cannot set featured image for this article.");
    
    // Check if we can find any img tag
    const imgTagMatch = html.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
    if (imgTagMatch?.[1]) {
      console.log(`   ℹ️  Found <img> tag, but not using as fallback: ${imgTagMatch[1].substring(0, 60)}`);
    }
    
    process.exit(1);
  }

  console.log(`   ✅ Found: ${img.substring(0, 100)}`);
  
  // Validate image URL
  if (!img.startsWith("http")) {
    console.log("   ❌ Image URL is relative, cannot use");
    process.exit(1);
  }

  // 5) Update DB
  console.log("\n💾 Updating pipeline_items...");
  
  await db
    .update(pipelineItems)
    .set({
      featuredImageUrl: img,
      updatedAt: new Date()
    })
    .where(eq(pipelineItems.id, itemId));

  console.log("   ✅ Updated featured_image_url");

  // 6) Verify
  const [updated] = await db
    .select()
    .from(pipelineItems)
    .where(eq(pipelineItems.id, itemId));

  console.log("\n" + "=".repeat(60));
  console.log("✅ SUCCESS: Featured image resolved and saved");
  console.log("=".repeat(60));
  console.log(`\nPipeline Item: ${itemId.substring(0, 8)}...`);
  console.log(`Title: ${title.substring(0, 70)}`);
  console.log(`Featured Image: ${updated.featuredImageUrl?.substring(0, 80)}`);
  console.log(`Status: ${updated.status}`);
  console.log(`\nNext step: Run publish job to create wp_pull_job`);
  console.log(`Command: npx tsx force-publish-one-item.ts ${itemId}`);

  process.exit(0);
}

main().catch((error) => {
  console.error("\n❌ Error:", error.message);
  process.exit(1);
});

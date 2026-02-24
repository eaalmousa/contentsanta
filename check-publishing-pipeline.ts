import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function checkPublishingPipeline() {
  console.log("=== PUBLISHING PIPELINE CHECK ===\n");

  // 1. Check pipeline items ready for handoff
  console.log("1. PIPELINE ITEMS READY FOR HANDOFF:");
  const readyItems = await db.execute(sql`
    SELECT 
      pi.id,
      pi.generated_title,
      pi.status,
      pi.featured_image_url,
      t.name as topic_name,
      pi.created_at
    FROM pipeline_items pi
    LEFT JOIN topics t ON t.id = pi.topic_id
    WHERE pi.status IN ('generated', 'gated', 'scheduled')
      AND pi.workspace_id = (SELECT id FROM workspaces LIMIT 1)
      AND NOT EXISTS (
        SELECT 1 FROM publishing_items pub WHERE pub.pipeline_item_id = pi.id
      )
    ORDER BY pi.created_at DESC
    LIMIT 5
  `);

  if (readyItems.rows.length === 0) {
    console.log("  ❌ No pipeline items ready for handoff");
  } else {
    for (const item of readyItems.rows) {
      const hasImage = item.featured_image_url && item.featured_image_url.trim() !== '';
      console.log(`\n  ${item.generated_title?.substring(0, 60) || "Untitled"}...`);
      console.log(`    Topic: ${item.topic_name}`);
      console.log(`    Status: ${item.status}`);
      console.log(`    Has Image: ${hasImage ? "✅ YES" : "❌ NO"}`);
      if (hasImage) {
        console.log(`    Image: ${item.featured_image_url?.substring(0, 70)}...`);
      }
    }
    console.log(`\n  Total ready for handoff: ${readyItems.rows.length}`);
  }

  // 2. Check publishing items
  console.log("\n2. PUBLISHING ITEMS:");
  const pubItems = await db.execute(sql`
    SELECT 
      pub.id,
      pub.status,
      pub.scheduled_at,
      pub.created_at,
      pi.generated_title,
      pi.featured_image_url
    FROM publishing_items pub
    INNER JOIN pipeline_items pi ON pi.id = pub.pipeline_item_id
    WHERE pub.created_at > NOW() - INTERVAL '24 hours'
    ORDER BY pub.created_at DESC
    LIMIT 10
  `);

  if (pubItems.rows.length === 0) {
    console.log("  ❌ No publishing items in last 24h");
  } else {
    for (const item of pubItems.rows) {
      const hasImage = item.featured_image_url && item.featured_image_url.trim() !== '';
      console.log(`\n  ${item.generated_title?.substring(0, 60) || "Untitled"}...`);
      console.log(`    Pub Status: ${item.status}`);
      console.log(`    Has Image: ${hasImage ? "✅ YES" : "❌ NO"}`);
      if (item.scheduled_at) {
        console.log(`    Scheduled: ${new Date(item.scheduled_at).toLocaleString()}`);
      }
    }
    console.log(`\n  Total publishing items: ${pubItems.rows.length}`);
  }

  // 3. Check topics
  console.log("\n3. ACTIVE TOPICS:");
  const topics = await db.execute(sql`
    SELECT 
      id,
      name,
      status,
      updated_at
    FROM topics
    WHERE workspace_id = (SELECT id FROM workspaces LIMIT 1)
      AND status = 'active'
    ORDER BY updated_at DESC
    LIMIT 5
  `);

  if (topics.rows.length === 0) {
    console.log("  ❌ No active topics");
  } else {
    for (const topic of topics.rows) {
      console.log(`\n  ${topic.name}`);
      console.log(`    Status: ${topic.status}`);
      console.log(`    Updated: ${topic.updated_at ? new Date(topic.updated_at).toLocaleString() : "Never"}`);
    }
  }

  console.log("\n=== END ===");
  process.exit(0);
}

checkPublishingPipeline().catch(console.error);

import { db } from './server/db';
import { sql } from 'drizzle-orm';

(async () => {
  console.log('\n=== Investigating Google Logo Image ===\n');
  
  // Find a published item with the Google image
  const item = await db.execute(sql`
    SELECT id, generated_title, featured_image_url, story_id
    FROM pipeline_items
    WHERE featured_image_url LIKE '%googleusercontent%'
    LIMIT 1
  `);
  
  if (item.rows.length === 0) {
    console.log('No items found with Google image');
    process.exit(0);
  }
  
  const pi = item.rows[0] as any;
  console.log('Pipeline Item:', pi.generated_title);
  console.log('Image URL:', pi.featured_image_url);
  console.log('Story ID:', pi.story_id);
  
  if (pi.story_id) {
    // Get story items
    const storyItems = await db.execute(sql`
      SELECT si.id, si.source_item_id, si.is_primary
      FROM story_items si
      WHERE si.story_id = ${pi.story_id}
    `);
    
    console.log(`\n📚 Story has ${storyItems.rows.length} source items`);
    
    for (const si of storyItems.rows) {
      const storyItem = si as any;
      console.log(`\n  Story Item ${storyItem.id} (primary: ${storyItem.is_primary})`);
      
      if (storyItem.source_item_id) {
        const sourceItem = await db.execute(sql`
          SELECT id, title, url, metadata_json
          FROM source_items
          WHERE id = ${storyItem.source_item_id}
        `);
        
        if (sourceItem.rows.length > 0) {
          const sitem = sourceItem.rows[0] as any;
          console.log(`    URL: ${sitem.url}`);
          
          const metadata = sitem.metadata_json || {};
          console.log(`    Has thumbnail: ${!!metadata.thumbnail}`);
          console.log(`    Has images: ${metadata.images?.length || 0}`);
          
          if (metadata.thumbnail) {
            console.log(`    Thumbnail: ${metadata.thumbnail}`);
          }
          if (metadata.images && metadata.images.length > 0) {
            console.log(`    First image: ${metadata.images[0]}`);
          }
        }
      }
    }
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n🔍 ROOT CAUSE:');
  console.log('If all items share the same Google logo URL, it means:');
  console.log('1. featured_image_url is being set to a default/placeholder during content generation');
  console.log('2. Image resolution is NOT running before publishing');
  console.log('\n✅ FIX: Add image resolution step in publishing worker BEFORE creating WP job');
  
  process.exit(0);
})();

import { db } from './server/db';
import { sql } from 'drizzle-orm';

(async () => {
  console.log('\n=== Published Items - Featured Image Analysis ===');
  
  const items = await db.execute(sql`
    SELECT id, generated_title, featured_image_url, story_id 
    FROM pipeline_items 
    WHERE status = 'published' 
    ORDER BY updated_at DESC 
    LIMIT 10
  `);
  
  for (const item of items.rows) {
    const i = item as any;
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Title:', i.generated_title?.substring(0, 70));
    console.log('Image:', i.featured_image_url || 'NULL');
    
    if (i.featured_image_url) {
      if (i.featured_image_url.includes('oaidalleapiprodscus')) {
        console.log('Type: ❌ DALL-E Generated (should prioritize source!)');
      } else if (i.featured_image_url.includes('via.placeholder')) {
        console.log('Type: ❌ Placeholder (should have real image!)');
      } else if (i.featured_image_url.includes('picsum')) {
        console.log('Type: ❌ Random Picsum (should have real image!)');
      } else {
        console.log('Type: ✅ Real source image');
      }
    } else {
      console.log('Type: ❌ NO IMAGE');
    }
  }
  
  process.exit(0);
})();

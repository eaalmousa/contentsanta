import { db } from './server/db';
import { sql } from 'drizzle-orm';

(async () => {
  console.log('\n🔄 Resetting published articles with Google logo placeholder...\n');
  
  // Find items with Google logo
  const checkQuery = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM pipeline_items 
    WHERE status = 'published' 
      AND featured_image_url LIKE '%googleusercontent%'
  `);
  
  const count = (checkQuery.rows[0] as any).count;
  console.log(`Found ${count} articles with Google logo placeholder`);
  
  if (count === 0) {
    console.log('✅ No articles to reset - all good!');
    process.exit(0);
  }
  
  // Reset them to scheduled
  const result = await db.execute(sql`
    UPDATE pipeline_items 
    SET status = 'scheduled',
        published_at = NULL,
        target_post_id = NULL
    WHERE status = 'published' 
      AND featured_image_url LIKE '%googleusercontent%'
  `);
  
  console.log(`\n✅ Reset ${count} articles to 'scheduled' status`);
  console.log('   - published_at: NULL');
  console.log('   - target_post_id: NULL');
  console.log('\n⏰ Publishing worker will pick them up in the next cycle (within 3 minutes)');
  console.log('   - Server will resolve REAL images from sources');
  console.log('   - Or generate AI images if source has none');
  console.log('   - WordPress will receive optimized images');
  console.log('\n📊 Watch server console for:');
  console.log('   [Publishing Worker] ✅ Resolved better image for item <id>');
  console.log('   Old: https://lh3.googleusercontent.com/...');
  console.log('   New: https://example.com/real-article-image.jpg');
  console.log('\n🎉 Articles will have beautiful images soon!');
  
  process.exit(0);
})();

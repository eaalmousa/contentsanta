import { db } from './server/db';
import { sql } from 'drizzle-orm';

(async () => {
  console.log('\n=== Reset Articles with Google Logo to Republish ===\n');
  
  const result = await db.execute(sql`
    UPDATE pipeline_items 
    SET status = 'scheduled', 
        published_at = NULL, 
        target_post_id = NULL
    WHERE status = 'published' 
      AND featured_image_url LIKE '%googleusercontent%'
  `);
  
  console.log('✅ Reset articles with Google logo to "scheduled" status');
  console.log('   These will be republished with REAL images in the next cycle');
  console.log('\n⏰ Publishing worker runs every 3 minutes');
  console.log('   Watch for image resolution logs in server console\n');
  
  process.exit(0);
})();

import { db } from './server/db';
import { sql } from 'drizzle-orm';

(async () => {
  console.log('\n=== PIPELINE ITEMS - Publishing State ===');
  const items = await db.execute(sql`
    SELECT id, status, target_post_id, target_permalink, published_at, generated_title
    FROM pipeline_items
    WHERE status IN ('publishing', 'published')
    ORDER BY updated_at DESC
    LIMIT 10
  `);
  
  console.log(JSON.stringify(items.rows, null, 2));
  
  console.log('\n=== WP PULL JOBS - Recent Status ===');
  const jobs = await db.execute(sql`
    SELECT id, pipeline_item_id, status, result_wp_post_id, result_wp_url
    FROM wp_pull_jobs
    ORDER BY created_at DESC
    LIMIT 10
  `);
  
  console.log(JSON.stringify(jobs.rows, null, 2));

  process.exit(0);
})();

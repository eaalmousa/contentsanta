import { db } from './server/db';
import { sql } from 'drizzle-orm';

(async () => {
  console.log('\n=== Published WP Jobs ===\n');
  
  const publishedJobs = await db.execute(sql`
    SELECT 
      id, 
      status, 
      pipeline_item_id, 
      result_wp_post_id, 
      result_wp_url,
      updated_at
    FROM wp_pull_jobs
    WHERE status = 'published'
    ORDER BY updated_at DESC
    LIMIT 10
  `);
  
  console.log(`Found ${publishedJobs.rows.length} published jobs:\n`);
  
  if (publishedJobs.rows.length === 0) {
    console.log('❌ No published jobs found!\n');
    process.exit(0);
  }
  
  for (const job of publishedJobs.rows as any[]) {
    console.log(`Job ID: ${job.id.substring(0, 8)}...`);
    console.log(`  Pipeline Item ID: ${job.pipeline_item_id?.substring(0, 8) || 'NULL'}...`);
    console.log(`  WP Post ID: ${job.result_wp_post_id || 'NULL'}`);
    console.log(`  WP URL: ${job.result_wp_url?.substring(0, 60) || 'NULL'}...`);
    console.log(`  Updated: ${job.updated_at}`);
    
    // Check if pipeline item was updated
    if (job.pipeline_item_id) {
      const item = await db.execute(sql`
        SELECT id, status, target_post_id, target_permalink
        FROM pipeline_items
        WHERE id = ${job.pipeline_item_id}
      `);
      
      if (item.rows.length > 0) {
        const pItem = item.rows[0] as any;
        console.log(`  ✓ Pipeline Item Status: ${pItem.status}`);
        console.log(`  ✓ Pipeline target_post_id: ${pItem.target_post_id || 'NULL'}`);
        console.log(`  ✓ Pipeline target_permalink: ${pItem.target_permalink?.substring(0, 50) || 'NULL'}...`);
        
        if (pItem.status === 'published' && pItem.target_post_id) {
          console.log(`  ✅ CORRECT: Pipeline item updated successfully!`);
        } else {
          console.log(`  ❌ PROBLEM: Pipeline item NOT updated! (status=${pItem.status}, target_post_id=${pItem.target_post_id})`);
        }
      } else {
        console.log(`  ❌ Pipeline item not found!`);
      }
    }
    console.log('');
  }
  
  process.exit(0);
})();

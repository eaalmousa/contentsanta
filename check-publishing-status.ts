import { db } from './server/db';
import { sql } from 'drizzle-orm';

(async () => {
  console.log('\n=== Publishing Pipeline Status ===\n');
  
  const items = await db.execute(sql`
    SELECT id, status, generated_title, target_post_id, published_at
    FROM pipeline_items
    WHERE status IN ('publishing', 'scheduled', 'quarantined', 'retrying')
    ORDER BY updated_at DESC
    LIMIT 15
  `);
  
  console.log(`Found ${items.rows.length} items in active pipeline states:\n`);
  
  items.rows.forEach((row: any, index: number) => {
    console.log(`${index + 1}. [${row.status.toUpperCase()}] ${row.generated_title?.substring(0, 60)}...`);
    if (row.target_post_id) {
      console.log(`   ✅ Published to WP Post ID: ${row.target_post_id}`);
    } else {
      console.log(`   ⏳ Not yet published to WordPress`);
    }
  });
  
  // Check WP jobs
  const wpJobs = await db.execute(sql`
    SELECT COUNT(*) as count, status
    FROM wp_pull_jobs
    GROUP BY status
  `);
  
  console.log('\n=== WordPress Pull Jobs ===\n');
  wpJobs.rows.forEach((row: any) => {
    console.log(`  ${row.status}: ${row.count}`);
  });
  
  // Check for recent callbacks
  const recentCompleted = await db.execute(sql`
    SELECT id, status, created_at
    FROM wp_pull_jobs
    WHERE status = 'completed'
    ORDER BY updated_at DESC
    LIMIT 5
  `);
  
  if (recentCompleted.rows.length > 0) {
    console.log(`\n✅ ${recentCompleted.rows.length} jobs completed recently`);
  } else {
    console.log('\n❌ No completed jobs found - callback not working!');
  }
  
  process.exit(0);
})();

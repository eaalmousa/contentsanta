import { db } from './server/db';
import { sql } from 'drizzle-orm';

(async () => {
  const jobs = await db.execute(sql`
    SELECT id, status, pipeline_item_id
    FROM wp_pull_jobs
    WHERE status = 'published'
    LIMIT 5
  `);
  
  console.log('\n=== Published Jobs - Check pipeline_item_id ===\n');
  jobs.rows.forEach((j: any) => {
    console.log(`Job ${j.id.substring(0,8)}: pipeline_item_id = ${j.pipeline_item_id || 'NULL'}`);
  });
  console.log('');
  
  process.exit(0);
})();

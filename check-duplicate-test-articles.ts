import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function checkAllDuplicateJobs() {
  console.log('🔍 Checking all WP pull jobs for duplicate pipeline items...\n');

  // Find all jobs grouped by pipeline_item_id
  const jobsByItem = await db.execute(sql`
    SELECT 
      pipeline_item_id,
      COUNT(*) as job_count,
      array_agg(id ORDER BY created_at) as job_ids,
      array_agg(status ORDER BY created_at) as statuses,
      array_agg(result_wp_post_id ORDER BY created_at) as wp_post_ids,
      MAX(created_at) as last_created
    FROM wp_pull_jobs
    WHERE pipeline_item_id IS NOT NULL
    GROUP BY pipeline_item_id
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
    LIMIT 20
  `);

  console.log(`Found ${jobsByItem.rows.length} pipeline items with multiple jobs:\n`);

  for (const row of jobsByItem.rows) {
    const item: any = row;
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Pipeline Item: ${item.pipeline_item_id}`);
    console.log(`Job Count: ${item.job_count} ❌ DUPLICATE!`);
    console.log(`Job IDs: ${JSON.stringify(item.job_ids).substring(0, 100)}...`);
    console.log(`Statuses: ${item.statuses}`);
    console.log(`WP Post IDs: ${item.wp_post_ids}`);
    console.log(`Last Created: ${item.last_created}`);
    console.log('');
  }

  // Check for story_hash duplicates
  console.log('\n🔍 Checking for story_hash duplicates in wp_pull_jobs...\n');
  
  const hashDupes = await db.execute(sql`
    SELECT 
      story_hash,
      COUNT(*) as job_count,
      array_agg(DISTINCT result_wp_post_id) as wp_post_ids
    FROM wp_pull_jobs
    WHERE story_hash IS NOT NULL
    GROUP BY story_hash
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
    LIMIT 10
  `);

  console.log(`Found ${hashDupes.rows.length} story hashes with multiple jobs:\n`);

  for (const row of hashDupes.rows) {
    const dupe: any = row;
    console.log(`Story Hash: ${dupe.story_hash.substring(0, 50)}...`);
    console.log(`  Job Count: ${dupe.job_count}`);
    console.log(`  WP Post IDs: ${dupe.wp_post_ids}`);
    console.log('');
  }

  // Check idempotency in pipeline_items
  console.log('\n🔍 Checking for duplicate pipeline items by story_hash...\n');
  
  const pipelineDupes = await db.execute(sql`
    SELECT 
      story_hash,
      COUNT(*) as item_count,
      array_agg(id) as item_ids,
      array_agg(status) as statuses,
      array_agg(target_post_id) as wp_post_ids
    FROM pipeline_items
    WHERE story_hash IS NOT NULL
    GROUP BY story_hash
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
    LIMIT 10
  `);

  console.log(`Found ${pipelineDupes.rows.length} story hashes with multiple pipeline items:\n`);

  for (const row of pipelineDupes.rows) {
    const dupe: any = row;
    console.log(`Story Hash: ${dupe.story_hash.substring(0, 50)}...`);
    console.log(`  Item Count: ${dupe.item_count} ❌ DUPLICATE!`);
    console.log(`  Statuses: ${dupe.statuses}`);
    console.log(`  WP Post IDs: ${dupe.wp_post_ids}`);
    console.log('');
  }

  process.exit(0);
}

checkAllDuplicateJobs().catch((err) => {
  console.error('❌ Check failed:', err);
  process.exit(1);
});

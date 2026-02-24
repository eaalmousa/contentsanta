import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function checkPublishedItems() {
  console.log('🔍 Checking for published items in database...\n');

  // Check published pipeline items
  const published = await db.execute(sql`
    SELECT 
      id,
      generated_title,
      status,
      target_post_id,
      target_permalink,
      published_at,
      updated_at
    FROM pipeline_items
    WHERE status = 'published'
    ORDER BY published_at DESC NULLS LAST
    LIMIT 20
  `);

  console.log(`Found ${published.rows.length} published items:\n`);

  if (published.rows.length === 0) {
    console.log('❌ NO PUBLISHED ITEMS FOUND!');
    console.log('\nChecking statuses of all items...\n');
    
    const allStatuses = await db.execute(sql`
      SELECT status, COUNT(*) as count
      FROM pipeline_items
      GROUP BY status
      ORDER BY count DESC
    `);

    console.log('Pipeline item statuses:');
    allStatuses.rows.forEach((row: any) => {
      console.log(`  ${row.status}: ${row.count}`);
    });

    console.log('\nChecking wp_pull_jobs...\n');
    
    const wpJobs = await db.execute(sql`
      SELECT 
        status,
        COUNT(*) as count
      FROM wp_pull_jobs
      GROUP BY status
      ORDER BY count DESC
    `);

    console.log('WP pull job statuses:');
    wpJobs.rows.forEach((row: any) => {
      console.log(`  ${row.status}: ${row.count}`);
    });

    // Check if any jobs have result_wp_post_id
    const successfulJobs = await db.execute(sql`
      SELECT 
        id,
        title,
        status,
        result_wp_post_id,
        result_wp_url,
        pipeline_item_id,
        updated_at
      FROM wp_pull_jobs
      WHERE result_wp_post_id IS NOT NULL
      ORDER BY updated_at DESC
      LIMIT 10
    `);

    console.log(`\n✅ Found ${successfulJobs.rows.length} WP jobs with post IDs:\n`);
    
    successfulJobs.rows.forEach((job: any) => {
      console.log(`Job: ${job.id}`);
      console.log(`  Title: ${job.title?.substring(0, 60)}...`);
      console.log(`  Status: ${job.status}`);
      console.log(`  WP Post ID: ${job.result_wp_post_id}`);
      console.log(`  WP URL: ${job.result_wp_url || 'NULL'}`);
      console.log(`  Pipeline Item: ${job.pipeline_item_id}`);
      console.log('');
    });

  } else {
    published.rows.forEach((item: any) => {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`ID: ${item.id}`);
      console.log(`Title: ${item.generated_title?.substring(0, 80)}`);
      console.log(`Status: ${item.status}`);
      console.log(`WP Post ID: ${item.target_post_id || 'NULL'}`);
      console.log(`Permalink: ${item.target_permalink || 'NULL'}`);
      console.log(`Published At: ${item.published_at || 'NULL'}`);
      console.log('');
    });
  }

  process.exit(0);
}

checkPublishedItems().catch((err) => {
  console.error('❌ Check failed:', err);
  process.exit(1);
});

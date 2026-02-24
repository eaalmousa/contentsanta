import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function checkDuplicateJobs() {
  console.log('🔍 Checking for duplicate WP jobs for "service charges" article...\n');

  // Check for duplicate jobs by title
  const dupes = await db.execute(sql`
    SELECT 
      title,
      COUNT(*) as count,
      array_agg(id) as job_ids,
      array_agg(status) as statuses,
      array_agg(pipeline_item_id) as pipeline_item_ids
    FROM wp_pull_jobs
    WHERE title LIKE '%service charges%Dubai%'
    GROUP BY title
    HAVING COUNT(*) > 1
  `);

  if (dupes.rows.length > 0) {
    console.log('❌ DUPLICATES FOUND:\n');
    dupes.rows.forEach((row: any) => {
      console.log(`Title: ${row.title.substring(0, 70)}...`);
      console.log(`Count: ${row.count} ❌ DUPLICATE!`);
      console.log(`Job IDs: ${row.job_ids}`);
      console.log(`Statuses: ${row.statuses}`);
      console.log(`Pipeline Items: ${row.pipeline_item_ids}`);
      console.log('');
    });
  } else {
    console.log('✅ No duplicate jobs found by title');
  }

  // Get all jobs for this article
  const allJobs = await db.execute(sql`
    SELECT 
      id,
      status,
      pipeline_item_id,
      result_wp_post_id,
      created_at,
      updated_at
    FROM wp_pull_jobs
    WHERE title LIKE '%service charges%Dubai%'
    ORDER BY created_at
  `);

  console.log(`\n📋 All jobs for this article (${allJobs.rows.length} total):\n`);

  allJobs.rows.forEach((j: any, idx: number) => {
    console.log(`[${idx + 1}] Job: ${j.id}`);
    console.log(`    Status: ${j.status}`);
    console.log(`    Pipeline Item: ${j.pipeline_item_id || 'NULL'}`);
    console.log(`    WP Post ID: ${j.result_wp_post_id || 'NULL'}`);
    console.log(`    Created: ${j.created_at}`);
    console.log(`    Updated: ${j.updated_at}`);
    console.log('');
  });

  // Check if idempotency constraint exists
  console.log('\n🔍 Checking for idempotency constraint...\n');
  
  const constraint = await db.execute(sql`
    SELECT indexname, indexdef
    FROM pg_indexes
    WHERE indexname = 'idx_wp_pull_jobs_item_active'
  `);

  if (constraint.rows.length > 0) {
    console.log('✅ Constraint exists:');
    const c = constraint.rows[0] as any;
    console.log(`   ${c.indexname}`);
    console.log(`   ${c.indexdef}`);
  } else {
    console.log('❌ Constraint NOT FOUND! This is the problem!');
  }

  // Check for duplicate pipeline items
  console.log('\n🔍 Checking for duplicate pipeline items...\n');
  
  const pipelineDupes = await db.execute(sql`
    SELECT 
      COUNT(*) as count,
      array_agg(id) as item_ids
    FROM pipeline_items
    WHERE generated_title LIKE '%service charges%Dubai%'
  `);

  const pd = pipelineDupes.rows[0] as any;
  console.log(`Found ${pd.count} pipeline items with this title`);
  if (pd.count > 1) {
    console.log(`❌ DUPLICATE PIPELINE ITEMS: ${pd.item_ids}`);
  } else {
    console.log(`✅ Only 1 pipeline item (correct)`);
  }

  process.exit(0);
}

checkDuplicateJobs().catch((err) => {
  console.error('❌ Check failed:', err);
  process.exit(1);
});

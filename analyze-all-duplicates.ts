import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function analyzeDuplicatePublishing() {
  console.log('🔍 Analyzing duplicate publishing issue...\n');

  // Find the duplicate article
  const duplicates = await db.execute(sql`
    SELECT 
      wpj.id,
      wpj.title,
      wpj.status,
      wpj.result_wp_post_id,
      wpj.result_wp_url,
      wpj.story_hash,
      wpj.created_at,
      wpj.pipeline_item_id
    FROM wp_pull_jobs wpj
    WHERE wpj.title LIKE '%service charges%Dubai%'
    ORDER BY wpj.created_at DESC
    LIMIT 10
  `);

  console.log(`Found ${duplicates.rows.length} WP jobs for this article:\n`);

  for (const row of duplicates.rows) {
    const job: any = row;
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Job ID: ${job.id}`);
    console.log(`Title: ${job.title.substring(0, 80)}...`);
    console.log(`Status: ${job.status}`);
    console.log(`WP Post ID: ${job.result_wp_post_id || 'N/A'}`);
    console.log(`Story Hash: ${job.story_hash || 'MISSING'}`);
    console.log(`Pipeline Item: ${job.pipeline_item_id}`);
    console.log(`Created: ${job.created_at}`);
    console.log('');
  }

  // Check if multiple pipeline items reference the same story
  console.log('\n🔍 Checking for duplicate pipeline items...\n');
  
  const pipelineItemDupes = await db.execute(sql`
    SELECT 
      pi.id,
      pi.story_id,
      pi.story_hash,
      pi.canonical_source_url,
      pi.status,
      pi.target_post_id,
      pi.created_at,
      st.canonical_title
    FROM pipeline_items pi
    LEFT JOIN stories st ON pi.story_id = st.id
    WHERE pi.generated_title LIKE '%service charges%Dubai%'
    ORDER BY pi.created_at DESC
    LIMIT 10
  `);

  console.log(`Found ${pipelineItemDupes.rows.length} pipeline items:\n`);

  const storyHashMap = new Map<string, any[]>();

  for (const row of pipelineItemDupes.rows) {
    const item: any = row;
    const hash = item.story_hash || item.story_id;
    
    if (!storyHashMap.has(hash)) {
      storyHashMap.set(hash, []);
    }
    storyHashMap.get(hash)!.push(item);

    console.log(`Pipeline Item: ${item.id}`);
    console.log(`  Story ID: ${item.story_id}`);
    console.log(`  Story Hash: ${item.story_hash || 'MISSING ⚠️'}`);
    console.log(`  Canonical URL: ${item.canonical_source_url || 'MISSING ⚠️'}`);
    console.log(`  Status: ${item.status}`);
    console.log(`  WP Post ID: ${item.target_post_id || 'N/A'}`);
    console.log(`  Created: ${item.created_at}`);
    console.log('');
  }

  // Identify duplicates
  console.log('\n🚨 DUPLICATE DETECTION RESULTS:\n');
  
  for (const [hash, items] of storyHashMap.entries()) {
    if (items.length > 1) {
      console.log(`❌ DUPLICATE DETECTED - ${items.length} items share hash: ${hash}`);
      items.forEach((item, idx) => {
        console.log(`   [${idx + 1}] Item ${item.id} - Status: ${item.status}`);
      });
      console.log('');
    }
  }

  // Check idempotency enforcement
  console.log('\n🔍 Checking idempotency constraints...\n');
  
  const constraintCheck = await db.execute(sql`
    SELECT 
      conname as constraint_name,
      pg_get_constraintdef(c.oid) as constraint_definition
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE conname LIKE '%story_hash%' OR conname LIKE '%dedupe%'
  `);

  console.log(`Database constraints related to deduplication:`);
  for (const row of constraintCheck.rows) {
    const constraint: any = row;
    console.log(`  - ${constraint.constraint_name}: ${constraint.constraint_definition}`);
  }

  if (constraintCheck.rows.length === 0) {
    console.log('  ⚠️  NO DEDUPLICATION CONSTRAINTS FOUND!');
  }

  process.exit(0);
}

analyzeDuplicatePublishing().catch((err) => {
  console.error('❌ Analysis failed:', err);
  process.exit(1);
});

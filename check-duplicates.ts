import { db } from './server/db';

(async () => {
  try {
    // Check WP pull jobs for Kuwait egg prices article
    const wpJobs = await db.execute(`
      SELECT id, title, story_hash, status, result_wp_url, created_at, updated_at
      FROM wp_pull_jobs 
      WHERE title LIKE '%egg%' OR title LIKE '%Kuwait%'
      ORDER BY created_at DESC 
      LIMIT 20
    `);
    
    console.log('\n📄 WP Pull Jobs for Kuwait/egg articles:');
    console.log('Total found:', wpJobs.rows.length);
    
    const storyHashes = new Set();
    const duplicates = [];
    
    wpJobs.rows.forEach((job: any, idx: number) => {
      console.log(`\n${idx + 1}. ${job.title}`);
      console.log(`   ID: ${job.id}`);
      console.log(`   Story Hash: ${job.story_hash}`);
      console.log(`   Status: ${job.status}`);
      console.log(`   WP URL: ${job.result_wp_url || 'Not yet'}`);
      console.log(`   Created: ${job.created_at}`);
      
      if (storyHashes.has(job.story_hash)) {
        duplicates.push(job);
        console.log(`   ⚠️ DUPLICATE STORY HASH!`);
      } else {
        storyHashes.add(job.story_hash);
      }
    });
    
    if (duplicates.length > 0) {
      console.log(`\n\n❌ Found ${duplicates.length} duplicate jobs with same story hash!`);
      console.log('This indicates the deduplication check is not working.\n');
    }
    
    // Check pipeline items for the same story
    const pipelineItems = await db.execute(`
      SELECT id, generated_title, story_id, status, scheduled_for, created_at
      FROM pipeline_items
      WHERE generated_title LIKE '%egg%' OR generated_title LIKE '%Kuwait%'
      ORDER BY created_at DESC
      LIMIT 20
    `);
    
    console.log('\n📊 Pipeline Items for Kuwait/egg articles:');
    console.log('Total found:', pipelineItems.rows.length);
    
    const storyIds = new Set();
    const dupePipeline = [];
    
    pipelineItems.rows.forEach((item: any, idx: number) => {
      console.log(`\n${idx + 1}. ${item.generated_title}`);
      console.log(`   Story ID: ${item.story_id}`);
      console.log(`   Status: ${item.status}`);
      console.log(`   Scheduled: ${item.scheduled_for || 'Not yet'}`);
      console.log(`   Created: ${item.created_at}`);
      
      if (storyIds.has(item.story_id)) {
        dupePipeline.push(item);
        console.log(`   ⚠️ DUPLICATE STORY ID!`);
      } else {
        storyIds.add(item.story_id);
      }
    });
    
    if (dupePipeline.length > 0) {
      console.log(`\n\n❌ Found ${dupePipeline.length} duplicate pipeline items with same story ID!`);
      console.log('This indicates the same story is being processed multiple times.\n');
    }
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();

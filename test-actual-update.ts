import { db } from './server/db';
import { pipelineItems } from './shared/schema';
import { eq, sql } from 'drizzle-orm';

(async () => {
  console.log('\n=== Testing Update on ACTUAL Published Job Pipeline Items ===\n');
  
  // Get actual published job pipeline item IDs
  const publishedJobs = await db.execute(sql`
    SELECT id, pipeline_item_id, result_wp_post_id
    FROM wp_pull_jobs
    WHERE status = 'published'
    ORDER BY updated_at DESC
    LIMIT 1
  `);
  
  const job = publishedJobs.rows[0] as any;
  const testItemId = job.pipeline_item_id;
  const wpPostId = job.result_wp_post_id;
  
  console.log(`Testing with Pipeline Item ID: ${testItemId}`);
  console.log(`Should update to WP Post ID: ${wpPostId}\n`);
  
  // Get current state
  const before = await db.select().from(pipelineItems).where(eq(pipelineItems.id, testItemId));
  
  if (before.length === 0) {
    console.log('❌ Pipeline item NOT FOUND! This is the problem!');
    process.exit(1);
  }
  
  console.log('BEFORE:', {
    id: before[0].id.substring(0, 8),
    status: before[0].status,
    targetPostId: before[0].targetPostId,
    targetPermalink: before[0].targetPermalink?.substring(0, 50),
  });
  
  // Update like wp-pull-service does
  const [updated] = await db.update(pipelineItems)
    .set({
      status: "published",
      targetPostId: wpPostId?.toString(),
      targetPermalink: "https://test-update.com/test",
      publishedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(pipelineItems.id, testItemId))
    .returning();
  
  console.log('\nUPDATE returned:', {
    id: updated?.id.substring(0, 8),
    status: updated?.status,
    targetPostId: updated?.targetPostId,
    targetPermalink: updated?.targetPermalink?.substring(0, 50),
  });
  
  // Verify in DB
  const after = await db.select().from(pipelineItems).where(eq(pipelineItems.id, testItemId));
  
  console.log('\nAFTER (verified from DB):', {
    id: after[0].id.substring(0, 8),
    status: after[0].status,
    targetPostId: after[0].targetPostId,
    targetPermalink: after[0].targetPermalink?.substring(0, 50),
  });
  
  if (after[0].targetPostId === wpPostId?.toString()) {
    console.log('\n✅ UPDATE WORKS! The Drizzle ORM update is functioning correctly.');
    console.log('   This means wp-pull-service.ts callback handler SHOULD be working...');
    console.log('   Something else is preventing the update from happening.');
  } else {
    console.log('\n❌ UPDATE FAILED! Drizzle ORM not updating the field.');
  }
  
  // Roll back for clean state
  await db.update(pipelineItems)
    .set({
      status: before[0].status,
      targetPostId: before[0].targetPostId,
      targetPermalink: before[0].targetPermalink,
      publishedAt: before[0].publishedAt,
      updatedAt: new Date(),
    })
    .where(eq(pipelineItems.id, testItemId));
  
  console.log('✅ Rolled back to original state\n');
  
  process.exit(0);
})();

import { db } from './server/db';
import { pipelineItems } from './shared/schema';
import { eq } from 'drizzle-orm';

(async () => {
  const testItemId = '60e0576f-e07c-4e32-b14f-62be84077e93';
  
  console.log('\n=== Test Drizzle Update (like storage.ts does) ===\n');
  
  // Get current state
  const before = await db.select().from(pipelineItems).where(eq(pipelineItems.id, testItemId));
  console.log('BEFORE:', {
    id: before[0]?.id.substring(0, 8),
    status: before[0]?.status,
    targetPostId: before[0]?.targetPostId,
    targetPermalink: before[0]?.targetPermalink?.substring(0, 50),
  });
  
  // Update like storage.updatePipelineItem() does
  const [updated] = await db.update(pipelineItems)
    .set({
      status: "published",
      targetPostId: "999999",
      targetPermalink: "https://test.com/test",
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
  
  // Verify
  const after = await db.select().from(pipelineItems).where(eq(pipelineItems.id, testItemId));
  console.log('\nAFTER (verified):', {
    id: after[0]?.id.substring(0, 8),
    status: after[0]?.status,
    targetPostId: after[0]?.targetPostId,
    targetPermalink: after[0]?.targetPermalink?.substring(0, 50),
  });
  
  if (after[0]?.targetPostId === "999999") {
    console.log('\n✅ Update WORKED!');
  } else {
    console.log('\n❌ Update FAILED!');
  }
  
  // Rollback
  await db.update(pipelineItems)
    .set({
      status: "scheduled",
      targetPostId: null,
      updatedAt: new Date(),
    })
    .where(eq(pipelineItems.id, testItemId));
  
  console.log('✅ Rolled back\n');
  
  process.exit(0);
})();

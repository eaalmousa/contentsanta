import { db } from './server/db';
import { sql } from 'drizzle-orm';

(async () => {
  const testItemId = '60e0576f-e07c-4e32-b14f-62be84077e93'; // The first published job's pipeline item
  
  console.log('\n=== Test targetPostId Update ===\n');
  
  // Show current state
  const before = await db.execute(sql`
    SELECT id, status, target_post_id, target_permalink
    FROM pipeline_items
    WHERE id = ${testItemId}
  `);
  
  console.log('BEFORE:', before.rows[0]);
  
  // Try to update with camelCase (like the code does)
  try {
    const result = await db.execute(sql`
      UPDATE pipeline_items
      SET 
        status = 'published',
        target_post_id = '999999',
        target_permalink = 'https://test.com/test',
        updated_at = NOW()
      WHERE id = ${testItemId}
      RETURNING id, status, target_post_id, target_permalink
    `);
    
    console.log('\nUPDATE result:', result.rows[0]);
  } catch (error: any) {
    console.error('\n❌ UPDATE failed:', error.message);
  }
  
  // Check final state
  const after = await db.execute(sql`
    SELECT id, status, target_post_id, target_permalink
    FROM pipeline_items
    WHERE id = ${testItemId}
  `);
  
  console.log('\nAFTER:', after.rows[0]);
  
  // Rollback
  await db.execute(sql`
    UPDATE pipeline_items
    SET 
      status = 'scheduled',
      target_post_id = NULL,
      updated_at = NOW()
    WHERE id = ${testItemId}
  `);
  
  console.log('\n✅ Rolled back to original state\n');
  
  process.exit(0);
})();

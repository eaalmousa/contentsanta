import { db } from './server/db';

(async () => {
  try {
    console.log('\n🔧 Fixing stuck pipeline items...\n');
    
    // Find items stuck in publishing for more than 1 hour
    const result = await db.execute(`
      UPDATE pipeline_items
      SET status = 'scheduled', retry_count = 0
      WHERE status = 'publishing'
        AND scheduled_for < NOW() - INTERVAL '1 hour'
      RETURNING id, generated_title, status, scheduled_for
    `);
    
    if (result.rowCount === 0) {
      console.log('✅ No stuck items found - all clear!');
      process.exit(0);
    }
    
    console.log(`✅ Fixed ${result.rowCount} stuck item(s):\n`);
    result.rows.forEach((item: any, idx: number) => {
      console.log(`${idx + 1}. "${item.generated_title}"`);
      console.log(`   ID: ${item.id}`);
      console.log(`   New Status: scheduled`);
      console.log(`   Scheduled For: ${item.scheduled_for}`);
      console.log('');
    });
    
    console.log('✅ Items will be picked up by next publishing job (runs every 10 minutes)\n');
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();

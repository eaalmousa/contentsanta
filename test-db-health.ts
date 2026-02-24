import { db } from './server/db';

(async () => {
  try {
    const result = await db.execute('SELECT COUNT(*) as count FROM topics');
    console.log('✅ Database connected');
    console.log('Topics count:', result.rows[0].count);
    
    const sourcesResult = await db.execute('SELECT COUNT(*) as count FROM sources');
    console.log('Sources count:', sourcesResult.rows[0].count);
    
    const pipelineResult = await db.execute('SELECT COUNT(*) as count FROM pipeline_items');
    console.log('Pipeline items count:', pipelineResult.rows[0].count);
    
    console.log('\n✅ All database checks passed!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Database error:', error.message);
    process.exit(1);
  }
})();

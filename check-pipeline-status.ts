import { db } from './server/db';
import { pipelineItems } from './shared/schema';
import { eq, and } from 'drizzle-orm';

async function main() {
  const topicId = 'bd6befb5-bae7-4fcf-b75d-b0c6d32ebdac';
  
  const items = await db.select().from(pipelineItems).where(
    eq(pipelineItems.topicId, topicId)
  );
  
  const statusCounts = items.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  console.log('\n📊 Gulf Estate Gazette Topic Pipeline Status:');
  console.log(JSON.stringify(statusCounts, null, 2));
  
  const scheduled = items.filter(i => i.status === 'scheduled');
  console.log(`\n✅ Scheduled items: ${scheduled.length}`);
  if (scheduled.length > 0) {
    console.log('Sample scheduled item:', {
      id: scheduled[0].id,
      title: scheduled[0].generatedTitle,
      targetId: scheduled[0].targetId,
    });
  }
  
  process.exit(0);
}

main().catch(console.error);

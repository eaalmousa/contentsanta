import { db } from './server/db';
import { pipelineItems } from './shared/schema';
import { eq, and } from 'drizzle-orm';

(async () => {
  const items = await db.select({
    id: pipelineItems.id,
    title: pipelineItems.generatedTitle,
    scheduledFor: pipelineItems.scheduledFor,
  })
  .from(pipelineItems)
  .where(and(eq(pipelineItems.status, 'scheduled')))
  .orderBy(pipelineItems.scheduledFor)
  .limit(5);

  const now = new Date();
  
  console.log('\n📅 Next 5 scheduled items:\n');
  
  items.forEach((item, i) => {
    const diff = new Date(item.scheduledFor!).getTime() - now.getTime();
    const minutes = Math.floor(diff / 60000);
    console.log(`${i + 1}. ${item.title?.substring(0, 50)}...`);
    console.log(`   Publishes in ${minutes} minutes (${new Date(item.scheduledFor!).toLocaleTimeString()})\n`);
  });

  process.exit(0);
})();

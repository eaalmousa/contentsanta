import { db } from './server/db';
import { topics } from './shared/schema';
import { eq } from 'drizzle-orm';

(async () => {
  const result = await db.update(topics)
    .set({
      publishIntervalMinutes: 2,        // 2 minutes between articles
      minSpacingMinutes: 2,             // Update old field too (for backward compat)
      articlesPerRun: 1,                // 1 article at a time (not burst mode)
      runIntervalMinutes: 2,            // 2 minutes interval
    })
    .where(eq(topics.name, 'Real Estate'))
    .returning();

  console.log('✅ Topic updated:');
  console.log('publishIntervalMinutes:', result[0].publishIntervalMinutes);
  console.log('minSpacingMinutes:', result[0].minSpacingMinutes);
  console.log('articlesPerRun:', result[0].articlesPerRun);
  console.log('runIntervalMinutes:', result[0].runIntervalMinutes);
  
  process.exit(0);
})();

import { db } from './server/db';
import { topics } from './shared/schema';
import { eq } from 'drizzle-orm';

(async () => {
  const topic = await db.select().from(topics).where(eq(topics.name, 'Real Estate')).limit(1);
  console.log(JSON.stringify(topic[0], null, 2));
  process.exit(0);
})();

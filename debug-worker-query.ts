import { db } from './server/db';
import { pipelineItems } from './shared/schema';
import { eq, isNotNull, and, sql } from 'drizzle-orm';

async function main() {
  const topicId = 'bd6befb5-bae7-4fcf-b75d-b0c6d32ebdac';
  
  // Exact same query as publishing worker
  const items = await db.execute(sql`
    SELECT 
      pi.id,
      pi.topic_id,
      pi.workspace_id,
      pi.status,
      pi.target_id,
      pi.generated_title
    FROM pipeline_items pi
    LEFT JOIN topics t ON pi.topic_id = t.id
    LEFT JOIN stories s ON pi.story_id = s.id
    WHERE pi.status = 'scheduled'
      AND pi.target_id IS NOT NULL
    ORDER BY pi.created_at ASC
    LIMIT 10
  `);
  
  console.log(`\n🔍 Query returned: ${items.rows.length} items`);
  console.log(JSON.stringify(items.rows, null, 2));
  
  process.exit(0);
}

main().catch(console.error);

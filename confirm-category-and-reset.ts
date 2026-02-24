import { db } from './server/db';
import { publishingTargets, pipelineItems } from './shared/schema';
import { eq } from 'drizzle-orm';

async function confirmCategoryAndReset() {
  console.log('🔧 Confirming WordPress category and resetting quarantined items...\n');

  // 1. Update publishing target to confirm category
  const targetId = 'a51100b5-5be2-4906-877d-d3d3df4b3bca'; // Gulf Estate Gazette
  
  await db.update(publishingTargets)
    .set({
      configJson: {
        siteUrl: 'https://gulfestategazette.com',
        username: 'gulf',
        applicationPassword: 'w2bB NB8w a88G UTfj F5O4 v7bk',
        default_category_id: 1,
        default_category_id_confirmed: true  // ✅ Confirm category
      }
    })
    .where(eq(publishingTargets.id, targetId));

  console.log('✅ Category ID 1 confirmed for Gulf Estate Gazette target');

  // 2. Reset quarantined items back to scheduled
  const result = await db.update(pipelineItems)
    .set({
      status: 'scheduled',
      lastErrorMessage: null,
      retryCount: 0,
      quarantineReason: null
    })
    .where(eq(pipelineItems.status, 'quarantined'))
    .returning({ id: pipelineItems.id });

  console.log(`✅ Reset ${result.length} quarantined items back to scheduled status`);
  console.log('\n📋 Items will be processed by publishing worker in next 3-minute cycle');
  console.log('   Watch the Pipeline → Publishing tab for status updates');
  
  process.exit(0);
}

confirmCategoryAndReset().catch(console.error);

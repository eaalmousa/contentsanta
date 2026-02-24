import { db } from './server/db';
import { topics, pipelineItems } from './shared/schema';
import { eq, and, like } from 'drizzle-orm';

async function checkLanguageFiltering() {
  console.log("🔍 Checking language filtering issue...\n");
  
  // 1. Check topic settings
  const realEstateTopic = await db
    .select()
    .from(topics)
    .where(like(topics.name, '%Real Estate%'))
    .limit(1);
  
  if (realEstateTopic.length === 0) {
    console.log("❌ No 'Real Estate' topic found");
    return;
  }
  
  const topic = realEstateTopic[0];
  console.log("📋 Topic Settings:");
  console.log(`   ID: ${topic.id}`);
  console.log(`   Name: ${topic.name}`);
  console.log(`   Language: ${topic.language}`);
  console.log(`   Automation: ${topic.automationEnabled ? 'Enabled' : 'Disabled'}`);
  console.log(`   Keywords: ${JSON.stringify(topic.keywords)}`);
  
  // 2. Check pipeline items for this topic
  const items = await db
    .select()
    .from(pipelineItems)
    .where(eq(pipelineItems.topicId, topic.id))
    .limit(20);
  
  console.log(`\n📊 Pipeline Items: ${items.length} total`);
  
  // Detect language from titles
  const arabicRegex = /[\u0600-\u06FF]/;
  const arabicItems = items.filter(item => arabicRegex.test(item.title || ''));
  const englishItems = items.filter(item => !arabicRegex.test(item.title || ''));
  
  console.log(`   Arabic items: ${arabicItems.length}`);
  console.log(`   English items: ${englishItems.length}`);
  
  if (arabicItems.length > 0) {
    console.log("\n🚨 ARABIC ITEMS FOUND (should be filtered):");
    arabicItems.slice(0, 5).forEach((item, i) => {
      console.log(`\n${i + 1}. ${item.title?.substring(0, 80)}...`);
      console.log(`   State: ${item.state}`);
      console.log(`   Skip Reason: ${item.skipReason || 'None'}`);
      console.log(`   Source: ${item.canonicalSourceUrl?.substring(0, 60)}...`);
    });
  }
  
  console.log("\n🔍 Checking where language filtering happens...");
  
  // 3. Check if items have language metadata
  const itemsWithMetadata = items.filter(i => i.metadata);
  console.log(`\n📝 Items with metadata: ${itemsWithMetadata.length}/${items.length}`);
  
  if (itemsWithMetadata.length > 0) {
    const sample = itemsWithMetadata[0];
    console.log("\nSample metadata structure:");
    console.log(JSON.stringify(sample.metadata, null, 2).substring(0, 500));
  }
}

checkLanguageFiltering()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Error:", err);
    process.exit(1);
  });

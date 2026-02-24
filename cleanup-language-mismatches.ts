import { db } from './server/db';
import { pipelineItems, topics } from './shared/schema';
import { sql, eq, and, ne } from 'drizzle-orm';

// Language detection function (same as in pipeline-jobs-service.ts)
function detectLanguage(text: string): string {
  if (!text) return 'unknown';
  
  const arabicRegex = /[\u0600-\u06FF]/;
  const arabicMatches = (text.match(arabicRegex) || []).length;
  const totalChars = text.length;
  const arabicRatio = arabicMatches / totalChars;
  
  if (arabicRatio > 0.3) return 'ar';
  if (arabicRatio < 0.1) return 'en';
  return 'mixed';
}

async function cleanupArabicItems() {
  console.log("🧹 Cleaning up Arabic items in English-only topics...\n");
  
  // Find all topics with language requirements
  const allTopics = await db.select().from(topics);
  
  for (const topic of allTopics) {
    if (!topic.language) {
      console.log(`⏭️  Skipping topic "${topic.name}" - no language requirement`);
      continue;
    }
    
    console.log(`\n📋 Processing topic: "${topic.name}" (requires: ${topic.language})`);
    
    // Find all items for this topic that are NOT skipped
    const items = await db
      .select()
      .from(pipelineItems)
      .where(
        and(
          eq(pipelineItems.topicId, topic.id),
          ne(pipelineItems.status, 'skipped')
        )
      );
    
    console.log(`   Total active items: ${items.length}`);
    
    let skipped = 0;
    let kept = 0;
    
    for (const item of items) {
      if (!item.generatedTitle) {
        console.log(`   ⚠️  Item ${item.id} has no title - skipping check`);
        continue;
      }
      
      const detectedLanguage = detectLanguage(item.generatedTitle);
      
      if (detectedLanguage !== topic.language && detectedLanguage !== 'unknown') {
        console.log(`   🚫 Skipping: "${item.generatedTitle.substring(0, 60)}..."`);
        console.log(`      Detected: ${detectedLanguage}, Required: ${topic.language}`);
        
        await db
          .update(pipelineItems)
          .set({
            status: 'skipped',
            skipReason: `Language mismatch (detected: ${detectedLanguage}, required: ${topic.language})`,
            lastErrorMessage: `Language mismatch: expected ${topic.language}, got ${detectedLanguage}`,
            languageDetected: detectedLanguage,
            updatedAt: new Date(),
          })
          .where(eq(pipelineItems.id, item.id));
        
        skipped++;
      } else {
        // Update language_detected for items that pass
        await db
          .update(pipelineItems)
          .set({
            languageDetected: detectedLanguage,
            updatedAt: new Date(),
          })
          .where(eq(pipelineItems.id, item.id));
        
        kept++;
      }
    }
    
    console.log(`   ✅ ${kept} items kept, ${skipped} items skipped`);
  }
  
  console.log("\n✅ Cleanup complete!");
}

cleanupArabicItems()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("❌ Error:", err);
    process.exit(1);
  });

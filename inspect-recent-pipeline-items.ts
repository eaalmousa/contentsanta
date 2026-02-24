import { db } from './server/db';
import { pipelineItems } from './shared/schema';
import { desc, eq } from 'drizzle-orm';

async function inspectRecentItems() {
  console.log("🔍 Inspecting recent pipeline items...\n");
  
  // Get the most recent 10 items across ALL topics
  const recent = await db
    .select()
    .from(pipelineItems)
    .orderBy(desc(pipelineItems.createdAt))
    .limit(30);
  
  console.log(`Found ${recent.length} recent items:\n`);
  
  const arabicRegex = /[\u0600-\u06FF]/;
  
  recent.forEach((item, i) => {
    const isArabic = arabicRegex.test(item.title || '');
    const lang = isArabic ? '🇦🇪 AR' : '🇬🇧 EN';
    
    console.log(`${i + 1}. ${lang} | ${item.state} | ${item.title?.substring(0, 60)}...`);
    console.log(`   Topic ID: ${item.topicId}`);
    console.log(`   Created: ${item.createdAt}`);
    console.log(`   Skip Reason: ${item.skipReason || 'N/A'}`);
    console.log(``);
  });
  
  // Group by state and language
  const byStateAndLang: Record<string, { arabic: number; english: number }> = {};
  
  recent.forEach(item => {
    const state = item.state;
    const isArabic = arabicRegex.test(item.title || '');
    
    if (!byStateAndLang[state]) {
      byStateAndLang[state] = { arabic: 0, english: 0 };
    }
    
    if (isArabic) {
      byStateAndLang[state].arabic++;
    } else {
      byStateAndLang[state].english++;
    }
  });
  
  console.log("\n📊 Summary by State:");
  Object.entries(byStateAndLang).forEach(([state, counts]) => {
    console.log(`   ${state}: ${counts.arabic} Arabic, ${counts.english} English`);
  });
}

inspectRecentItems()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Error:", err);
    process.exit(1);
  });

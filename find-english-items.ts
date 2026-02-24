import { db } from './server/db';

(async () => {
  try {
    // Check topic language setting
    const topicResult = await db.execute(`
      SELECT id, name, language 
      FROM topics 
      WHERE name = 'Real Estate'
    `);
    
    const topic = topicResult.rows[0];
    console.log('\n📌 TOPIC LANGUAGE CONFIGURATION');
    console.log(`Topic: ${topic.name}`);
    console.log(`Language: ${topic.language || 'NOT SET'}`);
    
    // Check pipeline items and their story languages
    const items = await db.execute(`
      SELECT id, generated_title, story_id, status
      FROM pipeline_items
      WHERE topic_id = '${topic.id}'
        AND status IN ('ranked', 'matched')
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    console.log(`\n📊 PIPELINE ITEMS (${items.rows.length} samples)`);
    console.log('='.repeat(80));
    
    let arabicCount = 0;
    let englishCount = 0;
    let unknownCount = 0;
    
    for (const item of items.rows) {
      const storyResult = await db.execute(`
        SELECT canonical_title, language, canonical_url
        FROM stories
        WHERE id = '${item.story_id}'
      `);
      
      const story = storyResult.rows[0];
      const lang = story?.language || 'UNKNOWN';
      
      // Detect if title contains Arabic characters
      const hasArabic = /[\u0600-\u06FF]/.test(story?.canonical_title || '');
      
      if (lang === 'ar' || hasArabic) {
        arabicCount++;
        console.log(`\n❌ ARABIC DETECTED`);
      } else if (lang === 'en') {
        englishCount++;
        console.log(`\n✅ English`);
      } else {
        unknownCount++;
        console.log(`\n❓ Unknown (${lang})`);
      }
      
      console.log(`   Title: ${story?.canonical_title?.substring(0, 100)}...`);
      console.log(`   Language Field: ${lang}`);
      console.log(`   Has Arabic Chars: ${hasArabic ? 'YES' : 'NO'}`);
      console.log(`   Status: ${item.status}`);
    }
    
    console.log('\n\n' + '='.repeat(80));
    console.log('📈 SUMMARY');
    console.log('='.repeat(80));
    console.log(`Arabic items: ${arabicCount}`);
    console.log(`English items: ${englishCount}`);
    console.log(`Unknown: ${unknownCount}`);
    
    if (arabicCount > 0) {
      console.log(`\n⚠️ ISSUE: ${arabicCount} Arabic items found in pipeline despite topic language = ${topic.language}`);
      console.log('   Root cause: Language filtering is not working correctly\n');
    }
    
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();

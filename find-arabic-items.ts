import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function findArabicItems() {
  console.log("🔍 Finding Arabic items in pipeline...\n");
  
  // Find items with Arabic text in generated_title
  const arabicItems = await db.execute(sql`
    SELECT 
      id, 
      generated_title, 
      status, 
      skip_reason,
      language_detected,
      created_at
    FROM pipeline_items 
    WHERE generated_title ~ '[\u0600-\u06FF]'
    ORDER BY created_at DESC
    LIMIT 20
  `);
  
  console.log(`Found ${arabicItems.rows.length} items with Arabic text:\n`);
  
  arabicItems.rows.forEach((row: any, i) => {
    console.log(`${i + 1}. ${row.generated_title?.substring(0, 80)}...`);
    console.log(`   Status: ${row.status}`);
    console.log(`   Language Detected: ${row.language_detected}`);
    console.log(`   Skip Reason: ${row.skip_reason || 'NONE - NOT SKIPPED!'}`);
    console.log(`   Created: ${row.created_at}`);
    console.log('');
  });
  
  // Count by status
  const arabicByStatus = await db.execute(sql`
    SELECT status, COUNT(*) as count
    FROM pipeline_items 
    WHERE generated_title ~ '[\u0600-\u06FF]'
    GROUP BY status
  `);
  
  console.log("\n📊 Arabic items by status:");
  arabicByStatus.rows.forEach((row: any) => {
    console.log(`   ${row.status}: ${row.count}`);
  });
  
  // Find items that are NOT skipped but are Arabic
  const notSkipped = await db.execute(sql`
    SELECT 
      id, 
      generated_title, 
      status, 
      skip_reason
    FROM pipeline_items 
    WHERE generated_title ~ '[\u0600-\u06FF]'
      AND status != 'skipped'
    ORDER BY created_at DESC
    LIMIT 10
  `);
  
  if (notSkipped.rows.length > 0) {
    console.log(`\n\n🚨 PROBLEM: ${notSkipped.rows.length} Arabic items are NOT skipped:`);
    notSkipped.rows.forEach((row: any, i) => {
      console.log(`\n${i + 1}. ${row.generated_title?.substring(0, 80)}...`);
      console.log(`   Status: ${row.status} (should be 'skipped')`);
      console.log(`   Skip Reason: ${row.skip_reason || 'MISSING!'}`);
    });
  } else {
    console.log("\n✅ All Arabic items are properly skipped");
  }
}

findArabicItems()
  .then(() => process.exit(0))
  .catch(err => {
    console.error("Error:", err);
    process.exit(1);
  });

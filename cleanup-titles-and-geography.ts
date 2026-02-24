import { db } from './server/db';
import { sql } from 'drizzle-orm';
import { contentSanitizer } from './server/services/content-sanitizer';

async function cleanupTitlesAndGeography() {
  console.log('🧹 Cleaning up pipeline items: titles and geographic filtering...\n');

  // Step 1: Fix titles with "Seo Blog" suffix
  console.log('📝 Step 1: Finding and fixing titles with suffixes...');
  
  const itemsWithBadTitles = await db.execute(sql`
    SELECT id, generated_title
    FROM pipeline_items
    WHERE generated_title LIKE '%– Seo Blog%'
       OR generated_title LIKE '%- Seo Blog%'
       OR generated_title LIKE '% | Seo Blog%'
  `);

  console.log(`Found ${itemsWithBadTitles.rows.length} items with title suffix issues\n`);

  for (const row of itemsWithBadTitles.rows) {
    const item: any = row;
    const cleanedTitle = contentSanitizer.cleanTitle(item.generated_title);
    
    console.log(`  Before: ${item.generated_title}`);
    console.log(`  After:  ${cleanedTitle}`);
    console.log('');

    await db.execute(sql`
      UPDATE pipeline_items 
      SET generated_title = ${cleanedTitle}, 
          updated_at = NOW()
      WHERE id = ${item.id}
    `);
  }

  console.log(`✅ Fixed ${itemsWithBadTitles.rows.length} titles\n`);

  // Step 2: Find items from non-GCC sources in GCC topics
  console.log('🌍 Step 2: Finding geographic mismatches...');
  
  const gccTopics = await db.execute(sql`
    SELECT id, name
    FROM topics
    WHERE region = 'gcc'
  `);

  if (gccTopics.rows.length === 0) {
    console.log('No GCC topics found, skipping geographic check\n');
    process.exit(0);
  }

  let totalMismatches = 0;

  for (const topicRow of gccTopics.rows) {
    const topic: any = topicRow;
    
    console.log(`\nChecking topic: ${topic.name}`);
    
    const mismatchedItems = await db.execute(sql`
      SELECT 
        pi.id,
        pi.generated_title,
        pi.status,
        src.country,
        src.name as source_name
      FROM pipeline_items pi
      LEFT JOIN stories st ON pi.story_id = st.id
      LEFT JOIN story_items si ON si.story_id = st.id
      LEFT JOIN source_items sitem ON si.source_item_id = sitem.id
      LEFT JOIN sources src ON sitem.source_id = src.id
      WHERE pi.topic_id = ${topic.id}
        AND src.country IS NOT NULL
        AND UPPER(src.country) NOT IN ('AE', 'SA', 'KW', 'QA', 'BH', 'OM')
        AND pi.status NOT IN ('quarantined', 'skipped')
    `);

    console.log(`  Found ${mismatchedItems.rows.length} items from non-GCC sources`);
    totalMismatches += mismatchedItems.rows.length;

    for (const row of mismatchedItems.rows) {
      const item: any = row;
      
      console.log(`    ❌ ${item.country} (${item.source_name}): ${item.generated_title?.substring(0, 60)}...`);
      
      // Quarantine the item
      await db.execute(sql`
        UPDATE pipeline_items
        SET status = 'quarantined',
            quarantine_reason = 'geographic_mismatch',
            last_error_message = ${'Source from ' + item.country + ' (' + item.source_name + ') not allowed in GCC-only topic'},
            updated_at = NOW()
        WHERE id = ${item.id}
      `);
    }

    console.log(`  ✅ Quarantined ${mismatchedItems.rows.length} geographic mismatches`);
  }

  // Step 3: Fix WordPress pull jobs that already have bad titles
  console.log('\n📦 Step 3: Fixing WordPress pull job titles...');
  
  const wpJobsWithBadTitles = await db.execute(sql`
    SELECT id, title
    FROM wp_pull_jobs
    WHERE title LIKE '%– Seo Blog%'
       OR title LIKE '%- Seo Blog%'
       OR title LIKE '% | Seo Blog%'
  `);

  console.log(`Found ${wpJobsWithBadTitles.rows.length} WP jobs with bad titles`);

  for (const row of wpJobsWithBadTitles.rows) {
    const job: any = row;
    const cleanedTitle = contentSanitizer.cleanTitle(job.title);
    
    await db.execute(sql`
      UPDATE wp_pull_jobs
      SET title = ${cleanedTitle},
          updated_at = NOW()
      WHERE id = ${job.id}
    `);
  }

  console.log(`✅ Fixed ${wpJobsWithBadTitles.rows.length} WP job titles\n`);

  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Cleanup Complete!\n');
  console.log(`  Titles cleaned: ${itemsWithBadTitles.rows.length}`);
  console.log(`  WP jobs cleaned: ${wpJobsWithBadTitles.rows.length}`);
  console.log(`  Geographic mismatches quarantined: ${totalMismatches}`);
  console.log('\n🔄 Server restart NOT required - fixes apply immediately');
  
  process.exit(0);
}

cleanupTitlesAndGeography().catch((err) => {
  console.error('❌ Cleanup failed:', err);
  process.exit(1);
});

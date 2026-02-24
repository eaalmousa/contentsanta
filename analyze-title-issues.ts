import { db } from './server/db';
import { pipelineItems, stories, topics } from './shared/schema';
import { eq, like, sql } from 'drizzle-orm';

async function analyzeTitleIssues() {
  console.log('🔍 Analyzing title and geographic filtering issues...\n');

  // Issue 1: Title suffix problem
  console.log('📋 Issue 1: Items with title suffix problem');
  const titleIssues = await db.execute(sql`
    SELECT 
      pi.id,
      pi.generated_title,
      pi.status,
      st.canonical_title as story_title,
      src.name as source_name,
      src.country
    FROM pipeline_items pi
    LEFT JOIN stories st ON pi.story_id = st.id
    LEFT JOIN story_items si ON si.story_id = st.id
    LEFT JOIN source_items sitem ON si.source_item_id = sitem.id
    LEFT JOIN sources src ON sitem.source_id = src.id
    WHERE pi.generated_title LIKE '%– Seo Blog%'
       OR pi.generated_title LIKE '%– Gulf News – Seo Blog%'
    LIMIT 5
  `);

  console.log('Found:', titleIssues.rows.length, 'items');
  titleIssues.rows.forEach((row: any, i: number) => {
    console.log(`\n[${i + 1}] Generated Title: ${row.generated_title}`);
    console.log(`    Story Title: ${row.story_title}`);
    console.log(`    Source: ${row.source_name}`);
    console.log(`    Country: ${row.country}`);
    console.log(`    Status: ${row.status}`);
  });

  // Issue 2: Geographic filtering
  console.log('\n\n📋 Issue 2: Items from wrong geographic region');
  
  // Get GCC topic
  const gccTopics = await db.select({
    id: topics.id,
    name: topics.name,
    region: topics.region,
    countries: topics.countries
  }).from(topics).where(eq(topics.region, 'gcc'));

  if (gccTopics.length === 0) {
    console.log('❌ No GCC topics found');
    process.exit(0);
  }

  const gccTopic = gccTopics[0];
  console.log(`\nTopic: ${gccTopic.name}`);
  console.log(`Region: ${gccTopic.region}`);
  console.log(`Countries: ${JSON.stringify(gccTopic.countries)}`);

  // Find items from non-GCC countries
  const wrongRegionItems = await db.execute(sql`
    SELECT 
      pi.id,
      pi.generated_title,
      pi.status,
      st.canonical_title as story_title,
      src.name as source_name,
      src.country
    FROM pipeline_items pi
    LEFT JOIN stories st ON pi.story_id = st.id
    LEFT JOIN story_items si ON si.story_id = st.id
    LEFT JOIN source_items sitem ON si.source_item_id = sitem.id
    LEFT JOIN sources src ON sitem.source_id = src.id
    WHERE pi.topic_id = ${gccTopic.id}
      AND src.country NOT IN ('AE', 'SA', 'KW', 'QA', 'BH', 'OM')
      AND src.country IS NOT NULL
    LIMIT 10
  `);

  console.log('\nFound:', wrongRegionItems.rows.length, 'items from non-GCC countries');
  wrongRegionItems.rows.forEach((row: any, i: number) => {
    console.log(`\n[${i + 1}] Title: ${row.generated_title}`);
    console.log(`    Country: ${row.country} ❌ (NOT in GCC)`);
    console.log(`    Source: ${row.source_name}`);
    console.log(`    Status: ${row.status}`);
  });

  // Check if India articles exist
  const indiaItems = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM pipeline_items pi
    LEFT JOIN stories st ON pi.story_id = st.id
    LEFT JOIN story_items si ON si.story_id = st.id
    LEFT JOIN source_items sitem ON si.source_item_id = sitem.id
    LEFT JOIN sources src ON sitem.source_id = src.id
    WHERE pi.topic_id = ${gccTopic.id}
      AND (src.country = 'IN' OR src.name LIKE '%India%')
  `);

  console.log(`\n🔍 India-related articles in GCC topic: ${(indiaItems.rows[0] as any).count}`);

  process.exit(0);
}

analyzeTitleIssues().catch(console.error);

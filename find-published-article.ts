import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function findPublishedArticle() {
  console.log('🔍 Searching for the published Dubai article...\n');

  // Search by partial title match
  const items = await db.execute(sql`
    SELECT 
      pi.id,
      pi.generated_title,
      pi.status,
      pi.target_post_id,
      pi.target_permalink,
      st.canonical_title
    FROM pipeline_items pi
    LEFT JOIN stories st ON pi.story_id = st.id
    WHERE pi.generated_title LIKE '%service charges%Dubai%'
    LIMIT 5
  `);

  console.log(`Found ${items.rows.length} matching items:\n`);

  for (const row of items.rows) {
    const item: any = row;
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📝 Generated Title: ${item.generated_title}`);
    console.log(`📰 Story Title: ${item.canonical_title}`);
    console.log(`📊 Status: ${item.status}`);
    console.log(`🔗 WP Post ID: ${item.target_post_id || 'N/A'}`);
    console.log(`🌐 Permalink: ${item.target_permalink || 'N/A'}`);
    
    // Check for title suffix issues
    if (item.generated_title && (item.generated_title.includes('– Seo Blog') || item.generated_title.includes('Gulf News –'))) {
      console.log('⚠️  ISSUE: Title contains source attribution suffix!');
    }
    console.log('');
  }

  // Also check wp_pull_jobs for the published article
  console.log('\n🔍 Checking WordPress pull jobs...\n');
  const wpJobs = await db.execute(sql`
    SELECT 
      wpj.id,
      wpj.title,
      wpj.status,
      wpj.wp_post_id,
      wpj.created_at
    FROM wp_pull_jobs wpj
    WHERE wpj.title LIKE '%service charges%Dubai%'
    ORDER BY wpj.created_at DESC
    LIMIT 5
  `);

  console.log(`Found ${wpJobs.rows.length} WordPress jobs:\n`);
  for (const row of wpJobs.rows) {
    const job: any = row;
    console.log(`📋 Job: ${job.title}`);
    console.log(`   Status: ${job.status} | WP Post ID: ${job.wp_post_id || 'N/A'} | Created: ${job.created_at}`);
    
    if (job.title && (job.title.includes('– Seo Blog') || job.title.includes('Gulf News –'))) {
      console.log('   ⚠️  ISSUE: WordPress job title has suffix!');
    }
    console.log('');
  }

  process.exit(0);
}

findPublishedArticle().catch(console.error);

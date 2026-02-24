import { db } from './server/db';
import { sql } from 'drizzle-orm';

(async () => {
  console.log('\n=== Current Status Check ===\n');
  
  // Check articles with Google logo
  const googleLogoItems = await db.execute(sql`
    SELECT id, status, title, featured_image_url
    FROM pipeline_items
    WHERE featured_image_url LIKE '%googleusercontent%'
    ORDER BY updated_at DESC
    LIMIT 10
  `);
  
  console.log(`📸 Articles with Google Logo: ${googleLogoItems.rows.length}`);
  if (googleLogoItems.rows.length > 0) {
    googleLogoItems.rows.forEach((item: any) => {
      console.log(`   [${item.status}] ${item.title.substring(0, 60)}...`);
    });
  }
  
  // Check WP jobs
  const wpJobs = await db.execute(sql`
    SELECT 
      COUNT(*) FILTER (WHERE status = 'queued') as queued,
      COUNT(*) FILTER (WHERE lease_token IS NOT NULL) as leased,
      COUNT(*) FILTER (WHERE status = 'completed') as completed
    FROM wp_pull_jobs
  `);
  
  const jobs = wpJobs.rows[0] as any;
  console.log(`\n📋 WP Pull Jobs:`);
  console.log(`   Queued: ${jobs.queued}`);
  console.log(`   Leased (being processed): ${jobs.leased}`);
  console.log(`   Completed: ${jobs.completed}`);
  
  // Check pipeline status distribution
  const pipelineStatus = await db.execute(sql`
    SELECT status, COUNT(*) as count
    FROM pipeline_items
    GROUP BY status
    ORDER BY count DESC
  `);
  
  console.log(`\n🔄 Pipeline Status:`);
  pipelineStatus.rows.forEach((row: any) => {
    console.log(`   ${row.status}: ${row.count}`);
  });
  
  // Check if publishing worker is working
  const recentPublished = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM pipeline_items
    WHERE status = 'published'
      AND updated_at > NOW() - INTERVAL '10 minutes'
  `);
  
  const recentCount = (recentPublished.rows[0] as any).count;
  console.log(`\n✅ Recently Published (last 10 min): ${recentCount}`);
  
  if (jobs.queued > 0 && jobs.leased === 0) {
    console.log('\n❌ ISSUE: Jobs are queued but not being pulled by WordPress');
    console.log('   → WordPress cron is NOT running automatically');
    console.log('   → Run: .\\trigger-wp-pull.ps1');
  } else if (jobs.leased > 0) {
    console.log('\n✅ WordPress IS pulling jobs automatically!');
  }
  
  if (googleLogoItems.rows.length > 0) {
    console.log('\n🔧 To reset articles with Google logos to republish:');
    console.log('   → Run: npx tsx --env-file=.env reset-google-logo-articles.ts');
  }
  
  process.exit(0);
})();

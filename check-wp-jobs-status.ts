import { db } from './server/db';
import { sql } from 'drizzle-orm';

(async () => {
  console.log('\n=== WordPress Pull Jobs Status ===\n');
  
  const jobs = await db.execute(sql`
    SELECT 
      COUNT(*) FILTER (WHERE status = 'queued') as queued,
      COUNT(*) FILTER (WHERE lease_token IS NOT NULL AND lease_token != '') as leased,
      COUNT(*) FILTER (WHERE status = 'completed') as completed
    FROM wp_pull_jobs
  `);
  
  const j = jobs.rows[0] as any;
  console.log(`Queued (waiting to be pulled): ${j.queued}`);
  console.log(`Leased (WordPress processing): ${j.leased}`);
  console.log(`Completed (finished): ${j.completed}`);
  
  if (j.queued > 0 && j.leased === 0) {
    console.log('\n❌ PROBLEM: Jobs queued but not being pulled');
    console.log('   WordPress cron is NOT running');
    console.log('   Manual pull works, but automatic doesn\'t');
  } else if (j.leased > 0) {
    console.log('\n✅ WordPress IS actively pulling jobs!');
  } else if (j.queued === 0) {
    console.log('\n✅ No jobs in queue (all caught up)');
  }
  
  // Check recent jobs
  const recent = await db.execute(sql`
    SELECT id, status, created_at, lease_token
    FROM wp_pull_jobs
    ORDER BY created_at DESC
    LIMIT 5
  `);
  
  console.log('\nRecent jobs:');
  recent.rows.forEach((row: any) => {
    const leased = row.lease_token ? '(leased)' : '';
    console.log(`  ${row.id.substring(0, 8)} - ${row.status} ${leased}`);
  });
  
  // Check Google logo articles
  const googleArticles = await db.execute(sql`
    SELECT id, status, generated_title, featured_image_url
    FROM pipeline_items
    WHERE featured_image_url LIKE '%googleusercontent%'
    ORDER BY updated_at DESC
    LIMIT 5
  `);
  
  console.log('\n=== Articles with Google Logo (showing 5) ===\n');
  googleArticles.rows.forEach((row: any) => {
    console.log(`[${row.status}] ${row.generated_title?.substring(0, 60) || 'No title'}...`);
  });
  
  console.log('\n📝 Actions:');
  if (j.queued > 0) {
    console.log('1. Reset Google logo articles: npx tsx --env-file=.env reset-google-logo-articles.ts');
    console.log('2. Start auto-trigger: .\\trigger-wp-pull.ps1');
  } else {
    console.log('1. Reset Google logo articles: npx tsx --env-file=.env reset-google-logo-articles.ts');
    console.log('2. Wait 3 minutes for publishing worker to create new jobs');
  }
  
  process.exit(0);
})();

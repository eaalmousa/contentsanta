import { db } from './server/db';

(async () => {
  try {
    console.log('\n📊 PIPELINE HEALTH CHECK\n');
    console.log('='.repeat(60));
    
    // 1. Check Topics
    console.log('\n1️⃣ TOPICS');
    const topics = await db.execute(`
      SELECT 
        id, name, is_live, workspace_id,
        output_volume_per_day, publish_interval_minutes,
        articles_per_run, automation_mode
      FROM topics
    `);
    
    console.log(`Total topics: ${topics.rows.length}\n`);
    topics.rows.forEach((topic: any) => {
      console.log(`📌 ${topic.name}`);
      console.log(`   ID: ${topic.id}`);
      console.log(`   Live: ${topic.is_live ? '✅ Yes' : '❌ No'}`);
      console.log(`   Workspace: ${topic.workspace_id}`);
      console.log(`   Daily Cap: ${topic.output_volume_per_day}/day`);
      console.log(`   Interval: ${topic.publish_interval_minutes} min`);
      console.log(`   Per Run: ${topic.articles_per_run}`);
      console.log(`   Automation: ${topic.automation_mode}`);
      console.log('');
    });
    
    // 2. Check Sources for Topics
    console.log('\n2️⃣ SOURCES (Linked to Topics)');
    const sources = await db.execute(`
      SELECT 
        s.id, s.name, s.is_active, s.workspace_id,
        COUNT(ts.topic_id) as topic_count
      FROM sources s
      LEFT JOIN topic_sources ts ON s.id = ts.source_id
      WHERE s.workspace_id IN (SELECT workspace_id FROM topics)
      GROUP BY s.id, s.name, s.is_active, s.workspace_id
      ORDER BY topic_count DESC
    `);
    
    console.log(`Total sources: ${sources.rows.length}`);
    const activeSources = sources.rows.filter((s: any) => s.is_active);
    const linkedSources = sources.rows.filter((s: any) => s.topic_count > 0);
    console.log(`Active: ${activeSources.length}`);
    console.log(`Linked to topics: ${linkedSources.length}\n`);
    
    linkedSources.slice(0, 5).forEach((source: any) => {
      console.log(`📡 ${source.name}`);
      console.log(`   Active: ${source.is_active ? '✅' : '❌'}`);
      console.log(`   Topics: ${source.topic_count}`);
      console.log('');
    });
    
    // 3. Check Pipeline Items
    console.log('\n3️⃣ PIPELINE ITEMS (By Status)');
    const pipeline = await db.execute(`
      SELECT 
        status,
        COUNT(*) as count,
        MAX(created_at) as last_created
      FROM pipeline_items
      WHERE topic_id IN (SELECT id FROM topics)
      GROUP BY status
      ORDER BY count DESC
    `);
    
    console.log('Status breakdown:');
    pipeline.rows.forEach((row: any) => {
      const emoji = {
        'fetched': '📥',
        'matched': '🎯',
        'generated': '✍️',
        'gated': '✅',
        'scheduled': '⏰',
        'publishing': '📤',
        'published': '✨',
        'failed': '❌',
        'quarantined': '🚫',
        'skipped': '⏭️'
      }[row.status] || '❓';
      
      const lastDate = row.last_created ? new Date(row.last_created).toISOString().split('T')[0] : 'N/A';
      console.log(`   ${emoji} ${row.status.padEnd(15)} ${String(row.count).padStart(4)} items (last: ${lastDate})`);
    });
    
    // 4. Check Publishing Targets
    console.log('\n4️⃣ PUBLISHING TARGETS');
    const targets = await db.execute(`
      SELECT 
        id, name, type, is_active,
        wp_site_url, default_post_status
      FROM publishing_targets
      WHERE workspace_id IN (SELECT workspace_id FROM topics)
    `);
    
    console.log(`Total targets: ${targets.rows.length}\n`);
    targets.rows.forEach((target: any) => {
      console.log(`🎯 ${target.name}`);
      console.log(`   Type: ${target.type}`);
      console.log(`   Active: ${target.is_active ? '✅' : '❌'}`);
      console.log(`   Site: ${target.wp_site_url}`);
      console.log(`   Post Status: ${target.default_post_status}`);
      console.log('');
    });
    
    // 5. Check WP Pull Jobs
    console.log('\n5️⃣ WP PULL JOBS (Recent)');
    const wpJobs = await db.execute(`
      SELECT 
        status,
        COUNT(*) as count,
        MAX(created_at) as last_created
      FROM wp_pull_jobs
      WHERE target_id IN (SELECT id FROM publishing_targets)
      GROUP BY status
      ORDER BY count DESC
    `);
    
    console.log('Status breakdown:');
    wpJobs.rows.forEach((row: any) => {
      const emoji = {
        'queued': '⏳',
        'leased': '🔒',
        'completed': '✅',
        'failed': '❌'
      }[row.status] || '❓';
      
      const lastDate = row.last_created ? new Date(row.last_created).toISOString().split('T')[0] : 'N/A';
      console.log(`   ${emoji} ${row.status.padEnd(10)} ${String(row.count).padStart(4)} jobs (last: ${lastDate})`);
    });
    
    // 6. Check Background Jobs Status
    console.log('\n6️⃣ BACKGROUND JOBS');
    console.log('✅ Background jobs configured in server (check server logs for execution)\n');
    console.log('Expected jobs:');
    console.log('   - RSS Fetch: every 30 minutes');
    console.log('   - Topic Discovery: every 20 minutes');
    console.log('   - Pipeline Automation: every 10 minutes');
    console.log('   - WP Pull Lease Cleanup: every 2 minutes');
    console.log('   - Reaper: every 5 minutes');
    
    // 7. Summary
    console.log('\n\n' + '='.repeat(60));
    console.log('📋 SUMMARY');
    console.log('='.repeat(60));
    
    const liveTopics = topics.rows.filter((t: any) => t.is_live);
    const scheduledItems = pipeline.rows.find((r: any) => r.status === 'scheduled')?.count || 0;
    const publishingItems = pipeline.rows.find((r: any) => r.status === 'publishing')?.count || 0;
    
    console.log(`\n✅ Topics: ${liveTopics.length} live (${topics.rows.length} total)`);
    console.log(`✅ Active Sources: ${activeSources.length}/${sources.rows.length}`);
    console.log(`✅ Pipeline Items: ${pipeline.rows.reduce((sum: number, r: any) => sum + Number(r.count), 0)} total`);
    console.log(`   ⏰ Scheduled: ${scheduledItems}`);
    console.log(`   📤 Publishing: ${publishingItems}`);
    console.log(`✅ Publishing Targets: ${targets.rows.filter((t: any) => t.is_active).length}/${targets.rows.length} active`);
    console.log(`✅ WP Jobs: ${wpJobs.rows.reduce((sum: number, r: any) => sum + Number(r.count), 0)} total`);
    
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();

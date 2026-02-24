import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function checkJobStatus() {
  console.log('🔍 Checking WP pull job status...\n');

  const jobs = await db.execute(sql`
    SELECT 
      id,
      title,
      status,
      created_at,
      updated_at,
      lease_token,
      lease_expires_at,
      pipeline_item_id
    FROM wp_pull_jobs
    WHERE status = 'queued'
    ORDER BY created_at DESC
    LIMIT 10
  `);

  console.log(`Found ${jobs.rows.length} queued jobs:\n`);

  jobs.rows.forEach((j: any) => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Job: ${j.id}`);
    console.log(`Title: ${j.title?.substring(0, 70)}...`);
    console.log(`Status: ${j.status}`);
    console.log(`Created: ${j.created_at}`);
    console.log(`Updated: ${j.updated_at}`);
    console.log(`Leased: ${j.lease_token ? 'YES ✅' : 'NO ❌'}`);
    console.log(`Lease Expires: ${j.lease_expires_at || 'N/A'}`);
    console.log(`Pipeline Item: ${j.pipeline_item_id}`);
    console.log('');
  });

  // Check plugin activity logs
  console.log('\n📊 Checking plugin request logs (last 10)...\n');
  
  const logs = await db.execute(sql`
    SELECT 
      created_at,
      endpoint,
      reason,
      http_status,
      request_summary,
      response_summary
    FROM plugin_request_log
    ORDER BY created_at DESC
    LIMIT 10
  `);

  if (logs.rows.length === 0) {
    console.log('❌ NO PLUGIN ACTIVITY LOGS FOUND!');
    console.log('   This means WordPress plugin is not calling the server at all.');
  } else {
    logs.rows.forEach((log: any) => {
      console.log(`${log.created_at}: ${log.endpoint} - ${log.reason} (HTTP ${log.http_status})`);
      if (log.request_summary) console.log(`  Request: ${log.request_summary}`);
      if (log.response_summary) console.log(`  Response: ${log.response_summary}`);
      console.log('');
    });
  }

  process.exit(0);
}

checkJobStatus().catch((err) => {
  console.error('❌ Check failed:', err);
  process.exit(1);
});

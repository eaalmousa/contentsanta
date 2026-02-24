import { db } from './server/db';
import { wpPluginRequestLogs } from './shared/schema';
import { desc } from 'drizzle-orm';

async function checkLogs() {
  console.log("🔍 Checking plugin request logs...\n");
  
  const logs = await db.select().from(wpPluginRequestLogs)
    .orderBy(desc(wpPluginRequestLogs.createdAt))
    .limit(50);
  
  console.log(`Found ${logs.length} recent plugin requests:\n`);
  
  const pullRequests = logs.filter(l => l.endpoint === 'pull' && l.reason === 'JOB_LEASED');
  const reportRequests = logs.filter(l => l.endpoint === 'report');
  
  console.log(`📥 Pull requests (job leased): ${pullRequests.length}`);
  console.log(`📤 Report requests (callback): ${reportRequests.length}\n`);
  
  if (pullRequests.length > 0) {
    console.log("Recent pull requests:");
    pullRequests.slice(0, 10).forEach((log, idx) => {
      console.log(`${idx + 1}. ${log.createdAt?.toLocaleString()}`);
      console.log(`   Summary: ${log.requestSummary}`);
      console.log(`   Response: ${log.responseSummary}`);
      console.log('');
    });
  }
  
  if (reportRequests.length > 0) {
    console.log("\nRecent report callbacks:");
    reportRequests.slice(0, 10).forEach((log, idx) => {
      console.log(`${idx + 1}. ${log.createdAt?.toLocaleString()}`);
      console.log(`   Summary: ${log.requestSummary}`);
      console.log(`   Response: ${log.responseSummary}`);
      console.log(`   HTTP Status: ${log.httpStatus}`);
      console.log('');
    });
  }
  
  // Check for patterns of repeated job IDs
  const jobIdPattern = /jobId=([a-f0-9-]+)/;
  const jobIdCounts = new Map<string, number>();
  
  pullRequests.forEach(log => {
    const match = log.responseSummary?.match(jobIdPattern);
    if (match) {
      const jobId = match[1];
      jobIdCounts.set(jobId, (jobIdCounts.get(jobId) || 0) + 1);
    }
  });
  
  console.log("\n📊 Job ID frequency (pull requests):");
  jobIdCounts.forEach((count, jobId) => {
    if (count > 1) {
      console.log(`⚠️  Job ${jobId.substring(0, 8)}... was pulled ${count} times`);
    } else {
      console.log(`✓ Job ${jobId.substring(0, 8)}... pulled once`);
    }
  });
}

checkLogs().then(() => process.exit(0)).catch(err => {
  console.error("Error:", err);
  process.exit(1);
});

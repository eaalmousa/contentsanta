import { db } from './server/db';
import { wpPullJobs } from './shared/schema';
import { eq } from 'drizzle-orm';

async function markJobFailed() {
  const jobId = 'f50ebbd2-6adb-4d1f-a2f9-9d26931a8a07';
  
  await db.update(wpPullJobs)
    .set({ 
      status: 'failed',
      leaseToken: null,
      leaseExpiresAt: null,
      resultError: 'Callback failed - base URL not configured in WordPress plugin. Job created duplicate posts.',
      updatedAt: new Date()
    })
    .where(eq(wpPullJobs.id, jobId));
  
  console.log(`✅ Job ${jobId} marked as failed`);
  console.log(`   This prevents it from being pulled again.`);
  console.log(`\n⚠️  Next: Configure Base URL in WordPress plugin settings!`);
}

markJobFailed().then(() => process.exit(0)).catch(console.error);

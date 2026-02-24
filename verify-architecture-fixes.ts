/**
 * Comprehensive verification test using fixed exports and reliable methods
 */

import { db } from "./server/storage";
import { sql } from "drizzle-orm";

async function runVerification() {
  console.log("\n=== ARCHITECTURE FIXES - COMPREHENSIVE VERIFICATION ===\n");
  
  try {
    // 1. Database Idempotency Check
    console.log("1️⃣ Testing Database-Level Idempotency\n");
    
    // Check unique index exists
    const indexCheck = await db.execute(sql`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'automation_job_runs' 
        AND indexname = 'idx_automation_job_runs_active_unique'
    `);
    
    if (indexCheck.rows.length > 0) {
      console.log("   ✅ Unique partial index EXISTS");
      console.log(`   Index: ${indexCheck.rows[0].indexname}`);
      console.log(`   Definition: ${indexCheck.rows[0].indexdef}\n`);
    } else {
      console.log("   ❌ MISSING: Unique partial index not found!\n");
    }
    
    // 2. Reaper Index Check
    console.log("2️⃣ Testing Reaper Index\n");
    
    const reaperIndexCheck = await db.execute(sql`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'automation_job_runs' 
        AND indexname = 'idx_automation_job_runs_stale_running'
    `);
    
    if (reaperIndexCheck.rows.length > 0) {
      console.log("   ✅ Reaper index EXISTS");
      console.log(`   Index: ${reaperIndexCheck.rows[0].indexname}\n`);
    } else {
      console.log("   ❌ MISSING: Reaper index not found!\n");
    }
    
    // 3. Topics Table - lastRunStatus Column
    console.log("3️⃣ Testing Topics Table Schema\n");
    
    const columnCheck = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'topics' 
        AND column_name = 'last_run_status'
    `);
    
    if (columnCheck.rows.length > 0) {
      console.log("   ✅ last_run_status column EXISTS");
      console.log(`   Type: ${columnCheck.rows[0].data_type}\n`);
    } else {
      console.log("   ❌ MISSING: last_run_status column not found!\n");
    }
    
    // 4. Active Jobs Check (should be 0 in healthy system)
    console.log("4️⃣ Testing Active Job Count\n");
    
    const activeJobs = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM automation_job_runs 
      WHERE status IN ('queued', 'running')
    `);
    
    const count = parseInt(activeJobs.rows[0]?.count || '0');
    if (count === 0) {
      console.log("   ✅ No stuck jobs (count: 0)\n");
    } else {
      console.log(`   ⚠️ WARNING: ${count} active jobs found\n`);
    }
    
    // 5. Stale Jobs Check (reaper effectiveness)
    console.log("5️⃣ Testing for Stale Running Jobs\n");
    
    const staleJobs = await db.execute(sql`
      SELECT COUNT(*) as count 
      FROM automation_job_runs 
      WHERE status = 'running' 
        AND started_at < NOW() - INTERVAL '10 minutes'
        AND ended_at IS NULL
    `);
    
    const staleCount = parseInt(staleJobs.rows[0]?.count || '0');
    if (staleCount === 0) {
      console.log("   ✅ No stale jobs (reaper working correctly)\n");
    } else {
      console.log(`   ❌ FOUND ${staleCount} stale jobs (reaper may not be working)\n`);
    }
    
    // 6. Job Success Rate
    console.log("6️⃣ Testing Job Success Rate (Last 24 Hours)\n");
    
    const jobStats = await db.execute(sql`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'success') as success_count,
        COUNT(*) FILTER (WHERE status = 'fail') as fail_count,
        COUNT(*) FILTER (WHERE status = 'timeout') as timeout_count,
        COUNT(*) as total
      FROM automation_job_runs 
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `);
    
    const stats = jobStats.rows[0];
    const successRate = stats.total > 0 
      ? ((parseInt(stats.success_count) / parseInt(stats.total)) * 100).toFixed(1)
      : '0.0';
    
    console.log(`   Total jobs: ${stats.total}`);
    console.log(`   Success: ${stats.success_count} (${successRate}%)`);
    console.log(`   Failed: ${stats.fail_count}`);
    console.log(`   Timeout: ${stats.timeout_count}`);
    
    if (parseInt(stats.timeout_count) === 0) {
      console.log("   ✅ Zero timeouts (system healthy)\n");
    } else {
      console.log(`   ⚠️ ${stats.timeout_count} timeouts detected\n`);
    }
    
    // 7. Topic Status Consistency
    console.log("7️⃣ Testing Topic Status Consistency\n");
    
    const topicStatusCheck = await db.execute(sql`
      SELECT DISTINCT status FROM topics
    `);
    
    const statuses = topicStatusCheck.rows.map(r => r.status);
    const invalidStatuses = statuses.filter(s => !['draft', 'live', 'paused'].includes(s));
    
    if (invalidStatuses.length === 0) {
      console.log(`   ✅ All topic statuses valid: ${statuses.join(', ')}\n`);
    } else {
      console.log(`   ❌ INVALID statuses found: ${invalidStatuses.join(', ')}\n`);
    }
    
    // Summary
    console.log("=== VERIFICATION SUMMARY ===\n");
    
    const allPassed = 
      indexCheck.rows.length > 0 &&
      reaperIndexCheck.rows.length > 0 &&
      columnCheck.rows.length > 0 &&
      count === 0 &&
      staleCount === 0 &&
      invalidStatuses.length === 0;
    
    if (allPassed) {
      console.log("✅ ALL CHECKS PASSED - System is production-ready\n");
    } else {
      console.log("⚠️ SOME CHECKS FAILED - Review output above\n");
    }
    
    process.exit(allPassed ? 0 : 1);
    
  } catch (error: any) {
    console.error("\n❌ VERIFICATION FAILED:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runVerification();

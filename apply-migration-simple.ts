/**
 * Apply migration statements individually
 */

import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function runMigration() {
  try {
    console.log('[Migration] Starting...');
    
    // 1. Add last_run_status column
    console.log('[Migration] Adding last_run_status column...');
    await db.execute(sql`
      ALTER TABLE topics 
      ADD COLUMN IF NOT EXISTS last_run_status TEXT
    `);
    console.log('[Migration] ✅ Column added');
    
    // 2. Create unique partial index
    console.log('[Migration] Creating unique partial index...');
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_job_runs_active_unique 
      ON automation_job_runs (topic_id, job_type) 
      WHERE status IN ('queued', 'running')
    `);
    console.log('[Migration] ✅ Unique index created');
    
    // 3. Create reaper index
    console.log('[Migration] Creating reaper index...');
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_automation_job_runs_stale_running 
      ON automation_job_runs (status, started_at) 
      WHERE status = 'running'
    `);
    console.log('[Migration] ✅ Reaper index created');
    
    // 4. Update existing topics
    console.log('[Migration] Updating existing topics...');
    const result = await db.execute(sql`
      UPDATE topics 
      SET status = CASE 
        WHEN is_live = 'true' THEN 'live'
        ELSE 'paused'
      END
      WHERE status IS NULL OR status NOT IN ('draft', 'live', 'paused')
    `);
    console.log(`[Migration] ✅ Updated ${result.rowCount} topics`);
    
    console.log('[Migration] 🎉 All migrations applied successfully!');
    
    process.exit(0);
  } catch (error: any) {
    console.error('[Migration] ❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runMigration();

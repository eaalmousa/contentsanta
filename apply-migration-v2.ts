/**
 * Apply migration: idempotency and reaper support
 */

import { db } from './server/db';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  try {
    console.log('[Migration] Reading migration file...');
    
    const migrationPath = path.join(__dirname, 'db', 'migrations', '20260128120000_add_idempotency_and_reaper.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    console.log('[Migration] Applying migration: add_idempotency_and_reaper');
    
    await db.execute(sql.raw(migrationSQL));
    
    console.log('[Migration] ✅ Migration applied successfully!');
    
    // Verify the unique index
    const result = await db.execute(sql`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = 'automation_job_runs' 
      AND indexname = 'idx_automation_job_runs_active_unique'
    `);
    
    console.log('[Migration] Verified unique index:');
    console.table(result.rows);
    
    process.exit(0);
  } catch (error: any) {
    console.error('[Migration] ❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runMigration();

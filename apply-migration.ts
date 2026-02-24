/**
 * Run database migration
 * Usage: tsx --import=dotenv/config apply-migration.ts
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
    
    const migrationPath = path.join(__dirname, 'db', 'migrations', '20260128112959_add_topic_status_state_machine.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    console.log('[Migration] Applying migration: add_topic_status_state_machine');
    console.log('[Migration] SQL length:', migrationSQL.length, 'bytes');
    
    // Execute the migration
    await db.execute(sql.raw(migrationSQL));
    
    console.log('[Migration] ✅ Migration applied successfully!');
    
    // Verify the changes
    const result = await db.execute(sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'topics' 
      AND column_name IN ('status', 'last_run_id', 'first_run_at', 'last_error')
      ORDER BY column_name
    `);
    
    console.log('[Migration] Verified new columns:');
    console.table(result.rows);
    
    process.exit(0);
  } catch (error: any) {
    console.error('[Migration] ❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runMigration();

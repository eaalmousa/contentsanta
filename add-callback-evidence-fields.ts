import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function addCallbackEvidenceFields() {
  console.log("=== ADDING CALLBACK EVIDENCE FIELDS TO wp_pull_jobs ===\n");

  try {
    // Check if columns already exist
    const existingCols = await db.execute(sql`
      SELECT column_name 
      FROM information_schema.columns
      WHERE table_name = 'wp_pull_jobs'
        AND column_name IN (
          'callback_image_http_code',
          'callback_image_bytes',
          'callback_wp_attachment_id',
          'callback_set_thumbnail_ok',
          'callback_error_step',
          'callback_error_details'
        )
    `);

    const existing = existingCols.rows.map((r: any) => r.column_name);
    console.log(`Found ${existing.length} existing callback columns\n`);

    // Add columns if they don't exist
    const columnsToAdd = [
      { name: 'callback_image_http_code', type: 'INTEGER', desc: 'HTTP response code when downloading image' },
      { name: 'callback_image_bytes', type: 'INTEGER', desc: 'Size of downloaded image in bytes' },
      { name: 'callback_wp_attachment_id', type: 'INTEGER', desc: 'WordPress attachment ID for featured image' },
      { name: 'callback_set_thumbnail_ok', type: 'BOOLEAN', desc: 'Whether set_post_thumbnail succeeded' },
      { name: 'callback_error_step', type: 'TEXT', desc: 'Which step failed (download/upload/attachment/thumbnail)' },
      { name: 'callback_error_details', type: 'TEXT', desc: 'Detailed error message from WordPress' }
    ];

    for (const col of columnsToAdd) {
      if (!existing.includes(col.name)) {
        console.log(`Adding column: ${col.name} (${col.type})`);
        console.log(`  Purpose: ${col.desc}`);
        
        await db.execute(sql.raw(`
          ALTER TABLE wp_pull_jobs 
          ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}
        `));
        
        console.log(`  ✅ Added\n`);
      } else {
        console.log(`✓ Column ${col.name} already exists\n`);
      }
    }

    console.log("✅ Migration complete!\n");
    console.log("═══════════════════════════════════════════════");
    console.log("CALLBACK EVIDENCE FIELDS ADDED:");
    console.log("═══════════════════════════════════════════════");
    console.log("These fields will store detailed image pipeline evidence:");
    console.log("1. callback_image_http_code - HTTP response (200=success)");
    console.log("2. callback_image_bytes - Downloaded file size");
    console.log("3. callback_wp_attachment_id - WordPress media library ID");
    console.log("4. callback_set_thumbnail_ok - Featured image set?");
    console.log("5. callback_error_step - Which step failed");
    console.log("6. callback_error_details - Error message");
    console.log("═══════════════════════════════════════════════\n");

  } catch (error: any) {
    console.error("\n❌ MIGRATION ERROR:", error.message);
    console.error(error);
    process.exit(1);
  }

  process.exit(0);
}

addCallbackEvidenceFields().catch(console.error);

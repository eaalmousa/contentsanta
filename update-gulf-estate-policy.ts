import "dotenv/config";
import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function updateGulfEstateTargetPolicy() {
  console.log("\n🔧 Updating Gulf Estate Gazette target to english_only mode...\n");

  // Find Gulf Estate Gazette target
  const targetResult = await db.execute(sql`
    SELECT id, name, language_mode, allowed_languages, require_featured_image
    FROM publishing_targets
    WHERE name ILIKE '%Gulf Estate%'
  `);

  if (targetResult.rows.length === 0) {
    console.log("❌ Gulf Estate Gazette target not found");
    return;
  }

  const target = targetResult.rows[0] as any;
  
  console.log("📋 BEFORE update:");
  console.table([{
    id: target.id.substring(0, 8),
    name: target.name,
    language_mode: target.language_mode,
    allowed_languages: target.allowed_languages,
    require_featured_image: target.require_featured_image,
  }]);

  // Update to english_only
  await db.execute(sql`
    UPDATE publishing_targets
    SET 
      language_mode = 'english_only',
      allowed_languages = ARRAY['en']::text[]
    WHERE id = ${target.id}
  `);

  // Verify update
  const verifyResult = await db.execute(sql`
    SELECT id, name, language_mode, allowed_languages, require_featured_image
    FROM publishing_targets
    WHERE id = ${target.id}
  `);

  const updated = verifyResult.rows[0] as any;
  
  console.log("\n📋 AFTER update:");
  console.table([{
    id: updated.id.substring(0, 8),
    name: updated.name,
    language_mode: updated.language_mode,
    allowed_languages: updated.allowed_languages,
    require_featured_image: updated.require_featured_image,
  }]);

  console.log("\n✅ Gulf Estate Gazette now enforces English-only + featured images");
  
  // Check how many existing pipeline items would be quarantined
  const arabicItemsResult = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM pipeline_items
    WHERE target_id = ${target.id}
      AND status = 'scheduled'
      AND (generated_title ~* '[\u0600-\u06FF]' OR generated_body ~* '[\u0600-\u06FF]')
  `);

  const arabicCount = (arabicItemsResult.rows[0] as any).count;
  
  console.log(`\n⚠️  Warning: ${arabicCount} existing scheduled items contain Arabic text and will be quarantined on next publish attempt`);
}

updateGulfEstateTargetPolicy().catch(console.error);

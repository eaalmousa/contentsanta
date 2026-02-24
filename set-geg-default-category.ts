import { db } from "./server/db";
import { publishingTargets, wpTaxonomyCache } from "./shared/schema";
import { eq, and } from "drizzle-orm";

async function setDefaultCategory() {
  console.log("🔧 Setting default category for Gulf Estate Gazette...\n");

  const targetId = "8be2881b-9b51-4ef4-9ab1-94a3b05d5398";

  // 1. Get the target
  const [target] = await db
    .select()
    .from(publishingTargets)
    .where(eq(publishingTargets.id, targetId))
    .limit(1);

  if (!target) {
    console.error("❌ Target not found");
    return;
  }

  console.log(`Target: ${target.name}`);
  console.log(`Current config:`, target.configJson);

  // 2. Get available categories
  const categories = await db
    .select()
    .from(wpTaxonomyCache)
    .where(
      and(
        eq(wpTaxonomyCache.publishingTargetId, targetId),
        eq(wpTaxonomyCache.taxonomyType, "category")
      )
    );

  console.log(`\nAvailable categories (${categories.length}):`);
  for (const cat of categories) {
    console.log(`  [${cat.wpId}] ${cat.name} (${cat.count} posts)`);
  }

  if (categories.length === 0) {
    console.error("\n❌ No categories found. Run sync-categories first.");
    return;
  }

  // 3. Find "Uncategorized" or use the first category
  let defaultCat = categories.find(c => 
    c.name.toLowerCase() === "uncategorized" || 
    c.slug === "uncategorized"
  );
  
  if (!defaultCat) {
    defaultCat = categories[0];
  }

  console.log(`\n✅ Using "${defaultCat.name}" (ID: ${defaultCat.wpId}) as default category`);

  // 4. Update the target config
  const newConfig = {
    ...(target.configJson as any || {}),
    default_category_id: defaultCat.wpId,
    default_category_id_confirmed: true,
    default_category_name: defaultCat.name,
  };

  await db
    .update(publishingTargets)
    .set({
      configJson: newConfig,
    })
    .where(eq(publishingTargets.id, targetId));

  console.log(`\n✅ Default category set successfully!`);
  console.log(`New config:`, newConfig);
  console.log(`\n⚠️ Now restart the server and retry publishing.`);
}

setDefaultCategory().catch(console.error);

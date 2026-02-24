import { db } from "./server/db";
import { publishingTargets } from "./shared/schema";
import { eq } from "drizzle-orm";

async function restoreRealEstateNewsCategory() {
  console.log("🔧 Restoring 'Real Estate News' as default category...\n");

  const targetId = "8be2881b-9b51-4ef4-9ab1-94a3b05d5398";

  // Update to use "Real Estate News" (ID: 35) which was the original setting
  const newConfig = {
    apiKey: "",
    apiUrl: "",
    siteUrl: "https://gulfestategazette.com",
    username: "gulf",
    applicationPassword: "lidh sLvV aIZ4 E4Ud geEB 3hd3",
    default_category_id: 35,  // Real Estate News
    default_category_id_confirmed: true,
    default_category_name: "Real Estate News",
  };

  await db
    .update(publishingTargets)
    .set({
      configJson: newConfig,
    })
    .where(eq(publishingTargets.id, targetId));

  console.log(`✅ Default category restored to "Real Estate News" (ID: 35)`);
  console.log(`Config:`, newConfig);
}

restoreRealEstateNewsCategory().catch(console.error);

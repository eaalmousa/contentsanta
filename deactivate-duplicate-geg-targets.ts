import "dotenv/config";
import { db } from "./server/db";
import { publishingTargets } from "./shared/schema";
import { eq } from "drizzle-orm";

/**
 * Deactivate duplicate Gulf Estate Gazette targets
 * Keep only the production target (33a2681e-ddaf-40c8-836f-e44a990afad6)
 */

async function deactivateDuplicates() {
  const duplicateIds = [
    "9710fc55-7a2d-45bf-b262-e07a6a3bd570",  // 0 items
    "c6d84528-b797-4167-a4cd-f42c64ec6dc1",  // 0 items
  ];

  console.log("\n⚠️  Deactivating duplicate Gulf Estate Gazette targets...\n");

  for (const id of duplicateIds) {
    await db
      .update(publishingTargets)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(publishingTargets.id, id));

    console.log(`✅ Deactivated target: ${id}`);
  }

  console.log("\n✅ SUCCESS: Duplicate targets deactivated");
  console.log("   Active target: 33a2681e-ddaf-40c8-836f-e44a990afad6 (production, 41 items)\n");

  process.exit(0);
}

deactivateDuplicates();

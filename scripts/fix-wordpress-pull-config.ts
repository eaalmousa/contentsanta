
import "dotenv/config";
import { db } from "../server/db";
import { publishingTargets } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

async function main() {
    const targets = await db.select().from(publishingTargets).where(eq(publishingTargets.type, "wordpress_pull"));
    const target = targets[0];

    if (!target) {
        console.error("No wordpress_pull target found");
        process.exit(1);
    }

    const config = target.configJson as any;

    // Set default category to 'Real Estate News' (ID: 35)
    const newConfig = {
        ...config,
        default_category_id: 35,
        default_category_id_confirmed: true
    };

    console.log("Updating target configuration...");
    console.log("Old Config:", JSON.stringify(config, null, 2));
    console.log("New Config:", JSON.stringify(newConfig, null, 2));

    await db.update(publishingTargets)
        .set({ configJson: newConfig })
        .where(eq(publishingTargets.id, target.id));

    console.log("✅ Update complete. The quarantined items should be retried now.");

    process.exit(0);
}

main().catch(console.error);

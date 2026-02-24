
import "dotenv/config";
import { db } from "../server/db";
import { publishingTargets } from "@shared/schema";
import { eq } from "drizzle-orm";

async function main() {
    const targets = await db.select().from(publishingTargets).where(eq(publishingTargets.type, "wordpress_pull"));

    console.log("Found", targets.length, "wordpress_pull targets");

    targets.forEach(t => {
        console.log(`Target: ${t.name} (ID: ${t.id})`);
        console.log("Config:", JSON.stringify(t.configJson, null, 2));
        console.log("---");
    });

    process.exit(0);
}

main().catch(console.error);

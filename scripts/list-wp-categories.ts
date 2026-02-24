
import "dotenv/config";
import { db } from "../server/db";
import { publishingTargets } from "@shared/schema";
import { eq } from "drizzle-orm";

async function main() {
    const targets = await db.select().from(publishingTargets).where(eq(publishingTargets.type, "wordpress_pull"));
    const target = targets[0];

    if (!target) {
        console.error("No wordpress_pull target found");
        process.exit(1);
    }

    const config = target.configJson as any;
    const url = config.siteUrl;
    const username = config.username;
    const password = config.applicationPassword;

    if (!url || !username || !password) {
        console.error("Missing credentials in config");
        process.exit(1);
    }

    console.log(`Connecting to ${url} as ${username}...`);

    const auth = Buffer.from(`${username}:${password}`).toString("base64");

    try {
        const res = await fetch(`${url}/wp-json/wp/v2/categories?per_page=100`, {
            headers: {
                "Authorization": `Basic ${auth}`
            }
        });

        if (!res.ok) {
            console.error(`Failed to fetch categories: ${res.status} ${res.statusText}`);
            const text = await res.text();
            console.error(text);
            process.exit(1);
        }

        const categories = await res.json();
        console.log("Categories found:", categories.length);
        categories.forEach((c: any) => {
            console.log(`${c.id}: ${c.name} (slug: ${c.slug})`);
        });

    } catch (error) {
        console.error("Error fetching categories:", error);
    }

    process.exit(0);
}

main().catch(console.error);

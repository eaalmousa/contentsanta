import * as dotenv from "dotenv";
dotenv.config();

import { db } from "./server/db";
import { publishingTargets } from "./shared/schema";

async function checkTargets() {
  const targets = await db.select().from(publishingTargets);
  console.log(JSON.stringify(targets, null, 2));
  process.exit(0);
}

checkTargets().catch(console.error);

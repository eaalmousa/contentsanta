import "dotenv/config";
import { migrateToMultiSite } from "./db/migrations/add-multi-site-support";

migrateToMultiSite()
  .then(() => {
    console.log("\n✅ Migration complete!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ Migration failed:", err);
    process.exit(1);
  });

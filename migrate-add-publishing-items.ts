#!/usr/bin/env tsx
/**
 * Migration: Add publishing_items table
 * 
 * Purpose: Separate publishing pipeline from discovery pipeline
 * - Publishing items track items handed off from pipeline for publishing operations
 * - Allows independent publishing workflow with its own statuses
 */

import { db } from "./server/db";
import { sql } from "drizzle-orm";

async function migrate() {
  console.log("🚀 Starting migration: Add publishing_items table\n");

  try {
    // Create publishing_items table
    console.log("1. Creating publishing_items table...");
    
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS publishing_items (
        id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
        
        -- Core references
        pipeline_item_id VARCHAR(36) NOT NULL UNIQUE REFERENCES pipeline_items(id) ON DELETE CASCADE,
        topic_id VARCHAR(36) REFERENCES topics(id) ON DELETE CASCADE,
        workspace_id VARCHAR(36) NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        
        -- Publishing status
        status TEXT NOT NULL DEFAULT 'draft_ready',
        
        -- Scheduling
        scheduled_at TIMESTAMP,
        
        -- WordPress connector info
        wp_connector_id VARCHAR(36) REFERENCES publishing_targets(id),
        wp_post_id TEXT,
        published_url TEXT,
        
        -- Error tracking
        last_error TEXT,
        attempt_count INTEGER DEFAULT 0,
        
        -- Metadata
        handed_off_at TIMESTAMP DEFAULT NOW(),
        published_at TIMESTAMP,
        verified_at TIMESTAMP,
        
        -- Timestamps
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
    
    console.log("   ✅ Table created\n");

    // Create indexes
    console.log("2. Creating indexes...");
    
    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_publishing_items_pipeline_item 
      ON publishing_items(pipeline_item_id);
    `);
    console.log("   ✅ Unique index on pipeline_item_id");

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_publishing_items_status 
      ON publishing_items(status);
    `);
    console.log("   ✅ Index on status");

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_publishing_items_scheduled 
      ON publishing_items(scheduled_at);
    `);
    console.log("   ✅ Index on scheduled_at");

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_publishing_items_connector 
      ON publishing_items(wp_connector_id);
    `);
    console.log("   ✅ Index on wp_connector_id");

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_publishing_items_topic 
      ON publishing_items(topic_id);
    `);
    console.log("   ✅ Index on topic_id");

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS idx_publishing_items_workspace 
      ON publishing_items(workspace_id);
    `);
    console.log("   ✅ Index on workspace_id\n");

    console.log("=" .repeat(60));
    console.log("✅ Migration completed successfully!");
    console.log("=".repeat(60));
    console.log("\nNext steps:");
    console.log("  1. Restart server to load new schema");
    console.log("  2. Use handoffToPublishing() to move items to publishing pipeline");
    console.log("  3. View publishing items in /pipeline Publishing tab");
    console.log("");

  } catch (error: any) {
    if (error.message?.includes('already exists')) {
      console.log("✅ Table and indexes already exist - migration already applied");
    } else {
      console.error("❌ Migration failed:", error.message);
      throw error;
    }
  }
}

migrate()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });

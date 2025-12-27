import { pgTable, text, varchar, timestamp, jsonb, integer, numeric, index, unique, uniqueIndex, boolean } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export auth models (required for Replit Auth)
export * from "./models/auth";

// Role types for workspace permissions
export const roleTypes = ["owner", "admin", "editor", "reviewer", "viewer"] as const;
export type RoleType = typeof roleTypes[number];

// Workspaces
export const workspaces = pgTable("workspaces", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  planId: text("plan_id"),
  features: jsonb("features").default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWorkspaceSchema = createInsertSchema(workspaces).omit({ id: true, createdAt: true });
export type InsertWorkspace = z.infer<typeof insertWorkspaceSchema>;
export type Workspace = typeof workspaces.$inferSelect;

// Workspace features for premium entitlements
export interface WorkspaceFeatures {
  generate_images?: boolean;
  // Future feature flags can be added here
}

// Helper to check if workspace has a feature enabled
export function hasWorkspaceFeature(workspace: Workspace | null | undefined, feature: keyof WorkspaceFeatures): boolean {
  if (!workspace) return false;
  const features = workspace.features as WorkspaceFeatures | null;
  return !!features?.[feature];
}

// Workspace Users (multi-tenant permissions)
export const workspaceUsers = pgTable("workspace_users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  role: text("role").notNull().$type<RoleType>().default("viewer"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique("workspace_user_unique").on(table.workspaceId, table.userId),
  index("idx_workspace_users_workspace").on(table.workspaceId),
]);

export const insertWorkspaceUserSchema = createInsertSchema(workspaceUsers).omit({ id: true, createdAt: true });
export type InsertWorkspaceUser = z.infer<typeof insertWorkspaceUserSchema>;
export type WorkspaceUser = typeof workspaceUsers.$inferSelect;

// Brands
export const brands = pgTable("brands", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id", { length: 36 }).notNull(),
  name: text("name").notNull(),
  defaultLanguage: text("default_language").default("en"),
  brandRulesJson: jsonb("brand_rules_json").default({}),
  industry: text("industry"),
  audience: text("audience"),
  tone: text("tone"),
  approvedTerms: text("approved_terms").array(),
  forbiddenWords: text("forbidden_words").array(),
  styleRules: text("style_rules"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique("brand_workspace_name_unique").on(table.workspaceId, table.name),
  index("idx_brands_workspace").on(table.workspaceId),
]);

export const insertBrandSchema = createInsertSchema(brands).omit({ id: true, createdAt: true });
export type InsertBrand = z.infer<typeof insertBrandSchema>;
export type Brand = typeof brands.$inferSelect;

// Templates
export const templates = pgTable("templates", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id", { length: 36 }),
  brandId: varchar("brand_id", { length: 36 }),
  type: text("type").notNull(),
  name: text("name").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertTemplateSchema = createInsertSchema(templates).omit({ id: true, createdAt: true });
export type InsertTemplate = z.infer<typeof insertTemplateSchema>;
export type Template = typeof templates.$inferSelect;

// Projects
export const projects = pgTable("projects", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id", { length: 36 }).notNull(),
  brandId: varchar("brand_id", { length: 36 }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

// Input types
export const inputTypes = ["url", "text", "pdf", "docx", "transcript", "brief"] as const;
export type InputType = typeof inputTypes[number];

// Inputs (raw content)
export const inputs = pgTable("inputs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id", { length: 36 }).notNull(),
  brandId: varchar("brand_id", { length: 36 }),
  projectId: varchar("project_id", { length: 36 }),
  type: text("type").notNull().$type<InputType>(),
  title: text("title").notNull(),
  sourceUrl: text("source_url"),
  language: text("language"),
  rawText: text("raw_text"),
  fileKey: text("file_key"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_inputs_workspace").on(table.workspaceId),
]);

export const insertInputSchema = createInsertSchema(inputs).omit({ id: true, createdAt: true });
export type InsertInput = z.infer<typeof insertInputSchema>;
export type Input = typeof inputs.$inferSelect;

// Workflow types
export const workflowTypes = [
  "headline_pack",
  "rewrite_tone",
  "seo_blog",
  "press_release",
  "social_pack",
  "newsletter",
  "translation_ar_en",
  "translation_en_ar",
  "repurpose_transcript",
  "executive_brief",
  "expand_longform",
  "summarize",
  "image_prompts",
] as const;
export type WorkflowType = typeof workflowTypes[number];

// Workflow run statuses
export const runStatuses = ["queued", "running", "succeeded", "failed", "cancelled"] as const;
export type RunStatus = typeof runStatuses[number];

// Workflows (saved workflow configurations)
export const workflows = pgTable("workflows", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id", { length: 36 }).notNull(),
  brandId: varchar("brand_id", { length: 36 }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  configJson: jsonb("config_json").default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWorkflowSchema = createInsertSchema(workflows).omit({ id: true, createdAt: true });
export type InsertWorkflow = z.infer<typeof insertWorkflowSchema>;
export type Workflow = typeof workflows.$inferSelect;

// Workflow runs
export const workflowRuns = pgTable("workflow_runs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id", { length: 36 }).notNull(),
  brandId: varchar("brand_id", { length: 36 }),
  inputId: varchar("input_id", { length: 36 }).notNull(),
  workflowType: text("workflow_type").notNull().$type<WorkflowType>(),
  status: text("status").notNull().$type<RunStatus>().default("queued"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  costEstimate: numeric("cost_estimate"),
  traceJson: jsonb("trace_json").default({}),
  outputJson: jsonb("output_json").default({}),
  errorJson: jsonb("error_json"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_runs_workspace").on(table.workspaceId),
]);

export const insertWorkflowRunSchema = createInsertSchema(workflowRuns).omit({ 
  id: true, 
  startedAt: true, 
  completedAt: true,
  status: true,
  createdAt: true,
});
export type InsertWorkflowRun = z.infer<typeof insertWorkflowRunSchema>;
export type WorkflowRun = typeof workflowRuns.$inferSelect;

// Asset statuses
export const assetStatuses = ["draft", "in_review", "approved", "published", "archived"] as const;
export type AssetStatus = typeof assetStatuses[number];

// Channel types
export const channelTypes = ["blog", "press_release", "linkedin", "x", "instagram", "newsletter", "website", "generic"] as const;
export type ChannelType = typeof channelTypes[number];

// Assets (container for content versions)
export const assets = pgTable("assets", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id", { length: 36 }).notNull(),
  brandId: varchar("brand_id", { length: 36 }),
  projectId: varchar("project_id", { length: 36 }),
  inputId: varchar("input_id", { length: 36 }),
  status: text("status").notNull().$type<AssetStatus>().default("draft"),
  primaryLanguage: text("primary_language").default("en"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_assets_workspace").on(table.workspaceId),
]);

export const insertAssetSchema = createInsertSchema(assets).omit({ id: true, createdAt: true });
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type Asset = typeof assets.$inferSelect;

// Asset Versions (actual content with version history)
export const assetVersions = pgTable("asset_versions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  assetId: varchar("asset_id", { length: 36 }).notNull(),
  versionNo: integer("version_no").notNull(),
  title: text("title"),
  body: text("body").notNull(),
  format: text("format").default("md"),
  channel: text("channel").$type<ChannelType>().default("generic"),
  language: text("language").default("en"),
  metadataJson: jsonb("metadata_json").default({}),
  createdBy: varchar("created_by", { length: 255 }),
  runId: varchar("run_id", { length: 36 }),
  workflowType: text("workflow_type").$type<WorkflowType>(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  unique("asset_version_unique").on(table.assetId, table.versionNo),
  index("idx_versions_asset").on(table.assetId),
]);

export const insertAssetVersionSchema = createInsertSchema(assetVersions).omit({ id: true, createdAt: true });
export type InsertAssetVersion = z.infer<typeof insertAssetVersionSchema>;
export type AssetVersion = typeof assetVersions.$inferSelect;

// Comments on asset versions
export const comments = pgTable("comments", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  assetVersionId: varchar("asset_version_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCommentSchema = createInsertSchema(comments).omit({ id: true, createdAt: true });
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof comments.$inferSelect;

// Publishing target types
export const targetTypes = ["wordpress", "webflow", "x", "linkedin", "meta", "email", "custom"] as const;
export type TargetType = typeof targetTypes[number];

// Publish status
export const publishStatuses = ["queued", "scheduled", "running", "succeeded", "failed", "cancelled"] as const;
export type PublishStatus = typeof publishStatuses[number];

// Publishing Targets
export const publishingTargets = pgTable("publishing_targets", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id", { length: 36 }).notNull(),
  brandId: varchar("brand_id", { length: 36 }),
  type: text("type").notNull().$type<TargetType>(),
  name: text("name").notNull(),
  credentialsEncrypted: text("credentials_encrypted"),
  configJson: jsonb("config_json").default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPublishingTargetSchema = createInsertSchema(publishingTargets).omit({ id: true, createdAt: true });
export type InsertPublishingTarget = z.infer<typeof insertPublishingTargetSchema>;
export type PublishingTarget = typeof publishingTargets.$inferSelect;

// Publish Jobs
export const publishJobs = pgTable("publish_jobs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  assetVersionId: varchar("asset_version_id", { length: 36 }).notNull(),
  targetId: varchar("target_id", { length: 36 }).notNull(),
  status: text("status").notNull().$type<PublishStatus>().default("queued"),
  scheduledAt: timestamp("scheduled_at"),
  executedAt: timestamp("executed_at"),
  resultJson: jsonb("result_json"),
  errorJson: jsonb("error_json"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPublishJobSchema = createInsertSchema(publishJobs).omit({ id: true, createdAt: true });
export type InsertPublishJob = z.infer<typeof insertPublishJobSchema>;
export type PublishJob = typeof publishJobs.$inferSelect;

// Usage unit types
export const usageUnitTypes = ["run", "tokens", "seconds"] as const;
export type UsageUnitType = typeof usageUnitTypes[number];

// Usage Ledger
export const usageLedger = pgTable("usage_ledger", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 255 }),
  runId: varchar("run_id", { length: 36 }),
  units: numeric("units").notNull(),
  unitType: text("unit_type").notNull().$type<UsageUnitType>(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUsageLedgerSchema = createInsertSchema(usageLedger).omit({ id: true, createdAt: true });
export type InsertUsageLedger = z.infer<typeof insertUsageLedgerSchema>;
export type UsageLedger = typeof usageLedger.$inferSelect;

// Relations
export const workspacesRelations = relations(workspaces, ({ many }) => ({
  workspaceUsers: many(workspaceUsers),
  brands: many(brands),
  projects: many(projects),
  inputs: many(inputs),
  assets: many(assets),
  workflowRuns: many(workflowRuns),
}));

export const brandsRelations = relations(brands, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [brands.workspaceId], references: [workspaces.id] }),
  templates: many(templates),
  inputs: many(inputs),
}));

export const assetsRelations = relations(assets, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [assets.workspaceId], references: [workspaces.id] }),
  versions: many(assetVersions),
}));

// Conversations (for AI chat)
export const conversations = pgTable("conversations", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({ id: true, createdAt: true });
export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

// Messages (for AI chat)
export const messages = pgTable("messages", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  conversationId: integer("conversation_id").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

export const assetVersionsRelations = relations(assetVersions, ({ one, many }) => ({
  asset: one(assets, { fields: [assetVersions.assetId], references: [assets.id] }),
  comments: many(comments),
}));

// Source types
export const sourceTypes = ["rss", "web"] as const;
export type SourceType = typeof sourceTypes[number];

// Source item statuses
export const sourceItemStatuses = ["new", "queued", "processed", "ignored"] as const;
export type SourceItemStatus = typeof sourceItemStatuses[number];

// Automation trigger types
export const automationTriggerTypes = ["on_new_items", "scheduled"] as const;
export type AutomationTriggerType = typeof automationTriggerTypes[number];

// Automation run statuses
export const automationRunStatuses = ["pending", "running", "completed", "failed"] as const;
export type AutomationRunStatus = typeof automationRunStatuses[number];

// Sources (RSS feeds, web URLs to monitor)
export const sources = pgTable("sources", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id", { length: 36 }).notNull(),
  name: text("name").notNull(),
  type: text("type").notNull().$type<SourceType>().default("rss"),
  feedUrl: text("feed_url").notNull(),
  description: text("description"),
  language: text("language").default("en"),
  region: text("region"),
  tags: text("tags").array(),
  mediaTier: text("media_tier").default("tier_3"),
  isActive: text("is_active").default("true"),
  fetchIntervalMinutes: integer("fetch_interval_minutes").default(60),
  lastFetchedAt: timestamp("last_fetched_at"),
  lastSuccessAt: timestamp("last_success_at"),
  lastError: text("last_error"),
  itemCount: integer("item_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_sources_workspace").on(table.workspaceId),
]);

export const insertSourceSchema = createInsertSchema(sources).omit({ id: true, createdAt: true, lastFetchedAt: true, lastSuccessAt: true, lastError: true, itemCount: true });
export type InsertSource = z.infer<typeof insertSourceSchema>;
export type Source = typeof sources.$inferSelect;

// Source Fetch Runs (track every fetch operation)
export const fetchRunStatuses = ["success", "failed"] as const;
export type FetchRunStatus = typeof fetchRunStatuses[number];

export const fetchRuns = pgTable("fetch_runs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  sourceId: varchar("source_id", { length: 36 }).notNull(),
  status: text("status").notNull().$type<FetchRunStatus>(),
  errorName: text("error_name"),
  errorDetail: text("error_detail"),
  httpStatus: integer("http_status"),
  durationMs: integer("duration_ms"),
  bytesCompressed: integer("bytes_compressed"),
  bytesDecompressed: integer("bytes_decompressed"),
  contentEncoding: text("content_encoding"),
  contentType: text("content_type"),
  parsedItemsCount: integer("parsed_items_count"),
  insertedCount: integer("inserted_count"),
  dedupedCount: integer("deduped_count"),
  missingGuidCount: integer("missing_guid_count"),
  missingLinkCount: integer("missing_link_count"),
  existingCountBefore: integer("existing_count_before"),
  totalCountAfter: integer("total_count_after"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_fetch_runs_source").on(table.sourceId),
  index("idx_fetch_runs_created").on(table.createdAt),
]);

export const insertFetchRunSchema = createInsertSchema(fetchRuns).omit({ id: true, createdAt: true });
export type InsertFetchRun = z.infer<typeof insertFetchRunSchema>;
export type FetchRun = typeof fetchRuns.$inferSelect;

// Source Items (ingested news/content from sources)
export const sourceItems = pgTable("source_items", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id", { length: 36 }).notNull(),
  sourceId: varchar("source_id", { length: 36 }).notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  publishedAt: timestamp("published_at"),
  author: text("author"),
  excerpt: text("excerpt"),
  rawContent: text("raw_content"),
  contentHash: text("content_hash").notNull(),
  guidNormalized: text("guid_normalized"),
  status: text("status").notNull().$type<SourceItemStatus>().default("new"),
  metadataJson: jsonb("metadata_json").default({}),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_source_items_workspace").on(table.workspaceId),
  index("idx_source_items_source").on(table.sourceId),
  index("idx_source_items_status").on(table.status),
  unique("source_item_hash_unique").on(table.workspaceId, table.contentHash),
  index("idx_source_items_guid").on(table.sourceId, table.guidNormalized),
]);

export const insertSourceItemSchema = createInsertSchema(sourceItems).omit({ id: true, createdAt: true });
export type InsertSourceItem = z.infer<typeof insertSourceItemSchema>;
export type SourceItem = typeof sourceItems.$inferSelect;

// Source Item Mentions (cross-source provenance tracking)
// When multiple sources carry the same story, this table tracks which sources mentioned it
export const sourceItemMentions = pgTable("source_item_mentions", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  sourceItemId: varchar("source_item_id", { length: 36 }).notNull(),
  sourceId: varchar("source_id", { length: 36 }).notNull(),
  originalUrl: text("original_url").notNull(),
  guid: text("guid"),
  firstSeenAt: timestamp("first_seen_at").defaultNow(),
}, (table) => [
  index("idx_mentions_source_item").on(table.sourceItemId),
  index("idx_mentions_source").on(table.sourceId),
  unique("mention_unique").on(table.sourceItemId, table.sourceId),
]);

export const insertSourceItemMentionSchema = createInsertSchema(sourceItemMentions).omit({ id: true, firstSeenAt: true });
export type InsertSourceItemMention = z.infer<typeof insertSourceItemMentionSchema>;
export type SourceItemMention = typeof sourceItemMentions.$inferSelect;

// Automations (scheduled pipelines)
export const automations = pgTable("automations", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id", { length: 36 }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  isActive: text("is_active").default("true"),
  triggerType: text("trigger_type").notNull().$type<AutomationTriggerType>().default("on_new_items"),
  schedule: text("schedule"),
  sourceIds: text("source_ids").array(),
  filterKeywordsInclude: text("filter_keywords_include").array(),
  filterKeywordsExclude: text("filter_keywords_exclude").array(),
  filterLanguage: text("filter_language"),
  workflowType: text("workflow_type").notNull().$type<WorkflowType>().default("seo_blog"),
  approvalRequired: text("approval_required").default("true"),
  autoPublish: text("auto_publish").default("false"),
  publishingTargetId: varchar("publishing_target_id", { length: 36 }),
  categoryMapping: jsonb("category_mapping").default({}),
  runLimitPerCycle: integer("run_limit_per_cycle").default(10),
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_automations_workspace").on(table.workspaceId),
]);

export const insertAutomationSchema = createInsertSchema(automations).omit({ id: true, createdAt: true, lastRunAt: true, nextRunAt: true });
export type InsertAutomation = z.infer<typeof insertAutomationSchema>;
export type Automation = typeof automations.$inferSelect;

// Automation Runs (execution history)
export const automationRuns = pgTable("automation_runs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id", { length: 36 }).notNull(),
  automationId: varchar("automation_id", { length: 36 }).notNull(),
  status: text("status").notNull().$type<AutomationRunStatus>().default("pending"),
  itemsProcessed: integer("items_processed").default(0),
  itemsSucceeded: integer("items_succeeded").default(0),
  itemsFailed: integer("items_failed").default(0),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  logJson: jsonb("log_json").default([]),
  errorJson: jsonb("error_json"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_automation_runs_automation").on(table.automationId),
]);

export const insertAutomationRunSchema = createInsertSchema(automationRuns).omit({ id: true, createdAt: true, startedAt: true, completedAt: true });
export type InsertAutomationRun = z.infer<typeof insertAutomationRunSchema>;
export type AutomationRun = typeof automationRuns.$inferSelect;

// Automation Run Items (join between run and source items)
export const automationRunItems = pgTable("automation_run_items", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  runId: varchar("run_id", { length: 36 }).notNull(),
  sourceItemId: varchar("source_item_id", { length: 36 }).notNull(),
  assetId: varchar("asset_id", { length: 36 }),
  status: text("status").notNull().$type<AutomationRunStatus>().default("pending"),
  publishedUrl: text("published_url"),
  wpPostId: text("wp_post_id"),
  errorJson: jsonb("error_json"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_run_items_run").on(table.runId),
]);

export const insertAutomationRunItemSchema = createInsertSchema(automationRunItems).omit({ id: true, createdAt: true });
export type InsertAutomationRunItem = z.infer<typeof insertAutomationRunItemSchema>;
export type AutomationRunItem = typeof automationRunItems.$inferSelect;

// Relations for sources
export const sourcesRelations = relations(sources, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [sources.workspaceId], references: [workspaces.id] }),
  items: many(sourceItems),
}));

export const sourceItemsRelations = relations(sourceItems, ({ one }) => ({
  source: one(sources, { fields: [sourceItems.sourceId], references: [sources.id] }),
}));

export const automationsRelations = relations(automations, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [automations.workspaceId], references: [workspaces.id] }),
  runs: many(automationRuns),
}));

export const automationRunsRelations = relations(automationRuns, ({ one, many }) => ({
  automation: one(automations, { fields: [automationRuns.automationId], references: [automations.id] }),
  items: many(automationRunItems),
}));

// Workflow metadata for UI
export const workflowMeta: Record<WorkflowType, { label: string; description: string; icon: string }> = {
  headline_pack: { 
    label: "Headline Pack", 
    description: "Generate multiple headline variants", 
    icon: "Heading" 
  },
  rewrite_tone: { 
    label: "Tone Rewrite", 
    description: "Rewrite content in different tones", 
    icon: "RefreshCw" 
  },
  seo_blog: { 
    label: "SEO Blog", 
    description: "Create SEO-optimized blog content", 
    icon: "Search" 
  },
  press_release: { 
    label: "Press Release", 
    description: "Generate professional press releases", 
    icon: "Newspaper" 
  },
  social_pack: { 
    label: "Social Pack", 
    description: "Create posts for all social platforms", 
    icon: "Share2" 
  },
  newsletter: { 
    label: "Newsletter", 
    description: "Draft newsletter with subject lines", 
    icon: "Mail" 
  },
  translation_ar_en: { 
    label: "Arabic to English", 
    description: "Translate Arabic content to English", 
    icon: "Languages" 
  },
  translation_en_ar: { 
    label: "English to Arabic", 
    description: "Translate English content to Arabic", 
    icon: "Languages" 
  },
  repurpose_transcript: { 
    label: "Repurpose Transcript", 
    description: "Turn transcripts into articles & quotes", 
    icon: "FileText" 
  },
  executive_brief: { 
    label: "Executive Brief", 
    description: "Summarize into executive summary", 
    icon: "ClipboardList" 
  },
  expand_longform: { 
    label: "Expand Longform", 
    description: "Expand content into detailed article", 
    icon: "Maximize2" 
  },
  summarize: { 
    label: "Summarize", 
    description: "Create concise summary", 
    icon: "Minimize2" 
  },
  image_prompts: { 
    label: "Image Prompts", 
    description: "Generate prompts for visuals", 
    icon: "Image" 
  },
};

// ============ CONTENT GOALS & DISCOVERY ============

// Content Goal types
export const contentGoalTypes = ["news_rss", "evergreen", "light_content", "mixed"] as const;
export type ContentGoalType = typeof contentGoalTypes[number];

// Publication types
export const publicationTypes = ["mainstream", "trade", "government", "corporate_blog", "academic"] as const;
export type PublicationType = typeof publicationTypes[number];

// Discovery job statuses
export const discoveryJobStatuses = ["pending", "running", "completed", "failed"] as const;
export type DiscoveryJobStatus = typeof discoveryJobStatuses[number];

// Discovered source validation statuses
export const discoveredSourceStatuses = ["pending", "valid", "invalid", "added"] as const;
export type DiscoveredSourceStatus = typeof discoveredSourceStatuses[number];

// Content Goals (workspace-scoped content strategy)
export const contentGoals = pgTable("content_goals", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id", { length: 36 }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  goalType: text("goal_type").notNull().$type<ContentGoalType>().default("news_rss"),
  country: text("country"),
  region: text("region"),
  language: text("language").default("en"),
  categories: text("categories").array(),
  topics: text("topics").array(),
  publicationTypes: text("publication_types").array(),
  isActive: text("is_active").default("true"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_content_goals_workspace").on(table.workspaceId),
]);

export const insertContentGoalSchema = createInsertSchema(contentGoals).omit({ id: true, createdAt: true });
export type InsertContentGoal = z.infer<typeof insertContentGoalSchema>;
export type ContentGoal = typeof contentGoals.$inferSelect;

// Discovery Jobs (RSS feed discovery runs)
export const discoveryJobs = pgTable("discovery_jobs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id", { length: 36 }).notNull(),
  contentGoalId: varchar("content_goal_id", { length: 36 }).notNull(),
  status: text("status").notNull().$type<DiscoveryJobStatus>().default("pending"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  candidatesFound: integer("candidates_found").default(0),
  validatedCount: integer("validated_count").default(0),
  errorJson: jsonb("error_json"),
  logsJson: jsonb("logs_json").default([]),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_discovery_jobs_workspace").on(table.workspaceId),
  index("idx_discovery_jobs_goal").on(table.contentGoalId),
]);

export const insertDiscoveryJobSchema = createInsertSchema(discoveryJobs).omit({ id: true, createdAt: true, startedAt: true, completedAt: true });
export type InsertDiscoveryJob = z.infer<typeof insertDiscoveryJobSchema>;
export type DiscoveryJob = typeof discoveryJobs.$inferSelect;

// Discovered Sources (candidate feeds from discovery)
export const discoveredSources = pgTable("discovered_sources", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id", { length: 36 }).notNull(),
  discoveryJobId: varchar("discovery_job_id", { length: 36 }).notNull(),
  feedUrl: text("feed_url").notNull(),
  feedTitle: text("feed_title"),
  siteUrl: text("site_url"),
  domain: text("domain"),
  description: text("description"),
  language: text("language"),
  lastPublishDate: timestamp("last_publish_date"),
  itemCount: integer("item_count"),
  score: integer("score").default(0),
  scoreBreakdown: jsonb("score_breakdown").default({}),
  status: text("status").notNull().$type<DiscoveredSourceStatus>().default("pending"),
  validationError: text("validation_error"),
  httpStatus: integer("http_status"),
  convertedSourceId: varchar("converted_source_id", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_discovered_sources_job").on(table.discoveryJobId),
  index("idx_discovered_sources_workspace").on(table.workspaceId),
  unique("discovered_source_url_unique").on(table.discoveryJobId, table.feedUrl),
]);

export const insertDiscoveredSourceSchema = createInsertSchema(discoveredSources).omit({ id: true, createdAt: true });
export type InsertDiscoveredSource = z.infer<typeof insertDiscoveredSourceSchema>;
export type DiscoveredSource = typeof discoveredSources.$inferSelect;

// Content Plans (for evergreen/light content goals)
export const contentPlans = pgTable("content_plans", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id", { length: 36 }).notNull(),
  contentGoalId: varchar("content_goal_id", { length: 36 }).notNull(),
  name: text("name").notNull(),
  planType: text("plan_type").default("editorial_calendar"),
  weekStartDate: timestamp("week_start_date"),
  topicsJson: jsonb("topics_json").default([]),
  outlinesJson: jsonb("outlines_json").default([]),
  status: text("status").default("draft"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_content_plans_workspace").on(table.workspaceId),
  index("idx_content_plans_goal").on(table.contentGoalId),
]);

export const insertContentPlanSchema = createInsertSchema(contentPlans).omit({ id: true, createdAt: true });
export type InsertContentPlan = z.infer<typeof insertContentPlanSchema>;
export type ContentPlan = typeof contentPlans.$inferSelect;

// Relations for content goals
export const contentGoalsRelations = relations(contentGoals, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [contentGoals.workspaceId], references: [workspaces.id] }),
  discoveryJobs: many(discoveryJobs),
  contentPlans: many(contentPlans),
}));

export const discoveryJobsRelations = relations(discoveryJobs, ({ one, many }) => ({
  contentGoal: one(contentGoals, { fields: [discoveryJobs.contentGoalId], references: [contentGoals.id] }),
  discoveredSources: many(discoveredSources),
}));

export const discoveredSourcesRelations = relations(discoveredSources, ({ one }) => ({
  discoveryJob: one(discoveryJobs, { fields: [discoveredSources.discoveryJobId], references: [discoveryJobs.id] }),
  convertedSource: one(sources, { fields: [discoveredSources.convertedSourceId], references: [sources.id] }),
}));

export const contentPlansRelations = relations(contentPlans, ({ one }) => ({
  contentGoal: one(contentGoals, { fields: [contentPlans.contentGoalId], references: [contentGoals.id] }),
}));

// ============ STORY CLUSTERING & DRAFTS ============

// Media tiers for source trust levels
export const mediaTiers = ["tier_1", "tier_2", "tier_3"] as const;
export type MediaTier = typeof mediaTiers[number];

// Content intents
export const contentIntents = ["news_monitoring", "informational", "evergreen", "mixed"] as const;
export type ContentIntent = typeof contentIntents[number];

// Draft statuses
export const draftStatuses = ["pending", "draft", "in_review", "approved", "rejected", "published"] as const;
export type DraftStatus = typeof draftStatuses[number];

// Stories (clusters of related source items representing a single real-world event)
export const stories = pgTable("stories", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id", { length: 36 }).notNull(),
  canonicalTitle: text("canonical_title").notNull(),
  normalizedTitle: text("normalized_title").notNull(),
  excerpt: text("excerpt"),
  entities: jsonb("entities").default([]),
  publishedDateBucket: text("published_date_bucket"),
  similarityHash: text("similarity_hash"),
  sourceCount: integer("source_count").default(1),
  firstSeenAt: timestamp("first_seen_at").defaultNow(),
  lastUpdatedAt: timestamp("last_updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_stories_workspace").on(table.workspaceId),
  index("idx_stories_similarity").on(table.similarityHash),
  index("idx_stories_date_bucket").on(table.publishedDateBucket),
]);

export const insertStorySchema = createInsertSchema(stories).omit({ id: true, createdAt: true, firstSeenAt: true, lastUpdatedAt: true });
export type InsertStory = z.infer<typeof insertStorySchema>;
export type Story = typeof stories.$inferSelect;

// Story Items (links source items to stories for provenance)
export const storyItems = pgTable("story_items", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  storyId: varchar("story_id", { length: 36 }).notNull(),
  sourceItemId: varchar("source_item_id", { length: 36 }).notNull(),
  sourceName: text("source_name"),
  sourceUrl: text("source_url"),
  similarityScore: numeric("similarity_score"),
  isPrimary: text("is_primary").default("false"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_story_items_story").on(table.storyId),
  index("idx_story_items_source_item").on(table.sourceItemId),
  unique("story_item_unique").on(table.storyId, table.sourceItemId),
]);

export const insertStoryItemSchema = createInsertSchema(storyItems).omit({ id: true, createdAt: true });
export type InsertStoryItem = z.infer<typeof insertStoryItemSchema>;
export type StoryItem = typeof storyItems.$inferSelect;

// Drafts (content derived from stories for editorial workflow)
export const drafts = pgTable("drafts", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id", { length: 36 }).notNull(),
  topicId: varchar("topic_id", { length: 36 }),
  storyId: varchar("story_id", { length: 36 }),
  sourceItemId: varchar("source_item_id", { length: 36 }),
  title: text("title").notNull(),
  angle: text("angle"),
  body: text("body"),
  provenance: jsonb("provenance").default([]),
  status: text("status").notNull().$type<DraftStatus>().default("pending"),
  reviewNotes: text("review_notes"),
  assetId: varchar("asset_id", { length: 36 }),
  featuredImageId: varchar("featured_image_id", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_drafts_workspace").on(table.workspaceId),
  index("idx_drafts_topic").on(table.topicId),
  index("idx_drafts_story").on(table.storyId),
  index("idx_drafts_status").on(table.status),
]);

export const insertDraftSchema = createInsertSchema(drafts).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDraft = z.infer<typeof insertDraftSchema>;
export type Draft = typeof drafts.$inferSelect;

// Topics (evolved from automations - user-facing content configurations)
export const topics = pgTable("topics", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id", { length: 36 }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  contentIntent: text("content_intent").notNull().$type<ContentIntent>().default("news_monitoring"),
  query: text("query"),
  language: text("language").default("en"),
  region: text("region").notNull().default("global"),
  countries: text("countries").array().default([]),
  filters: jsonb("filters").default({}),
  sourceIds: text("source_ids").array(),
  mediaTierRules: jsonb("media_tier_rules").default({}),
  schedule: text("schedule"),
  outputVolumePerDay: integer("output_volume_per_day").default(5),
  reviewMode: text("review_mode").default("manual"),
  autoPublish: text("auto_publish").default("false"),
  autoGenerateVisuals: text("auto_generate_visuals").default("false"),
  publishingTargetId: varchar("publishing_target_id", { length: 36 }),
  taxonomyRules: jsonb("taxonomy_rules").default({}),
  isLive: text("is_live").default("false"),
  lastRunAt: timestamp("last_run_at"),
  nextRunAt: timestamp("next_run_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_topics_workspace").on(table.workspaceId),
]);

export const insertTopicSchema = createInsertSchema(topics).omit({ id: true, createdAt: true, lastRunAt: true, nextRunAt: true });
export type InsertTopic = z.infer<typeof insertTopicSchema>;
export type Topic = typeof topics.$inferSelect;

// Relations for stories and drafts
export const storiesRelations = relations(stories, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [stories.workspaceId], references: [workspaces.id] }),
  storyItems: many(storyItems),
  drafts: many(drafts),
}));

export const storyItemsRelations = relations(storyItems, ({ one }) => ({
  story: one(stories, { fields: [storyItems.storyId], references: [stories.id] }),
  sourceItem: one(sourceItems, { fields: [storyItems.sourceItemId], references: [sourceItems.id] }),
}));

export const draftsRelations = relations(drafts, ({ one }) => ({
  workspace: one(workspaces, { fields: [drafts.workspaceId], references: [workspaces.id] }),
  topic: one(topics, { fields: [drafts.topicId], references: [topics.id] }),
  story: one(stories, { fields: [drafts.storyId], references: [stories.id] }),
  sourceItem: one(sourceItems, { fields: [drafts.sourceItemId], references: [sourceItems.id] }),
}));

export const topicsRelations = relations(topics, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [topics.workspaceId], references: [workspaces.id] }),
  drafts: many(drafts),
  topicSources: many(topicSources),
}));

// ============ TOPIC SOURCES (per-topic source enablement) ============

export const topicSources = pgTable("topic_sources", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  topicId: varchar("topic_id", { length: 36 }).notNull(),
  sourceId: varchar("source_id", { length: 36 }).notNull(),
  isEnabled: boolean("is_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_topic_sources_topic").on(table.topicId),
  index("idx_topic_sources_source").on(table.sourceId),
  uniqueIndex("uniq_topic_source").on(table.topicId, table.sourceId),
]);

export const insertTopicSourceSchema = createInsertSchema(topicSources).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTopicSource = z.infer<typeof insertTopicSourceSchema>;
export type TopicSource = typeof topicSources.$inferSelect;

export const topicSourcesRelations = relations(topicSources, ({ one }) => ({
  topic: one(topics, { fields: [topicSources.topicId], references: [topics.id] }),
  source: one(sources, { fields: [topicSources.sourceId], references: [sources.id] }),
}));

// Source recommendation candidates (persisted for audit)
export const topicSourceRecommendations = pgTable("topic_source_recommendations", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  topicId: varchar("topic_id", { length: 36 }).notNull(),
  payloadJson: jsonb("payload_json").default([]),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_topic_source_recommendations_topic").on(table.topicId),
]);

export const insertTopicSourceRecommendationSchema = createInsertSchema(topicSourceRecommendations).omit({ id: true, createdAt: true });
export type InsertTopicSourceRecommendation = z.infer<typeof insertTopicSourceRecommendationSchema>;
export type TopicSourceRecommendation = typeof topicSourceRecommendations.$inferSelect;

// ============ VISUAL INTELLIGENCE ============

// Image origin types
export const imageOriginTypes = ["source", "generated"] as const;
export type ImageOriginType = typeof imageOriginTypes[number];

// Image Assets (captured from sources or AI-generated)
export const imageAssets = pgTable("image_assets", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id", { length: 36 }).notNull(),
  storyId: varchar("story_id", { length: 36 }),
  sourceItemId: varchar("source_item_id", { length: 36 }),
  originType: text("origin_type").notNull().$type<ImageOriginType>().default("source"),
  originalUrl: text("original_url"),
  storedUrl: text("stored_url"),
  caption: text("caption"),
  credit: text("credit"),
  licenseType: text("license_type"),
  generatedPrompt: text("generated_prompt"),
  isPrimary: boolean("is_primary").default(false),
  sourceTier: text("source_tier"),
  metadataJson: jsonb("metadata_json").default({}),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_image_assets_workspace").on(table.workspaceId),
  index("idx_image_assets_story").on(table.storyId),
  index("idx_image_assets_source_item").on(table.sourceItemId),
]);

export const insertImageAssetSchema = createInsertSchema(imageAssets).omit({ id: true, createdAt: true });
export type InsertImageAsset = z.infer<typeof insertImageAssetSchema>;
export type ImageAsset = typeof imageAssets.$inferSelect;

// Image Usages (tracks where images have been published)
export const imageUsages = pgTable("image_usages", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  imageAssetId: varchar("image_asset_id", { length: 36 }).notNull(),
  target: text("target").notNull().default("wordpress"),
  targetPostId: text("target_post_id"),
  uploadedUrl: text("uploaded_url"),
  uploadedAt: timestamp("uploaded_at"),
  metadataJson: jsonb("metadata_json").default({}),
}, (table) => [
  index("idx_image_usages_asset").on(table.imageAssetId),
]);

export const insertImageUsageSchema = createInsertSchema(imageUsages).omit({ id: true });
export type InsertImageUsage = z.infer<typeof insertImageUsageSchema>;
export type ImageUsage = typeof imageUsages.$inferSelect;

// Image relations
export const imageAssetsRelations = relations(imageAssets, ({ one, many }) => ({
  workspace: one(workspaces, { fields: [imageAssets.workspaceId], references: [workspaces.id] }),
  story: one(stories, { fields: [imageAssets.storyId], references: [stories.id] }),
  sourceItem: one(sourceItems, { fields: [imageAssets.sourceItemId], references: [sourceItems.id] }),
  usages: many(imageUsages),
}));

export const imageUsagesRelations = relations(imageUsages, ({ one }) => ({
  imageAsset: one(imageAssets, { fields: [imageUsages.imageAssetId], references: [imageAssets.id] }),
}));

// ============ WORDPRESS TAXONOMY ============

// Taxonomy types
export const wpTaxonomyTypes = ["category", "tag"] as const;
export type WpTaxonomyType = typeof wpTaxonomyTypes[number];

// WordPress Taxonomy Cache (synced from WP per publishing target)
export const wpTaxonomyCache = pgTable("wp_taxonomy_cache", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id", { length: 36 }).notNull(),
  publishingTargetId: varchar("publishing_target_id", { length: 36 }).notNull(),
  taxonomyType: text("taxonomy_type").notNull().$type<WpTaxonomyType>(),
  wpId: integer("wp_id").notNull(),
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  parentWpId: integer("parent_wp_id"),
  count: integer("count").default(0),
  syncedAt: timestamp("synced_at").defaultNow(),
}, (table) => [
  index("idx_wp_taxonomy_workspace").on(table.workspaceId),
  index("idx_wp_taxonomy_target").on(table.publishingTargetId),
  index("idx_wp_taxonomy_type").on(table.taxonomyType),
  unique("wp_taxonomy_unique").on(table.publishingTargetId, table.taxonomyType, table.wpId),
]);

export const insertWpTaxonomyCacheSchema = createInsertSchema(wpTaxonomyCache).omit({ id: true });
export type InsertWpTaxonomyCache = z.infer<typeof insertWpTaxonomyCacheSchema>;
export type WpTaxonomyCache = typeof wpTaxonomyCache.$inferSelect;

// Single target taxonomy rules
export interface TargetTaxonomyRule {
  defaultCategoryIds?: number[];  // WP category IDs
  defaultTagIds?: number[];       // WP tag IDs
  locationMode?: "none" | "country_to_category" | "country_to_tag";
  allowCreateTags?: boolean;      // Create missing tags on publish
  allowCreateCategories?: boolean; // Create missing categories (default false for safety)
}

// Topic taxonomy rules interface - map of publishing target ID to rules
export interface TopicTaxonomyRules {
  [targetId: string]: TargetTaxonomyRule;
}

// WP Taxonomy relations
export const wpTaxonomyCacheRelations = relations(wpTaxonomyCache, ({ one }) => ({
  workspace: one(workspaces, { fields: [wpTaxonomyCache.workspaceId], references: [workspaces.id] }),
  publishingTarget: one(publishingTargets, { fields: [wpTaxonomyCache.publishingTargetId], references: [publishingTargets.id] }),
}));

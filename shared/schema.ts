import { pgTable, text, varchar, timestamp, jsonb, integer, numeric, index, unique, uniqueIndex, boolean } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export auth models (required for Replit Auth)
export * from "./models/auth";

// ============ ENUMS (defined first to prevent forward references) ============

// Role types for workspace permissions
export const roleTypes = ["owner", "admin", "editor", "reviewer", "viewer"] as const;
export type RoleType = typeof roleTypes[number];

// Automation modes for topics/pipelines
export const automationModes = ["auto", "manual", "approval_required"] as const;
export type AutomationMode = typeof automationModes[number];

// Topic lifecycle states (user-controlled)
export const topicStatuses = ["draft", "live", "paused"] as const;
export type TopicStatus = typeof topicStatuses[number];

// Source modes for topic source selection
export const sourceModes = ["all", "whitelist"] as const;
export type SourceMode = typeof sourceModes[number];

// Automation job types
export const automationJobTypes = [
  "discovery",  // Topic discovery/matching phase
  "fetch",
  "match",
  "generate",
  "gate",
  "schedule",
  "publish",
  "verify",
] as const;
export type AutomationJobType = typeof automationJobTypes[number];

// Automation job statuses
export const automationJobStatuses = ["queued", "running", "success", "fail", "partial", "timeout"] as const;
export type AutomationJobStatus = typeof automationJobStatuses[number];

// ============ TABLES ============

// Workspaces
export const workspaces = pgTable("workspaces", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  planId: text("plan_id"),
  features: jsonb("features").default({}),
  automationKeyHash: text("automation_key_hash"),
  automationKeyLast4: text("automation_key_last4"),
  activeSiteId: varchar("active_site_id", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWorkspaceSchema = createInsertSchema(workspaces).omit({ id: true, createdAt: true });
export type InsertWorkspace = z.infer<typeof insertWorkspaceSchema>;
export type Workspace = typeof workspaces.$inferSelect;

// Site connection statuses
export const siteConnectionStatuses = ["not_connected", "connected", "error"] as const;
export type SiteConnectionStatus = typeof siteConnectionStatuses[number];

// Sites (multi-site support)
export const sites = pgTable("sites", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id", { length: 36 }).notNull(),
  name: text("name").notNull(),
  url: text("url"),
  connectionStatus: text("connection_status").$type<SiteConnectionStatus>().default("not_connected"),
  lastConnectedAt: timestamp("last_connected_at"),
  
  // WordPress REST API credentials (outbound: CS → WP)
  wpSiteUrl: text("wp_site_url"),
  wpUsername: text("wp_username"),
  wpAppPassword: text("wp_app_password"), // Application Password for REST API
  wpAuthToken: text("wp_auth_token"), // Legacy - can be deprecated
  wpUserId: text("wp_user_id"),
  
  // WordPress Pull Plugin credentials (inbound: WP → CS)
  wpPullSecret: text("wp_pull_secret"), // Secret for plugin authentication
  
  // Publishing settings
  wpDefaultCategory: text("wp_default_category"),
  wpDefaultStatus: text("wp_default_status").default("draft"),
  wpDefaultAuthor: text("wp_default_author"),
  publishingMode: text("publishing_mode").default("plugin"), // "plugin" | "rest" | "both"
  
  // Category & Tag sync tracking
  lastCategorySync: timestamp("last_category_sync"),
  lastTagSync: timestamp("last_tag_sync"),
  categoriesCount: integer("categories_count").default(0),
  tagsCount: integer("tags_count").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_sites_workspace").on(table.workspaceId),
]);

export const insertSiteSchema = createInsertSchema(sites).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSite = z.infer<typeof insertSiteSchema>;
export type Site = typeof sites.$inferSelect;

// WordPress Categories (synced from WP sites)
export const wpCategories = pgTable("wp_categories", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  siteId: varchar("site_id", { length: 36 }).notNull(),
  wpCategoryId: integer("wp_category_id").notNull(), // WordPress category ID
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  parentId: integer("parent_id"), // WordPress parent category ID
  count: integer("count").default(0), // Post count
  syncedAt: timestamp("synced_at").defaultNow(),
}, (table) => [
  index("idx_wp_categories_site").on(table.siteId),
  unique("wp_category_site_unique").on(table.siteId, table.wpCategoryId),
]);

export type WpCategory = typeof wpCategories.$inferSelect;

// WordPress Tags (synced from WP sites)
export const wpTags = pgTable("wp_tags", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  siteId: varchar("site_id", { length: 36 }).notNull(),
  wpTagId: integer("wp_tag_id").notNull(), // WordPress tag ID
  name: text("name").notNull(),
  slug: text("slug").notNull(),
  description: text("description"),
  count: integer("count").default(0), // Post count
  syncedAt: timestamp("synced_at").defaultNow(),
}, (table) => [
  index("idx_wp_tags_site").on(table.siteId),
  unique("wp_tag_site_unique").on(table.siteId, table.wpTagId),
]);

export type WpTag = typeof wpTags.$inferSelect;

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
export const targetTypes = ["wordpress", "wordpress_pull", "webflow", "x", "linkedin", "meta", "email", "custom"] as const;
export type TargetType = typeof targetTypes[number];

// Publish status
export const publishStatuses = ["queued", "scheduled", "running", "succeeded", "failed", "cancelled"] as const;
export type PublishStatus = typeof publishStatuses[number];

// Target health status
export const targetHealthStatuses = ["ok", "fail", "unknown"] as const;
export type TargetHealthStatus = typeof targetHealthStatuses[number];

// Publishing Targets (evolved to support automation pipeline)
export const publishingTargets = pgTable("publishing_targets", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id", { length: 36 }).notNull(),
  contentSiteId: varchar("content_site_id", { length: 36 }),
  brandId: varchar("brand_id", { length: 36 }),
  type: text("type").notNull().$type<TargetType>(),
  name: text("name").notNull(),
  credentialsEncrypted: text("credentials_encrypted"),
  configJson: jsonb("config_json").default({}),
  
  // Publishing policy
  requireFeaturedImage: boolean("require_featured_image").default(true),
  languageMode: text("language_mode").default("any"),
  allowedLanguages: text("allowed_languages").array().default([]),
  
  // Status
  isActive: boolean("is_active").default(true),
  
  // Health check fields
  lastHealthCheckAt: timestamp("last_health_check_at"),
  lastHealthStatus: text("last_health_status").$type<TargetHealthStatus>().default("unknown"),
  lastHealthMessage: text("last_health_message"),
  
  // Default publishing settings
  defaultPostStatus: text("default_post_status").default("publish"),
  defaultPostType: text("default_post_type").default("posts"),
  
  // WordPress Pull connector fields (type = wordpress_pull)
  siteId: varchar("site_id", { length: 64 }), // Public identifier for plugin (cs_site_XXXXXXXX)
  secretHash: text("secret_hash"), // bcrypt hash of secret (never store raw)
  secretLast4: varchar("secret_last_4", { length: 4 }), // Last 4 chars for display
  secretCreatedAt: timestamp("secret_created_at"),
  secretRotatedAt: timestamp("secret_rotated_at"),
  wpSiteUrl: text("wp_site_url"), // Informational URL (not required for auth)
  lastPullAt: timestamp("last_pull_at"),
  lastReportAt: timestamp("last_report_at"),
  lastErrorCode: text("last_error_code"),
  lastErrorMessage: text("last_error_message"),
  
  // Access control - who created this target
  createdByUserId: varchar("created_by_user_id", { length: 255 }),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_publishing_targets_workspace").on(table.workspaceId),
  index("idx_publishing_targets_content_site").on(table.contentSiteId),
  index("idx_publishing_targets_active").on(table.isActive),
  uniqueIndex("idx_publishing_targets_site_id").on(table.siteId),
  index("idx_publishing_targets_created_by").on(table.createdByUserId),
]);

export const insertPublishingTargetSchema = createInsertSchema(publishingTargets).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  lastHealthCheckAt: true,
  lastHealthStatus: true,
  lastHealthMessage: true,
  secretHash: true,
  secretLast4: true,
  secretCreatedAt: true,
  secretRotatedAt: true,
  lastPullAt: true,
  lastReportAt: true,
  lastErrorCode: true,
  lastErrorMessage: true,
});
export type InsertPublishingTarget = z.infer<typeof insertPublishingTargetSchema>;
export type PublishingTarget = typeof publishingTargets.$inferSelect;

// WordPress Pull Job statuses
export const wpPullJobStatuses = ["queued", "leased", "publishing", "published", "failed"] as const;
export type WpPullJobStatus = typeof wpPullJobStatuses[number];

// WordPress Pull Jobs (job queue for plugin-based publishing)
export const wpPullJobs = pgTable("wp_pull_jobs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  targetId: varchar("target_id", { length: 36 }).notNull(),
  siteId: varchar("site_id", { length: 64 }).notNull(), // Redundant index for fast pull by plugin
  
  // Content reference (can be from various sources)
  storyId: varchar("story_id", { length: 36 }),
  pipelineItemId: varchar("pipeline_item_id", { length: 36 }),
  
  // Content payload for WordPress
  title: text("title").notNull(),
  contentHtml: text("content_html").notNull(),
  postStatus: text("post_status").default("publish"), // draft | publish
  categories: text("categories").array(),
  tags: text("tags").array(),
  excerpt: text("excerpt"),
  slug: text("slug"),
  sourceUrl: text("source_url"),
  featuredImageUrl: text("featured_image_url"),
  featuredImageCredit: text("featured_image_credit"), // NEW: Image attribution
  featuredImageCaption: text("featured_image_caption"), // NEW: Image caption/alt
  metadataJson: jsonb("metadata_json").default({}), // topicId, storyId, etc.
  
  // Sanitized payload (Step 2F - canonical source for plugin)
  payloadJson: jsonb("payload_json"),
  storyHash: text("story_hash"),
  
  // Job status
  status: text("status").notNull().$type<WpPullJobStatus>().default("queued"),
  
  // Lease fields (prevent duplicate processing)
  leaseToken: varchar("lease_token", { length: 64 }),
  leaseExpiresAt: timestamp("lease_expires_at"),
  
  // Tracking
  attempts: integer("attempts").default(0),
  lastAttemptAt: timestamp("last_attempt_at"),
  
  // Result
  resultWpPostId: integer("result_wp_post_id"),
  resultWpUrl: text("result_wp_url"),
  error: text("error"),
  
  // Callback evidence fields (v0.8.0+)
  callbackImageHttpCode: integer("callback_image_http_code"),
  callbackImageBytes: integer("callback_image_bytes"),
  callbackWpAttachmentId: integer("callback_wp_attachment_id"),
  callbackSetThumbnailOk: boolean("callback_set_thumbnail_ok"),
  callbackErrorStep: text("callback_error_step"),
  callbackErrorDetails: text("callback_error_details"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_wp_pull_jobs_target").on(table.targetId),
  index("idx_wp_pull_jobs_site_id").on(table.siteId),
  index("idx_wp_pull_jobs_status").on(table.status),
  index("idx_wp_pull_jobs_lease").on(table.leaseExpiresAt),
]);

export const insertWpPullJobSchema = createInsertSchema(wpPullJobs).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  leaseToken: true,
  leaseExpiresAt: true,
  attempts: true,
  lastAttemptAt: true,
  resultWpPostId: true,
  resultWpUrl: true,
  error: true,
});
export type InsertWpPullJob = z.infer<typeof insertWpPullJobSchema>;
export type WpPullJob = typeof wpPullJobs.$inferSelect;

// Plugin request log reason codes
export const pluginRequestReasons = [
  "AUTH_SUCCESS", "AUTH_FAILED", "SITE_NOT_FOUND", "SECRET_INVALID", 
  "RATE_LIMIT", "REPLAY_DETECTED", "SERVER_ERROR", "JOB_LEASED", 
  "JOB_NONE", "REPORT_SUCCESS", "REPORT_FAILED", "HEARTBEAT"
] as const;
export type PluginRequestReason = typeof pluginRequestReasons[number];

// WordPress Plugin Request Logs (for debugging - keeps last 20 per site)
export const wpPluginRequestLogs = pgTable("wp_plugin_request_logs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  siteId: varchar("site_id", { length: 64 }).notNull(),
  targetId: varchar("target_id", { length: 36 }),
  
  // Request details
  endpoint: text("endpoint").notNull(), // "pull", "report", "handshake", "heartbeat"
  method: text("method").notNull(), // GET, POST
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  
  // Result
  reason: text("reason").notNull().$type<PluginRequestReason>(),
  httpStatus: integer("http_status").notNull(),
  responseMs: integer("response_ms"),
  
  // Payload summary (redacted secrets)
  requestSummary: text("request_summary"), // e.g., "siteId=cs_site_XXX, secret=****x41M"
  responseSummary: text("response_summary"), // e.g., "jobId=abc123" or "error=Invalid secret"
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_wp_plugin_logs_site_id").on(table.siteId),
  index("idx_wp_plugin_logs_created").on(table.createdAt),
]);

export const insertWpPluginRequestLogSchema = createInsertSchema(wpPluginRequestLogs).omit({ 
  id: true, 
  createdAt: true,
});
export type InsertWpPluginRequestLog = z.infer<typeof insertWpPluginRequestLogSchema>;
export type WpPluginRequestLog = typeof wpPluginRequestLogs.$inferSelect;

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
  domain: text("domain"), // Publisher domain (e.g., "albayan.ae")
  description: text("description"),
  language: text("language").default("en"),
  region: text("region"), // e.g., "gcc", "mena", "europe", "global"
  country: text("country"), // ISO code e.g., "AE", "SA", nullable for regional/global
  tags: text("tags").array(),
  mediaTier: text("media_tier").default("tier_3"), // Legacy field
  tier: integer("tier"), // 1, 2, or 3 (null = compute dynamically)
  isOfficial: text("is_official").default("false"), // "true" for official national/regional media
  isActive: text("is_active").default("true"),
  approvalStatus: text("approval_status").default("approved"), // "pending", "approved", "rejected"
  approvedBy: varchar("approved_by", { length: 36 }), // Site admin user ID
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  fetchIntervalMinutes: integer("fetch_interval_minutes").default(60),
  lastFetchedAt: timestamp("last_fetched_at"),
  lastSuccessAt: timestamp("last_success_at"),
  lastError: text("last_error"),
  itemCount: integer("item_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_sources_workspace").on(table.workspaceId),
  index("idx_sources_region").on(table.region),
  index("idx_sources_country").on(table.country),
  index("idx_sources_approval").on(table.approvalStatus),
]);

export const insertSourceSchema = createInsertSchema(sources).omit({ id: true, createdAt: true, updatedAt: true, lastFetchedAt: true, lastSuccessAt: true, lastError: true, itemCount: true });
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
  pipelineItemId: varchar("pipeline_item_id", { length: 36 }),
  title: text("title").notNull(),
  angle: text("angle"),
  body: text("body"),
  provenance: jsonb("provenance").default([]),
  status: text("status").notNull().$type<DraftStatus>().default("pending"),
  reviewNotes: text("review_notes"),
  assetId: varchar("asset_id", { length: 36 }),
  featuredImageId: varchar("featured_image_id", { length: 36 }),
  automationSource: text("automation_source"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_drafts_workspace").on(table.workspaceId),
  index("idx_drafts_topic").on(table.topicId),
  index("idx_drafts_story").on(table.storyId),
  index("idx_drafts_status").on(table.status),
  index("idx_drafts_pipeline_item").on(table.pipelineItemId),
]);

export const insertDraftSchema = createInsertSchema(drafts).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDraft = z.infer<typeof insertDraftSchema>;
export type Draft = typeof drafts.$inferSelect;

// Quiet hours configuration interface
export interface QuietHoursConfig {
  start: string;  // HH:MM format
  end: string;    // HH:MM format
  timezone: string;  // e.g., "Asia/Dubai"
}

// Output settings configuration interface
export interface OutputSettings {
  tone?: string;
  style?: string;
  length?: "short" | "medium" | "long";
  attribution?: boolean;
  includeSourceLinks?: boolean;
}

// Policy flags configuration interface
export interface PolicyFlags {
  avoidPolitics?: boolean;
  avoidConflict?: boolean;
  avoidReligion?: boolean;
  customBlockedTopics?: string[];
}

// Topics (evolved from automations - now act as automation pipelines)
export const topics = pgTable("topics", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  workspaceId: varchar("workspace_id", { length: 36 }).notNull(),
  siteId: varchar("site_id", { length: 36 }), // Nullable - topics can exist without sites (using publishing targets instead)
  name: text("name").notNull(),
  description: text("description"),
  contentIntent: text("content_intent").notNull().$type<ContentIntent>().default("news_monitoring"),
  query: text("query"),
  language: text("language").default("en"),
  region: text("region").notNull().default("global"),
  countries: text("countries").array().default([]),
  filters: jsonb("filters").default({}),
  
  // Source selection
  sourceMode: text("source_mode").$type<SourceMode>().default("all"),
  sourceIds: text("source_ids").array(),
  mediaTierRules: jsonb("media_tier_rules").default({}),
  
  // Keywords for matching
  includeKeywords: text("include_keywords").array().default([]),
  excludeKeywords: text("exclude_keywords").array().default([]),
  
  // Policy flags for content filtering
  policyFlags: jsonb("policy_flags").default({}),
  
  // Automation settings
  automationMode: text("automation_mode").$type<AutomationMode>().default("auto"),
  schedule: text("schedule"),
  dailyCap: integer("daily_cap").default(5),
  minSpacingMinutes: integer("min_spacing_minutes").default(120),
  publishIntervalMinutes: integer("publish_interval_minutes").default(2), // Fast publishing interval (1-60 minutes)
  quietHours: jsonb("quiet_hours"),
  
  // Publishing schedule configuration
  timezone: text("timezone").default("UTC"),
  publishTimes: text("publish_times").array().default([]),
  articlesPerRun: integer("articles_per_run").default(3),
  runIntervalMinutes: integer("run_interval_minutes").default(5),
  
  // Legacy fields (kept for compatibility)
  outputVolumePerDay: integer("output_volume_per_day").default(5),
  reviewMode: text("review_mode").default("manual"),
  autoPublish: text("auto_publish").default("false"),
  autoGenerateVisuals: text("auto_generate_visuals").default("false"),
  
  // Publishing configuration
  publishingTargetId: varchar("publishing_target_id", { length: 36 }),
  taxonomyRules: jsonb("taxonomy_rules").default({}),
  outputSettings: jsonb("output_settings").default({}),
  
  // Status and run tracking
  status: text("status").$type<TopicStatus>().default("draft"), // User-controlled lifecycle only
  isLive: text("is_live").default("false"), // Legacy field - DEPRECATED, use status instead
  
  // Denormalized fields for fast UI queries (derived from automation_job_runs)
  lastRunAt: timestamp("last_run_at"),
  lastRunId: varchar("last_run_id", { length: 36 }),
  lastRunStatus: text("last_run_status"), // Denormalized job status: "queued" | "running" | "success" | "fail" | "timeout"
  firstRunAt: timestamp("first_run_at"),
  lastError: text("last_error"),
  nextRunAt: timestamp("next_run_at"),
  
  // Stats (for dashboard display)
  publishedToday: integer("published_today").default(0),
  publishedTodayResetAt: timestamp("published_today_reset_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_topics_workspace").on(table.workspaceId),
  index("idx_topics_site").on(table.siteId),
  index("idx_topics_is_live").on(table.isLive),
  // Prevent duplicate topic names within the same site
  unique("unique_site_topic_name").on(table.siteId, table.name),
]);

export const insertTopicSchema = createInsertSchema(topics).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  lastRunAt: true, 
  nextRunAt: true,
  publishedToday: true,
  publishedTodayResetAt: true,
});
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
  publishingTarget: one(publishingTargets, { fields: [topics.publishingTargetId], references: [publishingTargets.id] }),
  drafts: many(drafts),
  topicSources: many(topicSources),
  pipelineItems: many(pipelineItems),
  automationJobRuns: many(automationJobRuns),
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

// ============ TOPIC STORIES (persisted relevance for topic-specific story filtering) ============

export const topicStories = pgTable("topic_stories", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  topicId: varchar("topic_id", { length: 36 }).notNull(),
  storyId: varchar("story_id", { length: 36 }).notNull(),
  relevanceScore: numeric("relevance_score", { precision: 5, scale: 4 }).notNull(),
  matchedTerms: text("matched_terms").array().default([]),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_topic_stories_topic").on(table.topicId),
  index("idx_topic_stories_story").on(table.storyId),
  index("idx_topic_stories_score").on(table.relevanceScore),
  uniqueIndex("uniq_topic_story").on(table.topicId, table.storyId),
]);

export const insertTopicStorySchema = createInsertSchema(topicStories).omit({ id: true, createdAt: true });
export type InsertTopicStory = z.infer<typeof insertTopicStorySchema>;
export type TopicStory = typeof topicStories.$inferSelect;

export const topicStoriesRelations = relations(topicStories, ({ one }) => ({
  topic: one(topics, { fields: [topicStories.topicId], references: [topics.id] }),
  story: one(stories, { fields: [topicStories.storyId], references: [stories.id] }),
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

// ============ AUTOMATION PIPELINE ============

// Pipeline item status - 12-state machine for automation workflow
export const pipelineItemStatuses = [
  "fetched",      // Story fetched from sources
  "matched",      // Matched to pipeline rules
  "deduped",      // Passed deduplication check
  "ranked",       // Scored and ranked
  "generated",    // AI content generated
  "gated",        // Passed quality gate
  "scheduled",    // Scheduled for publishing
  "publishing",   // Currently publishing
  "published",    // Successfully published to target
  "verified",     // Verified post exists on target
  "retrying",     // Retrying after failure
  "quarantined",  // Failed with actionable reason
  "skipped",      // Skipped due to cap/policy
] as const;
export type PipelineItemStatus = typeof pipelineItemStatuses[number];

// Quarantine reasons for pipeline items
export const quarantineReasons = [
  "language_mismatch",
  "missing_featured_image",
  "policy_block",
  "invalid_content",
  "publish_failed",
  "verify_failed",
  "taxonomy_missing",
  "rate_limited",
  "unknown_error",
] as const;
export type QuarantineReason = typeof quarantineReasons[number];

// Skip reasons for pipeline items
export const skipReasons = [
  "daily_cap_reached",
  "quiet_hours",
  "low_relevance",
  "duplicate",
  "no_target",
  "manual_skip",
] as const;
export type SkipReason = typeof skipReasons[number];

// Pipeline Items - tracks each story through the automation pipeline
export const pipelineItems = pgTable("pipeline_items", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  topicId: varchar("topic_id", { length: 36 }).notNull().references(() => topics.id, { onDelete: "cascade" }),
  storyId: varchar("story_id", { length: 36 }).notNull().references(() => stories.id, { onDelete: "cascade" }),
  workspaceId: varchar("workspace_id", { length: 36 }).notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  
  // Status tracking
  status: text("status").notNull().$type<PipelineItemStatus>().default("fetched"),
  score: numeric("score", { precision: 8, scale: 4 }),
  dedupeHash: text("dedupe_hash"),
  languageDetected: text("language_detected"),
  
  // Generated content
  generatedTitle: text("generated_title"),
  generatedBody: text("generated_body"),
  generatedExcerpt: text("generated_excerpt"),
  generatedTags: jsonb("generated_tags").default([]),
  generatedCategory: text("generated_category"),
  
  // Publishing
  targetId: varchar("target_id", { length: 36 }).references(() => publishingTargets.id),
  targetPostId: text("target_post_id"),
  targetPermalink: text("target_permalink"),
  targetPostStatus: text("target_post_status"),
  
  // Idempotency fields for deduplication
  storyHash: text("story_hash"),
  canonicalSourceUrl: text("canonical_source_url"),
  
  // Featured image tracking
  featuredImageUrl: text("featured_image_url"),
  featuredImageMediaId: text("featured_image_media_id"),
  featuredImageCredit: text("featured_image_credit"), // Attribution/credit for sourced images
  featuredImageCaption: text("featured_image_caption"), // Caption/alt text for images
  aiGeneratedImageUrl: text("ai_generated_image_url"), // URL for AI-generated fallback images
  
  // Retry and error tracking
  publishAttempts: integer("publish_attempts").default(0),
  retryCount: integer("retry_count").default(0),
  lastErrorCode: text("last_error_code"),
  lastErrorMessage: text("last_error_message"),
  lastErrorPayload: jsonb("last_error_payload"),
  
  // Quarantine/skip metadata
  quarantineReason: text("quarantine_reason").$type<QuarantineReason>(),
  skipReason: text("skip_reason").$type<SkipReason>(),
  
  // Scheduling
  scheduledFor: timestamp("scheduled_for"),
  publishedAt: timestamp("published_at"),
  verifiedAt: timestamp("verified_at"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("idx_pipeline_items_topic").on(table.topicId),
  index("idx_pipeline_items_story").on(table.storyId),
  index("idx_pipeline_items_workspace").on(table.workspaceId),
  index("idx_pipeline_items_status").on(table.status),
  index("idx_pipeline_items_scheduled").on(table.scheduledFor),
  index("idx_pipeline_items_story_hash").on(table.storyHash),
  unique("pipeline_item_unique").on(table.topicId, table.storyId),
  unique("pipeline_item_target_hash_unique").on(table.targetId, table.storyHash),
]);

export const insertPipelineItemSchema = createInsertSchema(pipelineItems).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPipelineItem = z.infer<typeof insertPipelineItemSchema>;
export type PipelineItem = typeof pipelineItems.$inferSelect;

// Automation Job Runs - tracks execution of pipeline jobs
export const automationJobRuns = pgTable("automation_job_runs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  topicId: varchar("topic_id", { length: 36 }).references(() => topics.id, { onDelete: "cascade" }),
  workspaceId: varchar("workspace_id", { length: 36 }).references(() => workspaces.id, { onDelete: "cascade" }),
  
  jobType: text("job_type").notNull().$type<AutomationJobType>(),
  status: text("status").notNull().$type<AutomationJobStatus>().default("running"),
  
  startedAt: timestamp("started_at").defaultNow(),
  endedAt: timestamp("ended_at"),
  
  // Counters
  processedCount: integer("processed_count").default(0),
  successCount: integer("success_count").default(0),
  failCount: integer("fail_count").default(0),
  skippedCount: integer("skipped_count").default(0),
  quarantinedCount: integer("quarantined_count").default(0),
  
  errorSummary: text("error_summary"),
  logs: jsonb("logs").default([]),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_automation_job_runs_topic").on(table.topicId),
  index("idx_automation_job_runs_workspace").on(table.workspaceId),
  index("idx_automation_job_runs_type").on(table.jobType),
  index("idx_automation_job_runs_status").on(table.status),
]);

export const insertAutomationJobRunSchema = createInsertSchema(automationJobRuns).omit({ id: true, createdAt: true });
export type InsertAutomationJobRun = z.infer<typeof insertAutomationJobRunSchema>;
export type AutomationJobRun = typeof automationJobRuns.$inferSelect;

// Publish attempt result
export const publishAttemptResults = ["success", "fail"] as const;
export type PublishAttemptResult = typeof publishAttemptResults[number];

// Publish Attempts - detailed logging of each publish attempt
export const publishAttempts = pgTable("publish_attempts", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  pipelineItemId: varchar("pipeline_item_id", { length: 36 }).notNull().references(() => pipelineItems.id, { onDelete: "cascade" }),
  targetId: varchar("target_id", { length: 36 }).notNull().references(() => publishingTargets.id),
  
  attemptNumber: integer("attempt_number").notNull().default(1),
  
  requestPayload: jsonb("request_payload"),
  responseStatus: integer("response_status"),
  responseBody: jsonb("response_body"),
  
  result: text("result").notNull().$type<PublishAttemptResult>(),
  errorMessage: text("error_message"),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("idx_publish_attempts_item").on(table.pipelineItemId),
  index("idx_publish_attempts_target").on(table.targetId),
]);

export const insertPublishAttemptSchema = createInsertSchema(publishAttempts).omit({ id: true, createdAt: true });
export type InsertPublishAttempt = z.infer<typeof insertPublishAttemptSchema>;
export type PublishAttempt = typeof publishAttempts.$inferSelect;

// Publishing Item Statuses - separate pipeline for publishing operations
export const publishingItemStatuses = [
  "draft_ready",      // Ready for editorial review
  "editor_review",    // Under editorial review
  "scheduled",        // Scheduled for publishing
  "pushing",          // Currently pushing to WordPress
  "published",        // Successfully published
  "publish_failed",   // Publish attempt failed
  "verified",         // Post verified on WordPress
] as const;
export type PublishingItemStatus = typeof publishingItemStatuses[number];

// Publishing Items - separate operational pipeline for publishing
export const publishingItems = pgTable("publishing_items", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  
  // Core references
  pipelineItemId: varchar("pipeline_item_id", { length: 36 }).notNull().unique().references(() => pipelineItems.id, { onDelete: "cascade" }),
  topicId: varchar("topic_id", { length: 36 }).references(() => topics.id, { onDelete: "cascade" }),
  workspaceId: varchar("workspace_id", { length: 36 }).notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  
  // Publishing status
  status: text("status").notNull().$type<PublishingItemStatus>().default("draft_ready"),
  
  // Scheduling
  scheduledAt: timestamp("scheduled_at"),
  
  // WordPress connector info
  wpConnectorId: varchar("wp_connector_id", { length: 36 }).references(() => publishingTargets.id),
  wpPostId: text("wp_post_id"),
  publishedUrl: text("published_url"),
  
  // Error tracking
  lastError: text("last_error"),
  attemptCount: integer("attempt_count").default(0),
  
  // Metadata
  handedOffAt: timestamp("handed_off_at").defaultNow(),
  publishedAt: timestamp("published_at"),
  verifiedAt: timestamp("verified_at"),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("idx_publishing_items_pipeline_item").on(table.pipelineItemId),
  index("idx_publishing_items_status").on(table.status),
  index("idx_publishing_items_scheduled").on(table.scheduledAt),
  index("idx_publishing_items_connector").on(table.wpConnectorId),
  index("idx_publishing_items_topic").on(table.topicId),
  index("idx_publishing_items_workspace").on(table.workspaceId),
]);

export const insertPublishingItemSchema = createInsertSchema(publishingItems).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPublishingItem = z.infer<typeof insertPublishingItemSchema>;
export type PublishingItem = typeof publishingItems.$inferSelect;

// Pipeline item relations
export const pipelineItemsRelations = relations(pipelineItems, ({ one, many }) => ({
  topic: one(topics, { fields: [pipelineItems.topicId], references: [topics.id] }),
  story: one(stories, { fields: [pipelineItems.storyId], references: [stories.id] }),
  workspace: one(workspaces, { fields: [pipelineItems.workspaceId], references: [workspaces.id] }),
  target: one(publishingTargets, { fields: [pipelineItems.targetId], references: [publishingTargets.id] }),
  publishAttempts: many(publishAttempts),
}));

export const automationJobRunsRelations = relations(automationJobRuns, ({ one }) => ({
  topic: one(topics, { fields: [automationJobRuns.topicId], references: [topics.id] }),
  workspace: one(workspaces, { fields: [automationJobRuns.workspaceId], references: [workspaces.id] }),
}));

export const publishAttemptsRelations = relations(publishAttempts, ({ one }) => ({
  pipelineItem: one(pipelineItems, { fields: [publishAttempts.pipelineItemId], references: [pipelineItems.id] }),
  target: one(publishingTargets, { fields: [publishAttempts.targetId], references: [publishingTargets.id] }),
}));

export const publishingItemsRelations = relations(publishingItems, ({ one }) => ({
  pipelineItem: one(pipelineItems, { fields: [publishingItems.pipelineItemId], references: [pipelineItems.id] }),
  topic: one(topics, { fields: [publishingItems.topicId], references: [topics.id] }),
  workspace: one(workspaces, { fields: [publishingItems.workspaceId], references: [workspaces.id] }),
  wpConnector: one(publishingTargets, { fields: [publishingItems.wpConnectorId], references: [publishingTargets.id] }),
}));

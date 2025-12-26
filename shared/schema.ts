import { pgTable, text, varchar, timestamp, jsonb, integer, numeric, index, unique } from "drizzle-orm/pg-core";
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
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWorkspaceSchema = createInsertSchema(workspaces).omit({ id: true, createdAt: true });
export type InsertWorkspace = z.infer<typeof insertWorkspaceSchema>;
export type Workspace = typeof workspaces.$inferSelect;

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

export const assetVersionsRelations = relations(assetVersions, ({ one, many }) => ({
  asset: one(assets, { fields: [assetVersions.assetId], references: [assets.id] }),
  comments: many(comments),
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

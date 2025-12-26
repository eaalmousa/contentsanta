import { pgTable, text, varchar, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Workspaces
export const workspaces = pgTable("workspaces", {
  id: varchar("id", { length: 36 }).primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
});

export const insertWorkspaceSchema = createInsertSchema(workspaces).omit({ id: true });
export type InsertWorkspace = z.infer<typeof insertWorkspaceSchema>;
export type Workspace = typeof workspaces.$inferSelect;

// Brands
export const brands = pgTable("brands", {
  id: varchar("id", { length: 36 }).primaryKey(),
  workspaceId: varchar("workspace_id", { length: 36 }).notNull(),
  name: text("name").notNull(),
  defaultLanguage: text("default_language").default("en"),
  industry: text("industry"),
  audience: text("audience"),
  tone: text("tone"),
  approvedTerms: text("approved_terms").array(),
  forbiddenWords: text("forbidden_words").array(),
  styleRules: text("style_rules"),
});

export const insertBrandSchema = createInsertSchema(brands).omit({ id: true });
export type InsertBrand = z.infer<typeof insertBrandSchema>;
export type Brand = typeof brands.$inferSelect;

// Input types
export const inputTypes = ["url", "text", "pdf", "docx", "transcript", "brief"] as const;
export type InputType = typeof inputTypes[number];

// Inputs (raw content)
export const inputs = pgTable("inputs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  workspaceId: varchar("workspace_id", { length: 36 }).notNull(),
  brandId: varchar("brand_id", { length: 36 }),
  projectId: varchar("project_id", { length: 36 }),
  type: text("type").notNull().$type<InputType>(),
  title: text("title").notNull(),
  rawText: text("raw_text"),
  sourceUrl: text("source_url"),
  language: text("language").default("en"),
  createdAt: timestamp("created_at").defaultNow(),
});

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
export const runStatuses = ["pending", "running", "completed", "failed"] as const;
export type RunStatus = typeof runStatuses[number];

// Workflow runs
export const workflowRuns = pgTable("workflow_runs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  workspaceId: varchar("workspace_id", { length: 36 }).notNull(),
  brandId: varchar("brand_id", { length: 36 }),
  inputId: varchar("input_id", { length: 36 }).notNull(),
  workflowType: text("workflow_type").notNull().$type<WorkflowType>(),
  status: text("status").notNull().$type<RunStatus>().default("pending"),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  costEstimate: integer("cost_estimate"),
});

export const insertWorkflowRunSchema = createInsertSchema(workflowRuns).omit({ 
  id: true, 
  startedAt: true, 
  completedAt: true,
  status: true 
});
export type InsertWorkflowRun = z.infer<typeof insertWorkflowRunSchema>;
export type WorkflowRun = typeof workflowRuns.$inferSelect;

// Asset statuses
export const assetStatuses = ["draft", "review", "approved", "published", "archived"] as const;
export type AssetStatus = typeof assetStatuses[number];

// Assets (generated content)
export const assets = pgTable("assets", {
  id: varchar("id", { length: 36 }).primaryKey(),
  workspaceId: varchar("workspace_id", { length: 36 }).notNull(),
  brandId: varchar("brand_id", { length: 36 }),
  inputId: varchar("input_id", { length: 36 }),
  runId: varchar("run_id", { length: 36 }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  format: text("format").default("markdown"),
  channelType: text("channel_type"),
  language: text("language").default("en"),
  status: text("status").notNull().$type<AssetStatus>().default("draft"),
  workflowType: text("workflow_type").$type<WorkflowType>(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAssetSchema = createInsertSchema(assets).omit({ id: true, createdAt: true });
export type InsertAsset = z.infer<typeof insertAssetSchema>;
export type Asset = typeof assets.$inferSelect;

// Projects
export const projects = pgTable("projects", {
  id: varchar("id", { length: 36 }).primaryKey(),
  workspaceId: varchar("workspace_id", { length: 36 }).notNull(),
  brandId: varchar("brand_id", { length: 36 }),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

// Users (simplified for MVP)
export const users = pgTable("users", {
  id: varchar("id", { length: 36 }).primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name"),
  email: text("email"),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

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
    label: "Arabic → English", 
    description: "Translate Arabic content to English", 
    icon: "Languages" 
  },
  translation_en_ar: { 
    label: "English → Arabic", 
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

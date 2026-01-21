import { 
  workspaces, type Workspace, type InsertWorkspace,
  workspaceUsers, type WorkspaceUser, type InsertWorkspaceUser,
  brands, type Brand, type InsertBrand,
  templates, type Template, type InsertTemplate,
  projects, type Project, type InsertProject,
  inputs, type Input, type InsertInput,
  workflows, type Workflow, type InsertWorkflow,
  workflowRuns, type WorkflowRun, type InsertWorkflowRun,
  assets, type Asset, type InsertAsset,
  assetVersions, type AssetVersion, type InsertAssetVersion,
  comments, type Comment, type InsertComment,
  publishingTargets, type PublishingTarget, type InsertPublishingTarget,
  publishJobs, type PublishJob, type InsertPublishJob,
  wpPullJobs, type WpPullJob, type InsertWpPullJob, type WpPullJobStatus,
  wpPluginRequestLogs, type WpPluginRequestLog, type InsertWpPluginRequestLog,
  usageLedger, type UsageLedger, type InsertUsageLedger,
  sources, type Source, type InsertSource,
  sourceItems, type SourceItem, type InsertSourceItem,
  sourceItemMentions, type SourceItemMention, type InsertSourceItemMention,
  fetchRuns, type FetchRun, type InsertFetchRun,
  automations, type Automation, type InsertAutomation,
  automationRuns, type AutomationRun, type InsertAutomationRun,
  automationRunItems, type AutomationRunItem, type InsertAutomationRunItem,
  contentGoals, type ContentGoal, type InsertContentGoal,
  discoveryJobs, type DiscoveryJob, type InsertDiscoveryJob,
  discoveredSources, type DiscoveredSource, type InsertDiscoveredSource,
  contentPlans, type ContentPlan, type InsertContentPlan,
  stories, type Story, type InsertStory,
  storyItems, type StoryItem, type InsertStoryItem,
  drafts, type Draft, type InsertDraft,
  topics, type Topic, type InsertTopic,
  topicSources, type TopicSource, type InsertTopicSource,
  topicStories, type TopicStory, type InsertTopicStory,
  topicSourceRecommendations, type TopicSourceRecommendation,
  imageAssets, type ImageAsset, type InsertImageAsset,
  imageUsages, type ImageUsage, type InsertImageUsage,
  wpTaxonomyCache, type WpTaxonomyCache, type InsertWpTaxonomyCache, type WpTaxonomyType,
  pipelineItems, type PipelineItem, type InsertPipelineItem, type PipelineItemStatus,
  automationJobRuns, type AutomationJobRun, type InsertAutomationJobRun, type AutomationJobType, type AutomationJobStatus,
  publishAttempts, type PublishAttempt, type InsertPublishAttempt,
  type TargetHealthStatus,
  type RoleType,
  type RunStatus,
  type AssetStatus,
  type SourceItemStatus,
  type AutomationRunStatus,
  type DiscoveryJobStatus,
  type DiscoveredSourceStatus,
  type DraftStatus,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, ilike, or, inArray } from "drizzle-orm";

export interface IStorage {
  // Workspaces
  getWorkspaces(): Promise<Workspace[]>;
  getWorkspace(id: string): Promise<Workspace | undefined>;
  getWorkspaceBySlug(slug: string): Promise<Workspace | undefined>;
  createWorkspace(data: InsertWorkspace): Promise<Workspace>;
  updateWorkspace(id: string, data: Partial<InsertWorkspace>): Promise<Workspace | undefined>;
  
  // Workspace Users
  getWorkspaceUsers(workspaceId: string): Promise<WorkspaceUser[]>;
  getWorkspaceUser(workspaceId: string, userId: string): Promise<WorkspaceUser | undefined>;
  addUserToWorkspace(data: InsertWorkspaceUser): Promise<WorkspaceUser>;
  updateWorkspaceUserRole(id: string, role: RoleType): Promise<WorkspaceUser | undefined>;
  removeUserFromWorkspace(workspaceId: string, userId: string): Promise<void>;
  getUserWorkspaces(userId: string): Promise<Workspace[]>;
  
  // Brands
  getBrands(workspaceId?: string): Promise<Brand[]>;
  getBrand(id: string): Promise<Brand | undefined>;
  createBrand(data: InsertBrand): Promise<Brand>;
  updateBrand(id: string, data: Partial<InsertBrand>): Promise<Brand | undefined>;
  deleteBrand(id: string): Promise<void>;
  
  // Templates
  getTemplates(workspaceId?: string, brandId?: string): Promise<Template[]>;
  getTemplate(id: string): Promise<Template | undefined>;
  createTemplate(data: InsertTemplate): Promise<Template>;
  updateTemplate(id: string, data: Partial<InsertTemplate>): Promise<Template | undefined>;
  deleteTemplate(id: string): Promise<void>;
  
  // Projects
  getProjects(workspaceId?: string): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(data: InsertProject): Promise<Project>;
  updateProject(id: string, data: Partial<InsertProject>): Promise<Project | undefined>;
  deleteProject(id: string): Promise<void>;
  
  // Inputs
  getInputs(workspaceId?: string): Promise<Input[]>;
  getInput(id: string): Promise<Input | undefined>;
  createInput(data: InsertInput): Promise<Input>;
  updateInput(id: string, data: Partial<InsertInput>): Promise<Input | undefined>;
  deleteInput(id: string): Promise<void>;
  
  // Workflows
  getWorkflows(workspaceId?: string): Promise<Workflow[]>;
  getWorkflow(id: string): Promise<Workflow | undefined>;
  createWorkflow(data: InsertWorkflow): Promise<Workflow>;
  updateWorkflow(id: string, data: Partial<InsertWorkflow>): Promise<Workflow | undefined>;
  deleteWorkflow(id: string): Promise<void>;
  
  // Workflow Runs
  getWorkflowRuns(workspaceId?: string): Promise<WorkflowRun[]>;
  getWorkflowRun(id: string): Promise<WorkflowRun | undefined>;
  createWorkflowRun(data: InsertWorkflowRun): Promise<WorkflowRun>;
  updateWorkflowRun(id: string, data: Partial<WorkflowRun>): Promise<WorkflowRun | undefined>;
  
  // Assets
  getAssets(workspaceId?: string, status?: AssetStatus): Promise<Asset[]>;
  getAsset(id: string): Promise<Asset | undefined>;
  createAsset(data: InsertAsset): Promise<Asset>;
  updateAsset(id: string, data: Partial<InsertAsset>): Promise<Asset | undefined>;
  deleteAsset(id: string): Promise<void>;
  
  // Asset Versions
  getAssetVersions(assetId: string): Promise<AssetVersion[]>;
  getAssetVersion(id: string): Promise<AssetVersion | undefined>;
  getLatestAssetVersion(assetId: string): Promise<AssetVersion | undefined>;
  createAssetVersion(data: InsertAssetVersion): Promise<AssetVersion>;
  updateAssetVersion(id: string, data: Partial<InsertAssetVersion>): Promise<AssetVersion | undefined>;
  
  // Comments
  getComments(assetVersionId: string): Promise<Comment[]>;
  createComment(data: InsertComment): Promise<Comment>;
  deleteComment(id: string): Promise<void>;
  
  // Publishing Targets
  getPublishingTargets(workspaceId: string): Promise<PublishingTarget[]>;
  getPublishingTarget(id: string): Promise<PublishingTarget | undefined>;
  createPublishingTarget(data: InsertPublishingTarget): Promise<PublishingTarget>;
  updatePublishingTarget(id: string, data: Partial<InsertPublishingTarget>): Promise<PublishingTarget | undefined>;
  deletePublishingTarget(id: string): Promise<void>;
  
  // Publish Jobs
  getPublishJobs(assetVersionId?: string): Promise<PublishJob[]>;
  getPublishJob(id: string): Promise<PublishJob | undefined>;
  createPublishJob(data: InsertPublishJob): Promise<PublishJob>;
  updatePublishJob(id: string, data: Partial<PublishJob>): Promise<PublishJob | undefined>;
  
  // WordPress Pull Jobs
  getPublishingTargetBySiteId(siteId: string): Promise<PublishingTarget | undefined>;
  updatePublishingTargetBySiteId(siteId: string, data: Partial<PublishingTarget>): Promise<PublishingTarget | undefined>;
  getWpPullJobs(targetId: string, status?: WpPullJobStatus): Promise<WpPullJob[]>;
  getWpPullJob(id: string): Promise<WpPullJob | undefined>;
  createWpPullJob(data: InsertWpPullJob): Promise<WpPullJob>;
  updateWpPullJob(id: string, data: Partial<WpPullJob>): Promise<WpPullJob | undefined>;
  leaseNextWpPullJob(siteId: string, leaseToken: string, leaseMinutes: number): Promise<WpPullJob | null>;
  releaseExpiredWpPullJobLeases(): Promise<number>;
  
  // WordPress Plugin Request Logs
  createPluginRequestLog(data: InsertWpPluginRequestLog): Promise<WpPluginRequestLog>;
  getPluginRequestLogs(siteId: string, limit?: number): Promise<WpPluginRequestLog[]>;
  pruneOldPluginRequestLogs(siteId: string, keepCount: number): Promise<number>;
  
  // Usage Ledger
  getUsageLedger(workspaceId: string): Promise<UsageLedger[]>;
  createUsageEntry(data: InsertUsageLedger): Promise<UsageLedger>;
  
  // Stats
  getStats(workspaceId?: string): Promise<{
    totalInputs: number;
    totalAssets: number;
    workflowRuns: number;
    approvedAssets: number;
  }>;
  
  // Sources
  getSources(workspaceId: string): Promise<Source[]>;
  getSource(id: string): Promise<Source | undefined>;
  createSource(data: InsertSource): Promise<Source>;
  updateSource(id: string, data: Partial<Source>): Promise<Source | undefined>;
  deleteSource(id: string): Promise<void>;
  getActiveSources(): Promise<Source[]>;
  getSourcesByIds(ids: string[]): Promise<Source[]>;
  
  // Source Items
  getSourceItems(workspaceId: string, status?: SourceItemStatus, sourceId?: string): Promise<SourceItem[]>;
  getSourceItem(id: string): Promise<SourceItem | undefined>;
  createSourceItem(data: InsertSourceItem): Promise<SourceItem>;
  updateSourceItem(id: string, data: Partial<SourceItem>): Promise<SourceItem | undefined>;
  getNewSourceItems(workspaceId: string, sourceIds?: string[]): Promise<SourceItem[]>;
  getRecentSourceItemsBySourceIds(sourceIds: string[], hoursBack?: number, limit?: number): Promise<SourceItem[]>;
  sourceItemExists(workspaceId: string, contentHash: string): Promise<boolean>;
  getSourceItemCount(workspaceId: string): Promise<number>;
  
  // Fetch Runs
  createFetchRun(data: InsertFetchRun): Promise<FetchRun>;
  getFetchRuns(sourceId: string, limit?: number): Promise<FetchRun[]>;
  
  // Automations
  getAutomations(workspaceId: string): Promise<Automation[]>;
  getAutomation(id: string): Promise<Automation | undefined>;
  createAutomation(data: InsertAutomation): Promise<Automation>;
  updateAutomation(id: string, data: Partial<Automation>): Promise<Automation | undefined>;
  deleteAutomation(id: string): Promise<void>;
  getActiveAutomations(): Promise<Automation[]>;
  
  // Automation Runs
  getAutomationRuns(automationId: string): Promise<AutomationRun[]>;
  getAutomationRun(id: string): Promise<AutomationRun | undefined>;
  createAutomationRun(data: InsertAutomationRun): Promise<AutomationRun>;
  updateAutomationRun(id: string, data: Partial<AutomationRun>): Promise<AutomationRun | undefined>;
  
  // Automation Run Items
  getAutomationRunItems(runId: string): Promise<AutomationRunItem[]>;
  createAutomationRunItem(data: InsertAutomationRunItem): Promise<AutomationRunItem>;
  updateAutomationRunItem(id: string, data: Partial<AutomationRunItem>): Promise<AutomationRunItem | undefined>;
  
  // Content Goals
  getContentGoals(workspaceId: string): Promise<ContentGoal[]>;
  getContentGoal(id: string): Promise<ContentGoal | undefined>;
  createContentGoal(data: InsertContentGoal): Promise<ContentGoal>;
  updateContentGoal(id: string, data: Partial<ContentGoal>): Promise<ContentGoal | undefined>;
  deleteContentGoal(id: string): Promise<void>;
  
  // Discovery Jobs
  getDiscoveryJobs(workspaceId: string, contentGoalId?: string): Promise<DiscoveryJob[]>;
  getDiscoveryJob(id: string): Promise<DiscoveryJob | undefined>;
  createDiscoveryJob(data: InsertDiscoveryJob): Promise<DiscoveryJob>;
  updateDiscoveryJob(id: string, data: Partial<DiscoveryJob>): Promise<DiscoveryJob | undefined>;
  
  // Discovered Sources
  getDiscoveredSources(discoveryJobId: string): Promise<DiscoveredSource[]>;
  getDiscoveredSource(id: string): Promise<DiscoveredSource | undefined>;
  createDiscoveredSource(data: InsertDiscoveredSource): Promise<DiscoveredSource>;
  updateDiscoveredSource(id: string, data: Partial<DiscoveredSource>): Promise<DiscoveredSource | undefined>;
  
  // Content Plans
  getContentPlans(workspaceId: string, contentGoalId?: string): Promise<ContentPlan[]>;
  getContentPlan(id: string): Promise<ContentPlan | undefined>;
  createContentPlan(data: InsertContentPlan): Promise<ContentPlan>;
  updateContentPlan(id: string, data: Partial<ContentPlan>): Promise<ContentPlan | undefined>;
  
  // Stories (clustering)
  getStories(workspaceId: string, dateBucket?: string): Promise<Story[]>;
  getStory(id: string): Promise<Story | undefined>;
  createStory(data: InsertStory): Promise<Story>;
  updateStory(id: string, data: Partial<Story>): Promise<Story | undefined>;
  findStoriesBySimilarity(workspaceId: string, similarityHash: string, dateBucket: string): Promise<Story[]>;
  
  // Story Items
  getStoryItems(storyId: string): Promise<StoryItem[]>;
  createStoryItem(data: InsertStoryItem): Promise<StoryItem | null>;
  
  // Drafts
  getDrafts(workspaceId: string, status?: DraftStatus, topicId?: string): Promise<Draft[]>;
  getDraft(id: string): Promise<Draft | undefined>;
  getDraftByPipelineItemId(pipelineItemId: string): Promise<Draft | undefined>;
  createDraft(data: InsertDraft): Promise<Draft>;
  updateDraft(id: string, data: Partial<Draft>): Promise<Draft | undefined>;
  deleteDraft(id: string): Promise<void>;
  
  // Topics
  getTopics(workspaceId: string): Promise<Topic[]>;
  getAllTopics(): Promise<Topic[]>;
  getTopic(id: string): Promise<Topic | undefined>;
  createTopic(data: InsertTopic): Promise<Topic>;
  updateTopic(id: string, data: Partial<Topic>): Promise<Topic | undefined>;
  deleteTopic(id: string): Promise<void>;
  getLiveTopics(): Promise<Topic[]>;
  
  // Topic Sources
  getTopicSources(topicId: string): Promise<TopicSource[]>;
  getEnabledSourceIdsForTopic(topicId: string): Promise<string[]>;
  upsertTopicSource(data: InsertTopicSource): Promise<TopicSource>;
  setTopicSourceEnabled(topicId: string, sourceId: string, isEnabled: boolean): Promise<void>;
  deleteTopicSources(topicId: string): Promise<void>;
  saveTopicSourceRecommendation(topicId: string, payload: any): Promise<TopicSourceRecommendation>;
  
  // Topic Stories (persisted relevance)
  getTopicStories(topicId: string, minScore?: number): Promise<(TopicStory & { story: Story })[]>;
  upsertTopicStory(data: InsertTopicStory): Promise<TopicStory>;
  deleteTopicStories(topicId: string): Promise<void>;
  
  // Image Assets
  getImageAssets(workspaceId: string, storyId?: string, sourceItemId?: string): Promise<ImageAsset[]>;
  getImageAsset(id: string): Promise<ImageAsset | undefined>;
  getPrimaryImageForStory(storyId: string): Promise<ImageAsset | undefined>;
  createImageAsset(data: InsertImageAsset): Promise<ImageAsset>;
  updateImageAsset(id: string, data: Partial<ImageAsset>): Promise<ImageAsset | undefined>;
  deleteImageAsset(id: string): Promise<void>;
  setPrimaryImageForStory(storyId: string, imageAssetId: string): Promise<void>;
  
  // Image Usages
  getImageUsages(imageAssetId: string): Promise<ImageUsage[]>;
  createImageUsage(data: InsertImageUsage): Promise<ImageUsage>;
  updateImageUsage(id: string, data: Partial<ImageUsage>): Promise<ImageUsage | undefined>;
  
  // WP Taxonomy Cache
  getWpTaxonomyCache(publishingTargetId: string, taxonomyType?: WpTaxonomyType): Promise<WpTaxonomyCache[]>;
  getWpTaxonomyCacheByIds(publishingTargetId: string, taxonomyType: WpTaxonomyType, wpIds: number[]): Promise<WpTaxonomyCache[]>;
  upsertWpTaxonomyCache(data: InsertWpTaxonomyCache): Promise<WpTaxonomyCache>;
  clearWpTaxonomyCache(publishingTargetId: string, taxonomyType?: WpTaxonomyType): Promise<void>;
  getWpTaxonomySyncStatus(publishingTargetId: string): Promise<{ categories: Date | null; tags: Date | null }>;
  
  // ============ AUTOMATION PIPELINE ============
  
  // Pipeline Items
  getPipelineItems(topicId: string, status?: PipelineItemStatus): Promise<PipelineItem[]>;
  getPipelineItemsByWorkspace(workspaceId: string, status?: PipelineItemStatus): Promise<PipelineItem[]>;
  getPipelineItem(id: string): Promise<PipelineItem | undefined>;
  getPipelineItemByTopicAndStory(topicId: string, storyId: string): Promise<PipelineItem | undefined>;
  createPipelineItem(data: InsertPipelineItem): Promise<PipelineItem>;
  updatePipelineItem(id: string, data: Partial<PipelineItem>): Promise<PipelineItem | undefined>;
  deletePipelineItem(id: string): Promise<void>;
  getScheduledPipelineItems(topicId?: string): Promise<PipelineItem[]>;
  getQuarantinedPipelineItems(workspaceId: string): Promise<PipelineItem[]>;
  
  // Automation Job Runs
  getAutomationJobRuns(topicId?: string, jobType?: AutomationJobType): Promise<AutomationJobRun[]>;
  getAutomationJobRun(id: string): Promise<AutomationJobRun | undefined>;
  createAutomationJobRun(data: InsertAutomationJobRun): Promise<AutomationJobRun>;
  updateAutomationJobRun(id: string, data: Partial<AutomationJobRun>): Promise<AutomationJobRun | undefined>;
  
  // Publish Attempts
  getPublishAttempts(pipelineItemId: string): Promise<PublishAttempt[]>;
  createPublishAttempt(data: InsertPublishAttempt): Promise<PublishAttempt>;
  
  // Publishing Target health
  updatePublishingTargetHealth(id: string, status: TargetHealthStatus, message?: string): Promise<void>;
  
  // ============ ANALYTICS ============
  getPipelineAnalytics(workspaceId: string): Promise<{
    statusCounts: Record<string, number>;
    totalItems: number;
    successRate: number;
    avgProcessingTime: number | null;
    dailyTrends: Array<{ date: string; published: number; quarantined: number; total: number }>;
    topicPerformance: Array<{ topicId: string; topicName: string; published: number; quarantined: number; pending: number }>;
    jobRunStats: { total: number; byType: Record<string, number>; recentFailures: number };
  }>;
}

export class DatabaseStorage implements IStorage {
  // Workspaces
  async getWorkspaces(): Promise<Workspace[]> {
    return await db.select().from(workspaces).orderBy(desc(workspaces.createdAt));
  }

  async getWorkspace(id: string): Promise<Workspace | undefined> {
    const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, id));
    return workspace;
  }

  async getWorkspaceBySlug(slug: string): Promise<Workspace | undefined> {
    const [workspace] = await db.select().from(workspaces).where(eq(workspaces.slug, slug));
    return workspace;
  }

  async createWorkspace(data: InsertWorkspace): Promise<Workspace> {
    const [workspace] = await db.insert(workspaces).values(data).returning();
    return workspace;
  }

  async updateWorkspace(id: string, data: Partial<InsertWorkspace>): Promise<Workspace | undefined> {
    const [workspace] = await db.update(workspaces).set(data).where(eq(workspaces.id, id)).returning();
    return workspace;
  }

  // Workspace Users
  async getWorkspaceUsers(workspaceId: string): Promise<WorkspaceUser[]> {
    return await db.select().from(workspaceUsers).where(eq(workspaceUsers.workspaceId, workspaceId));
  }

  async getWorkspaceUser(workspaceId: string, userId: string): Promise<WorkspaceUser | undefined> {
    const [wu] = await db.select().from(workspaceUsers)
      .where(and(eq(workspaceUsers.workspaceId, workspaceId), eq(workspaceUsers.userId, userId)));
    return wu;
  }

  async addUserToWorkspace(data: InsertWorkspaceUser): Promise<WorkspaceUser> {
    const [wu] = await db.insert(workspaceUsers).values(data).returning();
    return wu;
  }

  async updateWorkspaceUserRole(id: string, role: RoleType): Promise<WorkspaceUser | undefined> {
    const [wu] = await db.update(workspaceUsers).set({ role }).where(eq(workspaceUsers.id, id)).returning();
    return wu;
  }

  async removeUserFromWorkspace(workspaceId: string, userId: string): Promise<void> {
    await db.delete(workspaceUsers)
      .where(and(eq(workspaceUsers.workspaceId, workspaceId), eq(workspaceUsers.userId, userId)));
  }

  async getUserWorkspaces(userId: string): Promise<Workspace[]> {
    const userWorkspaces = await db.select({ workspaceId: workspaceUsers.workspaceId })
      .from(workspaceUsers)
      .where(eq(workspaceUsers.userId, userId));
    
    if (userWorkspaces.length === 0) return [];
    
    const workspaceIds = userWorkspaces.map(wu => wu.workspaceId);
    return await db.select().from(workspaces)
      .where(sql`${workspaces.id} IN ${workspaceIds}`);
  }

  // Brands
  async getBrands(workspaceId?: string): Promise<Brand[]> {
    if (workspaceId) {
      return await db.select().from(brands).where(eq(brands.workspaceId, workspaceId)).orderBy(desc(brands.createdAt));
    }
    return await db.select().from(brands).orderBy(desc(brands.createdAt));
  }

  async getBrand(id: string): Promise<Brand | undefined> {
    const [brand] = await db.select().from(brands).where(eq(brands.id, id));
    return brand;
  }

  async createBrand(data: InsertBrand): Promise<Brand> {
    const [brand] = await db.insert(brands).values(data).returning();
    return brand;
  }

  async updateBrand(id: string, data: Partial<InsertBrand>): Promise<Brand | undefined> {
    const [brand] = await db.update(brands).set(data).where(eq(brands.id, id)).returning();
    return brand;
  }

  async deleteBrand(id: string): Promise<void> {
    await db.delete(brands).where(eq(brands.id, id));
  }

  // Templates
  async getTemplates(workspaceId?: string, brandId?: string): Promise<Template[]> {
    let query = db.select().from(templates);
    if (workspaceId && brandId) {
      return await query.where(and(eq(templates.workspaceId, workspaceId), eq(templates.brandId, brandId)));
    } else if (workspaceId) {
      return await query.where(eq(templates.workspaceId, workspaceId));
    } else if (brandId) {
      return await query.where(eq(templates.brandId, brandId));
    }
    return await query;
  }

  async getTemplate(id: string): Promise<Template | undefined> {
    const [template] = await db.select().from(templates).where(eq(templates.id, id));
    return template;
  }

  async createTemplate(data: InsertTemplate): Promise<Template> {
    const [template] = await db.insert(templates).values(data).returning();
    return template;
  }

  async updateTemplate(id: string, data: Partial<InsertTemplate>): Promise<Template | undefined> {
    const [template] = await db.update(templates).set(data).where(eq(templates.id, id)).returning();
    return template;
  }

  async deleteTemplate(id: string): Promise<void> {
    await db.delete(templates).where(eq(templates.id, id));
  }

  // Projects
  async getProjects(workspaceId?: string): Promise<Project[]> {
    if (workspaceId) {
      return await db.select().from(projects).where(eq(projects.workspaceId, workspaceId)).orderBy(desc(projects.createdAt));
    }
    return await db.select().from(projects).orderBy(desc(projects.createdAt));
  }

  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async createProject(data: InsertProject): Promise<Project> {
    const [project] = await db.insert(projects).values(data).returning();
    return project;
  }

  async updateProject(id: string, data: Partial<InsertProject>): Promise<Project | undefined> {
    const [project] = await db.update(projects).set(data).where(eq(projects.id, id)).returning();
    return project;
  }

  async deleteProject(id: string): Promise<void> {
    await db.delete(projects).where(eq(projects.id, id));
  }

  // Inputs
  async getInputs(workspaceId?: string): Promise<Input[]> {
    if (workspaceId) {
      return await db.select().from(inputs).where(eq(inputs.workspaceId, workspaceId)).orderBy(desc(inputs.createdAt));
    }
    return await db.select().from(inputs).orderBy(desc(inputs.createdAt));
  }

  async getInput(id: string): Promise<Input | undefined> {
    const [input] = await db.select().from(inputs).where(eq(inputs.id, id));
    return input;
  }

  async createInput(data: InsertInput): Promise<Input> {
    const [input] = await db.insert(inputs).values(data).returning();
    return input;
  }

  async updateInput(id: string, data: Partial<InsertInput>): Promise<Input | undefined> {
    const [input] = await db.update(inputs).set(data).where(eq(inputs.id, id)).returning();
    return input;
  }

  async deleteInput(id: string): Promise<void> {
    await db.delete(inputs).where(eq(inputs.id, id));
  }

  // Workflows
  async getWorkflows(workspaceId?: string): Promise<Workflow[]> {
    if (workspaceId) {
      return await db.select().from(workflows).where(eq(workflows.workspaceId, workspaceId));
    }
    return await db.select().from(workflows);
  }

  async getWorkflow(id: string): Promise<Workflow | undefined> {
    const [workflow] = await db.select().from(workflows).where(eq(workflows.id, id));
    return workflow;
  }

  async createWorkflow(data: InsertWorkflow): Promise<Workflow> {
    const [workflow] = await db.insert(workflows).values(data).returning();
    return workflow;
  }

  async updateWorkflow(id: string, data: Partial<InsertWorkflow>): Promise<Workflow | undefined> {
    const [workflow] = await db.update(workflows).set(data).where(eq(workflows.id, id)).returning();
    return workflow;
  }

  async deleteWorkflow(id: string): Promise<void> {
    await db.delete(workflows).where(eq(workflows.id, id));
  }

  // Workflow Runs
  async getWorkflowRuns(workspaceId?: string): Promise<WorkflowRun[]> {
    if (workspaceId) {
      return await db.select().from(workflowRuns).where(eq(workflowRuns.workspaceId, workspaceId)).orderBy(desc(workflowRuns.createdAt));
    }
    return await db.select().from(workflowRuns).orderBy(desc(workflowRuns.createdAt));
  }

  async getWorkflowRun(id: string): Promise<WorkflowRun | undefined> {
    const [run] = await db.select().from(workflowRuns).where(eq(workflowRuns.id, id));
    return run;
  }

  async createWorkflowRun(data: InsertWorkflowRun): Promise<WorkflowRun> {
    const [run] = await db.insert(workflowRuns).values({
      ...data,
      startedAt: new Date(),
    }).returning();
    return run;
  }

  async updateWorkflowRun(id: string, data: Partial<WorkflowRun>): Promise<WorkflowRun | undefined> {
    const [run] = await db.update(workflowRuns).set(data).where(eq(workflowRuns.id, id)).returning();
    return run;
  }

  // Assets
  async getAssets(workspaceId?: string, status?: AssetStatus): Promise<Asset[]> {
    let conditions = [];
    if (workspaceId) conditions.push(eq(assets.workspaceId, workspaceId));
    if (status) conditions.push(eq(assets.status, status));
    
    if (conditions.length > 0) {
      return await db.select().from(assets).where(and(...conditions)).orderBy(desc(assets.createdAt));
    }
    return await db.select().from(assets).orderBy(desc(assets.createdAt));
  }

  async getAsset(id: string): Promise<Asset | undefined> {
    const [asset] = await db.select().from(assets).where(eq(assets.id, id));
    return asset;
  }

  async createAsset(data: InsertAsset): Promise<Asset> {
    const [asset] = await db.insert(assets).values(data).returning();
    return asset;
  }

  async updateAsset(id: string, data: Partial<InsertAsset>): Promise<Asset | undefined> {
    const [asset] = await db.update(assets).set(data).where(eq(assets.id, id)).returning();
    return asset;
  }

  async deleteAsset(id: string): Promise<void> {
    await db.delete(assets).where(eq(assets.id, id));
  }

  // Asset Versions
  async getAssetVersions(assetId: string): Promise<AssetVersion[]> {
    return await db.select().from(assetVersions)
      .where(eq(assetVersions.assetId, assetId))
      .orderBy(desc(assetVersions.versionNo));
  }

  async getAssetVersion(id: string): Promise<AssetVersion | undefined> {
    const [version] = await db.select().from(assetVersions).where(eq(assetVersions.id, id));
    return version;
  }

  async getLatestAssetVersion(assetId: string): Promise<AssetVersion | undefined> {
    const [version] = await db.select().from(assetVersions)
      .where(eq(assetVersions.assetId, assetId))
      .orderBy(desc(assetVersions.versionNo))
      .limit(1);
    return version;
  }

  async createAssetVersion(data: InsertAssetVersion): Promise<AssetVersion> {
    const [version] = await db.insert(assetVersions).values(data).returning();
    return version;
  }

  async updateAssetVersion(id: string, data: Partial<InsertAssetVersion>): Promise<AssetVersion | undefined> {
    const [version] = await db.update(assetVersions).set(data).where(eq(assetVersions.id, id)).returning();
    return version;
  }

  // Comments
  async getComments(assetVersionId: string): Promise<Comment[]> {
    return await db.select().from(comments)
      .where(eq(comments.assetVersionId, assetVersionId))
      .orderBy(desc(comments.createdAt));
  }

  async createComment(data: InsertComment): Promise<Comment> {
    const [comment] = await db.insert(comments).values(data).returning();
    return comment;
  }

  async deleteComment(id: string): Promise<void> {
    await db.delete(comments).where(eq(comments.id, id));
  }

  // Publishing Targets
  async getPublishingTargets(workspaceId: string): Promise<PublishingTarget[]> {
    return await db.select().from(publishingTargets).where(eq(publishingTargets.workspaceId, workspaceId));
  }

  async getPublishingTarget(id: string): Promise<PublishingTarget | undefined> {
    const [target] = await db.select().from(publishingTargets).where(eq(publishingTargets.id, id));
    return target;
  }

  async createPublishingTarget(data: InsertPublishingTarget): Promise<PublishingTarget> {
    const [target] = await db.insert(publishingTargets).values(data).returning();
    return target;
  }

  async updatePublishingTarget(id: string, data: Partial<InsertPublishingTarget>): Promise<PublishingTarget | undefined> {
    const [target] = await db.update(publishingTargets).set(data).where(eq(publishingTargets.id, id)).returning();
    return target;
  }

  async deletePublishingTarget(id: string): Promise<void> {
    await db.delete(publishingTargets).where(eq(publishingTargets.id, id));
  }

  // Publish Jobs
  async getPublishJobs(assetVersionId?: string): Promise<PublishJob[]> {
    if (assetVersionId) {
      return await db.select().from(publishJobs).where(eq(publishJobs.assetVersionId, assetVersionId));
    }
    return await db.select().from(publishJobs);
  }

  async getPublishJob(id: string): Promise<PublishJob | undefined> {
    const [job] = await db.select().from(publishJobs).where(eq(publishJobs.id, id));
    return job;
  }

  async createPublishJob(data: InsertPublishJob): Promise<PublishJob> {
    const [job] = await db.insert(publishJobs).values(data).returning();
    return job;
  }

  async updatePublishJob(id: string, data: Partial<PublishJob>): Promise<PublishJob | undefined> {
    const [job] = await db.update(publishJobs).set(data).where(eq(publishJobs.id, id)).returning();
    return job;
  }

  // WordPress Pull Jobs
  async getPublishingTargetBySiteId(siteId: string): Promise<PublishingTarget | undefined> {
    const [target] = await db.select().from(publishingTargets).where(eq(publishingTargets.siteId, siteId));
    return target;
  }

  async updatePublishingTargetBySiteId(siteId: string, data: Partial<PublishingTarget>): Promise<PublishingTarget | undefined> {
    const [target] = await db.update(publishingTargets)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(publishingTargets.siteId, siteId))
      .returning();
    return target;
  }

  async getWpPullJobs(targetId: string, status?: WpPullJobStatus): Promise<WpPullJob[]> {
    if (status) {
      return await db.select().from(wpPullJobs)
        .where(and(eq(wpPullJobs.targetId, targetId), eq(wpPullJobs.status, status)))
        .orderBy(desc(wpPullJobs.createdAt));
    }
    return await db.select().from(wpPullJobs)
      .where(eq(wpPullJobs.targetId, targetId))
      .orderBy(desc(wpPullJobs.createdAt));
  }

  async getWpPullJob(id: string): Promise<WpPullJob | undefined> {
    const [job] = await db.select().from(wpPullJobs).where(eq(wpPullJobs.id, id));
    return job;
  }

  async createWpPullJob(data: InsertWpPullJob): Promise<WpPullJob> {
    const [job] = await db.insert(wpPullJobs).values(data).returning();
    return job;
  }

  async updateWpPullJob(id: string, data: Partial<WpPullJob>): Promise<WpPullJob | undefined> {
    const [job] = await db.update(wpPullJobs).set({ ...data, updatedAt: new Date() }).where(eq(wpPullJobs.id, id)).returning();
    return job;
  }

  async leaseNextWpPullJob(siteId: string, leaseToken: string, leaseMinutes: number): Promise<WpPullJob | null> {
    const now = new Date();
    const leaseExpiresAt = new Date(now.getTime() + leaseMinutes * 60 * 1000);
    
    const [job] = await db.select().from(wpPullJobs)
      .where(and(eq(wpPullJobs.siteId, siteId), eq(wpPullJobs.status, "queued")))
      .orderBy(wpPullJobs.createdAt)
      .limit(1);
    
    if (!job) return null;
    
    const [leasedJob] = await db.update(wpPullJobs)
      .set({ status: "leased", leaseToken, leaseExpiresAt, updatedAt: now })
      .where(and(eq(wpPullJobs.id, job.id), eq(wpPullJobs.status, "queued")))
      .returning();
    
    return leasedJob || null;
  }

  async releaseExpiredWpPullJobLeases(): Promise<number> {
    const now = new Date();
    const result = await db.update(wpPullJobs)
      .set({ status: "queued", leaseToken: null, leaseExpiresAt: null, updatedAt: now })
      .where(and(
        eq(wpPullJobs.status, "leased"),
        sql`${wpPullJobs.leaseExpiresAt} < ${now}`
      ))
      .returning();
    return result.length;
  }

  // WordPress Plugin Request Logs
  async createPluginRequestLog(data: InsertWpPluginRequestLog): Promise<WpPluginRequestLog> {
    const [log] = await db.insert(wpPluginRequestLogs).values(data).returning();
    return log;
  }

  async getPluginRequestLogs(siteId: string, limit: number = 20): Promise<WpPluginRequestLog[]> {
    return await db.select().from(wpPluginRequestLogs)
      .where(eq(wpPluginRequestLogs.siteId, siteId))
      .orderBy(desc(wpPluginRequestLogs.createdAt))
      .limit(limit);
  }

  async pruneOldPluginRequestLogs(siteId: string, keepCount: number = 20): Promise<number> {
    // Get IDs to keep (most recent N)
    const toKeep = await db.select({ id: wpPluginRequestLogs.id })
      .from(wpPluginRequestLogs)
      .where(eq(wpPluginRequestLogs.siteId, siteId))
      .orderBy(desc(wpPluginRequestLogs.createdAt))
      .limit(keepCount);
    
    if (toKeep.length === 0) return 0;
    
    const keepIds = toKeep.map(r => r.id);
    
    // Delete all others for this siteId
    const result = await db.delete(wpPluginRequestLogs)
      .where(and(
        eq(wpPluginRequestLogs.siteId, siteId),
        sql`${wpPluginRequestLogs.id} NOT IN (${sql.join(keepIds.map(id => sql`${id}`), sql`, `)})`
      ))
      .returning();
    
    return result.length;
  }

  // Usage Ledger
  async getUsageLedger(workspaceId: string): Promise<UsageLedger[]> {
    return await db.select().from(usageLedger)
      .where(eq(usageLedger.workspaceId, workspaceId))
      .orderBy(desc(usageLedger.createdAt));
  }

  async createUsageEntry(data: InsertUsageLedger): Promise<UsageLedger> {
    const [entry] = await db.insert(usageLedger).values(data).returning();
    return entry;
  }

  // Stats
  async getStats(workspaceId?: string): Promise<{
    totalInputs: number;
    totalAssets: number;
    workflowRuns: number;
    approvedAssets: number;
  }> {
    let inputCount, assetCount, runCount, approvedCount;
    
    if (workspaceId) {
      const [inputResult] = await db.select({ count: sql<number>`count(*)` }).from(inputs).where(eq(inputs.workspaceId, workspaceId));
      const [assetResult] = await db.select({ count: sql<number>`count(*)` }).from(assets).where(eq(assets.workspaceId, workspaceId));
      const [runResult] = await db.select({ count: sql<number>`count(*)` }).from(workflowRuns).where(eq(workflowRuns.workspaceId, workspaceId));
      const [approvedResult] = await db.select({ count: sql<number>`count(*)` }).from(assets)
        .where(and(eq(assets.workspaceId, workspaceId), eq(assets.status, "approved")));
      
      inputCount = inputResult?.count || 0;
      assetCount = assetResult?.count || 0;
      runCount = runResult?.count || 0;
      approvedCount = approvedResult?.count || 0;
    } else {
      const [inputResult] = await db.select({ count: sql<number>`count(*)` }).from(inputs);
      const [assetResult] = await db.select({ count: sql<number>`count(*)` }).from(assets);
      const [runResult] = await db.select({ count: sql<number>`count(*)` }).from(workflowRuns);
      const [approvedResult] = await db.select({ count: sql<number>`count(*)` }).from(assets).where(eq(assets.status, "approved"));
      
      inputCount = inputResult?.count || 0;
      assetCount = assetResult?.count || 0;
      runCount = runResult?.count || 0;
      approvedCount = approvedResult?.count || 0;
    }

    return {
      totalInputs: Number(inputCount),
      totalAssets: Number(assetCount),
      workflowRuns: Number(runCount),
      approvedAssets: Number(approvedCount),
    };
  }

  // Sources
  async getSources(workspaceId: string): Promise<Source[]> {
    return await db.select().from(sources)
      .where(eq(sources.workspaceId, workspaceId))
      .orderBy(desc(sources.createdAt));
  }

  async getSource(id: string): Promise<Source | undefined> {
    const [source] = await db.select().from(sources).where(eq(sources.id, id));
    return source;
  }

  async createSource(data: InsertSource): Promise<Source> {
    const [source] = await db.insert(sources).values(data).returning();
    return source;
  }

  async updateSource(id: string, data: Partial<Source>): Promise<Source | undefined> {
    const [source] = await db.update(sources).set(data).where(eq(sources.id, id)).returning();
    return source;
  }

  async deleteSource(id: string): Promise<void> {
    await db.delete(sources).where(eq(sources.id, id));
  }

  async getActiveSources(): Promise<Source[]> {
    return await db.select().from(sources).where(eq(sources.isActive, "true"));
  }

  async getSourcesByIds(ids: string[]): Promise<Source[]> {
    if (ids.length === 0) return [];
    return await db.select().from(sources).where(inArray(sources.id, ids));
  }

  // Source Items
  async getSourceItems(workspaceId: string, status?: SourceItemStatus, sourceId?: string): Promise<SourceItem[]> {
    let conditions = [eq(sourceItems.workspaceId, workspaceId)];
    if (status) conditions.push(eq(sourceItems.status, status));
    if (sourceId) conditions.push(eq(sourceItems.sourceId, sourceId));
    
    // Query canonical source_items only (no joins with mentions)
    // Stable sort: publishedAt DESC NULLS LAST, createdAt DESC, id DESC
    const items = await db.select().from(sourceItems)
      .where(and(...conditions))
      .orderBy(sql`${sourceItems.publishedAt} DESC NULLS LAST`, desc(sourceItems.createdAt), desc(sourceItems.id));
    
    // Dedupe by ID at application layer as safety measure
    const seen = new Set<string>();
    return items.filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }

  async getSourceItem(id: string): Promise<SourceItem | undefined> {
    const [item] = await db.select().from(sourceItems).where(eq(sourceItems.id, id));
    return item;
  }

  async createSourceItem(data: InsertSourceItem): Promise<SourceItem> {
    const [item] = await db.insert(sourceItems).values(data).returning();
    return item;
  }

  async updateSourceItem(id: string, data: Partial<SourceItem>): Promise<SourceItem | undefined> {
    const [item] = await db.update(sourceItems).set(data).where(eq(sourceItems.id, id)).returning();
    return item;
  }

  async getNewSourceItems(workspaceId: string, sourceIds?: string[]): Promise<SourceItem[]> {
    let conditions = [
      eq(sourceItems.workspaceId, workspaceId),
      eq(sourceItems.status, "new")
    ];
    
    if (sourceIds && sourceIds.length > 0) {
      conditions.push(sql`${sourceItems.sourceId} IN ${sourceIds}`);
    }
    
    return await db.select().from(sourceItems)
      .where(and(...conditions))
      .orderBy(sql`${sourceItems.publishedAt} DESC NULLS LAST`, desc(sourceItems.createdAt), desc(sourceItems.id));
  }

  async sourceItemExists(workspaceId: string, contentHash: string): Promise<boolean> {
    const [item] = await db.select({ id: sourceItems.id }).from(sourceItems)
      .where(and(eq(sourceItems.workspaceId, workspaceId), eq(sourceItems.contentHash, contentHash)));
    return !!item;
  }

  async getSourceItemCount(workspaceId: string): Promise<number> {
    const [result] = await db.select({ count: sql<number>`count(*)::int` }).from(sourceItems)
      .where(eq(sourceItems.workspaceId, workspaceId));
    return result?.count ?? 0;
  }

  async getRecentSourceItemsBySourceIds(sourceIds: string[], hoursBack: number = 24, limit: number = 100): Promise<SourceItem[]> {
    if (sourceIds.length === 0) return [];
    
    const cutoff = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    
    return await db.select().from(sourceItems)
      .where(and(
        inArray(sourceItems.sourceId, sourceIds),
        sql`${sourceItems.createdAt} >= ${cutoff}`
      ))
      .orderBy(desc(sourceItems.createdAt))
      .limit(limit);
  }

  // Fetch Runs
  async createFetchRun(data: InsertFetchRun): Promise<FetchRun> {
    const [run] = await db.insert(fetchRuns).values(data).returning();
    return run;
  }

  async getFetchRuns(sourceId: string, limit: number = 20): Promise<FetchRun[]> {
    return await db.select().from(fetchRuns)
      .where(eq(fetchRuns.sourceId, sourceId))
      .orderBy(desc(fetchRuns.createdAt))
      .limit(limit);
  }

  // Automations
  async getAutomations(workspaceId: string): Promise<Automation[]> {
    return await db.select().from(automations)
      .where(eq(automations.workspaceId, workspaceId))
      .orderBy(desc(automations.createdAt));
  }

  async getAutomation(id: string): Promise<Automation | undefined> {
    const [automation] = await db.select().from(automations).where(eq(automations.id, id));
    return automation;
  }

  async createAutomation(data: InsertAutomation): Promise<Automation> {
    const [automation] = await db.insert(automations).values(data).returning();
    return automation;
  }

  async updateAutomation(id: string, data: Partial<Automation>): Promise<Automation | undefined> {
    const [automation] = await db.update(automations).set(data).where(eq(automations.id, id)).returning();
    return automation;
  }

  async deleteAutomation(id: string): Promise<void> {
    await db.delete(automations).where(eq(automations.id, id));
  }

  async getActiveAutomations(): Promise<Automation[]> {
    return await db.select().from(automations).where(eq(automations.isActive, "true"));
  }

  // Automation Runs
  async getAutomationRuns(automationId: string): Promise<AutomationRun[]> {
    return await db.select().from(automationRuns)
      .where(eq(automationRuns.automationId, automationId))
      .orderBy(desc(automationRuns.createdAt));
  }

  async getAutomationRun(id: string): Promise<AutomationRun | undefined> {
    const [run] = await db.select().from(automationRuns).where(eq(automationRuns.id, id));
    return run;
  }

  async createAutomationRun(data: InsertAutomationRun): Promise<AutomationRun> {
    const [run] = await db.insert(automationRuns).values(data).returning();
    return run;
  }

  async updateAutomationRun(id: string, data: Partial<AutomationRun>): Promise<AutomationRun | undefined> {
    const [run] = await db.update(automationRuns).set(data).where(eq(automationRuns.id, id)).returning();
    return run;
  }

  // Automation Run Items
  async getAutomationRunItems(runId: string): Promise<AutomationRunItem[]> {
    return await db.select().from(automationRunItems)
      .where(eq(automationRunItems.runId, runId));
  }

  async createAutomationRunItem(data: InsertAutomationRunItem): Promise<AutomationRunItem> {
    const [item] = await db.insert(automationRunItems).values(data).returning();
    return item;
  }

  async updateAutomationRunItem(id: string, data: Partial<AutomationRunItem>): Promise<AutomationRunItem | undefined> {
    const [item] = await db.update(automationRunItems).set(data).where(eq(automationRunItems.id, id)).returning();
    return item;
  }

  // Content Goals
  async getContentGoals(workspaceId: string): Promise<ContentGoal[]> {
    return await db.select().from(contentGoals)
      .where(eq(contentGoals.workspaceId, workspaceId))
      .orderBy(desc(contentGoals.createdAt));
  }

  async getContentGoal(id: string): Promise<ContentGoal | undefined> {
    const [goal] = await db.select().from(contentGoals).where(eq(contentGoals.id, id));
    return goal;
  }

  async createContentGoal(data: InsertContentGoal): Promise<ContentGoal> {
    const [goal] = await db.insert(contentGoals).values(data).returning();
    return goal;
  }

  async updateContentGoal(id: string, data: Partial<ContentGoal>): Promise<ContentGoal | undefined> {
    const [goal] = await db.update(contentGoals).set(data).where(eq(contentGoals.id, id)).returning();
    return goal;
  }

  async deleteContentGoal(id: string): Promise<void> {
    await db.delete(contentGoals).where(eq(contentGoals.id, id));
  }

  // Discovery Jobs
  async getDiscoveryJobs(workspaceId: string, contentGoalId?: string): Promise<DiscoveryJob[]> {
    if (contentGoalId) {
      return await db.select().from(discoveryJobs)
        .where(and(eq(discoveryJobs.workspaceId, workspaceId), eq(discoveryJobs.contentGoalId, contentGoalId)))
        .orderBy(desc(discoveryJobs.createdAt));
    }
    return await db.select().from(discoveryJobs)
      .where(eq(discoveryJobs.workspaceId, workspaceId))
      .orderBy(desc(discoveryJobs.createdAt));
  }

  async getDiscoveryJob(id: string): Promise<DiscoveryJob | undefined> {
    const [job] = await db.select().from(discoveryJobs).where(eq(discoveryJobs.id, id));
    return job;
  }

  async createDiscoveryJob(data: InsertDiscoveryJob): Promise<DiscoveryJob> {
    const [job] = await db.insert(discoveryJobs).values(data).returning();
    return job;
  }

  async updateDiscoveryJob(id: string, data: Partial<DiscoveryJob>): Promise<DiscoveryJob | undefined> {
    const [job] = await db.update(discoveryJobs).set(data).where(eq(discoveryJobs.id, id)).returning();
    return job;
  }

  // Discovered Sources
  async getDiscoveredSources(discoveryJobId: string): Promise<DiscoveredSource[]> {
    return await db.select().from(discoveredSources)
      .where(eq(discoveredSources.discoveryJobId, discoveryJobId))
      .orderBy(desc(discoveredSources.score));
  }

  async getDiscoveredSource(id: string): Promise<DiscoveredSource | undefined> {
    const [source] = await db.select().from(discoveredSources).where(eq(discoveredSources.id, id));
    return source;
  }

  async createDiscoveredSource(data: InsertDiscoveredSource): Promise<DiscoveredSource> {
    const [source] = await db.insert(discoveredSources).values(data).returning();
    return source;
  }

  async updateDiscoveredSource(id: string, data: Partial<DiscoveredSource>): Promise<DiscoveredSource | undefined> {
    const [source] = await db.update(discoveredSources).set(data).where(eq(discoveredSources.id, id)).returning();
    return source;
  }

  // Content Plans
  async getContentPlans(workspaceId: string, contentGoalId?: string): Promise<ContentPlan[]> {
    if (contentGoalId) {
      return await db.select().from(contentPlans)
        .where(and(eq(contentPlans.workspaceId, workspaceId), eq(contentPlans.contentGoalId, contentGoalId)))
        .orderBy(desc(contentPlans.createdAt));
    }
    return await db.select().from(contentPlans)
      .where(eq(contentPlans.workspaceId, workspaceId))
      .orderBy(desc(contentPlans.createdAt));
  }

  async getContentPlan(id: string): Promise<ContentPlan | undefined> {
    const [plan] = await db.select().from(contentPlans).where(eq(contentPlans.id, id));
    return plan;
  }

  async createContentPlan(data: InsertContentPlan): Promise<ContentPlan> {
    const [plan] = await db.insert(contentPlans).values(data).returning();
    return plan;
  }

  async updateContentPlan(id: string, data: Partial<ContentPlan>): Promise<ContentPlan | undefined> {
    const [plan] = await db.update(contentPlans).set(data).where(eq(contentPlans.id, id)).returning();
    return plan;
  }

  // Stories (clustering)
  async getStories(workspaceId: string, dateBucket?: string): Promise<Story[]> {
    if (dateBucket) {
      return await db.select().from(stories)
        .where(and(eq(stories.workspaceId, workspaceId), eq(stories.publishedDateBucket, dateBucket)))
        .orderBy(desc(stories.firstSeenAt));
    }
    return await db.select().from(stories)
      .where(eq(stories.workspaceId, workspaceId))
      .orderBy(desc(stories.firstSeenAt));
  }

  async getStory(id: string): Promise<Story | undefined> {
    const [story] = await db.select().from(stories).where(eq(stories.id, id));
    return story;
  }

  async createStory(data: InsertStory): Promise<Story> {
    const [story] = await db.insert(stories).values(data).returning();
    return story;
  }

  async updateStory(id: string, data: Partial<Story>): Promise<Story | undefined> {
    const [story] = await db.update(stories).set(data).where(eq(stories.id, id)).returning();
    return story;
  }

  async findStoriesBySimilarity(workspaceId: string, similarityHash: string, dateBucket: string): Promise<Story[]> {
    return await db.select().from(stories)
      .where(and(
        eq(stories.workspaceId, workspaceId),
        eq(stories.similarityHash, similarityHash),
        eq(stories.publishedDateBucket, dateBucket)
      ));
  }

  // Story Items
  async getStoryItems(storyId: string): Promise<StoryItem[]> {
    return await db.select().from(storyItems)
      .where(eq(storyItems.storyId, storyId))
      .orderBy(desc(storyItems.createdAt));
  }

  async createStoryItem(data: InsertStoryItem): Promise<StoryItem | null> {
    // Use onConflictDoNothing to handle duplicate story_id + source_item_id combinations
    const result = await db.insert(storyItems)
      .values(data)
      .onConflictDoNothing({ target: [storyItems.storyId, storyItems.sourceItemId] })
      .returning();
    return result[0] || null;
  }

  // Drafts
  async getDrafts(workspaceId: string, status?: DraftStatus, topicId?: string): Promise<Draft[]> {
    let conditions = [eq(drafts.workspaceId, workspaceId)];
    if (status) conditions.push(eq(drafts.status, status));
    if (topicId) conditions.push(eq(drafts.topicId, topicId));
    
    return await db.select().from(drafts)
      .where(and(...conditions))
      .orderBy(desc(drafts.createdAt));
  }

  async getDraft(id: string): Promise<Draft | undefined> {
    const [draft] = await db.select().from(drafts).where(eq(drafts.id, id));
    return draft;
  }

  async getDraftByPipelineItemId(pipelineItemId: string): Promise<Draft | undefined> {
    const [draft] = await db.select().from(drafts).where(eq(drafts.pipelineItemId, pipelineItemId));
    return draft;
  }

  async createDraft(data: InsertDraft): Promise<Draft> {
    const [draft] = await db.insert(drafts).values(data).returning();
    return draft;
  }

  async updateDraft(id: string, data: Partial<Draft>): Promise<Draft | undefined> {
    const [draft] = await db.update(drafts).set({ ...data, updatedAt: new Date() }).where(eq(drafts.id, id)).returning();
    return draft;
  }

  async deleteDraft(id: string): Promise<void> {
    await db.delete(drafts).where(eq(drafts.id, id));
  }

  // Topics
  async getTopics(workspaceId: string): Promise<Topic[]> {
    return await db.select().from(topics)
      .where(eq(topics.workspaceId, workspaceId))
      .orderBy(desc(topics.createdAt));
  }

  async getAllTopics(): Promise<Topic[]> {
    return await db.select().from(topics)
      .orderBy(desc(topics.createdAt));
  }

  async getTopic(id: string): Promise<Topic | undefined> {
    const [topic] = await db.select().from(topics).where(eq(topics.id, id));
    return topic;
  }

  async createTopic(data: InsertTopic): Promise<Topic> {
    const [topic] = await db.insert(topics).values(data).returning();
    return topic;
  }

  async updateTopic(id: string, data: Partial<Topic>): Promise<Topic | undefined> {
    const [topic] = await db.update(topics).set(data).where(eq(topics.id, id)).returning();
    return topic;
  }

  async deleteTopic(id: string): Promise<void> {
    await db.delete(topics).where(eq(topics.id, id));
  }

  async getLiveTopics(): Promise<Topic[]> {
    return await db.select().from(topics)
      .where(eq(topics.isLive, "true"))
      .orderBy(desc(topics.createdAt));
  }

  // Topic Sources
  async getTopicSources(topicId: string): Promise<TopicSource[]> {
    return await db.select().from(topicSources)
      .where(eq(topicSources.topicId, topicId))
      .orderBy(desc(topicSources.createdAt));
  }

  async getEnabledSourceIdsForTopic(topicId: string): Promise<string[]> {
    // First, check if there are explicit topic_sources links
    const rows = await db.select({ sourceId: topicSources.sourceId })
      .from(topicSources)
      .where(and(
        eq(topicSources.topicId, topicId),
        eq(topicSources.isEnabled, true)
      ));
    
    if (rows.length > 0) {
      return rows.map(r => r.sourceId);
    }
    
    // Fallback: Use ALL active sources in the topic's workspace
    const [topic] = await db.select().from(topics).where(eq(topics.id, topicId));
    if (!topic) return [];
    
    const allActiveSources = await db.select({ id: sources.id })
      .from(sources)
      .where(and(
        eq(sources.workspaceId, topic.workspaceId),
        eq(sources.isActive, "true")
      ));
    
    return allActiveSources.map(s => s.id);
  }

  async upsertTopicSource(data: InsertTopicSource): Promise<TopicSource> {
    const existing = await db.select().from(topicSources)
      .where(and(
        eq(topicSources.topicId, data.topicId),
        eq(topicSources.sourceId, data.sourceId)
      ));
    
    if (existing.length > 0) {
      const [updated] = await db.update(topicSources)
        .set({ isEnabled: data.isEnabled, updatedAt: new Date() })
        .where(eq(topicSources.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(topicSources).values(data).returning();
      return created;
    }
  }

  async setTopicSourceEnabled(topicId: string, sourceId: string, isEnabled: boolean): Promise<void> {
    await this.upsertTopicSource({ topicId, sourceId, isEnabled });
  }

  async deleteTopicSources(topicId: string): Promise<void> {
    await db.delete(topicSources).where(eq(topicSources.topicId, topicId));
  }

  async saveTopicSourceRecommendation(topicId: string, payload: any): Promise<TopicSourceRecommendation> {
    const [rec] = await db.insert(topicSourceRecommendations)
      .values({ topicId, payloadJson: payload })
      .returning();
    return rec;
  }

  // Topic Stories (persisted relevance)
  async getTopicStories(topicId: string, minScore: number = 0.15): Promise<(TopicStory & { story: Story })[]> {
    const rows = await db.select({
      topicStory: topicStories,
      story: stories,
    })
      .from(topicStories)
      .innerJoin(stories, eq(topicStories.storyId, stories.id))
      .where(and(
        eq(topicStories.topicId, topicId),
        sql`${topicStories.relevanceScore} >= ${minScore}`
      ))
      .orderBy(desc(topicStories.relevanceScore));
    
    return rows.map(r => ({ ...r.topicStory, story: r.story }));
  }

  async upsertTopicStory(data: InsertTopicStory): Promise<TopicStory> {
    const existing = await db.select().from(topicStories)
      .where(and(
        eq(topicStories.topicId, data.topicId),
        eq(topicStories.storyId, data.storyId)
      ));
    
    if (existing.length > 0) {
      const [updated] = await db.update(topicStories)
        .set({ 
          relevanceScore: data.relevanceScore,
          matchedTerms: data.matchedTerms,
          reason: data.reason,
        })
        .where(eq(topicStories.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(topicStories).values(data).returning();
      return created;
    }
  }

  async deleteTopicStories(topicId: string): Promise<void> {
    await db.delete(topicStories).where(eq(topicStories.topicId, topicId));
  }

  // Image Assets
  async getImageAssets(workspaceId: string, storyId?: string, sourceItemId?: string): Promise<ImageAsset[]> {
    let conditions = [eq(imageAssets.workspaceId, workspaceId)];
    if (storyId) conditions.push(eq(imageAssets.storyId, storyId));
    if (sourceItemId) conditions.push(eq(imageAssets.sourceItemId, sourceItemId));
    
    return await db.select().from(imageAssets)
      .where(and(...conditions))
      .orderBy(desc(imageAssets.createdAt));
  }

  async getImageAsset(id: string): Promise<ImageAsset | undefined> {
    const [asset] = await db.select().from(imageAssets).where(eq(imageAssets.id, id));
    return asset;
  }

  async getPrimaryImageForStory(storyId: string): Promise<ImageAsset | undefined> {
    const [asset] = await db.select().from(imageAssets)
      .where(and(
        eq(imageAssets.storyId, storyId),
        eq(imageAssets.isPrimary, true)
      ));
    return asset;
  }

  async createImageAsset(data: InsertImageAsset): Promise<ImageAsset> {
    const [asset] = await db.insert(imageAssets).values(data).returning();
    return asset;
  }

  async updateImageAsset(id: string, data: Partial<ImageAsset>): Promise<ImageAsset | undefined> {
    const [asset] = await db.update(imageAssets).set(data).where(eq(imageAssets.id, id)).returning();
    return asset;
  }

  async deleteImageAsset(id: string): Promise<void> {
    await db.delete(imageAssets).where(eq(imageAssets.id, id));
  }

  async setPrimaryImageForStory(storyId: string, imageAssetId: string): Promise<void> {
    await db.update(imageAssets)
      .set({ isPrimary: false })
      .where(eq(imageAssets.storyId, storyId));
    
    await db.update(imageAssets)
      .set({ isPrimary: true })
      .where(eq(imageAssets.id, imageAssetId));
  }

  // Image Usages
  async getImageUsages(imageAssetId: string): Promise<ImageUsage[]> {
    return await db.select().from(imageUsages)
      .where(eq(imageUsages.imageAssetId, imageAssetId))
      .orderBy(desc(imageUsages.uploadedAt));
  }

  async createImageUsage(data: InsertImageUsage): Promise<ImageUsage> {
    const [usage] = await db.insert(imageUsages).values(data).returning();
    return usage;
  }

  async updateImageUsage(id: string, data: Partial<ImageUsage>): Promise<ImageUsage | undefined> {
    const [usage] = await db.update(imageUsages).set(data).where(eq(imageUsages.id, id)).returning();
    return usage;
  }

  // WP Taxonomy Cache
  async getWpTaxonomyCache(publishingTargetId: string, taxonomyType?: WpTaxonomyType): Promise<WpTaxonomyCache[]> {
    const conditions = [eq(wpTaxonomyCache.publishingTargetId, publishingTargetId)];
    if (taxonomyType) conditions.push(eq(wpTaxonomyCache.taxonomyType, taxonomyType));
    
    return await db.select().from(wpTaxonomyCache)
      .where(and(...conditions))
      .orderBy(wpTaxonomyCache.name);
  }

  async getWpTaxonomyCacheByIds(publishingTargetId: string, taxonomyType: WpTaxonomyType, wpIds: number[]): Promise<WpTaxonomyCache[]> {
    if (wpIds.length === 0) return [];
    
    return await db.select().from(wpTaxonomyCache)
      .where(and(
        eq(wpTaxonomyCache.publishingTargetId, publishingTargetId),
        eq(wpTaxonomyCache.taxonomyType, taxonomyType),
        sql`${wpTaxonomyCache.wpId} = ANY(${wpIds})`
      ));
  }

  async upsertWpTaxonomyCache(data: InsertWpTaxonomyCache): Promise<WpTaxonomyCache> {
    const [item] = await db.insert(wpTaxonomyCache)
      .values(data)
      .onConflictDoUpdate({
        target: [wpTaxonomyCache.publishingTargetId, wpTaxonomyCache.taxonomyType, wpTaxonomyCache.wpId],
        set: {
          name: data.name,
          slug: data.slug,
          parentWpId: data.parentWpId,
          count: data.count,
          syncedAt: new Date(),
        },
      })
      .returning();
    return item;
  }

  async clearWpTaxonomyCache(publishingTargetId: string, taxonomyType?: WpTaxonomyType): Promise<void> {
    const conditions = [eq(wpTaxonomyCache.publishingTargetId, publishingTargetId)];
    if (taxonomyType) conditions.push(eq(wpTaxonomyCache.taxonomyType, taxonomyType));
    
    await db.delete(wpTaxonomyCache).where(and(...conditions));
  }

  async getWpTaxonomySyncStatus(publishingTargetId: string): Promise<{ categories: Date | null; tags: Date | null }> {
    const results = await db.select({
      taxonomyType: wpTaxonomyCache.taxonomyType,
      lastSync: sql<Date>`MAX(${wpTaxonomyCache.syncedAt})`,
    })
      .from(wpTaxonomyCache)
      .where(eq(wpTaxonomyCache.publishingTargetId, publishingTargetId))
      .groupBy(wpTaxonomyCache.taxonomyType);
    
    const status: { categories: Date | null; tags: Date | null } = { categories: null, tags: null };
    for (const r of results) {
      if (r.taxonomyType === "category") status.categories = r.lastSync;
      if (r.taxonomyType === "tag") status.tags = r.lastSync;
    }
    return status;
  }

  // ============ AUTOMATION PIPELINE ============

  // Pipeline Items
  async getPipelineItems(topicId: string, status?: PipelineItemStatus): Promise<PipelineItem[]> {
    const conditions = [eq(pipelineItems.topicId, topicId)];
    if (status) conditions.push(eq(pipelineItems.status, status));
    
    return await db.select().from(pipelineItems)
      .where(and(...conditions))
      .orderBy(desc(pipelineItems.createdAt));
  }

  async getPipelineItemsByWorkspace(workspaceId: string, status?: PipelineItemStatus): Promise<PipelineItem[]> {
    const conditions = [eq(pipelineItems.workspaceId, workspaceId)];
    if (status) conditions.push(eq(pipelineItems.status, status));
    
    return await db.select().from(pipelineItems)
      .where(and(...conditions))
      .orderBy(desc(pipelineItems.createdAt));
  }

  async getPipelineItem(id: string): Promise<PipelineItem | undefined> {
    const [item] = await db.select().from(pipelineItems).where(eq(pipelineItems.id, id));
    return item;
  }

  async getPipelineItemByTopicAndStory(topicId: string, storyId: string): Promise<PipelineItem | undefined> {
    const [item] = await db.select().from(pipelineItems)
      .where(and(eq(pipelineItems.topicId, topicId), eq(pipelineItems.storyId, storyId)));
    return item;
  }

  async createPipelineItem(data: InsertPipelineItem): Promise<PipelineItem> {
    const [item] = await db.insert(pipelineItems).values(data).returning();
    return item;
  }

  async updatePipelineItem(id: string, data: Partial<PipelineItem>): Promise<PipelineItem | undefined> {
    const [item] = await db.update(pipelineItems)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(pipelineItems.id, id))
      .returning();
    return item;
  }

  async deletePipelineItem(id: string): Promise<void> {
    await db.delete(pipelineItems).where(eq(pipelineItems.id, id));
  }

  async getScheduledPipelineItems(topicId?: string): Promise<PipelineItem[]> {
    const conditions = [eq(pipelineItems.status, "scheduled" as PipelineItemStatus)];
    if (topicId) conditions.push(eq(pipelineItems.topicId, topicId));
    
    return await db.select().from(pipelineItems)
      .where(and(...conditions))
      .orderBy(pipelineItems.scheduledAt);
  }

  async getQuarantinedPipelineItems(workspaceId: string): Promise<PipelineItem[]> {
    return await db.select().from(pipelineItems)
      .where(and(
        eq(pipelineItems.workspaceId, workspaceId),
        eq(pipelineItems.status, "quarantined" as PipelineItemStatus)
      ))
      .orderBy(desc(pipelineItems.updatedAt));
  }

  // Automation Job Runs
  async getAutomationJobRuns(topicId?: string, jobType?: AutomationJobType): Promise<AutomationJobRun[]> {
    const conditions = [];
    if (topicId) conditions.push(eq(automationJobRuns.topicId, topicId));
    if (jobType) conditions.push(eq(automationJobRuns.jobType, jobType));
    
    return await db.select().from(automationJobRuns)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(automationJobRuns.startedAt))
      .limit(100);
  }

  async getAutomationJobRun(id: string): Promise<AutomationJobRun | undefined> {
    const [run] = await db.select().from(automationJobRuns).where(eq(automationJobRuns.id, id));
    return run;
  }

  async createAutomationJobRun(data: InsertAutomationJobRun): Promise<AutomationJobRun> {
    const [run] = await db.insert(automationJobRuns).values(data).returning();
    return run;
  }

  async updateAutomationJobRun(id: string, data: Partial<AutomationJobRun>): Promise<AutomationJobRun | undefined> {
    const [run] = await db.update(automationJobRuns)
      .set(data)
      .where(eq(automationJobRuns.id, id))
      .returning();
    return run;
  }

  // Publish Attempts
  async getPublishAttempts(pipelineItemId: string): Promise<PublishAttempt[]> {
    return await db.select().from(publishAttempts)
      .where(eq(publishAttempts.pipelineItemId, pipelineItemId))
      .orderBy(desc(publishAttempts.attemptedAt));
  }

  async createPublishAttempt(data: InsertPublishAttempt): Promise<PublishAttempt> {
    const [attempt] = await db.insert(publishAttempts).values(data).returning();
    return attempt;
  }

  // Publishing Target health
  async updatePublishingTargetHealth(id: string, status: TargetHealthStatus, message?: string): Promise<void> {
    await db.update(publishingTargets)
      .set({
        lastHealthCheckAt: new Date(),
        lastHealthStatus: status,
        lastHealthMessage: message || null,
      })
      .where(eq(publishingTargets.id, id));
  }

  // ============ ANALYTICS ============
  async getPipelineAnalytics(workspaceId: string): Promise<{
    statusCounts: Record<string, number>;
    totalItems: number;
    successRate: number;
    avgProcessingTime: number | null;
    dailyTrends: Array<{ date: string; published: number; quarantined: number; total: number }>;
    topicPerformance: Array<{ topicId: string; topicName: string; published: number; quarantined: number; pending: number }>;
    jobRunStats: { total: number; byType: Record<string, number>; recentFailures: number };
  }> {
    const allItems = await db.select().from(pipelineItems)
      .where(eq(pipelineItems.workspaceId, workspaceId));
    
    const statusCounts: Record<string, number> = {};
    for (const item of allItems) {
      statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
    }
    
    const totalItems = allItems.length;
    const publishedCount = statusCounts["published"] || 0;
    const verifiedCount = statusCounts["verified"] || 0;
    const quarantinedCount = statusCounts["quarantined"] || 0;
    const successfulCount = publishedCount + verifiedCount;
    const completedCount = successfulCount + quarantinedCount;
    const successRate = completedCount > 0 ? (successfulCount / completedCount) * 100 : 0;
    
    const itemsWithTimes = allItems.filter(i => i.createdAt && i.publishedAt);
    let avgProcessingTime: number | null = null;
    if (itemsWithTimes.length > 0) {
      const totalMs = itemsWithTimes.reduce((sum, i) => {
        const start = new Date(i.createdAt!).getTime();
        const end = new Date(i.publishedAt!).getTime();
        return sum + (end - start);
      }, 0);
      avgProcessingTime = Math.round(totalMs / itemsWithTimes.length / 1000 / 60);
    }
    
    const dailyMap = new Map<string, { published: number; quarantined: number; total: number }>();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    for (const item of allItems) {
      if (!item.createdAt) continue;
      const itemDate = new Date(item.createdAt);
      if (itemDate < thirtyDaysAgo) continue;
      
      const dateKey = itemDate.toISOString().split("T")[0];
      const existing = dailyMap.get(dateKey) || { published: 0, quarantined: 0, total: 0 };
      existing.total++;
      if (item.status === "published" || item.status === "verified") existing.published++;
      if (item.status === "quarantined") existing.quarantined++;
      dailyMap.set(dateKey, existing);
    }
    
    const dailyTrends = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    const workspaceTopics = await db.select().from(topics).where(eq(topics.workspaceId, workspaceId));
    const topicPerformance = [];
    
    for (const topic of workspaceTopics) {
      const topicItems = allItems.filter(i => i.topicId === topic.id);
      const pub = topicItems.filter(i => i.status === "published" || i.status === "verified").length;
      const quar = topicItems.filter(i => i.status === "quarantined").length;
      const pend = topicItems.filter(i => 
        !["published", "verified", "quarantined", "skipped"].includes(i.status)
      ).length;
      
      topicPerformance.push({
        topicId: topic.id,
        topicName: topic.name,
        published: pub,
        quarantined: quar,
        pending: pend,
      });
    }
    
    const recentJobRuns = await db.select().from(automationJobRuns)
      .where(eq(automationJobRuns.workspaceId, workspaceId))
      .orderBy(desc(automationJobRuns.startedAt))
      .limit(500);
    
    const byType: Record<string, number> = {};
    let recentFailures = 0;
    
    for (const run of recentJobRuns) {
      byType[run.jobType] = (byType[run.jobType] || 0) + 1;
      if (run.status === "failed") recentFailures++;
    }
    
    return {
      statusCounts,
      totalItems,
      successRate: Math.round(successRate * 10) / 10,
      avgProcessingTime,
      dailyTrends,
      topicPerformance,
      jobRunStats: {
        total: recentJobRuns.length,
        byType,
        recentFailures,
      },
    };
  }
}

export const storage = new DatabaseStorage();

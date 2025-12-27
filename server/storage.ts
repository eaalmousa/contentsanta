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
  usageLedger, type UsageLedger, type InsertUsageLedger,
  sources, type Source, type InsertSource,
  sourceItems, type SourceItem, type InsertSourceItem,
  sourceItemMentions, type SourceItemMention, type InsertSourceItemMention,
  fetchRuns, type FetchRun, type InsertFetchRun,
  automations, type Automation, type InsertAutomation,
  automationRuns, type AutomationRun, type InsertAutomationRun,
  automationRunItems, type AutomationRunItem, type InsertAutomationRunItem,
  type RoleType,
  type RunStatus,
  type AssetStatus,
  type SourceItemStatus,
  type AutomationRunStatus,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, ilike, or } from "drizzle-orm";

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
  
  // Source Items
  getSourceItems(workspaceId: string, status?: SourceItemStatus, sourceId?: string): Promise<SourceItem[]>;
  getSourceItem(id: string): Promise<SourceItem | undefined>;
  createSourceItem(data: InsertSourceItem): Promise<SourceItem>;
  updateSourceItem(id: string, data: Partial<SourceItem>): Promise<SourceItem | undefined>;
  getNewSourceItems(workspaceId: string, sourceIds?: string[]): Promise<SourceItem[]>;
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

  // Source Items
  async getSourceItems(workspaceId: string, status?: SourceItemStatus, sourceId?: string): Promise<SourceItem[]> {
    let conditions = [eq(sourceItems.workspaceId, workspaceId)];
    if (status) conditions.push(eq(sourceItems.status, status));
    if (sourceId) conditions.push(eq(sourceItems.sourceId, sourceId));
    
    // Stable sort: publishedAt DESC NULLS LAST, createdAt DESC, id DESC
    return await db.select().from(sourceItems)
      .where(and(...conditions))
      .orderBy(sql`${sourceItems.publishedAt} DESC NULLS LAST`, desc(sourceItems.createdAt), desc(sourceItems.id));
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
}

export const storage = new DatabaseStorage();

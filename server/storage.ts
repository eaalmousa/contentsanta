import type { 
  User, InsertUser,
  Workspace, InsertWorkspace,
  Brand, InsertBrand,
  Input, InsertInput,
  WorkflowRun, InsertWorkflowRun,
  Asset, InsertAsset,
  Project, InsertProject,
  RunStatus,
  AssetStatus,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Workspaces
  getWorkspaces(): Promise<Workspace[]>;
  getWorkspace(id: string): Promise<Workspace | undefined>;
  createWorkspace(workspace: InsertWorkspace): Promise<Workspace>;
  
  // Brands
  getBrands(workspaceId?: string): Promise<Brand[]>;
  getBrand(id: string): Promise<Brand | undefined>;
  createBrand(brand: InsertBrand): Promise<Brand>;
  updateBrand(id: string, data: Partial<Brand>): Promise<Brand | undefined>;
  
  // Inputs
  getInputs(workspaceId?: string): Promise<Input[]>;
  getInput(id: string): Promise<Input | undefined>;
  createInput(input: InsertInput): Promise<Input>;
  deleteInput(id: string): Promise<boolean>;
  
  // Workflow Runs
  getWorkflowRuns(filters?: { workspaceId?: string; inputId?: string; limit?: number }): Promise<WorkflowRun[]>;
  getWorkflowRun(id: string): Promise<WorkflowRun | undefined>;
  createWorkflowRun(run: InsertWorkflowRun): Promise<WorkflowRun>;
  updateWorkflowRun(id: string, data: Partial<WorkflowRun>): Promise<WorkflowRun | undefined>;
  
  // Assets
  getAssets(filters?: { workspaceId?: string; status?: AssetStatus; inputId?: string; limit?: number }): Promise<Asset[]>;
  getAsset(id: string): Promise<Asset | undefined>;
  createAsset(asset: InsertAsset): Promise<Asset>;
  updateAsset(id: string, data: Partial<Asset>): Promise<Asset | undefined>;
  deleteAsset(id: string): Promise<boolean>;
  
  // Projects
  getProjects(workspaceId?: string): Promise<Project[]>;
  getProject(id: string): Promise<Project | undefined>;
  createProject(project: InsertProject): Promise<Project>;
  
  // Stats
  getStats(workspaceId?: string): Promise<{
    totalInputs: number;
    totalAssets: number;
    workflowRuns: number;
    approvedAssets: number;
  }>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User> = new Map();
  private workspaces: Map<string, Workspace> = new Map();
  private brands: Map<string, Brand> = new Map();
  private inputs: Map<string, Input> = new Map();
  private workflowRuns: Map<string, WorkflowRun> = new Map();
  private assets: Map<string, Asset> = new Map();
  private projects: Map<string, Project> = new Map();

  constructor() {
    // Initialize with a default workspace
    const defaultWorkspace: Workspace = {
      id: "default",
      name: "Demo Workspace",
      slug: "demo-workspace",
    };
    this.workspaces.set(defaultWorkspace.id, defaultWorkspace);
    
    // Initialize with a default brand
    const defaultBrand: Brand = {
      id: "default-brand",
      workspaceId: "default",
      name: "My Brand",
      defaultLanguage: "en",
      industry: "Technology",
      audience: "Business professionals and decision makers",
      tone: "professional",
      approvedTerms: ["innovative", "cutting-edge", "solution"],
      forbiddenWords: ["cheap", "basic"],
      styleRules: "Use active voice. Keep sentences concise. Always include a call to action.",
    };
    this.brands.set(defaultBrand.id, defaultBrand);
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Workspaces
  async getWorkspaces(): Promise<Workspace[]> {
    return Array.from(this.workspaces.values());
  }

  async getWorkspace(id: string): Promise<Workspace | undefined> {
    return this.workspaces.get(id);
  }

  async createWorkspace(workspace: InsertWorkspace): Promise<Workspace> {
    const id = randomUUID();
    const newWorkspace: Workspace = { ...workspace, id };
    this.workspaces.set(id, newWorkspace);
    return newWorkspace;
  }

  // Brands
  async getBrands(workspaceId?: string): Promise<Brand[]> {
    const brands = Array.from(this.brands.values());
    if (workspaceId) {
      return brands.filter((b) => b.workspaceId === workspaceId);
    }
    return brands;
  }

  async getBrand(id: string): Promise<Brand | undefined> {
    return this.brands.get(id);
  }

  async createBrand(brand: InsertBrand): Promise<Brand> {
    const id = randomUUID();
    const newBrand: Brand = { ...brand, id };
    this.brands.set(id, newBrand);
    return newBrand;
  }

  async updateBrand(id: string, data: Partial<Brand>): Promise<Brand | undefined> {
    const brand = this.brands.get(id);
    if (!brand) return undefined;
    const updated = { ...brand, ...data };
    this.brands.set(id, updated);
    return updated;
  }

  // Inputs
  async getInputs(workspaceId?: string): Promise<Input[]> {
    const inputs = Array.from(this.inputs.values());
    if (workspaceId) {
      return inputs.filter((i) => i.workspaceId === workspaceId);
    }
    return inputs.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  }

  async getInput(id: string): Promise<Input | undefined> {
    return this.inputs.get(id);
  }

  async createInput(input: InsertInput): Promise<Input> {
    const id = randomUUID();
    const newInput: Input = { 
      ...input, 
      id, 
      createdAt: new Date(),
    };
    this.inputs.set(id, newInput);
    return newInput;
  }

  async deleteInput(id: string): Promise<boolean> {
    return this.inputs.delete(id);
  }

  // Workflow Runs
  async getWorkflowRuns(filters?: { workspaceId?: string; inputId?: string; limit?: number }): Promise<WorkflowRun[]> {
    let runs = Array.from(this.workflowRuns.values());
    
    if (filters?.workspaceId) {
      runs = runs.filter((r) => r.workspaceId === filters.workspaceId);
    }
    if (filters?.inputId) {
      runs = runs.filter((r) => r.inputId === filters.inputId);
    }
    
    runs.sort((a, b) => {
      const dateA = a.startedAt ? new Date(a.startedAt).getTime() : 0;
      const dateB = b.startedAt ? new Date(b.startedAt).getTime() : 0;
      return dateB - dateA;
    });
    
    if (filters?.limit) {
      runs = runs.slice(0, filters.limit);
    }
    
    return runs;
  }

  async getWorkflowRun(id: string): Promise<WorkflowRun | undefined> {
    return this.workflowRuns.get(id);
  }

  async createWorkflowRun(run: InsertWorkflowRun): Promise<WorkflowRun> {
    const id = randomUUID();
    const newRun: WorkflowRun = {
      ...run,
      id,
      status: "pending",
      startedAt: new Date(),
      completedAt: null,
      costEstimate: null,
    };
    this.workflowRuns.set(id, newRun);
    return newRun;
  }

  async updateWorkflowRun(id: string, data: Partial<WorkflowRun>): Promise<WorkflowRun | undefined> {
    const run = this.workflowRuns.get(id);
    if (!run) return undefined;
    const updated = { ...run, ...data };
    this.workflowRuns.set(id, updated);
    return updated;
  }

  // Assets
  async getAssets(filters?: { workspaceId?: string; status?: AssetStatus; inputId?: string; limit?: number }): Promise<Asset[]> {
    let assets = Array.from(this.assets.values());
    
    if (filters?.workspaceId) {
      assets = assets.filter((a) => a.workspaceId === filters.workspaceId);
    }
    if (filters?.status) {
      assets = assets.filter((a) => a.status === filters.status);
    }
    if (filters?.inputId) {
      assets = assets.filter((a) => a.inputId === filters.inputId);
    }
    
    assets.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
    
    if (filters?.limit) {
      assets = assets.slice(0, filters.limit);
    }
    
    return assets;
  }

  async getAsset(id: string): Promise<Asset | undefined> {
    return this.assets.get(id);
  }

  async createAsset(asset: InsertAsset): Promise<Asset> {
    const id = randomUUID();
    const newAsset: Asset = {
      ...asset,
      id,
      createdAt: new Date(),
    };
    this.assets.set(id, newAsset);
    return newAsset;
  }

  async updateAsset(id: string, data: Partial<Asset>): Promise<Asset | undefined> {
    const asset = this.assets.get(id);
    if (!asset) return undefined;
    const updated = { ...asset, ...data };
    this.assets.set(id, updated);
    return updated;
  }

  async deleteAsset(id: string): Promise<boolean> {
    return this.assets.delete(id);
  }

  // Projects
  async getProjects(workspaceId?: string): Promise<Project[]> {
    const projects = Array.from(this.projects.values());
    if (workspaceId) {
      return projects.filter((p) => p.workspaceId === workspaceId);
    }
    return projects;
  }

  async getProject(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async createProject(project: InsertProject): Promise<Project> {
    const id = randomUUID();
    const newProject: Project = {
      ...project,
      id,
      createdAt: new Date(),
    };
    this.projects.set(id, newProject);
    return newProject;
  }

  // Stats
  async getStats(workspaceId?: string): Promise<{
    totalInputs: number;
    totalAssets: number;
    workflowRuns: number;
    approvedAssets: number;
  }> {
    const inputs = await this.getInputs(workspaceId);
    const assets = await this.getAssets({ workspaceId });
    const runs = await this.getWorkflowRuns({ workspaceId });
    const approved = assets.filter((a) => a.status === "approved" || a.status === "published");
    
    return {
      totalInputs: inputs.length,
      totalAssets: assets.length,
      workflowRuns: runs.length,
      approvedAssets: approved.length,
    };
  }
}

export const storage = new MemStorage();

import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { processWorkflowWithAI } from "./ai-workflow";
import { 
  insertInputSchema, 
  insertBrandSchema, 
  insertWorkflowRunSchema,
  insertAssetSchema,
  insertAssetVersionSchema,
  insertTemplateSchema,
  insertCommentSchema,
  insertWorkspaceSchema,
  insertPublishingTargetSchema,
  insertPublishJobSchema,
  workflowMeta,
  type WorkflowType,
  type AssetStatus,
  type ChannelType,
} from "@shared/schema";
import { z } from "zod";

// Legacy simulated AI workflow processing (fallback)
async function processWorkflowLegacy(
  runId: string, 
  inputId: string, 
  workflowType: WorkflowType,
  workspaceId: string,
  brandId?: string | null,
  userId?: string
): Promise<void> {
  console.log(`[Workflow] Starting processing for run ${runId}, workflow type: ${workflowType}`);
  
  try {
    const input = await storage.getInput(inputId);
    if (!input) {
      console.log(`[Workflow] Input ${inputId} not found, marking run as failed`);
      await storage.updateWorkflowRun(runId, { 
        status: "failed",
        completedAt: new Date(),
      });
      return;
    }

    console.log(`[Workflow] Found input: ${input.title}`);
    
    await storage.updateWorkflowRun(runId, { status: "running" });
    await new Promise(resolve => setTimeout(resolve, 1500));

    const inputText = input.rawText || input.sourceUrl || "";
    
    let title = "";
    let body = "";
    let channel: ChannelType = "generic";
    
    switch (workflowType) {
      case "headline_pack":
        title = `Headlines for: ${input.title}`;
        body = `# Headline Variations\n\n1. **Attention-Grabbing:** ${input.title.toUpperCase()}\n2. **Question Format:** What Makes ${input.title} So Special?\n3. **How-To Style:** How to Master ${input.title}\n4. **Listicle:** 5 Things You Need to Know About ${input.title}\n5. **Curiosity Gap:** The Secret Behind ${input.title} Revealed`;
        channel = "generic";
        break;
        
      case "seo_blog":
        title = `SEO Blog: ${input.title}`;
        body = `# ${input.title}\n\n## Introduction\n\nIn this comprehensive guide, we'll explore everything you need to know about this topic.\n\n## Key Points\n\n${inputText.slice(0, 200)}\n\n## Detailed Analysis\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit.\n\n## Conclusion\n\nThis topic continues to evolve, and staying informed is essential for success.\n\n---\n\n**Meta Description:** Discover expert insights on ${input.title}.\n\n**Keywords:** ${input.title.toLowerCase()}, guide, tips`;
        channel = "blog";
        break;
        
      case "social_pack":
        title = `Social Pack: ${input.title}`;
        body = `# Social Media Content Pack\n\n## LinkedIn\n${inputText.slice(0, 100)}...\n\n#ContentStrategy #Marketing\n\n---\n\n## Twitter/X\nThread (1/3): ${input.title}\n\n---\n\n## Instagram Caption\n${input.title}`;
        channel = "linkedin";
        break;
        
      case "executive_brief":
        title = `Executive Brief: ${input.title}`;
        body = `# Executive Summary\n\n**Topic:** ${input.title}\n\n## Key Findings\n\n1. Primary insight\n2. Secondary consideration\n3. Strategic implication\n\n## Recommendations\n\n- Action item 1\n- Action item 2`;
        channel = "generic";
        break;
        
      case "newsletter":
        title = `Newsletter: ${input.title}`;
        body = `# Newsletter Draft\n\n**Subject Lines:**\n1. ${input.title} - What You Need to Know\n2. This Week: ${input.title}\n\n---\n\n## Body\n\nHi [First Name],\n\n${inputText.slice(0, 150)}...\n\nBest regards`;
        channel = "newsletter";
        break;
        
      case "press_release":
        title = `Press Release: ${input.title}`;
        body = `# FOR IMMEDIATE RELEASE\n\n## ${input.title.toUpperCase()}\n\n**[City, Date]** — ${inputText.slice(0, 200)}\n\n### Media Contact\n\nEmail: press@company.com`;
        channel = "press_release";
        break;
        
      case "rewrite_tone":
        title = `Rewritten: ${input.title}`;
        body = `# Tone Variations\n\n## Professional Tone\n${inputText.slice(0, 150)}...\n\n## Casual Tone\nHey there! Let me tell you about ${input.title}...`;
        channel = "generic";
        break;
        
      case "expand_longform":
        title = `Expanded: ${input.title}`;
        body = `# ${input.title}\n\n## Overview\n\n${inputText}\n\n## Deep Dive\n\nThis section explores the topic in greater detail...`;
        channel = "blog";
        break;
        
      case "summarize":
        title = `Summary: ${input.title}`;
        body = `# Summary\n\n**Original Topic:** ${input.title}\n\n**Key Points:**\n- Main takeaway\n- Secondary insight\n\n**In Brief:** ${inputText.slice(0, 100)}...`;
        channel = "generic";
        break;
        
      case "translation_ar_en":
      case "translation_en_ar":
        title = `Translation: ${input.title}`;
        body = `# Translation\n\n**Original:**\n${inputText.slice(0, 200)}\n\n**Translated:**\n[Simulated translation]`;
        channel = "generic";
        break;
        
      case "image_prompts":
        title = `Image Prompts: ${input.title}`;
        body = `# Image Prompt Pack\n\n## Hero Image\nA professional photograph representing ${input.title}\n\n## Social Media Graphic\nBold typography with key quote`;
        channel = "generic";
        break;
        
      case "repurpose_transcript":
        title = `Repurposed: ${input.title}`;
        body = `# Content Repurposing Pack\n\n## Blog Article\n${inputText.slice(0, 150)}...\n\n## Key Quotes\n> "Notable quote"`;
        channel = "blog";
        break;
        
      default:
        title = `Generated: ${input.title}`;
        body = `# AI Generated Content\n\nBased on: ${input.title}\n\n${inputText}`;
        channel = "generic";
    }

    // Create asset container
    console.log(`[Workflow] Creating asset for run ${runId}`);
    const asset = await storage.createAsset({
      workspaceId,
      brandId,
      inputId,
      status: "draft",
      primaryLanguage: input.language || "en",
    });

    // Create first version
    await storage.createAssetVersion({
      assetId: asset.id,
      versionNo: 1,
      title,
      body,
      format: "md",
      channel,
      language: input.language || "en",
      metadataJson: {
        generatedAt: new Date().toISOString(),
        sourceInputId: inputId,
      },
      createdBy: userId,
      runId,
      workflowType,
    });
    
    console.log(`[Workflow] Asset created with id ${asset.id}`);

    // Record usage
    await storage.createUsageEntry({
      workspaceId,
      userId,
      runId,
      units: "1",
      unitType: "run",
      description: `${workflowMeta[workflowType].label} workflow`,
    });

    // Mark run as completed
    await storage.updateWorkflowRun(runId, {
      status: "succeeded",
      completedAt: new Date(),
      costEstimate: String(Math.floor(Math.random() * 100) + 10),
      outputJson: { assetId: asset.id, title },
    });
    
    console.log(`[Workflow] Completed run ${runId}`);
  } catch (error) {
    console.error(`[Workflow] Error processing run ${runId}:`, error);
    await storage.updateWorkflowRun(runId, {
      status: "failed",
      completedAt: new Date(),
      errorJson: { message: String(error) },
    }).catch(console.error);
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Setup authentication (must be before other routes)
  await setupAuth(app);
  registerAuthRoutes(app);
  
  // Stats (public for dashboard)
  app.get("/api/stats", async (req: Request, res: Response) => {
    try {
      const workspaceId = req.query.workspaceId as string | undefined;
      const stats = await storage.getStats(workspaceId);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Workspaces
  app.get("/api/workspaces", async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      if (userId) {
        const workspaces = await storage.getUserWorkspaces(userId);
        return res.json(workspaces);
      }
      const workspaces = await storage.getWorkspaces();
      res.json(workspaces);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch workspaces" });
    }
  });

  app.get("/api/workspaces/:id", async (req: Request, res: Response) => {
    try {
      const workspace = await storage.getWorkspace(req.params.id);
      if (!workspace) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      res.json(workspace);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch workspace" });
    }
  });

  app.post("/api/workspaces", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const data = insertWorkspaceSchema.parse(req.body);
      const workspace = await storage.createWorkspace(data);
      
      // Add creator as owner
      const userId = (req.user as any)?.claims?.sub;
      if (userId) {
        await storage.addUserToWorkspace({
          workspaceId: workspace.id,
          userId,
          role: "owner",
        });
      }
      
      res.status(201).json(workspace);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create workspace" });
    }
  });

  // Workspace Users
  app.get("/api/workspaces/:id/users", async (req: Request, res: Response) => {
    try {
      const users = await storage.getWorkspaceUsers(req.params.id);
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch workspace users" });
    }
  });

  app.post("/api/workspaces/:id/users", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { userId, role } = req.body;
      const workspaceUser = await storage.addUserToWorkspace({
        workspaceId: req.params.id,
        userId,
        role: role || "viewer",
      });
      res.status(201).json(workspaceUser);
    } catch (error) {
      res.status(500).json({ error: "Failed to add user to workspace" });
    }
  });

  // Brands
  app.get("/api/brands", async (req: Request, res: Response) => {
    try {
      const workspaceId = req.query.workspaceId as string | undefined;
      const brands = await storage.getBrands(workspaceId);
      res.json(brands);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch brands" });
    }
  });

  app.get("/api/brands/:id", async (req: Request, res: Response) => {
    try {
      const brand = await storage.getBrand(req.params.id);
      if (!brand) {
        return res.status(404).json({ error: "Brand not found" });
      }
      res.json(brand);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch brand" });
    }
  });

  app.post("/api/brands", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const data = insertBrandSchema.parse(req.body);
      const brand = await storage.createBrand(data);
      res.status(201).json(brand);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create brand" });
    }
  });

  app.patch("/api/brands/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const brand = await storage.updateBrand(req.params.id, req.body);
      if (!brand) {
        return res.status(404).json({ error: "Brand not found" });
      }
      res.json(brand);
    } catch (error) {
      res.status(500).json({ error: "Failed to update brand" });
    }
  });

  app.delete("/api/brands/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      await storage.deleteBrand(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete brand" });
    }
  });

  // Templates
  app.get("/api/templates", async (req: Request, res: Response) => {
    try {
      const { workspaceId, brandId } = req.query;
      const templates = await storage.getTemplates(workspaceId as string, brandId as string);
      res.json(templates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  app.get("/api/templates/:id", async (req: Request, res: Response) => {
    try {
      const template = await storage.getTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch template" });
    }
  });

  app.post("/api/templates", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const data = insertTemplateSchema.parse(req.body);
      const template = await storage.createTemplate(data);
      res.status(201).json(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create template" });
    }
  });

  app.patch("/api/templates/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const template = await storage.updateTemplate(req.params.id, req.body);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to update template" });
    }
  });

  app.delete("/api/templates/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      await storage.deleteTemplate(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete template" });
    }
  });

  // Projects
  app.get("/api/projects", async (req: Request, res: Response) => {
    try {
      const workspaceId = req.query.workspaceId as string | undefined;
      const projects = await storage.getProjects(workspaceId);
      res.json(projects);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  // Inputs
  app.get("/api/inputs", async (req: Request, res: Response) => {
    try {
      const workspaceId = req.query.workspaceId as string | undefined;
      const inputs = await storage.getInputs(workspaceId);
      res.json(inputs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch inputs" });
    }
  });

  app.get("/api/inputs/:id", async (req: Request, res: Response) => {
    try {
      const input = await storage.getInput(req.params.id);
      if (!input) {
        return res.status(404).json({ error: "Input not found" });
      }
      res.json(input);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch input" });
    }
  });

  app.post("/api/inputs", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const data = insertInputSchema.parse(req.body);
      const input = await storage.createInput(data);
      res.status(201).json(input);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create input" });
    }
  });

  app.delete("/api/inputs/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      await storage.deleteInput(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete input" });
    }
  });

  // Workflow Runs
  app.get("/api/workflow-runs", async (req: Request, res: Response) => {
    try {
      const workspaceId = req.query.workspaceId as string | undefined;
      const runs = await storage.getWorkflowRuns(workspaceId);
      res.json(runs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch workflow runs" });
    }
  });

  app.get("/api/workflow-runs/:id", async (req: Request, res: Response) => {
    try {
      const run = await storage.getWorkflowRun(req.params.id);
      if (!run) {
        return res.status(404).json({ error: "Workflow run not found" });
      }
      res.json(run);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch workflow run" });
    }
  });

  app.post("/api/workflow-runs", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const data = insertWorkflowRunSchema.parse(req.body);
      const run = await storage.createWorkflowRun(data);
      
      const userId = (req.user as any)?.claims?.sub;
      
      // Start async AI processing
      processWorkflowWithAI(
        run.id, 
        data.inputId, 
        data.workflowType as WorkflowType,
        data.workspaceId,
        data.brandId,
        userId
      ).catch(console.error);
      
      res.status(201).json(run);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create workflow run" });
    }
  });

  // Assets
  app.get("/api/assets", async (req: Request, res: Response) => {
    try {
      const { workspaceId, status } = req.query;
      const assetsData = await storage.getAssets(
        workspaceId as string, 
        status as AssetStatus
      );
      
      // Include latest version info for each asset
      const assetsWithVersions = await Promise.all(
        assetsData.map(async (asset) => {
          const latestVersion = await storage.getLatestAssetVersion(asset.id);
          return {
            ...asset,
            latestVersion,
          };
        })
      );
      
      res.json(assetsWithVersions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch assets" });
    }
  });

  app.get("/api/assets/:id", async (req: Request, res: Response) => {
    try {
      const asset = await storage.getAsset(req.params.id);
      if (!asset) {
        return res.status(404).json({ error: "Asset not found" });
      }
      
      const versions = await storage.getAssetVersions(asset.id);
      res.json({ ...asset, versions });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch asset" });
    }
  });

  app.post("/api/assets", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const data = insertAssetSchema.parse(req.body);
      const asset = await storage.createAsset(data);
      res.status(201).json(asset);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create asset" });
    }
  });

  app.patch("/api/assets/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const asset = await storage.updateAsset(req.params.id, req.body);
      if (!asset) {
        return res.status(404).json({ error: "Asset not found" });
      }
      res.json(asset);
    } catch (error) {
      res.status(500).json({ error: "Failed to update asset" });
    }
  });

  // Asset status changes
  app.post("/api/assets/:id/submit-review", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const asset = await storage.updateAsset(req.params.id, { status: "in_review" });
      res.json(asset);
    } catch (error) {
      res.status(500).json({ error: "Failed to submit for review" });
    }
  });

  app.post("/api/assets/:id/approve", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const asset = await storage.updateAsset(req.params.id, { status: "approved" });
      res.json(asset);
    } catch (error) {
      res.status(500).json({ error: "Failed to approve asset" });
    }
  });

  app.post("/api/assets/:id/publish", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const asset = await storage.updateAsset(req.params.id, { status: "published" });
      res.json(asset);
    } catch (error) {
      res.status(500).json({ error: "Failed to publish asset" });
    }
  });

  app.delete("/api/assets/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      await storage.deleteAsset(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete asset" });
    }
  });

  // Asset Versions
  app.get("/api/assets/:id/versions", async (req: Request, res: Response) => {
    try {
      const versions = await storage.getAssetVersions(req.params.id);
      res.json(versions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch asset versions" });
    }
  });

  app.post("/api/assets/:id/versions", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const asset = await storage.getAsset(req.params.id);
      if (!asset) {
        return res.status(404).json({ error: "Asset not found" });
      }
      
      const existingVersions = await storage.getAssetVersions(req.params.id);
      const nextVersionNo = existingVersions.length > 0 
        ? Math.max(...existingVersions.map(v => v.versionNo)) + 1 
        : 1;
      
      const userId = (req.user as any)?.claims?.sub;
      
      const data = insertAssetVersionSchema.parse({
        ...req.body,
        assetId: req.params.id,
        versionNo: nextVersionNo,
        createdBy: userId,
      });
      
      const version = await storage.createAssetVersion(data);
      res.status(201).json(version);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create asset version" });
    }
  });

  app.get("/api/asset-versions/:id", async (req: Request, res: Response) => {
    try {
      const version = await storage.getAssetVersion(req.params.id);
      if (!version) {
        return res.status(404).json({ error: "Version not found" });
      }
      res.json(version);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch asset version" });
    }
  });

  app.patch("/api/asset-versions/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const version = await storage.updateAssetVersion(req.params.id, req.body);
      if (!version) {
        return res.status(404).json({ error: "Version not found" });
      }
      res.json(version);
    } catch (error) {
      res.status(500).json({ error: "Failed to update asset version" });
    }
  });

  // Comments
  app.get("/api/asset-versions/:id/comments", async (req: Request, res: Response) => {
    try {
      const comments = await storage.getComments(req.params.id);
      res.json(comments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch comments" });
    }
  });

  app.post("/api/asset-versions/:id/comments", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      const data = insertCommentSchema.parse({
        assetVersionId: req.params.id,
        userId,
        body: req.body.body,
      });
      
      const comment = await storage.createComment(data);
      res.status(201).json(comment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create comment" });
    }
  });

  app.delete("/api/comments/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      await storage.deleteComment(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete comment" });
    }
  });

  // Publishing Targets
  app.get("/api/publishing-targets", async (req: Request, res: Response) => {
    try {
      const workspaceId = req.query.workspaceId as string;
      if (!workspaceId) {
        return res.status(400).json({ error: "workspaceId required" });
      }
      const targets = await storage.getPublishingTargets(workspaceId);
      res.json(targets);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch publishing targets" });
    }
  });

  app.post("/api/publishing-targets", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const data = insertPublishingTargetSchema.parse(req.body);
      const target = await storage.createPublishingTarget(data);
      res.status(201).json(target);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create publishing target" });
    }
  });

  app.delete("/api/publishing-targets/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      await storage.deletePublishingTarget(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete publishing target" });
    }
  });

  // Publish Jobs
  app.get("/api/publish-jobs", async (req: Request, res: Response) => {
    try {
      const assetVersionId = req.query.assetVersionId as string | undefined;
      const jobs = await storage.getPublishJobs(assetVersionId);
      res.json(jobs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch publish jobs" });
    }
  });

  app.post("/api/publish-jobs", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const data = insertPublishJobSchema.parse(req.body);
      const job = await storage.createPublishJob(data);
      res.status(201).json(job);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create publish job" });
    }
  });

  // Usage Ledger
  app.get("/api/usage", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const workspaceId = req.query.workspaceId as string;
      if (!workspaceId) {
        return res.status(400).json({ error: "workspaceId required" });
      }
      const usage = await storage.getUsageLedger(workspaceId);
      res.json(usage);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch usage" });
    }
  });

  // Export endpoint
  app.get("/api/export/:assetVersionId", async (req: Request, res: Response) => {
    try {
      const version = await storage.getAssetVersion(req.params.assetVersionId);
      if (!version) {
        return res.status(404).json({ error: "Version not found" });
      }
      
      const format = req.query.format as string || "md";
      const content = version.body;
      
      let contentType = "text/markdown";
      let filename = `${version.title || "content"}.md`;
      
      if (format === "html") {
        contentType = "text/html";
        filename = `${version.title || "content"}.html`;
      } else if (format === "txt") {
        contentType = "text/plain";
        filename = `${version.title || "content"}.txt`;
      }
      
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      res.send(content);
    } catch (error) {
      res.status(500).json({ error: "Failed to export" });
    }
  });

  return httpServer;
}

import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertInputSchema, 
  insertBrandSchema, 
  insertWorkflowRunSchema,
  insertAssetSchema,
  workflowMeta,
  type WorkflowType,
  type AssetStatus,
} from "@shared/schema";
import { z } from "zod";

// Simulated AI workflow processing
async function processWorkflow(
  runId: string, 
  inputId: string, 
  workflowType: WorkflowType,
  workspaceId: string,
  brandId?: string | null
): Promise<void> {
  console.log(`[Workflow] Starting processing for run ${runId}, workflow type: ${workflowType}`);
  
  try {
    // Get input content
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
    
    // Simulate processing delay
    await storage.updateWorkflowRun(runId, { status: "running" });
    await new Promise(resolve => setTimeout(resolve, 1500));

  // Generate mock output based on workflow type
  const meta = workflowMeta[workflowType];
  const inputText = input.rawText || input.sourceUrl || "";
  
  let title = "";
  let body = "";
  let channelType = "";
  
  switch (workflowType) {
    case "headline_pack":
      title = `Headlines for: ${input.title}`;
      body = `# Headline Variations\n\n1. **Attention-Grabbing:** ${input.title.toUpperCase()}\n2. **Question Format:** What Makes ${input.title} So Special?\n3. **How-To Style:** How to Master ${input.title}\n4. **Listicle:** 5 Things You Need to Know About ${input.title}\n5. **Curiosity Gap:** The Secret Behind ${input.title} Revealed`;
      channelType = "headlines";
      break;
      
    case "seo_blog":
      title = `SEO Blog: ${input.title}`;
      body = `# ${input.title}\n\n## Introduction\n\nIn this comprehensive guide, we'll explore everything you need to know about this topic.\n\n## Key Points\n\n${inputText.slice(0, 200)}\n\n## Detailed Analysis\n\nLorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.\n\n## Conclusion\n\nThis topic continues to evolve, and staying informed is essential for success.\n\n---\n\n**Meta Description:** Discover expert insights on ${input.title}. Learn key strategies and best practices.\n\n**Keywords:** ${input.title.toLowerCase()}, guide, tips, strategies`;
      channelType = "blog";
      break;
      
    case "social_pack":
      title = `Social Pack: ${input.title}`;
      body = `# Social Media Content Pack\n\n## LinkedIn\n${inputText.slice(0, 100)}...\n\nKey takeaway: This matters because of [impact].\n\n#ContentStrategy #Marketing\n\n---\n\n## Twitter/X\nThread (1/3): ${input.title}\n\n(2/3) Here's what you need to know...\n\n(3/3) The bottom line: [key insight]\n\n---\n\n## Instagram Caption\n${input.title} ✨\n\nSwipe to learn more about this game-changing topic.\n\nDouble-tap if you agree! 👆`;
      channelType = "social";
      break;
      
    case "executive_brief":
      title = `Executive Brief: ${input.title}`;
      body = `# Executive Summary\n\n**Topic:** ${input.title}\n\n## Key Findings\n\n1. Primary insight from the analysis\n2. Secondary consideration\n3. Strategic implication\n\n## Recommendations\n\n- Action item 1\n- Action item 2\n- Action item 3\n\n## Next Steps\n\nSchedule follow-up discussion to align on implementation.`;
      channelType = "executive";
      break;
      
    case "newsletter":
      title = `Newsletter: ${input.title}`;
      body = `# Newsletter Draft\n\n**Subject Line Options:**\n1. 📢 ${input.title} - What You Need to Know\n2. This Week: ${input.title}\n3. Don't Miss: Key Updates on ${input.title}\n\n---\n\n## Body\n\nHi [First Name],\n\n${inputText.slice(0, 150)}...\n\n**Key Takeaways:**\n- Point 1\n- Point 2\n- Point 3\n\nBest regards,\n[Your Name]`;
      channelType = "email";
      break;
      
    case "press_release":
      title = `Press Release: ${input.title}`;
      body = `# FOR IMMEDIATE RELEASE\n\n## ${input.title.toUpperCase()}\n\n**[City, Date]** — Lorem ipsum dolor sit amet, consectetur adipiscing elit.\n\n${inputText.slice(0, 200)}\n\n### About [Company]\n\n[Company description]\n\n### Media Contact\n\nName: [Contact Name]\nEmail: press@company.com\nPhone: (xxx) xxx-xxxx\n\n###`;
      channelType = "pr";
      break;
      
    case "rewrite_tone":
      title = `Rewritten: ${input.title}`;
      body = `# Tone Variations\n\n## Professional Tone\n${inputText.slice(0, 150)}...\n\n## Casual Tone\nHey there! Let me tell you about ${input.title}...\n\n## Formal Tone\nWe respectfully present the following information regarding ${input.title}...`;
      channelType = "rewrite";
      break;
      
    case "expand_longform":
      title = `Expanded: ${input.title}`;
      body = `# ${input.title}\n\n## Overview\n\n${inputText}\n\n## Deep Dive\n\nThis section explores the topic in greater detail...\n\n## Case Studies\n\n### Example 1\nDescription of first example...\n\n### Example 2\nDescription of second example...\n\n## Best Practices\n\n1. First recommendation\n2. Second recommendation\n3. Third recommendation\n\n## Conclusion\n\nSummary and next steps...`;
      channelType = "longform";
      break;
      
    case "summarize":
      title = `Summary: ${input.title}`;
      body = `# Summary\n\n**Original Topic:** ${input.title}\n\n**Key Points:**\n- Main takeaway from the content\n- Secondary insight\n- Supporting detail\n\n**In Brief:** ${inputText.slice(0, 100)}...`;
      channelType = "summary";
      break;
      
    case "translation_ar_en":
    case "translation_en_ar":
      title = `Translation: ${input.title}`;
      body = `# Translation\n\n**Original:**\n${inputText.slice(0, 200)}\n\n**Translated:**\n[Simulated translation of the content would appear here]\n\n---\n*Note: This is a simulated translation for demonstration purposes.*`;
      channelType = "translation";
      break;
      
    case "image_prompts":
      title = `Image Prompts: ${input.title}`;
      body = `# Image Prompt Pack\n\n## Hero Image\nA professional, modern photograph representing ${input.title}, with clean composition, soft natural lighting, corporate environment.\n\n## Social Media Graphic\nBold typography overlaid on abstract gradient background, featuring key quote from ${input.title}.\n\n## Infographic Style\nClean, minimalist infographic layout with icons representing main concepts from ${input.title}.\n\n## Blog Header\nSubtle, professional banner image with muted colors, conveying expertise and trust.`;
      channelType = "visual";
      break;
      
    case "repurpose_transcript":
      title = `Repurposed: ${input.title}`;
      body = `# Content Repurposing Pack\n\n## Blog Article\n${inputText.slice(0, 150)}...\n\n## Key Quotes\n> "Notable quote from the transcript"\n> "Another impactful statement"\n\n## Social Posts\n1. Quick insight from the conversation\n2. Another shareable moment\n\n## Newsletter Excerpt\nHighlight from recent discussion...`;
      channelType = "repurpose";
      break;
      
    default:
      title = `Generated: ${input.title}`;
      body = `# AI Generated Content\n\nBased on: ${input.title}\n\n${inputText}`;
      channelType = "general";
    }

    // Create the asset
    console.log(`[Workflow] Creating asset for run ${runId}`);
    const asset = await storage.createAsset({
      workspaceId,
      brandId,
      inputId,
      runId,
      title,
      body,
      format: "markdown",
      channelType,
      language: input.language || "en",
      status: "draft",
      workflowType,
      metadata: {
        generatedAt: new Date().toISOString(),
        sourceInputId: inputId,
      },
    });
    console.log(`[Workflow] Asset created with id ${asset.id}`);

    // Mark run as completed
    await storage.updateWorkflowRun(runId, {
      status: "completed",
      completedAt: new Date(),
      costEstimate: Math.floor(Math.random() * 100) + 10,
    });
    
    console.log(`[Workflow] Completed run ${runId}`);
  } catch (error) {
    console.error(`[Workflow] Error processing run ${runId}:`, error);
    await storage.updateWorkflowRun(runId, {
      status: "failed",
      completedAt: new Date(),
    }).catch(console.error);
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // Stats
  app.get("/api/stats", async (req: Request, res: Response) => {
    try {
      const stats = await storage.getStats();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Workspaces
  app.get("/api/workspaces", async (req: Request, res: Response) => {
    try {
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

  // Brands
  app.get("/api/brands", async (req: Request, res: Response) => {
    try {
      const brands = await storage.getBrands();
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

  app.post("/api/brands", async (req: Request, res: Response) => {
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

  app.patch("/api/brands/:id", async (req: Request, res: Response) => {
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

  // Inputs
  app.get("/api/inputs", async (req: Request, res: Response) => {
    try {
      const inputs = await storage.getInputs();
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

  app.post("/api/inputs", async (req: Request, res: Response) => {
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

  app.delete("/api/inputs/:id", async (req: Request, res: Response) => {
    try {
      const deleted = await storage.deleteInput(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Input not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete input" });
    }
  });

  // Workflow Runs
  app.get("/api/workflow-runs", async (req: Request, res: Response) => {
    try {
      const { inputId, limit } = req.query;
      const runs = await storage.getWorkflowRuns({
        inputId: inputId as string,
        limit: limit ? parseInt(limit as string) : undefined,
      });
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

  app.post("/api/workflow-runs", async (req: Request, res: Response) => {
    try {
      const data = insertWorkflowRunSchema.parse(req.body);
      
      // Verify input exists
      const input = await storage.getInput(data.inputId);
      if (!input) {
        return res.status(400).json({ error: "Input not found" });
      }
      
      const run = await storage.createWorkflowRun(data);
      
      // Start async processing (don't await)
      processWorkflow(
        run.id, 
        data.inputId, 
        data.workflowType as WorkflowType,
        data.workspaceId,
        data.brandId
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
      const { status, inputId, limit } = req.query;
      const assets = await storage.getAssets({
        status: status as AssetStatus,
        inputId: inputId as string,
        limit: limit ? parseInt(limit as string) : undefined,
      });
      res.json(assets);
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
      res.json(asset);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch asset" });
    }
  });

  app.post("/api/assets", async (req: Request, res: Response) => {
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

  app.patch("/api/assets/:id", async (req: Request, res: Response) => {
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

  app.delete("/api/assets/:id", async (req: Request, res: Response) => {
    try {
      const deleted = await storage.deleteAsset(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Asset not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete asset" });
    }
  });

  // Projects
  app.get("/api/projects", async (req: Request, res: Response) => {
    try {
      const projects = await storage.getProjects();
      res.json(projects);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch projects" });
    }
  });

  return httpServer;
}

import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import crypto from "crypto";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated, authStorage, createAutomationAuthMiddleware, resolveWorkspaceId, resolveWorkspace } from "./replit_integrations/auth";
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
  insertSourceSchema,
  insertAutomationSchema,
  workflowMeta,
  type WorkflowType,
  type AssetStatus,
  type ChannelType,
  type SourceItemStatus,
} from "@shared/schema";
import { z } from "zod";
import { fetchRSSSource, testRSSFeed } from "./services/rss-service";
import { runAutomation } from "./services/automation-service";
import { testWordPressConnection, publishToWordPress, fetchWordPressCategories, fetchWordPressTags, createWordPressTag, createWordPressCategory } from "./services/wordpress-service";
import { startScheduler } from "./services/scheduler";
import { runDiscoveryJob, convertDiscoveredSourceToSource } from "./services/discovery-service";
import { insertContentGoalSchema, insertTopicSchema, insertDraftSchema, insertImageAssetSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { scoreStoryRelevance } from "./services/topic-relevance-service";

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
  
  // Get current user's workspace ID (for API calls that need it)
  app.get("/api/user/workspace", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      const workspace = await resolveWorkspace(userId);
      if (!workspace) {
        return res.status(404).json({ error: "No workspace found for user" });
      }
      return res.json({ workspaceId: workspace.id, workspaceSlug: workspace.slug, workspaceName: workspace.name });
    } catch (error) {
      console.error("[API] Error getting user workspace:", error);
      return res.status(500).json({ error: "Failed to get workspace" });
    }
  });
  
  // GET /api/me/context - Single source of truth for active workspace
  app.get("/api/me/context", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      // Ensure user has at least one workspace (auto-create if needed)
      await authStorage.ensureUserHasWorkspace(userId);
      
      // Get all user's workspace memberships (refreshed after potential auto-creation)
      const memberships = await storage.getUserWorkspaceMemberships(userId);
      if (!memberships || memberships.length === 0) {
        // This should not happen after ensureUserHasWorkspace, but guard against edge cases
        return res.status(500).json({ 
          error: "Failed to create workspace membership",
          errorCode: "WORKSPACE_CREATION_FAILED"
        });
      }
      
      // Determine active workspace:
      // 1. Check X-Workspace-Id header (if provided AND user is member)
      // 2. Check cs_workspace_id cookie (if valid AND user is member)
      // 3. Fall back to first membership
      let activeWorkspaceId: string = memberships[0].workspaceId;
      
      const headerWorkspaceId = req.headers["x-workspace-id"] as string | undefined;
      if (headerWorkspaceId && memberships.some((m: { workspaceId: string }) => m.workspaceId === headerWorkspaceId)) {
        activeWorkspaceId = headerWorkspaceId;
      } else {
        const cookieWorkspaceId = (req.cookies as any)?.cs_workspace_id;
        if (cookieWorkspaceId && memberships.some((m: { workspaceId: string }) => m.workspaceId === cookieWorkspaceId)) {
          activeWorkspaceId = cookieWorkspaceId;
        }
      }
      
      // Get counts for active workspace
      const [topics, targets, sources] = await Promise.all([
        storage.getTopics(activeWorkspaceId),
        storage.getPublishingTargets(activeWorkspaceId),
        storage.getSources(activeWorkspaceId),
      ]);
      
      // Get recent targets for quick display
      const recentTargets = targets.slice(0, 5).map(t => ({
        id: t.id,
        name: t.name,
        type: t.type,
        workspaceId: t.workspaceId,
      }));
      
      res.json({
        userId,
        memberships: memberships.map((m: { workspaceId: string; workspaceName: string; role: string }) => ({
          workspaceId: m.workspaceId,
          name: m.workspaceName,
          role: m.role,
        })),
        activeWorkspaceId,
        counts: {
          topicsCount: topics.length,
          targetsCount: targets.length,
          sourcesCount: sources.length,
        },
        recentTargets,
      });
    } catch (error) {
      console.error("[API] Error getting user context:", error);
      return res.status(500).json({ error: "Failed to get user context" });
    }
  });
  
  // GET /api/user/context - Full user context with workspace details and legacy report
  app.get("/api/user/context", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      // Ensure user has at least one workspace (auto-create if needed)
      const workspace = await authStorage.ensureUserHasWorkspace(userId);
      
      // Refresh memberships after potential auto-creation
      const memberships = await storage.getUserWorkspaceMemberships(userId);
      if (!memberships || memberships.length === 0) {
        // This should not happen after ensureUserHasWorkspace, but guard against edge cases
        return res.status(500).json({ 
          error: "Failed to create workspace membership",
          errorCode: "WORKSPACE_CREATION_FAILED"
        });
      }
      
      const activeMembership = memberships.find((m: { workspaceId: string }) => m.workspaceId === workspace.id);
      
      // Get counts for active workspace
      const [topics, targets, sources] = await Promise.all([
        storage.getTopics(workspace.id),
        storage.getPublishingTargets(workspace.id),
        storage.getSources(workspace.id),
      ]);
      
      // Check for legacy workspace IDs - fetch by both UUID and slug to catch legacy records
      // Build list of all possible workspace identifiers (UUIDs + slugs)
      const workspacesData = await Promise.all(
        memberships.map(async (m: { workspaceId: string }) => storage.getWorkspace(m.workspaceId))
      );
      const uuids = memberships.map((m: { workspaceId: string }) => m.workspaceId);
      const slugs = workspacesData.filter(Boolean).map(w => w!.slug).filter((s): s is string => !!s);
      const allWorkspaceIdentifiers = [...uuids, ...slugs];
      
      // Guard: ensure we have at least the active workspace UUID
      if (allWorkspaceIdentifiers.length === 0 && workspace?.id) {
        allWorkspaceIdentifiers.push(workspace.id);
      }
      
      // Fetch topics/targets matching any of these identifiers (catches legacy slug-based records)
      const [userTopics, userTargets] = await Promise.all([
        storage.getTopicsByWorkspaceIds(allWorkspaceIdentifiers),
        storage.getPublishingTargetsByWorkspaceIds(allWorkspaceIdentifiers),
      ]);
      
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const legacyTopics = userTopics.filter(t => !uuidPattern.test(t.workspaceId || ""));
      const legacyTargets = userTargets.filter(t => !uuidPattern.test(t.workspaceId || ""));
      const invalidSamples = [
        ...legacyTopics.slice(0, 3).map(t => `topic:${t.id}:${t.workspaceId}`),
        ...legacyTargets.slice(0, 3).map(t => `target:${t.id}:${t.workspaceId}`),
      ];
      
      res.json({
        user: {
          id: userId,
        },
        workspace: {
          id: workspace.id,
          name: workspace.name,
          slug: workspace.slug,
        },
        membership: {
          role: activeMembership?.role || "unknown",
        },
        counts: {
          topics: topics.length,
          targets: targets.length,
          sources: sources.length,
        },
        legacy: {
          topicsWithInvalidWorkspaceId: legacyTopics.length,
          targetsWithInvalidWorkspaceId: legacyTargets.length,
          invalidWorkspaceIdSamples: invalidSamples,
        },
      });
    } catch (error) {
      console.error("[API] Error getting user context:", error);
      return res.status(500).json({ error: "Failed to get user context" });
    }
  });
  
  // GET /api/debug/legacy-report - Report on legacy workspace IDs (no secrets)
  app.get("/api/debug/legacy-report", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      const workspace = await resolveWorkspace(userId);
      if (!workspace) {
        return res.status(404).json({ error: "No workspace found" });
      }
      
      // Fetch records by both UUID and slug to catch legacy records (tenant-safe)
      const memberships = await storage.getUserWorkspaceMemberships(userId);
      const workspacesData = await Promise.all(
        (memberships || []).map(async (m: { workspaceId: string }) => storage.getWorkspace(m.workspaceId))
      );
      const uuids = (memberships || []).map((m: { workspaceId: string }) => m.workspaceId);
      const slugs = workspacesData.filter(Boolean).map(w => w!.slug).filter((s): s is string => !!s);
      const allWorkspaceIdentifiers = [...uuids, ...slugs];
      
      // Guard: ensure we have at least the active workspace UUID
      if (allWorkspaceIdentifiers.length === 0 && workspace?.id) {
        allWorkspaceIdentifiers.push(workspace.id);
      }
      
      const [userTopics, userTargets] = await Promise.all([
        storage.getTopicsByWorkspaceIds(allWorkspaceIdentifiers),
        storage.getPublishingTargetsByWorkspaceIds(allWorkspaceIdentifiers),
      ]);
      
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const legacyTopics = userTopics.filter(t => !uuidPattern.test(t.workspaceId || ""));
      const legacyTargets = userTargets.filter(t => !uuidPattern.test(t.workspaceId || ""));
      
      res.json({
        currentWorkspace: {
          id: workspace.id,
          name: workspace.name,
        },
        legacyTopics: {
          count: legacyTopics.length,
          samples: legacyTopics.slice(0, 10).map(t => ({
            id: t.id,
            name: t.name,
            currentWorkspaceId: t.workspaceId,
          })),
        },
        legacyTargets: {
          count: legacyTargets.length,
          samples: legacyTargets.slice(0, 10).map(t => ({
            id: t.id,
            name: t.name,
            currentWorkspaceId: t.workspaceId,
          })),
        },
        summary: {
          totalLegacy: legacyTopics.length + legacyTargets.length,
          migrationRequired: legacyTopics.length > 0 || legacyTargets.length > 0,
        },
      });
    } catch (error) {
      console.error("[API] Error generating legacy report:", error);
      return res.status(500).json({ error: "Failed to generate legacy report" });
    }
  });
  
  // Debug: WordPress probe for diagnosing API issues
  app.get("/api/debug/wp-probe", async (req: Request, res: Response) => {
    const url = req.query.url;
    if (!url) return res.status(400).json({ error: "Missing ?url=" });

    try {
      const r = await fetch(String(url), {
        method: "GET",
        headers: {
          "accept": "application/json",
          "user-agent": "ContentSantaProbe/1.0",
        },
        redirect: "follow",
      });

      const contentType = r.headers.get("content-type");
      const text = await r.text();

      res.json({
        requestedUrl: url,
        finalUrl: r.url,
        status: r.status,
        contentType,
        first200: text.slice(0, 200).replace(/\s+/g, " "),
        isHtml: /<html|<!doctype/i.test(text),
        isCloudflare: /cloudflare|cf-ray|just a moment|attention required/i.test(text),
      });
    } catch (e) {
      res.status(500).json({ error: String(e) });
    }
  });
  
  // =====================================================
  // WordPress Pull Connector API (Plugin Authentication)
  // =====================================================
  
  // Pull next job (called by WordPress plugin)
  app.get("/api/wp/pull", async (req: Request, res: Response) => {
    const startTime = Date.now();
    const { authenticateWpPullRequest, pullNextJob } = await import("./services/wp-pull-service");
    
    const siteId = req.query.siteId as string | undefined;
    const secret = req.headers["x-contentsanta-secret"] as string | undefined;
    const secretLast4 = secret ? secret.slice(-4) : "none";
    
    const auth = await authenticateWpPullRequest(siteId, secret);
    if (!auth.ok) {
      console.log(`[WP Pull] Auth failed for siteId=${siteId}: ${auth.error}`);
      // Log failed auth attempt
      if (siteId) {
        await storage.createPluginRequestLog({
          siteId,
          targetId: auth.target?.id || null,
          endpoint: "pull",
          method: "GET",
          ipAddress: req.ip || req.headers["x-forwarded-for"]?.toString() || null,
          userAgent: req.headers["user-agent"] || null,
          reason: auth.errorCode === "INVALID_SECRET" ? "SECRET_INVALID" : 
                  auth.errorCode === "INVALID_SITE_ID" ? "SITE_NOT_FOUND" : "AUTH_FAILED",
          httpStatus: 401,
          responseMs: Date.now() - startTime,
          requestSummary: `siteId=${siteId}, secret=****${secretLast4}`,
          responseSummary: `error=${auth.error}`,
        });
      }
      return res.status(401).json({ ok: false, error: auth.error, errorCode: auth.errorCode });
    }
    
    // Update health status on successful authentication (even if no jobs)
    const now = new Date();
    await storage.updatePublishingTargetBySiteId(siteId!, {
      lastPullAt: now,
      lastHealthStatus: "ok",
      lastHealthCheckAt: now,
      lastErrorCode: null,
      lastErrorMessage: null,
    });
    console.log(`[WP Pull] Authenticated successfully for siteId=${siteId}`);
    
    const result = await pullNextJob(siteId!);
    
    // Log successful pull
    await storage.createPluginRequestLog({
      siteId: siteId!,
      targetId: auth.target?.id || null,
      endpoint: "pull",
      method: "GET",
      ipAddress: req.ip || req.headers["x-forwarded-for"]?.toString() || null,
      userAgent: req.headers["user-agent"] || null,
      reason: result.job ? "JOB_LEASED" : "JOB_NONE",
      httpStatus: result.job ? 200 : 204,
      responseMs: Date.now() - startTime,
      requestSummary: `siteId=${siteId}, secret=****${secretLast4}`,
      responseSummary: result.job ? `jobId=${result.job.jobId}` : "no jobs available",
    });
    
    // Prune old logs (keep last 20)
    await storage.pruneOldPluginRequestLogs(siteId!, 20);
    
    if (!result.job) {
      return res.status(204).send();
    }
    
    console.log(`[WP Pull] Job ${result.job.jobId} leased for siteId=${siteId}`);
    res.json(result.job);
  });
  
  // Report job result (called by WordPress plugin after publishing)
  app.post("/api/wp/report", async (req: Request, res: Response) => {
    const startTime = Date.now();
    const { authenticateWpPullRequest, reportJobResult } = await import("./services/wp-pull-service");
    
    const { siteId, jobId, leaseToken, ok, wpPostId, wpUrl, error } = req.body;
    const secret = req.headers["x-contentsanta-secret"] as string | undefined;
    const secretLast4 = secret ? secret.slice(-4) : "none";
    
    const auth = await authenticateWpPullRequest(siteId, secret);
    if (!auth.ok) {
      console.log(`[WP Report] Auth failed for siteId=${siteId}: ${auth.error}`);
      // Log failed auth attempt
      if (siteId) {
        await storage.createPluginRequestLog({
          siteId,
          targetId: auth.target?.id || null,
          endpoint: "report",
          method: "POST",
          ipAddress: req.ip || req.headers["x-forwarded-for"]?.toString() || null,
          userAgent: req.headers["user-agent"] || null,
          reason: "AUTH_FAILED",
          httpStatus: 401,
          responseMs: Date.now() - startTime,
          requestSummary: `siteId=${siteId}, jobId=${jobId}, secret=****${secretLast4}`,
          responseSummary: `error=${auth.error}`,
        });
      }
      return res.status(401).json({ ok: false, error: auth.error, errorCode: auth.errorCode });
    }
    
    const result = await reportJobResult({ siteId, jobId, leaseToken, ok, wpPostId, wpUrl, error });
    
    if (!result.ok) {
      console.log(`[WP Report] Failed for jobId=${jobId}: ${result.error}`);
      // Log failed report
      await storage.createPluginRequestLog({
        siteId,
        targetId: auth.target?.id || null,
        endpoint: "report",
        method: "POST",
        ipAddress: req.ip || req.headers["x-forwarded-for"]?.toString() || null,
        userAgent: req.headers["user-agent"] || null,
        reason: "REPORT_FAILED",
        httpStatus: 400,
        responseMs: Date.now() - startTime,
        requestSummary: `siteId=${siteId}, jobId=${jobId}, ok=${ok}`,
        responseSummary: `error=${result.error}`,
      });
      return res.status(400).json({ ok: false, error: result.error, errorCode: result.errorCode });
    }
    
    // Log successful report
    await storage.createPluginRequestLog({
      siteId,
      targetId: auth.target?.id || null,
      endpoint: "report",
      method: "POST",
      ipAddress: req.ip || req.headers["x-forwarded-for"]?.toString() || null,
      userAgent: req.headers["user-agent"] || null,
      reason: ok ? "REPORT_SUCCESS" : "REPORT_FAILED",
      httpStatus: 200,
      responseMs: Date.now() - startTime,
      requestSummary: `siteId=${siteId}, jobId=${jobId}, ok=${ok}`,
      responseSummary: ok ? `wpPostId=${wpPostId}, wpUrl=${wpUrl}` : `error=${error}`,
    });
    
    console.log(`[WP Report] Job ${jobId} reported as ${ok ? "published" : "failed"}`);
    res.json({ ok: true });
  });
  
  // Status endpoint (for plugin diagnostics)
  app.get("/api/wp/status", async (req: Request, res: Response) => {
    const { authenticateWpPullRequest, getStatus } = await import("./services/wp-pull-service");
    
    const siteId = req.query.siteId as string | undefined;
    const secret = req.headers["x-contentsanta-secret"] as string | undefined;
    
    const auth = await authenticateWpPullRequest(siteId, secret);
    if (!auth.ok) {
      return res.status(401).json({ ok: false, error: auth.error, errorCode: auth.errorCode });
    }
    
    const status = await getStatus(siteId!);
    if (!status) {
      return res.status(404).json({ ok: false, error: "Site not found" });
    }
    
    res.json({ ok: true, ...status });
  });
  
  // Get plugin request logs for debugging (authenticated - for UI)
  app.get("/api/publishing-targets/:id/plugin-logs", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const target = await storage.getPublishingTarget(req.params.id);
      if (!target) {
        return res.status(404).json({ error: "Publishing target not found" });
      }
      
      // Verify user has access: must be a member of the same workspace
      const userId = (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      if (target.workspaceId) {
        const workspaceUser = await storage.getWorkspaceUser(target.workspaceId, userId);
        if (!workspaceUser) {
          return res.status(403).json({ error: "Access denied - not a workspace member" });
        }
      }
      
      // Parse query params
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const type = req.query.type as string | undefined; // "pull" | "report" | "all"
      const errorsOnly = req.query.errorsOnly === "true";
      
      if (!target.siteId) {
        return res.json({ 
          logs: [],
          meta: {
            lastPullAt: target.lastPullAt,
            health: target.lastHealthStatus || "unknown",
            siteIdMasked: null,
          }
        });
      }
      
      // Mask siteId: show first 8 chars + last 4
      const siteIdMasked = target.siteId.length > 12 
        ? `${target.siteId.slice(0, 8)}...${target.siteId.slice(-4)}`
        : target.siteId;
      
      let logs = await storage.getPluginRequestLogs(target.siteId, limit);
      
      // Apply filters
      if (type && type !== "all") {
        logs = logs.filter(log => log.endpoint === type);
      }
      if (errorsOnly) {
        logs = logs.filter(log => log.httpStatus >= 400);
      }
      
      res.json({ 
        logs,
        meta: {
          lastPullAt: target.lastPullAt,
          health: target.lastHealthStatus || "unknown",
          siteIdMasked,
          targetName: target.name,
        }
      });
    } catch (error) {
      console.error("Error fetching plugin logs:", error);
      res.status(500).json({ error: "Failed to fetch plugin logs" });
    }
  });
  
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

  // Debug context endpoint - verify workspace resolution
  app.get("/api/debug/context", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      const email = (req.user as any)?.claims?.email;
      
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Get user's workspaces
      const userWorkspaces = await storage.getUserWorkspaces(userId);
      
      // Resolve default workspace
      const resolvedWorkspace = await resolveWorkspace(userId);
      
      // Get ALL topics from database to find legacy "demo-workspace" slug references
      const LEGACY_SLUG = "demo-workspace";
      const allTopics = await storage.getAllTopics();
      
      // Find topics with the legacy slug (these need to be fixed)
      const legacySlugTopics = allTopics.filter(t => t.workspaceId === LEGACY_SLUG);
      
      // Find topics that belong to user's workspaces
      const userTopics = allTopics.filter(t => 
        userWorkspaces.some(w => w.id === t.workspaceId)
      );

      // Get targets count for user's workspace
      const targetsCount = resolvedWorkspace 
        ? (await storage.getPublishingTargets(resolvedWorkspace.id)).length 
        : 0;

      res.json({
        userId,
        email,
        workspaceId: resolvedWorkspace?.id || null,
        workspaceSlug: resolvedWorkspace?.slug || null,
        targetsCount,
        topicsCount: userTopics.length,
        workspaces: userWorkspaces.map(w => ({
          id: w.id,
          slug: w.slug,
          name: w.name,
        })),
        resolvedWorkspace: resolvedWorkspace ? {
          id: resolvedWorkspace.id,
          slug: resolvedWorkspace.slug,
          name: resolvedWorkspace.name,
          source: "getUserDefaultWorkspace",
        } : null,
        isMember: userWorkspaces.length > 0,
        diagnostics: {
          totalTopicsInDb: allTopics.length,
          userTopicsCount: userTopics.length,
          legacySlugTopicsCount: legacySlugTopics.length,
          legacySlugTopics: legacySlugTopics.map(t => ({
            id: t.id,
            name: t.name,
            workspaceId: t.workspaceId,
          })),
          legacySlug: LEGACY_SLUG,
          actionRequired: legacySlugTopics.length > 0 
            ? "Call POST /api/debug/fix-topics to migrate legacy topics" 
            : null,
        }
      });
    } catch (error: any) {
      console.error("[Debug] Error in context endpoint:", error);
      res.status(500).json({ error: error?.message || "Failed to get debug context" });
    }
  });
  
  // Migrate legacy workspace IDs (admin-only)
  app.post("/api/debug/migrate-legacy-workspace-ids", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Not authenticated" });
      }
      
      // Get user's default workspace to migrate to
      const targetWorkspace = await resolveWorkspace(userId);
      if (!targetWorkspace) {
        return res.status(404).json({ error: "No target workspace found" });
      }
      
      const LEGACY_SLUG = "demo-workspace";
      
      // Find and update topics with legacy slug
      const allTopics = await storage.getAllTopics();
      const legacyTopics = allTopics.filter(t => t.workspaceId === LEGACY_SLUG);
      
      // Find and update publishing targets with legacy slug
      const allTargets = await storage.getAllPublishingTargets();
      const legacyTargets = allTargets.filter(t => t.workspaceId === LEGACY_SLUG);
      
      let topicsUpdated = 0;
      let targetsUpdated = 0;
      
      for (const topic of legacyTopics) {
        await storage.updateTopic(topic.id, { workspaceId: targetWorkspace.id });
        topicsUpdated++;
      }
      
      for (const target of legacyTargets) {
        await storage.updatePublishingTarget(target.id, { workspaceId: targetWorkspace.id });
        targetsUpdated++;
      }
      
      res.json({
        success: true,
        targetWorkspaceId: targetWorkspace.id,
        targetWorkspaceName: targetWorkspace.name,
        legacySlug: LEGACY_SLUG,
        topicsUpdated,
        targetsUpdated,
        message: `Migrated ${topicsUpdated} topics and ${targetsUpdated} targets to workspace ${targetWorkspace.name}`,
      });
    } catch (error: any) {
      console.error("[Debug] Error migrating legacy workspace IDs:", error);
      res.status(500).json({ error: error?.message || "Failed to migrate" });
    }
  });

  // Ensure workspace for existing user (can be called to fix workspace issues)
  app.post("/api/debug/ensure-workspace", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      const email = (req.user as any)?.claims?.email;
      
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Ensure user has a workspace
      const workspace = await authStorage.ensureUserHasWorkspace(userId, email);
      
      res.json({
        success: true,
        workspace: {
          id: workspace.id,
          slug: workspace.slug,
          name: workspace.name,
        },
        message: "Workspace ensured for user",
      });
    } catch (error: any) {
      console.error("[Debug] Error ensuring workspace:", error);
      res.status(500).json({ error: error?.message || "Failed to ensure workspace" });
    }
  });

  // Fix topics with the legacy "demo-workspace" slug (security-safe: only fixes known invalid slug)
  app.post("/api/debug/fix-topics", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      // Get user's default workspace
      const workspace = await resolveWorkspace(userId);
      if (!workspace) {
        return res.status(400).json({ 
          error: "User has no workspace. Call /api/debug/ensure-workspace first." 
        });
      }

      // SECURITY: Only fix topics with the exact legacy "demo-workspace" slug
      // This prevents multi-tenant data corruption
      const LEGACY_SLUG = "demo-workspace";
      const topics = await storage.getAllTopics();
      const legacyTopics = topics.filter(t => t.workspaceId === LEGACY_SLUG);
      const fixed: string[] = [];
      
      for (const topic of legacyTopics) {
        // Update topic to use user's default workspace
        await storage.updateTopic(topic.id, { workspaceId: workspace.id });
        fixed.push(topic.id);
        console.log(`[Debug] Fixed topic ${topic.id} (${topic.name}): ${LEGACY_SLUG} -> ${workspace.id}`);
      }

      res.json({
        success: true,
        fixedCount: fixed.length,
        fixedTopicIds: fixed,
        targetWorkspaceId: workspace.id,
        targetWorkspaceSlug: workspace.slug,
        legacySlug: LEGACY_SLUG,
      });
    } catch (error: any) {
      console.error("[Debug] Error fixing topics:", error);
      res.status(500).json({ error: error?.message || "Failed to fix topics" });
    }
  });

  // GET /api/debug/targets-audit - Audit publishing targets for current user/workspace
  app.get("/api/debug/targets-audit", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const workspace = await resolveWorkspace(userId);
      if (!workspace) {
        return res.status(500).json({ 
          error: "Could not resolve workspace",
          errorCode: "WORKSPACE_RESOLUTION_FAILED"
        });
      }

      // Get targets using tenant-scoped queries (no full-table scan)
      const [targetsCreatedByUser, targetsInActiveWorkspace] = await Promise.all([
        storage.getPublishingTargetsByCreatorId(userId),
        storage.getPublishingTargets(workspace.id),
      ]);
      
      // Identify truly orphan targets: created by user but have null/empty workspaceId
      // Targets assigned to other workspaces are NOT orphans (user may have multiple workspaces)
      const orphanTargets = targetsCreatedByUser.filter(t => 
        !t.workspaceId || t.workspaceId.trim() === ""
      );

      res.json({
        userId,
        activeWorkspaceId: workspace.id,
        activeWorkspaceName: workspace.name,
        summary: {
          totalTargetsCreatedByUser: targetsCreatedByUser.length,
          targetsInActiveWorkspace: targetsInActiveWorkspace.length,
          orphanTargets: orphanTargets.length,
        },
        targetsCreatedByUser: targetsCreatedByUser.map(t => ({
          id: t.id,
          name: t.name,
          type: t.type,
          workspaceId: t.workspaceId,
          createdByUserId: t.createdByUserId,
          isOrphan: !t.workspaceId || t.workspaceId.trim() === "",
        })),
        targetsInActiveWorkspace: targetsInActiveWorkspace.map(t => ({
          id: t.id,
          name: t.name,
          type: t.type,
          workspaceId: t.workspaceId,
          createdByUserId: t.createdByUserId,
        })),
      });
    } catch (error) {
      console.error("[Debug] Error auditing targets:", error);
      res.status(500).json({ error: "Failed to audit targets" });
    }
  });

  // POST /api/debug/adopt-orphan-targets - Move orphan targets to active workspace
  app.post("/api/debug/adopt-orphan-targets", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const workspace = await resolveWorkspace(userId);
      if (!workspace) {
        return res.status(500).json({ 
          error: "Could not resolve workspace",
          errorCode: "WORKSPACE_RESOLUTION_FAILED"
        });
      }

      // Get targets created by this user using scoped query
      const targetsCreatedByUser = await storage.getPublishingTargetsByCreatorId(userId);
      
      // Only consider truly orphan targets: those with null/empty workspaceId
      // Skip targets already assigned to another workspace (user may have multiple workspaces)
      const orphanTargets = targetsCreatedByUser.filter(t => 
        !t.workspaceId || t.workspaceId.trim() === ""
      );

      // Short-circuit if no orphans found
      if (orphanTargets.length === 0) {
        console.log(`[Debug] No orphan targets found for user ${userId}`);
        return res.json({
          success: true,
          adoptedCount: 0,
          adoptedTargetIds: [],
          targetWorkspaceId: workspace.id,
          targetWorkspaceName: workspace.name,
          message: "No orphan targets found to adopt",
        });
      }

      // Update each orphan to belong to the active workspace
      const adopted: string[] = [];
      for (const target of orphanTargets) {
        await storage.updatePublishingTarget(target.id, { workspaceId: workspace.id });
        adopted.push(target.id);
        console.log(`[Debug] Adopted orphan target ${target.id} (${target.name}) into workspace ${workspace.id}`);
      }

      res.json({
        success: true,
        adoptedCount: adopted.length,
        adoptedTargetIds: adopted,
        targetWorkspaceId: workspace.id,
        targetWorkspaceName: workspace.name,
      });
    } catch (error) {
      console.error("[Debug] Error adopting orphan targets:", error);
      res.status(500).json({ error: "Failed to adopt orphan targets" });
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

  // Publishing Targets - auto-resolves workspace from user session (consistent with /api/me/context)
  app.get("/api/publishing-targets", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      // Use resolveWorkspace as the authoritative source (matches /api/me/context logic)
      const workspace = await resolveWorkspace(userId);
      if (!workspace) {
        return res.status(404).json({ 
          error: "No workspace found for user",
          errorCode: "NO_WORKSPACE"
        });
      }
      
      // Override with X-Workspace-Id header if provided AND user is a member
      let workspaceId = workspace.id;
      const headerWorkspaceId = req.headers["x-workspace-id"] as string | undefined;
      if (headerWorkspaceId) {
        const memberships = await storage.getUserWorkspaceMemberships(userId);
        if (memberships.some(m => m.workspaceId === headerWorkspaceId)) {
          workspaceId = headerWorkspaceId;
        }
      }
      
      console.log(`[API] GET /api/publishing-targets - userId: ${userId}, workspaceId: ${workspaceId}`);
      const targets = await storage.getPublishingTargets(workspaceId);
      console.log(`[API] GET /api/publishing-targets - found ${targets.length} targets`);
      res.json(targets);
    } catch (error) {
      console.error("[API] Error fetching publishing targets:", error);
      res.status(500).json({ error: "Failed to fetch publishing targets" });
    }
  });

  app.post("/api/publishing-targets", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = (req.user as any)?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      // Always resolve workspace from user session - never accept from client
      const workspace = await resolveWorkspace(userId);
      if (!workspace) {
        console.error(`[API] POST /api/publishing-targets - FAILED: No workspace for userId=${userId}`);
        return res.status(500).json({ 
          error: "Could not resolve workspace for user",
          errorCode: "WORKSPACE_RESOLUTION_FAILED"
        });
      }
      
      console.log(`[API] POST /api/publishing-targets - userId=${userId}, resolvedWorkspaceId=${workspace.id}`);
      
      // Override any client-provided workspaceId with the resolved one
      const data = insertPublishingTargetSchema.parse({
        ...req.body,
        workspaceId: workspace.id,
      });
      
      // Set createdByUserId to current authenticated user
      (data as any).createdByUserId = userId;
      
      // For wordpress_pull targets, generate a siteId
      if (data.type === "wordpress_pull") {
        const { generateSiteId } = await import("./services/wp-pull-service");
        (data as any).siteId = generateSiteId();
      }
      
      const target = await storage.createPublishingTarget(data);
      console.log(`[API] POST /api/publishing-targets - SUCCESS: created targetId=${target.id}, workspaceId=${target.workspaceId}`);
      res.status(201).json(target);
    } catch (error) {
      console.error("[API] POST /api/publishing-targets - ERROR:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: "Invalid data", 
          errorCode: "VALIDATION_FAILED",
          details: error.errors 
        });
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

  // WordPress Pull Target Management
  app.post("/api/publishing-targets/wordpress-pull", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { createWordPressPullTarget } = await import("./services/wp-pull-service");
      const { workspaceId, name, wpSiteUrl } = req.body;
      
      if (!workspaceId || !name) {
        return res.status(400).json({ 
          ok: false, 
          error: "workspaceId and name are required",
          errorCode: "VALIDATION_FAILED"
        });
      }
      
      // Pass current user ID as creator
      const userId = (req.user as any)?.claims?.sub;
      const { target, rawSecret } = await createWordPressPullTarget(workspaceId, name, wpSiteUrl, userId);
      
      res.status(201).json({
        ok: true,
        target,
        secret: rawSecret,
        message: "Save this secret - it will only be shown once!"
      });
    } catch (error) {
      console.error("[WP Pull Target] Create failed:", error);
      res.status(500).json({ ok: false, error: "Failed to create WordPress Pull target" });
    }
  });

  app.post("/api/publishing-targets/:id/generate-secret", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { generateSecret } = await import("./services/wp-pull-service");
      const target = await storage.getPublishingTarget(req.params.id);
      
      if (!target) {
        return res.status(404).json({ ok: false, error: "Target not found" });
      }
      
      if (target.type !== "wordpress_pull") {
        return res.status(400).json({ ok: false, error: "Only WordPress Pull targets support secrets" });
      }
      
      if (target.secretHash) {
        return res.status(400).json({ 
          ok: false, 
          error: "Secret already exists. Use rotate-secret to replace it.",
          errorCode: "SECRET_EXISTS"
        });
      }
      
      const { raw, hash, last4 } = await generateSecret();
      
      await storage.updatePublishingTarget(req.params.id, {
        secretHash: hash,
        secretLast4: last4,
        secretCreatedAt: new Date(),
      } as any);
      
      res.json({
        ok: true,
        secret: raw,
        last4,
        message: "Save this secret - it will only be shown once!"
      });
    } catch (error) {
      console.error("[WP Pull Target] Generate secret failed:", error);
      res.status(500).json({ ok: false, error: "Failed to generate secret" });
    }
  });

  app.post("/api/publishing-targets/:id/rotate-secret", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { rotateSecret } = await import("./services/wp-pull-service");
      
      const result = await rotateSecret(req.params.id);
      if (!result) {
        return res.status(404).json({ ok: false, error: "Target not found or not a WordPress Pull target" });
      }
      
      res.json({
        ok: true,
        secret: result.rawSecret,
        last4: result.last4,
        message: "Previous secret is now invalid. Save this new secret - it will only be shown once!"
      });
    } catch (error) {
      console.error("[WP Pull Target] Rotate secret failed:", error);
      res.status(500).json({ ok: false, error: "Failed to rotate secret" });
    }
  });

  app.get("/api/publishing-targets/:id/wp-pull-jobs", async (req: Request, res: Response) => {
    try {
      const target = await storage.getPublishingTarget(req.params.id);
      if (!target) {
        return res.status(404).json({ ok: false, error: "Target not found" });
      }
      
      const status = req.query.status as string | undefined;
      const jobs = await storage.getWpPullJobs(req.params.id, status as any);
      
      res.json({ ok: true, jobs });
    } catch (error) {
      res.status(500).json({ ok: false, error: "Failed to fetch jobs" });
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

  // Team Management
  app.get("/api/team", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const workspaceId = req.query.workspaceId as string || "default";
      const members = await storage.getWorkspaceUsers(workspaceId);
      
      // Enrich with user data
      const enrichedMembers = await Promise.all(members.map(async (member) => {
        const user = await authStorage.getUser(member.userId);
        return { ...member, user };
      }));
      
      res.json(enrichedMembers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch team members" });
    }
  });

  app.post("/api/team/invite", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { email, role, workspaceId } = req.body;
      
      if (!email || !role) {
        return res.status(400).json({ error: "Email and role are required" });
      }
      
      // For now, create a placeholder user ID based on email
      // In production, this would send an invite email
      const userId = `invite_${email.replace(/[^a-z0-9]/gi, '_')}`;
      
      const member = await storage.addUserToWorkspace({
        workspaceId: workspaceId || "default",
        userId,
        role,
      });
      
      res.status(201).json({ ...member, email, status: "invited" });
    } catch (error) {
      res.status(500).json({ error: "Failed to invite team member" });
    }
  });

  app.patch("/api/team/:id/role", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { role } = req.body;
      if (!role) {
        return res.status(400).json({ error: "Role is required" });
      }
      
      const member = await storage.updateWorkspaceUserRole(req.params.id, role);
      if (!member) {
        return res.status(404).json({ error: "Member not found" });
      }
      
      res.json(member);
    } catch (error) {
      res.status(500).json({ error: "Failed to update role" });
    }
  });

  app.delete("/api/team/:workspaceId/:userId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      await storage.removeUserFromWorkspace(req.params.workspaceId, req.params.userId);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to remove team member" });
    }
  });

  // Admin endpoints
  app.get("/api/admin/stats", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const assets = await storage.getAssets("demo-workspace");
      const runs = await storage.getWorkflowRuns("demo-workspace");
      const users = await authStorage.getAllUsers();
      
      const successfulRuns = runs.filter(r => r.status === "succeeded").length;
      const failedRuns = runs.filter(r => r.status === "failed").length;
      
      res.json({
        totalUsers: users.length,
        activeUsers: users.length,
        totalAssets: assets.length,
        totalRuns: runs.length,
        successfulRuns,
        failedRuns,
        tokensUsed: 0, // Token tracking not implemented
        storageUsed: 12,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch admin stats" });
    }
  });

  app.get("/api/admin/users", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const users = await authStorage.getAllUsers();
      
      const usersWithStats = await Promise.all(
        users.map(async (user) => {
          const assets = await storage.getAssets("demo-workspace");
          const runs = await storage.getWorkflowRuns("demo-workspace");
          return {
            ...user,
            assetCount: assets.length,
            runCount: runs.length,
            lastActive: user.updatedAt || user.createdAt,
          };
        })
      );
      
      res.json(usersWithStats);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Admin diagnostics - story debug info
  app.get("/api/admin/diagnostics/story/:storyId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { storyId } = req.params;
      
      // Get story
      const story = await storage.getStory(storyId);
      if (!story) {
        return res.status(404).json({ error: "Story not found" });
      }
      
      // Get linked story items (source_item_ids)
      const storyItems = await storage.getStoryItems(storyId);
      const sourceItemIds = storyItems.map(si => si.sourceItemId);
      
      // Get source items with source details
      const linkedSourceItems = await Promise.all(
        storyItems.map(async (si) => {
          const sourceItem = await storage.getSourceItem(si.sourceItemId);
          if (!sourceItem) return null;
          
          const source = await storage.getSource(sourceItem.sourceId);
          let derivedName = source?.name;
          if (!derivedName) {
            try {
              const urlObj = new URL(sourceItem.url);
              derivedName = urlObj.hostname.replace(/^www\./, '');
            } catch {
              derivedName = 'Unknown';
            }
          }
          
          return {
            id: sourceItem.id,
            title: sourceItem.title,
            url: sourceItem.url,
            publishedAt: sourceItem.publishedAt,
            sourceName: derivedName,
            sourceId: sourceItem.sourceId,
            mediaTier: source?.mediaTier || 'tier_3',
            hasImages: !!(sourceItem.metadataJson as any)?.images?.length,
            imageCount: (sourceItem.metadataJson as any)?.images?.length || 0,
          };
        })
      );
      
      // Get image assets
      const imageAssets = await storage.getImageAssets(story.workspaceId, storyId);
      const formattedImageAssets = imageAssets.map(img => ({
        id: img.id,
        originType: img.originType,
        originalUrl: img.originalUrl,
        isPrimary: img.isPrimary,
        sourceTier: img.sourceTier,
        sourceItemId: img.sourceItemId,
        createdAt: img.createdAt,
        metadataJson: img.metadataJson,
      }));
      
      // Get primary image
      const primaryImage = await storage.getPrimaryImageForStory(storyId);
      
      res.json({
        story: {
          id: story.id,
          canonicalTitle: story.canonicalTitle,
          sourceCount: story.sourceCount,
          dateBucket: story.publishedDateBucket,
          createdAt: story.createdAt,
        },
        linkedSourceItems: linkedSourceItems.filter(Boolean),
        imageAssets: formattedImageAssets,
        primaryImageId: primaryImage?.id || null,
        primaryImageUrl: primaryImage?.originalUrl || null,
        summary: {
          totalSources: storyItems.length,
          totalImages: imageAssets.length,
          hasPrimaryImage: !!primaryImage,
        },
      });
    } catch (error: any) {
      console.error("[Admin Diagnostics] Error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch diagnostics" });
    }
  });

  // Admin diagnostics - list all stories with basic info
  app.get("/api/admin/diagnostics/stories", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const stories = await storage.getStories("demo-workspace");
      
      const storiesWithInfo = await Promise.all(
        stories.slice(0, 50).map(async (story) => {
          const imageAssets = await storage.getImageAssets(story.workspaceId, story.id);
          const primaryImage = imageAssets.find(a => a.isPrimary);
          
          return {
            id: story.id,
            canonicalTitle: story.canonicalTitle,
            sourceCount: story.sourceCount,
            dateBucket: story.publishedDateBucket,
            imageCount: imageAssets.length,
            hasPrimaryImage: !!primaryImage,
            primaryImageUrl: primaryImage?.originalUrl || null,
            createdAt: story.createdAt,
          };
        })
      );
      
      res.json(storiesWithInfo);
    } catch (error: any) {
      console.error("[Admin Diagnostics] Error:", error);
      res.status(500).json({ error: error.message || "Failed to fetch stories" });
    }
  });

  // ============ SOURCES API ============
  
  app.get("/api/sources", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const sources = await storage.getSources("demo-workspace");
      res.json(sources);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch sources" });
    }
  });

  app.get("/api/sources/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const source = await storage.getSource(req.params.id);
      if (!source) return res.status(404).json({ error: "Source not found" });
      res.json(source);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch source" });
    }
  });

  app.post("/api/sources", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const data = insertSourceSchema.parse({
        ...req.body,
        workspaceId: "demo-workspace",
      });
      const source = await storage.createSource(data);
      res.status(201).json(source);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Invalid source data" });
    }
  });

  app.patch("/api/sources/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const source = await storage.updateSource(req.params.id, req.body);
      if (!source) return res.status(404).json({ error: "Source not found" });
      res.json(source);
    } catch (error) {
      res.status(500).json({ error: "Failed to update source" });
    }
  });

  app.delete("/api/sources/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      await storage.deleteSource(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete source" });
    }
  });

  app.post("/api/sources/:id/fetch", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const source = await storage.getSource(req.params.id);
      if (!source) return res.status(404).json({ error: "Source not found" });
      
      const result = await fetchRSSSource(source);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch source" });
    }
  });

  app.post("/api/sources/test-feed", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { url } = req.body;
      if (!url) return res.status(400).json({ error: "URL is required" });
      
      const result = await testRSSFeed(url);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to test feed" });
    }
  });

  // ============ SOURCE ITEMS API ============

  app.get("/api/source-items", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const status = req.query.status as SourceItemStatus | undefined;
      const sourceId = req.query.sourceId as string | undefined;
      const items = await storage.getSourceItems("demo-workspace", status, sourceId);
      res.json(items);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch source items" });
    }
  });

  app.get("/api/source-items/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const item = await storage.getSourceItem(req.params.id);
      if (!item) return res.status(404).json({ error: "Source item not found" });
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch source item" });
    }
  });

  app.patch("/api/source-items/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const item = await storage.updateSourceItem(req.params.id, req.body);
      if (!item) return res.status(404).json({ error: "Source item not found" });
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: "Failed to update source item" });
    }
  });

  app.post("/api/source-items/:id/generate", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const item = await storage.getSourceItem(req.params.id);
      if (!item) return res.status(404).json({ error: "Source item not found" });
      
      const workflowType = (req.body.workflowType || "seo_blog") as WorkflowType;
      
      const input = await storage.createInput({
        workspaceId: "demo-workspace",
        type: "url",
        title: item.title,
        sourceUrl: item.url,
        rawText: item.rawContent || item.excerpt || item.title,
        language: "en",
      });
      
      const workflowRun = await storage.createWorkflowRun({
        workspaceId: "demo-workspace",
        inputId: input.id,
        workflowType,
      });
      
      const asset = await storage.createAsset({
        workspaceId: "demo-workspace",
        inputId: input.id,
        status: "draft",
        primaryLanguage: "en",
      });
      
      await storage.updateSourceItem(item.id, { status: "queued" });
      
      processWorkflowWithAI(workflowRun.id, input.id, workflowType, "demo-workspace", null)
        .then(async () => {
          await storage.updateSourceItem(item.id, { status: "processed" });
        })
        .catch(async () => {
          await storage.updateSourceItem(item.id, { status: "new" });
        });
      
      res.json({ 
        success: true, 
        runId: workflowRun.id, 
        assetId: asset.id,
        message: "Content generation started" 
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to generate content" });
    }
  });

  // ============ AUTOMATIONS API ============

  app.get("/api/automations", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const automations = await storage.getAutomations("demo-workspace");
      res.json(automations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch automations" });
    }
  });

  app.get("/api/automations/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const automation = await storage.getAutomation(req.params.id);
      if (!automation) return res.status(404).json({ error: "Automation not found" });
      res.json(automation);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch automation" });
    }
  });

  app.post("/api/automations", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const data = insertAutomationSchema.parse({
        ...req.body,
        workspaceId: "demo-workspace",
      });
      const automation = await storage.createAutomation(data);
      res.status(201).json(automation);
    } catch (error: any) {
      res.status(400).json({ error: error.message || "Invalid automation data" });
    }
  });

  app.patch("/api/automations/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const automation = await storage.updateAutomation(req.params.id, req.body);
      if (!automation) return res.status(404).json({ error: "Automation not found" });
      res.json(automation);
    } catch (error) {
      res.status(500).json({ error: "Failed to update automation" });
    }
  });

  app.delete("/api/automations/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      await storage.deleteAutomation(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete automation" });
    }
  });

  app.post("/api/automations/:id/run", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const automation = await storage.getAutomation(req.params.id);
      if (!automation) return res.status(404).json({ error: "Automation not found" });
      
      const result = await runAutomation(automation);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to run automation" });
    }
  });

  app.get("/api/automations/:id/runs", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const runs = await storage.getAutomationRuns(req.params.id);
      res.json(runs);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch automation runs" });
    }
  });

  app.get("/api/automation-runs/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const run = await storage.getAutomationRun(req.params.id);
      if (!run) return res.status(404).json({ error: "Automation run not found" });
      
      const items = await storage.getAutomationRunItems(run.id);
      res.json({ ...run, items });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch automation run" });
    }
  });

  // ============ WORDPRESS TESTING ============

  app.post("/api/publishing-targets/:id/test", isAuthenticated, async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const target = await storage.getPublishingTarget(req.params.id);
      if (!target) {
        return res.status(404).json({ 
          ok: false, 
          success: false, 
          error: "Target not found",
          errorCode: "TARGET_NOT_FOUND"
        });
      }
      
      console.log(`[WordPress Test] Testing target: ${target.id}, name: ${target.name}`);
      
      if (target.type === "wordpress") {
        const result = await testWordPressConnection(target);
        const latencyMs = Date.now() - startTime;
        
        console.log(`[WordPress Test] Result for ${target.name}: success=${result.success}, errorCode=${result.errorCode || 'none'}, latency=${latencyMs}ms`);
        
        // Return consistent schema with both ok and success fields, including debug payload
        res.json({
          ok: result.success,
          success: result.success,
          siteName: result.siteName,
          error: result.error,
          errorCode: result.errorCode,
          latencyMs,
          debug: result.debug,
        });
      } else {
        res.json({ 
          ok: false, 
          success: false, 
          error: "Only WordPress testing is supported",
          errorCode: "UNSUPPORTED_TYPE"
        });
      }
    } catch (error: any) {
      console.error(`[WordPress Test] Error:`, error.message);
      res.status(500).json({ 
        ok: false, 
        success: false, 
        error: error.message || "Failed to test connection",
        errorCode: "INTERNAL_ERROR"
      });
    }
  });

  app.post("/api/publishing-targets/:id/health-check", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const target = await storage.getPublishingTarget(req.params.id);
      if (!target) return res.status(404).json({ error: "Target not found" });
      
      let status: "ok" | "fail" | "unknown" | "degraded" = "fail";
      let message = "Unknown target type";
      let errorCode: string | undefined;
      let debug: any;
      
      if (target.type === "wordpress") {
        const result = await testWordPressConnection(target);
        errorCode = result.errorCode;
        debug = result.debug;
        
        if (result.success) {
          status = "ok";
          message = `Connected to ${result.siteName || "WordPress"}`;
        } else {
          // Grace period logic: if CAPTCHA error and last successful check was within 30 mins, show degraded
          const isCaptchaError = result.errorCode === "SITEGROUND_CAPTCHA" || result.errorCode === "CLOUDFLARE_BLOCKED";
          const lastHealthOk = target.lastHealthStatus === "ok";
          const lastCheckTime = target.lastHealthCheckAt ? new Date(target.lastHealthCheckAt).getTime() : 0;
          const gracePeriodMs = 30 * 60 * 1000; // 30 minutes
          const withinGracePeriod = (Date.now() - lastCheckTime) < gracePeriodMs;
          
          if (isCaptchaError && lastHealthOk && withinGracePeriod) {
            status = "degraded";
            message = `Intermittent CAPTCHA blocking detected. Last successful connection was ${Math.round((Date.now() - lastCheckTime) / 60000)} min ago.`;
          } else {
            status = "fail";
            message = result.error || "Connection failed";
          }
        }
      } else {
        status = "unknown";
        message = "Health check not supported for this target type";
      }
      
      try {
        // Only update to "fail" if not degraded (preserve degraded status)
        const statusToStore = status === "degraded" ? "fail" : status;
        await storage.updatePublishingTargetHealth(req.params.id, statusToStore as "ok" | "fail" | "unknown", message);
      } catch (storageError) {
        console.error("Failed to update health status in DB:", storageError);
      }
      
      res.json({ status, message, errorCode, debug, checkedAt: new Date().toISOString() });
    } catch (error: any) {
      const errorMessage = error.message || "Health check failed";
      try {
        await storage.updatePublishingTargetHealth(req.params.id, "fail", errorMessage);
      } catch (storageError) {
        console.error("Failed to update health status in DB:", storageError);
      }
      res.status(500).json({ status: "fail", message: errorMessage });
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

  // ==================== CONTENT GOALS & DISCOVERY ====================

  // Content Goals
  app.get("/api/content-goals", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const workspaceId = req.query.workspaceId as string || "demo-workspace";
      const goals = await storage.getContentGoals(workspaceId);
      res.json(goals);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch content goals" });
    }
  });

  app.get("/api/content-goals/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const goal = await storage.getContentGoal(req.params.id);
      if (!goal) {
        return res.status(404).json({ error: "Content goal not found" });
      }
      res.json(goal);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch content goal" });
    }
  });

  app.post("/api/content-goals", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const data = insertContentGoalSchema.parse(req.body);
      const goal = await storage.createContentGoal(data);
      res.status(201).json(goal);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ error: "Invalid content goal data", details: error.errors });
      }
      res.status(500).json({ error: error.message || "Failed to create content goal" });
    }
  });

  app.patch("/api/content-goals/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const goal = await storage.updateContentGoal(req.params.id, req.body);
      if (!goal) {
        return res.status(404).json({ error: "Content goal not found" });
      }
      res.json(goal);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update content goal" });
    }
  });

  app.delete("/api/content-goals/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      await storage.deleteContentGoal(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to delete content goal" });
    }
  });

  // Discovery Jobs
  app.post("/api/discovery/run", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { contentGoalId, workspaceId = "demo-workspace" } = req.body;
      
      if (!contentGoalId) {
        return res.status(400).json({ error: "contentGoalId is required" });
      }

      const goal = await storage.getContentGoal(contentGoalId);
      if (!goal) {
        return res.status(404).json({ error: "Content goal not found" });
      }

      const job = await storage.createDiscoveryJob({
        workspaceId,
        contentGoalId,
        status: "pending",
      });

      runDiscoveryJob(job.id).catch(err => {
        console.error(`[Discovery] Background job failed: ${err.message}`);
      });

      res.status(202).json({ 
        jobId: job.id, 
        status: job.status,
        message: "Discovery job started" 
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to start discovery job" });
    }
  });

  app.get("/api/discovery/:jobId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const job = await storage.getDiscoveryJob(req.params.jobId);
      if (!job) {
        return res.status(404).json({ error: "Discovery job not found" });
      }
      res.json(job);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch discovery job" });
    }
  });

  app.get("/api/discovery/:jobId/results", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const job = await storage.getDiscoveryJob(req.params.jobId);
      if (!job) {
        return res.status(404).json({ error: "Discovery job not found" });
      }

      const sources = await storage.getDiscoveredSources(req.params.jobId);
      
      res.json({
        job,
        sources,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch discovery results" });
    }
  });

  app.get("/api/discovery-jobs", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const workspaceId = req.query.workspaceId as string || "demo-workspace";
      const contentGoalId = req.query.contentGoalId as string | undefined;
      const jobs = await storage.getDiscoveryJobs(workspaceId, contentGoalId);
      res.json(jobs);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch discovery jobs" });
    }
  });

  // ==================== TOPICS ====================
  
  app.get("/api/topics", isAuthenticated, async (req: Request, res: Response) => {
    try {
      // Resolve workspace from authenticated user
      const userId = (req.user as any)?.claims?.sub;
      const workspaceId = req.query.workspaceId as string || await resolveWorkspaceId(userId);
      
      if (!workspaceId) {
        return res.json([]); // No workspace = no topics
      }
      
      const topics = await storage.getTopics(workspaceId);
      
      const topicsWithSources = await Promise.all(
        topics.map(async (topic) => {
          const enabledSourceIds = await storage.getEnabledSourceIdsForTopic(topic.id);
          return {
            ...topic,
            enabledSourceCount: enabledSourceIds.length,
          };
        })
      );
      
      res.json(topicsWithSources);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch topics" });
    }
  });

  app.get("/api/topics/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const topic = await storage.getTopic(req.params.id);
      if (!topic) {
        return res.status(404).json({ error: "Topic not found" });
      }
      res.json(topic);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch topic" });
    }
  });

  app.post("/api/topics", isAuthenticated, async (req: Request, res: Response) => {
    const requestId = crypto.randomUUID();
    
    try {
      // Server-enforced workspaceId - derive from authenticated user's default workspace
      const userId = (req.user as any)?.claims?.sub;
      const serverWorkspaceId = await resolveWorkspaceId(userId);
      
      if (!serverWorkspaceId) {
        console.log(`[topics:create] requestId=${requestId} no workspace found for user=${userId}`);
        return res.status(400).json({
          error: "No workspace found. Please contact support.",
          errorCode: "WORKSPACE_NOT_FOUND"
        });
      }
      console.log(`[topics:create] requestId=${requestId} payloadKeys=${Object.keys(req.body).join(",")}`);
      
      // Normalize region: empty/missing -> "global"
      const rawRegion = req.body.region;
      const normalizedRegion = (typeof rawRegion === "string" && rawRegion.trim()) ? rawRegion.trim() : "global";
      
      // Normalize countries: coerce null/undefined/non-array -> []
      const rawCountries = req.body.countries;
      const normalizedCountries = Array.isArray(rawCountries) ? rawCountries.filter((c: unknown) => typeof c === "string") : [];
      
      // Override any client-provided workspaceId with server-derived value
      const bodyWithServerWorkspace = {
        ...req.body,
        workspaceId: serverWorkspaceId,
        isLive: "false" as const, // Always create inactive - must have sources to activate
        region: normalizedRegion,
        countries: normalizedCountries,
      };
      
      const validation = insertTopicSchema.safeParse(bodyWithServerWorkspace);
      if (!validation.success) {
        const zodError = fromZodError(validation.error);
        console.log(`[topics:create] requestId=${requestId} validationFailed: ${zodError.message}`);
        return res.status(400).json({ 
          error: zodError.message,
          errorCode: "VALIDATION_FAILED",
          errorDetails: validation.error.errors
        });
      }
      
      // Validate publishingTargetId belongs to same workspace (if provided)
      if (validation.data.publishingTargetId) {
        const target = await storage.getPublishingTarget(validation.data.publishingTargetId);
        if (!target) {
          console.log(`[topics:create] requestId=${requestId} publishingTargetId=${validation.data.publishingTargetId} not found`);
          return res.status(400).json({
            error: "Publishing target not found",
            errorCode: "TARGET_NOT_FOUND",
            hint: "The selected publishing target does not exist"
          });
        }
        if (target.workspaceId !== serverWorkspaceId) {
          console.log(`[topics:create] requestId=${requestId} publishingTargetId=${validation.data.publishingTargetId} workspace mismatch: target=${target.workspaceId} vs user=${serverWorkspaceId}`);
          return res.status(400).json({
            error: "Publishing target belongs to different workspace",
            errorCode: "TARGET_WORKSPACE_MISMATCH",
            hint: "You can only use publishing targets from your current workspace"
          });
        }
      }
      
      console.log(`[topics:create] requestId=${requestId} inserting: name=${validation.data.name} region=${validation.data.region} countries=${JSON.stringify(validation.data.countries)}`);
      
      const topic = await storage.createTopic(validation.data);
      console.log(`[topics:create] requestId=${requestId} success: id=${topic.id}`);
      res.status(201).json(topic);
    } catch (error: any) {
      const errorCode = error.code || "DB_INSERT_FAILED";
      console.error(`[topics:create] requestId=${requestId} failed: code=${errorCode} constraint=${error.constraint} message=${error.message}`);
      // Sanitized error response - don't leak internal details
      res.status(500).json({ 
        error: "Failed to create topic",
        errorCode,
        requestId, // Allow correlation with server logs
      });
    }
  });

  app.patch("/api/topics/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const existingTopic = await storage.getTopic(req.params.id);
      if (!existingTopic) {
        return res.status(404).json({ error: "Topic not found" });
      }
      
      const isLiveValue = req.body.isLive;
      const isActivating = isLiveValue === "true" || isLiveValue === true;
      
      if (isActivating) {
        const enabledSources = await storage.getEnabledSourceIdsForTopic(req.params.id);
        if (enabledSources.length === 0) {
          return res.status(400).json({ 
            error: "Cannot activate topic without enabled sources",
            code: "NO_SOURCES_ENABLED"
          });
        }
      }
      
      // Normalize region if provided: empty string -> "global"
      let normalizedRegion = req.body.region;
      if (normalizedRegion !== undefined) {
        normalizedRegion = (typeof normalizedRegion === "string" && normalizedRegion.trim()) ? normalizedRegion.trim() : "global";
      }
      
      // Normalize countries if provided: coerce null/undefined/non-array -> []
      let normalizedCountries = req.body.countries;
      if (normalizedCountries !== undefined) {
        normalizedCountries = Array.isArray(normalizedCountries) ? normalizedCountries.filter((c: unknown) => typeof c === "string") : [];
      }
      
      const updateData = {
        ...req.body,
        isLive: isLiveValue === true ? "true" : isLiveValue === false ? "false" : isLiveValue,
        ...(normalizedRegion !== undefined && { region: normalizedRegion }),
        ...(normalizedCountries !== undefined && { countries: normalizedCountries }),
      };
      
      // Check if publish schedule changed - need to reschedule existing items
      const oldPublishTimes = (existingTopic.publishTimes as string[] | null) || [];
      const newPublishTimes = req.body.publishTimes;
      const oldTimezone = existingTopic.timezone || "UTC";
      const newTimezone = req.body.timezone;
      
      const scheduleChanged = 
        (newPublishTimes !== undefined && JSON.stringify(oldPublishTimes) !== JSON.stringify(newPublishTimes)) ||
        (newTimezone !== undefined && oldTimezone !== newTimezone);
      
      const topic = await storage.updateTopic(req.params.id, updateData);
      
      // If schedule changed, reschedule existing "scheduled" items
      if (scheduleChanged && topic) {
        console.log(`[API] Publish schedule changed for topic ${topic.id}, rescheduling items...`);
        try {
          await storage.resetScheduledItemsToGated(topic.id);
          console.log(`[API] Reset scheduled items to gated for topic ${topic.id}`);
        } catch (err) {
          console.error(`[API] Failed to reschedule items:`, err);
        }
      }
      
      res.json(topic);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update topic" });
    }
  });

  app.delete("/api/topics/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      await storage.deleteTopic(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to delete topic" });
    }
  });

  // Seed official GCC sources
  app.post("/api/sources/seed-official", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { workspaceId = "demo-workspace" } = req.body;
      const { seedOfficialSources } = await import("./seeds/official-sources");
      const result = await seedOfficialSources(workspaceId);
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error("[API] seed-official error:", error);
      res.status(500).json({ error: error.message || "Failed to seed official sources" });
    }
  });

  // Topic Source Recommendations
  app.post("/api/topics/recommend-sources", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { topicQuery, contentType, region, countries, language, workspaceId = "demo-workspace" } = req.body;
      
      if (!region) {
        return res.status(400).json({ error: "region is required" });
      }
      
      const { getSourceRecommendations } = await import("./services/source-recommendation-service");
      
      const result = await getSourceRecommendations({
        topicQuery: topicQuery || "",
        contentType: contentType || "news_monitoring",
        region,
        countries: countries || [],
        language,
        workspaceId,
      });
      
      const { defaultEnabled } = result;
      
      res.json({
        ...result,
        defaultEnabled,
      });
    } catch (error: any) {
      console.error("[API] recommend-sources error:", error);
      res.status(500).json({ error: error.message || "Failed to get source recommendations" });
    }
  });

  // Topic Sources Management - with workspace ownership validation
  const validateTopicAccess = async (topicId: string, res: Response): Promise<boolean> => {
    const topic = await storage.getTopic(topicId);
    if (!topic) {
      res.status(404).json({ error: "Topic not found" });
      return false;
    }
    return true;
  };

  app.get("/api/topics/:topicId/sources", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { topicId } = req.params;
      
      if (!await validateTopicAccess(topicId, res)) return;
      
      const topicSources = await storage.getTopicSources(topicId);
      
      const sourcesWithDetails = await Promise.all(
        topicSources.map(async (ts) => {
          const source = await storage.getSource(ts.sourceId);
          return {
            ...ts,
            source,
          };
        })
      );
      
      res.json(sourcesWithDetails);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch topic sources" });
    }
  });

  app.post("/api/topics/:topicId/sources", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { topicId } = req.params;
      const { sourceSelections } = req.body;
      
      if (!await validateTopicAccess(topicId, res)) return;
      
      if (!Array.isArray(sourceSelections)) {
        return res.status(400).json({ error: "sourceSelections must be an array" });
      }
      
      for (const selection of sourceSelections) {
        if (typeof selection.sourceId !== "string" || typeof selection.isEnabled !== "boolean") {
          return res.status(400).json({ error: "Each selection must have sourceId (string) and isEnabled (boolean)" });
        }
        await storage.upsertTopicSource({
          topicId,
          sourceId: selection.sourceId,
          isEnabled: selection.isEnabled,
        });
      }
      
      const enabledCount = sourceSelections.filter((s: any) => s.isEnabled).length;
      
      res.json({ 
        success: true, 
        savedCount: sourceSelections.length,
        enabledCount,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to save topic sources" });
    }
  });

  app.patch("/api/topics/:topicId/sources/:sourceId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { topicId, sourceId } = req.params;
      const { isEnabled } = req.body;
      
      if (!await validateTopicAccess(topicId, res)) return;
      
      if (typeof isEnabled !== "boolean") {
        return res.status(400).json({ error: "isEnabled must be a boolean" });
      }
      
      await storage.setTopicSourceEnabled(topicId, sourceId, isEnabled);
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update topic source" });
    }
  });

  app.get("/api/topics/:topicId/enabled-source-count", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { topicId } = req.params;
      
      if (!await validateTopicAccess(topicId, res)) return;
      
      const enabledIds = await storage.getEnabledSourceIdsForTopic(topicId);
      res.json({ count: enabledIds.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to get enabled source count" });
    }
  });

  app.get("/api/topics/:topicId/discovery-status", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { topicId } = req.params;
      
      if (!await validateTopicAccess(topicId, res)) return;
      
      const { getTopicDiscoveryStatus } = await import("./services/topic-run-service");
      const status = await getTopicDiscoveryStatus(topicId);
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to get discovery status" });
    }
  });

  app.post("/api/topics/:topicId/run-discovery", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { topicId } = req.params;
      
      if (!await validateTopicAccess(topicId, res)) return;
      
      const topic = await storage.getTopic(topicId);
      if (!topic) {
        return res.status(404).json({ error: "Topic not found" });
      }
      
      console.log(`[ManualDiscovery] User triggered discovery for topic: ${topic.name} (${topic.id})`);
      
      const { runTopicDiscovery } = await import("./services/topic-run-service");
      const log = await runTopicDiscovery(topic);
      
      // Get updated story count from persisted topic_stories
      const topicStories = await storage.getTopicStories(topicId, 0.15);
      
      res.json({
        status: log.status === "completed" ? "ok" : log.status,
        topicId: log.topicId,
        topicName: log.topicName,
        processedStories: log.itemsProcessed || 0,
        matchedStories: topicStories.length,
        threshold: 0.15,
        trigger: "manual",
        timestamp: log.timestamp,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to run discovery" });
    }
  });

  // ==================== DRAFTS ====================
  
  app.get("/api/drafts", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const workspaceId = req.query.workspaceId as string || "demo-workspace";
      const status = req.query.status as string | undefined;
      const topicId = req.query.topicId as string | undefined;
      const drafts = await storage.getDrafts(workspaceId, status as any, topicId);
      res.json(drafts);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch drafts" });
    }
  });

  app.get("/api/drafts/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const draft = await storage.getDraft(req.params.id);
      if (!draft) {
        return res.status(404).json({ error: "Draft not found" });
      }
      res.json(draft);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch draft" });
    }
  });

  app.post("/api/drafts", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const validation = insertDraftSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ error: fromZodError(validation.error).message });
      }
      const draft = await storage.createDraft(validation.data);
      res.status(201).json(draft);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create draft" });
    }
  });

  app.patch("/api/drafts/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const draft = await storage.updateDraft(req.params.id, req.body);
      if (!draft) {
        return res.status(404).json({ error: "Draft not found" });
      }
      res.json(draft);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update draft" });
    }
  });

  app.delete("/api/drafts/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      await storage.deleteDraft(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to delete draft" });
    }
  });

  // ==================== STORIES ====================
  
  // Helper to resolve source name from URL domain
  function getSourceNameFromUrl(url: string): string {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, '');
      const parts = hostname.split('.');
      if (parts.length >= 2) {
        return parts[parts.length - 2].charAt(0).toUpperCase() + parts[parts.length - 2].slice(1);
      }
      return hostname;
    } catch {
      return 'Source';
    }
  }
  
  app.get("/api/stories", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const workspaceId = req.query.workspaceId as string || "demo-workspace";
      const dateBucket = req.query.dateBucket as string | undefined;
      const rawStories = await storage.getStories(workspaceId, dateBucket);
      
      const storiesWithProvenance = await Promise.all(
        rawStories.map(async (story) => {
          const storyItems = await storage.getStoryItems(story.id);
          const sources = await Promise.all(
            storyItems.map(async (item) => {
              const sourceItem = await storage.getSourceItem(item.sourceItemId);
              if (!sourceItem) return null;
              
              const source = await storage.getSource(sourceItem.sourceId);
              const sourceName = source?.name || getSourceNameFromUrl(sourceItem.url);
              const mediaTier = source?.mediaTier || 'tier_3';
              
              const metadata = sourceItem.metadataJson as any;
              return {
                name: sourceName,
                url: sourceItem.url,
                mediaTier,
                isPrimary: item.isPrimary === 'true',
                imageUrl: metadata?.thumbnail || null,
              };
            })
          );
          
          const validSources = sources.filter((s): s is NonNullable<typeof s> => s !== null);
          validSources.sort((a, b) => {
            const tierOrder = { tier_1: 0, tier_2: 1, tier_3: 2 };
            return tierOrder[a.mediaTier as keyof typeof tierOrder] - tierOrder[b.mediaTier as keyof typeof tierOrder];
          });
          
          const primaryImage = await storage.getPrimaryImageForStory(story.id);
          
          return {
            ...story,
            sources: validSources,
            featuredImage: primaryImage || null,
          };
        })
      );
      
      res.json(storiesWithProvenance);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch stories" });
    }
  });

  app.get("/api/topics/:topicId/stories", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { topicId } = req.params;
      const minScore = parseFloat(req.query.minScore as string) || 0.15;
      
      const topic = await storage.getTopic(topicId);
      if (!topic) {
        return res.status(404).json({ error: "Topic not found" });
      }
      
      // Use persisted topic_stories for efficient querying
      const topicStoriesData = await storage.getTopicStories(topicId, minScore);
      
      const storiesWithProvenance = await Promise.all(
        topicStoriesData.map(async ({ story, relevanceScore, matchedTerms, reason }) => {
          const storyItems = await storage.getStoryItems(story.id);
          const sources = await Promise.all(
            storyItems.map(async (item) => {
              const sourceItem = await storage.getSourceItem(item.sourceItemId);
              if (!sourceItem) return null;
              
              const source = await storage.getSource(sourceItem.sourceId);
              const sourceName = source?.name || getSourceNameFromUrl(sourceItem.url);
              const mediaTier = source?.mediaTier || 'tier_3';
              
              const metadata = sourceItem.metadataJson as any;
              return {
                name: sourceName,
                url: sourceItem.url,
                mediaTier,
                isPrimary: item.isPrimary === 'true',
                imageUrl: metadata?.thumbnail || null,
              };
            })
          );
          
          const validSources = sources.filter((s): s is NonNullable<typeof s> => s !== null);
          validSources.sort((a, b) => {
            const tierOrder = { tier_1: 0, tier_2: 1, tier_3: 2 };
            return tierOrder[a.mediaTier as keyof typeof tierOrder] - tierOrder[b.mediaTier as keyof typeof tierOrder];
          });
          
          const primaryImage = await storage.getPrimaryImageForStory(story.id);
          
          return {
            ...story,
            sources: validSources,
            featuredImage: primaryImage || null,
            topicRelevance: {
              score: parseFloat(relevanceScore as unknown as string),
              matchedTerms: matchedTerms?.slice(0, 5) || [],
              reason: reason || '',
            },
          };
        })
      );
      
      console.log(`[TopicStories] Topic "${topic.name}": ${topicStoriesData.length} persisted stories (minScore=${minScore})`);
      
      res.json({
        stories: storiesWithProvenance,
        stats: {
          relevant: topicStoriesData.length,
          minScore,
          source: 'persisted',
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch topic stories" });
    }
  });
  
  app.get("/api/stories/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const story = await storage.getStory(req.params.id);
      if (!story) {
        return res.status(404).json({ error: "Story not found" });
      }
      
      const storyItems = await storage.getStoryItems(req.params.id);
      const sources = await Promise.all(
        storyItems.map(async (item) => {
          const sourceItem = await storage.getSourceItem(item.sourceItemId);
          if (!sourceItem) return null;
          
          const source = await storage.getSource(sourceItem.sourceId);
          const sourceName = source?.name || getSourceNameFromUrl(sourceItem.url);
          const mediaTier = source?.mediaTier || 'tier_3';
          
          const metadata = sourceItem.metadataJson as any;
          return {
            id: item.id,
            name: sourceName,
            url: sourceItem.url,
            mediaTier,
            isPrimary: item.isPrimary === 'true',
            title: sourceItem.title,
            excerpt: sourceItem.excerpt,
            imageUrl: metadata?.thumbnail || null,
            publishedAt: sourceItem.publishedAt,
          };
        })
      );
      
      const validSources = sources.filter((s): s is NonNullable<typeof s> => s !== null);
      validSources.sort((a, b) => {
        const tierOrder = { tier_1: 0, tier_2: 1, tier_3: 2 };
        return tierOrder[a.mediaTier as keyof typeof tierOrder] - tierOrder[b.mediaTier as keyof typeof tierOrder];
      });
      
      const images = await storage.getImageAssets(story.workspaceId, story.id);
      const primaryImage = await storage.getPrimaryImageForStory(story.id);
      
      res.json({ 
        ...story, 
        sources: validSources,
        images,
        featuredImage: primaryImage || null,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch story" });
    }
  });

  // Discovered Sources
  app.post("/api/discovered-sources/:id/convert-to-source", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { workspaceId = "demo-workspace" } = req.body;
      
      const result = await convertDiscoveredSourceToSource(req.params.id, workspaceId);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.json({ 
        success: true, 
        sourceId: result.sourceId,
        message: "Source created successfully" 
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to convert to source" });
    }
  });

  // ==================== IMAGE ASSETS ====================
  
  app.get("/api/image-assets", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const workspaceId = req.query.workspaceId as string || "demo-workspace";
      const storyId = req.query.storyId as string | undefined;
      const sourceItemId = req.query.sourceItemId as string | undefined;
      const assets = await storage.getImageAssets(workspaceId, storyId, sourceItemId);
      res.json(assets);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch image assets" });
    }
  });

  app.get("/api/image-assets/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const asset = await storage.getImageAsset(req.params.id);
      if (!asset) {
        return res.status(404).json({ error: "Image asset not found" });
      }
      res.json(asset);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch image asset" });
    }
  });

  app.post("/api/image-assets", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const parsed = insertImageAssetSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid image asset data", details: parsed.error.flatten() });
      }
      const asset = await storage.createImageAsset(parsed.data);
      res.status(201).json(asset);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create image asset" });
    }
  });

  app.patch("/api/image-assets/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const asset = await storage.updateImageAsset(req.params.id, req.body);
      if (!asset) {
        return res.status(404).json({ error: "Image asset not found" });
      }
      res.json(asset);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to update image asset" });
    }
  });

  app.delete("/api/image-assets/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      await storage.deleteImageAsset(req.params.id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to delete image asset" });
    }
  });

  // Generate image endpoint with premium entitlement check
  app.post("/api/image-assets/generate", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { workspaceId, storyId, prompt, style } = req.body;
      
      if (!workspaceId || !prompt) {
        return res.status(400).json({ error: "workspaceId and prompt are required" });
      }
      
      // Check workspace entitlement
      const workspace = await storage.getWorkspace(workspaceId);
      if (!workspace) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      
      const features = workspace.features as any || {};
      if (!features.generate_images) {
        return res.status(403).json({ 
          error: "Image generation is a premium feature",
          code: "FEATURE_NOT_ENTITLED",
          feature: "generate_images"
        });
      }
      
      // Create placeholder record for generated image
      // In production, this would queue an async job to generate the image
      const imageAsset = await storage.createImageAsset({
        workspaceId,
        storyId: storyId || null,
        originType: "generated",
        generatedPrompt: prompt,
        metadataJson: {
          style: style || "photorealistic",
          status: "pending",
          requestedAt: new Date().toISOString(),
        },
      });
      
      res.status(202).json({
        message: "Image generation queued",
        imageAsset,
        status: "pending",
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to generate image" });
    }
  });

  // Check workspace feature entitlement
  app.get("/api/workspaces/:id/features", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const workspace = await storage.getWorkspace(req.params.id);
      if (!workspace) {
        return res.status(404).json({ error: "Workspace not found" });
      }
      
      const features = workspace.features as any || {};
      res.json({
        generate_images: !!features.generate_images,
        // Add more feature flags as needed
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch workspace features" });
    }
  });

  // ==================== WORKSPACE AUTOMATION KEYS ====================
  
  // Generate or rotate workspace automation key
  app.post("/api/workspaces/:id/automation-key", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { generateAutomationKey } = await import("./replit_integrations/auth");
      const workspaceId = req.params.id;
      const userId = (req.user as any)?.claims?.sub;
      
      // Verify user has admin/owner access to workspace
      const workspaceUser = await storage.getWorkspaceUser(workspaceId, userId);
      if (!workspaceUser || !["owner", "admin"].includes(workspaceUser.role)) {
        return res.status(403).json({ 
          ok: false, 
          error: "Only workspace owners and admins can manage automation keys" 
        });
      }
      
      const workspace = await storage.getWorkspace(workspaceId);
      if (!workspace) {
        return res.status(404).json({ ok: false, error: "Workspace not found" });
      }
      
      const { raw, hash, last4 } = await generateAutomationKey();
      
      await storage.updateWorkspace(workspaceId, {
        automationKeyHash: hash,
        automationKeyLast4: last4,
      } as any);
      
      res.status(201).json({
        ok: true,
        automationKey: raw,
        last4,
        message: "Save this key - it will only be shown once! Use it in the X-ContentSanta-Automation-Key header."
      });
    } catch (error: any) {
      console.error("[Automation Key] Generate failed:", error);
      res.status(500).json({ ok: false, error: "Failed to generate automation key" });
    }
  });
  
  // Delete workspace automation key
  app.delete("/api/workspaces/:id/automation-key", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const workspaceId = req.params.id;
      const userId = (req.user as any)?.claims?.sub;
      
      // Verify user has admin/owner access to workspace
      const workspaceUser = await storage.getWorkspaceUser(workspaceId, userId);
      if (!workspaceUser || !["owner", "admin"].includes(workspaceUser.role)) {
        return res.status(403).json({ 
          ok: false, 
          error: "Only workspace owners and admins can manage automation keys" 
        });
      }
      
      await storage.updateWorkspace(workspaceId, {
        automationKeyHash: null,
        automationKeyLast4: null,
      } as any);
      
      res.json({ ok: true, message: "Automation key deleted" });
    } catch (error: any) {
      console.error("[Automation Key] Delete failed:", error);
      res.status(500).json({ ok: false, error: "Failed to delete automation key" });
    }
  });
  
  // Get workspace automation key status (not the key itself)
  app.get("/api/workspaces/:id/automation-key", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const workspace = await storage.getWorkspace(req.params.id);
      if (!workspace) {
        return res.status(404).json({ ok: false, error: "Workspace not found" });
      }
      
      res.json({
        ok: true,
        hasKey: !!(workspace as any).automationKeyHash,
        last4: (workspace as any).automationKeyLast4 || null,
      });
    } catch (error: any) {
      res.status(500).json({ ok: false, error: "Failed to fetch automation key status" });
    }
  });

  // ==================== PUBLISHING TEST ====================
  
  // Note: /api/publishing-targets/:id/test is defined earlier in the routes

  app.post("/api/publishing-targets/:id/test-post", isAuthenticated, async (req: Request, res: Response) => {
    const startTime = Date.now();
    try {
      const target = await storage.getPublishingTarget(req.params.id);
      if (!target) {
        return res.status(404).json({ 
          ok: false, 
          success: false, 
          error: "Publishing target not found",
          errorCode: "TARGET_NOT_FOUND"
        });
      }
      
      if (target.type !== "wordpress") {
        return res.status(400).json({ 
          ok: false, 
          success: false, 
          error: "Only WordPress connections can be tested",
          errorCode: "UNSUPPORTED_TYPE"
        });
      }
      
      console.log(`[WordPress Test Post] Creating test draft for target: ${target.id}, name: ${target.name}`);
      
      // Create a mock AssetVersion for test publishing
      const testVersion = {
        id: "test-version",
        assetId: "test-asset",
        title: `ContentSanta Test Post - ${new Date().toISOString()}`,
        body: "<p>This is a test post created by ContentSanta to verify your WordPress connection.</p><p>You can safely delete this post.</p>",
        format: "html" as const,
        versionNo: 1,
        language: "en",
        channel: null,
        workflowType: null,
        metadataJson: null,
        createdAt: new Date(),
        runId: null,
        createdBy: null,
      };
      
      const result = await publishToWordPress(target, testVersion, { status: "draft" });
      const latencyMs = Date.now() - startTime;
      
      console.log(`[WordPress Test Post] Result for ${target.name}: success=${result.success}, postId=${result.postId}, latency=${latencyMs}ms`);
      
      // Return consistent schema with both ok and success fields
      res.json({
        ok: result.success,
        success: result.success,
        message: result.success ? "Test draft created successfully" : result.error,
        postId: result.postId,
        postUrl: result.postUrl,
        error: result.error,
        latencyMs,
      });
    } catch (error: any) {
      console.error(`[WordPress Test Post] Error:`, error.message);
      res.status(500).json({ 
        ok: false,
        success: false,
        error: error.message || "Failed to create test post",
        errorCode: "INTERNAL_ERROR"
      });
    }
  });

  // ==================== WORDPRESS TAXONOMY SYNC ====================
  
  // Sync WordPress categories
  app.post("/api/publishing-targets/:id/sync-categories", isAuthenticated, async (req: Request, res: Response) => {
    try {
      console.log(`[Sync Categories] Fetching target: ${req.params.id}`);
      const target = await storage.getPublishingTarget(req.params.id);
      if (!target) {
        console.log(`[Sync Categories] Target not found: ${req.params.id}`);
        return res.status(404).json({ error: "Publishing target not found" });
      }
      
      console.log(`[Sync Categories] Target found: ${target.name}, type: ${target.type}, config keys: ${Object.keys(target.configJson || {}).join(', ')}`);
      
      if (target.type !== "wordpress") {
        return res.status(400).json({ error: "Only WordPress connections support taxonomy sync" });
      }
      
      const result = await fetchWordPressCategories(target);
      console.log(`[Sync Categories] WordPress result:`, result.success ? `${result.categories?.length} categories` : result.error);
      
      if (!result.success || !result.categories) {
        return res.status(400).json({ error: result.error || "Failed to fetch categories" });
      }
      
      // Clear and re-populate cache
      await storage.clearWpTaxonomyCache(target.id, "category");
      
      for (const cat of result.categories) {
        await storage.upsertWpTaxonomyCache({
          workspaceId: target.workspaceId,
          publishingTargetId: target.id,
          taxonomyType: "category",
          wpId: cat.id,
          name: cat.name,
          slug: cat.slug,
          parentWpId: cat.parent || null,
          count: cat.count,
        });
      }
      
      res.json({ success: true, count: result.categories.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to sync categories" });
    }
  });

  // Sync WordPress tags
  app.post("/api/publishing-targets/:id/sync-tags", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const target = await storage.getPublishingTarget(req.params.id);
      if (!target) {
        return res.status(404).json({ error: "Publishing target not found" });
      }
      
      if (target.type !== "wordpress") {
        return res.status(400).json({ error: "Only WordPress connections support taxonomy sync" });
      }
      
      const result = await fetchWordPressTags(target);
      if (!result.success || !result.tags) {
        return res.status(400).json({ error: result.error || "Failed to fetch tags" });
      }
      
      // Clear and re-populate cache
      await storage.clearWpTaxonomyCache(target.id, "tag");
      
      for (const tag of result.tags) {
        await storage.upsertWpTaxonomyCache({
          workspaceId: target.workspaceId,
          publishingTargetId: target.id,
          taxonomyType: "tag",
          wpId: tag.id,
          name: tag.name,
          slug: tag.slug,
          parentWpId: null,
          count: tag.count,
        });
      }
      
      res.json({ success: true, count: result.tags.length });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to sync tags" });
    }
  });

  // Get cached taxonomy for a target
  app.get("/api/publishing-targets/:id/taxonomy", async (req: Request, res: Response) => {
    try {
      const targetId = req.params.id;
      const taxonomyType = req.query.type as "category" | "tag" | undefined;
      
      const cache = await storage.getWpTaxonomyCache(targetId, taxonomyType);
      const syncStatus = await storage.getWpTaxonomySyncStatus(targetId);
      
      res.json({ 
        items: cache,
        lastSync: {
          categories: syncStatus.categories,
          tags: syncStatus.tags,
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to get taxonomy" });
    }
  });

  // Create a new tag in WordPress
  app.post("/api/publishing-targets/:id/tags", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const target = await storage.getPublishingTarget(req.params.id);
      if (!target) {
        return res.status(404).json({ error: "Publishing target not found" });
      }
      
      if (target.type !== "wordpress") {
        return res.status(400).json({ error: "Only WordPress connections support tag creation" });
      }
      
      const { name } = req.body;
      if (!name || typeof name !== "string") {
        return res.status(400).json({ error: "Tag name is required" });
      }
      
      const result = await createWordPressTag(target, name);
      if (!result.success || !result.tag) {
        return res.status(400).json({ error: result.error || "Failed to create tag" });
      }
      
      // Add to cache
      await storage.upsertWpTaxonomyCache({
        workspaceId: target.workspaceId,
        publishingTargetId: target.id,
        taxonomyType: "tag",
        wpId: result.tag.id,
        name: result.tag.name,
        slug: result.tag.slug,
        parentWpId: null,
        count: result.tag.count,
      });
      
      res.json({ success: true, tag: result.tag });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to create tag" });
    }
  });

  // ==================== TEST MOCK ROUTES ====================
  // These routes simulate various RSS feed failure modes for testing
  
  // Mock 403 Forbidden
  app.get("/__test/rss/403", (req: Request, res: Response) => {
    res.status(403).send("Forbidden");
  });

  // Mock 429 Rate Limited
  app.get("/__test/rss/429", (req: Request, res: Response) => {
    res.status(429).set("Retry-After", "60").send("Too Many Requests");
  });

  // Mock 500 Server Error
  app.get("/__test/rss/500", (req: Request, res: Response) => {
    res.status(500).send("Internal Server Error");
  });

  // Mock Timeout (30 second delay)
  app.get("/__test/rss/timeout", (req: Request, res: Response) => {
    // Don't respond - let it timeout
    setTimeout(() => {
      res.status(200).send("Too late");
    }, 120000);
  });

  // Mock Malformed XML (truncated)
  app.get("/__test/rss/malformed", (req: Request, res: Response) => {
    res.status(200)
      .set("Content-Type", "application/xml")
      .send(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <item>
      <title>Test Item</title>
      <link>https://example.com/item1</link>
      <!-- TRUNCATED - no closing tags -->`);
  });

  // =====================
  // Pipeline Automation API
  // =====================
  
  // Create pipeline auth middleware that accepts both user session and automation key
  const pipelineAuthMiddleware = createAutomationAuthMiddleware(async (req: Request) => {
    try {
      const topicId = req.params.topicId;
      if (!topicId) return null;
      
      const topic = await storage.getTopic(topicId);
      if (!topic) return null;
      
      const workspace = await storage.getWorkspace(topic.workspaceId);
      if (!workspace) return null;
      
      return {
        id: workspace.id,
        automationKeyHash: (workspace as any).automationKeyHash || null,
      };
    } catch (error) {
      console.error("[Pipeline Auth] Error resolving workspace:", error);
      return null;
    }
  });
  
  app.get("/api/topics/:topicId/pipeline-items", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { topicId } = req.params;
      const status = req.query.status as string | undefined;
      
      const items = await storage.getPipelineItems(topicId);
      
      const filteredItems = status 
        ? items.filter(item => item.status === status)
        : items;
      
      const itemsWithStories = await Promise.all(
        filteredItems.map(async (item) => {
          const story = await storage.getStory(item.storyId);
          return {
            ...item,
            story: story ? {
              id: story.id,
              canonicalTitle: story.canonicalTitle,
              excerpt: story.excerpt,
            } : null,
          };
        })
      );
      
      res.json(itemsWithStories);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch pipeline items" });
    }
  });
  
  app.post("/api/topics/:topicId/run-pipeline", pipelineAuthMiddleware, async (req: Request, res: Response) => {
    try {
      const { topicId } = req.params;
      const isAutomationAuth = !!(req as any).automationAuth;
      console.log(`[Pipeline] Run pipeline request for topic: ${topicId}, auth: ${isAutomationAuth ? "automation-key" : "user-session"}`);
      
      const topic = await storage.getTopic(topicId);
      if (!topic) {
        console.log(`[Pipeline] Topic not found: ${topicId}`);
        return res.status(404).json({ error: "Topic not found" });
      }
      
      console.log(`[Pipeline] Starting pipeline for topic: ${topic.name} (${topicId})`);
      const { runFullPipelineForTopic } = await import("./services/pipeline-jobs-service");
      const result = await runFullPipelineForTopic(topic);
      
      console.log(`[Pipeline] Completed pipeline for topic: ${topic.name}`);
      res.json({
        success: true,
        topicId: result.topicId,
        topicName: result.topicName,
        results: result.results,
      });
    } catch (error: any) {
      console.error(`[Pipeline] Error running pipeline:`, error?.stack || error);
      
      // Handle validation errors with 400 instead of 500
      const errorMessage = error?.message || "Failed to run pipeline";
      if (errorMessage.includes("WORKSPACE_NOT_FOUND") || errorMessage.includes("TOPIC_NOT_FOUND")) {
        return res.status(400).json({ 
          error: errorMessage,
          errorCode: "VALIDATION_ERROR",
          debug: {
            topicId: req.params.topicId,
            hint: "Workspace or topic does not exist in database"
          }
        });
      }
      
      res.status(500).json({ 
        error: errorMessage,
        errorCode: "PIPELINE_ERROR"
      });
    }
  });
  
  app.post("/api/pipeline-items/:itemId/retry", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { itemId } = req.params;
      
      const item = await storage.getPipelineItem(itemId);
      if (!item) {
        return res.status(404).json({ error: "Pipeline item not found" });
      }
      
      if (item.status !== "quarantined" && item.status !== "retrying") {
        return res.status(400).json({ error: "Item is not in a retryable state" });
      }
      
      const errorCode = item.lastErrorCode || "";
      let newStatus: string;
      
      if (errorCode.includes("GENERATION") || errorCode === "CONTENT_TOO_SHORT") {
        newStatus = "ranked";
      } else if (errorCode.includes("PUBLISH") || errorCode === "MAX_RETRIES") {
        newStatus = "scheduled";
      } else if (errorCode.includes("VERIFY")) {
        newStatus = "published";
      } else {
        newStatus = "ranked";
      }
      
      await storage.updatePipelineItem(itemId, {
        status: newStatus as any,
        retryCount: 0,
        lastErrorCode: null,
        lastErrorMessage: null,
      });
      
      res.json({ success: true, newStatus });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to retry item" });
    }
  });
  
  // Publish a scheduled item immediately
  app.post("/api/pipeline-items/:itemId/publish-now", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { itemId } = req.params;
      
      const item = await storage.getPipelineItem(itemId);
      if (!item) {
        return res.status(404).json({ error: "Pipeline item not found" });
      }
      
      if (item.status !== "scheduled") {
        return res.status(400).json({ error: "Item must be in scheduled status to publish" });
      }
      
      // Update scheduled time to now so the next publish job picks it up immediately
      await storage.updatePipelineItem(item.id, {
        scheduledFor: new Date(),
      });
      
      // Trigger the publish job for this topic
      const topic = await storage.getTopic(item.topicId);
      if (topic) {
        const { runPublishJob, runVerifyJob } = await import("./services/pipeline-jobs-service");
        await runPublishJob(topic);
        await runVerifyJob(topic);
      }
      
      // Fetch updated item
      const updatedItem = await storage.getPipelineItem(itemId);
      
      res.json({ 
        success: true, 
        status: updatedItem?.status,
        message: updatedItem?.status === "published" ? "Published successfully!" : "Publishing in progress..."
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to publish item" });
    }
  });
  
  app.get("/api/topics/:topicId/job-runs", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { topicId } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;
      
      const runs = await storage.getAutomationJobRuns(topicId);
      
      res.json(runs.slice(0, limit));
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch job runs" });
    }
  });
  
  app.get("/api/topics/:topicId/automation-activity", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { topicId } = req.params;
      
      const topic = await storage.getTopic(topicId);
      if (!topic) {
        return res.status(404).json({ error: "Topic not found" });
      }
      
      const jobRuns = await storage.getAutomationJobRuns(topicId);
      const recentRuns = jobRuns.slice(0, 100);
      
      const lastRun = recentRuns.length > 0 ? recentRuns[0] : null;
      
      const generateRuns = recentRuns.filter(r => r.jobType === "generate" && r.status === "success");
      const totalGenerated = generateRuns.reduce((sum, r) => sum + (r.successCount || 0), 0);
      
      const publishRuns = recentRuns.filter(r => r.jobType === "publish" && r.status === "success");
      const totalPublished = publishRuns.reduce((sum, r) => sum + (r.successCount || 0), 0);
      
      const gateRuns = recentRuns.filter(r => r.jobType === "gate" && r.status === "success");
      const totalQuarantined = gateRuns.reduce((sum, r) => sum + (r.quarantinedCount || 0), 0);
      
      const drafts = await storage.getDrafts(topic.workspaceId, undefined, topicId);
      const pipelineDrafts = drafts.filter(d => d.pipelineItemId !== null);
      const pendingDrafts = pipelineDrafts.filter(d => d.status === "pending");
      const approvedDrafts = pipelineDrafts.filter(d => d.status === "approved");
      const publishedDrafts = pipelineDrafts.filter(d => d.status === "published");
      
      const pipelineItems = await storage.getPipelineItems(topicId);
      const currentQuarantined = pipelineItems.filter(i => i.status === "quarantined").length;
      const awaitingGate = pipelineItems.filter(i => i.status === "gated").length;
      const awaitingSchedule = pipelineItems.filter(i => i.status === "scheduled").length;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayPublishRuns = publishRuns.filter(r => r.startedAt && new Date(r.startedAt) >= today);
      const todayPublished = todayPublishRuns.reduce((sum, r) => sum + (r.successCount || 0), 0);
      
      res.json({
        automationMode: topic.automationMode,
        lastRunAt: lastRun?.startedAt || null,
        lastRunStatus: lastRun?.status || null,
        stats: {
          totalGenerated,
          totalPublished,
          totalQuarantined,
          draftsCreated: pipelineDrafts.length,
          draftsPendingReview: pendingDrafts.length,
          draftsApproved: approvedDrafts.length,
          draftsPublished: publishedDrafts.length,
          currentQuarantined,
          awaitingGate,
          awaitingSchedule,
          todayPublished,
        },
        recentRuns: recentRuns.slice(0, 10).map(r => ({
          id: r.id,
          jobType: r.jobType,
          status: r.status,
          startedAt: r.startedAt,
          endedAt: r.endedAt,
          processed: r.processedCount,
          success: r.successCount,
          failed: r.failCount,
          quarantined: r.quarantinedCount,
        })),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch automation activity" });
    }
  });
  
  app.get("/api/pipeline-items/:itemId/publish-attempts", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { itemId } = req.params;
      
      const attempts = await storage.getPublishAttempts(itemId);
      
      res.json(attempts);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch publish attempts" });
    }
  });
  
  app.get("/api/quarantine", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const workspaceId = req.query.workspaceId as string;
      
      if (!workspaceId) {
        return res.status(400).json({ error: "workspaceId is required" });
      }
      
      const topics = await storage.getTopics(workspaceId);
      const quarantinedItems = [];
      
      for (const topic of topics) {
        const items = await storage.getPipelineItems(topic.id);
        const quarantined = items.filter(item => item.status === "quarantined");
        
        for (const item of quarantined) {
          const story = await storage.getStory(item.storyId);
          quarantinedItems.push({
            ...item,
            topicName: topic.name,
            story: story ? {
              id: story.id,
              canonicalTitle: story.canonicalTitle,
              excerpt: story.excerpt,
            } : null,
          });
        }
      }
      
      res.json(quarantinedItems);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch quarantined items" });
    }
  });
  
  app.post("/api/trigger-pipelines", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { triggerPipelineAutomation } = await import("./services/scheduler");
      const results = await triggerPipelineAutomation();
      
      res.json({
        success: true,
        pipelinesProcessed: results.length,
        results: results.map(r => ({
          topicId: r.topicId,
          topicName: r.topicName,
          published: r.results.publish?.success || 0,
          quarantined: r.results.publish?.quarantined || 0,
        })),
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to trigger pipelines" });
    }
  });
  
  app.get("/api/analytics/pipeline", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const workspaceId = req.query.workspaceId as string;
      
      if (!workspaceId) {
        return res.status(400).json({ error: "workspaceId is required" });
      }
      
      const analytics = await storage.getPipelineAnalytics(workspaceId);
      res.json(analytics);
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to fetch pipeline analytics" });
    }
  });

  // Mock Valid RSS (for comparison)
  app.get("/__test/rss/valid", (req: Request, res: Response) => {
    res.status(200)
      .set("Content-Type", "application/xml")
      .send(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Test Feed</title>
    <link>https://example.com</link>
    <description>A test feed</description>
    <item>
      <title>Test Item 1</title>
      <link>https://example.com/item1</link>
      <guid>test-guid-1</guid>
      <pubDate>Fri, 27 Dec 2025 10:00:00 GMT</pubDate>
    </item>
    <item>
      <title>Test Item 2</title>
      <link>https://example.com/item2</link>
      <guid>test-guid-2</guid>
      <pubDate>Fri, 27 Dec 2025 09:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`);
  });

  // Start background scheduler for automated pipeline runs
  startScheduler();

  return httpServer;
}

/**
 * WordPress Pull Model API Endpoints
 * Add these to server/routes.ts
 */

// GET /api/wp/pull?siteId=xxx
// Returns next pending wp_pull_job for the site
app.get("/api/wp/pull", async (req: Request, res: Response) => {
  try {
    const { siteId } = req.query;
    const secret = req.headers['x-contentsanta-secret'];
    
    if (!siteId || !secret) {
      return res.status(400).json({ error: "Missing siteId or secret" });
    }

    // Verify secret matches site
    const site = await db.query.sites.findFirst({
      where: eq(sites.id, siteId as string)
    });

    if (!site || site.wpPullSecret !== secret) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Get next queued job
    const job = await db.query.wpPullJobs.findFirst({
      where: and(
        eq(wpPullJobs.siteId, siteId as string),
        eq(wpPullJobs.status, "queued")
      ),
      orderBy: asc(wpPullJobs.createdAt)
    });

    if (!job) {
      // No jobs available
      return res.status(204).send();
    }

    // Mark as leased (being processed)
    await db
      .update(wpPullJobs)
      .set({ 
        status: "leased",
        leasedAt: new Date()
      })
      .where(eq(wpPullJobs.id, job.id));

    // Return job payload
    return res.json({
      jobId: job.id,
      title: job.title,
      contentHtml: job.contentHtml,
      status: job.postStatus, // 'draft' or 'publish'
      categories: job.categories || [],
      tags: job.tags || [],
      excerpt: job.excerpt,
      slug: job.slug,
      featuredImageUrl: job.featuredImageUrl
    });

  } catch (error) {
    console.error("[API] WP Pull error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/wp/report
// Receives result of job processing from WordPress
app.post("/api/wp/report", async (req: Request, res: Response) => {
  try {
    const secret = req.headers['x-contentsanta-secret'];
    const { jobId, ok, wpPostId, wpUrl, error } = req.body;

    if (!jobId) {
      return res.status(400).json({ error: "Missing jobId" });
    }

    // Get job to verify secret
    const job = await db.query.wpPullJobs.findFirst({
      where: eq(wpPullJobs.id, jobId),
      with: { site: true }
    });

    if (!job || job.site.wpPullSecret !== secret) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    // Update job with result
    if (ok) {
      await db
        .update(wpPullJobs)
        .set({
          status: "completed",
          completedAt: new Date(),
          wpPostId: wpPostId ? String(wpPostId) : null,
          wpUrl: wpUrl || null
        })
        .where(eq(wpPullJobs.id, jobId));

      // Mark pipeline item as published
      if (job.pipelineItemId) {
        await db
          .update(pipelineItems)
          .set({ 
            status: "published",
            publishedAt: new Date()
          })
          .where(eq(pipelineItems.id, job.pipelineItemId));
      }

    } else {
      // Job failed
      await db
        .update(wpPullJobs)
        .set({
          status: "failed",
          errorMessage: error || "Unknown error",
          failedAt: new Date()
        })
        .where(eq(wpPullJobs.id, jobId));
    }

    return res.json({ success: true });

  } catch (error) {
    console.error("[API] WP Report error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

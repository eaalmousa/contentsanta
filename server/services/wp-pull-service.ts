import bcrypt from "bcryptjs";
import crypto from "crypto";
import { storage } from "../storage";
import type { PublishingTarget, WpPullJob } from "@shared/schema";

const SALT_ROUNDS = 10;
const SECRET_LENGTH = 32;
const LEASE_MINUTES = 5;

export function generateSiteId(): string {
  const randomPart = crypto.randomBytes(8).toString("hex").toUpperCase();
  return `cs_site_${randomPart}`;
}

export async function generateSecret(): Promise<{ raw: string; hash: string; last4: string }> {
  const raw = `cs_sec_${crypto.randomBytes(SECRET_LENGTH).toString("base64url")}`;
  const hash = await bcrypt.hash(raw, SALT_ROUNDS);
  const last4 = raw.slice(-4);
  return { raw, hash, last4 };
}

export async function verifySecret(rawSecret: string, secretHash: string): Promise<boolean> {
  return await bcrypt.compare(rawSecret, secretHash);
}

export interface AuthResult {
  ok: boolean;
  target?: PublishingTarget;
  error?: string;
  errorCode?: "MISSING_SITE_ID" | "MISSING_SECRET" | "INVALID_SITE_ID" | "INVALID_SECRET" | "TARGET_INACTIVE";
}

export async function authenticateWpPullRequest(
  siteId: string | undefined,
  secret: string | undefined
): Promise<AuthResult> {
  if (!siteId) {
    return { ok: false, error: "Missing siteId query parameter", errorCode: "MISSING_SITE_ID" };
  }
  
  if (!secret) {
    return { ok: false, error: "Missing X-ContentSanta-Secret header", errorCode: "MISSING_SECRET" };
  }
  
  const target = await storage.getPublishingTargetBySiteId(siteId);
  if (!target) {
    return { ok: false, error: "Invalid siteId", errorCode: "INVALID_SITE_ID" };
  }
  
  if (!target.isActive) {
    return { ok: false, error: "Publishing target is inactive", errorCode: "TARGET_INACTIVE" };
  }
  
  if (!target.secretHash) {
    return { ok: false, error: "No secret configured for this target", errorCode: "INVALID_SECRET" };
  }
  
  const isValid = await verifySecret(secret, target.secretHash);
  if (!isValid) {
    return { ok: false, error: "Invalid secret", errorCode: "INVALID_SECRET" };
  }
  
  return { ok: true, target };
}

export interface PullJobPayload {
  jobId: string;
  leaseToken: string;
  title: string;
  contentHtml: string;
  status: string;
  categories: string[];
  tags: string[];
  excerpt?: string;
  slug?: string;
  sourceUrl?: string;
  featuredImageUrl?: string;
  meta: Record<string, unknown>;
}

export async function pullNextJob(siteId: string): Promise<{ job: PullJobPayload | null; error?: string }> {
  const leaseToken = crypto.randomBytes(16).toString("hex");
  
  const job = await storage.leaseNextWpPullJob(siteId, leaseToken, LEASE_MINUTES);
  
  if (!job) {
    return { job: null };
  }
  
  await storage.updatePublishingTargetBySiteId(siteId, {
    lastPullAt: new Date(),
    lastErrorCode: null,
    lastErrorMessage: null,
  });
  
  const payload: PullJobPayload = {
    jobId: job.id,
    leaseToken,
    title: job.title,
    contentHtml: job.contentHtml,
    status: job.postStatus || "publish",
    categories: job.categories || [],
    tags: job.tags || [],
    excerpt: job.excerpt || undefined,
    slug: job.slug || undefined,
    sourceUrl: job.sourceUrl || undefined,
    featuredImageUrl: job.featuredImageUrl || undefined,
    meta: (job.metadataJson as Record<string, unknown>) || {},
  };
  
  return { job: payload };
}

export interface ReportRequest {
  siteId: string;
  jobId: string;
  leaseToken: string;
  ok: boolean;
  wpPostId?: number;
  wpUrl?: string;
  error?: string;
}

export interface ReportResult {
  ok: boolean;
  error?: string;
  errorCode?: "MISSING_FIELDS" | "JOB_NOT_FOUND" | "LEASE_MISMATCH" | "DB_ERROR";
}

export async function reportJobResult(data: ReportRequest): Promise<ReportResult> {
  const { siteId, jobId, leaseToken, ok, wpPostId, wpUrl, error } = data;
  
  if (!siteId || !jobId || !leaseToken) {
    return { ok: false, error: "Missing required fields", errorCode: "MISSING_FIELDS" };
  }
  
  const job = await storage.getWpPullJob(jobId);
  if (!job) {
    return { ok: false, error: "Job not found", errorCode: "JOB_NOT_FOUND" };
  }
  
  if (job.siteId !== siteId) {
    return { ok: false, error: "Job belongs to different site", errorCode: "JOB_NOT_FOUND" };
  }
  
  if (job.leaseToken !== leaseToken) {
    return { ok: false, error: "Lease token mismatch - job may have been re-queued", errorCode: "LEASE_MISMATCH" };
  }
  
  const now = new Date();
  
  if (ok) {
    await storage.updateWpPullJob(jobId, {
      status: "published",
      resultWpPostId: wpPostId,
      resultWpUrl: wpUrl,
      leaseToken: null,
      leaseExpiresAt: null,
    });
    
    await storage.updatePublishingTargetBySiteId(siteId, {
      lastReportAt: now,
      lastHealthStatus: "ok",
      lastHealthCheckAt: now,
      lastErrorCode: null,
      lastErrorMessage: null,
    });
  } else {
    const attempts = (job.attempts || 0) + 1;
    const maxAttempts = 5;
    
    if (attempts >= maxAttempts) {
      await storage.updateWpPullJob(jobId, {
        status: "failed",
        error: error || "Max attempts reached",
        attempts,
        lastAttemptAt: now,
        leaseToken: null,
        leaseExpiresAt: null,
      });
    } else {
      await storage.updateWpPullJob(jobId, {
        status: "queued",
        error: error || "Publishing failed",
        attempts,
        lastAttemptAt: now,
        leaseToken: null,
        leaseExpiresAt: null,
      });
    }
    
    await storage.updatePublishingTargetBySiteId(siteId, {
      lastReportAt: now,
      lastErrorCode: "PUBLISH_FAILED",
      lastErrorMessage: error || "Publishing failed",
    });
  }
  
  return { ok: true };
}

export interface StatusResult {
  siteId: string;
  name: string;
  status: "ok" | "fail" | "unknown";
  lastPullAt: Date | null;
  lastReportAt: Date | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  queuedJobs: number;
  leasedJobs: number;
  publishedJobs: number;
  failedJobs: number;
}

export async function getStatus(siteId: string): Promise<StatusResult | null> {
  const target = await storage.getPublishingTargetBySiteId(siteId);
  if (!target) return null;
  
  const allJobs = await storage.getWpPullJobs(target.id);
  
  const queuedJobs = allJobs.filter(j => j.status === "queued").length;
  const leasedJobs = allJobs.filter(j => j.status === "leased").length;
  const publishedJobs = allJobs.filter(j => j.status === "published").length;
  const failedJobs = allJobs.filter(j => j.status === "failed").length;
  
  return {
    siteId: target.siteId || "",
    name: target.name,
    status: target.lastHealthStatus as "ok" | "fail" | "unknown",
    lastPullAt: target.lastPullAt,
    lastReportAt: target.lastReportAt,
    lastErrorCode: target.lastErrorCode,
    lastErrorMessage: target.lastErrorMessage,
    queuedJobs,
    leasedJobs,
    publishedJobs,
    failedJobs,
  };
}

export async function createWordPressPullTarget(
  workspaceId: string,
  name: string,
  wpSiteUrl?: string
): Promise<{ target: PublishingTarget; rawSecret: string }> {
  const siteId = generateSiteId();
  const { raw, hash, last4 } = await generateSecret();
  
  const target = await storage.createPublishingTarget({
    workspaceId,
    type: "wordpress_pull",
    name,
    siteId,
    wpSiteUrl: wpSiteUrl || null,
    isActive: true,
  });
  
  const updatedTarget = await storage.updatePublishingTarget(target.id, {
    secretHash: hash,
    secretLast4: last4,
    secretCreatedAt: new Date(),
  } as any);
  
  return { target: updatedTarget || target, rawSecret: raw };
}

export async function rotateSecret(targetId: string): Promise<{ rawSecret: string; last4: string } | null> {
  const target = await storage.getPublishingTarget(targetId);
  if (!target || target.type !== "wordpress_pull") {
    return null;
  }
  
  const { raw, hash, last4 } = await generateSecret();
  
  await storage.updatePublishingTarget(targetId, {
    secretHash: hash,
    secretLast4: last4,
    secretRotatedAt: new Date(),
  } as any);
  
  return { rawSecret: raw, last4 };
}

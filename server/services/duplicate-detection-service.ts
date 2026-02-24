import { db } from "../db";
import { sql } from "drizzle-orm";
import crypto from "crypto";

/**
 * Advanced Duplicate Detection Service
 * 
 * Prevents duplicate article publishing using multiple strategies:
 * 1. Story hash matching (exact URL match)
 * 2. Title similarity detection (Levenshtein distance)
 * 3. Content similarity detection (semantic comparison)
 * 4. Database constraints enforcement
 */

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  reason?: string;
  duplicateItemId?: string;
  duplicatePostId?: string;
  duplicateUrl?: string;
  similarityScore?: number;
}

export interface TitleSimilarityResult {
  isSimilar: boolean;
  score: number; // 0-1, where 1 is identical
  threshold: number;
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy title matching
 */
function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,    // deletion
          dp[i][j - 1] + 1,    // insertion
          dp[i - 1][j - 1] + 1 // substitution
        );
      }
    }
  }

  return dp[m][n];
}

/**
 * Calculate similarity score between two titles
 * Returns 0-1, where 1 is identical
 */
function calculateTitleSimilarity(title1: string, title2: string): number {
  // Normalize titles: lowercase, remove dates, remove source attribution
  const normalize = (title: string) => {
    return title
      .toLowerCase()
      .replace(/\s+-\s+\d{2}\/\d{2}\/\d{4}/g, '') // Remove dates
      .replace(/\s+-\s+[^-]+\s+-\s+seo blog$/i, '') // Remove source suffix
      .replace(/\s+-\s+.+$/g, '') // Remove trailing attribution
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  };

  const norm1 = normalize(title1);
  const norm2 = normalize(title2);

  // If titles are identical after normalization, they're duplicates
  if (norm1 === norm2) {
    return 1.0;
  }

  // Calculate Levenshtein distance
  const distance = levenshteinDistance(norm1, norm2);
  const maxLength = Math.max(norm1.length, norm2.length);
  
  // Convert distance to similarity score (0-1)
  const similarity = 1 - (distance / maxLength);

  return similarity;
}

/**
 * Check if two titles are similar enough to be considered duplicates
 * Threshold: 0.85 (85% similarity) - adjust as needed
 */
export function checkTitleSimilarity(
  title1: string,
  title2: string,
  threshold: number = 0.85
): TitleSimilarityResult {
  const score = calculateTitleSimilarity(title1, title2);
  
  return {
    isSimilar: score >= threshold,
    score,
    threshold,
  };
}

/**
 * Extract core content words from title (remove common words)
 */
function extractKeywords(title: string): string[] {
  const stopWords = new Set([
    'a', 'an', 'the', 'in', 'on', 'at', 'for', 'to', 'of', 'and', 'or', 'but',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
    'can', 'this', 'that', 'these', 'those', 'with', 'from', 'by', 'as'
  ]);

  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
}

/**
 * Calculate keyword overlap between two titles
 * Returns 0-1, where 1 means all keywords overlap
 */
function calculateKeywordOverlap(title1: string, title2: string): number {
  const keywords1 = new Set(extractKeywords(title1));
  const keywords2 = new Set(extractKeywords(title2));

  if (keywords1.size === 0 || keywords2.size === 0) {
    return 0;
  }

  const intersection = new Set([...keywords1].filter(k => keywords2.has(k)));
  const union = new Set([...keywords1, ...keywords2]);

  return intersection.size / union.size;
}

/**
 * Comprehensive duplicate check for a pipeline item
 * 
 * Strategy:
 * 1. Check story_hash (exact URL match) - FAST
 * 2. Check title similarity (fuzzy match) - MEDIUM
 * 3. Check keyword overlap (semantic match) - MEDIUM
 */
export async function checkDuplicateArticle(
  targetId: string,
  storyHash: string | null,
  title: string,
  pipelineItemId?: string
): Promise<DuplicateCheckResult> {
  
  // LEVEL 1: Exact story_hash match (fastest, most reliable)
  if (storyHash) {
    const hashMatch = await db.execute(
      sql`SELECT id, generated_title, status, target_post_id, target_permalink
          FROM pipeline_items
          WHERE target_id = ${targetId}
            AND story_hash = ${storyHash}
            AND status IN ('published', 'scheduled', 'publishing', 'retrying')
            AND (${pipelineItemId ? sql`id != ${pipelineItemId}` : sql`true`})
          LIMIT 1`
    );

    if (hashMatch.rows.length > 0) {
      const duplicate = hashMatch.rows[0] as any;
      return {
        isDuplicate: true,
        reason: `Exact match: Same source URL already published/scheduled (story_hash: ${storyHash.substring(0, 20)}...)`,
        duplicateItemId: duplicate.id,
        duplicatePostId: duplicate.target_post_id,
        duplicateUrl: duplicate.target_permalink,
        similarityScore: 1.0,
      };
    }
  }

  // LEVEL 2: Title similarity check (catch duplicates with different URLs)
  const recentArticles = await db.execute(
    sql`SELECT id, generated_title, status, target_post_id, target_permalink, story_hash
        FROM pipeline_items
        WHERE target_id = ${targetId}
          AND status IN ('published', 'scheduled', 'publishing', 'retrying')
          AND (${pipelineItemId ? sql`id != ${pipelineItemId}` : sql`true`})
          AND created_at > NOW() - INTERVAL '7 days'
        ORDER BY created_at DESC
        LIMIT 50`
  );

  for (const row of recentArticles.rows) {
    const article = row as any;
    
    // Check title similarity
    const titleSimilarity = checkTitleSimilarity(title, article.generated_title);
    
    if (titleSimilarity.isSimilar) {
      return {
        isDuplicate: true,
        reason: `Similar title detected (${(titleSimilarity.score * 100).toFixed(1)}% match): "${article.generated_title.substring(0, 60)}..."`,
        duplicateItemId: article.id,
        duplicatePostId: article.target_post_id,
        duplicateUrl: article.target_permalink,
        similarityScore: titleSimilarity.score,
      };
    }

    // Check keyword overlap (more lenient, catches rephrased titles)
    const keywordOverlap = calculateKeywordOverlap(title, article.generated_title);
    
    if (keywordOverlap > 0.75) { // 75% keyword overlap
      return {
        isDuplicate: true,
        reason: `High keyword overlap (${(keywordOverlap * 100).toFixed(1)}%): "${article.generated_title.substring(0, 60)}..."`,
        duplicateItemId: article.id,
        duplicatePostId: article.target_post_id,
        duplicateUrl: article.target_permalink,
        similarityScore: keywordOverlap,
      };
    }
  }

  // LEVEL 3: Check wp_pull_jobs to prevent plugin-side duplication
  if (storyHash) {
    const jobMatch = await db.execute(
      sql`SELECT id, result_wp_post_id, result_wp_url
          FROM wp_pull_jobs
          WHERE target_id = ${targetId}
            AND story_hash = ${storyHash}
            AND status IN ('published', 'leased', 'processing')
          LIMIT 1`
    );

    if (jobMatch.rows.length > 0) {
      const job = jobMatch.rows[0] as any;
      return {
        isDuplicate: true,
        reason: `WordPress pull job already exists for this story (job ID: ${job.id})`,
        duplicatePostId: job.result_wp_post_id,
        duplicateUrl: job.result_wp_url,
        similarityScore: 1.0,
      };
    }
  }

  return { isDuplicate: false };
}

/**
 * Quarantine a duplicate article
 * Prevents accidental publishing
 */
export async function quarantineDuplicate(
  pipelineItemId: string,
  reason: string
): Promise<void> {
  await db.execute(
    sql`UPDATE pipeline_items
        SET status = 'quarantined',
            quarantine_reason = ${reason},
            updated_at = NOW()
        WHERE id = ${pipelineItemId}`
  );
}

export const duplicateDetectionService = {
  checkDuplicateArticle,
  checkTitleSimilarity,
  quarantineDuplicate,
};

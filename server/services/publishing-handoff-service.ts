import { storage } from "../storage";
import type { PipelineItem, PublishingItem, InsertPublishingItem } from "@shared/schema";

/**
 * Publishing Handoff Service
 * 
 * Handles the transition of pipeline items from discovery to publishing pipeline.
 * Core mechanic: "handoff" - moving qualified items into the separate publishing operation.
 * 
 * Key Features:
 * - Idempotent: Multiple handoff attempts return existing publishing_item
 * - Eligibility checks: Only qualified items can be handed off
 * - No status pollution: Discovery pipeline stays clean
 */

export interface HandoffResult {
  success: boolean;
  publishingItemId?: string;
  publishingItem?: PublishingItem;
  isNew: boolean;
  reason?: string;
  errorCode?: string;
}

export interface HandoffOptions {
  wpConnectorId?: string;
  scheduledAt?: Date;
  status?: "draft_ready" | "editor_review" | "scheduled";
}

/**
 * Check if a pipeline item is eligible for handoff to publishing
 */
export async function checkHandoffEligibility(
  pipelineItem: PipelineItem
): Promise<{ eligible: boolean; reason?: string; errorCode?: string }> {
  
  // Check 1: Must not be quarantined
  if (pipelineItem.status === "quarantined") {
    return {
      eligible: false,
      reason: `Item is quarantined: ${pipelineItem.quarantineReason || "Unknown reason"}`,
      errorCode: "QUARANTINED",
    };
  }

  // Check 2: Must not be skipped
  if (pipelineItem.status === "skipped") {
    return {
      eligible: false,
      reason: `Item was skipped: ${pipelineItem.skipReason || "Unknown reason"}`,
      errorCode: "SKIPPED",
    };
  }

  // Check 3: Must have content (title and generated content)
  if (!pipelineItem.generatedTitle || !pipelineItem.generatedHtml) {
    return {
      eligible: false,
      reason: "Item missing generated content (title or HTML)",
      errorCode: "MISSING_CONTENT",
    };
  }

  // Check 4: Language filter (if specified in topic)
  // This would be checked against topic settings if available
  // For now, we assume language filtering happened during discovery

  // Check 5: Duplicate detection already passed
  // Quarantined items would have been caught earlier

  // Check 6: Must have target configured
  if (!pipelineItem.targetId) {
    return {
      eligible: false,
      reason: "Item has no publishing target configured",
      errorCode: "NO_TARGET",
    };
  }

  return { eligible: true };
}

/**
 * Hand off a pipeline item to the publishing pipeline
 * 
 * Idempotent: If publishing_item already exists, returns existing item
 * Atomic: Uses database unique constraint to prevent duplicates
 * 
 * @param pipelineItemId - ID of pipeline item to hand off
 * @param options - Optional handoff configuration
 * @returns HandoffResult with success status and publishing_item
 */
export async function handoffToPublishing(
  pipelineItemId: string,
  options: HandoffOptions = {}
): Promise<HandoffResult> {
  
  // Step 1: Check if already handed off (idempotency)
  const existing = await storage.getPublishingItemByPipelineItemId(pipelineItemId);
  
  if (existing) {
    return {
      success: true,
      publishingItemId: existing.id,
      publishingItem: existing,
      isNew: false,
      reason: "Item already handed off to publishing",
    };
  }

  // Step 2: Get pipeline item and check eligibility
  const pipelineItem = await storage.getPipelineItem(pipelineItemId);
  
  if (!pipelineItem) {
    return {
      success: false,
      isNew: false,
      reason: "Pipeline item not found",
      errorCode: "NOT_FOUND",
    };
  }

  const eligibility = await checkHandoffEligibility(pipelineItem);
  
  if (!eligibility.eligible) {
    return {
      success: false,
      isNew: false,
      reason: eligibility.reason,
      errorCode: eligibility.errorCode,
    };
  }

  // Step 3: Determine initial status
  let initialStatus: "draft_ready" | "editor_review" | "scheduled" = "draft_ready";
  
  if (options.status) {
    initialStatus = options.status;
  } else if (options.scheduledAt) {
    initialStatus = "scheduled";
  }

  // Step 4: Create publishing_item
  try {
    const publishingItemData: InsertPublishingItem = {
      pipelineItemId: pipelineItem.id,
      topicId: pipelineItem.topicId || undefined,
      workspaceId: pipelineItem.workspaceId,
      status: initialStatus,
      scheduledAt: options.scheduledAt,
      wpConnectorId: options.wpConnectorId || pipelineItem.targetId || undefined,
      attemptCount: 0,
    };

    const publishingItem = await storage.createPublishingItem(publishingItemData);

    console.log(`[Handoff] Created publishing item ${publishingItem.id} for pipeline item ${pipelineItemId}`);
    console.log(`  Status: ${publishingItem.status}`);
    console.log(`  Scheduled: ${publishingItem.scheduledAt || "Not scheduled"}`);
    console.log(`  Connector: ${publishingItem.wpConnectorId || "Not assigned"}`);

    return {
      success: true,
      publishingItemId: publishingItem.id,
      publishingItem,
      isNew: true,
      reason: "Item successfully handed off to publishing",
    };

  } catch (error: any) {
    // Handle unique constraint violation (race condition)
    if (error.code === "23505" || error.message?.includes("unique constraint")) {
      // Another request created it, fetch and return
      const existing = await storage.getPublishingItemByPipelineItemId(pipelineItemId);
      
      if (existing) {
        return {
          success: true,
          publishingItemId: existing.id,
          publishingItem: existing,
          isNew: false,
          reason: "Item already handed off (race condition handled)",
        };
      }
    }

    console.error(`[Handoff] Error handing off item ${pipelineItemId}:`, error);
    
    return {
      success: false,
      isNew: false,
      reason: `Failed to create publishing item: ${error.message}`,
      errorCode: "CREATE_FAILED",
    };
  }
}

/**
 * Batch handoff multiple pipeline items
 * 
 * @param pipelineItemIds - Array of pipeline item IDs
 * @param options - Optional handoff configuration
 * @returns Array of handoff results
 */
export async function batchHandoffToPublishing(
  pipelineItemIds: string[],
  options: HandoffOptions = {}
): Promise<HandoffResult[]> {
  
  const results: HandoffResult[] = [];

  for (const itemId of pipelineItemIds) {
    const result = await handoffToPublishing(itemId, options);
    results.push(result);
  }

  const successCount = results.filter(r => r.success).length;
  const newCount = results.filter(r => r.success && r.isNew).length;
  const existingCount = results.filter(r => r.success && !r.isNew).length;
  const failedCount = results.filter(r => !r.success).length;

  console.log(`[Batch Handoff] Completed: ${successCount}/${pipelineItemIds.length} successful`);
  console.log(`  New: ${newCount}, Existing: ${existingCount}, Failed: ${failedCount}`);

  return results;
}

export const publishingHandoffService = {
  handoffToPublishing,
  batchHandoffToPublishing,
  checkHandoffEligibility,
};

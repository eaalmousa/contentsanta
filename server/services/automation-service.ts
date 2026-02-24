import { storage } from "../storage";
import { processWorkflowWithAI } from "../ai-workflow";
import type { 
  Automation, 
  SourceItem, 
  AutomationRun,
  InsertAutomationRun,
  InsertAutomationRunItem,
  WorkflowType
} from "@shared/schema";

export interface AutomationResult {
  runId: string;
  itemsProcessed: number;
  itemsSucceeded: number;
  itemsFailed: number;
  errors: string[];
}

function matchesFilters(item: SourceItem, automation: Automation): boolean {
  const includeKeywords = automation.filterKeywordsInclude || [];
  const excludeKeywords = automation.filterKeywordsExclude || [];
  
  const searchText = `${item.title} ${item.excerpt || ""}`.toLowerCase();
  
  if (includeKeywords.length > 0) {
    const hasInclude = includeKeywords.some((kw) =>
      searchText.includes(kw.toLowerCase())
    );
    if (!hasInclude) return false;
  }
  
  if (excludeKeywords.length > 0) {
    const hasExclude = excludeKeywords.some((kw) =>
      searchText.includes(kw.toLowerCase())
    );
    if (hasExclude) return false;
  }
  
  return true;
}

export async function runAutomation(automation: Automation): Promise<AutomationResult> {
  console.log(`[Automation] Starting: ${automation.name}`);
  
  const runData: InsertAutomationRun = {
    workspaceId: automation.workspaceId,
    automationId: automation.id,
    status: "running",
  };
  
  const run = await storage.createAutomationRun(runData);
  await storage.updateAutomationRun(run.id, { startedAt: new Date() });
  
  const errors: string[] = [];
  let itemsProcessed = 0;
  let itemsSucceeded = 0;
  let itemsFailed = 0;
  
  try {
    const sourceIds = automation.sourceIds || [];
    const newItems = await storage.getNewSourceItems(
      automation.workspaceId,
      sourceIds.length > 0 ? sourceIds : undefined
    );
    
    const filteredItems = newItems.filter((item) => matchesFilters(item, automation));
    const itemsToProcess = filteredItems.slice(0, automation.runLimitPerCycle || 10);
    
    console.log(`[Automation] Processing ${itemsToProcess.length} items (filtered from ${newItems.length})`);
    
    for (const item of itemsToProcess) {
      itemsProcessed++;
      
      const runItemData: InsertAutomationRunItem = {
        runId: run.id,
        sourceItemId: item.id,
        status: "running",
      };
      const runItem = await storage.createAutomationRunItem(runItemData);
      
      try {
        await storage.updateSourceItem(item.id, { status: "queued" });
        
        const input = await storage.createInput({
          workspaceId: automation.workspaceId,
          type: "url",
          title: item.title,
          sourceUrl: item.url,
          rawText: item.rawContent || item.excerpt || item.title,
          language: automation.filterLanguage || "en",
        });
        
        const workflowRun = await storage.createWorkflowRun({
          workspaceId: automation.workspaceId,
          inputId: input.id,
          workflowType: automation.workflowType as WorkflowType,
        });
        
        const assetStatus = automation.approvalRequired === "true" ? "in_review" : "draft";
        
        const asset = await storage.createAsset({
          workspaceId: automation.workspaceId,
          inputId: input.id,
          status: assetStatus,
          primaryLanguage: automation.filterLanguage || "en",
        });
        
        const result = await processWorkflowWithAI(
          workflowRun.id,
          input.id,
          automation.workflowType as WorkflowType,
          automation.workspaceId,
          undefined
        );
        
        if (result.success) {
          await storage.updateSourceItem(item.id, { status: "processed" });
          await storage.updateAutomationRunItem(runItem.id, {
            status: "completed",
            assetId: asset.id,
          });
          
          if (automation.autoPublish === "true" && automation.publishingTargetId) {
            const target = await storage.getPublishingTarget(automation.publishingTargetId);
            const latestVersion = await storage.getLatestAssetVersion(asset.id);
            
            if (target && latestVersion && target.type === "wordpress") {
              // Category mapping is stored in automation.categoryMapping
              // For topic-based taxonomy rules, callers should integrate via prepareTaxonomyForPublishing
              const publishResult = await publishToWordPress(target, latestVersion, {
                status: "publish",
              });
              
              if (publishResult.success) {
                await storage.updateAsset(asset.id, { status: "published" });
                await storage.updateAutomationRunItem(runItem.id, {
                  publishedUrl: publishResult.postUrl,
                  wpPostId: publishResult.postId,
                });
              }
            }
          }
          
          itemsSucceeded++;
        } else {
          throw new Error(result.error || "Workflow failed");
        }
      } catch (error: any) {
        console.error(`[Automation] Error processing item ${item.id}:`, error.message);
        errors.push(`Item ${item.id}: ${error.message}`);
        
        await storage.updateSourceItem(item.id, { status: "new" });
        await storage.updateAutomationRunItem(runItem.id, {
          status: "failed",
          errorJson: { message: error.message },
        });
        
        itemsFailed++;
      }
    }
    
    await storage.updateAutomationRun(run.id, {
      status: "completed",
      completedAt: new Date(),
      itemsProcessed,
      itemsSucceeded,
      itemsFailed,
      logJson: errors.length > 0 ? errors : [],
    });
    
    await storage.updateAutomation(automation.id, {
      lastRunAt: new Date(),
    });
    
  } catch (error: any) {
    console.error(`[Automation] Fatal error:`, error.message);
    errors.push(error.message);
    
    await storage.updateAutomationRun(run.id, {
      status: "failed",
      completedAt: new Date(),
      itemsProcessed,
      itemsSucceeded,
      itemsFailed,
      errorJson: { message: error.message },
    });
  }
  
  console.log(`[Automation] Completed ${automation.name}: ${itemsSucceeded}/${itemsProcessed} succeeded`);
  
  return {
    runId: run.id,
    itemsProcessed,
    itemsSucceeded,
    itemsFailed,
    errors,
  };
}

export async function runAllActiveAutomations(): Promise<Map<string, AutomationResult>> {
  const automations = await storage.getActiveAutomations();
  const results = new Map<string, AutomationResult>();
  
  console.log(`[Automation] Running ${automations.length} active automations`);
  
  for (const automation of automations) {
    const result = await runAutomation(automation);
    results.set(automation.id, result);
  }
  
  return results;
}

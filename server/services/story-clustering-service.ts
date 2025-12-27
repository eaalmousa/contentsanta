import { storage } from "../storage";
import type { SourceItem, InsertStory, InsertStoryItem, InsertImageAsset } from "@shared/schema";
import crypto from "crypto";

// Media tier priority: tier_1 = authoritative, tier_2 = credible, tier_3 = unknown
const TIER_PRIORITY: Record<string, number> = {
  tier_1: 1,
  tier_2: 2,
  tier_3: 3,
};

interface ExtractedImage {
  url: string;
  source: string;
  width?: number;
  height?: number;
  type?: string;
}

const SIMILARITY_THRESHOLD = 0.6;

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(word => word.length > 2)
    .sort()
    .join(' ');
}

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'this', 'that',
    'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what',
    'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every',
    'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'not',
    'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'also',
    'now', 'new', 'says', 'said', 'after', 'before', 'about'
  ]);

  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word));
}

function generateSimilarityHash(title: string, excerpt?: string | null): string {
  const normalizedTitle = normalizeTitle(title);
  const keywords = extractKeywords(normalizedTitle + ' ' + (excerpt || ''));
  const topKeywords = keywords.slice(0, 10).sort().join('|');
  
  return crypto.createHash('md5').update(topKeywords).digest('hex').substring(0, 16);
}

function getDateBucket(date: Date | string | null | undefined): string {
  const d = date ? new Date(date) : new Date();
  return d.toISOString().split('T')[0];
}

function jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
  const arr1 = Array.from(set1);
  const arr2 = Array.from(set2);
  const intersection = arr1.filter(x => set2.has(x));
  const union = new Set(arr1.concat(arr2));
  return union.size > 0 ? intersection.length / union.size : 0;
}

function calculateSimilarity(item1: { title: string; excerpt?: string | null }, item2: { title: string; excerpt?: string | null }): number {
  const keywords1 = new Set(extractKeywords(item1.title + ' ' + (item1.excerpt || '')));
  const keywords2 = new Set(extractKeywords(item2.title + ' ' + (item2.excerpt || '')));
  
  return jaccardSimilarity(keywords1, keywords2);
}

async function createImageAssetsForStory(
  storyId: string, 
  sourceItem: SourceItem, 
  mediaTier: string
): Promise<void> {
  const metadata = sourceItem.metadataJson as any;
  const images: ExtractedImage[] = metadata?.images || [];
  
  if (images.length === 0) return;
  
  // Get existing image URLs for this story to deduplicate
  const existingAssets = await storage.getImageAssets(sourceItem.workspaceId, storyId);
  const existingUrls = new Set(existingAssets.map(a => a.originalUrl));
  
  for (const img of images) {
    if (existingUrls.has(img.url)) continue; // Skip duplicates
    
    const imageAsset: InsertImageAsset = {
      workspaceId: sourceItem.workspaceId,
      storyId,
      sourceItemId: sourceItem.id,
      originType: "source",
      originalUrl: img.url,
      metadataJson: {
        rssSource: img.source,
        width: img.width,
        height: img.height,
        mimeType: img.type,
        mediaTier,
      },
    };
    
    try {
      await storage.createImageAsset(imageAsset);
    } catch (err: any) {
      // Ignore duplicate key errors
      if (err.code !== "23505") {
        console.error(`[Image Asset] Error creating asset for ${img.url}:`, err.message);
      }
    }
  }
}

async function selectPrimaryImage(storyId: string, workspaceId: string): Promise<void> {
  const assets = await storage.getImageAssets(workspaceId, storyId);
  if (assets.length === 0) return;
  
  // Sort by tier priority (tier_1 first), then by creation date (oldest first = first seen)
  const sorted = [...assets].sort((a, b) => {
    const aTier = (a.metadataJson as any)?.mediaTier || "tier_3";
    const bTier = (b.metadataJson as any)?.mediaTier || "tier_3";
    const tierDiff = (TIER_PRIORITY[aTier] || 3) - (TIER_PRIORITY[bTier] || 3);
    if (tierDiff !== 0) return tierDiff;
    
    // Prefer images with dimensions (likely higher quality)
    const aHasDims = (a.metadataJson as any)?.width > 0;
    const bHasDims = (b.metadataJson as any)?.width > 0;
    if (aHasDims && !bHasDims) return -1;
    if (!aHasDims && bHasDims) return 1;
    
    return 0;
  });
  
  // Clear previous primary flags and set new primary
  for (let i = 0; i < sorted.length; i++) {
    const asset = sorted[i];
    const currentMeta = asset.metadataJson as any || {};
    const shouldBePrimary = i === 0;
    
    // Only update if isPrimary status needs to change
    if (currentMeta.isPrimary !== shouldBePrimary) {
      await storage.updateImageAsset(asset.id, {
        metadataJson: {
          ...currentMeta,
          isPrimary: shouldBePrimary,
        },
      });
    }
  }
}

export async function clusterSourceItem(sourceItem: SourceItem): Promise<{ storyId: string; isNew: boolean }> {
  const workspaceId = sourceItem.workspaceId;
  const dateBucket = getDateBucket(sourceItem.publishedAt);
  const similarityHash = generateSimilarityHash(sourceItem.title, sourceItem.excerpt);
  
  // Get source to determine media tier
  const source = await storage.getSource(sourceItem.sourceId);
  const mediaTier = source?.mediaTier || "tier_3";
  
  const existingStories = await storage.findStoriesBySimilarity(
    workspaceId,
    similarityHash,
    dateBucket
  );

  for (const story of existingStories) {
    const similarity = calculateSimilarity(
      { title: sourceItem.title, excerpt: sourceItem.excerpt },
      { title: story.canonicalTitle, excerpt: story.excerpt }
    );

    if (similarity >= SIMILARITY_THRESHOLD) {
      const storyItemData: InsertStoryItem = {
        storyId: story.id,
        sourceItemId: sourceItem.id,
        sourceName: undefined,
        sourceUrl: sourceItem.url,
        similarityScore: similarity.toFixed(3),
        isPrimary: "false",
      };
      
      await storage.createStoryItem(storyItemData);
      
      await storage.updateStory(story.id, {
        sourceCount: (story.sourceCount || 1) + 1,
        lastUpdatedAt: new Date(),
      });

      // Create image assets from source item and update primary selection
      await createImageAssetsForStory(story.id, sourceItem, mediaTier);
      await selectPrimaryImage(story.id, workspaceId);

      return { storyId: story.id, isNew: false };
    }
  }

  const storyData: InsertStory = {
    workspaceId,
    canonicalTitle: sourceItem.title,
    normalizedTitle: normalizeTitle(sourceItem.title),
    excerpt: sourceItem.excerpt,
    entities: [],
    publishedDateBucket: dateBucket,
    similarityHash,
    sourceCount: 1,
  };

  const newStory = await storage.createStory(storyData);

  const storyItemData: InsertStoryItem = {
    storyId: newStory.id,
    sourceItemId: sourceItem.id,
    sourceName: undefined,
    sourceUrl: sourceItem.url,
    similarityScore: "1.000",
    isPrimary: "true",
  };

  await storage.createStoryItem(storyItemData);
  
  // Create image assets from source item and select primary
  await createImageAssetsForStory(newStory.id, sourceItem, mediaTier);
  await selectPrimaryImage(newStory.id, workspaceId);

  return { storyId: newStory.id, isNew: true };
}

export async function processNewItemsForClustering(workspaceId: string): Promise<{ processed: number; newStories: number; clustered: number }> {
  const items = await storage.getNewSourceItems(workspaceId);
  
  let processed = 0;
  let newStories = 0;
  let clustered = 0;

  for (const item of items) {
    try {
      const result = await clusterSourceItem(item);
      processed++;
      
      if (result.isNew) {
        newStories++;
      } else {
        clustered++;
      }
    } catch (error) {
      console.error(`[Story Clustering] Error processing item ${item.id}:`, error);
    }
  }

  return { processed, newStories, clustered };
}

export async function getStoryWithProvenance(storyId: string): Promise<{
  story: any;
  sources: Array<{ name: string; url: string; publishedAt?: string }>;
} | null> {
  const story = await storage.getStory(storyId);
  if (!story) return null;

  const storyItems = await storage.getStoryItems(storyId);
  
  const sources = await Promise.all(
    storyItems.map(async (item) => {
      const sourceItem = await storage.getSourceItem(item.sourceItemId);
      if (!sourceItem) return null;
      
      const source = await storage.getSource(sourceItem.sourceId);
      
      return {
        name: source?.name || 'Unknown Source',
        url: sourceItem.url,
        publishedAt: sourceItem.publishedAt?.toISOString(),
      };
    })
  );

  return {
    story,
    sources: sources.filter((s): s is NonNullable<typeof s> => s !== null),
  };
}

export async function createDraftFromStory(
  storyId: string, 
  topicId: string,
  workspaceId: string
): Promise<{ draftId: string } | null> {
  const storyWithProvenance = await getStoryWithProvenance(storyId);
  if (!storyWithProvenance) return null;

  const { story, sources } = storyWithProvenance;

  const draft = await storage.createDraft({
    workspaceId,
    topicId,
    storyId,
    title: story.canonicalTitle,
    angle: story.excerpt || undefined,
    body: undefined,
    provenance: sources.map(s => ({ name: s.name, url: s.url })),
    status: "pending",
  });

  return { draftId: draft.id };
}

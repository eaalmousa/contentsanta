import { storage } from "../storage";
import type { SourceItem, InsertStory, InsertStoryItem } from "@shared/schema";
import crypto from "crypto";

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

export async function clusterSourceItem(sourceItem: SourceItem): Promise<{ storyId: string; isNew: boolean }> {
  const workspaceId = sourceItem.workspaceId;
  const dateBucket = getDateBucket(sourceItem.publishedAt);
  const similarityHash = generateSimilarityHash(sourceItem.title, sourceItem.excerpt);
  
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

import type { PublishingTarget, AssetVersion, ImageAsset, InsertImageUsage, TargetTaxonomyRule } from "@shared/schema";
import { storage } from "../storage";
import https from "https";
import { URL } from "url";

export interface WordPressCredentials {
  siteUrl: string;
  username: string;
  applicationPassword: string;
}

// SSRF-safe hostnames (block private IPs)
const BLOCKED_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^0\./,
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i,
  /^169\.254\./,
];

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

// Magic byte signatures for MIME validation
const MAGIC_BYTES: Record<string, Buffer[]> = {
  "image/jpeg": [Buffer.from([0xFF, 0xD8, 0xFF])],
  "image/png": [Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])],
  "image/gif": [Buffer.from([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]), Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])],
  "image/webp": [Buffer.from([0x52, 0x49, 0x46, 0x46])], // RIFF header, WebP has additional check
};

function validateMagicBytes(buffer: Buffer, claimedMimeType: string): boolean {
  const signatures = MAGIC_BYTES[claimedMimeType];
  if (!signatures) return false;
  
  for (const sig of signatures) {
    if (buffer.length >= sig.length && buffer.subarray(0, sig.length).equals(sig)) {
      // Additional check for WebP: must have WEBP at bytes 8-11
      if (claimedMimeType === "image/webp") {
        if (buffer.length >= 12) {
          const webpMarker = buffer.subarray(8, 12).toString("ascii");
          return webpMarker === "WEBP";
        }
        return false;
      }
      return true;
    }
  }
  return false;
}

function isUrlSafe(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    
    // HTTPS only
    if (url.protocol !== "https:") {
      return false;
    }
    
    // Check against blocked patterns
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(url.hostname)) {
        return false;
      }
    }
    
    return true;
  } catch {
    return false;
  }
}

async function downloadImage(imageUrl: string): Promise<{ buffer: Buffer; mimeType: string; filename: string } | null> {
  if (!isUrlSafe(imageUrl)) {
    console.error(`[Image Download] Blocked unsafe URL: ${imageUrl}`);
    return null;
  }
  
  return new Promise((resolve) => {
    const url = new URL(imageUrl);
    
    const request = https.get(imageUrl, {
      timeout: 30000,
      headers: {
        "User-Agent": "ContentSanta/1.0",
        "Accept": "image/*",
      },
    }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        const redirectUrl = response.headers.location;
        if (redirectUrl && isUrlSafe(redirectUrl)) {
          downloadImage(redirectUrl).then(resolve);
        } else {
          console.error(`[Image Download] Unsafe redirect: ${redirectUrl}`);
          resolve(null);
        }
        return;
      }
      
      if (response.statusCode !== 200) {
        console.error(`[Image Download] HTTP ${response.statusCode} for ${imageUrl}`);
        resolve(null);
        return;
      }
      
      const contentType = response.headers["content-type"] || "";
      const mimeType = contentType.split(";")[0].trim().toLowerCase();
      
      if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
        console.error(`[Image Download] Invalid MIME type: ${mimeType}`);
        resolve(null);
        return;
      }
      
      const chunks: Buffer[] = [];
      let totalSize = 0;
      const maxSize = 10 * 1024 * 1024; // 10MB limit
      
      response.on("data", (chunk) => {
        totalSize += chunk.length;
        if (totalSize > maxSize) {
          request.destroy();
          resolve(null);
        } else {
          chunks.push(chunk);
        }
      });
      
      response.on("end", () => {
        const buffer = Buffer.concat(chunks);
        
        // Validate magic bytes match claimed MIME type (security: prevent spoofed content-type)
        if (!validateMagicBytes(buffer, mimeType)) {
          console.error(`[Image Download] Magic bytes don't match MIME type: ${mimeType}`);
          resolve(null);
          return;
        }
        
        // Extract filename from URL or generate one
        const pathParts = url.pathname.split("/");
        let filename = pathParts[pathParts.length - 1] || "image";
        if (!filename.includes(".")) {
          const ext = mimeType.split("/")[1] || "jpg";
          filename = `${filename}.${ext}`;
        }
        
        resolve({ buffer, mimeType, filename });
      });
      
      response.on("error", () => resolve(null));
    });
    
    request.on("error", () => resolve(null));
    request.on("timeout", () => {
      request.destroy();
      resolve(null);
    });
  });
}

export interface WordPressMediaResult {
  success: boolean;
  mediaId?: number;
  mediaUrl?: string;
  error?: string;
}

async function uploadToWordPressMedia(
  credentials: WordPressCredentials,
  buffer: Buffer,
  filename: string,
  mimeType: string,
  caption?: string,
  credit?: string
): Promise<WordPressMediaResult> {
  try {
    const apiUrl = `${credentials.siteUrl}/wp-json/wp/v2/media`;
    
    const auth = Buffer.from(
      `${credentials.username}:${credentials.applicationPassword}`
    ).toString("base64");
    
    // Build alt text and caption with credit
    const altText = caption || filename.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
    const fullCaption = credit ? `${caption || ""} (Credit: ${credit})`.trim() : caption;
    
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": mimeType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
      body: buffer,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `WordPress Media API error: ${response.status} - ${errorText}`,
      };
    }
    
    const result = await response.json();
    
    // Update media with alt text and caption
    if (altText || fullCaption) {
      await fetch(`${apiUrl}/${result.id}`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          alt_text: altText,
          caption: fullCaption,
        }),
      });
    }
    
    console.log(`[WordPress Media] Uploaded: ${filename} -> Media ID ${result.id}`);
    
    return {
      success: true,
      mediaId: result.id,
      mediaUrl: result.source_url,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function uploadFeaturedImage(
  target: PublishingTarget,
  imageAsset: ImageAsset
): Promise<WordPressMediaResult> {
  const credentials = parseCredentials(target);
  
  if (!credentials) {
    return {
      success: false,
      error: "Invalid WordPress credentials",
    };
  }
  
  if (!imageAsset.originalUrl) {
    return {
      success: false,
      error: "No image URL available",
    };
  }
  
  console.log(`[WordPress] Downloading image: ${imageAsset.originalUrl}`);
  const downloadResult = await downloadImage(imageAsset.originalUrl);
  
  if (!downloadResult) {
    return {
      success: false,
      error: "Failed to download image (HTTPS/SSRF/MIME check failed)",
    };
  }
  
  console.log(`[WordPress] Uploading to media library: ${downloadResult.filename}`);
  const uploadResult = await uploadToWordPressMedia(
    credentials,
    downloadResult.buffer,
    downloadResult.filename,
    downloadResult.mimeType,
    imageAsset.caption || undefined,
    imageAsset.credit || undefined
  );
  
  if (uploadResult.success && uploadResult.mediaId) {
    // Record image usage
    const usage: InsertImageUsage = {
      imageAssetId: imageAsset.id,
      target: "wordpress",
      targetPostId: undefined, // Will be set when post is created
      uploadedUrl: uploadResult.mediaUrl,
      uploadedAt: new Date(),
      metadataJson: {
        wpMediaId: uploadResult.mediaId,
        targetId: target.id,
      },
    };
    
    try {
      await storage.createImageUsage(usage);
    } catch (err: any) {
      console.error(`[WordPress] Failed to record image usage:`, err.message);
    }
  }
  
  return uploadResult;
}

export interface WordPressPublishResult {
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
  warnings?: string[];
  featuredImageFailed?: boolean;
  featuredImageError?: string;
}

function parseCredentials(target: PublishingTarget): WordPressCredentials | null {
  try {
    const config = target.configJson as any;
    
    // Support both old field names (apiUrl, apiKey) and new ones (siteUrl, applicationPassword)
    const siteUrl = config?.siteUrl || config?.apiUrl;
    const username = config?.username;
    const applicationPassword = config?.applicationPassword || config?.apiKey;
    
    if (!siteUrl || !username || !applicationPassword) {
      console.log('[WordPress] parseCredentials failed - missing fields:', { 
        hasSiteUrl: !!siteUrl, 
        hasUsername: !!username, 
        hasAppPassword: !!applicationPassword,
        configKeys: config ? Object.keys(config) : [] 
      });
      return null;
    }
    return {
      siteUrl,
      username,
      applicationPassword,
    };
  } catch (err) {
    console.error('[WordPress] parseCredentials error:', err);
    return null;
  }
}

function markdownToHtml(markdown: string): string {
  let html = markdown;
  
  html = html.replace(/^### (.*$)/gim, "<h3>$1</h3>");
  html = html.replace(/^## (.*$)/gim, "<h2>$1</h2>");
  html = html.replace(/^# (.*$)/gim, "<h1>$1</h1>");
  
  html = html.replace(/\*\*(.*)\*\*/gim, "<strong>$1</strong>");
  html = html.replace(/\*(.*)\*/gim, "<em>$1</em>");
  
  html = html.replace(/^\s*\n\*/gm, "<ul>\n*");
  html = html.replace(/^(\*.+)\s*\n([^\*])/gm, "$1\n</ul>\n\n$2");
  html = html.replace(/^\*(.+)/gm, "<li>$1</li>");
  
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/gim, '<a href="$2">$1</a>');
  
  html = html.replace(/\n\n/g, "</p><p>");
  html = "<p>" + html + "</p>";
  
  return html;
}

export interface WordPressTaxonomyOptions {
  categories?: number[];
  tags?: number[];
  status?: "publish" | "draft" | "pending";
  featuredImage?: ImageAsset;
}

export async function publishToWordPress(
  target: PublishingTarget,
  version: AssetVersion,
  options?: WordPressTaxonomyOptions
): Promise<WordPressPublishResult> {
  const credentials = parseCredentials(target);
  
  if (!credentials) {
    return {
      success: false,
      error: "Invalid WordPress credentials in target configuration",
    };
  }
  
  try {
    const apiUrl = `${credentials.siteUrl}/wp-json/wp/v2/posts`;
    
    const auth = Buffer.from(
      `${credentials.username}:${credentials.applicationPassword}`
    ).toString("base64");
    
    const content = version.format === "md" 
      ? markdownToHtml(version.body)
      : version.body;
    
    const postData: any = {
      title: version.title || "Untitled",
      content,
      status: options?.status || "draft",
    };
    
    if (options?.categories?.length) {
      postData.categories = options.categories;
    }
    
    if (options?.tags?.length) {
      postData.tags = options.tags;
    }
    
    const metadata = version.metadataJson as any;
    if (metadata?.excerpt) {
      postData.excerpt = metadata.excerpt;
    }
    
    // Upload featured image if provided
    let featuredMediaId: number | undefined;
    let featuredImageFailed = false;
    let featuredImageError: string | undefined;
    const warnings: string[] = [];
    
    if (options?.featuredImage) {
      console.log(`[WordPress] Uploading featured image...`);
      const imageResult = await uploadFeaturedImage(target, options.featuredImage);
      if (imageResult.success && imageResult.mediaId) {
        featuredMediaId = imageResult.mediaId;
        postData.featured_media = featuredMediaId;
        console.log(`[WordPress] Featured image set: Media ID ${featuredMediaId}`);
      } else {
        featuredImageFailed = true;
        featuredImageError = imageResult.error || "Unknown error";
        warnings.push(`Featured image upload failed: ${featuredImageError}`);
        console.warn(`[WordPress] Featured image upload failed: ${featuredImageError}`);
        // Continue without featured image
      }
    }
    
    console.log(`[WordPress] Publishing to ${credentials.siteUrl}...`);
    
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(postData),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[WordPress] Publish failed:`, errorText);
      return {
        success: false,
        error: `WordPress API error: ${response.status} - ${errorText}`,
      };
    }
    
    const result = await response.json();
    
    console.log(`[WordPress] Published successfully: Post ID ${result.id}`);
    
    // Update image usage with post ID if we uploaded a featured image
    if (featuredMediaId && options?.featuredImage) {
      try {
        const usages = await storage.getImageUsages(options.featuredImage.id);
        const latestUsage = usages.find(u => (u.metadataJson as any)?.wpMediaId === featuredMediaId);
        if (latestUsage) {
          await storage.updateImageUsage(latestUsage.id, {
            targetPostId: String(result.id),
          });
        }
      } catch (err: any) {
        console.warn(`[WordPress] Failed to update image usage:`, err.message);
      }
    }
    
    return {
      success: true,
      postId: String(result.id),
      postUrl: result.link,
      warnings: warnings.length > 0 ? warnings : undefined,
      featuredImageFailed,
      featuredImageError,
    };
  } catch (error: any) {
    console.error(`[WordPress] Error:`, error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

export async function testWordPressConnection(
  target: PublishingTarget
): Promise<{ success: boolean; siteName?: string; error?: string }> {
  const credentials = parseCredentials(target);
  
  if (!credentials) {
    const config = target.configJson as any;
    return {
      success: false,
      error: `Missing credentials. Please ensure Site URL, Username, and Application Password are all provided. (Fields found: ${config ? Object.keys(config).join(', ') : 'none'})`,
    };
  }
  
  try {
    // First check if the WordPress REST API is accessible
    const apiUrl = `${credentials.siteUrl}/wp-json/wp/v2/users/me`;
    console.log(`[WordPress] Testing connection to: ${apiUrl}`);
    
    const auth = Buffer.from(
      `${credentials.username}:${credentials.applicationPassword}`
    ).toString("base64");
    
    const response = await fetch(apiUrl, {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.log(`[WordPress] Auth failed: ${response.status} - ${errorText}`);
      
      if (response.status === 401) {
        return {
          success: false,
          error: "Authentication failed. Check your username and application password. Make sure the application password was generated in WordPress under Users > Profile > Application Passwords.",
        };
      }
      if (response.status === 403) {
        return {
          success: false,
          error: "Access forbidden. Your user may not have REST API access. Check WordPress user permissions.",
        };
      }
      if (response.status === 404) {
        return {
          success: false,
          error: "WordPress REST API not found. Make sure your Site URL is correct and REST API is enabled.",
        };
      }
      return {
        success: false,
        error: `WordPress API error: ${response.status}. ${errorText.slice(0, 100)}`,
      };
    }
    
    const siteResponse = await fetch(`${credentials.siteUrl}/wp-json`);
    const siteInfo = await siteResponse.json();
    
    console.log(`[WordPress] Connection successful to: ${siteInfo.name}`);
    return {
      success: true,
      siteName: siteInfo.name,
    };
  } catch (error: any) {
    console.error(`[WordPress] Connection error:`, error);
    if (error.code === 'ENOTFOUND') {
      return {
        success: false,
        error: `Cannot reach ${credentials.siteUrl}. Check that the URL is correct and the site is accessible.`,
      };
    }
    return {
      success: false,
      error: `Connection error: ${error.message}`,
    };
  }
}

// ============ TAXONOMY SYNC ============

export interface WpCategory {
  id: number;
  name: string;
  slug: string;
  parent: number;
  count: number;
}

export interface WpTag {
  id: number;
  name: string;
  slug: string;
  count: number;
}

export interface TaxonomySyncResult {
  success: boolean;
  count?: number;
  error?: string;
}

export async function fetchWordPressCategories(
  target: PublishingTarget
): Promise<{ success: boolean; categories?: WpCategory[]; error?: string }> {
  const credentials = parseCredentials(target);
  
  console.log(`[WordPress] fetchWordPressCategories - target configJson:`, JSON.stringify(target.configJson, null, 2));
  
  if (!credentials) {
    const config = target.configJson as any;
    return { 
      success: false, 
      error: `Missing credentials. Fields found: ${config ? Object.keys(config).join(', ') : 'none'}` 
    };
  }
  
  // Normalize siteUrl - remove trailing slash
  const normalizedSiteUrl = credentials.siteUrl.replace(/\/+$/, '');
  console.log(`[WordPress] Using siteUrl: "${normalizedSiteUrl}" (original: "${credentials.siteUrl}")`);
  
  try {
    const auth = Buffer.from(
      `${credentials.username}:${credentials.applicationPassword}`
    ).toString("base64");
    
    const categories: WpCategory[] = [];
    let page = 1;
    const perPage = 100;
    
    while (true) {
      const apiUrl = `${normalizedSiteUrl}/wp-json/wp/v2/categories?per_page=${perPage}&page=${page}`;
      console.log(`[WordPress] Fetching categories from: ${apiUrl}`);
      
      const response = await fetch(apiUrl, {
        headers: { Authorization: `Basic ${auth}` },
      });
      
      if (!response.ok) {
        if (response.status === 400) break; // No more pages
        const text = await response.text().catch(() => '');
        console.log(`[WordPress] Categories API error: ${response.status} - ${text.slice(0, 200)}`);
        return { success: false, error: `API error: ${response.status}` };
      }
      
      // Check content type - if HTML returned, the URL is wrong
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        return { 
          success: false, 
          error: `WordPress REST API not found at ${credentials.siteUrl}. The site returned HTML instead of JSON. Check if WordPress is installed in a subdirectory (e.g., /blog or /wp).` 
        };
      }
      
      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) break;
      
      for (const cat of data) {
        categories.push({
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          parent: cat.parent || 0,
          count: cat.count || 0,
        });
      }
      
      if (data.length < perPage) break;
      page++;
    }
    
    console.log(`[WordPress] Fetched ${categories.length} categories`);
    return { success: true, categories };
  } catch (error: any) {
    console.error(`[WordPress] Categories fetch error:`, error);
    // Check for JSON parse errors - indicates HTML response
    if (error.message?.includes('Unexpected token') || error.message?.includes('not valid JSON')) {
      return { 
        success: false, 
        error: `WordPress REST API not reachable. The site URL may be incorrect or WordPress may be installed in a subdirectory. Try adding the subdirectory path (e.g., /blog, /wp, /geg).` 
      };
    }
    return { success: false, error: error.message };
  }
}

export async function fetchWordPressTags(
  target: PublishingTarget
): Promise<{ success: boolean; tags?: WpTag[]; error?: string }> {
  const credentials = parseCredentials(target);
  
  if (!credentials) {
    const config = target.configJson as any;
    return { 
      success: false, 
      error: `Missing credentials. Fields found: ${config ? Object.keys(config).join(', ') : 'none'}` 
    };
  }
  
  try {
    const auth = Buffer.from(
      `${credentials.username}:${credentials.applicationPassword}`
    ).toString("base64");
    
    const tags: WpTag[] = [];
    let page = 1;
    const perPage = 100;
    
    while (true) {
      const response = await fetch(
        `${credentials.siteUrl}/wp-json/wp/v2/tags?per_page=${perPage}&page=${page}`,
        {
          headers: { Authorization: `Basic ${auth}` },
        }
      );
      
      if (!response.ok) {
        if (response.status === 400) break;
        return { success: false, error: `API error: ${response.status}` };
      }
      
      const data = await response.json();
      if (!Array.isArray(data) || data.length === 0) break;
      
      for (const tag of data) {
        tags.push({
          id: tag.id,
          name: tag.name,
          slug: tag.slug,
          count: tag.count || 0,
        });
      }
      
      if (data.length < perPage) break;
      page++;
    }
    
    console.log(`[WordPress] Fetched ${tags.length} tags`);
    return { success: true, tags };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createWordPressTag(
  target: PublishingTarget,
  name: string
): Promise<{ success: boolean; tag?: WpTag; error?: string }> {
  const credentials = parseCredentials(target);
  
  if (!credentials) {
    return { success: false, error: "Invalid credentials" };
  }
  
  try {
    const auth = Buffer.from(
      `${credentials.username}:${credentials.applicationPassword}`
    ).toString("base64");
    
    const response = await fetch(`${credentials.siteUrl}/wp-json/wp/v2/tags`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // Tag already exists
      if (errorData.code === "term_exists" && errorData.data?.term_id) {
        return {
          success: true,
          tag: {
            id: errorData.data.term_id,
            name,
            slug: name.toLowerCase().replace(/\s+/g, "-"),
            count: 0,
          },
        };
      }
      return { success: false, error: `Failed to create tag: ${response.status}` };
    }
    
    const tag = await response.json();
    console.log(`[WordPress] Created tag: ${name} (ID: ${tag.id})`);
    
    return {
      success: true,
      tag: {
        id: tag.id,
        name: tag.name,
        slug: tag.slug,
        count: tag.count || 0,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createWordPressCategory(
  target: PublishingTarget,
  name: string,
  parentId?: number
): Promise<{ success: boolean; category?: WpCategory; error?: string }> {
  const credentials = parseCredentials(target);
  
  if (!credentials) {
    return { success: false, error: "Invalid credentials" };
  }
  
  try {
    const auth = Buffer.from(
      `${credentials.username}:${credentials.applicationPassword}`
    ).toString("base64");
    
    const body: any = { name };
    if (parentId) body.parent = parentId;
    
    const response = await fetch(`${credentials.siteUrl}/wp-json/wp/v2/categories`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (errorData.code === "term_exists" && errorData.data?.term_id) {
        return {
          success: true,
          category: {
            id: errorData.data.term_id,
            name,
            slug: name.toLowerCase().replace(/\s+/g, "-"),
            parent: parentId || 0,
            count: 0,
          },
        };
      }
      return { success: false, error: `Failed to create category: ${response.status}` };
    }
    
    const cat = await response.json();
    console.log(`[WordPress] Created category: ${name} (ID: ${cat.id})`);
    
    return {
      success: true,
      category: {
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
        parent: cat.parent || 0,
        count: cat.count || 0,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ============ TAXONOMY PREPARATION FOR PUBLISHING ============

export interface PreparedTaxonomy {
  categoryIds: number[];
  tagIds: number[];
}

export async function prepareTaxonomyForPublishing(
  target: PublishingTarget,
  topicRules?: TargetTaxonomyRule,
  additionalTagNames?: string[]
): Promise<PreparedTaxonomy> {
  const categoryIds: number[] = [];
  const tagIds: number[] = [];
  
  if (topicRules) {
    // Add default categories from topic rules
    if (topicRules.defaultCategoryIds?.length) {
      categoryIds.push(...topicRules.defaultCategoryIds);
    }
    
    // Add default tags from topic rules
    if (topicRules.defaultTagIds?.length) {
      tagIds.push(...topicRules.defaultTagIds);
    }
  }
  
  // Handle additional tags that may need to be created
  if (additionalTagNames?.length && topicRules?.allowCreateTags) {
    const cachedTags = await storage.getWpTaxonomyCache(target.id, "tag");
    const tagNameToId = new Map(cachedTags.map(t => [t.name.toLowerCase(), t.wpId]));
    
    for (const tagName of additionalTagNames) {
      const normalizedName = tagName.toLowerCase().trim();
      if (!normalizedName) continue;
      
      // Check if tag exists in cache
      const existingId = tagNameToId.get(normalizedName);
      if (existingId) {
        if (!tagIds.includes(existingId)) {
          tagIds.push(existingId);
        }
        continue;
      }
      
      // Create new tag in WordPress
      const createResult = await createWordPressTag(target, tagName.trim());
      if (createResult.success && createResult.tag) {
        tagIds.push(createResult.tag.id);
        
        // Update cache with new tag
        await storage.upsertWpTaxonomyCache({
          publishingTargetId: target.id,
          taxonomyType: "tag",
          wpId: createResult.tag.id,
          name: createResult.tag.name,
          slug: createResult.tag.slug,
          count: 0,
        });
        
        console.log(`[WordPress] Created and cached new tag: ${tagName}`);
      }
    }
  }
  
  return { categoryIds, tagIds };
}

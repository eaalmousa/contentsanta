import type { PublishingTarget, AssetVersion } from "@shared/schema";

export interface WordPressCredentials {
  siteUrl: string;
  username: string;
  applicationPassword: string;
}

export interface WordPressPublishResult {
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
}

function parseCredentials(target: PublishingTarget): WordPressCredentials | null {
  try {
    const config = target.configJson as any;
    if (!config?.siteUrl || !config?.username || !config?.applicationPassword) {
      return null;
    }
    return {
      siteUrl: config.siteUrl,
      username: config.username,
      applicationPassword: config.applicationPassword,
    };
  } catch {
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

export async function publishToWordPress(
  target: PublishingTarget,
  version: AssetVersion,
  options?: {
    categories?: number[];
    tags?: string[];
    status?: "publish" | "draft" | "pending";
  }
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
    
    return {
      success: true,
      postId: String(result.id),
      postUrl: result.link,
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
    return {
      success: false,
      error: "Invalid credentials configuration",
    };
  }
  
  try {
    const auth = Buffer.from(
      `${credentials.username}:${credentials.applicationPassword}`
    ).toString("base64");
    
    const response = await fetch(`${credentials.siteUrl}/wp-json/wp/v2/users/me`, {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });
    
    if (!response.ok) {
      return {
        success: false,
        error: `Authentication failed: ${response.status}`,
      };
    }
    
    const siteResponse = await fetch(`${credentials.siteUrl}/wp-json`);
    const siteInfo = await siteResponse.json();
    
    return {
      success: true,
      siteName: siteInfo.name,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message,
    };
  }
}

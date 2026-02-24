export interface SanitizedContent {
  title: string;
  body: string;
  excerpt: string;
  metaDescription?: string;
  keywords?: string[];
}

export interface SanitizeOptions {
  preserveMarkdown?: boolean;
  maxExcerptLength?: number;
}

export interface StrippedSections {
  cleaned: string;
  extractedKeywords?: string[];
  extractedMeta?: string;
}

function markdownToHtml(markdown: string): string {
  let html = markdown;
  
  html = html.replace(/^### (.*$)/gim, "<h3>$1</h3>");
  html = html.replace(/^## (.*$)/gim, "<h2>$1</h2>");
  html = html.replace(/^# (.*$)/gim, "<h1>$1</h1>");
  
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  
  html = html.replace(/^\s*\n\*/gm, "<ul>\n*");
  html = html.replace(/^(\*.+)\s*\n([^\*])/gm, "$1\n</ul>\n\n$2");
  html = html.replace(/^\*(.+)/gm, "<li>$1</li>");
  
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  
  html = html.replace(/\n\n/g, "</p><p>");
  html = "<p>" + html + "</p>";
  
  return html;
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]*>/g, "");
}

export class ContentSanitizer {
  /**
   * Strip SEO sections BEFORE markdown/HTML conversion
   * 
   * Removes entire blocks:
   * - Meta Description sections
   * - Relevant Keywords sections  
   * - Keyword bullet list dumps
   * 
   * Returns cleaned text + extracted metadata
   */
  stripSeoSections(rawText: string): StrippedSections {
    if (!rawText) {
      return { cleaned: "", extractedKeywords: [], extractedMeta: "" };
    }

    let cleaned = rawText;
    let extractedMeta: string | undefined;
    let extractedKeywords: string[] = [];

    // Step 1: Remove Meta Description blocks (all variants)
    const metaPatterns = [
      /^\s*\*\*\s*meta\s+description\s*:?\s*\*\*\s*\n([\s\S]*?)(?=\n\s*\n|\n\s*#+|\n\s*\*\*|$)/gim,
      /^\s*#+\s*meta\s+description\s*:?\s*\n([\s\S]*?)(?=\n\s*\n|\n\s*#+|\n\s*\*\*|$)/gim,
      /^\s*meta\s+description\s*:?\s*[—\-]?\s*\n([\s\S]*?)(?=\n\s*\n|\n\s*#+|\n\s*\*\*|$)/gim,
      /^\s*meta\s*description\s*:?\s*(.*?)(?=\n\s*\n|\n\s*#+|\n\s*\*\*|$)/gim,
    ];

    for (const pattern of metaPatterns) {
      const match = cleaned.match(pattern);
      if (match) {
        const content = match[1] || match[0];
        if (content && !extractedMeta) {
          // CRITICAL: Strip "Meta Description:" label from extracted content
          let cleaned_meta = content.trim().replace(/\*\*/g, "");
          cleaned_meta = cleaned_meta.replace(/^meta\s*description\s*[:\-–—]?\s*/i, "");
          extractedMeta = cleaned_meta.substring(0, 300);
        }
        cleaned = cleaned.replace(pattern, "");
      }
    }

    // Step 2: Remove Keywords sections (all variants)
    const keywordPatterns = [
      /^\s*\*\*\s*(relevant\s+)?keywords\s*:?\s*\*\*\s*\n((?:\s*[*\-•]\s*.+?\n)+)/gim,
      /^\s*\*\*\s*seo\s+keywords\s*:?\s*\*\*\s*\n((?:\s*[*\-•]\s*.+?\n)+)/gim,
      /^\s*#+\s*(relevant\s+)?keywords\s*:?\s*\n((?:\s*[*\-•]\s*.+?\n)+)/gim,
      /^\s*#+\s*seo\s+keywords\s*:?\s*\n((?:\s*[*\-•]\s*.+?\n)+)/gim,
      /^\s*(relevant\s+)?keywords\s*:?\s*\n((?:\s*[*\-•]\s*.+?\n)+)/gim,
      /^\s*seo\s+keywords\s*:?\s*\n((?:\s*[*\-•]\s*.+?\n)+)/gim,
    ];

    for (const pattern of keywordPatterns) {
      const match = cleaned.match(pattern);
      if (match) {
        const keywordBlock = match[2] || match[1] || "";
        const keywords = keywordBlock
          .split("\n")
          .map(line => line.replace(/^\s*[*\-•]\s*/, "").trim())
          .filter(k => k.length > 0 && k.length < 100);
        
        if (keywords.length > 0 && extractedKeywords.length === 0) {
          extractedKeywords = keywords;
        }
        
        cleaned = cleaned.replace(pattern, "");
      }
    }

    // Step 3: Remove standalone keyword bullet dumps
    const bulletDumpPattern = /(?:^\s*[*\-•]\s+[^\n]{10,60}\n){3,}/gm;
    const bulletMatches = cleaned.match(bulletDumpPattern);
    if (bulletMatches) {
      for (const dump of bulletMatches) {
        const lines = dump.split("\n").filter(l => l.trim());
        const avgLength = lines.reduce((sum, l) => sum + l.length, 0) / lines.length;
        
        if (avgLength < 50) {
          cleaned = cleaned.replace(dump, "");
        }
      }
    }

    // Step 4: Remove any remaining heading-style keyword markers
    cleaned = cleaned.replace(/^\s*\*\*\s*(relevant\s+)?keywords?\s*:?\s*\*\*/gim, "");
    cleaned = cleaned.replace(/^\s*#+\s*(relevant\s+)?keywords?\s*:?/gim, "");
    cleaned = cleaned.replace(/^\s*meta\s+description\s*:?/gim, "");

    // Step 5: Clean up excessive whitespace
    cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();

    return {
      cleaned,
      extractedKeywords: extractedKeywords.length > 0 ? extractedKeywords : undefined,
      extractedMeta,
    };
  }

  /**
   * Clean title - remove ALL variants of "SEO Blog" suffix and source suffixes
   */
  cleanTitle(title: string): string {
    if (!title) return "";

    let cleaned = title;

    // Remove all SEO Blog suffix variants (case-insensitive)
    cleaned = cleaned
      .replace(/\s*[–—\-|]\s*seo\s+blog\s*$/gi, "")
      .replace(/\s*\(\s*seo\s+blog\s*\)\s*$/gi, "")
      .replace(/\s*seo\s+blog\s*$/gi, "");
    
    // Remove long source suffixes that contain SEO Blog
    cleaned = cleaned.replace(/\s*[–—\-|]\s*[^–—\-|]+\s*[–—\-|]\s*seo\s+blog\s*$/gi, "");
    
    // Remove standalone source suffix if it's too long
    const suffixMatch = cleaned.match(/^(.+?)\s*[–—\-|]\s*([^–—\-|]+)$/);
    if (suffixMatch && suffixMatch[1].length > 20 && suffixMatch[2].length > 3) {
      const mainTitle = suffixMatch[1];
      const suffix = suffixMatch[2];
      
      if (suffix.split(/\s+/).length <= 3) {
        cleaned = mainTitle;
      }
    }

    // Normalize multiple dashes/pipes
    cleaned = cleaned
      .replace(/\s*[–—\-|]\s*[–—\-|]\s*/g, " – ")
      .replace(/\s+/g, " ")
      .trim();

    // Remove leading/trailing non-word characters
    cleaned = cleaned.replace(/^\W+|\W+$/g, "").trim();

    return cleaned;
  }

  /**
   * Sanitize content for WordPress - remove ALL LLM artifacts
   * 
   * NEW APPROACH: Strip SEO sections BEFORE markdown conversion
   * This ensures "Meta Description" and "Relevant Keywords" never appear in final HTML
   */
  sanitizeForWordPress(
    content: {
      title?: string;
      body?: string;
      excerpt?: string;
    },
    options: SanitizeOptions = {}
  ): SanitizedContent {
    const maxExcerptLength = options.maxExcerptLength || 160;

    const cleanedTitle = this.cleanTitle(content.title || "");
    
    let bodyText = content.body || "";
    
    // CRITICAL: Strip SEO sections BEFORE markdown/HTML conversion
    const stripped = this.stripSeoSections(bodyText);
    bodyText = stripped.cleaned;
    
    // Use extracted metadata if available
    const metaDescription = stripped.extractedMeta;
    const keywords = stripped.extractedKeywords || [];

    // Remove horizontal rule artifacts
    bodyText = bodyText.replace(/^\s*[–—\-]{3,}\s*$/gm, "");
    
    // Remove stray markdown heading markers at start of lines
    bodyText = bodyText.replace(/^\s*#+\s*/gm, "");
    
    // Normalize excessive newlines
    bodyText = bodyText.replace(/\n{3,}/g, "\n\n");
    bodyText = bodyText.trim();

    // Convert markdown to HTML
    let htmlBody = markdownToHtml(bodyText);

    // Demote H1 to H2
    htmlBody = htmlBody.replace(/<h1>(.*?)<\/h1>/g, "<h2>$1</h2>");

    // Remove any remaining stray ** markers
    htmlBody = htmlBody.replace(/\*\*/g, "");
    
    // Fix HTML entities
    htmlBody = htmlBody
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");

    // FINAL SAFETY CHECK: Remove any remaining "Meta Description" or "Keywords" text
    htmlBody = htmlBody.replace(/<p>\s*meta\s+description\s*:?.*?<\/p>/gi, "");
    htmlBody = htmlBody.replace(/<p>\s*(relevant\s+)?keywords\s*:?.*?<\/p>/gi, "");
    htmlBody = htmlBody.replace(/meta\s+description\s*:?/gi, "");
    htmlBody = htmlBody.replace(/(relevant\s+)?keywords\s*:/gi, "");

    // Generate excerpt
    let excerptText = content.excerpt || metaDescription || "";
    
    // CRITICAL: Strip "Meta Description:" label from excerpt if present
    excerptText = excerptText.replace(/^meta\s*description\s*[:\-–—]?\s*/i, "");
    
    if (!excerptText && bodyText) {
      const textOnly = bodyText
        .replace(/[#*_`]/g, "")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .trim();

      excerptText = textOnly.substring(0, maxExcerptLength);
      if (textOnly.length > maxExcerptLength) {
        excerptText += "...";
      }
    }

    return {
      title: cleanedTitle,
      body: htmlBody,
      excerpt: excerptText,
      metaDescription,
      keywords,
    };
  }

  generateStoryHash(canonicalUrl: string, title: string): string {
    const normalizedTitle = title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .trim();
    
    const hashInput = `${canonicalUrl}::${normalizedTitle}`;
    
    return Buffer.from(hashInput).toString("base64").substring(0, 64);
  }

  computeArabicRatio(text: string): number {
    if (!text) return 0;

    const arabicChars = text.match(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/g);
    const totalLetters = text.match(/\p{L}/gu);

    if (!totalLetters || totalLetters.length === 0) return 0;

    const arabicCount = arabicChars ? arabicChars.length : 0;
    return arabicCount / totalLetters.length;
  }

  detectLanguageIssue(
    content: string,
    allowedLanguages: string[],
    threshold: number = 0.05
  ): { hasIssue: boolean; reason?: string; arabicRatio?: number } {
    if (!allowedLanguages || allowedLanguages.length === 0) {
      return { hasIssue: false };
    }

    if (allowedLanguages.includes("en") && !allowedLanguages.includes("ar")) {
      const arabicRatio = this.computeArabicRatio(content);
      
      if (arabicRatio > threshold) {
        return {
          hasIssue: true,
          reason: `Arabic content detected: ${(arabicRatio * 100).toFixed(1)}%`,
          arabicRatio,
        };
      }
    }

    return { hasIssue: false };
  }
}

export const contentSanitizer = new ContentSanitizer();

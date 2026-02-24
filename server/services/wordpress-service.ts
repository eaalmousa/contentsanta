/**
 * WordPress REST API Service
 * Handles outbound communication from Content Santa to WordPress sites
 * Uses WordPress Application Password for authentication
 */

import type { Site } from "../shared/schema";

export interface WordPressCategory {
  id: number;
  count: number;
  description: string;
  link: string;
  name: string;
  slug: string;
  taxonomy: string;
  parent: number;
  meta: any[];
  _links: any;
}

export interface WordPressTag {
  id: number;
  count: number;
  description: string;
  link: string;
  name: string;
  slug: string;
  taxonomy: string;
  meta: any[];
  _links: any;
}

export interface WordPressPost {
  id: number;
  date: string;
  date_gmt: string;
  modified: string;
  modified_gmt: string;
  slug: string;
  status: string;
  type: string;
  link: string;
  title: { rendered: string };
  content: { rendered: string; protected: boolean };
  excerpt: { rendered: string; protected: boolean };
  author: number;
  featured_media: number;
  comment_status: string;
  ping_status: string;
  sticky: boolean;
  template: string;
  format: string;
  meta: any[];
  categories: number[];
  tags: number[];
  _links: any;
}

export interface WordPressSiteInfo {
  name: string;
  description: string;
  url: string;
  home: string;
  gmt_offset: number;
  timezone_string: string;
  namespaces: string[];
  authentication: any;
  routes: any;
}

export interface WordPressHealthCheck {
  ok: boolean;
  error?: string;
  siteInfo?: {
    name: string;
    url: string;
    apiVersion?: string;
  };
}

export class WordPressService {
  
  /**
   * Get Basic Auth header for WordPress REST API
   */
  private getBasicAuth(username: string, appPassword: string): string {
    const credentials = `${username}:${appPassword}`;
    return Buffer.from(credentials).toString('base64');
  }

  /**
   * Make authenticated request to WordPress REST API
   */
  private async makeRequest<T>(
    url: string,
    username: string,
    appPassword: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: HeadersInit = {
      'Authorization': `Basic ${this.getBasicAuth(username, appPassword)}`,
      'Content-Type': 'application/json',
      'User-Agent': 'ContentSanta/1.0',
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });

    if (!response.ok) {
      let errorMessage = `WordPress API error: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.code || errorMessage;
      } catch (e) {
        // Ignore JSON parse errors
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  /**
   * Test connection to WordPress site
   */
  async testConnection(site: Site): Promise<WordPressHealthCheck> {
    if (!site.wpSiteUrl || !site.wpUsername || !site.wpAppPassword) {
      return {
        ok: false,
        error: 'Missing WordPress credentials (URL, username, or app password)',
      };
    }

    try {
      const wpUrl = site.wpSiteUrl.replace(/\/$/, '');
      const siteInfo = await this.makeRequest<WordPressSiteInfo>(
        `${wpUrl}/wp-json/`,
        site.wpUsername,
        site.wpAppPassword
      );

      return {
        ok: true,
        siteInfo: {
          name: siteInfo.name,
          url: siteInfo.url,
          apiVersion: siteInfo.namespaces?.find(ns => ns.startsWith('wp/v'))?.split('/')?.[1],
        },
      };
    } catch (error: any) {
      return {
        ok: false,
        error: error.message || 'Connection failed',
      };
    }
  }

  /**
   * Fetch all categories from WordPress
   */
  async fetchCategories(site: Site): Promise<WordPressCategory[]> {
    if (!site.wpSiteUrl || !site.wpUsername || !site.wpAppPassword) {
      throw new Error('Missing WordPress credentials');
    }

    const wpUrl = site.wpSiteUrl.replace(/\/$/, '');
    const categories: WordPressCategory[] = [];
    let page = 1;
    const perPage = 100;

    // WordPress REST API uses pagination
    while (true) {
      const batch = await this.makeRequest<WordPressCategory[]>(
        `${wpUrl}/wp-json/wp/v2/categories?per_page=${perPage}&page=${page}&orderby=id&order=asc`,
        site.wpUsername,
        site.wpAppPassword
      );

      if (!batch || batch.length === 0) break;
      
      categories.push(...batch);
      
      // If we got less than perPage, we're done
      if (batch.length < perPage) break;
      
      page++;
      
      // Safety limit to prevent infinite loops
      if (page > 100) {
        console.warn('[WordPress] Category fetch limit reached (10,000 categories)');
        break;
      }
    }

    return categories;
  }

  /**
   * Fetch all tags from WordPress
   */
  async fetchTags(site: Site): Promise<WordPressTag[]> {
    if (!site.wpSiteUrl || !site.wpUsername || !site.wpAppPassword) {
      throw new Error('Missing WordPress credentials');
    }

    const wpUrl = site.wpSiteUrl.replace(/\/$/, '');
    const tags: WordPressTag[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const batch = await this.makeRequest<WordPressTag[]>(
        `${wpUrl}/wp-json/wp/v2/tags?per_page=${perPage}&page=${page}&orderby=id&order=asc`,
        site.wpUsername,
        site.wpAppPassword
      );

      if (!batch || batch.length === 0) break;
      
      tags.push(...batch);
      
      if (batch.length < perPage) break;
      
      page++;
      
      if (page > 100) {
        console.warn('[WordPress] Tag fetch limit reached (10,000 tags)');
        break;
      }
    }

    return tags;
  }

  /**
   * Fetch recent posts from WordPress
   */
  async fetchRecentPosts(site: Site, limit: number = 10): Promise<WordPressPost[]> {
    if (!site.wpSiteUrl || !site.wpUsername || !site.wpAppPassword) {
      throw new Error('Missing WordPress credentials');
    }

    const wpUrl = site.wpSiteUrl.replace(/\/$/, '');
    
    return this.makeRequest<WordPressPost[]>(
      `${wpUrl}/wp-json/wp/v2/posts?per_page=${limit}&orderby=date&order=desc`,
      site.wpUsername,
      site.wpAppPassword
    );
  }

  /**
   * Create a post via WordPress REST API (Direct publishing mode)
   */
  async createPost(
    site: Site,
    post: {
      title: string;
      content: string;
      status?: 'draft' | 'publish';
      categories?: number[];
      tags?: number[];
      excerpt?: string;
      featured_media?: number;
    }
  ): Promise<WordPressPost> {
    if (!site.wpSiteUrl || !site.wpUsername || !site.wpAppPassword) {
      throw new Error('Missing WordPress credentials');
    }

    const wpUrl = site.wpSiteUrl.replace(/\/$/, '');
    
    return this.makeRequest<WordPressPost>(
      `${wpUrl}/wp-json/wp/v2/posts`,
      site.wpUsername,
      site.wpAppPassword,
      {
        method: 'POST',
        body: JSON.stringify({
          title: post.title,
          content: post.content,
          status: post.status || 'draft',
          categories: post.categories || [],
          tags: post.tags || [],
          excerpt: post.excerpt || '',
          featured_media: post.featured_media || 0,
        }),
      }
    );
  }
}

// Singleton instance
export const wordpressService = new WordPressService();

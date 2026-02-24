/**
 * WordPress Category & Tag Service
 * Manages syncing categories and tags from WordPress sites to local database
 */

import { db } from "../db";
import { sites, wpCategories, wpTags } from "../../shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { wordpressService } from "./wordpress-service";
import type { Site } from "../../shared/schema";

export class WpCategoryService {
  
  /**
   * Sync categories from WordPress to local database
   */
  async syncCategories(siteId: string): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      // Get site
      const site = await db.query.sites.findFirst({
        where: eq(sites.id, siteId)
      });

      if (!site) {
        return { success: false, count: 0, error: "Site not found" };
      }

      if (!site.wpSiteUrl || !site.wpUsername || !site.wpAppPassword) {
        return { success: false, count: 0, error: "WordPress credentials not configured" };
      }

      console.log(`[WP Category] Syncing categories for site: ${site.name}`);

      // Fetch categories from WordPress
      const wpCats = await wordpressService.fetchCategories(site);
      console.log(`[WP Category] Fetched ${wpCats.length} categories from WordPress`);

      if (wpCats.length === 0) {
        // Update sync timestamp even if no categories
        await db
          .update(sites)
          .set({
            lastCategorySync: new Date(),
            categoriesCount: 0,
          })
          .where(eq(sites.id, siteId));

        return { success: true, count: 0 };
      }

      // Delete old categories for this site (will be replaced)
      await db.delete(wpCategories).where(eq(wpCategories.siteId, siteId));

      // Insert new categories
      const categoriesToInsert = wpCats.map(cat => ({
        siteId: siteId,
        wpCategoryId: cat.id,
        name: cat.name,
        slug: cat.slug,
        description: cat.description || null,
        parentId: cat.parent || null,
        count: cat.count || 0,
        syncedAt: new Date(),
      }));

      await db.insert(wpCategories).values(categoriesToInsert);

      // Update site sync info
      await db
        .update(sites)
        .set({
          lastCategorySync: new Date(),
          categoriesCount: wpCats.length,
        })
        .where(eq(sites.id, siteId));

      console.log(`[WP Category] Successfully synced ${wpCats.length} categories`);

      return { success: true, count: wpCats.length };

    } catch (error: any) {
      console.error(`[WP Category] Sync failed:`, error);
      return {
        success: false,
        count: 0,
        error: error.message || "Unknown error during category sync",
      };
    }
  }

  /**
   * Sync tags from WordPress to local database
   */
  async syncTags(siteId: string): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      // Get site
      const site = await db.query.sites.findFirst({
        where: eq(sites.id, siteId)
      });

      if (!site) {
        return { success: false, count: 0, error: "Site not found" };
      }

      if (!site.wpSiteUrl || !site.wpUsername || !site.wpAppPassword) {
        return { success: false, count: 0, error: "WordPress credentials not configured" };
      }

      console.log(`[WP Tag] Syncing tags for site: ${site.name}`);

      // Fetch tags from WordPress
      const wpTagList = await wordpressService.fetchTags(site);
      console.log(`[WP Tag] Fetched ${wpTagList.length} tags from WordPress`);

      if (wpTagList.length === 0) {
        // Update sync timestamp even if no tags
        await db
          .update(sites)
          .set({
            lastTagSync: new Date(),
            tagsCount: 0,
          })
          .where(eq(sites.id, siteId));

        return { success: true, count: 0 };
      }

      // Delete old tags for this site
      await db.delete(wpTags).where(eq(wpTags.siteId, siteId));

      // Insert new tags
      const tagsToInsert = wpTagList.map(tag => ({
        siteId: siteId,
        wpTagId: tag.id,
        name: tag.name,
        slug: tag.slug,
        description: tag.description || null,
        count: tag.count || 0,
        syncedAt: new Date(),
      }));

      await db.insert(wpTags).values(tagsToInsert);

      // Update site sync info
      await db
        .update(sites)
        .set({
          lastTagSync: new Date(),
          tagsCount: wpTagList.length,
        })
        .where(eq(sites.id, siteId));

      console.log(`[WP Tag] Successfully synced ${wpTagList.length} tags`);

      return { success: true, count: wpTagList.length };

    } catch (error: any) {
      console.error(`[WP Tag] Sync failed:`, error);
      return {
        success: false,
        count: 0,
        error: error.message || "Unknown error during tag sync",
      };
    }
  }

  /**
   * Get categories for a site (from local database)
   */
  async getCategories(siteId: string) {
    return db.query.wpCategories.findMany({
      where: eq(wpCategories.siteId, siteId),
      orderBy: (cats, { asc }) => [asc(cats.name)],
    });
  }

  /**
   * Get tags for a site (from local database)
   */
  async getTags(siteId: string) {
    return db.query.wpTags.findMany({
      where: eq(wpTags.siteId, siteId),
      orderBy: (tags, { asc }) => [asc(tags.name)],
    });
  }

  /**
   * Find category by name or slug
   */
  async findCategory(siteId: string, nameOrSlug: string) {
    return db.query.wpCategories.findFirst({
      where: and(
        eq(wpCategories.siteId, siteId),
        sql`(${wpCategories.name} ILIKE ${nameOrSlug} OR ${wpCategories.slug} = ${nameOrSlug})`
      ),
    });
  }

  /**
   * Find tag by name or slug
   */
  async findTag(siteId: string, nameOrSlug: string) {
    return db.query.wpTags.findFirst({
      where: and(
        eq(wpTags.siteId, siteId),
        sql`(${wpTags.name} ILIKE ${nameOrSlug} OR ${wpTags.slug} = ${nameOrSlug})`
      ),
    });
  }
}

// Singleton instance
export const wpCategoryService = new WpCategoryService();

import { users, type User, type UpsertUser } from "@shared/models/auth";
import { workspaces, workspaceUsers } from "@shared/schema";
import { db } from "../../db";
import { eq, sql } from "drizzle-orm";
import crypto from "crypto";

// Interface for auth storage operations
// (IMPORTANT) These user operations are mandatory for Replit Auth.
export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  getUserDefaultWorkspace(userId: string): Promise<{ id: string; slug: string; name: string } | null>;
  ensureUserHasWorkspace(userId: string, email?: string): Promise<{ id: string; slug: string; name: string }>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // First check if a user with this email already exists (different ID)
    if (userData.email) {
      const [existingByEmail] = await db.select().from(users).where(eq(users.email, userData.email));
      if (existingByEmail && existingByEmail.id !== userData.id) {
        // Update the existing user's ID to the new sub (handles test reruns with same email)
        const [updated] = await db
          .update(users)
          .set({
            id: userData.id,
            firstName: userData.firstName,
            lastName: userData.lastName,
            profileImageUrl: userData.profileImageUrl,
            updatedAt: new Date(),
          })
          .where(eq(users.email, userData.email))
          .returning();
        
        // Ensure workspace exists after update
        await this.ensureUserHasWorkspace(updated.id, updated.email || undefined);
        return updated;
      }
    }
    
    // Check if this is a new user (not existing)
    const [existingUser] = await db.select().from(users).where(sql`${users.id} = ${userData.id}`);
    const isNewUser = !existingUser;
    
    // Standard upsert by ID
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    
    // Always ensure user has workspace (covers both new users and existing users without workspace)
    await this.ensureUserHasWorkspace(user.id, user.email || undefined);
    
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  /**
   * Get the user's default workspace (first workspace they belong to)
   */
  async getUserDefaultWorkspace(userId: string): Promise<{ id: string; slug: string; name: string } | null> {
    const result = await db
      .select({
        id: workspaces.id,
        slug: workspaces.slug,
        name: workspaces.name,
      })
      .from(workspaceUsers)
      .innerJoin(workspaces, eq(workspaceUsers.workspaceId, workspaces.id))
      .where(eq(workspaceUsers.userId, userId))
      .limit(1);
    
    return result[0] || null;
  }

  /**
   * Ensure user has at least one workspace, creating one if needed
   */
  async ensureUserHasWorkspace(userId: string, email?: string): Promise<{ id: string; slug: string; name: string }> {
    // Check if user already has a workspace
    const existing = await this.getUserDefaultWorkspace(userId);
    if (existing) {
      return existing;
    }

    // Create a new workspace for the user
    const workspaceId = crypto.randomUUID();
    const baseSlug = email 
      ? email.split("@")[0].toLowerCase().replace(/[^a-z0-9]/g, "-")
      : `user-${userId.substring(0, 8)}`;
    const slug = `${baseSlug}-${crypto.randomUUID().substring(0, 8)}`;
    const name = email 
      ? `${email.split("@")[0]}'s Workspace`
      : "My Workspace";

    console.log(`[Auth] Creating workspace ${workspaceId} (${slug}) for user ${userId}`);

    // Create workspace
    await db.insert(workspaces).values({
      id: workspaceId,
      name,
      slug,
      features: {},
    });

    // Create workspace membership with owner role
    await db.insert(workspaceUsers).values({
      workspaceId,
      userId,
      role: "owner",
    });

    console.log(`[Auth] Created workspace ${workspaceId} with owner membership for user ${userId}`);

    return { id: workspaceId, slug, name };
  }
}

export const authStorage = new AuthStorage();

/**
 * Resolve workspace ID from authenticated user
 * Returns the user's default workspace UUID (not a slug)
 * Auto-creates a workspace if the user doesn't have one
 */
export async function resolveWorkspaceId(userId: string): Promise<string | null> {
  const workspace = await authStorage.ensureUserHasWorkspace(userId);
  return workspace?.id || null;
}

/**
 * Resolve workspace with full details from authenticated user
 * Auto-creates a workspace if the user doesn't have one
 */
export async function resolveWorkspace(userId: string): Promise<{ id: string; slug: string; name: string } | null> {
  return authStorage.ensureUserHasWorkspace(userId);
}
